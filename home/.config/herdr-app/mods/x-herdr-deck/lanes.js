// the glide cards as the deck reads them from `~/.claude/shelf/lanes.json`, which x-mod-stash writes; both sides test
// one fixture (x-mod-stash/tests/lanes-shelf.ts, FRM-659)

/** @typedef {{ text: string, isDone?: boolean }} LaneItem */
/** @typedef {{ id?: string, title: string, ticket?: string, items?: LaneItem[], current?: number, done?: number, endedAt?: number | null }} Lane */

/**
 * the lanes a board shows: every one the file holds that has not ended
 * @param {any} body the parsed file, or null when it could not be read
 * @returns {Lane[]}
 */
export const lanesShown = (body) =>
    (Array.isArray(body?.lanes) ? body.lanes : []).filter(
        (/** @type {Lane} */ l) => !l.endedAt,
    );

/**
 * a step's mark on an opened card: ✓ for a step ticked done, ▸ for the one the lane is on, · for the rest; the tick is
 * the step's own, never «before the pointer», so the marks agree with the card's done count (FRM-656)
 * @param {LaneItem} item @param {number} i @param {number} current
 * @returns {'✓' | '▸' | '·'}
 */
export const stepMark = (item, i, current) =>
    item.isDone ? '✓' : i === current ? '▸' : '·';
