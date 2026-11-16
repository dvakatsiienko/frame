// the row model: transcript lines in, the thread's rows out. a row keeps its object for as long as it lives, and its
// `version` grows only when its own text does, so the list redraws and measures only the rows an update names.
// drawn so far: his messages, replies and one line per tool call; every other line waits for its own slice.

/**
 * @typedef {object} Row
 * @property {string} id the uuid of the row's first transcript line
 * @property {'mine' | 'reply' | 'tool'} kind
 * @property {string} text his words, the reply's markdown, or the tool's name
 * @property {string | null} at when its line was written, as the transcript stamps it
 * @property {number} version 1 at birth, one more each time the text changes
 * @property {string | null} replyId the reply's message id: more text of the same message joins this row
 */

// a conversation line opens with this key; api requests, snapshots and modes open with "type" and are never parsed
const CONVERSATION = '{"parentUuid"';
// a user line that is not his words: a command's echo or output, a task notice, an interruption note
const NOT_HIS_WORDS = /^\s*(?:<[\w-]+>|\[Request interrupted)/;

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => typeof value === 'object' && value !== null;

/** @param {unknown} value */
const textOf = (value) => (typeof value === 'string' ? value : '');

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
    const { message } = entry;
    if (!isRecord(message)) return [];
    if (entry.isSidechain || entry.isMeta || entry.isCompactSummary) return [];
    const id = textOf(entry.uuid);
    if (!id) return [];
    const { content } = message;
    const blocks = (Array.isArray(content) ? content : []).filter(isRecord);
    /** @param {Row['kind']} kind @param {string} text @returns {Row} */
    const row = (kind, text) => ({
        at: textOf(entry.timestamp) || null,
        id,
        kind,
        replyId: kind === 'reply' ? textOf(message.id) || null : null,
        text,
        version: 1,
    });
    if (entry.type === 'user') {
        const said =
            typeof content === 'string'
                ? content
                : textOf(blocks.find((block) => block.type === 'text')?.text);
        return said.trim() && !NOT_HIS_WORDS.test(said)
            ? [row('mine', said)]
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

/** whether `next` is more text of the reply `row` holds @param {Row | undefined} row @param {Row} next */
const continues = (row, next) =>
    row?.kind === 'reply' &&
    next.kind === 'reply' &&
    row.replyId !== null &&
    row.replyId === next.replyId;

export function createRowModel() {
    /** @type {Row[]} */
    const rows = [];
    /** @type {Set<string>} */
    const seen = new Set();

    /**
     * @param {string[]} lines
     * @param {Row[]} into
     * @returns {Set<string>} the ids of the rows added or grown
     */
    function fold(lines, into) {
        /** @type {Set<string>} */
        const changed = new Set();
        for (const next of lines.flatMap(rowsOf)) {
            if (seen.has(next.id)) continue;
            seen.add(next.id);
            const last = into.at(-1);
            if (last && continues(last, next)) {
                last.text = `${last.text}\n\n${next.text}`;
                last.version += 1;
                changed.add(last.id);
                continue;
            }
            into.push(next);
            changed.add(next.id);
        }
        return changed;
    }

    return {
        /** new lines, at the thread's end @param {string[]} lines */
        add(lines) {
            return { changed: [...fold(lines, rows)] };
        },
        /** a page from above what is loaded @param {string[]} lines */
        addEarlier(lines) {
            /** @type {Row[]} */
            const page = [];
            fold(lines, page);
            const last = page.at(-1);
            const [first] = rows;
            // a reply the page edge cut in two: its upper part joins the row already drawn
            if (last && first && continues(last, first)) {
                first.text = `${last.text}\n\n${first.text}`;
                first.version += 1;
                page.pop();
            }
            rows.unshift(...page);
            return { added: page.length };
        },
        clear() {
            rows.length = 0;
            seen.clear();
        },
        /** the thread's rows, oldest first; the same array and the same row objects across updates */
        rows: /** @type {readonly Row[]} */ (rows),
    };
}
