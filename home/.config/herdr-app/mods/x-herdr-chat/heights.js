// each row's measured height, kept by the row's id and version: the list is handed exact sizes, so a row that changes
// moves nothing above it, and only the rows near the view are measured in a frame.

/** @typedef {{ id: string, version: number, kind: 'mine' | 'reply' | 'tool' | 'file', text: string }} Measured */
/** @typedef {{ start: number, end: number }} Range */

// herdr's list refuses a taller row
export const MAX_ROW_PX = 40000;
// rows never measured, taken per frame; and the most rows one frame measures in all
const MEASURE_NEW = 30;
const MEASURE_MAX = 60;
// rows around the view measured again each frame: rich text can lay out a frame after it first draws
const AROUND = 2;
// how far from the view a frame looks for rows never measured: a far row keeps its guess until he comes near
const REACH = 200;

const TOOL_ROW_PX = 28;
const LINE_PX = 21;
const CHAR_PX = 7;
// a bubble's padding and the details line under it (FRM-594)
const BUBBLE_PAD_PX = 48;

/**
 * a row's height before it is measured, from its text and the list's width
 * @param {Measured} row
 * @param {number} width
 */
export function guessHeight(row, width) {
    if (row.kind === 'tool') return TOOL_ROW_PX;
    const perLine = Math.max(20, Math.floor((width * 0.8) / CHAR_PX));
    const lines = row.text
        .split('\n')
        .reduce(
            (sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)),
            0,
        );
    return BUBBLE_PAD_PX + lines * LINE_PX;
}

/** @param {number} height */
const whole = (height) => Math.min(MAX_ROW_PX, Math.max(1, Math.ceil(height)));

export function createHeights() {
    /** a measured height by id and version @type {Map<string, number>} */
    const measured = new Map();
    /** a row's last height at any version: what a grown row keeps until it is measured again @type {Map<string, number>} */
    const last = new Map();
    /** @param {Measured} row */
    const keyOf = (row) => `${row.id}@${row.version}`;

    return {
        clear() {
            measured.clear();
            last.clear();
        },
        /**
         * @param {Measured} row
         * @param {number} height as measured
         * @returns {boolean} whether the row's height changed
         */
        record(row, height) {
            const next = whole(height);
            if (measured.get(keyOf(row)) === next) return false;
            measured.set(keyOf(row), next);
            last.set(row.id, next);
            return true;
        },
        /**
         * every row's height, in order
         * @param {readonly Measured[]} rows
         * @param {(row: Measured) => number} guess
         */
        sizes(rows, guess) {
            return rows.map(
                (row) =>
                    measured.get(keyOf(row)) ??
                    last.get(row.id) ??
                    whole(guess(row)),
            );
        },
        /**
         * the rows to measure this frame: those never measured, nearest the view first, then the ones on screen
         * @template {Measured} R
         * @param {readonly R[]} rows
         * @param {Range | null} range the rows the list drew last
         * @returns {R[]}
         */
        toMeasure(rows, range) {
            const near = range ? range.start : rows.length - 1;
            /** @type {Set<R>} */
            const order = new Set();
            for (
                let step = 0;
                order.size < MEASURE_NEW &&
                step <= Math.min(rows.length, REACH);
                step++
            )
                for (const i of step ? [near - step, near + step] : [near]) {
                    const row = rows[i];
                    if (
                        row &&
                        !measured.has(keyOf(row)) &&
                        order.size < MEASURE_NEW
                    )
                        order.add(row);
                }
            if (range)
                for (
                    let i = Math.max(0, range.start - AROUND);
                    i < Math.min(rows.length, range.end + AROUND) &&
                    order.size < MEASURE_MAX;
                    i++
                ) {
                    const row = rows[i];
                    if (row) order.add(row);
                }
            return [...order];
        },
    };
}
