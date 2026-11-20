// the agents list in dima's own order: the order stored, an agent first seen since appended at its end, so a row
// never moves unless he moves it

// past this many addresses the oldest gone ones leave; a read that misses agents (herdr's first frames after a start
// see none) wiped his whole order on 2026-11-11, so nothing leaves on a read alone
export const ORDER_CAP = 200;

/**
 * the stored order after this read: a new address joins at the end, a gone one keeps its place until the cap
 * @param {string[]} order the stored order
 * @param {string[]} shown the agents' addresses now
 * @param {Set<string>} live every live terminal's address
 * @returns {string[]}
 */
export function nextOrder(order, shown, live) {
    const known = new Set(order);
    const next = [...order, ...shown.filter((a) => !known.has(a))];
    let over = next.length - ORDER_CAP;
    if (over <= 0 || live.size === 0) return next;
    return next.filter((a) => {
        if (over <= 0 || live.has(a) || shown.includes(a)) return true;
        over--;
        return false;
    });
}

/**
 * a thread restarted in a new terminal takes the place of its gone terminal of the same name
 * @param {string[]} order
 * @param {Record<string, string>} names each address's thread name, gone ones included
 * @param {Set<string>} live every live terminal's address
 * @returns {string[]}
 */
export function heirs(order, names, live) {
    if (live.size === 0) return order;
    const next = [...order];
    for (const a of order) {
        if (!live.has(a) || !names[a]) continue;
        const gone = next.findIndex(
            (b) => b !== a && !live.has(b) && names[b] === names[a],
        );
        if (gone < 0 || gone > next.indexOf(a)) continue;
        next.splice(next.indexOf(a), 1);
        next[gone] = a;
    }
    return next;
}

/**
 * @template {{ address: string }} T
 * @param {T[]} list
 * @param {string[]} order
 * @returns {T[]}
 */
export function inOrder(list, order) {
    const at = new Map(order.map((a, i) => [a, i]));
    return [...list].sort(
        (x, y) =>
            (at.get(x.address) ?? order.length) -
            (at.get(y.address) ?? order.length),
    );
}

/**
 * his drag: `from` takes `to`'s place, landing after it when it moved down, the way the pins move
 * @param {string[]} order
 * @param {string} from
 * @param {string} to
 */
export function moved(order, from, to) {
    if (from === to || !order.includes(from) || !order.includes(to))
        return order;
    const rest = order.filter((a) => a !== from);
    rest.splice(order.indexOf(to), 0, from);
    return rest;
}

/** his drag inside one group: the group's rows move as `moved` moves them, written back into the places they held, so
 * no other group's row changes place @param {string[]} order @param {string[]} members @param {string} from
 * @param {string} to */
export function movedInGroup(order, members, from, to) {
    const inGroup = new Set(members);
    const group = order.filter((a) => inGroup.has(a));
    // a slot outside the group (a pinned row dropped among the unpinned) means the group's edge nearest it
    const target =
        inGroup.has(to) || group.length === 0
            ? to
            : order.indexOf(to) < order.indexOf(group[0])
              ? group[0]
              : group.at(-1);
    const next = moved(group, from, target);
    let i = 0;
    return order.map((a) => (inGroup.has(a) ? next[i++] : a));
}

/** his order as pids, or null until every listed thread was read once: after a restart the names arrive one by one,
 * and a partial order would move orbit's sections; a thread read with no pid (a plain probe) is skipped, never waited on
 * @param {string[]} order @param {string[]} listed
 * @param {(address: string) => number | null | undefined} readOf undefined: not read yet; null: read, no pid
 * @returns {number[] | null} */
export function orderPids(order, listed, readOf) {
    if (listed.length === 0 || listed.some((a) => readOf(a) === undefined))
        return null;
    return order.map(readOf).filter((pid) => typeof pid === 'number');
}

/** his pin press: a pin joins the set, a second press leaves it; the order never moves, so an unpin returns the row to
 * its old place @param {string[]} pins @param {string} address @returns {string[]} */
export function toggledPin(pins, address) {
    return pins.includes(address)
        ? pins.filter((a) => a !== address)
        : [...pins, address];
}

/** a pin on a gone terminal passes to the live terminal of the same thread name, the way `heirs` moves its place; with
 * no heir it stays, so a read that misses threads never drops a pin
 * @param {string[]} pins @param {Record<string, string>} names @param {Set<string>} live @returns {string[]} */
export function pinHeirs(pins, names, live) {
    const heirs = pins.map((p) => {
        if (live.has(p) || !names[p]) return p;
        const heir = [...live].find(
            (a) => names[a] === names[p] && !pins.includes(a),
        );
        return heir ?? p;
    });
    return [...new Set(heirs)];
}

/** @typedef {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void }} PinStore */

/** his pins as antenna's store holds them; anything but a list of addresses reads as none @param {PinStore} storage
 * @returns {string[]} */
export function loadPins(storage) {
    try {
        const pins = JSON.parse(storage.getItem('pins') ?? '[]');
        return Array.isArray(pins)
            ? pins.filter((a) => typeof a === 'string')
            : [];
    } catch {
        return [];
    }
}

/** @param {PinStore} storage @param {string[]} pins */
export function savePins(storage, pins) {
    storage.setItem('pins', JSON.stringify(pins));
}
