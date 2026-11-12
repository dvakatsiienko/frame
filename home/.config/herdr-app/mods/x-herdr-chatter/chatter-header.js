// x-herdr-chatter-header's look, the same file in x-herdr-chatter-header and x-herdr-chatter: one row, two views. herdr
// loads no module from outside a mod's own folder, so each mod carries a copy; chatter-header.test.ts holds them equal
import { h_flex } from 'gpui-base';
import { div } from 'gpui-kit';

// the Chat | Terminal switch (x-herdr-chatter-header-tabs): `here` is the view shown, `flip` goes to the other
/** @param {any} t @param {'chat' | 'terminal'} here @param {() => void} flip */
export function viewSwitch(t, here, flip) {
    /** @param {'chat' | 'terminal'} id @param {string} label */
    const seg = (id, label) =>
        div()
            .id(`view-${id}`)
            .px(8)
            .h(20)
            .flex()
            .items_center()
            .rounded(5)
            .text_size(11.5)
            .font_medium()
            .when(id === here, (el) =>
                el.bg(t.selected).text_color(t.foreground),
            )
            .when(id !== here, (el) =>
                el
                    .text_color(t.dim)
                    .cursor_pointer()
                    .hover((s) => s.text_color(t.foreground))
                    .on_click((_e, cx) => {
                        cx.stop_propagation();
                        flip();
                    }),
            )
            .child(label);
    return h_flex()
        .flex_none()
        .p(2)
        .gap(2)
        .rounded(7)
        .bg(t.surface)
        .border(1)
        .border_color(t.border)
        .child(seg('chat', 'Chat'))
        .child(seg('terminal', 'Terminal'));
}
