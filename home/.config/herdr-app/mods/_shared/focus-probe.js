// a throwaway probe (FRM-620 slice 5a): each Tab stop of ours wears a tag with its name, and a loud ring while it holds
// the keyboard, so dima can Tab once and say which stop is which; a Tab that lights no tag landed on herdr's own. slice
// 5b takes it out

import { div } from 'gpui-kit';

const RING = '#ff2bd6';
const RING_IDLE = '#ff2bd655';

/**
 * @template {import('gpui-kit').Element} E @param {E} el @param {string} tag @param {boolean} isFocused @returns {E}
 */
export const focusProbe = (el, tag, isFocused) =>
    el
        .relative()
        .border_2()
        .border_color(isFocused ? RING : RING_IDLE)
        .child(
            div()
                .absolute()
                .top(-9)
                .right(6)
                .px(5)
                .rounded(4)
                .bg(isFocused ? RING : RING_IDLE)
                .text_size(11)
                .font_semibold()
                .text_color('#ffffff')
                .child(`⌖ ${tag}`),
        );
