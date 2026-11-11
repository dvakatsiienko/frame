// the chat's rows in herdr's lazy list: each row's height measured out of sight, the list told every size up front,
// so it draws only the rows on screen and scrolls natively (the measurer and the size guard after shepherdr's chat,
// MIT, Copyright (c) 2026 Elias Stravik)

// one NaN, zero or runaway height leaves the whole list blank
export const MAX_ROW_PX = 40000;
// the rows measured in one pass, new ones first, nearest the view first
export const MEASURE_NEW = 30;
export const MEASURE_MAX = 60;
// markdown can lay out a moment after its first frame (a long reply first measures as one line): a height measured
// this recently, or on screen, is measured again
export const REMEASURE_MS = 4000;

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
 * which rows the measurer draws this pass: never-measured ones nearest `near` first, then the rows on screen (two
 * past each edge) and the ones measured in the last REMEASURE_MS
 * @param {string[]} keys
 * @param {Map<string, number>} heights
 * @param {Map<string, number>} measuredAt
 * @param {{ start: number, end: number } | null} range
 * @param {number} near
 * @param {number} now
 * @returns {number[]}
 */
export function measureOrder(keys, heights, measuredAt, range, near, now) {
    const lo = Math.max(0, (range?.start ?? keys.length) - 2);
    const hi = Math.min(keys.length, (range?.end ?? 0) + 2);
    const all = keys.map((_, i) => i);
    const fresh = all
        .filter((i) => !heights.has(keys[i]))
        .sort((a, b) => Math.abs(a - near) - Math.abs(b - near))
        .slice(0, MEASURE_NEW);
    const again = all.filter(
        (i) =>
            heights.has(keys[i]) &&
            ((i >= lo && i < hi) ||
                now - (measuredAt.get(keys[i]) ?? 0) < REMEASURE_MS),
    );
    return [...new Set([...fresh, ...again])].slice(0, MEASURE_MAX);
}

/**
 * following the newest after a wheel step: up stops following, down at the list's end follows again
 * @param {boolean} follow
 * @param {number} dy the wheel's delta, positive up
 * @param {boolean} isAtEnd the last row is on screen
 */
export function followAfterWheel(follow, dy, isAtEnd) {
    if (dy > 0) return false;
    if (dy < 0 && isAtEnd) return true;
    return follow;
}

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

/**
 * the files a reply links with file:// urls, each once, in order, outside code: a link inside a list row can't be
 * pressed (a handler there blanks the list, and TextView opens no file:// itself), so each gets a row of its own
 * @param {string} text the reply's markdown
 * @returns {{ label: string, path: string }[]}
 */
export function fileLinks(text) {
    const prose = text
        .replace(/^(```|~~~)[\s\S]*?^\1/gm, '')
        .replace(/`[^`\n]*`/g, '');
    /** @type {Map<string, string>} */
    const found = new Map();
    const link =
        /\[([^\]\n]*)\]\(<?(file:\/\/[^\s)>]+)>?(?:\s+"[^"]*")?\)|<(file:\/\/[^\s>]+)>/g;
    for (const m of prose.matchAll(link)) {
        const url = m[2] ?? m[3];
        let path;
        try {
            path = decodeURIComponent(
                url.slice('file://'.length).replace(/^localhost/, ''),
            );
        } catch {
            continue;
        }
        if (!path.startsWith('/') || found.has(path)) continue;
        found.set(path, m[1]?.trim() || path.split('/').pop() || path);
    }
    return [...found].map(([path, label]) => ({ label, path }));
}
