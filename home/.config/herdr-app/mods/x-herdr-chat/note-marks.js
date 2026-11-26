// where the words of each note stand in its message as drawn now: a reply that grew or took an earlier page's text still
// shows them, words that are gone or could be either of two places show none and the note stays

import { isLocked } from './note-states.js';
import { withoutPathLinks } from './path-links.js';

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
    if (start >= 0 && sources[part.block]?.startsWith(part.source))
        return { block: part.block, end: start + words.length, start };
    const found = foundIn(sources, words);
    if (found.length) return found.length === 1 ? (found[0] ?? null) : null;
    // a path in the words may be a link by now: found in the words as drawn, painted over the link's markup too
    const plain = foundIn(
        sources.map((source) => withoutPathLinks(source, null).source),
        words,
    );
    const only = plain.length === 1 ? plain[0] : null;
    return only ? linkedRange(only, sources[only.block] ?? '') : null;
}

/** every place the words stand, by text view @param {readonly string[]} sources @param {string} words @returns {PartRange[]} */
const foundIn = (sources, words) =>
    sources.flatMap((source, block) => {
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

/** a range of the words as drawn, in the markdown with its path links @param {PartRange} range @param {string} source */
function linkedRange(range, source) {
    /** the first offset of the markdown that stands at or past a drawn one @param {number} drawn */
    const at = (drawn) => {
        let low = 0;
        let high = source.length;
        while (low < high) {
            const mid = (low + high) >> 1;
            const moved =
                withoutPathLinks(source, { end: mid, start: mid }).range
                    ?.start ?? mid;
            if (moved < drawn) low = mid + 1;
            else high = mid;
        }
        return low;
    };
    return { block: range.block, end: at(range.end), start: at(range.start) };
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
