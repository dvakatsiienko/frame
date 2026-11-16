// pnpm mods:set <key> <value> [session id] — writes one x-mod-stash setting into its store, no reload: the next poll reads it.
// `hot [<session id> [on|off]]` reads or writes any session's 🔥, the door its chip uses (FRM-505)
// `second-wind-auto [<session id> [on|off]]` reads or writes any session's 🍃, the door its band button uses (FRM-634)
// `second-wind-text [<row> [<text>]]` reads or edits one of the five second wind notes, the door any app calls (FRM-634)
// `pace on|end` is the pace watch and ⏰ waker for a shift, `pace off` a written off, clio's registry row by default; a number key is a 🎛️ row; `part <key> on|off` a 🎛️ switch, global, bare `part` lists them
import { execFileSync } from 'node:child_process';
import {
    existsSync,
    globSync,
    readFileSync,
    realpathSync,
    renameSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
    PACE_KEYS,
    PACE_SETTINGS,
    windPairRefusal,
} from './x-mod-stash/hooks/pace.ts';
import {
    WIND_ROWS,
    WIND_STORE_FILE,
    WIND_TEXT_CAP,
    WIND_TEXT_EDITS,
    isWindRow,
    windFileOf,
} from './x-mod-stash/hooks/wind-store.ts';

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

const HOT = 'hot:';

// a row's 🔥 chip writes `{ since }` on and `{ off: true }` off; an off is a written value, so a seat's default never
// fills it back
export function withHot(
    store: Record<string, unknown>,
    sessionId: string,
    verb: 'off' | 'on',
    now: number,
) {
    return {
        ...store,
        [HOT + sessionId]: verb === 'on' ? { since: now } : { off: true },
    };
}

const AUTO_WIND = 'second-wind-auto:';
const WIND = 'wind:';

// the band's 🍃 writes `{ on, at }`; an off takes back the mod's own pending ask, never one dima pressed
export function withAutoWind(
    store: Record<string, unknown>,
    sessionId: string,
    verb: 'off' | 'on',
    now: number,
) {
    const { [WIND + sessionId]: wind, ...rest } = store;
    const ask = wind as { by?: string; state?: string } | undefined;
    const isModAsk =
        ask?.by === 'mod' && (ask.state === 'asked' || ask.state === 'writing');
    return {
        ...(verb === 'off' && isModAsk ? rest : store),
        [AUTO_WIND + sessionId]: { at: now, on: verb === 'on' },
    };
}

// why the door will not take this text for this row, or nothing when it will
export function windTextRefusal(row: string, text: string) {
    if (!isWindRow(row))
        return `no such row: ${row}; the rows: ${WIND_ROWS.join(' ')}`;
    return text.length > WIND_TEXT_CAP
        ? `the text is ${text.length} chars, over the cap of ${WIND_TEXT_CAP}`
        : undefined;
}

// an edit waits under one key, row → text, until a session's poll writes it into the second-wind store
export function withWindText(
    store: Record<string, unknown>,
    row: string,
    text: string,
) {
    const edits = store[WIND_TEXT_EDITS] as Record<string, unknown> | undefined;
    return { ...store, [WIND_TEXT_EDITS]: { ...edits, [row]: text } };
}

// unpressed, every thread's 🍃 is on
const isAutoWindOn = (v: unknown) =>
    (v as { on?: boolean } | undefined)?.on ?? true;

const isHotOn = (v: unknown) =>
    typeof v === 'object' && v !== null && !('off' in v);

export function numberSetting(key: string, value: string) {
    if (!Object.hasOwn(PACE_SETTINGS, key)) return undefined;
    const setting = PACE_SETTINGS[key as keyof typeof PACE_SETTINGS];
    const n = Number(value);
    if (!Number.isFinite(n) || n < setting.min || n > setting.max)
        return undefined;
    return n;
}

