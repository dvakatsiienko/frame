// the siesta's «lane pace» section (FRM-672): per running lane since the last siesta, from its transcript and `git log` — commits,
// lines per commit, the share of its time spent waiting (tests, tsc, commit and push, the commit queue), and a projected finish
// against its ticket's size budget. a red never parks a lane: it names the likely fix, for clio to send as a steer.
// the method is the 20 Nov pace read across lanes (FRM-672's refs), ported from its pace.py
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// S is 4 h, M 8 h (dima's o2 pick b, FRM-672:W11); a size with no budget reads «no projection»
const BUDGET_HOURS: Record<string, number> = { M: 8, S: 4 };
const HOUR_S = 3600;
// a lane under this is a small-commit lane: right for chores, a cost beside a long wait
const SMALL_COMMIT_LINES = 100;
const WAITING_OVER = 0.5;
// a projection needs an hour of pace behind it
const MIN_PROJECT_S = HOUR_S;
// a clock hour counts as worked when its lane was not idle for most of it
const WORKED_HOUR = 0.5;
const REPEATED_RUNS = 3;

const FIXED = new Set(['commitpush', 'test', 'tsc']);
const PRIORITY = ['commitpush', 'test', 'tsc', 'land', 'agent', 'other'];
const TASK_NOTE =
    /<task-id>(\w+)<\/task-id>\s*<tool-use-id>(\w+)<\/tool-use-id>/;

export type Commit = {
    sha: string;
    subject: string;
    t: number;
    add: number;
    rem: number;
};
export type Plan = { done: number; total: number };
export type LaneInput = {
    name: string;
    transcript: string;
    commits: Commit[];
    plan: Plan | null;
    size: string | null;
    // epoch seconds: nothing before it counts, nothing after `until`
    since: number;
    until?: number;
    // where the lane's chain scripts live, to read what they run
    scratchpad?: string;
};
export type LanePace = {
    name: string;
    flag: '🟢' | '🔴' | '➖';
    commits: number;
    medianLines: number;
    waiting: number;
    hours: number;
    projectedHours: number | null;
    budgetHours: number | null;
    reasons: string[];
    fix: string;
    line: string;
};

type Use = {
    input: string;
    kind: string;
    ts: number;
    name: string;
    command: string;
    background: boolean;
};
type Result = { ts: number; text: string };
type Seg = { from: number; to: number; state: string };

const stripHeredoc = (command: string) =>
    command.replace(/<<-?\s*'?(\w+)'?.*?\n\1\b/gs, '<<HD');

export function classify(command: string) {
    const c = stripHeredoc(command);
    if (
        /x lane (commit|push)|git (commit|push)|x mods edit (push|commit)|land\.sh/.test(
            c,
        )
    )
        return 'commitpush';
    if (/vitest|pnpm (run )?test|go test|x mods edit test/.test(c))
        return 'test';
    if (/\btsc\b|typecheck/.test(c)) return 'tsc';
    if (c.includes('herdr-mods:land')) return 'land';
    return 'other';
}

// a command that runs a script is classified by the script's own text, when it is still on disk (a lane's chain scripts hide their
// commit and test runs from the command line)
function kindOfUse(name: string, command: string, scratchpad: string) {
    if (name === 'Agent' || name === 'Task') return 'agent';
    if (name !== 'Bash') return 'other';
    const kind = classify(command);
    if (kind !== 'other') return kind;
    const scripts = stripHeredoc(command).matchAll(
        /(?:^|[;&|]\s*|bash |timeout \d+ )(\S+\.sh)(?:\s|$)/g,
    );
    for (const [, script] of scripts) {
        const file = path.isAbsolute(script ?? '')
            ? (script as string)
            : path.join(scratchpad, script ?? '');
        try {
            const inner = classify(readFileSync(file, 'utf8'));
            if (inner !== 'other') return inner;
        } catch {}
    }
    return 'other';
}

const kindOf = (use: Use) => use.kind;

const textOf = (content: unknown): string => {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return JSON.stringify(content ?? '');
    return content
        .map((block) =>
            typeof block === 'object' && block !== null && 'text' in block
                ? String((block as { text: unknown }).text)
                : '',
        )
        .join(' ');
};

