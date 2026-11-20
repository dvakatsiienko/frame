// x-antenna-settings, the cog's small popup: one row per knob, a switch or a pair of choices; a press saves at once and
// antenna redraws beside it while the popup stays open

import { h_flex, v_flex } from 'gpui-base';
import { div } from 'gpui-kit';

import { ANTENNA_KNOBS } from './settings.js';

/** @typedef {import('./main.js').Theme} Theme */

// «Context meter» and its four choices on one row
export const POPUP_WIDTH = 300;
// the title, every knob's row and the padding: the popup fits its rows exactly
export const POPUP_HEIGHT = 30 + ANTENNA_KNOBS.length * 32 + 12;

/** @param {Theme} t @param {boolean} isOn */
const knobSwitch = (t, isOn) =>
    div()
        .w(26)
        .h(15)
        .flex_none()
        .rounded(8)
        .p(2)
        .flex()
        .items_center()
        .when(isOn, (el) => el.justify_end())
        .bg(isOn ? t.accent : t.input)
        .child(div().size(11).rounded(6).bg(t.background));

/**
 * @param {Theme} t
 * @param {Record<string, unknown>} values
 * @param {(key: string, value: unknown) => void} change
 */
export function settingsPopup(t, values, change) {
    return v_flex()
        .w_full()
        .p(6)
        .bg(t.popover)
        .text_size(12.8)
        .child(
            div()
                .px(8)
                .pt(4)
                .pb(6)
                .text_size(11)
                .text_color(t.dim)
                .child('Antenna'),
        )
        .children(
            ANTENNA_KNOBS.map((k) => {
                const value = values[k.key];
                const row = h_flex()
                    .id(`knob-${k.key}`)
                    .h(32)
                    .px(8)
                    .gap(9)
                    .rounded(7)
                    .items_center()
                    .text_color(t.foreground)
                    .child(div().flex_1().truncate().child(k.label));
                if (!k.choices)
                    return row
                        .cursor_pointer()
                        .hover((el) => el.bg(t.hover))
                        .on_click(() => change(k.key, !value))
                        .child(knobSwitch(t, value === true));
                return row.child(
                    h_flex()
                        .flex_none()
                        .p(2)
                        .gap(2)
                        .rounded(7)
                        .bg(t.input)
                        .children(
                            k.choices.map((c) =>
                                div()
                                    .id(`knob-${k.key}-${c.value}`)
                                    .px(8)
                                    .h(20)
                                    .rounded(5)
                                    .flex()
                                    .items_center()
                                    .text_size(11.5)
                                    .cursor_pointer()
                                    .when(c.value === value, (el) =>
                                        el
                                            .bg(t.raised)
                                            .text_color(t.foreground),
                                    )
                                    .when(c.value !== value, (el) =>
                                        el
                                            .text_color(t.muted)
                                            .hover((s) =>
                                                s.text_color(t.foreground),
                                            ),
                                    )
                                    .on_click(() => change(k.key, c.value))
                                    .child(c.label),
                            ),
                        ),
                );
            }),
        );
}
