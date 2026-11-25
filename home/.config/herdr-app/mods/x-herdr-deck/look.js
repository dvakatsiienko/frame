// x-herdr-deck's drawing primitives: the font, the type scale, a meter bar, a one-line row, selectable prose

import { TextView } from 'gpui-base';
import { div } from 'gpui-kit';
import { settings } from 'herdr';

import { literalAngles } from './orbit.js';

/** @typedef {import('gpui-kit').Color} Color */
/** @typedef {import('./deck-types.js').Theme} Theme */

// the system font: herdr's own UI font (Geist) ships one face, so markdown's **bold** drew flat in it
export const SANS = '.AppleSystemUIFont';
// one type scale: names and ask text, secondary lines, the smallest anywhere; secondary text is `muted`, never `dim`,
// which reads 2.95:1 on paper's white (muted 5.48:1, 5.07:1 on a card's `raised`)
export const SIZE = { main: 15, secondary: 13, small: 12 };

/**
 * @param {Theme} t
 * @param {number} pct
 * @param {number | `${number}%`} width
 * @param {Color} color
 */
export function bar(t, pct, width, color) {
    const fill = Math.max(0, Math.min(100, Math.round(pct)));
    return div()
        .w(width)
        .h(4)
        .flex_none()
        .rounded(2)
        .bg(t.border)
        .child(div().w(`${fill}%`).h(4).rounded(2).bg(color));
}

/** @param {Color} color @param {number} size */
export const line = (color, size) =>
    div()
        .flex_1()
        .min_w(0)
        .overflow_hidden()
        .whitespace_nowrap()
        .text_ellipsis()
        .text_size(size)
        .text_color(color);

// blank room at a line's start, `width` px wide at `size` px text: em spaces, then sixth-of-an-em spaces for the rest;
// both are unicode spaces markdown keeps, where it drops leading ascii ones
/** @param {number} width @param {number} size */
export const leadingRoom = (width, size) => {
    const ems = Math.floor(width / size);
    const sixths = Math.ceil(((width - ems * size) * 6) / size);
    return ' '.repeat(ems) + ' '.repeat(sixths);
};

/** a size herdr reports in window pixels, as the pixels a view draws in @param {number} size */
export const drawnSize = (size) => size / (Number(settings().zoom) || 1);

// TextView is the one element whose text can be selected, so anything worth reading aloud goes through it. a link in
// it opens as herdr opens a mod's: http(s) alone, never on a right-click
/** @param {string} id @param {string} markdown @param {Color} color @param {number} size */
export const markdownText = (id, markdown, color, size) =>
    TextView.markdown(id, markdown)
        .selectable()
        .w_full()
        .text_size(size)
        .text_color(color);

/** markdown as a thread writes it: a `<word>` in it is words, never html @param {string} id @param {string} markdown @param {Color} color @param {number} size */
export const prose = (id, markdown, color, size) =>
    markdownText(id, literalAngles(markdown), color, size);

/** a time as HH:MM, or HH:MM:SS with 3 parts @param {Date} at @param {2 | 3} parts */
export const clockOf = (at, parts) =>
    [at.getHours(), at.getMinutes(), at.getSeconds()]
        .slice(0, parts)
        .map((n) => String(n).padStart(2, '0'))
        .join(':');
