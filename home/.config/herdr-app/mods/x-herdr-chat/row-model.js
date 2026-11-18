// the row model: transcript lines in, the thread's rows out. a row keeps its object for as long as it lives, and its
// `version` grows only when what it draws does (its text, its read time), so the list redraws and measures only the
// rows an update names.
// drawn so far: his messages, replies and one line per tool call; every other line waits for its own slice.
// a message he sent while the thread works waits in Claude Code's queue: it is his last row, waiting, until a turn
// takes it and its own transcript line replaces it: a user line at a turn's start, a queued command mid-turn.

import { joinedTexts } from './joins.js';
import { claudeQueueAfter, isHisQueued, unwrapPastes } from './queued.js';

/**
 * @typedef {object} Row
 * @property {string} id the uuid of the row's first transcript line
 * @property {'mine' | 'reply' | 'tool' | 'file'} kind `file`: a file a reply names, drawn under it (files.js)
 * @property {string} [path] a file row's file
 * @property {string} text his words, the reply's markdown, or the line naming a run of tool calls
 * @property {string | null} at when its line was written, as the transcript stamps it
 * @property {number} version 1 at birth, one more each time the text changes
 * @property {string | null} replyId the reply's message id: more text of the same message joins this row
 * @property {string[]} tools the names of the tool calls a tool row folds, in order
 * @property {boolean} isWaiting his message in Claude Code's queue, no turn has taken it yet
 * @property {boolean} isTurnStart his prompt that started a turn, never words a running turn took in
 * @property {string} [command] a prompt a tool round took: the queued command its `remove` record names
 * @property {Delivery | null} delivery his message's one state and that state's time (FRM-594); null on any other row
 */

/**
 * «sent» while Claude Code holds his message (a waiting row, or a taken prompt whose `remove` has not landed: its row is
 * written first), «read» once it took it: at that `remove`, or a row's own stamp when no record took it (an idle send,
 * a turn's start, words that joined)
 * @typedef {{ state: 'sent' | 'read', at: string }} Delivery
 */

