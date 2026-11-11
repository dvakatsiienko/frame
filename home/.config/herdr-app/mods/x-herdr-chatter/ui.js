// The look every x-herdr mod shares. This file is the source: each mod carries a copy as its own
// ui.js (a mod imports only from its folder), and herdr/kit/ui.test.ts reds a copy that drifted.
import { div } from 'gpui-kit';

// Design units at 13 px text: a mod passes each through its own scale (the chatter's px follows
// his Text size), never as px.
export const H = { lg: 32, md: 24, sm: 20 };
export const TEXT = { lg: 15, md: 13, sm: 12, xs: 11 };
export const RADIUS = { bubble: 12, card: 8, control: 6 };

// A hover that shifts the surface. Never opacity: a view with an opacity hover keeps its spinners
// inline, and each spinner step then rebuilds the whole view.
/** @param {any} el @param {Record<string, string>} t */
export const clickable = (el, t) =>
    el.cursor_pointer().hover((s) => s.bg(t.hover));

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
