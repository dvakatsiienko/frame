// the chat's rows in herdr's lazy list: each row's height measured out of sight, the list told every size up front,
// so it draws only the rows on screen and scrolls natively (the measurer and the size guard after shepherdr's chat,
// MIT, Copyright (c) 2026 Elias Stravik)

// one NaN, zero or runaway height leaves the whole list blank
export const MAX_ROW_PX = 40000;
// the rows measured in one pass, new ones first, nearest the view first
export const MEASURE_NEW = 30;
export const MEASURE_MAX = 60;
// markdown can lay out a moment after its first frame (a long reply first measures as one line): a height is
// measured until it reads the same this many times running
export const SETTLED_READS = 2;

/**
 * every row's height for the list: its measured one, else its guess, each a finite number in (0, MAX_ROW_PX]
 * @param {string[]} keys
 * @param {Map<string, number>} heights
 * @param {(i: number) => number} guess
 * @returns {number[]}
 */
export function rowSizes(keys, heights, guess) {
    return keys.map((key, i) => {
        const h = heights.get(key) ?? guess(i);
        return Number.isFinite(h) && h > 0 ? Math.min(h, MAX_ROW_PX) : 40;
    });
}

/**
 * whether a row is drawn inside a clip: only while the list's size for it is not its own measured height, so it never
 * spills over the next row. a clip around his text is the viewport herdr's text drag scrolls from 16 px inside
 * (gpui-component#3928, fixed upstream after herdr 0.1.15): a press dragged a hair up ran the chat to its top
 * (dima, 2026-11-12 01:04)
 * @param {string} key
 * @param {Map<string, number>} heights
 */
export function isRowClipped(key, heights) {
    const h = heights.get(key);
    return !(Number.isFinite(h) && h > 0 && h <= MAX_ROW_PX);
}

// «Still in Claude's box» covers the log's bottom this far, its 6 px gap included
export const LEFT_STRIP_COVER = 34;

/**
 * whether a press in the log landed under a strip floating over its bottom edge: the press is the strip's, and the row
 * under it never takes it (a × over a message's fork column forked the thread, dima 01:39)
 * @param {number} y the press, from the log's top
 * @param {number} viewH the log's height
 * @param {number} cover how far up from the log's bottom a strip covers it, 0 when none shows
 */
export const isPressUnderStrip = (y, viewH, cover) =>
    cover > 0 && y >= viewH - cover;

/**
 * which rows the measurer draws this pass: never-measured ones nearest `near` first, then ones not yet read the same
 * twice (markdown can lay out a moment after its first frame); a settled chat draws none, since every frame lays out
 * whatever the measurer holds (60 rows a frame cost his fling 4× the drawing, 21:57)
 * @param {string[]} keys
 * @param {Map<string, number>} heights
 * @param {Map<string, number>} sameReads how many times running each height read the same
 * @param {number} near
 * @returns {number[]}
 */
export function measureOrder(keys, heights, sameReads, near) {
    const all = keys.map((_, i) => i);
    const fresh = all
        .filter((i) => !heights.has(keys[i]))
        .sort((a, b) => Math.abs(a - near) - Math.abs(b - near))
        .slice(0, MEASURE_NEW);
    const again = all.filter(
        (i) =>
            heights.has(keys[i]) &&
            (sameReads.get(keys[i]) ?? 0) < SETTLED_READS,
    );
    return [...new Set([...fresh, ...again])].slice(0, MEASURE_MAX);
}

/**
 * following the newest after a wheel step: up stops following, down at the conversation's end (isAtTrueEnd) follows again
 * @param {boolean} follow
 * @param {number} dy the wheel's delta, positive up
 * @param {boolean} isAtEnd he sits at the end
 */
export function followAfterWheel(follow, dy, isAtEnd) {
    if (dy > 0) return false;
    if (dy < 0 && isAtEnd) return true;
    return follow;
}

// how far above the end still counts as sitting at it: about five lines of text
export const END_SLACK = 100;

/**
 * he sits at the conversation's end: the rows drawn are its last screen. herdr's list hands a mod no scroll offset,
 * so the end is read from the drawn range against the stated heights, and holds only where that read is exact to
 * END_SLACK: the first row of the last screen may hide no more than that above the view (he could be reading that
 * part), and a last row taller than the view never counts. where the read is not exact, the ↓ pill is the way back
 * @param {number[]} sizes every row's height, in order
 * @param {{ start: number, end: number } | null | undefined} range the rows the list drew last
 * @param {number | null | undefined} viewH the list's height, in the sizes' unit
 */
