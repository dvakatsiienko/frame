// pnpm mods:set <key> <value> [session id] — writes one x-mod-stash setting into its store, no reload: the next poll reads it.
// `pace on|end` is the pace watch and ⏰ waker for a shift, `pace off` a written off, clio's registry row by default; a number key is a 🎛️ row; `part <key> on|off` a 🎛️ switch, global, bare `part` lists them
import { globSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { PACE_KEYS, PACE_SETTINGS } from './x-mod-stash/hooks/pace.ts';

const PACE = 'pace:';

// on: a shift keeps the key it found; end: it puts that back, so a clio on by default stays on, and past an expiry it finds nothing to do; off: a written off
export function withPace(
    store: Record<string, unknown>,
    sessionId: string,
    verb: 'end' | 'off' | 'on',
    now: number,
) {
    const { [PACE + sessionId]: was, ...rest } = store;
    const shift = was as { since?: number; was?: unknown } | undefined;
    const isShift = shift?.since !== undefined;
    if (verb === 'off') return { ...rest, [PACE + sessionId]: { off: true } };
    if (verb === 'end') {
        if (!isShift) return store;
        return shift.was === undefined
            ? rest
            : { ...rest, [PACE + sessionId]: shift.was };
    }
    const found = isShift ? shift.was : was;
    return {
        ...rest,
        [PACE + sessionId]: {
            since: now,
            ...(found === undefined ? {} : { was: found }),
        },
    };
}

export function numberSetting(key: string, value: string) {
    if (!Object.hasOwn(PACE_SETTINGS, key)) return undefined;
    const setting = PACE_SETTINGS[key as keyof typeof PACE_SETTINGS];
    const n = Number(value);
    if (!Number.isFinite(n) || n < setting.min || n > setting.max)
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

// the 🎛️ switches, read from the mod's own list so a new part needs no second list here
export const partKeysOf = (source: string) =>
    [...source.matchAll(/key: '(stash\.[\w-]+)'/g)].flatMap((m) => m[1] ?? []);

export function withPart(
    store: Record<string, unknown>,
    key: string,
    isOn: boolean,
) {
    const shown = store.shown as Record<string, boolean> | undefined;
    return { ...store, shown: { ...shown, [key]: isOn } };
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
    const home = homedir();
    const path = newest(
        'x-mod-stash_inline-*.json',
        join(home, '.claude/plugins/store'),
    )[0];
    if (key === 'part') {
        const parts = partKeysOf(
            readFileSync(
                new URL('./x-mod-stash/hooks/register.tsx', import.meta.url),
                'utf8',
            ),
        );
        if (!path) {
            console.error('no x-mod-stash store');
            return 1;
        }
        const store = JSON.parse(readFileSync(path, 'utf8'));
        if (value === undefined) {
            for (const part of parts)
                console.log(
                    `${part} ${store.shown?.[part] === false ? 'off' : 'on'}`,
                );
            return 0;
        }
        if (!parts.includes(value) || (id !== 'on' && id !== 'off')) {
            console.error(
                `usage: pnpm mods:set part [<key> on|off], keys: ${parts.join(' ')}`,
            );
            return 2;
        }
        writeFileSync(
            path,
            JSON.stringify(withPart(store, value, id === 'on')),
        );
        console.log(`${value} ${id}, every session's next poll takes it`);
        return 0;
    }
    const isPace =
        key === 'pace' &&
        (value === 'on' || value === 'off' || value === 'end');
    const n = key && value ? numberSetting(key, value) : undefined;
    if (!isPace && n === undefined) {
        console.error(
            `usage: pnpm mods:set pace on|off|end [session id] | pnpm mods:set part [<key> on|off] | pnpm mods:set <${PACE_KEYS.join('|')}> <number>`,
        );
        return 2;
    }
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
                ? withPace(
                      store,
                      sessionId ?? '',
                      value as 'end' | 'off' | 'on',
                      Date.now(),
                  )
                : { ...store, [key as string]: n },
        ),
    );
    console.log(
        `${key} ${value}${sessionId ? `: ${sessionId}` : ''}, its next poll takes it`,
    );
    return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
