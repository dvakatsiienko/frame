// the markdown each row hands its text views, in order: the rows draw from here and find places its marks here, so a hit
// is always in what he reads

import { splitBlocks } from './blocks.js';
import { unlinkFiles } from './files.js';
import { isCardRow } from './tool-folds.js';
import { typedMarkdown } from './typed.js';

/** @typedef {import('./blocks.js').Block} Block */
/** @typedef {import('./row-model.js').Row} Row */

/** a reply's blocks, unfolded @param {Row} row */
export const replyBlocks = (row) => splitBlocks(unlinkFiles(row.text));

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
