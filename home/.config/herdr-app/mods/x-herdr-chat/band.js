// the thread's band in the quill, as pure steps: the facts the deck's mod publishes to herdr's shared state, one thread's
// share of them, and whether they are too old to show as live

import { PENDING_MS } from './band-press.js';

export const THREADS_KEY = 'x-herdr-deck.threads';
// the deck publishes every 60 s at least: two beats missed, plus slack for a slow read, is a deck that stopped
export const STALE_MS = 2 * 60 * 1000 + 15 * 1000;

/** @typedef {{ context: number | null, wait: string | null, week: number | null, isStale: boolean }} Band */

/**
 * @param {unknown} value what `shared(THREADS_KEY)` holds
 * @param {number | null | undefined} pid the chat's thread
 * @param {number} now
 * @returns {Band}
 */
export function bandOf(value, pid, now) {
    const deck =
        /** @type {{ at?: unknown, threads?: Record<string, any> } | null} */ (
            value
        );
    const thread = pid == null ? null : deck?.threads?.[String(pid)];
    if (!thread || typeof deck?.at !== 'number')
        return { context: null, isStale: false, wait: null, week: null };
    const num = (/** @type {unknown} */ n) =>
        typeof n === 'number' ? n : null;
    return {
        context: num(thread.context),
        isStale: now - deck.at > STALE_MS,
        wait:
            typeof thread.wait === 'string' && thread.wait ? thread.wait : null,
        week: num(thread.week),
    };
}

/**
 * the bar's status for the chat's thread: working or idle from its state file as the deck publishes it, so a thread
 * that only waits shows no spinner; herdr's status for a block, and while no file names the thread
 * @param {unknown} value what `shared(THREADS_KEY)` holds @param {number | null | undefined} pid
 * @param {string} herdrStatus the thread's status in herdr's `agents()` @returns {string}
 */
export function bandStatus(value, pid, herdrStatus) {
    if (herdrStatus === 'blocked') return herdrStatus;
    const threads = /** @type {{ threads?: Record<string, any> } | null} */ (
        value
    )?.threads;
    const state = pid == null ? undefined : threads?.[String(pid)]?.state;
    if (state === 'working') return 'working';
    return state === 'waiting' || state === 'idle' ? 'idle' : herdrStatus;
}

// the state card's line over the quill (PK-384): what the turn does, or, idle, the wait row it replaced
/** @param {{ isWorking: boolean, isBlocked?: boolean, isStuck?: boolean, msg?: string | null, wait?: string | null }} at @returns {string} */
export function stateLine({ isWorking, isBlocked, isStuck, msg, wait }) {
    if (isBlocked) return 'Waiting on you';
    if (isStuck)
        return "Still working: Esc only stops Claude's own turn, not a background task (like /code-review). Stop that in the terminal.";
    if (isWorking) return msg || 'Working…';
    return wait || 'Idle';
}

// what the status in the text box's bottom bar draws beside its line (FRM-610): a spinner or an idle ring, the turn
// clock, and Stop, which a stuck turn hides since Esc cannot stop a background task
/** @param {{ status: string, isStuck: boolean, hasTurnAt: boolean }} at */
export function stateParts({ status, isStuck, hasTurnAt }) {
    const isWorking = status === 'working';
    return {
        hasClock: isWorking && hasTurnAt,
        hasStop: isWorking && !isStuck,
        mark: isWorking ? 'spinner' : 'ring',
    };
}

/** a running turn's length in whole minutes: «<1 min», «4 min», «1 h 05 min» @param {number} ms */
export const turnClock = (ms) => {
    const m = Math.max(0, Math.floor(ms / 60000));
    if (m < 1) return '<1 min';
    return m < 60
        ? `${m} min`
        : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
};

// a meter's lit cells: any use lights one, so 1 % never reads as empty
/** @param {number | null} pct @param {number} cells @returns {number} */
export const meterCells = (pct, cells) =>
    pct == null || pct <= 0
        ? 0
        : Math.min(cells, Math.max(1, Math.round((pct / 100) * cells)));

