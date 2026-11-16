// the transcript reader: it hands on only the complete lines added to one file since its last read, and never reads
// a byte twice. a long file opens at its last slice; what lies above comes a page at a time, on ask. the file itself
// is reached through a door (size, a byte range, the next line start), so this file runs with no herdr.

/**
 * @typedef {object} FileDoor
 * @property {() => Promise<number | null>} sizeOf the file's size in bytes, null while it does not exist
 * @property {(from: number, max: number) => Promise<string>} read at most `max` bytes from byte `from`, decoded
 * @property {(at: number) => Promise<number>} lineStartAt the byte after the first newline at or after byte `at`; the
 *   file's size when no newline follows
 */

/** @typedef {{ lines: string[], isRestart: boolean }} NewLines */

const DEFAULT_SLICE = 4 * 1024 * 1024;
// herdr's exec hands back 8 MiB at most: no read asks for more than this, and a line longer than it is skipped
const DEFAULT_MAX_READ = 6 * 1024 * 1024;

/** the bytes `text` takes as UTF-8, counted here: herdr's runtime has no TextEncoder @param {string} text */
export function utf8Length(text) {
    let bytes = 0;
    for (const char of text) {
        const code = char.codePointAt(0) ?? 0;
        bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    }
    return bytes;
}

/** @param {string} text whole lines, each ended by a newline */
function linesOf(text) {
    return text.split('\n').filter((line) => line.trim());
}

/**
 * @param {FileDoor} door
 * @param {{ slice?: number, maxRead?: number }} [options] `slice`: the bytes one read asks for, and the size of a page;
 *   `maxRead`: the most a read may grow to for one long line
 */
export function createReader(
    door,
    { slice = DEFAULT_SLICE, maxRead = DEFAULT_MAX_READ } = {},
) {
    /** the first byte not handed on yet; null before the first read */
    let pos = /** @type {number | null} */ (null);
    /** the first byte ever handed on: what lies above it is an earlier page */
    let head = 0;
    let isLost = false;
    /** @type {Promise<unknown>} */
    let queue = Promise.resolve();

    /** @returns {Promise<NewLines>} */
    async function readNew() {
        const size = await door.sizeOf();
        if (size === null) {
            isLost = pos !== null;
            return { isRestart: false, lines: [] };
        }
        let isRestart = isLost;
        let at = pos;
        let from = head;
        if (at === null) {
            at = size > slice ? await door.lineStartAt(size - slice) : 0;
            from = at;
        } else if (isLost || size < at) {
            isRestart = true;
            at = 0;
            from = 0;
        }
        /** @type {string[]} */
        const lines = [];
        let max = slice;
        while (at < size) {
            const text = await door.read(at, Math.min(max, size - at));
            const cut = text.lastIndexOf('\n') + 1;
            if (!cut) {
                // no whole line in this read: a half-written one waits, a line longer than the read is asked for whole
                if (at + max >= size) break;
                if (max < maxRead) {
                    max = Math.min(max * 2, maxRead);
                    continue;
                }
                // longer than any read may be: skipped once it has ended, so the lines after it are never held back
                const next = await door.lineStartAt(at);
                const hasEnded =
                    next > at &&
                    (next < size ||
                        (next === size &&
                            (await door.read(size - 1, 1)) === '\n'));
                if (!hasEnded) break;
                at = next;
                max = slice;
                continue;
            }
            const whole = text.slice(0, cut);
            lines.push(...linesOf(whole));
            at += utf8Length(whole);
            max = slice;
        }
        pos = at;
        head = from;
        isLost = false;
        return { isRestart, lines };
    }

    /** @returns {Promise<string[]>} */
    async function readEarlier() {
        if (pos === null || head <= 0) return [];
        let from = head;
        for (let back = slice; from >= head; back *= 2)
            from = head - back <= 0 ? 0 : await door.lineStartAt(head - back);
        const text = await door.read(from, head - from);
        head = from;
        return linesOf(text);
    }

    /**
     * one read at a time, in the order asked: a second ask waits for the first and reads what is left
     * @template T
     * @param {() => Promise<T>} run
     * @returns {Promise<T>}
     */
    function inTurn(run) {
        const next = queue.then(run, run);
        queue = next.catch(() => {});
        return next;
    }

    return {
        /** whether lines lie above the first one handed on */
        hasEarlier: () => pos !== null && head > 0,
        readEarlier: () => inTurn(readEarlier),
        readNew: () => inTurn(readNew),
    };
}
