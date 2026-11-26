// the one line a thread gets of a note: the words he selected, cut short, the sentence they sit in, which message they
// stand in, and his note whole; a message 20 or more back is named by its first words too (dima, 26 Nov, FRM-585:W72).
// the line is read again on every later turn, so it stays short, and the message's id finds the rest

import { clockOf } from './relay.js';

/** @typedef {import('./row-model.js').Row} Row */

// a quote drawn in the chat ends here, at a word
export const QUOTE_CUT = 80;
// the words in the line a thread gets end here: it reads which words he meant whole (clio's probe of W72, 26 Nov 16:10)
export const LINE_QUOTE_CUT = 160;
// the sentence around the words, cut to about this many characters around them
export const SENTENCE_CUT = 160;
// a message this many replies back is named by its first words too
export const HEAD_BACK = 20;
const HEAD_WORDS = 8;
// where a sentence ends: a stop before a capital or the end, or a line break; «e.g. a» goes on
const SENTENCE_END = /[.!?](?=\s+\p{Lu}|\s*$)|\n/gu;
// markdown he never reads: a link's address, code ticks, emphasis marks
const MARKUP = [
    [/!?\[([^\]\n]*)\]\([^)\n]*\)/g, '$1'],
    [/`+/g, ''],
    [/\*\*|__|~~/g, ''],
    [/(^|[^\p{L}\p{N}])[*_](?=\S)|(?<=\S)[*_](?=[^\p{L}\p{N}]|$)/gu, '$1'],
];

/** markdown as he reads it @param {string} text */
const plainOf = (text) =>
    MARKUP.reduce(
        (out, [pattern, to]) =>
            out.replace(
                /** @type {RegExp} */ (pattern),
                /** @type {string} */ (to),
            ),
        text,
    );

/** the words he selected as one line, one part a text view @param {readonly string[]} parts */
const oneLine = (parts) =>
    parts
        .map((part) => part.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' … ');

/** the quote, cut at a word @param {readonly string[]} parts the words as drawn, by text view @param {number} [most] */
export function quoteOf(parts, most = QUOTE_CUT) {
    const words = oneLine(parts);
    if (words.length <= most) return words;
    const cut = words.slice(0, most + 1);
    const end = cut.lastIndexOf(' ');
    // one word longer than the cut is cut inside, never between the two halves of one character
    const kept = end > 0 ? cut.slice(0, end) : cut.slice(0, most);
    return `${kept.replace(/[\uD800-\uDBFF]$/, '').replace(/ …$/, '')}…`;
}

/** text on one line, its spaces single @param {string} text */
const flat = (text) => text.replace(/\s+/g, ' ').trim();

/**
 * the sentence the words sit in, cut to about 160 characters around them; null when it is only the words
 * @param {{ source: string, range: { start: number, end: number } | null, words: string }} part
 */
export function sentenceOf({ source, range, words }) {
    if (!range) return null;
    let from = 0;
    let to = source.length;
    for (const end of source.matchAll(SENTENCE_END)) {
        const after = end.index + end[0].length;
        if (after <= range.start) from = after;
        else if (end.index >= range.end) {
            to = after;
            break;
        }
    }
    // the sentence as he reads it: its markdown gone, his words as drawn
    const one = (/** @type {string} */ text) =>
        plainOf(text).replace(/\s+/g, ' ');
    const before = one(source.slice(from, range.start)).trimStart();
    const middle = words.replace(/\s+/g, ' ');
    const after = one(source.slice(range.end, to)).trimEnd();
    const room = SENTENCE_CUT - middle.length;
    // words that long are cut in the quote already: no room for what is around them
    if (room <= 0) return null;
    const takeAfter = Math.min(
        after.length,
        Math.max(Math.floor(room / 2), room - before.length),
    );
    const takeBefore = Math.min(before.length, room - takeAfter);
    const isCutBefore = takeBefore < before.length;
    const isCutAfter = takeAfter < after.length;
    // a cut side ends at a word
    const kept = [
        isCutBefore
            ? `…${before.slice(before.length - takeBefore).replace(/^\S*\s?/, '')}`
            : before,
        middle,
        isCutAfter
            ? `${after.slice(0, takeAfter).replace(/\s?\S*$/, '')}…`
            : after,
    ].join('');
    const sentence = kept.trim();
    return flat(sentence) === flat(words) ? null : sentence;
}

/** a message's first words, as the line names one far back @param {string} text */
export function headOf(text) {
    const words = flat(text).split(' ');
    const head = words.slice(0, HEAD_WORDS).join(' ');
    return words.length > HEAD_WORDS ? `${head}…` : head;
}

/** a message's id in its line: the first 8 of its uuid, a joined row's `#n` with it @param {string} id */
export const shortId = (id) => id.slice(0, 8);

/** how many replies stand below a message @param {readonly Pick<Row, 'id' | 'kind'>[]} rows @param {string} id */
export function repliesBelow(rows, id) {
    const at = rows.findIndex((row) => row.id === id);
    return at < 0
        ? 0
        : rows.slice(at + 1).filter((row) => row.kind === 'reply').length;
}

/**
 * @param {object} note
 * @param {readonly string[]} note.parts the words he selected, by text view
 * @param {string | null} [note.sentence] the sentence they sit in, null when it is only the words
 * @param {Pick<Row, 'id' | 'kind' | 'at'> & { head?: string }} note.row the message they stand in, `head` its first words
 * @param {number} note.back the replies below it
 * @param {string} note.text his note
 */
export function noteLine({ parts, sentence = null, row, back, text }) {
    const which = [
        `${row.kind === 'mine' ? 'message' : 'reply'} ${shortId(row.id)}`,
        clockOf(row.at),
    ]
        .filter(Boolean)
        .join(' ');
    const far = back >= HEAD_BACK && row.head ? `, «${row.head}»` : '';
    const inSentence = sentence ? ` in "${sentence}"` : '';
    return `dima on "${quoteOf(parts, LINE_QUOTE_CUT)}"${inSentence} (${which}${back ? `, ${back} back` : ''}${far}): ${text.trim()}`;
}
