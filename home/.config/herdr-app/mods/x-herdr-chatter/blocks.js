// a reply cut into blocks: prose stays markdown, a fenced block becomes a code block with a copy button, whatever its
// 📋 ribbon names: a block he copies goes anywhere, so none fills the quill (dima's o147 tick, 2026-11-13 22:22). the
// ribbons and the ✂️ end line are the fleet's own frame, never drawn

/** @typedef {{ kind: 'text', text: string } | { kind: 'code', lang: string, text: string, isClosed: boolean, full?: string }} Block */

const RIBBON = /^📋\s*\*\*copy\s*→\s*.+?\*\*\s*📋\s*$/;
const END = /^✂️\s*\*\*end\*\*\s*✂️\s*$/;
const FENCE = /^\s*(```|~~~)\s*([\w+-]*)\s*$/;

/**
 * @param {string} text
 * @returns {Block[]}
 */
export function splitBlocks(text) {
    /** @type {Block[]} */
    const blocks = [];
    /** @type {string[]} */
    let prose = [];
    const flush = () => {
        const body = prose.join('\n').trim();
        if (body) blocks.push({ kind: 'text', text: body });
        prose = [];
    };
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (RIBBON.test(line)) {
            flush();
            continue;
        }
        if (END.test(line)) continue;
        const open = FENCE.exec(line);
        if (!open) {
            prose.push(line);
            continue;
        }
        flush();
        const body = [];
        let isClosed = false;
        for (i++; i < lines.length; i++) {
            if (lines[i].trim() === open[1]) {
                isClosed = true;
                break;
            }
            body.push(lines[i]);
        }
        blocks.push({
            isClosed,
            kind: 'code',
            lang: open[2],
            text: body.join('\n'),
        });
    }
    flush();
    return blocks;
}
