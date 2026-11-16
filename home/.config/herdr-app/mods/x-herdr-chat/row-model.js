// the row model: transcript lines in, the thread's rows out. a row keeps its object for as long as it lives, and its
// `version` grows only when its own text does, so the list redraws and measures only the rows an update names.
// drawn so far: his messages, replies and one line per tool call; every other line waits for its own slice.

/**
 * @typedef {object} Row
 * @property {string} id the uuid of the row's first transcript line
 * @property {'mine' | 'reply' | 'tool'} kind
 * @property {string} text his words, the reply's markdown, or the line naming a run of tool calls
 * @property {string | null} at when its line was written, as the transcript stamps it
 * @property {number} version 1 at birth, one more each time the text changes
 * @property {string | null} replyId the reply's message id: more text of the same message joins this row
 * @property {string[]} tools the names of the tool calls a tool row folds, in order
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
        tools: kind === 'tool' ? [text] : [],
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
            if (last && join(last, next)) {
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
            // a reply or a run of tool calls the page edge cut in two: the row already drawn keeps its id and takes
            // the upper part in
            if (last && first && last.kind === first.kind) {
                const lower = { ...first, tools: [...first.tools] };
                if (join(last, lower)) {
                    Object.assign(first, {
                        text: last.text,
                        tools: last.tools,
                        version: first.version + 1,
                    });
                    page.pop();
                }
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
