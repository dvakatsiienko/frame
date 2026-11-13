// A long reply folds to its first lines with «Show more» under it, and only those lines are laid out: a reply drawn
// whole under a clip costs its full layout on every frame (after shepherdr's chat, MIT, mods/chat/main.js foldOf).
// Lines are estimated from the words and the bubble's width, never measured: the fold decides what gets measured.

/** @typedef {import('./blocks.js').Block} Block */

// a reply past this many lines folds, to its first FOLD_SHOWN
export const FOLD_TALL = 40;
export const FOLD_SHOWN = 24;
// a code block's head row, in lines
const HEAD_LINES = 2;

/** about how many lines `text` wraps to at `perLine` characters a line @param {string} text @param {number} perLine */
export const wrapLines = (text, perLine) =>
    text
        .split('\n')
        .reduce(
            (n, l) =>
                n + Math.max(1, Math.ceil(l.length / Math.max(20, perLine))),
            0,
        );

/** @param {Block} b @param {number} perLine */
const linesOf = (b, perLine) =>
    b.kind === 'code'
        ? HEAD_LINES + b.text.split('\n').length
        : wrapLines(b.text, perLine);

/**
 * the start of a block that fills `room` lines: whole lines while they fit, the last one cut at a word; a code block
 * keeps its whole text in `full` for its copy button
 * @param {Block} b @param {number} room @param {number} perLine @returns {Block}
 */
function cutBlock(b, room, perLine) {
    if (b.kind === 'code')
        return {
            ...b,
            full: b.text,
            text: b.text
                .split('\n')
                .slice(0, Math.max(1, room - HEAD_LINES))
                .join('\n'),
        };
    const out = [];
    let left = room;
    for (const line of b.text.split('\n')) {
        if (left <= 0) break;
        const n = wrapLines(line, perLine);
        if (n <= left) out.push(line);
        else {
            const cut = line.slice(0, left * Math.max(20, perLine));
            out.push(`${cut.replace(/\s+\S*$/, '') || cut}…`);
        }
        left -= n;
    }
    return { ...b, text: out.join('\n') };
}

/**
 * how a reply folds: the blocks that show and the lines left out, or null when it is short enough to show whole
 * @param {Block[]} blocks @param {number} perLine characters a line of its bubble holds
 * @returns {{ shown: Block[], hidden: number } | null}
 */
export function foldBlocks(blocks, perLine) {
    const lines = blocks.map((b) => linesOf(b, perLine));
    const total = lines.reduce((a, n) => a + n, 0);
    if (total <= FOLD_TALL) return null;
    /** @type {Block[]} */
    const shown = [];
    let left = FOLD_SHOWN;
    let used = 0;
    for (let i = 0; i < blocks.length && left > 0; i++) {
        const b = blocks[i];
        if (lines[i] <= left) {
            shown.push(b);
            used += lines[i];
        } else {
            shown.push(cutBlock(b, left, perLine));
            used += left;
        }
        left -= lines[i];
    }
    return { hidden: Math.max(1, total - used), shown };
}

/**
 * how a reply in the chat folds: only in an earlier turn, and only while his «Show more» switch is on (FRM-607); a reply
 * of the turn he reads now never folds, since one folding while a newer one lands would collapse under his eyes
 * @param {Block[]} blocks @param {number} perLine
 * @param {{ isEarlierTurn: boolean, isShowMoreOn: boolean }} at
 */
export const replyFold = (blocks, perLine, { isEarlierTurn, isShowMoreOn }) =>
    isEarlierTurn && isShowMoreOn ? foldBlocks(blocks, perLine) : null;
