// a message's details (FRM-594): when it was sent, on his clock, and for his own message whether Claude Code got it.
// «queued» is queued.js's rule, read by the caller: a message stays queued until its row reaches the transcript

import { clockOf } from './relay.js';

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/**
 * @param {{ at: string | number | null, isMine: boolean, isQueued: boolean }} message
 * @param {number} now
 * @returns {string | null} «15:03 · received», «Nov 12, 23:52 · queued», a reply's «15:04»; null with no stamp
 */
export function messageDetails({ at, isMine, isQueued }, now) {
    const sent = at === null ? null : new Date(at);
    if (!sent || Number.isNaN(sent.getTime())) return null;
    const today = new Date(now);
    const isToday =
        sent.getFullYear() === today.getFullYear() &&
        sent.getMonth() === today.getMonth() &&
        sent.getDate() === today.getDate();
    const clock = clockOf(sent.toISOString());
    const when = isToday
        ? clock
        : `${MONTHS[sent.getMonth()]} ${sent.getDate()}, ${clock}`;
    if (!isMine) return when;
    return `${when} · ${isQueued ? 'queued' : 'received'}`;
}
