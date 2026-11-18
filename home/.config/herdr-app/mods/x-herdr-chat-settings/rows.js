// the popover's rows, in the order it draws them: each names the look value it sets and the choices it offers. a
// look value joins as a row only once the chat acts on it: accent, his messages, background, system lines and earlier
// replies wait for theirs (FRM-638)
// arrays, never objects, so a formatter's key sort never moves a row or a choice.

/**
 * @typedef {object} Row
 * @property {keyof import('./look.js').Look} key the look value the row sets
 * @property {string} label
 * @property {'step' | 'pills' | 'colors'} kind `step`: − and + around the number; `pills`: one word per choice;
 *   `colors`: round colours and a box for any `#rrggbb`
 * @property {[string, string][]} [choices] each choice and its label, or its colour and its name
 */
/**
 * a colour as herdr takes it
 * @typedef {import('gpui-kit').Color} Color
 */

/** @type {[string, string][]} */
const TEXTS = [
    ['theme', "Theme's"],
    ['#e6edf3', 'Soft white'],
    ['#c9d1d9', 'Gray'],
    ['#f0dfbf', 'Cream'],
    ['#24292f', 'Ink'],
    ['#000000', 'Black'],
];

/** @type {Row[]} */
export const ROWS = [
    { key: 'size', kind: 'step', label: 'Text size' },
    {
        choices: [
            ['ui', 'Sans'],
            ['mono', 'Mono'],
        ],
        key: 'font',
        kind: 'pills',
        label: 'Font',
    },
    {
        choices: [
            ['full', 'Full'],
            ['narrow', 'Narrow'],
        ],
        key: 'width',
        kind: 'pills',
        label: 'Width',
    },
    {
        choices: [
            ['show', 'Show'],
            ['hide', 'Hide'],
        ],
        key: 'tools',
        kind: 'pills',
        label: 'Tool calls',
    },
    {
        choices: TEXTS,
        key: 'fg',
        kind: 'colors',
        label: 'Text (all of herdr)',
    },
    {
        choices: [
            ['tight', 'Tight'],
            ['normal', 'Normal'],
            ['roomy', 'Roomy'],
        ],
        key: 'space',
        kind: 'pills',
        label: 'Spacing',
    },
];
