// inline code typed into the quill becomes one monospace chip (a Textarea token): the closing backtick makes it, the token's
// text keeps the backticks, so a sent message reads as typed. three backticks open a fence and make no chip

/** @typedef {{ start: number, end: number }} Range */

/**
 * the closed `code` spans in the quill that are not chips yet, outside any open fence
 * @param {string} text
 * @param {Range[]} taken the ranges already tokens
 * @returns {Range[]}
 */
export function codeSpans(text, taken) {
    /** @type {Range[]} */
    const spans = [];
    const span = /(?<!`)`([^`\n]+)`(?!`)/g;
    for (const m of text.matchAll(span)) {
        const start = m.index ?? 0;
        const end = start + m[0].length;
        const fences = text.slice(0, start).split('```').length - 1;
        if (fences % 2 === 1) continue;
        if (taken.some((r) => r.start < end && start < r.end)) continue;
        spans.push({ end, start });
    }
    return spans;
}

/**
 * each span becomes a chip, the last first so the earlier offsets hold; herdr leaves the caret after the token it put
 * in, so a paste's caret goes back to where the paste ended
 * @param {{ replace_range_with_token: (r: Range, t: { id: string, label: string, text: string }) => void, set_selected_range: (r: Range) => void }} box
 * @param {string} text
 * @param {Range[]} spans
 * @param {number} caret
 */
export function applyChips(box, text, spans, caret) {
    for (const r of [...spans].reverse())
        box.replace_range_with_token(r, {
            id: `code-${r.start}-${Date.now()}`,
            label: text.slice(r.start + 1, r.end - 1),
            text: text.slice(r.start, r.end),
        });
    if (spans.length) box.set_selected_range({ end: caret, start: caret });
}
