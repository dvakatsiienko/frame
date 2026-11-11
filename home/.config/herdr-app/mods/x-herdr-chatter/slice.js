import { Buffer } from 'buffer';

// a transcript read a slice at a time: herdr's fs reads a whole file and refuses one past 64 MB (a 93 MB thread drew
// an empty chat, 2026-11-10 21:02), so the slice comes from `tail | head`, and only its whole lines are kept

/**
 * the whole lines of a slice read from byte `pos`, and the byte where the next read starts; a line cut by the slice's
 * end waits for the next read, since a newline is one byte and never sits inside a character
 * @param {string} text the slice, decoded
 * @param {number} pos the byte it starts at
 * @returns {{ text: string, end: number }}
 */
export function wholeLines(text, pos) {
    const cut = text.lastIndexOf('\n') + 1;
    const kept = text.slice(0, cut);
    return { end: pos + Buffer.byteLength(kept, 'utf8'), text: kept };
}
