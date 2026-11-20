// glide under antenna (FRM-618 slice C): a `view: 'glide'` copy of the deck draws each running lane's card at the
// sidebar's bottom, reads lanes.json on its own, and sizes its block to its cards so it grows up as lanes join

import { h_flex, v_flex } from 'gpui-base';
import { div } from 'gpui-kit';
import { exec, run, theme, watchFolder } from 'herdr';

import { GLIDE_MAX_PX, glideResize } from './glide-size.js';
import { lanesShown, stepMark } from './lanes.js';
import { SANS, SIZE, bar, line } from './look.js';
import { ticketUrl } from './orbit.js';
import { CLAUDE, LANES, json } from './shelf.js';

/** @typedef {import('./main.js').Theme} Theme */
/** @typedef {import('./main.js').Context} Context */
/** @typedef {import('./lanes.js').Lane} Lane */
/** @typedef {import('./lanes.js').LaneItem} LaneItem */

// below this the sidebar is a rail, the width antenna draws its own rail at
const RAIL_PX = 160;

/** @param {string} block the layout node glide sizes, the copy's `props.block` */
export function createGlide(block) {
    /** @type {Lane[]} */
    let lanes = [];
    /** the cards opened to every step @type {Set<string>} */
    const open = new Set();
    let width = Infinity;
    // the block's own height and its cards' height, both measured
    let blockPx = 0;
    let contentPx = 0;

    /** @param {Context} cx */
    const read = (cx) =>
        cx.spawn(async (cx) => {
            lanes = lanesShown(await json(LANES));
            cx.notify();
        });

    const fit = () => {
        const px = glideResize({ blockPx, contentPx, lanes: lanes.length });
        if (px !== null) run('layout.resize', { id: block, px });
    };

    /** @param {Theme} t @param {Lane} l */
    const card = (t, l) => {
        const items = l.items ?? [];
        const current = Math.min(l.current ?? 0, items.length);
        const key = l.id ?? l.title;
        const isOpen = open.has(key);
        const now = items[current];
        const ticket = ticketUrl(l.ticket);
        /** @param {LaneItem} item @param {number} i */
        const step = (item, i) =>
            h_flex()
                .gap(6)
                .child(
                    div()
                        .w(12)
                        .flex_none()
                        .text_size(SIZE.secondary)
                        .text_color(item.isDone ? t.working : t.muted)
                        .child(stepMark(item, i, current)),
                )
                .child(
                    line(i === current ? t.foreground : t.muted, SIZE.secondary)
                        .when(i === current, (el) => el.font_semibold())
                        .child(item.text),
                );
        return v_flex()
            .id(`lane-${key}`)
            .min_w(0)
            .mx(12)
            .my(4)
            .p(12)
            .gap(8)
            .rounded(8)
            .border_1()
            .border_color(t.border)
            .cursor_pointer()
            .hover((st) => st.bg(t.hover))
            .tooltip(isOpen ? 'collapse' : 'show every step')
            .on_click((_e, cx) => {
                isOpen ? open.delete(key) : open.add(key);
                cx.notify();
            })
            .child(
                h_flex()
                    .gap(8)
                    .items_center()
                    .child(line(t.foreground, SIZE.main).child(`🛼 ${l.title}`))
                    .when(Boolean(ticket), (el) =>
                        el.child(
                            div()
                                .id(`lane-ticket-${key}`)
                                .flex_none()
                                .px(6)
                                .rounded(4)
                                .border_1()
                                .border_color(t.border)
                                .text_size(SIZE.small)
                                .text_color(t.muted)
                                .cursor_pointer()
                                .hover((st) =>
                                    st.text_color(t.foreground).underline(),
                                )
                                .tooltip(`open ${l.ticket} in linear`)
                                .on_mouse_down('left', (_e, cx) =>
                                    cx.stop_propagation(),
                                )
                                .on_click((_e, cx) => {
                                    cx.stop_propagation();
                                    cx.spawn(async () => {
                                        await exec('open', [
                                            ticket ?? '',
                                        ]).catch(
                                            /** @returns {null} */ () => null,
                                        );
                                    });
                                })
                                .child(l.ticket ?? ''),
                        ),
                    )
                    .child(
                        div()
                            .flex_none()
                            .text_size(SIZE.small)
                            .text_color(t.muted)
                            .child(`${l.done ?? current}/${items.length}`),
                    ),
            )
            .child(
                div()
                    .w_full()
                    .child(
                        bar(
                            t,
                            items.length
                                ? (100 * (l.done ?? current)) / items.length
                                : 0,
                            '100%',
                            t.working,
                        ),
                    ),
            )
            .when(isOpen, (el) =>
                el.children(items.map((it, i) => step(it, i))),
            )
            .when(!isOpen && Boolean(now), (el) =>
                now ? el.child(step(now, current)) : el,
            );
    };

    return {
        /** @param {Context} cx */
        init(cx) {
            read(cx);
            cx.spawn(async (cx) => {
                for (;;) {
                    const changed = await watchFolder(`${CLAUDE}/shelf`).catch(
                        () =>
                            /** @type {Promise<string[]>} */ (
                                new Promise((done) =>
                                    cx.timer.after(5000, () => done([LANES])),
                                )
                            ),
                    );
                    // a batch holding the folder itself is herdr's «refresh everything»
                    if (
                        changed.includes(LANES) ||
                        changed.includes(`${CLAUDE}/shelf`)
                    )
                        read(cx);
                }
            });
        },

        render() {
            const t = /** @type {Theme} */ (theme());
            const isRail = width < RAIL_PX;
            const head = isRail
                ? div()
                      .py(8)
                      .text_size(SIZE.secondary)
                      .text_color(t.foreground)
                      .tooltip(`glide: ${lanes.length} running`)
                      .child(`🛼 ${lanes.length}`)
                : div()
                      .mx(12)
                      .mt(4)
                      .mb(4)
                      .pt(8)
                      .border_t_1()
                      .border_color(t.border)
                      .text_size(SIZE.secondary)
                      .font_semibold()
                      .text_color(t.foreground)
                      .child(
                          `🛼 glide: ${lanes.length} ${lanes.length === 1 ? 'lane' : 'lanes'}`,
                      );
            return v_flex()
                .id('x-herdr-glide')
                .cursor_default()
                .font_family(SANS)
                .size_full()
                .bg(t.canvas)
                .on_size_change((size, cx) => {
                    const wasRail = isRail;
                    width = size.width;
                    blockPx = size.height;
                    fit();
                    if (width < RAIL_PX !== wasRail) cx.notify();
                })
                .child(
                    v_flex()
                        .id('x-herdr-glide-scroll')
                        .size_full()
                        .min_w(0)
                        .overflow_x_hidden()
                        .max_h(GLIDE_MAX_PX)
                        .overflow_y_scroll()
                        .child(
                            v_flex()
                                .id('x-herdr-glide-cards')
                                .w_full()
                                .pb(8)
                                .when(isRail, (el) => el.items_center())
                                .on_size_change((size) => {
                                    contentPx = size.height;
                                    fit();
                                })
                                .when(lanes.length > 0, (el) =>
                                    el
                                        .child(head)
                                        .when(!isRail, (el2) =>
                                            el2.children(
                                                lanes.map((l) => card(t, l)),
                                            ),
                                        ),
                                ),
                        ),
                );
        },
    };
}