// every record of a lane's transcript: who spoke when, each tool call with its result, and when each background task ended
export function readTranscript(text: string, scratchpad = '') {
    const records: [number, 'A' | 'R' | 'N' | 'U'][] = [];
    const uses = new Map<string, Use>();
    const results = new Map<string, Result>();
    const ended = new Map<string, number>();
    const noteEnd = (body: string, ts: number) => {
        const match = TASK_NOTE.exec(body);
        const id = match?.[2];
        if (id && (ended.get(id) ?? Number.POSITIVE_INFINITY) > ts)
            ended.set(id, ts);
        return Boolean(match);
    };
    for (const raw of text.split('\n')) {
        if (!raw.trim()) continue;
        let entry: Record<string, any>;
        try {
            entry = JSON.parse(raw);
        } catch {
            continue;
        }
        const ts = Date.parse(entry.timestamp ?? '') / 1000;
        if (Number.isNaN(ts)) continue;
        const content = entry.message?.content;
        if (entry.type === 'assistant' && Array.isArray(content)) {
            for (const block of content) {
                if (block?.type === 'tool_use')
                    uses.set(block.id, {
                        background: Boolean(block.input?.run_in_background),
                        command: String(block.input?.command ?? ''),
                        input: JSON.stringify(block.input ?? {}),
                        kind: kindOfUse(
                            block.name,
                            String(block.input?.command ?? ''),
                            scratchpad,
                        ),
                        name: block.name,
                        ts,
                    });
                records.push([ts, 'A']);
            }
        } else if (entry.type === 'user') {
            if (
                Array.isArray(content) &&
                content.length > 0 &&
                content.every((b) => b?.type === 'tool_result')
            ) {
                for (const block of content) {
                    results.set(block.tool_use_id, {
                        text: textOf(block.content),
                        ts,
                    });
                    records.push([ts, 'R']);
                }
            } else {
                records.push([ts, noteEnd(textOf(content), ts) ? 'N' : 'U']);
            }
        } else if (
            entry.type === 'queue-operation' &&
            entry.operation === 'enqueue'
        ) {
            noteEnd(String(entry.content ?? ''), ts);
        } else if (
            entry.type === 'attachment' &&
            entry.attachment?.type === 'queued_command'
        ) {
            noteEnd(textOf(entry.attachment.prompt), ts);
            records.push([ts, 'N']);
        }
    }
    records.sort((a, b) => a[0] - b[0]);
    return { ended, records, results, uses };
}

// the lane's wall time cut into one state each: a foreground call is its kind, between calls the model thinks, takes in a result or
// waits idle, and idle under a background test, tsc or commit is waiting on it
export function segments(
    transcript: string,
    since: number,
    until = Number.POSITIVE_INFINITY,
    scratchpad = '',
) {
    const { records, uses, results, ended } = readTranscript(
        transcript,
        scratchpad,
    );
    const first = records[0]?.[0];
    const last = records.at(-1)?.[0];
    if (first === undefined || last === undefined)
        return { first: 0, segs: [], t0: 0, t1: 0 };
    const t0 = Math.max(first, since);
    const t1 = Math.min(last, until);
    const foreground: [number, number, string][] = [];
    const background: [number, number, string][] = [];
    for (const [id, use] of uses) {
        const result = results.get(id);
        if (!result) continue;
        const kind = kindOf(use);
        foreground.push([use.ts, result.ts, kind]);
        if (
            use.background &&
            result.text.startsWith('Command running in background')
        )
            background.push([use.ts, ended.get(id) ?? t1, kind]);
    }
    const points = new Set<number>([t0, t1]);
    for (const [ts] of records) points.add(ts);
    for (const [a, b] of [...foreground, ...background]) {
        points.add(a);
        points.add(b);
    }
    for (let h = Math.floor(t0 / HOUR_S) * HOUR_S; h < t1 + HOUR_S; h += HOUR_S)
        points.add(h);
    const sorted = [...points]
        .filter((p) => p >= t0 && p <= t1)
        .sort((a, b) => a - b);
    const times = records.map((r) => r[0]);
    const segs: Seg[] = [];
    for (let i = 0; i + 1 < sorted.length; i++) {
        const from = sorted[i] as number;
        const to = sorted[i + 1] as number;
        if (to <= from) continue;
        const mid = (from + to) / 2;
        const active = foreground
            .filter(([a, b]) => a <= mid && mid < b)
            .map(([, , k]) => k);
        const waits = background
            .filter(([a, b, k]) => a <= mid && mid < b && FIXED.has(k))
            .map(([, , k]) => k);
        let state: string;
        if (active.length > 0) {
            state = [...active].sort(
                (x, y) => PRIORITY.indexOf(x) - PRIORITY.indexOf(y),
            )[0] as string;
        } else {
            let at = times.findIndex((t) => t > mid);
            if (at < 0) at = records.length;
            const next = records[at]?.[1] ?? 'U';
            state = next === 'A' ? 'model' : next === 'R' ? 'other' : 'idle';
            if (state === 'idle' && waits.length > 0) state = 'wait_bg';
        }
        segs.push({ from, state, to });
    }
    return { first, segs, t0, t1 };
}

