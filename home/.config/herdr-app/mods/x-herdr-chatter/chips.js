// inline code typed into the box becomes one monospace chip (a Textarea token): the closing backtick makes it, the token's
// text keeps the backticks, so a sent message reads as typed. three backticks open a fence and make no chip

/** @typedef {{ start: number, end: number }} Range */

/**
 * the closed `code` spans in the box that are not chips yet, outside any open fence
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
