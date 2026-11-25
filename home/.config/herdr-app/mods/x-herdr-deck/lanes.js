// the glide cards as the deck reads them from `~/.claude/shelf/lanes.json`, which x-mod-stash writes; both sides test
// one fixture (x-mod-stash/tests/lanes-shelf.ts, FRM-659)

/** @typedef {{ text: string, isDone?: boolean, ticket?: string }} LaneItem */
/** @typedef {{ id?: string, title: string, ticket?: string, items?: LaneItem[], current?: number, done?: number, endedAt?: number | null, linkedIds?: { codie?: string } }} Lane */

/**
 * the lanes a board shows: every one the file holds that has not ended, one card each. a codie runs one lane, so of two
 * live cards linked to it the one opened first stays, as the stash keeps the open one over a second create
 * @param {any} body the parsed file, or null when it could not be read
 * @returns {Lane[]}
 */
export function lanesShown(body) {
    /** @type {Lane[]} */
    const all = Array.isArray(body?.lanes) ? body.lanes : [];
    const live = all.filter((l) => !l.endedAt);
    return live.filter((l, i) => {
        const codie = l.linkedIds?.codie;
        return (
            !codie ||
            live.findIndex((other) => other.linkedIds?.codie === codie) === i
        );
    });
}

/**
 * the ticket a card's pill names: its own, else its step's. a step that names none is read as part of the one before it,
 * the steps before the first named one as part of that
 * @param {Lane} lane
 * @returns {string | undefined}
 */
export function laneTicket(lane) {
    const items = lane.items ?? [];
    const upTo = items.slice(0, (lane.current ?? 0) + 1);
    return (
        lane.ticket ??
        upTo.reverse().find((item) => item.ticket)?.ticket ??
        items.find((item) => item.ticket)?.ticket
    );
}

/**
 * a step's mark on an opened card: ✓ for a step ticked done, ▸ for the one the lane is on, · for the rest; the tick is
 * the step's own, never «before the pointer», so the marks agree with the card's done count (FRM-656)
 * @param {LaneItem} item @param {number} i @param {number} current
 * @returns {'✓' | '▸' | '·'}
 */
export const stepMark = (item, i, current) =>
    item.isDone ? '✓' : i === current ? '▸' : '·';
