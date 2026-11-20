// antenna's rows (FRM-618 slice A): every thread once, in his order; grouped, a space's threads sit under its name,
// the spaces in the order his first thread of each takes. a row's dot is its status word, drawn still

import { inOrder } from './order.js';

/** @typedef {{ address: string, space: string, space_name: string, status: string }} Thread */
/** @typedef {{ kind: 'space', name: string, space: string } | { kind: 'thread', address: string, dot: string, name: string }} Row */

/**
 * @param {Thread[]} threads herdr's `agents()`
 * @param {{ isGrouped: boolean, names: Record<string, string>, order: string[] }} seen his order and the thread names
 * @returns {Row[]}
 */
export function antennaRows(threads, { isGrouped, names, order }) {
    const ordered = inOrder(threads, order);
    /** @param {Thread} t @returns {Row} */
    const row = (t) => ({
        address: t.address,
        dot: t.status,
        kind: 'thread',
        name: names[t.address] || t.address,
    });
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
