// pnpm mods:set-pace-watch on|off [session id] — x-mod-stash's pace watch and ⏰ waker for a shift, no click: writes the
// session's `pace:<id>` into the mod's store file, crow's door for 🔥; the session's own stash takes it at its next poll
import { globSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PACE = 'pace:';

export function withPace(
    store: Record<string, unknown>,
    sessionId: string,
    isOn: boolean,
    now: number,
) {
    const { [PACE + sessionId]: _was, ...rest } = store;
    return isOn ? { ...rest, [PACE + sessionId]: { since: now } } : rest;
}

const bare = (name: unknown) => String(name).replaceAll(/[\s\u200d]/g, '');

// the live coordinator as the registry names her
export function clioIdOf(
    sessions: { name?: unknown; pid?: unknown; sessionId?: unknown }[],
    isAlive: (pid: number) => boolean,
) {
    const id = sessions.find(
        (s) =>
            bare(s.name) === bare('🦉 clio') &&
            typeof s.pid === 'number' &&
            isAlive(s.pid),
    )?.sessionId;
    return typeof id === 'string' ? id : undefined;
}

function isPidAlive(pid: number) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

// a registry file mid-write reads as no session
function sessionOf(path: string) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return {};
    }
}

function newest(pattern: string, cwd: string) {
    return globSync(pattern, { cwd })
        .map((f) => join(cwd, f))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

function main([verb, id]: string[]) {
    if (verb !== 'on' && verb !== 'off') {
        console.error('usage: pnpm mods:set-pace-watch on|off [session id]');
        return 2;
    }
    const home = homedir();
    const sessionId =
        id ??
        clioIdOf(
            newest('*.json', join(home, '.claude/sessions')).map(sessionOf),
            isPidAlive,
        );
    const path = newest(
        'x-mod-stash_inline-*.json',
        join(home, '.claude/plugins/store'),
    )[0];
    if (!sessionId || !path) {
        console.error(`no ${sessionId ? 'x-mod-stash store' : 'live 🦉 clio'}`);
        return 1;
    }
    const store = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(
        path,
        JSON.stringify(withPace(store, sessionId, verb === 'on', Date.now())),
    );
    console.log(`pace watch ${verb}: ${sessionId}, its next poll takes it`);
    return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
