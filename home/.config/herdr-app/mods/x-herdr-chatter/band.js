// the thread's band in the text box, as pure steps: the facts the deck's mod publishes to herdr's shared state, one seat's
// share of them, and whether they are too old to show as live

export const SEATS_KEY = 'x-herdr-deck.seats';
// the deck publishes every 60 s at least: two beats missed, plus slack for a slow read, is a deck that stopped
export const STALE_MS = 2 * 60 * 1000 + 15 * 1000;

/** @typedef {{ context: number | null, wait: string | null, week: number | null, isStale: boolean }} Band */

/**
 * @param {unknown} value what `shared(SEATS_KEY)` holds
 * @param {number | null | undefined} pid the chat's seat
 * @param {number} now
 * @returns {Band}
 */
export function bandOf(value, pid, now) {
    const deck =
        /** @type {{ at?: unknown, seats?: Record<string, any> } | null} */ (
            value
        );
    const seat = pid == null ? null : deck?.seats?.[String(pid)];
    if (!seat || typeof deck?.at !== 'number')
        return { context: null, isStale: false, wait: null, week: null };
    const num = (/** @type {unknown} */ n) =>
        typeof n === 'number' ? n : null;
    return {
        context: num(seat.context),
        isStale: now - deck.at > STALE_MS,
        wait: typeof seat.wait === 'string' && seat.wait ? seat.wait : null,
        week: num(seat.week),
    };
}

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
export const PRESS_DIR = '.claude/shelf/band-presses';
export const PRESS_FILE = `${PRESS_DIR}/band.jsonl`;
const DAY_MS = 24 * 60 * 60 * 1000;
// a press the stash has not answered by then gives the button its state back
export const PENDING_MS = 12 * 1000;

/** @typedef {'wind' | 'hot' | 'waker' | 'afk'} PressKey */
/** @typedef {{ at: number, button: PressKey, on: boolean, sid?: string }} PressLine */
/** @typedef {{ hot: { since: number } | null, wind: string | null }} ThreadState */
/** @typedef {Partial<Record<PressKey, { at: number, on: boolean }>>} Pending */
/** @typedef {{ afk: { at: number | null, on: boolean }, waker: { at: number | null, on: boolean } }} FleetState */

/**
 * one press: wind and hot name the thread they act on, waker and AFK are fleet-wide; `on` is the state it sets, never
 * a flip
 * @param {PressKey} button
 * @param {boolean} on
 * @param {string | null} sid
 * @param {number} now
 * @returns {PressLine}
 */
export function pressLine(button, on, sid, now) {
    return button === 'wind' || button === 'hot'
        ? { at: now, button, on, sid: /** @type {string} */ (sid) }
        : { at: now, button, on };
}

/**
 * the press file after one more press: lines older than a day go (herdr alone trims it), a broken line too
 * @param {string | null} text
 * @param {PressLine} line
 * @param {number} now
 */
export function withPress(text, line, now) {
    const kept = (text ?? '').split('\n').filter((l) => {
        try {
            return JSON.parse(l).at > now - DAY_MS;
        } catch {
            return false;
        }
    });
    return [...kept, JSON.stringify(line)].map((l) => `${l}\n`).join('');
}

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
 * the row right of «wait», in his order (his crop, 20:59; board last, 21:02): only a button whose press herdr can prove
 * is live; each draws as its emoji alone, its tooltip its name and no press explanation (dima, 23:08). wind, hot, waker
 * and AFK read on from what the stash wrote; a press it has not answered yet shows the state it asked for
 * @param {{ isDeckShown: boolean, override: Override, thread?: ThreadState | null, fleet?: FleetState | null, pending?: Pending }} state
 * @returns {BandButton[]}
 */
export function bandButtons({
    isDeckShown,
    override,
    thread = null,
    fleet = null,
    pending = {},
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
        waker: {
            isLive: Boolean(fleet),
            isOn: fleet?.waker?.on === true,
            tip: 'waker',
        },
        wind: {
            isLive: Boolean(thread),
            isOn: wind === 'asked' || wind === 'writing',
            tip: WIND_SAY[wind]
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
    return [
        pressable('wind', WIND_EMOJI[wind] ?? '🐦‍🔥', 'wind'),
        pressable('hot', '🔥', 'hot'),
        pressable('waker', '⏰', 'waker'),
        pressable('afk', '💨', 'AFK'),
        {
            emoji: '🔓',
            isOn: override.isOn,
            key: 'override',
            tip: 'operator override',
            word: 'override',
        },
        {
            emoji: '🎛️',
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
    ].map((b) => ({ isLive: false, isOn: false, isPending: false, ...b }));
}
