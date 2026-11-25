// the markdown each row hands its text views, in order: the rows draw from here and find places its marks here, so a hit
// is always in what he reads

import { splitBlocks } from './blocks.js';
import { linkPaths } from './path-links.js';
import { isCardRow } from './tool-folds.js';
import { typedMarkdown } from './typed.js';

/** @typedef {import('./blocks.js').Block} Block */
/** @typedef {import('./row-model.js').Row} Row */

// a reply's blocks by its row, for the text and links they were cut from: each draw of a row asks for them several times
/** @type {WeakMap<Row, { blocks: Block[], links?: string[], text: string }>} */
const cut = new WeakMap();

/** a reply's blocks, unfolded @param {Row} row */
export function replyBlocks(row) {
    const had = cut.get(row);
    if (had?.text === row.text && had.links === row.links) return had.blocks;
    const blocks = splitBlocks(row.text).map((block) =>
        block.kind === 'text'
            ? { ...block, text: linkPaths(block.text, row.links ?? []) }
            : block,
    );
    cut.set(row, { blocks, links: row.links, text: row.text });
    return blocks;
}

/** a block as one text view's markdown: code goes back into its fence @param {Block} block */
export const blockSource = (block) =>
    block.kind === 'text'
        ? block.text
        : `\`\`\`${block.lang}\n${block.text}\n\`\`\``;

/** an open tool call's input as it draws @param {Row} row */
const cardSource = (row) =>
    `\`\`\`json\n${row.calls?.[0]?.input ?? ''}\n\`\`\``;

/** every text view of a row, unfolded: none for a row drawn as plain labels (a tool line, a file) @param {Row} row @returns {string[]} */
export function drawnBlocks(row) {
    if (row.kind === 'mine') return [typedMarkdown(row.text)];
    if (row.kind === 'reply') return replyBlocks(row).map(blockSource);
    return row.kind === 'tool' && isCardRow(row.id) ? [cardSource(row)] : [];
}
