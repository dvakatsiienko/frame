// a row's details (FRM-594) on his clock: his message prints its one state's time and its mark, ✓ sent, ✓✓ read
// (FRM-563:W13), the state the row model owns (`Delivery`); a reply prints its time alone

import { clockOf } from './relay.js';

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/** a moment on his clock, with its date when it is not today; null when it does not parse @param {string} at @param {number} now */
const whenOf = (at, now) => {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return null;
    const clock = clockOf(at);
    return d.toDateString() === new Date(now).toDateString()
        ? clock
        : `${MONTHS[d.getMonth()]} ${d.getDate()}, ${clock}`;
};

/**
 * his message's state as the common chat mark, never a word: ✓ sent, ✓✓ read (FRM-563:W13)
 * @param {{ at: string | null, delivery: import('./row-model.js').Delivery | null }} row
 * @param {number} now
 * @returns {{ when: string, mark: '✓' | '✓✓' | null } | null} «15:10» with ✓ or ✓✓, a reply's «15:04» bare; null with no stamp
 */
export function messageDetails({ at, delivery }, now) {
    const when = whenOf(delivery?.at ?? at ?? '', now);
    if (!when) return null;
    if (!delivery) return { mark: null, when };
    return { mark: delivery.state === 'read' ? '✓✓' : '✓', when };
}
