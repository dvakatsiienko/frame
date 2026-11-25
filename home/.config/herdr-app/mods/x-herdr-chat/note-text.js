// the one line a thread gets of a note: the words he selected, cut short, which message they stand in, and his note
// whole. nothing around them: the line is read again on every later turn, and the message's id finds the rest

import { clockOf } from './relay.js';

/** @typedef {import('./row-model.js').Row} Row */

// a quote in the line ends here, at a word
export const QUOTE_CUT = 80;

/** the words he selected as one line, one part a text view @param {readonly string[]} parts */
const oneLine = (parts) =>
    parts
        .map((part) => part.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' … ');

/** the quote as the thread gets it @param {readonly string[]} parts the words as drawn, by text view */
export function quoteOf(parts) {
    const words = oneLine(parts);
    if (words.length <= QUOTE_CUT) return words;
    const cut = words.slice(0, QUOTE_CUT + 1);
    const end = cut.lastIndexOf(' ');
    // one word longer than the cut is cut inside, never between the two halves of one character
    const kept = end > 0 ? cut.slice(0, end) : cut.slice(0, QUOTE_CUT);
    return `${kept.replace(/[\uD800-\uDBFF]$/, '').replace(/ …$/, '')}…`;
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
 * @param {Pick<Row, 'id' | 'kind' | 'at'>} note.row the message they stand in
 * @param {number} note.back the replies below it
 * @param {string} note.text his note
 */
export function noteLine({ parts, row, back, text }) {
    const which = [
        `${row.kind === 'mine' ? 'message' : 'reply'} ${shortId(row.id)}`,
        clockOf(row.at),
    ]
        .filter(Boolean)
        .join(' ');
    return `dima on "${quoteOf(parts)}" (${which}${back ? `, ${back} back` : ''}): ${text.trim()}`;
}
