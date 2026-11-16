// his reading place, as one keeper the view and its tests both run: whether the list follows the newest, which
// message is first on screen and how far into it he is, and what to ask of the list before a frame. it holds no
// herdr call: the view hands it the rows, their sizes and what the list drew, and does what `plan` says.
// what it rests on was probed in his window (2026-11-16): the list's first drawn row is exact in every frame; herdr
// calls the row callback once more each frame, first, for row 0 alone; a wheel step is the list's movement in px; an
// asked item lands at the view's top only from above the view; the list keeps its px when sizes change; it draws its
// last item only with its scroll at the end (follow.js END_MARKS).

import {
    END_MARKS,
    followAfterWheel,
    isEndDrawn,
    needsLift,
    pinToRow,
    placeIndex,
    splitAtPlace,
    topAfterWheel,
    topOf,
} from './follow.js';

/** @typedef {import('./follow.js').Range} Range */
/** @typedef {{ id: string }} Row */
/**
 * what one frame asks of the list and how its items map to rows
 * @typedef {object} Plan
 * @property {'end' | 'lift' | 'seek' | null} ask `end`: go to the newest; `lift`: go to the end now and draw again
 *   at once, the place lands next frame; `seek`: bring item `seekAt` to the top
 * @property {number} seekAt the item a held place is sought by, -1 with none
 * @property {number[]} itemSizes the sizes to hand the list: the rows', a held message cut in two at the place, then
 *   END_MARKS
 * @property {number[]} sizes every row's height
 * @property {number} cutAt the row cut in two, -1 with none
 * @property {number} cutOffset the px of that row in its upper item
 * @property {(item: number) => number} rowAt the row a list item draws
 */

// how long after his last wheel step a range that reaches the end still counts as his own step there
export const WHEEL_REST_MS = 200;

