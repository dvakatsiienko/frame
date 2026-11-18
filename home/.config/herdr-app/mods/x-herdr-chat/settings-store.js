// the one settings store: `~/.claude/shelf/herdr-settings/settings.json`, `{v, rows: {key: value}}`, shared by name
// with the old chat until it goes. each chat writes every value of its rows, defaults included, so any other reader
// (x-mod-stash) takes values only and keeps no defaults of its own
import { settingRows } from './settings-model.js';

export const SETTINGS_DIR = '.claude/shelf/herdr-settings';
export const SETTINGS_FILE = `${SETTINGS_DIR}/settings.json`;
const VERSION = 1;

/** @typedef {import('./settings-model.js').Row} Row */

/** a stored value when it fits its row's control, else the row's default @param {Row} row @param {unknown} value */
export function rowValue(row, value) {
    const c = row.control;
    if (c.kind === 'toggle')
        return typeof value === 'boolean' ? value : row.default;
    if (c.kind === 'text') return typeof value === 'string' ? value : '';
    if (c.kind === 'stepper')
        return typeof value === 'number' &&
            value >= c.min &&
            value <= c.max &&
            (value - c.min) % c.step === 0
            ? value
            : row.default;
    const open = c.options.filter((o) => !o.isLocked).map((o) => o.value);
    return Array.isArray(value) && value.every((v) => open.includes(v))
        ? value
        : row.default;
}

/** @param {Row[]} rows @param {Record<string, unknown>} stored @returns {Record<string, unknown>} */
export const resolvedRows = (rows, stored) =>
    Object.fromEntries(rows.map((r) => [r.key, rowValue(r, stored[r.key])]));

/** every row's value from the file's text: a missing or unfit one reads as its default @param {string | null} text */
export const settingsOf = (text) => resolvedRows(settingRows, storedRows(text));

/** @param {string | null} text @returns {Record<string, unknown>} */
export function storedRows(text) {
    try {
        const file = JSON.parse(text ?? '');
        const rows = file?.rows;
        return rows && typeof rows === 'object' && !Array.isArray(rows)
            ? rows
            : {};
    } catch {
        return {};
    }
}

/** the file's next text: what is stored, a change over it, each value checked against its row; a change that does
 * not fit its row is dropped and the stored value stays; a stored value that does not fit reads as the default
 * @param {Row[]} rows @param {string | null} text @param {Record<string, unknown>} [change] */
export function settingsText(rows, text, change = {}) {
    // the saved file is read first: a row it holds stays, a key no row names stays, only a missing row is filled
    const stored = storedRows(text);
    const next = { ...stored, ...resolvedRows(rows, stored) };
    for (const r of rows)
        if (r.key in change && rowValue(r, change[r.key]) === change[r.key])
            next[r.key] = change[r.key];
    return `${JSON.stringify({ rows: next, v: VERSION }, null, 2)}\n`;
}

const NOTICE = 'stash.wind.notice';
const MUST = 'stash.wind.must';

/** why a change to the second wind lines is not saved: x-mod-stash never takes a notice line at or above the wind
 * line, so the pair is refused here, in words, before it is written
 * @param {Record<string, unknown>} values @param {Record<string, unknown>} change @returns {string | null} */
export function windRefusal(values, change) {
    if (!(NOTICE in change) && !(MUST in change)) return null;
    const next = { ...values, ...change };
    const notice = Number(next[NOTICE]);
    const must = Number(next[MUST]);
    return notice >= must
        ? `🛑 not saved: the notice line (${notice}) must sit below the wind line (${must})`
        : null;
}

/** one change to a row, judged: what to write (null when refused) and each row's «not saved» line after it; a saved
 * wind line clears the refusal on both lines, since the pair is valid again. `pending` holds the changes already
 * accepted whose write has not been read back yet, so a second press is judged against the first
 * @param {Record<string, unknown>} values @param {Record<string, unknown>} pending @param {Record<string, string>} notes
 * @param {string} key @param {unknown} value
 * @returns {{ notes: Record<string, string>, pending: Record<string, unknown>, write: Record<string, unknown> | null }} */
export function settingChange(values, pending, notes, key, value) {
    const refusal = windRefusal({ ...values, ...pending }, { [key]: value });
    const isLine = key === NOTICE || key === MUST;
    const rest = Object.fromEntries(
        Object.entries(notes).filter(
            ([k]) => k !== key && !(isLine && (k === NOTICE || k === MUST)),
        ),
    );
    return refusal
        ? { notes: { ...rest, [key]: refusal }, pending, write: null }
        : {
              notes: rest,
              pending: { ...pending, [key]: value },
              write: { [key]: value },
          };
}

/** the accepted changes still waiting: one leaves once the reloaded values show it
 * @param {Record<string, unknown>} pending @param {Record<string, unknown>} values */
export const settledPending = (pending, values) =>
    Object.fromEntries(
        Object.entries(pending).filter(
            ([key, value]) =>
                JSON.stringify(values[key]) !== JSON.stringify(value),
        ),
    );

/** what a note box shows: its row, else the default x-mod-stash wrote @param {unknown} stored @param {string} fallback */
export const noteShown = (stored, fallback) =>
    typeof stored === 'string' && stored.trim() ? stored : fallback;

/** what a note box saves: an empty row means the mod's default, so the default itself is never copied into a row
 * @param {string} text @param {string} fallback */
export const noteStored = (text, fallback) =>
    !text.trim() || text === fallback ? '' : text;

/** a press of Save or Reset on a note box: what lands in its row, and the text the box takes (null leaves it);
 * nothing at all before the box was filled from its row, or an empty box would be saved over his text
 * @param {string} text @param {string} fallback @param {boolean} isReset @param {boolean} isReady
 * @returns {{ box: string | null, row: string } | null} */
export const noteWrite = (text, fallback, isReset, isReady) =>
    !isReady
        ? null
        : isReset
          ? { box: fallback, row: '' }
          : { box: null, row: noteStored(text, fallback) };

/** a warning, never a block: the words a second wind note must keep for a thread to compact
 * @param {string} text @param {string[]} needs @returns {string | null} */
export function noteHint(text, needs) {
    // a blank box is the default itself, which keeps every word
    if (!text.trim()) return null;
    const gone = needs.filter((word) => !text.includes(word));
    return gone.length
        ? `this note no longer says ${gone.map((w) => `«${w}»`).join(' or ')}: a thread may not compact`
        : null;
}
