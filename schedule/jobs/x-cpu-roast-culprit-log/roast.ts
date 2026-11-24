import {
    appendFileSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

export interface RoastDeps {
    now(): number;
    load(): number | null;
    ps(): string;
    threads(): string;
    cwdOf(pid: number): string;
    sleep(ms: number): void;
}

export interface RoastConfig {
    stateDir: string;
    loadMin: number;
    spanSeconds: number;
    gapSeconds: number;
}

export const LOG = 'x-cpu-roast-culprit-log.log';
export const LAST_POLL = 'x-cpu-roast-culprit-log.last-poll';
const STAMP = 'x-cpu-roast-culprit-log.stamp';

// a poll this long after the last one starts the stretch anew: the mac slept, or launchd ran late
const RESTART_AFTER_MS = 150_000;
const CHAIN_STEPS = 12;
const TOP_PROCESSES = 5;
// lsof costs about 40 ms a process at load: only the heaviest processes of no thread are asked for a folder
const FOLDER_LOOKUPS = 20;
const COMMAND_TAIL = 60;
const NO_LANE = 'no lane';
const VM_NAME = 'vm-go-test';
const VM_PROCESS =
    /com\.apple\.Virtualization\.VirtualMachine|\/\.lima\/vm-go-test\b/;
const WORKTREE_FOLDER = /\/\.claude\/worktrees\/([^/]+)/;

interface Proc {
    pid: number;
    ppid: number;
    centis: number;
    command: string;
}

interface Stamp {
    overSince: number;
    lastOver: number;
    rowWritten: boolean;
    baseline: { at: number; centis: Record<string, number> };
}

// one poll: the load, and while it stays over, one row per stretch, naming the lane that burned the cpu
export function poll(config: RoastConfig, deps: RoastDeps): void {
    mkdirSync(config.stateDir, { recursive: true });
    const now = deps.now();
    writeFileSync(join(config.stateDir, LAST_POLL), String(now));
    const load = deps.load();
    if (load === null) return;
    const stampPath = join(config.stateDir, STAMP);
    if (load < config.loadMin) {
        rmSync(stampPath, { force: true });
        return;
    }
    let stamp = readStamp(stampPath);
    if (stamp === null || now - stamp.lastOver > RESTART_AFTER_MS) {
        stamp = {
            baseline: baselineOf(parsePs(deps.ps()), now),
            lastOver: now,
            overSince: now,
            rowWritten: false,
        };
    } else {
        stamp.lastOver = now;
    }
    if (
        !stamp.rowWritten &&
        now - stamp.overSince >= config.spanSeconds * 1000
    ) {
        const wait = config.gapSeconds * 1000 - (now - stamp.baseline.at);
        if (wait > 0) deps.sleep(wait);
        const procs = parsePs(deps.ps());
        const line = rowOf(
            deps.now(),
            load,
            stamp.baseline.centis,
            procs,
            deps,
        );
        appendFileSync(join(config.stateDir, LOG), `${line}\n`);
        stamp.rowWritten = true;
    }
    writeFileSync(stampPath, JSON.stringify(stamp));
}

function readStamp(path: string): Stamp | null {
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as Stamp;
    } catch {
        return null;
    }
}

function baselineOf(procs: Proc[], at: number): Stamp['baseline'] {
    const centis: Record<string, number> = {};
    for (const proc of procs) centis[proc.pid] = proc.centis;
    return { at, centis };
}

// `ps -Ao pid,ppid,time,command`; its header and any line that does not open on a pid are skipped
function parsePs(text: string): Proc[] {
    const procs: Proc[] = [];
    for (const line of text.split('\n')) {
        const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
        if (match === null) continue;
        const [, pid = '', ppid = '', time = '', command = ''] = match;
        const seconds = time
            .split(':')
            .reduce((total, part) => total * 60 + Number(part), 0);
        procs.push({
            centis: Math.round(seconds * 100),
            command: command.replace(/[\t\n]/g, ' '),
            pid: Number(pid),
            ppid: Number(ppid),
        });
    }
    return procs;
}

function rowOf(
    at: number,
    load: number,
    baseline: Stamp['baseline']['centis'],
    procs: Proc[],
    deps: RoastDeps,
): string {
    // the cpu each process gained since the baseline; one born since it counts its whole cpu time
    const gains = procs
        .map((proc) => {
            const before = baseline[proc.pid];
            const gain =
                before === undefined ? proc.centis : proc.centis - before;
            return { gain, proc };
        })
        .filter(({ gain }) => gain > 0)
        .sort((a, b) => b.gain - a.gain);
    const threads = threadsOf(deps);
    const parent = new Map(procs.map((proc) => [proc.pid, proc.ppid]));
    let lookups = 0;
    const laneOf = (proc: Proc): string => {
        if (VM_PROCESS.test(proc.command)) return NO_LANE;
        let pid = proc.pid;
        for (let step = 0; step <= CHAIN_STEPS; step++) {
            const thread = threads.labels.get(pid);
            if (thread !== undefined) return thread;
            pid = parent.get(pid) ?? 0;
            if (pid <= 1) break;
        }
        if (lookups >= FOLDER_LOOKUPS) return NO_LANE;
        lookups++;
        return WORKTREE_FOLDER.exec(deps.cwdOf(proc.pid))?.[1] ?? NO_LANE;
    };
    const lanes = gains.map(({ proc, gain }) => ({
        gain,
        lane: laneOf(proc),
        proc,
    }));
    const totals = new Map<string, number>();
    for (const { gain, lane } of lanes)
        totals.set(lane, (totals.get(lane) ?? 0) + gain);
    const perLane = [...totals]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([lane, gain]) => `${lane} ${seconds(gain)}`)
        .join(', ');
    const top = lanes.slice(0, TOP_PROCESSES).map(({ proc, gain, lane }) => {
        const name = VM_PROCESS.test(proc.command)
            ? VM_NAME
            : proc.command.slice(-COMMAND_TAIL);
        return `${proc.pid} ${seconds(gain)} ${name} @ ${lane}`;
    });
    return [
        stampOf(at),
        load.toFixed(2),
        perLane,
        ...top,
        ...(threads.unread ? ['threads unread'] : []),
    ].join('\t');
}

const seconds = (centis: number) => `${(centis / 100).toFixed(1)}s`;

// `x thread list --json`: each thread's pid and its lane, else its role; a failure or a shape it cannot read is «unread»
function threadsOf(deps: RoastDeps): {
    labels: Map<number, string>;
    unread: boolean;
} {
    const labels = new Map<number, string>();
    try {
        const parsed = JSON.parse(deps.threads());
        const list: { pid: number; role?: string; lane?: string | null }[] =
            parsed.data?.threads ?? parsed.data ?? parsed;
        for (const thread of list)
            labels.set(thread.pid, thread.lane ?? thread.role ?? 'thread');
        return { labels, unread: false };
    } catch {
        return { labels: new Map(), unread: true };
    }
}

// local time with its offset, which Date.parse reads back
function stampOf(ms: number): string {
    const at = new Date(ms);
    const two = (n: number) => String(n).padStart(2, '0');
    const offset = -at.getTimezoneOffset();
    return (
        `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}` +
        `T${two(at.getHours())}:${two(at.getMinutes())}:${two(at.getSeconds())}` +
        `${offset < 0 ? '-' : '+'}${two(Math.floor(Math.abs(offset) / 60))}:${two(Math.abs(offset) % 60)}`
    );
}
