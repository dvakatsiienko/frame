// x-herdr-chat: the Chat view, built new beside x-herdr-chatter (FRM-638). it draws nothing of a thread yet: the
// reader, the rows and the list land file by file, each type-checked under `strict` by `pnpm herdr-mods:typecheck`.

import { v_flex } from 'gpui-base';
import { View, div } from 'gpui-kit';
import { theme } from 'herdr';

// the theme colours this file reads, each present in every herdr theme
/** @typedef {Record<'background' | 'muted', import('gpui-kit').Color>} Theme */

export default class Chat extends View {
    render() {
        const t = /** @type {Theme} */ (theme());
        return v_flex()
            .size_full()
            .items_center()
            .justify_center()
            .bg(t.background)
            .text_color(t.muted)
            .text_size(13)
            .child(div().child('No thread is shown here yet'));
    }
}
