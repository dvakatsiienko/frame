// his order of the glide cards (FRM-527:W138): a card he dragged keeps its place across a reload and a restart, a card
// never seen joins at the end, an ended one leaves and the rest keep theirs. it lives in herdr's storage, never in
// lanes.json, which clio and the stash write

import { laneOf } from './lanes.js';

/** @typedef {import('./lanes.js').Lane} Lane */
/** @typedef {{ getItem(key: string): string | null, setItem(key: string, value: string): void }} OrderStore */

export const ORDER_KEY = 'glide:order';

/** @typedef {{ id: string, plan: string | null, lane: string }} Place one card in his order, and what finds its heir */

/** a card's own key: its id, its title with none @param {Lane} l */
export const cardKey = (l) => l.id ?? l.title;

/** @param {Lane} l @returns {Place} */
export const placeOf = (l) => ({
    id: cardKey(l),
    lane: laneOf(l),
    plan: l.plan ? l.plan.replace(/^(?:~|\/Users\/[^/]+)\//, '~/') : null,
});

/**
 * the shown cards in his order: each place takes its own card, else a new card of its plan, else of its lane (a renamed,
 * re-linked or re-dispatched lane keeps its place); every card no place took follows in today's order
 * @param {Lane[]} lanes @param {Place[]} order
 */
export function inHisOrder(lanes, order) {
    const cards = lanes.map(placeOf);
    /** @type {(number | undefined)[]} each card's place in his order */
    const rank = cards.map(() => undefined);
    /** @param {(place: Place, card: Place) => boolean} same */
    const claim = (same) =>
        order.forEach((place, i) => {
            if (rank.includes(i)) return;
            const c = cards.findIndex(
                (card, k) => rank[k] === undefined && same(place, card),
            );
            if (c >= 0) rank[c] = i;
        });
    claim((p, c) => p.id === c.id);
    claim((p, c) => p.plan !== null && p.plan === c.plan);
    claim((p, c) => p.lane === c.lane);
    const placed = lanes
        .map((l, k) => ({ l, r: rank[k] }))
        .filter((x) => x.r !== undefined)
        .sort((a, b) => (a.r ?? 0) - (b.r ?? 0))
        .map((x) => x.l);
    return [...placed, ...lanes.filter((_l, k) => rank[k] === undefined)];
}

/** his order after a drop: the shown cards with the one at `from` put at `to` @param {Lane[]} shown @param {number} from @param {number} to */
export function movedOrder(shown, from, to) {
    const places = shown.map(placeOf);
    const [held] = places.splice(from, 1);
    if (held !== undefined) places.splice(to, 0, held);
    return places;
}

/** @param {OrderStore} store @returns {Place[]} */
export function loadOrder(store) {
    try {
        const kept = JSON.parse(store.getItem(ORDER_KEY) ?? '[]');
        return Array.isArray(kept)
            ? kept.filter(
                  (p) =>
                      typeof p?.id === 'string' &&
                      typeof p.lane === 'string' &&
                      (p.plan === null || typeof p.plan === 'string'),
              )
            : [];
    } catch {
        return [];
    }
}

/** @param {OrderStore} store @param {Place[]} order */
export function saveOrder(store, order) {
    try {
        store.setItem(ORDER_KEY, JSON.stringify(order));
    } catch {
        // a refused write keeps the order for this run only
    }
}
