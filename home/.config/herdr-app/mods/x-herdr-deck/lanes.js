// the glide cards as the deck reads them from `~/.claude/shelf/lanes.json`, which x-mod-stash writes; both sides test
// one fixture (x-mod-stash/tests/lanes-shelf.ts, FRM-659)

/** @typedef {{ text: string, isDone?: boolean, ticket?: string }} LaneItem */
/** @typedef {{ id?: string, title: string, ticket?: string, items?: LaneItem[], current?: number, done?: number, endedAt?: number | null, plan?: string, linkedIds?: { codie?: string } }} Lane */

/** a card's lane: its codie and its title's first word («mods», «speak»); a card linked to none is a lane of its own @param {Lane} l */
const laneOf = (l) =>
    l.linkedIds?.codie
        ? `${l.linkedIds.codie} ${/[a-z0-9]+/i.exec(l.title)?.[0]?.toLowerCase()}`
        : (l.id ?? l.title);

/** @param {Lane} l */
const isFinished = (l) =>
    Boolean(l.items?.length && l.items.every((item) => item.isDone));

/**
 * the lanes a board shows: every one the file holds that has not ended, one card each. of two live cards of one lane the
 * one that moves is drawn: one not finished over one that is, then one that follows its plan, then the newest
 * @param {any} body the parsed file, or null when it could not be read
 * @returns {Lane[]}
 */
export function lanesShown(body) {
    /** @type {Lane[]} */
    const all = Array.isArray(body?.lanes) ? body.lanes : [];
    const live = all.filter((l) => !l.endedAt);
    /** @type {Map<string, Lane>} */
    const shown = new Map();
    for (const l of live) {
        const had = shown.get(laneOf(l));
        const isBetter =
            !had ||
            (isFinished(had) !== isFinished(l)
                ? isFinished(had)
                : Boolean(l.plan) || !had.plan);
        if (isBetter) shown.set(laneOf(l), l);
    }
    return live.filter((l) => shown.get(laneOf(l)) === l);
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
