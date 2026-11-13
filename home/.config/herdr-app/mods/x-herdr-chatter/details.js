// a message's details (FRM-594): one state and its own time, on his clock. his own message reads «sent» at its send
// time while Claude Code holds it, «read» at the moment it took it once it did (his 17:16: «only one state — sent or
// read»); the read time is queued.js's, from the transcript record that took the message off Claude Code's queue

import { clockOf } from './relay.js';

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/** a moment on his clock, with its date when it is not today @param {Date} at @param {Date} today */
const whenOf = (at, today) => {
    const clock = clockOf(at.toISOString());
    const isToday =
        at.getFullYear() === today.getFullYear() &&
        at.getMonth() === today.getMonth() &&
        at.getDate() === today.getDate();
    return isToday
        ? clock
        : `${MONTHS[at.getMonth()]} ${at.getDate()}, ${clock}`;
};

/**
 * @param {{ at: string | number | null, isMine: boolean, isQueued: boolean, readAt?: number | null }} message
 * @param {number} now
 * @returns {string | null} «read 15:04», «sent 15:10», a reply's «15:04»; null with no stamp
 */
export function messageDetails({ at, isMine, isQueued, readAt = null }, now) {
    const sent = at === null ? null : new Date(at);
    if (!sent || Number.isNaN(sent.getTime())) return null;
    const today = new Date(now);
    if (!isMine) return whenOf(sent, today);
    return readAt && !isQueued
        ? `read ${whenOf(new Date(readAt), today)}`
        : `sent ${whenOf(sent, today)}`;
}
