// the popover's rows, in the order it draws them: each names the look value it sets and the choices it offers.
// arrays, never objects, so a formatter's key sort never moves a row or a choice.

/**
 * @typedef {object} Row
 * @property {keyof import('./look.js').Look} key the look value the row sets
 * @property {string} label
 * @property {'step' | 'pills' | 'swatches' | 'colors'} kind `step`: − and + around the number; `pills`: one word
 *   per choice; `swatches`: round colours; `colors`: round colours and a box for any `#rrggbb`
 * @property {[string, string][]} [choices] each choice and its label, or its colour and its name
 */
/**
 * a colour as herdr takes it
 * @typedef {import('gpui-kit').Color} Color
 */

// the accent swatches: the theme's own accent first, then fixed colours
/** @type {[string, Color | null][]} */
export const ACCENTS = [
    ['theme', null],
    ['claude', '#d97757'],
    ['blue', '#4f8cff'],
    ['green', '#3fb950'],
    ['purple', '#a371f7'],
    ['pink', '#f778ba'],
];

/** @type {[string, string][]} */
const BACKGROUNDS = [
    ['#0d1117', 'Night'],
    ['#1e1e1e', 'Charcoal'],
    ['#22201c', 'Coffee'],
    ['#f6f1e7', 'Paper'],
    ['#ffffff', 'White'],
];

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
        choices: [
            ['fold', 'Folded'],
            ['hide', 'Hidden'],
            ['show', 'Shown'],
        ],
        key: 'system',
        kind: 'pills',
        label: 'System lines',
    },
    {
        choices: [
            ['open', 'Open'],
            ['folded', 'Folded'],
        ],
        key: 'replies',
        kind: 'pills',
        label: 'Earlier replies',
    },
    {
        choices: ACCENTS.map(([key]) => [
            key,
            key === 'theme'
                ? "Theme's accent"
                : `${key.slice(0, 1).toUpperCase()}${key.slice(1)}`,
        ]),
        key: 'accent',
        kind: 'swatches',
        label: 'Accent',
    },
    {
        choices: [
            ['bubble', 'Bubbles'],
            ['box', 'Box'],
            ['tint', 'Tint'],
            ['bar', 'Bar'],
        ],
        key: 'mine',
        kind: 'pills',
        label: 'Your messages',
    },
    {
        choices: [
            ['background', 'Terminal'],
            ['chrome', 'Panel'],
            ['canvas', 'Canvas'],
        ],
        key: 'bg',
        kind: 'pills',
        label: 'Background',
    },
    { choices: BACKGROUNDS, key: 'bg', kind: 'colors', label: '' },
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
