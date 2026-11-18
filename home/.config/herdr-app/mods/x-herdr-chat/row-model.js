// the row model: transcript lines in, the thread's rows out. a row keeps its object for as long as it lives, and its
// `version` grows only when what it draws does (its text, its read time), so the list redraws and measures only the
// rows an update names.
// drawn so far: his messages, replies and one line per tool call; every other line waits for its own slice.
// a message he sent while the thread works waits in Claude Code's queue: it is his last row, waiting, until a turn
// takes it and its own transcript line replaces it: a user line at a turn's start, a queued command mid-turn.

import { isImagePath } from './attach.js';
import { joinedTexts } from './joins.js';
import {
    asTyped,
    claudeQueueAfter,
    isHisQueued,
    unwrapPastes,
} from './queued.js';

/**
 * @typedef {object} Row
 * @property {string} id the uuid of the row's first transcript line
 * @property {'mine' | 'reply' | 'tool' | 'file' | 'start'} kind `file`: a file a reply names, drawn under it (files.js);
 *   `start`: the quiet row over a thread read back to its first line
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
 * @property {Picture[]} pictures the pictures his message sent, drawn under his words (FRM-638 slice 5)
 * @property {string[]} files the other files his message sent, by path
 * @property {Call[]} [calls] a tool row's calls, in order (PK-432)
 */

/**
 * one tool call as its row shows it: the name, the argument that says what it did, and its whole input to peek
 * @typedef {{ name: string, arg: string, input: string }} Call
 */

// the input keys that say what a call did, the first one present wins
const ARG_KEYS = [
    'file_path',
    'command',
    'pattern',
    'path',
    'url',
    'description',
    'query',
    'prompt',
    'skill',
];
// a peek shows this much of a call's input: a Write's whole file never lays out
const INPUT_PEEK = 4000;

/** @param {string} name @param {unknown} input @returns {Call} */
export function callOf(name, input) {
    const fields = isRecord(input) ? input : {};
    const key =
        ARG_KEYS.find((k) => typeof fields[k] === 'string' && fields[k]) ??
        Object.keys(fields).find((k) => typeof fields[k] === 'string');
    const arg = key ? (String(fields[key]).split('\n')[0] ?? '') : '';
    const whole = JSON.stringify(fields, null, 2);
    return {
        arg,
        input:
            whole.length > INPUT_PEEK
                ? `${whole.slice(0, INPUT_PEEK)}\n…`
                : whole,
        name,
    };
}

/**
 * a picture his message sent: Claude Code keeps a pasted or dropped one inline as its bytes, a join names it by path
 * @typedef {object} Picture
 * @property {string} id the row's id and the picture's place in it
 * @property {string | null} path
 * @property {string | null} data base64
 * @property {string | null} media its type, `image/png`
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
// a pushed command's enqueue lands within a second of its send (clio's transcript, 2026-11-18: 0.5 s); the clocks may
// differ a little the other way
const PUSH_TAKE_MS = 5000;
const PUSH_SLACK_MS = 1000;
// a user line that is not his words: a command's echo or output, a task notice, an interruption note
const HC_SENT = /^<hc from="(?:\S+ )?([^"]*)">([\s\S]*)<\/hc>$/;
const NOT_HIS_WORDS =
    /^\s*(?:<(?!pasted_content\b)[\w-]+>|\[Request interrupted)/;

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => typeof value === 'object' && value !== null;

// a file sent as its path: a line of its own after his words, escaped as a terminal drop types it
// two slashes and an extension at least: a slash command («/cmt») or a tool's path («/usr/local/bin/tool») he
// typed is his words, never a file
const PATH_LINE = /^\/(?:\\.|[^\\\s])*\/(?:\\.|[^\\\s])+\.\w+$/;
// where Claude Code puts a picture it took inline from a path or a paste
const IMAGE_TOKEN = /\[Image #\d+\]\s*/g;

/**
 * his words without what Claude Code and the quill add for files: the trailing path lines, read back as paths, and the
 * picture tokens
 * @param {string} said @returns {{ text: string, paths: string[] }}
 */
export function wordsAndPaths(said) {
    const lines = said.split('\n');
    /** @type {string[]} */
    const paths = [];
    for (
        let last = lines.at(-1)?.trim();
        last && PATH_LINE.test(last);
        last = lines.at(-1)?.trim()
    ) {
        paths.unshift(last.replace(/\\(.)/g, '$1'));
        lines.pop();
    }
    return { paths, text: lines.join('\n').trim() };
}

/**
 * a message's words and what it sent: inline pictures first, then each path, a picture's or any other file's
 * @param {string} said @param {unknown} content @param {string} rowId
 * @returns {{ text: string, files: string[], pictures: Picture[] }}
 */
function messageOf(said, content, rowId) {
    const { paths, text: words } = wordsAndPaths(said);
    const inline = inlinePictures(content);
    // the tokens go only where Claude Code put pictures, or the message still waits in its queue with its tokens
    const text =
        inline.length || content === null
            ? words.replace(IMAGE_TOKEN, '').trim()
            : words;
    const pictures = [
        ...inline.map(({ data, media }) => ({
            data,
            media,
            path: null,
        })),
        ...paths
            .filter(isImagePath)
            .map((path) => ({ data: null, media: null, path })),
    ].map((picture, n) => ({ ...picture, id: `${rowId}-${n}` }));
    return { files: paths.filter((p) => !isImagePath(p)), pictures, text };
}

