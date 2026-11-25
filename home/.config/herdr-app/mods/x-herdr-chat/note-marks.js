// where the words of each note stand in its message as drawn now: a reply that grew or took an earlier page's text still
// shows them, words that are gone or could be either of two places show none and the note stays

import { isLocked } from './note-states.js';

/** @typedef {import('./note-states.js').Note} Note */
/** @typedef {import('./note-states.js').Part} Part */
/** @typedef {{ block: number, start: number, end: number }} PartRange a range of one text view's markdown */
/** @typedef {PartRange & { id: string, isStrong: boolean }} NoteMark `isStrong`: a note the thread has not got */

/** @param {Part} part @param {readonly string[]} sources the markdown of each text view of the row @returns {PartRange | null} */
function partRange(part, sources) {
    const cut = part.range
        ? part.source.slice(part.range.start, part.range.end)
        : part.words;
    const words = cut.trim();
    if (!words) return null;
    // herdr's words are trimmed, its range is not
    const start = part.range
        ? part.range.start + (cut.length - cut.trimStart().length)
        : -1;
    if (start >= 0 && sources[part.block]?.startsWith(words, start))
        return { block: part.block, end: start + words.length, start };
    const found = sources.flatMap((source, block) => {
        /** @type {PartRange[]} */
        const at = [];
        for (
            let from = source.indexOf(words);
            from >= 0;
            from = source.indexOf(words, from + 1)
        )
            at.push({ block, end: from + words.length, start: from });
        return at;
    });
    return found.length === 1 ? (found[0] ?? null) : null;
}

/**
 * the marks of a row's notes, the quieter first, so a stronger one paints over it
 * @param {readonly Note[]} notes @param {readonly string[]} sources the markdown of each text view of the row
 * @returns {NoteMark[]}
 */
export const noteMarks = (notes, sources) =>
    notes
        .flatMap((note) =>
            note.passage.parts.flatMap((part) => {
                const range = partRange(part, sources);
                return range
                    ? [{ ...range, id: note.id, isStrong: !isLocked(note) }]
                    : [];
            }),
        )
        .sort((a, b) => Number(a.isStrong) - Number(b.isStrong));
