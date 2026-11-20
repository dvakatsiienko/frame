// the deck's parts (FRM-618 slice B): antenna lists the threads, so the deck holds no sessions list; orbit leads and
// glide follows in the scrolling part, and every thread's phases sit in one block pinned to the deck's bottom, a group
// per thread in his order, a thread with no phases left out

import { inListOrder } from './orbit.js';

/** @typedef {{ name: string, phases: string[], sid: string }} PhaseGroup */

/**
 * @param {{ name: string, phases: string[], pid: number, sid: string }[]} rows the live threads
 * @param {{ asks: number, lanes: number, order: number[] | null }} counts his order is antenna's pids
 * @returns {{ scroll: ('orbit' | 'glide')[], pinned: PhaseGroup[] }}
 */
export function deckParts(rows, { asks, lanes, order }) {
    /** @type {('orbit' | 'glide')[]} */
    const scroll = [];
    if (asks > 0) scroll.push('orbit');
    if (lanes > 0) scroll.push('glide');
    return {
        pinned: inListOrder(rows, order)
            .filter((r) => r.phases.length > 0)
            .map(({ name, phases, sid }) => ({ name, phases, sid })),
        scroll,
    };
}