// the row shows the number; the tooltip names what the bar measures (his 17:18 shot: «remove % in tool tip»)
/** @type {Record<string, string>} */
const METER_WHAT = { ctx: 'context', week: 'weekly' };
/** @param {string} name @param {number | null} pct */
export const meterTip = (name, pct) =>
    pct == null
        ? `${METER_WHAT[name] ?? name}: not read yet`
        : (METER_WHAT[name] ?? name);

// the deck's block in his layout: 🚦 shows and hides it with herdr's own click command, never a layout file write
export const DECK_BLOCK = 'b582b696a6329c1b15cd453c0c01c3204';
// the operator override's store, the one x-mod-guard, the stash and `x` read
export const OVERRIDE_STORE = '.local/state/x/operator-override.json';

/** @typedef {{ isOn: boolean, since?: string }} Override */
/** @typedef {{ key: string, emoji: string, word: string, isOn: boolean, isLive: boolean, isPending: boolean, tip: string }} BandButton */

/**
 * the prs grant as `x` reads it: on when someone stands behind it and its until, if any, is still ahead
 * @param {unknown} store the parsed override store
 * @param {number} now
 * @returns {Override}
 */
export function overrideOf(store, now) {
    const prs = /** @type {any} */ (store)?.prs;
    if (!prs || typeof prs.by !== 'string' || !prs.by) return { isOn: false };
    if (prs.until && !(Date.parse(prs.until) > now)) return { isOn: false };
    return { isOn: true, since: prs.at };
}

// x-mod-stash writes each thread's drawn state to `<STATE_DIR>/<sid>.json` and the fleet-wide afk and waker to
// `fleet.json` beside them; the band writes its presses to PRESS_FILE, which only it may write (the guard's
// `press-write` rule) and the stash reads at its 4 s poll (FRM-568)
export const STATE_DIR = '.claude/shelf/herdr-state';

/** @typedef {import('./band-press.js').PressKey} PressKey */
/** @typedef {{ hot: { since: number } | null, wind: string | null }} ThreadState */
/** @typedef {Partial<Record<PressKey, { at: number, on: boolean }>>} Pending */
/** @typedef {{ afk: { at: number | null, on: boolean }, waker: { at: number | null, on: boolean } }} FleetState */

/** @param {number | null | undefined} ms */
const clock = (ms) =>
    typeof ms === 'number' ? new Date(ms).toTimeString().slice(0, 5) : null;

// the cc band's emoji per wind state (x-mod-stash `WIND_EMOJI`, register.tsx), so both bands draw one lifecycle; no
// wind draws the bird
/** @type {Record<string, string>} */
const WIND_EMOJI = {
    asked: '🥚',
    cancelled: '↩️',
    refreshing: '🌀',
    refused: '🛑',
    writing: '✍️',
};
/** @type {Record<string, string>} */
const WIND_SAY = {
    asked: 'asked',
    cancelled: 'cancelled',
    refreshing: 'compacting',
    refused: 'refused',
    writing: 'writing its handoff',
};

/**
 * the band's states once the shown thread is another one: the fleet's facts stay, the old thread's go, so no button
 * shows or presses a thread that is no longer on screen
 * @template {{ thread: unknown, presses: unknown }} S
 * @param {S} states
 * @param {boolean} isShown the states were read for the thread shown now
 * @returns {S}
 */
export const statesShown = (states, isShown) =>
    isShown ? states : { ...states, presses: {}, thread: null };

// x-mod-stash's door for a session's 🍃 key, run in frame: `pnpm --silent mods:set second-wind-auto <sid> [on|off]`
export const AUTO_WIND_DOOR = ['--silent', 'mods:set', 'second-wind-auto'];

/**
 * the door's answer for one session, `<sid> on|off`; anything else reads unknown
 * @param {string} stdout
 * @param {string} sid
 * @returns {boolean | null}
 */
