// the one settings store: `~/.claude/shelf/herdr-settings/settings.json`, `{v, rows: {key: value}}`. the chatter
// owns the rows (settings-model.js) and writes every value, defaults included, so any other reader (a herdr mod,
// x-mod-stash) takes values only and keeps no defaults of its own

export const SETTINGS_DIR = '.claude/shelf/herdr-settings';
export const SETTINGS_FILE = `${SETTINGS_DIR}/settings.json`;
const VERSION = 1;

/** @typedef {import('./settings-model.js').Row} Row */

/** a stored value when it fits its row's control, else the row's default @param {Row} row @param {unknown} value */
export function rowValue(row, value) {
    const c = row.control;
    if (c.kind === 'toggle')
        return typeof value === 'boolean' ? value : row.default;
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
