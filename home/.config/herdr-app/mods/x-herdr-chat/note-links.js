// the words of his notes drawn as links, `[words](note:<id>)`, so a click on them opens the note (FRM-585 B5): herdr hands
// a mod no word under a press, only a link's click, and follows one only with nothing selected, so a drag or a double
// click on the words selects as before. the text view draws the linked markdown; every offset the rest of the chat
// holds (a mark, a find hit, a selection he reports) stands in the markdown as written, and goes through `at` or `back`.
// where no link can be (a code block, a code span, a link, a table row, a line break, an emphasis cut in two, a block's
// own start) the mark stays and the note's row is its door

/** @typedef {{ start: number, end: number }} Range */
/** @typedef {{ start: number, end: number, id: string }} NoteSpan one note's words in one text view's markdown */

const NOTE_LINK = /^note:(.+)$/;
// a code span, a link (its url may hold one pair of brackets), a reference link or an autolink: no link goes inside
// or across one
const HELD =
    /`[^`\n]*`|!?\[[^\]\n]*\]\((?:[^()\n]|\([^()\n]*\))*\)|!?\[[^\]\n]*\]\[[^\]\n]*\]|<[^>\s]+>/g;
// words a link would break: a line break, a table's edge, brackets, a backslash, or an emphasis run cut in two
const BREAKS = /[\n|[\]`\\*~]|(?:^|\W)_|_(?:\W|$)/;
// a block's own start: a heading, a list item, a quote
const BLOCK_START = /^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>)/;

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
    for (const span of [...spans].reverse()) {
        const words = source.slice(span.start, span.end);
        const line = source.slice(
            source.lastIndexOf('\n', span.start - 1) + 1,
            span.start,
        );
        const isFree =
            !isCode &&
            words.trim() !== '' &&
            !BREAKS.test(words) &&
            !BLOCK_START.test(line.trimStart() === '' ? words : '') &&
            !line.trimStart().startsWith('|') &&
            !held.some((h) => h.start < span.end && span.start < h.end) &&
            !kept.some((k) => k.start < span.end && span.start < k.end);
        if (isFree) kept.push(span);
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
