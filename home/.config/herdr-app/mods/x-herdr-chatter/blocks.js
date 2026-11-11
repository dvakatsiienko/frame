// a reply cut into blocks: prose stays markdown, a fenced block becomes a code block with a copy button, and a fence
// under a 📋 ribbon that names a session or an agent becomes a prompt card that fills his box; a «copy → terminal»
// ribbon keeps its fence a code block. the ribbons and the ✂️ end line are the fleet's own copy-block frame

/** @typedef {{ kind: 'text', text: string } | { kind: 'code', lang: string, text: string, isClosed: boolean, full?: string } | { kind: 'prompt', to: string, text: string }} Block */

const RIBBON = /^📋\s*\*\*copy\s*→\s*(.+?)\*\*\s*📋\s*$/;
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
    /** @type {string | null} */
    let ribbon = null;
    const flush = () => {
        const body = prose.join('\n').trim();
        if (body) blocks.push({ kind: 'text', text: body });
        prose = [];
    };
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const toAt = RIBBON.exec(line);
        if (toAt) {
            flush();
            ribbon = toAt[1].trim();
            continue;
        }
        if (END.test(line)) continue;
        const open = FENCE.exec(line);
        if (!open) {
            if (line.trim()) ribbon = null;
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
        const code = body.join('\n');
        const to = ribbon;
        ribbon = null;
        if (to && !/^terminal$/i.test(to) && isClosed)
            blocks.push({ kind: 'prompt', text: code, to });
        else blocks.push({ isClosed, kind: 'code', lang: open[2], text: code });
    }
    flush();
    return blocks;
}

/**
 * his box after a prompt card's click: what he typed stays, a blank line, then the prompt, unsent
 * @param {string} was
 * @param {string} prompt
 */
export const withPrompt = (was, prompt) =>
    was.trim() ? `${was.trimEnd()}\n\n${prompt}` : prompt;
