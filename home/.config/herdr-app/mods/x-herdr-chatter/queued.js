// a message sent while the thread works waits in Claude Code's queue, unseen, until the turn takes it at its next tool
// round; the box is empty by then, so it read as lost (dima, 17:20: «yes it confused me and i want it fixed»). each
// one shows as queued until its row reaches the transcript

/** @typedef {{ at: number, text: string }} Queued */

// past this, a thread idle with the message never in its transcript has dropped it: the chip goes, the turn's own rows stand
export const QUEUED_IDLE_MS = 5000;
// cc stamps a queued row with its enqueue time, which can sit a moment before the send was timed here
const STAMP_SLACK_MS = 5000;

/** @param {string} text */
const words = (text) => text.replace(/\s+/g, ' ').trim();

/**
 * the queue after a user row reaches the transcript: the first message it carries leaves
 * @param {Queued[]} queued
 * @param {string} text the row's text as cc wrote it
 * @param {number} at the row's stamp
 * @returns {Queued[]}
 */
export function queuedAfterRow(queued, text, at) {
    const row = words(text);
    const i = queued.findIndex(
        (q) => at >= q.at - STAMP_SLACK_MS && row.includes(words(q.text)),
    );
    return i < 0 ? queued : queued.filter((_, n) => n !== i);
}

/**
 * the queue once the thread has sat idle: a message never taken is dropped after the grace
 * @param {Queued[]} queued
 * @param {number | null} idleSince when the thread last went idle, null while it works
 * @param {number} now
 * @returns {Queued[]}
 */
export function queuedAfterIdle(queued, idleSince, now) {
    if (idleSince === null || now - idleSince < QUEUED_IDLE_MS) return queued;
    return queued.filter((q) => q.at > idleSince);
}
