// x-herdr-chat-settings: the chat's look, as a popover the chat's gear opens (FRM-641). the values live in herdr's
// shared store under `chat.look` (look.js), so whichever chat is his reads a change at once.

import { v_flex } from 'gpui-base';
import { View, div } from 'gpui-kit';
import { shared, theme } from 'herdr';

import { LOOK_KEY, lookOf } from './look.js';

/** @typedef {import('gpui-kit').Color} Color */
/** @typedef {Record<'background' | 'foreground' | 'muted', Color>} Theme */

export default class ChatSettings extends View {
    /** @param {import('gpui-kit').Context} _cx */
    render(_cx) {
        const t = /** @type {Theme} */ (theme());
        const look = lookOf(shared(LOOK_KEY));
        return v_flex()
            .size_full()
            .p(14)
            .bg(t.background)
            .text_color(t.foreground)
            .text_size(13)
            .child(div().child('Chat'))
            .child(div().text_color(t.muted).child(`Text size ${look.size}`));
    }
}