/** a message's inline pictures @param {unknown} content @returns {{ data: string, media: string }[]} */
const inlinePictures = (content) =>
    (Array.isArray(content) ? content : [])
        .filter(isRecord)
        .filter((block) => block.type === 'image' && isRecord(block.source))
        .map((block) => /** @type {Record<string, unknown>} */ (block.source))
        .filter((source) => source.type === 'base64' && textOf(source.data))
        .map((source) => ({
            data: textOf(source.data),
            media: textOf(source.media_type) || 'image/png',
        }));

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
        files: [],
        id: rowId,
        isTurnStart: false,
        isWaiting: false,
        kind,
        pictures: [],
        replyId: kind === 'reply' ? textOf(message.id) || null : null,
        text,
        tools: kind === 'tool' ? [text] : [],
        version: 1,
    });
    /**
     * his message: its words, and the files it sent after them, inline or by path
     * @param {string} said @param {unknown} content @param {string} [rowId] @returns {Row}
     */
    const his = (said, content, rowId = id) => {
        const { files, pictures, text } = messageOf(said, content, rowId);
        return { ...row('mine', text, rowId), files, pictures };
    };
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
                                ...his(said, queued.prompt),
                                command,
                                delivery: { at, state: 'sent' },
                            }
                          : his(said, queued.prompt),
                  ]
                : [];
        }
        // words that joined a turn (the magic send) are his messages, one row each
        return joinedTexts(entry).map((text, n) =>
            his(text, null, n ? `${id}#${n}` : id),
        );
    }
    const { content } = message;
    const blocks = (Array.isArray(content) ? content : []).filter(isRecord);
    if (entry.type === 'user') {
        // a prompt a plugin submitted in his place, or a command it ran for him: Claude Code names who sent it
        if (isRecord(entry.origin) && entry.origin.kind !== 'human') return [];
        // a paste's tags go after the check: a paste that opens with a tag of its own is still his
        const said = asTyped(saidIn(content));
        // a message another terminal typed in with `hc send`: its words, under who sent it, never the wrapper
        const sent = HC_SENT.exec(said.trim());
        if (sent)
            return [
                {
                    ...his(
                        `↪ ${sent[1] || 'another terminal'}: ${(sent[2] ?? '').trim()}`,
                        content,
                    ),
                    isTurnStart: true,
                },
            ];
        return said.trim() && !NOT_HIS_WORDS.test(said)
            ? [{ ...his(unwrapPastes(said), content), isTurnStart: true }]
            : [];
    }
    if (entry.type !== 'assistant') return [];
    const [block] = blocks;
    if (block?.type === 'text' && textOf(block.text).trim())
        return [row('reply', textOf(block.text))];
    if (block?.type === 'tool_use' && textOf(block.name))
        return [
            {
                ...row('tool', textOf(block.name)),
                calls: [callOf(textOf(block.name), block.input)],
            },
        ];
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
        upper.calls = [...(upper.calls ?? []), ...(lower.calls ?? [])];
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
    /** the slash commands this chat typed in: Claude Code queues one with no text @type {{ text: string, at: number }[]} */
    let pushes = [];

    /** a command that ran at once was never queued: its push goes, so no later textless enqueue takes its words
     * @param {string} line */
    function dropRanPush(line) {
        if (!pushes.length || !line.includes('<command-name>')) return;
        try {
            const said = asTyped(saidIn(JSON.parse(line)?.message?.content));
            pushes = pushes.filter((p) => p.text.trim() !== said);
        } catch {
            // half a line never reaches here: the reader hands over whole lines
        }
    }

    /** the command a textless enqueue at `at` holds, or no text: a peer's message is queued the same way @param {number} at */
    function takePushed(at) {
        const i = pushes.findIndex(
            (p) => at >= p.at - PUSH_SLACK_MS && at - p.at <= PUSH_TAKE_MS,
        );
        if (i < 0) return undefined;
        const [push] = pushes.splice(i, 1);
        return push?.text;
    }

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
                    dropRanPush(line);
                    for (const id of fold([line], rows)) changed.add(id);
                    continue;
                }
                try {
                    const op = JSON.parse(line);
                    if (
                        op.operation === 'enqueue' &&
                        typeof op.content !== 'string'
                    )
                        op.content = takePushed(Date.parse(op.timestamp));
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
                    const rowId = `waiting-${++waitingSerial}`;
                    const said = messageOf(
                        unwrapPastes(queued.text),
                        null,
                        rowId,
                    );
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
                        files: said.files,
                        id: rowId,
                        isTurnStart: false,
                        isWaiting: true,
                        kind: 'mine',
                        pictures: said.pictures,
                        replyId: null,
                        text: said.text,
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
                        calls: last.calls,
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
            pushes = [];
        },
        /** where the row holding the transcript line `id` sits, -1 when it is not loaded @param {string} id */
        indexOf(id) {
            const row = rowOfLine.get(id);
            return row ? rows.indexOf(row) : -1;
        },
        /** a slash command typed into the thread, matched to the textless enqueue that follows it @param {string} text @param {number} at */
        pushed(text, at) {
            pushes = [
                ...pushes.filter((p) => at - p.at <= PUSH_TAKE_MS),
                { at, text },
            ];
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