// the live coordinator by her thread record, as x thread list answers it (FRM-579), never by the name she wears
export function clioIdOf(
    threads: { pid?: unknown; role?: unknown; sessionId?: unknown }[],
) {
    const id = threads.find(
        (t) => t.role === 'coordinator' && typeof t.pid === 'number',
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

// x's live threads, run from home so the shim runs main's x; no answer reads as none
function liveThreads(home: string) {
    try {
        const out = execFileSync('x', ['thread', 'list', '--json'], {
            cwd: home,
            encoding: 'utf8',
            timeout: 4000,
        });
        return (JSON.parse(out).data?.threads ?? []) as {
            pid?: unknown;
            role?: unknown;
            sessionId?: unknown;
        }[];
    } catch {
        return [];
    }
}

const LOCK_WAIT_MS = 5000;
const LOCK_STALE_MS = 10_000;
const LOCK_RETRY_MS = 10;

// two waiters may both see one stale lock: only one rename wins, so the loser never removes the winner's fresh lock
function dropStaleLock(lock: string) {
    const mine = `${lock}.${process.pid}.stale`;
    try {
        renameSync(lock, mine);
        rmSync(mine, { force: true });
    } catch {}
}

// a writer that died holding the lock leaves its file: past LOCK_STALE_MS it is taken over
function takeLock(lock: string) {
    const deadline = Date.now() + LOCK_WAIT_MS;
    for (;;) {
        try {
            writeFileSync(lock, String(process.pid), { flag: 'wx' });
            return;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }
        const heldSince = statSync(lock, { throwIfNoEntry: false })?.mtimeMs;
        if (heldSince !== undefined && Date.now() - heldSince > LOCK_STALE_MS)
            dropStaleLock(lock);
        // a stale lock that will not go still meets the deadline and the sleep, so the wait never spins
        if (Date.now() > deadline)
            throw new Error(`the store is locked: ${lock}`);
        Atomics.wait(
            new Int32Array(new SharedArrayBuffer(4)),
            0,
            0,
            LOCK_RETRY_MS,
        );
    }
}

// every store write of this door: the lock spans the read, the change and the write, so two writers never lose one
// change; the temp file and the rename keep a reader off a half file; a symlinked path is resolved first, so the link
// stays a link. the engine's own `$.store.set` writes the same file with neither, which no door can change
export function changeStore(
    path: string,
    change: (store: Record<string, unknown>) => Record<string, unknown>,
) {
    const real = realpathSync(path);
    const lock = `${real}.lock`;
    takeLock(lock);
    try {
        const temp = `${real}.${process.pid}.tmp`;
        // the store's own mode, so a rename never widens who may read it
        writeFileSync(
            temp,
            JSON.stringify(change(JSON.parse(readFileSync(real, 'utf8')))),
            { mode: statSync(real).mode & 0o777 },
        );
        renameSync(temp, real);
    } finally {
        rmSync(lock, { force: true });
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
        changeStore(path, (now) => withPart(now, value, id === 'on'));
        console.log(`${value} ${id}, every session's next poll takes it`);
        return 0;
    }
    if (key === 'hot') {
        if (!path) {
            console.error('no x-mod-stash store');
            return 1;
        }
        const store = JSON.parse(readFileSync(path, 'utf8'));
        if (value === undefined) {
            for (const k of Object.keys(store).filter((k) => k.startsWith(HOT)))
                console.log(
                    `${k.slice(HOT.length)} ${isHotOn(store[k]) ? 'on' : 'off'}`,
                );
            return 0;
        }
        if (id === undefined) {
            console.log(
                `${value} ${isHotOn(store[HOT + value]) ? 'on' : 'off'}`,
            );
            return 0;
        }
        if (id !== 'on' && id !== 'off') {
            console.error('usage: pnpm mods:set hot [<session id> [on|off]]');
            return 2;
        }
        changeStore(path, (now) => withHot(now, value, id, Date.now()));
        console.log(`🔥 ${value} ${id}, its next poll takes it`);
        return 0;
    }
    if (key === 'second-wind-auto') {
        if (!path) {
            console.error('no x-mod-stash store');
            return 1;
        }
        const store = JSON.parse(readFileSync(path, 'utf8'));
        if (value === undefined) {
            for (const k of Object.keys(store).filter((k) =>
                k.startsWith(AUTO_WIND),
            ))
                console.log(
                    `${k.slice(AUTO_WIND.length)} ${isAutoWindOn(store[k]) ? 'on' : 'off'}`,
                );
            return 0;
        }
        if (id === undefined) {
            console.log(
                `${value} ${isAutoWindOn(store[AUTO_WIND + value]) ? 'on' : 'off'}`,
            );
            return 0;
        }
        if (id !== 'on' && id !== 'off') {
            console.error(
                'usage: pnpm mods:set second-wind-auto [<session id> [on|off]]',
            );
            return 2;
        }
        changeStore(path, (now) => withAutoWind(now, value, id, Date.now()));
        console.log(`🍃 ${value} ${id}, its next turn reads it`);
        return 0;
    }
    if (key === 'second-wind-text') {
        const shelfFile = join(home, '.claude/shelf', WIND_STORE_FILE);
        const { rows } = windFileOf(
            existsSync(shelfFile) ? readFileSync(shelfFile, 'utf8') : undefined,
        );
        const rowOf = (row: string) =>
            (rows?.[row] ?? {}) as { default?: unknown; text?: unknown };
        if (value === undefined) {
            for (const row of WIND_ROWS) {
                const text = String(rowOf(row).text ?? '');
                const head = text.split('\n')[0]?.slice(0, 80);
                console.log(`${row} ${head ? `«${head}»` : 'default'}`);
            }
            return 0;
        }
        const refusal = windTextRefusal(value, id ?? '');
        if (refusal) {
            console.error(`refused: ${refusal}`);
            return 2;
        }
        if (id === undefined) {
            const { default: note, text } = rowOf(value);
            console.log(`text: ${text || '(the default)'}\ndefault: ${note}`);
            return 0;
        }
        if (!path) {
            console.error('no x-mod-stash store');
            return 1;
        }
        changeStore(path, (now) => withWindText(now, value, id));
        console.log(
            `${value} ${id ? 'edited' : 'back to its default'}, the next poll writes it into ~/.claude/shelf/${WIND_STORE_FILE}`,
        );
        return 0;
    }
    const isPace =
        key === 'pace' &&
        (value === 'on' || value === 'off' || value === 'end');
    const n = key && value ? numberSetting(key, value) : undefined;
    if (!isPace && n === undefined) {
        console.error(
            `usage: pnpm mods:set pace on|off|end [session id] | pnpm mods:set part [<key> on|off] | pnpm mods:set hot [<session id> [on|off]] | pnpm mods:set second-wind-auto [<session id> [on|off]] | pnpm mods:set second-wind-text [<row> [<text>]] | pnpm mods:set <${PACE_KEYS.join('|')}> <number>`,
        );
        return 2;
    }
    const sessionId = !isPace ? undefined : (id ?? clioIdOf(liveThreads(home)));
    if (!path || (isPace && !sessionId)) {
        console.error(`no ${path ? 'live 🦉 clio' : 'x-mod-stash store'}`);
        return 1;
    }
    const store = JSON.parse(readFileSync(path, 'utf8'));
    const pair =
        n === undefined ? undefined : windPairRefusal(store, key ?? '', n);
    if (pair) {
        console.error(`refused: ${pair}`);
        return 2;
    }
    changeStore(path, (now) =>
        isPace
            ? withPace(
                  now,
                  sessionId ?? '',
                  value as 'end' | 'off' | 'on',
                  Date.now(),
              )
            : { ...now, [key as string]: n },
    );
    console.log(
        `${key} ${value}${sessionId ? `: ${sessionId}` : ''}, its next poll takes it`,
    );
    return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
