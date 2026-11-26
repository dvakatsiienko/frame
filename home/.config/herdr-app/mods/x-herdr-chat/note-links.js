// the words of his notes drawn as links, `[words](note:<id>)`, so a click on them opens the note (FRM-585 B5): herdr hands
// a mod no word under a press, only a link's click, and follows one only with nothing selected, so a drag or a double
// click on the words selects as before. the text view draws the linked markdown; every offset the rest of the chat
// holds (a mark, a find hit, a selection he reports) stands in the markdown as written, and goes through `at` or `back`.
// words across bold, code marks or a line break are linked run by run; where no link can be at all (a code block, a code
// span, a link, a table row) the mark stays and the note's row is its door

/** @typedef {{ start: number, end: number }} Range */
/** @typedef {{ start: number, end: number, id: string }} NoteSpan one note's words in one text view's markdown */

const NOTE_LINK = /^note:(.+)$/;
// a code span, a link (its url may hold one pair of brackets), a reference link or an autolink: no link goes inside
// or across one
const HELD =
    /`[^`\n]*`|!?\[[^\]\n]*\]\((?:[^()\n]|\([^()\n]*\))*\)|!?\[[^\]\n]*\]\[[^\]\n]*\]|<[^>\s]+>/g;
// a character no link may hold: a line break, a table's edge, brackets, a backslash, emphasis and code marks
const PIECE_BREAK = /[\n|[\]`\\*~]/;
// a block's own start: a heading, a list item, a quote
const BLOCK_START = /^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>)/;

/**
 * a note's words as the runs a link can sit on: cut at markup, a line break or a table's edge, each run trimmed, a block
 * marker at a line's start left out, so words across bold or two lines still open their note (dima, 26 Nov 16:23)
 * @param {string} source @param {NoteSpan} span @returns {NoteSpan[]}
 */
function piecesOf(source, span) {
    /** @type {NoteSpan[]} */
    const pieces = [];
    let start = span.start;
    const close = (/** @type {number} */ end) => {
        let from = start;
        const lineStart = source.lastIndexOf('\n', from - 1) + 1;
        if (source.slice(lineStart, from).trim() === '') {
            const marker = BLOCK_START.exec(source.slice(from, end));
            if (marker) from += marker[0].length;
        }
        while (from < end && /\s/.test(source[from] ?? '')) from += 1;
        let to = end;
        while (to > from && /\s/.test(source[to - 1] ?? '')) to -= 1;
        if (to > from) pieces.push({ end: to, id: span.id, start: from });
    };
    for (let i = span.start; i < span.end; i += 1)
        if (
            PIECE_BREAK.test(source[i] ?? '') ||
            // an underscore inside a word is the word's own
            (source[i] === '_' &&
                !(
                    /\w/.test(source[i - 1] ?? '') &&
                    /\w/.test(source[i + 1] ?? '')
                ))
        ) {
            close(i);
            start = i + 1;
        }
    close(span.end);
    return pieces;
}

/** the note a link of `linkNotes` opens, null for any other url @param {string} url */
export const noteOfUrl = (url) => NOTE_LINK.exec(url)?.[1] ?? null;

/**
 * a text view's markdown with each note's words a link; of two that overlap, the later in `spans` wins
 * @param {string} source @param {readonly NoteSpan[]} spans
 * @returns {{ source: string, at: (offset: number) => number, back: (range: Range) => Range }}
 */
export function linkNotes(source, spans) {
    const held = [...source.matchAll(HELD)].map((m) => ({
        end: m.index + m[0].length,
        start: m.index,
    }));
    const isCode = /^\s*(`{3,}|~{3,})/.test(source);
    /** @type {NoteSpan[]} */
    const kept = [];
    for (const span of [...spans].reverse())
        for (const piece of piecesOf(source, span)) {
            const line = source.slice(
                source.lastIndexOf('\n', piece.start - 1) + 1,
                piece.start,
            );
            const isFree =
                !isCode &&
                !line.trimStart().startsWith('|') &&
                !held.some((h) => h.start < piece.end && piece.start < h.end) &&
                !kept.some((k) => k.start < piece.end && piece.start < k.end);
            if (isFree) kept.push(piece);
        }
    kept.sort((a, b) => a.start - b.start);
    /** what each link adds: its `[` before the words, its `](note:<id>)` after @type {{ at: number, size: number }[]} */
    const adds = kept.flatMap((span) => [
        { at: span.start, size: 1 },
        { at: span.end, size: `](note:${span.id})`.length },
    ]);
    let linked = '';
    let from = 0;
    for (const span of kept) {
        linked += `${source.slice(from, span.start)}[${source.slice(span.start, span.end)}](note:${span.id})`;
        from = span.end;
    }
    linked += source.slice(from);
    /** a written offset in the linked markdown: one at a link's start stands on its words @param {number} offset */
    const at = (offset) =>
        adds.reduce(
            (to, add, i) =>
                // a `[` counts for the words after it, a `](…)` for the words before it ends
                to +
                (i % 2 === 0
                    ? add.at <= offset
                        ? add.size
                        : 0
                    : add.at < offset
                      ? add.size
                      : 0),
            offset,
        );
    /** a linked offset in the markdown as written @param {number} offset */
    const written = (offset) => {
        let to = offset;
        let shift = 0;
        for (const add of adds) {
            const start = add.at + shift;
            if (offset <= start) break;
            to -= Math.min(offset - start, add.size);
            shift += add.size;
        }
        return to;
    };
    return {
        at,
        back: (range) => ({
            end: written(range.end),
            start: written(range.start),
        }),
        source: linked,
    };
}
