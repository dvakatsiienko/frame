// the deck's parts (FRM-618 slices B, C and D): antenna lists the threads and glide draws under it, so the deck scrolls
// orbit alone; the pinned block at its bottom holds the plan of the thread focused in antenna, or every thread's plan
// in his order when the focus is on no known thread, a thread with no phases left out

import { inListOrder } from './orbit.js';

/** @typedef {{ name: string, phases: string[], sid: string }} PhaseGroup */

/**
 * @param {{ name: string, phases: string[], pid: number, sid: string }[]} rows the live threads
 * @param {{ focusedPid?: number | null, order: number[] | null }} seen his order is antenna's pids
 * @returns {{ pinned: PhaseGroup[] }}
 */
export function deckParts(rows, { focusedPid = null, order }) {
    const focused = rows.find((r) => r.pid === focusedPid);
    return {
        pinned: inListOrder(focused ? [focused] : rows, order)
            .filter((r) => r.phases.length > 0)
            .map(({ name, phases, sid }) => ({ name, phases, sid })),
    };
}

/**
 * orbit's header, drawn at every count so nothing below it moves when the last ask goes (rider 4c); at zero a calm
 * «no asks» line sits under the bare name
 * @param {number} asks
 */
export const orbitHeader = (asks) =>
    asks > 0 ? `🪐 orbit: ${asks} ${asks === 1 ? 'ask' : 'asks'}` : '🪐 orbit';
