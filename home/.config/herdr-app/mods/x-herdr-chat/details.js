// a row's details (FRM-594) on his clock: his message prints its one state and that state's time, which the row
// model owns (`Delivery`); a reply prints its time alone

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
 * @param {{ at: string | null, delivery: import('./row-model.js').Delivery | null }} row
 * @param {number} now
 * @returns {string | null} «read 15:04», «sent 15:10», a reply's «15:04»; null with no stamp
 */
export function messageDetails({ at, delivery }, now) {
    if (delivery) {
        const when = whenOf(delivery.at, now);
        return when && `${delivery.state} ${when}`;
    }
    return at ? whenOf(at, now) : null;
}
