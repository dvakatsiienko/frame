// the live-session registry (~/.claude/sessions/*.json) and the transcript each session writes
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
