// the press button our mods draw: orbit's tick and replay, the phases' tick, the note box's join and send, so each looks
// and acts the same (dima, 26 Nov 17:37: «a reusable button … customizable (styles, size)»). a size and a variant, as a ui
// kit's button has; a locked one stays, still

import { Button } from 'gpui-base';

import { focusBorder } from './focus-ring.js';

/** @typedef {`#${string}`} Color */
/** @typedef {{ accent: Color, border: Color, foreground: Color, hover: Color, solid: Color, solid_foreground: Color, raised: Color, surface?: Color }} PressTheme */

// how tall, how wide its sides, how large its words
const SIZES = /** @type {const} */ ({
    md: { h: 28, px: 12, text: 13 },
    sm: { h: 24, px: 10, text: 12 },
});

/**
 * @param {PressTheme} t
 * @param {{ id: string, label: string, onClick: (cx: import('gpui-kit').Context) => void, tip?: string, lockedTip?: string,
 *   variant?: 'primary' | 'outline', size?: keyof typeof SIZES, isLocked?: boolean, isFocused?: boolean, name?: string }} it `tip` none: no
 *   tooltip, `name` what a screen reader says when the label is an emoji
 */
export function pressButton(
    t,
    {
        id,
        isFocused = false,
        isLocked = false,
        label,
        lockedTip,
        name,
        onClick,
        size = 'md',
        tip,
        variant = 'outline',
    },
) {
    const isPrimary = variant === 'primary';
    const s = SIZES[size];
    return (
        Button.new(id)
            // a box's own keys press these, so Tab skips them (his 14:12 steer)
            .tab_stop(false)
            .h(s.h)
            .px(s.px)
            .flex_none()
            .flex()
            .items_center()
            .rounded(6)
            .border_1()
            .border_color(
                focusBorder(isFocused, t, isPrimary ? t.solid : t.border),
            )
            .bg(isPrimary ? t.solid : (t.surface ?? t.raised))
            .text_size(s.text)
            .text_color(isPrimary ? t.solid_foreground : t.foreground)
            .when(isPrimary, (el) => el.font_semibold())
            .when(Boolean(name), (el) => el.accessibility_label(name ?? ''))
            // delivered: it stays, still (dima, 21:03)
            .when(isLocked, (el) =>
                el
                    .opacity(0.6)
                    .when(Boolean(lockedTip), (e) =>
                        e.tooltip(lockedTip ?? ''),
                    ),
            )
            .when(!isLocked, (el) =>
                el
                    .cursor_pointer()
                    .hover((st) =>
                        isPrimary ? st.opacity(0.85) : st.bg(t.hover),
                    )
                    .when(Boolean(tip), (e) => e.tooltip(tip ?? ''))
                    .on_click((_e, cx) => onClick(cx)),
            )
            .child(label)
    );
}
