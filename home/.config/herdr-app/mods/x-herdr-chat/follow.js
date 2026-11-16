// when the list moves and when it must not: it follows the newest only while he sits at the end, keeps his reading
// place by message, and a dragged selection scrolls it only at its edge. herdr's list hands a mod no scroll offset:
// the truth is the drawn range, whose start is the first visible row (measured by hand, 2026-11-16).

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
