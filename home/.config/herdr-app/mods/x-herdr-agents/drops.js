// what a drag in the agents list lands on and what its drop writes (FRM-664): pins reorder the pins, his own order
// moves a row, a tab row moves its tab within its space, a space header moves the space within its machine.

import { run, setShared, shared } from 'herdr';

import { moved } from './order.js';

/**
 * what a press drags
 * @typedef {{ kind: 'pin' }
 *   | { kind: 'mine' }
 *   | { kind: 'tab', space: string, tab: string }
 *   | { kind: 'space', id: string, machine: string | null }} Dragged
 */
/**
 * what the pointer is over: an agent row, with its places in each order, or a space's header
 * @typedef {{ kind: 'agent', isPinned: boolean, isYours: boolean, pinAt: number, mineAt: number, tabAt: number,
 *   space: string, tab: string, spaceAt: number, machine: string | null }
 *   | { kind: 'header', spaceAt: number, machine: string | null }} Spot
 */
/**
 * what a drop reads at the moment it lands, never a render's copy
 * @typedef {{ order: string[], pinned: string[], pins: string[], setOrder: (order: string[]) => void,
 *   setPins: (pins: string[]) => void }} DropContext
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
 * @param {Dragged} item @param {number} from @param {number} to @param {DropContext} cx
 */
export function drop(item, from, to, cx) {
    switch (item.kind) {
        case 'pin': {
            const shown = cx.pinned;
            const from_ = shown[from];
            const to_ = shown[to];
            if (from_ === undefined || to_ === undefined) return;
            cx.setPins([
                ...moved(shown, from_, to_),
                ...cx.pins.filter((p) => !shown.includes(p)),
            ]);
            return;
        }
        case 'mine': {
            const from_ = cx.order[from];
            const to_ = cx.order[to];
            if (from_ === undefined || to_ === undefined) return;
            cx.setOrder(moved(cx.order, from_, to_));
            return;
        }
        case 'tab':
            run('tab.move', { id: item.tab, index: to + 1 });
            return;
        case 'space':
            run('space.move', { id: item.id, index: to + 1 });
            return;
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