export function autoWindOf(stdout, sid) {
    for (const line of stdout.split('\n')) {
        if (line === `${sid} on`) return true;
        if (line === `${sid} off`) return false;
    }
    return null;
}

/**
 * a session's 🍃: with `on` it writes through the door first, and what comes back is always the door's own read.
 * a failed write rejects; after a write, a failed read-back is unknown (null), since the key did change
 * @param {(args: string[]) => Promise<string>} door runs the door with these arguments, resolves with its stdout
 * @param {string} sid
 * @param {boolean} [on]
 * @returns {Promise<boolean | null>}
 */
export async function autoWind(door, sid, on) {
    if (on === undefined) return autoWindOf(await door([sid]), sid);
    await door([sid, on ? 'on' : 'off']);
    try {
        return autoWindOf(await door([sid]), sid);
    } catch {
        // the key did change: unknown, and the band's next read asks again
        return null;
    }
}

/** @typedef {{ at: number, flips: number, on: boolean | null, sid: string }} AutoWind */

/**
 * every thread's 🍃 by session id, after a read of one: a flip of that thread made since the read started wins,
 * since the read asked before it; no other thread's entry moves
 * @param {Map<string, AutoWind>} all
 * @param {string} sid
 * @param {boolean | null} on
 * @param {number} flipsAtStart
 * @param {number} at
 * @returns {Map<string, AutoWind>}
 */
export function autoWindAfterRead(all, sid, on, flipsAtStart, at) {
    const flips = all.get(sid)?.flips ?? 0;
    if (flips !== flipsAtStart) return all;
    return new Map(all).set(sid, { at, flips, on, sid });
}

/**
 * every thread's 🍃 after a flip of one landed: only that thread's entry changes, whichever thread is shown by now
 * @param {Map<string, AutoWind>} all
 * @param {string} sid
 * @param {boolean | null} on what the door read back
 * @param {number} at
 * @returns {Map<string, AutoWind>}
 */
export const autoWindFlipped = (all, sid, on, at) =>
    new Map(all).set(sid, {
        at,
        flips: (all.get(sid)?.flips ?? 0) + 1,
        on,
        sid,
    });

/**
 * the row right of «wait», in his order (his crop, 20:59; board last, 21:02): only a button whose press herdr can prove
 * is live; each draws as its emoji alone, its tooltip its name and no press explanation (dima, 23:08). wind, hot, waker
 * and AFK read on from what the stash wrote; a press it has not answered yet shows the state it asked for
 * 🍃 reads its key through the stash's own door (`autoWind`), so it stays greyed until that door answered
 * @param {{ isDeckShown: boolean, override: Override, thread?: ThreadState | null, fleet?: FleetState | null, pending?: Pending, autoWind?: boolean | null, hasAutoWind?: boolean }} state
 * @returns {BandButton[]}
 */