export function isAtTrueEnd(sizes, range, viewH) {
    if (!range || !viewH || range.end < sizes.length) return false;
    const last = sizes.length - 1;
    if (last >= 0 && sizes[last] >= viewH) return false;
    let firstOfLastScreen = sizes.length;
    let sum = 0;
    while (firstOfLastScreen > 0 && sum < viewH)
        sum += sizes[--firstOfLastScreen];
    return range.start >= firstOfLastScreen && sum - viewH <= END_SLACK;
}

/**
 * following the newest once a thread's transcript is read from its start: only another conversation in the thread (a
 * /clear, a resume) starts at its newest. the first read after a reload of the mod, and the same session read again,
 * leave him where he reads
 * @param {boolean} follow
 * @param {string | null | undefined} shownSession the session the chat showed, none before its first read
 * @param {string} session the session read now
 */
export const followAfterReread = (follow, shownSession, session) =>
    shownSession && shownSession !== session ? true : follow;

/**
 * following the newest once a held row is gone: only a thread he came back to (a /clear, a trimmed transcript) goes to
 * the newest; mid-thread he stays where he reads, whatever lands (dima, 21:16: «i scroll myself»)
 * @param {{ isRestore?: boolean }} anchor
 */
export const followAfterLostRow = (anchor) => Boolean(anchor.isRestore);

/**
 * the nearest of his messages starting above the view's first row, or -1
 * @param {{ mine?: boolean }[]} rows
 * @param {number} start the first row on screen
 */
export function prevMineIndex(rows, start) {
    for (let i = Math.min(start, rows.length) - 1; i >= 0; i--)
        if (rows[i].mine) return i;
    return -1;
}

// a file:// url's local path, decoded, or null: only an absolute path on this mac (an empty host or localhost)
/** @param {string} url @returns {string | null} */
function filePath(url) {
    const m = /^file:\/\/(?:localhost)?(\/.*)$/.exec(url);
    if (!m) return null;
    try {
        return decodeURIComponent(m[1]);
    } catch {
        return null;
    }
}

// a file:// link in a reply drawn as plain text: a press on it does nothing in a lazy-list row (herdr-app#894), so it
// never looks pressable; the 📂 row under the reply opens it (FRM-562:W60)
const FILE_LINK =
    /\[([^\]\n]*)\]\(<?file:\/\/[^\s)>]+>?(?:\s+"[^"]*")?\)|<file:\/\/([^\s>]+)>/g;
/** @param {string} text the reply's markdown */
export const unlinkFiles = (text) =>
    text
        .split(/(^(?:```|~~~)[\s\S]*?^(?:```|~~~)|`[^`\n]*`)/m)
        .map((part, i) =>
            i % 2
                ? part
                : part.replace(
                      FILE_LINK,
                      (_, label, auto) =>
                          label ?? auto.split('/').filter(Boolean).pop(),
                  ),
        )
        .join('');

const BARE_PATH =
    /(?:^|[\s`(«"'])((?:~|\/(?:Users|private|tmp|Volumes|opt))\/[^\s`'"<>()[\]«»]*[^\s`'"<>()[\]«».,;:!?])/g;

/**
 * the files a reply links with file:// urls, each once, in order, outside code: a link inside a list row can't be
 * pressed (a handler there blanks the list, and TextView opens no file:// itself), so each gets a row of its own
 * @param {string} text the reply's markdown
 * @returns {{ label: string, path: string }[]}
 */
export function fileLinks(text, home = '') {
    const unfenced = text.replace(/^(```|~~~)[\s\S]*?^\1/gm, '');
    const prose = unfenced.replace(/`[^`\n]*`/g, '');
    /** @type {Map<string, string>} */
    const found = new Map();
    const link =
        /\[([^\]\n]*)\]\(<?(file:\/\/[^\s)>]+)>?(?:\s+"[^"]*")?\)|<(file:\/\/[^\s>]+)>/g;
    for (const m of prose.matchAll(link)) {
        const path = filePath(m[2] ?? m[3]);
        if (!path || found.has(path)) continue;
        found.set(path, m[1]?.trim() || path.split('/').pop() || path);
    }
    // a bare path to a file, in prose or a code span (FRM-562: «a dead line»), never in a fenced block or a url
    for (const m of unfenced.matchAll(BARE_PATH)) {
        const path = home ? m[1].replace(/^~(?=\/)/, home) : m[1];
        if (!/\.[A-Za-z0-9]{1,10}$/.test(path) || found.has(path)) continue;
        found.set(path, path.split('/').pop() ?? path);
    }
    return [...found].map(([path, label]) => ({ label, path }));
}
