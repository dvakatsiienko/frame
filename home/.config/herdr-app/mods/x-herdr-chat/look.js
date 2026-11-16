// the chat's look, his values in herdr's shared store under `chat.look`: one typed reader both chats and this popover
// use, and one writer. a value no row offers reads as its default; a stored key no row reads is kept as it was.

export const LOOK_KEY = 'chat.look';

export const SIZE_MIN = 10;
export const SIZE_MAX = 22;

// each row's choices, in the order the popover draws them: an array keeps its order, a formatter sorts object keys
export const CHOICES = {
    accent: ['theme', 'claude', 'blue', 'green', 'purple', 'pink'],
    bg: ['background', 'chrome', 'canvas'],
    fg: ['theme'],
    font: ['ui', 'mono'],
    mine: ['bubble', 'box', 'tint', 'bar'],
    replies: ['open', 'folded'],
    space: ['tight', 'normal', 'roomy'],
    system: ['fold', 'hide', 'show'],
    tools: ['show', 'hide'],
    width: ['full', 'narrow'],
};

/**
 * @typedef {object} Look
 * @property {string} accent a key of the accent swatches
 * @property {string} bg a theme surface or a `#rrggbb` he picked
 * @property {string} fg `theme` or a `#rrggbb` he picked
 * @property {'ui' | 'mono'} font
 * @property {'bubble' | 'box' | 'tint' | 'bar'} mine how his own messages are drawn
 * @property {'open' | 'folded'} replies Claude's replies in earlier turns
 * @property {number} size the text size, SIZE_MIN to SIZE_MAX
 * @property {'tight' | 'normal' | 'roomy'} space the gap between rows
 * @property {'fold' | 'hide' | 'show'} system lines he never typed
 * @property {'show' | 'hide'} tools
 * @property {'full' | 'narrow'} width
 */

/** @type {Look} */
export const LOOK_DEFAULT = {
    accent: 'theme',
    bg: 'background',
    fg: 'theme',
    font: 'ui',
    mine: 'bubble',
    replies: 'open',
    size: 13,
    space: 'normal',
    system: 'fold',
    tools: 'show',
    width: 'full',
};

const HEX = /^#[0-9a-f]{6}$/i;

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * @template {keyof typeof CHOICES} K
 * @param {Record<string, unknown>} stored
 * @param {K} key
 * @param {boolean} [canBeHex]
 * @returns {Look[K]}
 */
function choiceOf(stored, key, canBeHex = false) {
    const value = stored[key];
    const isOffered =
        typeof value === 'string' &&
        (CHOICES[key].includes(value) || (canBeHex && HEX.test(value)));
    return /** @type {Look[K]} */ (isOffered ? value : LOOK_DEFAULT[key]);
}

/**
 * his look from what the store holds
 * @param {unknown} stored `shared('chat.look')`
 * @returns {Look}
 */
export function lookOf(stored) {
    const from = isRecord(stored) ? stored : {};
    const size = from.size;
    return {
        accent: choiceOf(from, 'accent'),
        bg: choiceOf(from, 'bg', true),
        fg: choiceOf(from, 'fg', true),
        font: choiceOf(from, 'font'),
        mine: choiceOf(from, 'mine'),
        replies: choiceOf(from, 'replies'),
        size:
            typeof size === 'number' && size >= SIZE_MIN && size <= SIZE_MAX
                ? size
                : LOOK_DEFAULT.size,
        space: choiceOf(from, 'space'),
        system: choiceOf(from, 'system'),
        tools: choiceOf(from, 'tools'),
        width: choiceOf(from, 'width'),
    };
}

/**
 * what the store holds after one change: the change over his look, every key it does not name kept
 * @param {unknown} stored `shared('chat.look')`
 * @param {Partial<Look>} change
 * @returns {Record<string, unknown>}
 */
export function withChange(stored, change) {
    const size =
        change.size === undefined
            ? {}
            : { size: Math.min(SIZE_MAX, Math.max(SIZE_MIN, change.size)) };
    return {
        ...(isRecord(stored) ? stored : {}),
        ...lookOf(stored),
        ...change,
        ...size,
    };
}
