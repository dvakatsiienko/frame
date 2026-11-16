// x-herdr-chatter-header's look, the same file in x-herdr-chatter-header and x-herdr-chatter: one row, two views. herdr
// loads no module from outside a mod's own folder, so each mod carries a copy; chatter-header.test.ts holds them equal
import { h_flex } from 'gpui-base';
import { div, svg } from 'gpui-kit';

import { isPanelShown, panelPress } from './header-rules.js';

// what the tab bar held before the pills: + (a new tab's menu), Files and Changes (the side panel). drawn only where
// the layout block sets `tabBarButtons`, at the row's right end
/**
 * @param {any} t
 * @param {{ panel: any, body: any, enabled: string[], run: (command: string, args?: Record<string, unknown>) => void, openOverlay: (overlay: { height: number, kind: 'popup', mod: string, width: number }) => unknown }} at
 */
export function tabBarButtons(t, { panel, body, enabled, run, openOverlay }) {
    /** @param {string} id @param {string} label @param {string} icon */
    const panelButton = (id, label, icon) => {
        const isOn = isPanelShown(id, panel, body);
        return h_flex()
            .id(`head-panel-${id}`)
            .h(22)
            .px(7)
            .gap(5)
            .flex_none()
            .items_center()
            .rounded(6)
            .text_size(12)
            .cursor_pointer()
            .when(isOn, (el) => el.bg(t.selected).text_color(t.foreground))
            .when(!isOn, (el) => el.text_color(t.muted))
            .hover((s) => s.bg(isOn ? t.selected : t.hover))
            .on_click((_e, cx) => {
                cx.stop_propagation();
                for (const [command, args] of panelPress(id, panel, body))
                    run(command, args);
            })
            .child(svg(icon).size(13))
            .child(label);
    };
    return h_flex()
        .flex_none()
        .gap(2)
        .items_center()
        .child(
            div()
                .id('head-tab-new')
                .size(22)
                .flex()
                .flex_none()
                .items_center()
                .justify_center()
                .rounded(6)
                .text_size(15)
                .text_color(t.muted)
                .cursor_pointer()
                .hover((s) => s.bg(t.hover).text_color(t.foreground))
                .tooltip('New tab')
                .on_click((_e, cx) => {
                    cx.stop_propagation();
                    // herdr's own new-tab menu, as the tab bar's + opened it
                    openOverlay({
                        height: 512,
                        kind: 'popup',
                        mod: 'new-menu',
                        width: 250,
                    });
                })
                .child('+'),
        )
        .when(enabled.includes('files'), (el) =>
            el.child(panelButton('files', 'Files', 'mods/files/file.svg')),
        )
        .when(enabled.includes('changes'), (el) =>
            el.child(
                panelButton('changes', 'Changes', 'mods/changes/changes.svg'),
            ),
        );
}

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
