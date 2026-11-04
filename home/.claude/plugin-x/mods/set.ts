// pnpm mods:set <key> <value> [session id] — writes one x-mod-stash setting into its store, no reload: the next poll reads it.
// `pace on|off` is the pace watch and ⏰ waker for a shift, clio's registry row by default; a number key is a 🎛️ row
import { globSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { PACE_KEYS, PACE_SETTINGS } from './x-mod-stash/hooks/pace.ts';

const PACE = 'pace:';

// a shift keeps the key it found and its end puts that back, so a clio on by default stays on; off with no shift running is a written off
export function withPace(
    store: Record<string, unknown>,
    sessionId: string,
    isOn: boolean,
    now: number,
) {
    const { [PACE + sessionId]: was, ...rest } = store;
    const shift = was as { since?: number; was?: unknown } | undefined;
    if (isOn) {
        const found = shift?.since === undefined ? was : shift.was;
        return {
            ...rest,
            [PACE + sessionId]: {
                since: now,
                ...(found === undefined ? {} : { was: found }),
            },
        };
    }
    if (shift?.since === undefined)
        return { ...rest, [PACE + sessionId]: { off: true } };
    return shift.was === undefined
        ? rest
        : { ...rest, [PACE + sessionId]: shift.was };
}

export function numberSetting(key: string, value: string) {
    const setting = PACE_SETTINGS[key as keyof typeof PACE_SETTINGS];
    const n = Number(value);
    if (!setting || !Number.isFinite(n) || n < setting.min || n > setting.max)
        return undefined;
    return n;
}

const bare = (name: unknown) => String(name).replaceAll(/[\s‍]/g, '');

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

function main([key, value, id]: string[]) {
    const isPace = key === 'pace' && (value === 'on' || value === 'off');
    const n = key && value ? numberSetting(key, value) : undefined;
    if (!isPace && n === undefined) {
        console.error(
            `usage: pnpm mods:set pace on|off [session id] | pnpm mods:set <${PACE_KEYS.join('|')}> <number>`,
        );
        return 2;
    }
    const home = homedir();
    const path = newest(
        'x-mod-stash_inline-*.json',
        join(home, '.claude/plugins/store'),
    )[0];
    const sessionId = !isPace
        ? undefined
        : (id ??
          clioIdOf(
              newest('*.json', join(home, '.claude/sessions')).map(sessionOf),
              isPidAlive,
          ));
    if (!path || (isPace && !sessionId)) {
        console.error(`no ${path ? 'live 🦉 clio' : 'x-mod-stash store'}`);
        return 1;
    }
    const store = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(
        path,
        JSON.stringify(
            isPace
                ? withPace(store, sessionId ?? '', value === 'on', Date.now())
                : { ...store, [key as string]: n },
        ),
    );
    console.log(
        `${key} ${value}${sessionId ? `: ${sessionId}` : ''}, its next poll takes it`,
    );
    return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
