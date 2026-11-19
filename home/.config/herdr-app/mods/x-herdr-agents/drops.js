// what a drag in the agents list lands on and what its drop writes (FRM-664): pins reorder the pins, his own order
// moves a row, a tab row moves its tab within its space, a space header moves the space within its machine.

import { run, setShared, shared } from 'herdr';

import { moved } from './order.js';

/**
 * what a press drags
 * @typedef {{ kind: 'pin', address: string }
 *   | { kind: 'mine', address: string }
 *   | { kind: 'tab', space: string, tab: string }
 *   | { kind: 'space', id: string, machine: string | null }} Dragged
 */
/**
 * what the pointer is over: an agent row, with its place among the shown rows of each kind, or a space's header;
 * a place counts only what is drawn, so the rows between a source and its target are the ones that slide
 * @typedef {{ kind: 'agent', isPinned: boolean, isYours: boolean, pinAt: number, mineAt: number, tabAt: number,
 *   space: string, tab: string, spaceAt: number, machine: string | null }
 *   | { kind: 'header', spaceAt: number, machine: string | null }} Spot
 */
/**
 * what a drop reads as it lands: the shown rows of each kind in their drawn order, and the stores they move in
 * @typedef {{ order: string[], pins: string[], shownPins: string[], shownMine: string[],
 *   shownTabs: Record<string, string[]>, shownSpaces: string[], tabIndex: (space: string, tab: string) => number,
 *   spaceIndex: (space: string) => number, setOrder: (order: string[]) => void, setPins: (pins: string[]) => void
 * }} DropContext
 */

/**
 * where `item` lands with the pointer over `spot`, or null when that spot does not take it
 * @param {Dragged} item @param {Spot} spot @returns {number | null}
 */
export function targetOf(item, spot) {
    const spaceTarget = () =>
        item.kind === 'space' &&
        spot.spaceAt >= 0 &&
        spot.machine === item.machine
            ? spot.spaceAt
            : null;
    if (spot.kind === 'header') return spaceTarget();
    if (item.kind === 'pin') return spot.isPinned ? spot.pinAt : null;
    if (item.kind === 'mine')
        return spot.isYours && !spot.isPinned ? spot.mineAt : null;
    if (spot.isPinned || spot.isYours) return null;
    if (item.kind === 'tab')
        return item.space === spot.space &&
            item.tab !== spot.tab &&
            spot.tabAt >= 0
            ? spot.tabAt
            : null;
    return spaceTarget();
}

/**
 * the one write a drop makes: `from` takes `to`'s place, landing after it when it moved down; herdr's moves are 1-based
 * @param {Dragged} item @param {number} _from @param {number} to @param {DropContext} cx
 */
export function drop(item, _from, to, cx) {
    switch (item.kind) {
        case 'pin': {
            // by its address: a row that went mid-drag shifts the places, never what moves
            const shown = cx.shownPins;
            const to_ = shown[to];
            if (to_ === undefined) return;
            cx.setPins([
                ...moved(shown, item.address, to_),
                ...cx.pins.filter((p) => !shown.includes(p)),
            ]);
            return;
        }
        case 'mine': {
            const to_ = cx.shownMine[to];
            if (to_ === undefined) return;
            cx.setOrder(moved(cx.order, item.address, to_));
            return;
        }
        case 'tab': {
            const onto = cx.shownTabs[item.space]?.[to];
            const at = onto === undefined ? -1 : cx.tabIndex(item.space, onto);
            if (at >= 0) run('tab.move', { id: item.tab, index: at + 1 });
            return;
        }
        case 'space': {
            const onto = cx.shownSpaces[to];
            const at = onto === undefined ? -1 : cx.spaceIndex(onto);
            if (at >= 0) run('space.move', { id: item.id, index: at + 1 });
            return;
        }
        default: {
            /** @type {never} */
            const unhandled = item;
            return unhandled;
        }
    }
}

/**
 * the rows drawn, kind by kind, in order: a drag's places count only these. a folded group draws none of its rows;
 * the narrow rail draws every row and no header
 * @param {{ id: string, space?: string | null, members: { address: string, space: string, tab: string }[] }[]} groups
 * @param {{ folded: Set<string>, pins: string[], isYours: boolean, isNarrow: boolean }} view
 * @returns {Pick<DropContext, 'shownMine' | 'shownPins' | 'shownSpaces' | 'shownTabs'>}
 */
export function shownOf(groups, { folded, isNarrow, isYours, pins }) {
    const drawn = groups
        .filter((g) => isNarrow || !folded.has(g.id))
        .flatMap((g) => g.members);
    const unpinned = drawn.filter((a) => !pins.includes(a.address));
    /** @type {Record<string, string[]>} */
    const shownTabs = {};
    if (!isYours)
        for (const a of unpinned) {
            const tabs = shownTabs[a.space] ?? [];
            if (!tabs.includes(a.tab)) shownTabs[a.space] = [...tabs, a.tab];
        }
    return {
        shownMine: isYours ? unpinned.map((a) => a.address) : [],
        shownPins: drawn
            .filter((a) => pins.includes(a.address))
            .map((a) => a.address),
        shownSpaces: isNarrow
            ? []
            : [...new Set(groups.flatMap((g) => (g.space ? [g.space] : [])))],
        shownTabs,
    };
}

/**
 * how many places a dragged item's kind has among the drawn rows
 * @param {Dragged} item @param {ReturnType<typeof shownOf>} shown
 */
export function placesOf(item, shown) {
    switch (item.kind) {
        case 'pin':
            return shown.shownPins.length;
        case 'mine':
            return shown.shownMine.length;
        case 'tab':
            return (shown.shownTabs[item.space] ?? []).length;
        case 'space':
            return shown.shownSpaces.length;
        default: {
            /** @type {never} */
            const unhandled = item;
            return unhandled;
        }
    }
}

// the pids in the order the list shows them: the deck orders its sessions and orbit by it (dima, 20:20: «The order in
// the agents list is the true source for the order in Orbit for threads»); written only on a change
export const ORDER_KEY = 'x-herdr-agents.order';

/** @param {string[]} addresses @param {(address: string) => number | undefined} pidOf */
export function publishOrder(addresses, pidOf) {
    const pids = addresses.map(pidOf).filter((pid) => typeof pid === 'number');
    if (JSON.stringify(shared(ORDER_KEY) ?? []) !== JSON.stringify(pids))
        setShared(ORDER_KEY, pids);
}
