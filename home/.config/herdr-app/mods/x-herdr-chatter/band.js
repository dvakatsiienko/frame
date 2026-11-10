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
