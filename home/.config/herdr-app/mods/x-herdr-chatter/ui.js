// The look every x-herdr mod shares. This file is the source: each mod carries a copy as its own
// ui.js (a mod imports only from its folder), and herdr/kit/ui.test.ts reds a copy that drifted.
import { Switch } from 'gpui-base';
import { div } from 'gpui-kit';

// Design units at 13 px text: a mod passes each through its own scale (the chatter's px follows
// his Text size), never as px.
export const H = { lg: 32, md: 24, sm: 20 };
export const TEXT = { lg: 15, md: 13, sm: 12, xs: 11 };
export const RADIUS = { bubble: 12, card: 8, control: 6 };

/**
 * A labelled button, sized to its words; strong is the one solid primary of a panel.
 * @param {Record<string, string>} t the theme
 * @param {(n: number) => number} scale the mod's design-unit scale
 * @param {string} id
 * @param {any} label
 * @param {((e: any, cx: any) => void) | null} onClick
 * @param {boolean} [strong]
 */
export function button(t, scale, id, label, onClick, strong) {
    return div()
        .id(id)
        .px(10)
        .py(4)
        .rounded(RADIUS.control)
        .text_size(scale(TEXT.sm))
        .cursor_pointer()
        .bg(strong ? t.solid : t.raised)
        .text_color(strong ? t.solid_foreground : t.foreground)
        .hover((s) =>
            strong
                ? s.bg(t.accent).text_color(t.accent_foreground)
                : s.bg(t.hover),
        )
        .when(Boolean(onClick), (el) => el.on_click(onClick))
        .child(label);
}

/**
 * An on/off switch: the accent track with the knob at the right when on. herdr's Switch gives it
 * the switch role, a tab stop and Space, so it is never a clickable div. herdr drops hover and
 * tooltip on a Switch, so the track around it carries them.
 * @param {Record<string, string>} t the theme
 * @param {(n: number) => number} scale the mod's design-unit scale
 * @param {string} id
 * @param {boolean} isOn
 * @param {(isOn: boolean, cx: any) => void} onToggle
 * @param {{ isDisabled?: boolean, tip?: string }} [opts]
 */
export function toggleSwitch(t, scale, id, isOn, onToggle, opts = {}) {
    const knob = scale(H.sm) - 4;
    return div()
        .id(`${id}-track`)
        .w(scale(36))
        .h(scale(H.sm))
        .flex_none()
        .rounded_full()
        .bg(isOn ? t.accent : t.hover)
        .when(Boolean(opts.isDisabled), (el) => el.opacity(0.5))
        .when(!opts.isDisabled, (el) =>
            el
                .cursor_pointer()
                .hover((s) => s.bg(isOn ? t.accent : t.selected)),
        )
        .when(Boolean(opts.tip), (el) => el.tooltip(opts.tip))
        .child(
            Switch.new(id)
                .checked(isOn)
                .disabled(Boolean(opts.isDisabled))
                .size_full()
                .flex()
                .items_center()
                .p(2)
                .when(isOn, (el) => el.justify_end())
                .on_change((next, cx) => onToggle(next, cx))
                .child(
                    div()
                        .size(knob)
                        .rounded_full()
                        .bg(isOn ? t.accent_foreground : t.muted),
                ),
        );
}
