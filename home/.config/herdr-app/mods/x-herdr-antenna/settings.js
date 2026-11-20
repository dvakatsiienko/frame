// antenna's knobs (FRM-618 slice A), in the popup's order: kept in the one settings file beside every other row, so a
// write here keeps the rows it does not name, and a value that does not fit its knob is never written

/**
 * @typedef {{ key: string, label: string, default: boolean | string, choices?: { value: string, label: string }[] }} Knob
 */

/** @type {Knob[]} */
export const ANTENNA_KNOBS = [
    { default: true, key: 'antenna.groupBySpace', label: 'Group by space' },
    { default: true, key: 'antenna.showTabs', label: 'Show tabs' },
    { default: true, key: 'antenna.details.idle', label: 'Idle time' },
    { default: false, key: 'antenna.details.context', label: 'Context fill' },
    {
        choices: [
            { label: 'Ring', value: 'ring' },
            { label: 'Bars', value: 'bars' },
            { label: 'Pill', value: 'pill' },
            { label: 'Line', value: 'line' },
        ],
        default: 'ring',
        key: 'antenna.details.meter',
        label: 'Context meter',
    },
    { default: true, key: 'antenna.details.wait', label: 'Wait line' },
    { default: true, key: 'antenna.details.hot', label: 'Keep hot 🔥' },
    { default: false, key: 'antenna.details.model', label: 'Model' },
    {
        choices: [
            { label: 'Compact', value: 'compact' },
            { label: 'Roomy', value: 'roomy' },
        ],
        default: 'roomy',
        key: 'antenna.rowHeight',
        label: 'Row height',
    },
];

/** @param {Knob} knob @param {unknown} value */
const fits = (knob, value) =>
    knob.choices
        ? knob.choices.some((c) => c.value === value)
        : typeof value === 'boolean';

/** @param {string | null} text @returns {Record<string, unknown>} */
function storedRows(text) {
    try {
        const rows = JSON.parse(text ?? '')?.rows;
        return rows && typeof rows === 'object' && !Array.isArray(rows)
            ? rows
            : {};
    } catch {
        return {};
    }
}

/** every knob's value from the file's text, a missing or unfit one at its default @param {string | null} text */
export function antennaSettings(text) {
    const stored = storedRows(text);
    return Object.fromEntries(
        ANTENNA_KNOBS.map((k) => [
            k.key,
            fits(k, stored[k.key]) ? stored[k.key] : k.default,
        ]),
    );
}

/** the file's next text: the rows stored, each fitting change over them @param {string | null} text
 * @param {Record<string, unknown>} change */
export function antennaSettingsText(text, change) {
    const rows = { ...storedRows(text) };
    for (const k of ANTENNA_KNOBS)
        if (k.key in change && fits(k, change[k.key]))
            rows[k.key] = change[k.key];
    return `${JSON.stringify({ rows, v: 1 }, null, 2)}\n`;
}
