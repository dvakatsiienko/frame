// how many of antenna's threads work, of how many it lists (FRM-620:W86): in the head, and by each space's name while
// grouped. busy is a row whose dot says working, so the count and the dots are one read

import { activityShown } from './details.js';

/** @typedef {import('./rows.js').Thread} Thread */
/** @typedef {ReturnType<typeof activityShown>} Shown */

/**
 * each thread's dot and time, read once a draw: its row draws them, the counts count them
 * @param {Thread[]} threads
 * @param {(address: string) => import('./details.js').Activity | null} activityOf the state file's word
 * @param {number} now
 * @returns {Map<string, Shown>}
 */
export const dotsOf = (threads, activityOf, now) =>
    new Map(
        threads.map((t) => [
            t.address,
            activityShown(t.status, activityOf(t.address), now),
        ]),
    );

/**
 * @param {Thread[]} threads @param {Map<string, Shown>} dots
 * @returns {{ all: string | null, spaces: Map<string, string> }} all: null with no thread; a pinned thread counts in
 *     its own space
 */
export function busyCounts(threads, dots) {
    /** @param {Thread[]} of */
    const count = (of) =>
        `${of.filter((t) => dots.get(t.address)?.dot === 'working').length}/${of.length}`;
    const spaces = [...new Set(threads.map((t) => t.space))];
    return {
        all: threads.length ? count(threads) : null,
        spaces: new Map(
            spaces.map((space) => [
                space,
                count(threads.filter((t) => t.space === space)),
            ]),
        ),
    };
}

/** @param {string} count «4/10» */
export function busyHint(count) {
    const [busy, all] = count.split('/');
    return `${busy} working of ${all} ${all === '1' ? 'thread' : 'threads'}`;
}
