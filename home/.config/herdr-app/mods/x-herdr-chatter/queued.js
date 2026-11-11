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

// Claude Code writes its queue into the transcript as `queue-operation` records: `enqueue` at a send, `remove` when a
// tool round takes one by its text, `dequeue` when a turn's end takes the next (his messages go before task notices:
// 15 of 15 runs where the two orders differ, 2026-11-12), and one `popAll` per message when ↑ in the empty prompt pulls
// his back out (probed 2026-11-12 01:19: two queued, two records)

/** a queued message of his, never a task notice or another thread's message @param {string} text */
export const isHisQueued = (text) =>
    Boolean(text) &&
    (!text.startsWith('<') || /^<(pasted_content|bash-input)\b/.test(text));

/**
 * Claude Code's queue after one of its transcript records
 * @param {Queued[]} queue
 * @param {{ operation?: string, content?: unknown, timestamp?: string }} op
 * @returns {Queued[]}
 */
export function claudeQueueAfter(queue, op) {
    const text = typeof op.content === 'string' ? op.content : '';
    switch (op.operation) {
        case 'enqueue':
            return [
                ...queue,
                { at: Date.parse(op.timestamp ?? '') || 0, text },
            ];
        case 'remove':
        case 'popAll': {
            const i = queue.findIndex((q) => q.text === text);
            return i < 0 ? queue : queue.filter((_, n) => n !== i);
        }
        case 'dequeue': {
            const his = queue.findIndex((q) => isHisQueued(q.text));
            const i = his < 0 ? 0 : his;
            return queue.filter((_, n) => n !== i);
        }
        default:
            return queue;
    }
}

/** what he typed, out of the wrapper Claude Code puts around a paste @param {string} text */
export const queuedWords = (text) =>
    text
        .replace(
            /^<pasted_content\b[^>]*>\n?([\s\S]*?)\n?<\/pasted_content>$/,
            '$1',
        )
        .trim();
