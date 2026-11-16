// when the list moves and when it must not: it follows the newest only while he sits at the end, keeps his reading
// place by message, and a dragged selection scrolls it only at its edge. herdr's list hands a mod no scroll offset:
// the truth is the drawn range, whose start is the first row on screen in both scroll directions (probed 2026-11-16).

/** @typedef {{ start: number, end: number }} Range */

/**
 * following the newest after a wheel step: up stops following, down at the conversation's end (isAtTrueEnd) follows again
 * @param {boolean} follow
 * @param {number} dy the wheel's delta, positive up
 * @param {boolean} isAtEnd he sits at the end
 */
export function followAfterWheel(follow, dy, isAtEnd) {
    if (dy > 0) return false;
    if (dy < 0 && isAtEnd) return true;
    return follow;
}

// how far above the end still counts as sitting at it: about five lines of text
export const END_SLACK = 100;

/**
 * he sits at the conversation's end: the rows drawn are its last screen. the drawn range runs up to two rows past the
 * last visible one, so its end reaching the row count proves nothing; its start does. the end holds only where that
 * read is exact to END_SLACK: the first row of the last screen may hide no more than that above the view (he could be
 * reading that part), and a last row taller than the view never counts. elsewhere the ↓ pill is the way back
 * @param {number[]} sizes every row's height, in order
 * @param {Range | null | undefined} range the rows the list drew last
 * @param {number | null | undefined} viewH the list's height, in the sizes' unit
 */
export function isAtTrueEnd(sizes, range, viewH) {
    if (!range || !viewH || range.end < sizes.length) return false;
    if ((sizes.at(-1) ?? 0) >= viewH) return false;
    let firstOfLastScreen = sizes.length;
    let sum = 0;
    while (firstOfLastScreen > 0 && sum < viewH)
        sum += sizes[--firstOfLastScreen] ?? 0;
    return range.start >= firstOfLastScreen && sum - viewH <= END_SLACK;
}

/**
 * where the message he was reading sits now, -1 when it is not among the rows
 * @param {readonly { id: string }[]} rows
 * @param {string | null | undefined} placeId the id of the first message on screen when he stopped
 */
export function placeIndex(rows, placeId) {
    return placeId ? rows.findIndex((row) => row.id === placeId) : -1;
}

/**
 * where a row's top sits in the list, in the sizes' unit
 * @param {number[]} sizes every row's height, in order
 * @param {number} index
 */
export function topOf(sizes, index) {
    let top = 0;
    for (let i = 0; i < index && i < sizes.length; i++) top += sizes[i] ?? 0;
    return top;
}

/**
 * the list's own scroll position after a wheel step, as the view counts it: herdr hands a mod none, and the step is
 * the list's movement (measured by hand, 2026-11-16). kept inside what the list can scroll
 * @param {number} top how far the list is scrolled
 * @param {number} dy the wheel's delta in the sizes' unit, positive up
 * @param {number[]} sizes
 * @param {number} viewH the list's height
 */
export function topAfterWheel(top, dy, sizes, viewH) {
    const max = Math.max(0, topOf(sizes, sizes.length) - viewH);
    return Math.min(max, Math.max(0, top - dy));
}

/**
 * the counted position, held to what the list drew: its first row on screen is exact in every frame (probed twice,
 * 2026-11-16), so the count may only say how far into that row he is. a scroll the wheel never reported, a drifted
 * count and a height that changed above all end here, one row's height at most from the truth
 * @param {number} top the counted position
 * @param {number} start the first row the list drew
 * @param {number[]} sizes
 * @returns {{ top: number, offset: number }} the position, and the px of the first row above the view
 */
export function pinToRow(top, start, sizes) {
    const rowTop = topOf(sizes, start);
    const offset = Math.min(
        Math.max(0, (sizes[start] ?? 1) - 1),
        Math.max(0, top - rowTop),
    );
    return { offset, top: rowTop + offset };
}

/**
 * the list can only bring an item's top to the view's top, so a place inside a message is restored by cutting that
 * message into two items at the place: the second one's top is the place
 * @param {readonly { id: string }[]} rows
 * @param {number[]} sizes every row's height, in order
 * @param {{ id: string, offset: number }} place the message and the px of it above the view
 * @returns {{ sizes: number[], seekAt: number, cut: { at: number, offset: number } | null }} the sizes to hand the
 *   list, the item to bring to the top, and the row that was cut
 */
export function splitAtPlace(rows, sizes, place) {
    const at = placeIndex(rows, place.id);
    const height = sizes[at] ?? 0;
    const offset = Math.round(place.offset);
    if (at < 0 || offset <= 0 || offset >= height)
        return { cut: null, seekAt: at, sizes };
    return {
        cut: { at, offset },
        seekAt: at + 1,
        sizes: [
            ...sizes.slice(0, at),
            offset,
            height - offset,
            ...sizes.slice(at + 1),
        ],
    };
}

/**
 * a saved place read back: the message and the px of it above the view
 * @param {string | null | undefined} text what the place was saved as
 * @returns {{ id: string, offset: number } | null}
 */
export function placeOf(text) {
    if (!text) return null;
    if (!text.startsWith('{')) return { id: text, offset: 0 };
    try {
        const { id, offset } = JSON.parse(text);
        if (typeof id !== 'string' || !id) return null;
        return { id, offset: typeof offset === 'number' ? offset : 0 };
    } catch {
        return null;
    }
}

/**
 * the rows a dragged selection scrolls the list by: none while the pointer is inside the list, one row up or down
 * once it reaches an edge
 * @param {number} y the pointer, in the list's coordinates
 * @param {{ top: number, bottom: number }} list
 * @returns {-1 | 0 | 1}
 */
export function edgeScrollStep(y, list) {
    if (y <= list.top) return -1;
    if (y >= list.bottom) return 1;
    return 0;
}
