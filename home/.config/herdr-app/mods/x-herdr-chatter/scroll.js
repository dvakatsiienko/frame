// the chat's scroll as one rule (dima, 20:38, FRM-562:W18): «following» is a state he enters by scrolling to the end
// or clicking ↓ Newest, and leaves by scrolling up; no redraw, reply, tool line, peer or plugin line, turn end, store
// change, mod reload or resize sets it

/** @typedef {{ follow: boolean, up: number }} Scroll */

// within this many px of the newest message his own scroll counts as reaching the end
export const STUCK_PX = 40;

/**
 * his wheel: any tick up leaves following at once, a scroll down to within STUCK_PX of the end enters it; the slack is
 * only for coming down, or a trackpad's few-px ticks up snapped back to the end
 * @param {Scroll} scroll
 * @param {number} dy
 * @param {number} max the furthest up the log can show
 * @returns {Scroll}
 */
export function afterWheel(scroll, dy, max) {
    const up = Math.max(0, Math.min(scroll.up + dy, max));
    if (dy > 0 && up > 0) return { follow: false, up };
    return up <= STUCK_PX ? { follow: true, up: 0 } : { follow: false, up };
}

/**
 * the log's content changed height: while he follows it shows the newest, while he reads the new height goes below
 * his place, so it moves up by as much; a first measure (a tab switch) or a refill (a reload) adds nothing
 * @param {Scroll} scroll
 * @param {{ from: number | null, to: number, isFilling?: boolean }} change
 * @returns {Scroll}
 */
export function afterReflow(scroll, { from, to, isFilling = false }) {
    if (scroll.follow) return { follow: true, up: 0 };
    if (from === null || isFilling) return scroll;
    return { follow: false, up: scroll.up + to - from };
}

/**
 * how many of the newest rows to draw: while he reads, the first one drawn stays, so a new row never drops a row
 * above him and moves his place
 * @param {string[]} ids every row, oldest first
 * @param {number} limit
 * @param {string | null} first the first row drawn last time
 * @param {boolean} follow
 */
export function keptFirst(ids, limit, first, follow) {
    if (follow || first === null) return limit;
    const at = ids.indexOf(first);
    return at < 0 ? limit : Math.max(limit, ids.length - at);
}