const isBlocked = (state: string) => FIXED.has(state) || state === 'wait_bg';

const clip = (seg: Seg, lo: number, hi: number) =>
    Math.max(0, Math.min(seg.to, hi) - Math.max(seg.from, lo));

export function median(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length === 0) return 0;
    return sorted.length % 2
        ? (sorted[mid] as number)
        : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

// the share of cycle time spent blocked: a cycle runs from the previous landing, or the lane's start, to its commit
function waitingShare(segs: Seg[], commits: Commit[], t0: number) {
    let cycle = 0;
    let blocked = 0;
    let prev = t0;
    for (const commit of commits) {
        if (commit.t > prev) {
            cycle += commit.t - prev;
            blocked += segs
                .filter((s) => isBlocked(s.state))
                .reduce((sum, s) => sum + clip(s, prev, commit.t), 0);
        }
        prev = commit.t;
    }
    return cycle > 0 ? blocked / cycle : 0;
}

// a clock hour inside the lane's span where it worked and landed nothing
function emptyHour(segs: Seg[], commits: Commit[], t0: number, t1: number) {
    for (
        let h = Math.ceil(t0 / HOUR_S) * HOUR_S;
        h + HOUR_S <= t1;
        h += HOUR_S
    ) {
        const idle = segs
            .filter((s) => s.state === 'idle')
            .reduce((sum, s) => sum + clip(s, h, h + HOUR_S), 0);
        const landed = commits.some((c) => c.t >= h && c.t < h + HOUR_S);
        if (!landed && 1 - idle / HOUR_S >= WORKED_HOUR) return h;
    }
    return null;
}

