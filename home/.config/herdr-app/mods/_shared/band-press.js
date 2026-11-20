// a band press, written by the quill's band and by antenna's 🔥 through the deck: the press file only herdr may write
// (the guard's `press-write` rule), which x-mod-stash reads at its 4 s poll (FRM-568)

export const PRESS_DIR = '.claude/shelf/band-presses';
export const PRESS_FILE = `${PRESS_DIR}/band.jsonl`;
const DAY_MS = 24 * 60 * 60 * 1000;
// a press the stash has not answered by then gives the button its state back: a hot press reaches the thread's state
// file at the stash's third 4 s poll, about 16 s at worst
export const PENDING_MS = 20 * 1000;

/** @typedef {'wind' | 'hot' | 'waker' | 'afk' | 'override'} PressKey */
/** @typedef {{ at: number, button: PressKey, on: boolean, sid?: string }} PressLine */

/**
 * one press: wind and hot name the thread they act on, waker and AFK are fleet-wide; `on` is the state it sets, never
 * a flip
 * @param {PressKey} button
 * @param {boolean} on
 * @param {string | null} sid
 * @param {number} now
 * @returns {PressLine}
 */
export function pressLine(button, on, sid, now) {
    return button === 'wind' || button === 'hot'
        ? { at: now, button, on, sid: /** @type {string} */ (sid) }
        : { at: now, button, on };
}

/**
 * the press file after one more press: lines older than a day go (herdr alone trims it), a broken line too
 * @param {string | null} text
 * @param {PressLine} line
 * @param {number} now
 */
export function withBandPress(text, line, now) {
    const kept = (text ?? '').split('\n').filter((l) => {
        try {
            return JSON.parse(l).at > now - DAY_MS;
        } catch {
            return false;
        }
    });
    return [...kept, JSON.stringify(line)].map((l) => `${l}\n`).join('');
}