export function createPlace() {
    /** following the newest: only while he sits at the end */
    let follow = true;
    /** the first message on screen while he reads mid-thread @type {string | null} */
    let id = null;
    /** the px of that message above the view */
    let offset = 0;
    /** how far the list is scrolled, counted from his wheel and held to the row the list drew */
    let top = 0;
    /** the rows the list drew last @type {Range | null} */
    let range = null;
    /** the list's scroll was at its end in the frame it drew last */
    let isAtEnd = false;
    /** a place held to the pixel until his next step @type {{ id: string, offset: number } | null} */
    let cut = null;
    /** after a look change, how far into the held message he was as a share of its height: a rewrap moves its px @type {number | null} */
    let share = null;
    let isSeekDue = false;
    /** the list was sent to its end, so the next frame can land the held place at the top */
    let isLifted = false;
    let wheelUntil = 0;
    let isLastWheelDown = false;

    /**
     * his place from the rows the list drew last. never inside the row callback (its extra call names row 0), and
     * never while a place is held: that one is the truth until his next step, its heights may still be guesses
     * @param {readonly Row[]} rows
     * @param {number[]} sizes
     */
    function read(rows, sizes) {
        if (follow || cut || !range) return;
        const row = rows[range.start];
        if (!row) return;
        const pinned = pinToRow(top, range.start, sizes);
        top = pinned.top;
        offset = pinned.offset;
        id = row.id;
    }

    /** his place is asked of the list again, to the pixel @returns {boolean} whether there was one to hold */
    function hold() {
        if (!id || follow) return false;
        cut = { id, offset };
        isSeekDue = true;
        isLifted = false;
        return true;
    }

    return {
        /**
         * the row callback: what the list drew this frame
         * @param {Range} drawn the items drawn
         * @param {Plan} plan this frame's plan
         * @param {number} now
         */
        drawn(drawn, plan, now) {
            const lastRow = Math.max(0, plan.sizes.length - 1);
            range = {
                end:
                    Math.min(
                        lastRow,
                        plan.rowAt(Math.max(drawn.start, drawn.end - 1)),
                    ) + 1,
                start: Math.min(lastRow, plan.rowAt(drawn.start)),
            };
            isAtEnd = isEndDrawn(drawn, plan.itemSizes.length);
            if (follow) return;
            // a step down that reached the end follows again, read from the range that step drew. never while a place
            // is held: its landing sends the list to its end for one frame
            if (!cut && isLastWheelDown && now < wheelUntil && isAtEnd) {
                follow = true;
                id = null;
            } else if (cut && plan.seekAt >= 0 && drawn.start === plan.seekAt)
                // the list drew from the held place: he is exactly there
                top =
                    topOf(plan.sizes, plan.rowAt(plan.seekAt)) + plan.cutOffset;
        },
        get follow() {
            return follow;
        },
        hold,
        /** a place is held and still landing or resting until his next step */
        get isHeld() {
            return cut !== null;
        },
        /**
         * a row got its real height: a place at or below it is held again, or the list, which keeps its px, would
         * slide it away. not during his own scroll: a landing would blink the list under his fingers
         * @param {readonly Row[]} rows
         * @param {number} index the measured row
         * @param {number} now
         * @returns {boolean} whether the place was held
         */
        measured(rows, index, now) {
            const at = placeIndex(rows, id);
            return at >= 0 && index <= at && now >= wheelUntil && hold();
        },
        /** the ↓ pill, or a thread read again from its start: back to following the newest */
        newest() {
            follow = true;
            id = null;
            cut = null;
            share = null;
            isSeekDue = false;
            isLifted = false;
        },
        /** the place to save: the message and the px of it above the view; null while following */
        get place() {
            return follow || !id ? null : { id, offset };
        },
        /**
         * before a frame: what to ask of the list, and the sizes to hand it
         * @param {readonly Row[]} rows
         * @param {number[]} sizes every row's height
         * @param {number} viewH
         * @returns {Plan}
         */
        plan(rows, sizes, viewH) {
            if (cut && share !== null) {
                const at = placeIndex(rows, cut.id);
                if (at >= 0) {
                    offset = Math.round(share * (sizes[at] ?? 0));
                    cut = { id: cut.id, offset };
                }
            }
            const split = cut
                ? splitAtPlace(rows, sizes, cut)
                : { cut: null, seekAt: -1, sizes };
            const cutAt = split.cut?.at ?? -1;
            /** @param {number} item */
            const rowAt = (item) =>
                cutAt >= 0 && item > cutAt ? item - 1 : item;
            /** @type {Plan['ask']} */
            let ask = null;
            if (isSeekDue && cut) {
                if (split.seekAt < 0) {
                    // the held message is not among the rows
                    isSeekDue = false;
                    cut = null;
                    share = null;
                } else if (!isLifted && needsLift(range, rowAt(split.seekAt))) {
                    isLifted = true;
                    ask = 'lift';
                } else {
                    isSeekDue = false;
                    isLifted = false;
                    ask = 'seek';
                }
            } else if (follow) {
                ask = 'end';
                top = Math.max(0, topOf(sizes, sizes.length) - viewH);
            }
            return {
                ask,
                cutAt,
                cutOffset: split.cut?.offset ?? 0,
                itemSizes: [...split.sizes, ...END_MARKS],
                rowAt,
                seekAt: cut ? split.seekAt : -1,
                sizes,
            };
        },
        get range() {
            return range;
        },
        read,
        /** another thread, or this one read again from its start: nothing of the old rows steers the new ones */
        reset() {
            follow = true;
            id = null;
            share = null;
            offset = 0;
            top = 0;
            range = null;
            isAtEnd = false;
            cut = null;
            isSeekDue = false;
            isLifted = false;
            wheelUntil = 0;
            isLastWheelDown = false;
        },
        /** a saved place read back after a reload: held until the list lands it @param {string} rowId @param {number} px */
        restore(rowId, px) {
            follow = false;
            id = rowId;
            offset = px;
            share = null;
            hold();
        },
        /**
         * a look change, before its rows take their new heights: his place is held as a share of its message, and a
         * message that leaves the list (a tool call hidden) hands the place to the next one still shown
         * @param {readonly Row[]} rows the rows drawn so far
         * @param {number[]} sizes their heights so far
         * @param {readonly Row[]} shown the rows drawn after the change
         * @returns {boolean} whether there was a place to hold
         */
        restyle(rows, sizes, shown) {
            read(rows, sizes);
            if (follow || !id) return false;
            if (cut) offset = cut.offset;
            const at = placeIndex(rows, id);
            const isShown = (/** @type {Row | undefined} */ row) =>
                row !== undefined && shown.some((s) => s.id === row.id);
            if (!isShown(rows[at])) {
                const next = rows.slice(at + 1).find(isShown);
                if (!next) return false;
                id = next.id;
                offset = 0;
            }
            const height = sizes[placeIndex(rows, id)] ?? 0;
            share = height > 0 ? offset / height : 0;
            cut = null;
            return hold();
        },
        get top() {
            return top;
        },
        /**
         * his wheel step, before the list moves
         * @param {number} dy the step in the sizes' unit, positive up
         * @param {readonly Row[]} rows
         * @param {number[]} sizes
         * @param {number} viewH
         * @param {number} now
         * @returns {{ isIgnored: boolean, hadCut: boolean, isFollowChanged: boolean }}
         */
        wheel(dy, rows, sizes, viewH, now) {
            // between the two frames of a landing the list sits at its end: a step taken there would end the held
            // place with the list still down there
            if (isLifted)
                return {
                    hadCut: false,
                    isFollowChanged: false,
                    isIgnored: true,
                };
            const was = follow;
            follow = followAfterWheel(was, dy, isAtEnd);
            wheelUntil = now + WHEEL_REST_MS;
            if (dy) isLastWheelDown = dy < 0;
            read(rows, sizes);
            // his own step ends a held place: the two halves are one row again, at the same height
            const hadCut = cut !== null;
            cut = null;
            share = null;
            isSeekDue = false;
            top = topAfterWheel(top, dy, sizes, viewH);
            if (follow) id = null;
            return {
                hadCut,
                isFollowChanged: follow !== was,
                isIgnored: false,
            };
        },
    };
}
