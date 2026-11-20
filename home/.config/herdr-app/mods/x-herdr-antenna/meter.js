// a row's context meter (FRM-618 rider E1): how full the thread's context is, calm, then warm where the second wind
// notices and hot where it must; colours from the theme's ansi green, yellow and red

import { h_flex } from 'gpui-base';
import { PathBuilder, div } from 'gpui-kit';

import { meterLevel } from './details.js';

/** @typedef {Record<string, import('gpui-kit').Color>} Theme */

/** @param {Theme} t @param {number} percent */
const levelColor = (t, percent) =>
    ({ calm: t.ansi2, hot: t.ansi1, warm: t.ansi3 })[meterLevel(percent)];

/** @param {Theme} t @param {number} percent */
const label = (t, percent) =>
    div().flex_none().text_size(11).text_color(t.dim).child(`${percent}%`);

const RING = 16;
const RADIUS = 6;

/** an arc from twelve o'clock, clockwise over `share` of the circle @param {number} share */
function arc(share) {
    const c = RING / 2;
    const at = (/** @type {number} */ s) => {
        const a = s * 2 * Math.PI;
        return /** @type {const} */ ([
            c + RADIUS * Math.sin(a),
            c - RADIUS * Math.cos(a),
        ]);
    };
    const path = PathBuilder.stroke(2.5).move_to(...at(0));
    // a whole circle is two halves: an arc to its own start draws nothing
    const half = Math.min(share, 0.5);
    path.arc_to(RADIUS, RADIUS, 0, false, true, ...at(half));
    if (share > 0.5)
        path.arc_to(
            RADIUS,
            RADIUS,
            0,
            false,
            true,
            ...at(Math.min(share, 0.9999)),
        );
    return path.build();
}

/** a ring filling clockwise, the number beside it @param {Theme} t @param {number} percent */
export function meterRing(t, percent) {
    const paint = (
        /** @type {number} */ share,
        /** @type {import('gpui-kit').Color} */ color,
    ) => globalThis.window.paint_path(arc(share), color).absolute().size(RING);
    return h_flex()
        .flex_none()
        .gap(4)
        .items_center()
        .child(
            div()
                .relative()
                .size(RING)
                .flex_none()
                .child(
                    paint(
                        1,
                        /** @type {import('gpui-kit').Color} */ (
                            `${t.foreground}26`
                        ),
                    ),
                )
                .when(percent > 0, (el) =>
                    el.child(paint(percent / 100, levelColor(t, percent))),
                ),
        )
        .child(label(t, percent));
}

/** five slim segments, each a fifth, lit in the level's colour @param {Theme} t @param {number} percent */
export function meterBars(t, percent) {
    const lit = Math.ceil(percent / 20);
    return h_flex()
        .flex_none()
        .gap(5)
        .items_center()
        .child(
            h_flex()
                .gap(2)
                .items_center()
                .children(
                    [0, 1, 2, 3, 4].map((i) =>
                        div()
                            .w(4)
                            .h(9)
                            .rounded(1.5)
                            .bg(i < lit ? levelColor(t, percent) : t.border),
                    ),
                ),
        )
        .child(label(t, percent));
}

/** the number in a pill tinted by the level @param {Theme} t @param {number} percent */
export function meterPill(t, percent) {
    const color = levelColor(t, percent);
    return div()
        .flex_none()
        .px(6)
        .h(17)
        .rounded(9)
        .flex()
        .items_center()
        .bg(/** @type {import('gpui-kit').Color} */ (`${color}24`))
        .text_size(10.5)
        .font_semibold()
        .text_color(color)
        .child(`${percent}%`);
}

/** the meter in his picked look, the ring for any other value @param {Theme} t @param {number} percent
 * @param {unknown} look the «Context meter» knob */
export function contextMeter(t, percent, look) {
    if (look === 'bars') return meterBars(t, percent);
    return look === 'pill' ? meterPill(t, percent) : meterRing(t, percent);
}
