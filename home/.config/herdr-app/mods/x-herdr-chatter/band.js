// the seat's band in the text box, as pure steps: the facts the deck's mod publishes to herdr's shared state, one seat's
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
/** @typedef {{ key: string, emoji: string, word: string, isOn: boolean, isLive: boolean, tip: string }} BandButton */

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

const STASH_DOOR =
    'waits on its door: the press file the stash reads (FRM-568, not signed yet)';

/**
 * the row right of «wait», in his order (his crop, 20:59; board last, 21:02): only a button whose press herdr can prove
 * is live; each draws as its emoji alone, its word leading the tooltip
 * @param {{ isDeckShown: boolean, override: Override }} state
 * @returns {BandButton[]}
 */
export function bandButtons({ isDeckShown, override }) {
    return [
        {
            emoji: '🐦‍🔥',
            key: 'wind',
            tip: `second wind: ${STASH_DOOR}`,
            word: 'wind',
        },
        {
            emoji: '🔥',
            key: 'hot',
            tip: `keep hot: ${STASH_DOOR}`,
            word: 'hot',
        },
        {
            emoji: '⏰',
            key: 'waker',
            tip: `the waker: ${STASH_DOOR}`,
            word: 'waker',
        },
        {
            emoji: '💨',
            key: 'afk',
            tip: `AFK, every seat: ${STASH_DOOR}`,
            word: 'AFK',
        },
        {
            emoji: '🔓',
            isOn: override.isOn,
            key: 'override',
            tip: `${override.isOn ? `operator override on since ${override.since}` : 'operator override off'}; its press waits on the guard reading a herdr press (the mods codie's proof row)`,
            word: 'override',
        },
        {
            emoji: '🎛️',
            key: 'settings',
            tip: 'settings: waits on the settings view',
            word: 'settings',
        },
        {
            emoji: '🚦',
            isLive: true,
            isOn: isDeckShown,
            key: 'board',
            tip: isDeckShown ? 'hide the deck' : 'show the deck',
            word: 'board',
        },
    ].map((b) => ({ isLive: false, isOn: false, ...b }));
}
