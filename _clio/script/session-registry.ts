// the live-session registry (~/.claude/sessions/*.json) and the transcript each session writes
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CLAUDE = join(homedir(), '.claude');

function isAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

export function liveSessions(): Session[] {
    const dir = join(CLAUDE, 'sessions');
    return readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .map(
            (name) =>
                JSON.parse(readFileSync(join(dir, name), 'utf8')) as Session,
        )
        .filter((session) => isAlive(session.pid));
}

// a clio thread's own folder under a shared state dir: '' for main, `wing-<N>` for a wing, undefined for any other session
export function seatOf(home = homedir(), ccPid = nearestClaude()) {
    if (process.env.CLIO_SEAT !== undefined) return process.env.CLIO_SEAT;
    if (ccPid === undefined) return undefined;
    const mainPid = readOr(join(home, '.local/state/clio/main-session')).match(
        /^pid=(\d+)$/m,
    )?.[1];
    if (mainPid === String(ccPid)) return '';
    const wing = readOr(join(home, '.claude/sessions', `${ccPid}.json`)).match(
        // the desktop titles a wing «🦉🪽 clio: wing 3», a herdr thread starts as `--name wing-3`
        /"name"\s*:\s*"[^"]*\bwing[ -](\d+)\b/,
    )?.[1];
    return wing === undefined ? undefined : `wing-${wing}`;
}

// the cc process is the nearest ancestor running claude; a shell may sit between it and this script
function nearestClaude() {
    let pid = process.ppid;
    for (let hop = 0; hop < 5 && pid > 1; hop++) {
        // the desktop app's bundled claude sits under «Application Support», so the path keeps its spaces
        const [, ppid = '0', command = ''] =
            execFileSync('ps', ['-o', 'ppid=,comm=', '-p', String(pid)], {
                encoding: 'utf8',
            }).match(/^\s*(\d+)\s+(.*?)\s*$/) ?? [];
        if (/(^|\/)claude$/.test(command)) return pid;
        pid = Number(ppid);
    }
    return undefined;
}

function readOr(file: string) {
    try {
        return readFileSync(file, 'utf8');
    } catch {
        return '';
    }
}

export function transcriptOf(sessionId: string): string | undefined {
    const root = join(CLAUDE, 'projects');
    return readdirSync(root)
        .map((project) => join(root, project, `${sessionId}.jsonl`))
        .find((path) => statSync(path, { throwIfNoEntry: false }));
}

/* Types */

export interface Session {
    cwd: string;
    name?: string;
    pid: number;
    sessionId: string;
}
