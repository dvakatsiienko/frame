// a message's details (FRM-594): one state and its own time, on his clock. his own message reads «sent» at its send
// time while Claude Code holds it, «read» once it took it (his 17:16: «only one state — sent or read»): at the `remove`
// record a tool round wrote, or a row's own stamp when no record took it (an idle send, a turn's start)

import { clockOf } from './relay.js';

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/** @param {string | null | undefined} at @returns {Date | null} */
const dateOf = (at) => {
    const d = at ? new Date(at) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
};

/** a moment on his clock, with its date when it is not today @param {Date} at @param {Date} today */
const whenOf = (at, today) => {
    const clock = clockOf(at.toISOString());
    return at.toDateString() === today.toDateString()
        ? clock
        : `${MONTHS[at.getMonth()]} ${at.getDate()}, ${clock}`;
};

/**
 * @param {{ at: string | null, isMine: boolean, isWaiting: boolean, readAt?: string | null }} row
 * @param {number} now
 * @returns {string | null} «read 15:04», «sent 15:10», a reply's «15:04»; null with no stamp
 */
export function messageDetails({ at, isMine, isWaiting, readAt = null }, now) {
    const sent = dateOf(at);
    if (!sent) return null;
    const today = new Date(now);
    if (!isMine) return whenOf(sent, today);
    if (isWaiting) return `sent ${whenOf(sent, today)}`;
    return `read ${whenOf(dateOf(readAt) ?? sent, today)}`;
}
