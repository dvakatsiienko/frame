// the deck's parts (FRM-618 slices B and C): antenna lists the threads and glide draws under it, so the deck scrolls
// orbit alone, and every thread's phases sit in one block pinned to the deck's bottom, a group per thread in his order,
// a thread with no phases left out

import { inListOrder } from './orbit.js';

/** @typedef {{ name: string, phases: string[], sid: string }} PhaseGroup */

/**
 * @param {{ name: string, phases: string[], pid: number, sid: string }[]} rows the live threads
 * @param {{ asks: number, order: number[] | null }} counts his order is antenna's pids
 * @returns {{ scroll: 'orbit'[], pinned: PhaseGroup[] }}
 */
export function deckParts(rows, { asks, order }) {
    /** @type {'orbit'[]} */
    const scroll = [];
    if (asks > 0) scroll.push('orbit');
    return {
        pinned: inListOrder(rows, order)
            .filter((r) => r.phases.length > 0)
            .map(({ name, phases, sid }) => ({ name, phases, sid })),
        scroll,
    };
}