// the same normalized test command three times in one clock hour: a loop
function repeatedRun(transcript: string, since: number, scratchpad: string) {
    const { uses } = readTranscript(transcript, scratchpad);
    const counts = new Map<string, number>();
    for (const use of uses.values()) {
        if (
            use.name !== 'Bash' ||
            use.ts < since ||
            classify(use.command) !== 'test'
        )
            continue;
        const command = stripHeredoc(use.command)
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 110);
        const key = `${Math.floor(use.ts / HOUR_S)} ${command}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, n] of counts)
        if (n >= REPEATED_RUNS) return key.slice(key.indexOf(' ') + 1);
    return null;
}

function typeErrorRuns(transcript: string, since: number, scratchpad: string) {
    const { uses, results } = readTranscript(transcript, scratchpad);
    let n = 0;
    for (const [id, use] of uses)
        if (
            use.ts >= since &&
            FIXED.has(kindOf(use)) &&
            /error TS\d+|typecheck: /.test(results.get(id)?.text ?? '')
        )
            n++;
    return n;
}

const hoursOf = (s: number) => Math.round((s / HOUR_S) * 10) / 10;

export function lanePace(lane: LaneInput): LanePace {
    const { first, segs, t0, t1 } = segments(
        lane.transcript,
        lane.since,
        lane.until,
        lane.scratchpad,
    );
    if (t1 <= t0)
        return {
            budgetHours: null,
            commits: 0,
            fix: '',
            flag: '➖',
            hours: 0,
            line: `➖ ${lane.name} — no activity since the last siesta`,
            medianLines: 0,
            name: lane.name,
            projectedHours: null,
            reasons: [],
            waiting: 0,
        };
    const commits = lane.commits
        .filter((c) => c.t >= t0 && c.t <= t1)
        .sort((a, b) => a.t - b.t);
    const medianLines = median(commits.map((c) => c.add + c.rem));
    const waiting = waitingShare(segs, commits, t0);
    const elapsed = t1 - t0;
    const budgetHours = (lane.size && BUDGET_HOURS[lane.size]) || null;
    const share =
        lane.plan && lane.plan.total > 0 ? lane.plan.done / lane.plan.total : 0;
    const projectedHours =
        share > 0 && t1 - first >= MIN_PROJECT_S
            ? hoursOf((t1 - first) / share)
            : null;
    const reasons: string[] = [];
    const empty = emptyHour(segs, commits, t0, t1);
    if (empty !== null) reasons.push('an hour with nothing landed');
    if (
        projectedHours !== null &&
        budgetHours !== null &&
        projectedHours > budgetHours
    )
        reasons.push(
            `projected ~${Math.round(projectedHours)} h, budget ${lane.size} ${budgetHours} h`,
        );
    const red = reasons.length > 0;
    const numbers = `${commits.length} commits, ${Math.round(medianLines)} lines a commit, ${Math.round(waiting * 100)} % waiting, ${hoursOf(elapsed)} h in`;
    let fix = '';
    if (red) {
        const loop = repeatedRun(
            lane.transcript,
            lane.since,
            lane.scratchpad ?? '',
        );
        if (waiting > WAITING_OVER && medianLines < SMALL_COMMIT_LINES)
            fix =
                'bigger cycles: batch the small commits, the chain waits dominate';
        else if (
            typeErrorRuns(lane.transcript, lane.since, lane.scratchpad ?? '') >=
            2
        )
            fix =
                'a typecheck first: tsc says it in seconds, the chain in minutes';
        else if (loop)
            fix = `a repeated loop: ${loop} runs ${REPEATED_RUNS}+ times an hour`;
        else fix = 'ask what it waits on';
    }
    const tail =
        projectedHours === null && !red
            ? ' · no projection (no lane plan tick, or under an hour in)'
            : projectedHours !== null
              ? ` · projected ~${Math.round(projectedHours)} h${budgetHours ? `, budget ${lane.size} ${budgetHours} h` : ', no budget for its size'}`
              : '';
    const flag = red ? '🔴' : projectedHours === null ? '➖' : '🟢';
    const line = `${flag} ${lane.name} — ${red ? `${reasons.join('; ')} · why: ${numbers} · likely fix: ${fix}` : `${numbers}${tail}`}`;
    return {
        budgetHours,
        commits: commits.length,
        fix,
        flag,
        hours: hoursOf(elapsed),
        line,
        medianLines,
        name: lane.name,
        projectedHours,
        reasons,
        waiting,
    };
}

/* the siesta's section: the running lanes, read off the thread records, the transcripts and git */

type Thread = {
    sessionId: string;
    role?: string;
    lane?: string;
    ticket?: string;
    area?: string;
    cwd?: string;
};

export function planOf(file: string): Plan | null {
    if (!existsSync(file)) return null;
    const steps = readFileSync(file, 'utf8').match(/^- \[[ xX]\] /gm) ?? [];
    const done = steps.filter((s) => /x/i.test(s)).length;
    return steps.length > 0 && done > 0 ? { done, total: steps.length } : null;
}

// the ticket of the plan's step being built: the first open step after the last ticked one, never one from `## not greenlit`
// down, so an old chunk's step left open does not outrank the chunk in hand; none ticked reads the first open step
export function currentTicketOf(file: string): string | null {
    if (!existsSync(file)) return null;
    const lines = readFileSync(file, 'utf8')
        .split(/^## not greenlit\b/im)[0]
        ?.split('\n')
        .filter((line) => /^- \[[ xX]\] /.test(line));
    const steps = lines ?? [];
    const lastDone = steps.findLastIndex((line) => !line.startsWith('- [ ]'));
    const open = steps
        .slice(lastDone + 1)
        .find((line) => line.startsWith('- [ ]'));
    return open?.match(/\b(?:FRM|BYT)-\d+\b/)?.[0] ?? null;
}

export function commitsSince(dir: string, since: number): Commit[] {
    const out = spawnSync(
        'git',
        [
            '-C',
            dir,
            'log',
            `--since=@${Math.floor(since)}`,
            '--format=C\t%H\t%ct\t%s',
            '--numstat',
            'HEAD',
        ],
        { encoding: 'utf8' },
    );
    const commits: Commit[] = [];
    for (const line of (out.stdout ?? '').split('\n')) {
        if (line.startsWith('C\t')) {
            const [, sha, t, ...subject] = line.split('\t');
            commits.push({
                add: 0,
                rem: 0,
                sha: sha ?? '',
                subject: subject.join('\t'),
                t: Number(t),
            });
        } else if (line.trim()) {
            const [add, rem] = line.split('\t');
            const last = commits.at(-1);
            if (last) {
                last.add += Number(add) || 0;
                last.rem += Number(rem) || 0;
            }
        }
    }
    return commits;
}

function sizeOf(ticket: string) {
    const out = spawnSync('x', ['linear', 'read', ticket], {
        encoding: 'utf8',
        timeout: 15_000,
    });
    try {
        return JSON.parse(out.stdout).data.tickets[0].size as string;
    } catch {
        return null;
    }
}

// a commit is a lane's when its subject, past the emoji, sits in a tool call the lane made: the message file it wrote. a sha the lane
// only read in a log is no proof
export function ownCommits(commits: Commit[], transcript: string) {
    const inputs = [...readTranscript(transcript).uses.values()]
        .map((use) => use.input)
        .join('\n');
    return commits.filter((c) => {
        const key = c.subject.replace(/^\S+ /, '').slice(0, 45);
        return (
            key.length > 12 && inputs.includes(JSON.stringify(key).slice(1, -1))
        );
    });
}

export type Reads = {
    commits: (dir: string, since: number) => Commit[];
    size: (ticket: string) => string | null;
};

export function lanePaceSection(
    home: string,
    since: number,
    reads: Reads = { commits: commitsSince, size: sizeOf },
) {
    const frame = path.join(home, 'frame');
    const records = path.join(home, '.claude/shelf/threads.json');
    if (!existsSync(records))
        return { exit: 0, name: 'lane pace', output: 'no thread records' };
    let threads: Thread[];
    try {
        threads = JSON.parse(readFileSync(records, 'utf8')).threads;
    } catch (error) {
        return {
            exit: 1,
            name: 'lane pace',
            output: `thread records unreadable: ${String(error)}`,
        };
    }
    const lines: string[] = [];
    let red = false;
    for (const thread of threads.filter((t) => t.role === 'codie')) {
        const dir = thread.cwd ?? frame;
        // claude names a project dir after the cwd with every non-alphanumeric character a dash
        const project = dir.replace(/[^a-zA-Z0-9]/g, '-');
        const file = path.join(
            home,
            '.claude/projects',
            project,
            `${thread.sessionId}.jsonl`,
        );
        if (!existsSync(file)) continue;
        const planFile = thread.lane
            ? path.join(
                  home,
                  '.local/state/x/lanes',
                  thread.lane,
                  'lane-plan.md',
              )
            : '';
        const ticket = (planFile && currentTicketOf(planFile)) || thread.ticket;
        const name =
            `${thread.area ?? thread.lane ?? thread.sessionId.slice(0, 8)} | ${ticket ?? ''}`.trim();
        try {
            const transcript = readFileSync(file, 'utf8');
            const pace = lanePace({
                commits: ownCommits(reads.commits(dir, since), transcript),
                name,
                plan: planFile ? planOf(planFile) : null,
                scratchpad: `/private/tmp/claude-${process.getuid?.() ?? 501}/${project}/${thread.sessionId}/scratchpad`,
                since,
                size: ticket ? reads.size(ticket) : null,
                transcript,
            });
            red ||= pace.flag === '🔴';
            lines.push(pace.line);
        } catch (error) {
            // one lane's unreadable file never costs the siesta its other sections
            lines.push(`🔴 ${name} — pace unreadable: ${String(error)}`);
            red = true;
        }
    }
    return {
        exit: red ? 1 : 0,
        name: 'lane pace',
        output:
            lines.length > 0
                ? lines.join('\n')
                : 'no running codie lane has a transcript since the last siesta',
    };
}
