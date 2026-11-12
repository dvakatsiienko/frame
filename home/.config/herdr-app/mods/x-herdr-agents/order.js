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
