// a list selected in the chat copies without its markers: herdr draws them and offers no copy hook. the chat knows
// each message's source, so a paste into its quill puts back the marker of every line that is a list item's text
// (dima, 23:38, the probe's variant E)

import { plainText } from './paste.js';

const ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.+)$/;
const FENCE = /^\s*(```|~~~)/;

/** a source line's text as its drawn row copies @param {string} text */
const drawn = (text) => plainText(text).trim();

/**
 * every list item of the messages, keyed by its drawn text; the value is that text behind its marker, plain, since
 * a paste keeps only the list's form (his 18:09 shot); a later message wins
 * @param {string[]} markdowns
 * @returns {Map<string, string>}
 */
export function listLines(markdowns) {
    /** @type {Map<string, string>} */
    const lines = new Map();
    for (const md of markdowns) {
        let isFenced = false;
        for (const line of md.split('\n')) {
            if (FENCE.test(line)) isFenced = !isFenced;
            const m = isFenced ? null : ITEM.exec(line);
            if (m) lines.set(drawn(m[3]), `${m[1]}${m[2]} ${drawn(m[3])}`);
        }
    }
    return lines;
}

/**
 * the quill after a change, its pasted lines given their markers back: only a change that inserts more than one line
 * is a paste, so a line he types stays as typed; the text around the insert is never touched
 * @param {string} was
 * @param {string} now
 * @param {Map<string, string>} lines
 */
export function withMarkers(was, now, lines) {
    let start = 0;
    while (
        start < was.length &&
        start < now.length &&
        was[start] === now[start]
    )
        start++;
    let end = 0;
    while (
        end < was.length - start &&
        end < now.length - start &&
        was[was.length - 1 - end] === now[now.length - 1 - end]
    )
        end++;
    const pasted = now.slice(start, now.length - end);
    if (!pasted.includes('\n') || !lines.size) return now;
    const fixed = pasted
        .split('\n')
        .map((piece) => lines.get(piece.trim()) ?? piece)
        .join('\n');
    return now.slice(0, start) + fixed + now.slice(now.length - end);
}
