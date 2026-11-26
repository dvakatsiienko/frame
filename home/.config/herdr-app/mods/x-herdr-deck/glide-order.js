// his order of the glide cards (FRM-527:W138): a card he dragged keeps its place across a reload and a restart, a card
// never seen joins at the end, an ended one leaves and the rest keep theirs. it lives in herdr's storage, never in
// lanes.json, which clio and the stash write

/** @typedef {import('./lanes.js').Lane} Lane */
/** @typedef {{ getItem(key: string): string | null, setItem(key: string, value: string): void }} OrderStore */

export const ORDER_KEY = 'glide:order';

/**
 * a card's place in his order: its lane plan, which outlives a new card for the same lane, a rename and a re-link; a card
 * with no plan is its own id @param {Lane} l
 */
export const placeOf = (l) =>
    l.plan
        ? l.plan.replace(/^(?:~|\/Users\/[^/]+)\//, '~/')
        : (l.id ?? l.title);

/** the shown cards in his order: the ones he placed by it, then every other in today's order @param {Lane[]} lanes @param {string[]} order */
export function inHisOrder(lanes, order) {
    const at = new Map(order.map((place, i) => [place, i]));
    const placed = lanes
        .filter((l) => at.has(placeOf(l)))
        .sort((a, b) => (at.get(placeOf(a)) ?? 0) - (at.get(placeOf(b)) ?? 0));
    return [...placed, ...lanes.filter((l) => !at.has(placeOf(l)))];
}

/** his order after a drop: the shown cards with the one at `from` put at `to` @param {Lane[]} shown @param {number} from @param {number} to */
export function movedOrder(shown, from, to) {
    // by card, so two cards of one plan keep the indices the drag counts in; the place's first card then holds it
    const places = shown.map(placeOf);
    const [held] = places.splice(from, 1);
    if (held !== undefined) places.splice(to, 0, held);
    return [...new Set(places)];
}

/** @param {OrderStore} store @returns {string[]} */
export function loadOrder(store) {
    try {
        const kept = JSON.parse(store.getItem(ORDER_KEY) ?? '[]');
        return Array.isArray(kept)
            ? kept.filter((p) => typeof p === 'string')
            : [];
    } catch {
        return [];
    }
}

/** @param {OrderStore} store @param {string[]} order */
export function saveOrder(store, order) {
    try {
        store.setItem(ORDER_KEY, JSON.stringify(order));
    } catch {
        // a refused write keeps the order for this run only
    }
}
