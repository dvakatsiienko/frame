// the time beside a thread in the agents list (FRM-618 W22): how long it has sat idle, nothing while it works or
// waits on dima; a finished turn counts as idle, since the thread waits for his next word either way

/** @param {number} ms */
function duration(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 1) return '<1m';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

/**
 * @param {string} status the shown status: idle, done, unread, working, blocked
 * @param {number} since when it last changed, ms; 0 when no change was seen
 * @param {number} now
 * @returns {string | null}
 */
export function timeLabel(status, since, now) {
    if (!since || status === 'working' || status === 'blocked') return null;
    return `idle ${duration(now - since)}`;
}
