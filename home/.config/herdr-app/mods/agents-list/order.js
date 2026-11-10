// the agents list in dima's own order: the order stored, an agent first seen since appended at its end, so a row
// never moves unless he moves it

/**
 * the stored order after this read: an address gone from every live terminal leaves, a new one joins at the end
 * @param {string[]} order the stored order
 * @param {string[]} shown the agents' addresses now
 * @param {Set<string>} live every live terminal's address
 * @returns {string[]}
 */
export function nextOrder(order, shown, live) {
    const kept = order.filter((a) => live.has(a) || shown.includes(a));
    const known = new Set(kept);
    return [...kept, ...shown.filter((a) => !known.has(a))];
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
