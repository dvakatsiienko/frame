// a message's details (FRM-594): when it was sent, on his clock, and for his own message when Claude Code read it,
// or «queued» while it still holds it (his o55 words: «sent» | «read»); the read time is queued.js's, from the
// transcript record that took the message off Claude Code's queue

import { clockOf } from './relay.js';

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/**
 * @param {{ at: string | number | null, isMine: boolean, isQueued: boolean, readAt?: number | null }} message
 * @param {number} now
 * @returns {string | null} «sent 15:03 · read 15:03», «sent 15:10 · queued», a reply's «15:04»; null with no stamp
 */
export function messageDetails({ at, isMine, isQueued, readAt = null }, now) {
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
    if (isQueued) return `sent ${when} · queued`;
    return readAt
        ? `sent ${when} · read ${clockOf(new Date(readAt).toISOString())}`
        : `sent ${when}`;
}
