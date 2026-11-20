// antenna's rows (FRM-618 slice A): every thread once, in his order; grouped, a space's threads sit under its name,
// the spaces in the order his first thread of each takes. a row's dot is its status word, drawn still

import { inOrder } from './order.js';

/** @typedef {{ address: string, space: string, space_name: string, status: string }} Thread */
/** @typedef {{ kind: 'pins' } | { kind: 'unpinned' } | { kind: 'space', name: string, space: string }
 *     | { kind: 'thread', address: string, dot: string, name: string, isPinned?: true }} Row */

/**
 * @param {Thread[]} threads herdr's `agents()`
 * @param {{ isGrouped: boolean, names: Record<string, string>, order: string[], pins?: string[] }} seen his order,
 *     the thread names and his pins: the pinned threads sit in one group above all, each group the order filtered
 * @returns {Row[]}
 */
export function antennaRows(threads, { isGrouped, names, order, pins = [] }) {
    const pinned = new Set(pins);
    const ordered = inOrder(threads, order);
    /** @param {Thread} t @returns {Row} */
    const row = (t) => ({
        address: t.address,
        dot: t.status,
        kind: 'thread',
        name: names[t.address] || t.address,
        ...(pinned.has(t.address) && { isPinned: /** @type {const} */ (true) }),
    });
    const top = ordered.filter((t) => pinned.has(t.address));
    const rest = ordered.filter((t) => !pinned.has(t.address));
    /** @type {Row[]} */
    const head = top.length
        ? [
              { kind: 'pins' },
              ...top.map(row),
              ...(rest.length
                  ? [{ kind: /** @type {const} */ ('unpinned') }]
                  : []),
          ]
        : [];
    return [...head, ...spaceRows(rest, isGrouped, row)];
}

/** @param {Thread[]} ordered @param {boolean} isGrouped @param {(t: Thread) => Row} row @returns {Row[]} */
function spaceRows(ordered, isGrouped, row) {
    if (!isGrouped) return ordered.map(row);
    /** @type {Map<string, Thread[]>} */
    const bySpace = new Map();
    for (const t of ordered)
        bySpace.set(t.space, [...(bySpace.get(t.space) ?? []), t]);
    return [...bySpace.values()].flatMap((members) => [
        {
            kind: /** @type {const} */ ('space'),
            name: members[0].space_name || 'space',
            space: members[0].space,
        },
        ...members.map(row),
    ]);
}

/** a thread row's Tab stop @param {string} address */
export const stopOf = (address) => `thread-${address}`;

/**
 * antenna's Tab stops: each drawn thread row that holds a keyboard handle, in drawn order; narrow, none
 * @param {string[]} addresses @param {{ isNarrow: boolean, hasKey: (address: string) => boolean }} drawn
 */
export function tabStops(addresses, { hasKey, isNarrow }) {
    return isNarrow ? [] : addresses.filter(hasKey).map(stopOf);
}