export function bandButtons({
    isDeckShown,
    override,
    thread = null,
    fleet = null,
    pending = {},
    autoWind = null,
    hasAutoWind = true,
}) {
    const asked = pending.wind;
    const wind = asked ? (asked.on ? 'asked' : null) : (thread?.wind ?? null);
    const hotSince = clock(thread?.hot?.since);
    /** @type {Record<PressKey, { isLive: boolean, isOn: boolean, tip: string }>} */
    const four = {
        afk: {
            isLive: Boolean(fleet),
            isOn: fleet?.afk?.on === true,
            tip: 'afk',
        },
        hot: {
            isLive: Boolean(thread),
            isOn: Boolean(thread?.hot),
            tip:
                thread?.hot && hotSince
                    ? `keep hot: on since ${hotSince}`
                    : 'keep hot',
        },
        // his operator override for prs: the store x-mod-guard writes, flipped by his press through the stash (o95)
        override: {
            isLive: true,
            isOn: override.isOn,
            tip: 'operator override',
        },
        waker: {
            isLive: Boolean(fleet),
            isOn: fleet?.waker?.on === true,
            tip: 'waker',
        },
        wind: {
            isLive: Boolean(thread),
            isOn: wind === 'asked' || wind === 'writing',
            tip:
                wind && WIND_SAY[wind]
                    ? `second wind: ${WIND_SAY[wind]}`
                    : 'second wind',
        },
    };
    /** @param {PressKey} key @param {string} emoji @param {string} word */
    const pressable = (key, emoji, word) => {
        const b = four[key];
        const press = pending[key];
        return {
            emoji,
            isLive: b.isLive,
            isOn: press ? press.on : b.isOn,
            isPending: Boolean(press),
            key,
            tip: press && key === 'hot' ? 'keep hot' : b.tip,
            word,
        };
    };
    return (
        [
            pressable('wind', (wind && WIND_EMOJI[wind]) ?? '🐦‍🔥', 'wind'),
            {
                emoji: '🍃',
                isLive: Boolean(thread) && autoWind !== null,
                isOn: autoWind === true,
                key: 'auto',
                tip: 'second wind auto',
                word: 'second wind auto',
            },
            pressable('hot', '🔥', 'hot'),
            pressable('waker', '⏰', 'waker'),
            pressable('afk', '💨', 'AFK'),
            pressable('override', '🔓', 'override'),
            {
                emoji: '🎛️',
                isLive: true,
                key: 'settings',
                tip: 'settings',
                word: 'settings',
            },
            {
                emoji: '🚦',
                isLive: true,
                isOn: isDeckShown,
                key: 'board',
                tip: 'deck',
                word: 'deck',
            },
        ]
            // with auto second wind off for the fleet no thread's 🍃 does anything, so it leaves the band, as on the cc band
            .filter((b) => hasAutoWind || b.key !== 'auto')
            .map((b) => ({
                isOn: false,
                isPending: false,
                ...b,
            }))
    );
}

/**
 * the presses still waiting on the stash: the band's own and the press file's, the newest per button, less each one
 * the state already reads and each past its wait, so the deck's press and the band's draw the same
 * @param {Pending} own @param {Pending} fromFile
 * @param {BandButton[]} read the buttons as the state alone reads them
 * @param {number} now
 * @returns {Pending}
 */
export function pressesWaiting(own, fromFile, read, now) {
    /** @type {Pending} */
    const merged = { ...fromFile };
    for (const [key, p] of Object.entries(own)) {
        const k = /** @type {PressKey} */ (key);
        if (!merged[k] || p.at > merged[k].at) merged[k] = p;
    }
    /** @type {Pending} */
    const left = {};
    for (const [key, p] of Object.entries(merged)) {
        const b = read.find((x) => x.key === key);
        if (b && b.isOn !== p.on && now - p.at < PENDING_MS)
            left[/** @type {PressKey} */ (key)] = p;
    }
    return left;
}

/**
 * the presses not yet answered, read from the press file itself, so a press on the deck or on any band draws here
 * too: per button the newest line, wind and hot only for this thread
 * @param {string | null} text
 * @param {string | null | undefined} sid
 * @param {number} now
 * @returns {Pending}
 */
export function pendingOf(text, sid, now) {
    /** @type {Pending} */
    const pending = {};
    for (const line of (text ?? '').split('\n')) {
        let p;
        try {
            p = JSON.parse(line);
        } catch {
            continue;
        }
        const key = /** @type {PressKey} */ (p?.button);
        if (!['wind', 'hot', 'waker', 'afk', 'override'].includes(key))
            continue;
        if ((key === 'wind' || key === 'hot') && p.sid !== sid) continue;
        if (typeof p.at !== 'number' || now - p.at >= PENDING_MS) continue;
        if (!pending[key] || p.at > pending[key].at)
            pending[key] = { at: p.at, on: p.on === true };
    }
    return pending;
}
