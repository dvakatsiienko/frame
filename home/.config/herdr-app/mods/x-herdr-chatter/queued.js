// a message sent while the thread works waits in Claude Code's queue, unseen, until the turn takes it at its next tool
// round; the quill is empty by then, so it read as lost (dima, 17:20: «yes it confused me and i want it fixed»). each
// one shows as queued until its row reaches the transcript

/** @typedef {{ at: number, text: string }} Queued */

// past this, a thread idle with the message never in its transcript has dropped it: the chip goes, the turn's own rows stand
export const QUEUED_IDLE_MS = 5000;
// cc stamps a queued row with its enqueue time, which can sit a moment before the send was timed here
const STAMP_SLACK_MS = 5000;

/** @param {string} text */
const words = (text) => text.replace(/\s+/g, ' ').trim();

// a slash command reaches the transcript as tags, `<command-name>/x</command-name>` and `<command-args>…`: read back
// as he typed it, `/x …`, or its queued card never clears (his 18:37 wisp)
/** @param {string} text */
const asTyped = (text) => {
    const name = /<command-name>([^<]*)<\/command-name>/.exec(text)?.[1];
    if (!name) return text;
    const args =
        /<command-args>([\s\S]*?)<\/command-args>/.exec(text)?.[1] ?? '';
    return `${name} ${args}`;
};

/**
 * the queue after a user row reaches the transcript: the first message it carries leaves
 * @param {Queued[]} queued
 * @param {string} text the row's text as cc wrote it
 * @param {number} at the row's stamp
 * @returns {Queued[]}
 */
export function queuedAfterRow(queued, text, at) {
    const row = words(asTyped(text));
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
    if (op.operation === 'enqueue')
        return [...queue, { at: Date.parse(op.timestamp ?? '') || 0, text }];
    const i = leavingAt(queue, op);
    return i < 0 ? queue : queue.filter((_, n) => n !== i);
}

/** where in the queue a record takes a message out, -1 for none @param {Queued[]} queue @param {any} op */
function leavingAt(queue, op) {
    const text = typeof op.content === 'string' ? op.content : '';
    switch (op.operation) {
        case 'remove':
        case 'popAll':
            return queue.findIndex((q) => q.text === text);
        case 'dequeue': {
            if (!queue.length) return -1;
            const his = queue.findIndex((q) => isHisQueued(q.text));
            return his < 0 ? 0 : his;
        }
        default:
            return -1;
    }
}

/** @typedef {Queued & { readAt: number }} Read */

/**
 * the reads after one record: a tool round's `remove` or a turn end's `dequeue` that takes a message of his is the
 * moment Claude Code read it; ↑ pulling it back out (`popAll`) is none
 * @param {Read[]} reads @param {Queued[]} queue the queue before the record @param {any} op
 * @returns {Read[]}
 */
export function readsAfter(reads, queue, op) {
    if (op.operation !== 'remove' && op.operation !== 'dequeue') return reads;
    const taken = queue[leavingAt(queue, op)];
    const readAt = Date.parse(op.timestamp ?? '');
    if (!taken || !isHisQueued(taken.text) || !readAt) return reads;
    return [...reads.slice(-199), { ...taken, readAt }];
}

/**
 * when Claude Code read his message: the read whose words and send time match its row (cc stamps a mid-turn row with
 * its enqueue time); a row with no queue record, an idle send above all (clio's transcript, 14:15–14:18), was read when
 * it landed, so its own time; null only with no row time
 * @param {Read[]} reads @param {string} text @param {number} at
 */
export function readTime(reads, text, at) {
    const said = words(queuedWords(text));
    const read = reads.find(
        (r) =>
            Math.abs(r.at - at) <= STAMP_SLACK_MS &&
            words(asTyped(queuedWords(r.text))) === said,
    );
    return read?.readAt ?? (at || null);
}

/** what he typed, out of the wrapper Claude Code puts around a paste @param {string} text */
export const queuedWords = (text) =>
    text
        .replace(
            /^<pasted_content\b[^>]*>\n?([\s\S]*?)\n?<\/pasted_content>$/,
            '$1',
        )
        .trim();

// hc reads a text that opens with `-` as its own flag and refuses the send (exit 2, a «- item» lost 2026-11-12): `--` ends its flags
/** @param {string} address @param {string} text @param {string[]} [flags] */
export const sendArgs = (address, text, flags = []) => [
    'send',
    ...flags,
    address,
    '--',
    text,
];

// vim's insert mode names itself at the foot of Claude Code's screen; its normal mode shows nothing, the same as vim off
/** @param {string} screen @param {unknown} editorMode Claude's `editorMode` setting */
export const isVimNormal = (screen, editorMode) =>
    editorMode === 'vim' && !screen.includes('-- INSERT --');

// a command typed into Claude Code's prompt: vim's normal mode takes the keys as motions and Enter there opens nothing,
// so `i` goes first (dima's effort pick, 21:37, proven on a throwaway thread)
/** @param {string} command @param {boolean} isNormal */
export const commandKeys = (command, isNormal) => [
    ...(isNormal ? ['i'] : []),
    ...command.split(''),
];

// keys that empty Claude Code's prompt holding `texts`: ctrl+u twice a line, a key that neither exits nor stops Claude.
// vim's normal mode keeps its cursor on the last character, where ctrl+u leaves it and the next send glues onto it
// (probed 2026-11-12: «plum» pulled and re-sent was queued as «plumm»): there the whole text goes, then back to insert
/** @param {string[]} texts @param {boolean} isNormal @returns {string[]} */
export const clearKeys = (texts, isNormal) =>
    isNormal
        ? ['g', 'g', 'd', 'shift+g', 'i']
        : Array(
              texts.reduce(
                  (n, q) =>
                      n + q.split('\n').length + Math.ceil(q.length / 40) + 2,
                  0,
              ) * 2,
          ).fill('ctrl+u');

// What Claude Code's own prompt box holds, read off its screen: the last `❯` line right under a rule, down to the next
// rule; null when no box is on screen. Its dim suggestion text reads the same, so a caller trusts it only when it
// matches a prompt already sent.
/** @param {string} screen @returns {string | null} */
export function boxText(screen) {
    const lines = screen.replace(/\r/g, '').split('\n');
    let open = lines.length - 1;
    while (
        open > 0 &&
        !(lines[open].startsWith('❯') && lines[open - 1].startsWith('─'))
    )
        open--;
    if (open <= 0) return null;
    const box = [lines[open].slice(1)];
    for (const l of lines.slice(open + 1)) {
        if (l.startsWith('─')) break;
        box.push(l);
    }
    return box.join(' ').replace(/\s+/g, ' ').trim();
}

// his sends waiting for the turn, drawn at the log's end as his own rows in their «sent» state; the transcript's row
// takes over once Claude Code reads one
// keyed by its words and how many waiting before it share them: its stamp moves when Claude Code records it, its place
// when an earlier one is taken, and a new key remeasures the row
/** @param {{ at: number, text: string, isRecorded: boolean }[]} waiting */
export function waitingRows(waiting) {
    /** @type {Map<string, number>} */
    const seen = new Map();
    return waiting.map((q, n) => {
        const text = queuedWords(q.text);
        const twin = seen.get(text) ?? 0;
        seen.set(text, twin + 1);
        return {
            id: `waiting-${n}`,
            item: {
                at: q.at,
                isWaiting: true,
                kind: /** @type {'user'} */ ('user'),
                text,
            },
            key: `waiting:${twin}:${text}`,
            kind: /** @type {'item'} */ ('item'),
            mine: true,
        };
    });
}