// a conversation line opens with this key; api requests, snapshots and modes open with "type" and are never parsed
const CONVERSATION = '{"parentUuid"';
// Claude Code's queue records open with their type
const QUEUE_RECORD = '{"type":"queue-operation"';
// a user line that is not his words: a command's echo or output, a task notice, an interruption note
const NOT_HIS_WORDS =
    /^\s*(?:<(?!pasted_content\b)[\w-]+>|\[Request interrupted)/;

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => typeof value === 'object' && value !== null;

/** @param {unknown} value */
const textOf = (value) => (typeof value === 'string' ? value : '');

/** a message's content as written: the string itself, or its first text block @param {unknown} content */
const saidIn = (content) =>
    typeof content === 'string'
        ? content
        : textOf(
              (Array.isArray(content) ? content : [])
                  .filter(isRecord)
                  .find((block) => block.type === 'text')?.text,
          );

/**
 * the rows one transcript line draws: none for a line that is not drawn yet
 * @param {string} line
 * @returns {Row[]}
 */
function rowsOf(line) {
    if (!line.startsWith(CONVERSATION)) return [];
    /** @type {unknown} */
    let entry;
    try {
        entry = JSON.parse(line);
    } catch {
        return [];
    }
    if (!isRecord(entry)) return [];
    if (entry.isSidechain || entry.isMeta || entry.isCompactSummary) return [];
    const id = textOf(entry.uuid);
    if (!id) return [];
    const message = isRecord(entry.message) ? entry.message : {};
    const at = textOf(entry.timestamp) || null;
    /** @param {Row['kind']} kind @param {string} text @param {string} [rowId] @returns {Row} */
    const row = (kind, text, rowId = id) => ({
        at,
        delivery:
            kind === 'mine' && at
                ? { at, state: /** @type {const} */ ('read') }
                : null,
        id: rowId,
        isTurnStart: false,
        isWaiting: false,
        kind,
        replyId: kind === 'reply' ? textOf(message.id) || null : null,
        text,
        tools: kind === 'tool' ? [text] : [],
        version: 1,
    });
    if (entry.type === 'attachment') {
        // a prompt he sent while a turn ran: Claude Code writes it as a queued command, never as a user line; a
        // peer's message or a task notice queued the same way is not his
        const queued = isRecord(entry.attachment) ? entry.attachment : {};
        if (
            queued.type === 'queued_command' &&
            isRecord(queued.origin) &&
            queued.origin.kind === 'human'
        ) {
            const said = unwrapPastes(saidIn(queued.prompt));
            const command = textOf(queued.source_uuid);
            return said
                ? [
                      command && at
                          ? {
                                ...row('mine', said),
                                command,
                                delivery: { at, state: 'sent' },
                            }
                          : row('mine', said),
                  ]
                : [];
        }
        // words that joined a turn (the magic send) are his messages, one row each
        return joinedTexts(entry).map((text, n) =>
            row('mine', text, n ? `${id}#${n}` : id),
        );
    }
    const { content } = message;
    const blocks = (Array.isArray(content) ? content : []).filter(isRecord);
    if (entry.type === 'user') {
        // a paste's tags go after the check: a paste that opens with a tag of its own is still his
        const said = saidIn(content);
        return said.trim() && !NOT_HIS_WORDS.test(said)
            ? [{ ...row('mine', unwrapPastes(said)), isTurnStart: true }]
            : [];
    }
    if (entry.type !== 'assistant') return [];
    const [block] = blocks;
    if (block?.type === 'text' && textOf(block.text).trim())
        return [row('reply', textOf(block.text))];
    if (block?.type === 'tool_use' && textOf(block.name))
        return [row('tool', textOf(block.name))];
    return [];
}

/** one tool call by its name; a run of them counted by name, the most used first @param {string[]} tools */
function toolLine(tools) {
    const [only] = tools;
    if (tools.length === 1 && only) return only;
    /** @type {Map<string, number>} */
    const counts = new Map();
    for (const name of tools) counts.set(name, (counts.get(name) ?? 0) + 1);
    const byUse = [...counts].sort((a, b) => b[1] - a[1]);
    return `${tools.length} tool calls: ${byUse.map(([name, count]) => `${name} ${count}`).join(', ')}`;
}

/**
 * joins `lower` onto the row above it when both are one thing on screen: more text of the same reply, or tool calls
 * in a row. the upper row keeps its id and grows a version
 * @param {Row | undefined} upper
 * @param {Row} lower
 * @returns {boolean} whether it joined
 */
function join(upper, lower) {
    if (!upper || upper.kind !== lower.kind) return false;
    if (upper.kind === 'tool') {
        upper.tools.push(...lower.tools);
        upper.text = toolLine(upper.tools);
    } else if (
        upper.kind === 'reply' &&
        upper.replyId !== null &&
        upper.replyId === lower.replyId
    )
        upper.text = `${upper.text}\n\n${lower.text}`;
    else return false;
    upper.version += 1;
    return true;
}

export function createRowModel() {
    /** @type {Row[]} */
    const rows = [];
    /** the row each transcript line was folded into, by the line's uuid @type {Map<string, Row>} */
    const rowOfLine = new Map();
    /** Claude Code's queue, as its records in the transcript leave it @type {import('./queued.js').Queued[]} */
    let queue = [];
    /** the row of each message of his in the queue: the last rows, in queue order @type {Map<import('./queued.js').Queued, Row>} */
    let waiting = new Map();
    let waitingSerial = 0;
    /** when each queued command was taken, by the `commandUuid` its `remove` record names @type {Map<string, string>} */
    const takenAt = new Map();
    /** the row of each queued command loaded @type {Map<string, Row>} */
    const rowOfCommand = new Map();

    /** a `remove` record's read: kept for its row, which lands before it, and stamped on that row once it is loaded
     * @param {any} op @returns {Row | null} the row it stamped */
    function readBy(op) {
        const command = textOf(op?.commandUuid);
        const at = textOf(op?.timestamp);
        if (op?.operation !== 'remove' || !command || !at) return null;
        takenAt.set(command, at);
        const row = rowOfCommand.get(command);
        if (row?.delivery?.state !== 'sent') return null;
        row.delivery = { at, state: 'read' };
        row.version += 1;
        return row;
    }

    /**
     * @param {string[]} lines
     * @param {Row[]} into
     * @returns {Set<string>} the ids of the rows added or grown
     */
    function fold(lines, into) {
        /** @type {Set<string>} */
        const changed = new Set();
        for (const next of lines.flatMap(rowsOf)) {
            if (rowOfLine.has(next.id)) continue;
            const last = into.at(-1);
            if (last && join(last, next)) {
                rowOfLine.set(next.id, last);
                changed.add(last.id);
                continue;
            }
            rowOfLine.set(next.id, next);
            if (next.command) {
                rowOfCommand.set(next.command, next);
                const at = takenAt.get(next.command);
                if (at) next.delivery = { at, state: 'read' };
            }
            into.push(next);
            changed.add(next.id);
        }
        return changed;
    }

    return {
        /**
         * new lines, at the thread's end
         * @param {string[]} lines
         * @returns {{ changed: string[], removed: number }} the ids of the rows added or grown, and how many left
         */
        add(lines) {
            // the waiting rows step aside, so a line folds into the transcript's own last row
            rows.length -= waiting.size;
            /** @type {Set<string>} */
            const changed = new Set();
            for (const line of lines) {
                if (!line.startsWith(QUEUE_RECORD)) {
                    for (const id of fold([line], rows)) changed.add(id);
                    continue;
                }
                try {
                    const op = JSON.parse(line);
                    queue = claudeQueueAfter(queue, op);
                    const read = readBy(op);
                    if (read) changed.add(read.id);
                } catch {
                    // half a record: it never arrives whole, the reader hands over complete lines only
                }
            }
            const had = waiting;
            waiting = new Map();
            for (const queued of queue) {
                if (!isHisQueued(queued.text)) continue;
                let row = had.get(queued);
                if (!row) {
                    row = {
                        at: queued.at
                            ? new Date(queued.at).toISOString()
                            : null,
                        delivery: queued.at
                            ? {
                                  at: new Date(queued.at).toISOString(),
                                  state: 'sent',
                              }
                            : null,
                        id: `waiting-${++waitingSerial}`,
                        isTurnStart: false,
                        isWaiting: true,
                        kind: 'mine',
                        replyId: null,
                        text: unwrapPastes(queued.text),
                        tools: [],
                        version: 1,
                    };
                    changed.add(row.id);
                }
                waiting.set(queued, row);
            }
            rows.push(...waiting.values());
            const removed = [...had.keys()].filter(
                (queued) => !waiting.has(queued),
            ).length;
            return { changed: [...changed], removed };
        },
        /** a page from above what is loaded @param {string[]} lines */
        addEarlier(lines) {
            /** @type {Row[]} */
            const page = [];
            for (const line of lines)
                if (line.startsWith(QUEUE_RECORD))
                    try {
                        readBy(JSON.parse(line));
                    } catch {
                        // half a record at the page's top edge: the line above it was cut
                    }
            fold(lines, page);
            const last = page.at(-1);
            const [first] = rows;
            // a reply or a run of tool calls the page edge cut in two: the row already drawn keeps its id and takes
            // the upper part in
            if (last && first && last.kind === first.kind) {
                const lower = { ...first, tools: [...first.tools] };
                if (join(last, lower)) {
                    Object.assign(first, {
                        at: last.at,
                        id: last.id,
                        text: last.text,
                        tools: last.tools,
                        version: first.version + 1,
                    });
                    page.pop();
                    for (const [line, row] of rowOfLine)
                        if (row === last) rowOfLine.set(line, first);
                }
            }
            rows.unshift(...page);
            return { added: page.length };
        },
        clear() {
            rows.length = 0;
            rowOfLine.clear();
            queue = [];
            waiting = new Map();
            takenAt.clear();
            rowOfCommand.clear();
        },
        /** where the row holding the transcript line `id` sits, -1 when it is not loaded @param {string} id */
        indexOf(id) {
            const row = rowOfLine.get(id);
            return row ? rows.indexOf(row) : -1;
        },
        /** the thread's rows, oldest first; the same array and the same row objects across updates */
        rows: /** @type {readonly Row[]} */ (rows),
        /** when the newest turn started, in ms: his last prompt; null with none loaded */
        turnAt() {
            for (let i = rows.length - 1; i >= 0; i--) {
                const at = rows[i]?.isTurnStart ? rows[i]?.at : null;
                if (at) return Date.parse(at) || null;
            }
            return null;
        },
    };
}
