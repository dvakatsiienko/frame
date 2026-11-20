// the deck's parts (FRM-618 slices B, C and D): antenna lists the threads and glide draws under it, so the deck scrolls
// orbit alone; the pinned block at its bottom holds the plan of the thread focused in antenna, or every thread's plan
// in his order when the focus is on no known thread, a thread with no phases left out

import { inListOrder } from './orbit.js';

/** @typedef {{ name: string, phases: string[], sid: string }} PhaseGroup */

/**
 * @param {{ name: string, phases: string[], pid: number, sid: string }[]} rows the live threads
 * @param {{ asks: number, focusedPid?: number | null, order: number[] | null }} counts his order is antenna's pids
 * @returns {{ scroll: 'orbit'[], pinned: PhaseGroup[] }}
 */
export function deckParts(rows, { asks, focusedPid = null, order }) {
    /** @type {'orbit'[]} */
    const scroll = [];
    if (asks > 0) scroll.push('orbit');
    const focused = rows.find((r) => r.pid === focusedPid);
    return {
        pinned: inListOrder(focused ? [focused] : rows, order)
            .filter((r) => r.phases.length > 0)
            .map(({ name, phases, sid }) => ({ name, phases, sid })),
        scroll,
    };
}
