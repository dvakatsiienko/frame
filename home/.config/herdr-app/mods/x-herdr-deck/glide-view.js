// glide under antenna (FRM-618 slice C): a `view: 'glide'` copy of the deck draws each running lane's card at the
// sidebar's bottom, reads lanes.json on its own, and sizes its block to its cards so it grows up as lanes join

import { h_flex, v_flex } from 'gpui-base';
import { div } from 'gpui-kit';
import { exec, run, theme } from 'herdr';

import { createListDrag } from './drag-view.js';
import {
    cardKey,
    inHisOrder,
    loadOrder,
    movedOrder,
    saveOrder,
} from './glide-order.js';
import { GLIDE_MAX_PX, glideResize } from './glide-size.js';
import { laneTicket, lanesShown, stepMark } from './lanes.js';
import { SANS, SIZE, bar, line } from './look.js';
import { ticketUrl } from './orbit.js';
import { LANES, json, onShelfWrite } from './shelf.js';

/** @typedef {import('./deck-types.js').Theme} Theme */
/** @typedef {import('./deck-types.js').Context} Context */
/** @typedef {import('./lanes.js').Lane} Lane */
/** @typedef {import('./lanes.js').LaneItem} LaneItem */

// a read that gave nothing is asked again this soon, with no write to wake it
const REREAD_MS = 2000;

// below this the sidebar is a rail, the width antenna draws its own rail at
const RAIL_PX = 160;

// the space between two cards, which the drag slides a card by
const CARD_GAP = 8;

/**
 * @param {string} block the layout node glide sizes, the copy's `props.block`
 * @param {import('./glide-order.js').OrderStore} [store] where his order of the cards is kept, herdr's storage
 */
export function createGlide(block, store = localStorage) {
    /** @type {Lane[]} the cards in his order */
    let lanes = [];
    let order = loadOrder(store);
    /** @type {ReturnType<typeof createListDrag<string>> | null} one drag, made with the copy's focus at init */
    let drag = null;
    /** @type {Map<string, number>} each card's measured height: an open card is taller, the drag passes it at its own half */
    const heights = new Map();
    /** the cards opened to every step @type {Set<string>} */
    const open = new Set();
    let width = Infinity;
    // the block's own height and its cards' height, both measured
    let blockPx = 0;
    let contentPx = 0;

    let reads = 0;
    /** @param {Context} cx */
    const read = (cx) =>
        cx.spawn(async (cx) => {
            const mine = ++reads;
            const body = await json(LANES);
            // a read that answers after a later one draws nothing
            if (mine !== reads) return;
            // a file that would not read: the cards stay
            if (!body) {
                cx.timer.after(REREAD_MS, (later) => {
                    if (mine === reads) read(later);
                });
                return;
            }
            lanes = inHisOrder(lanesShown(body), order);
            // a gone card's height goes with it
            const shown = new Set(lanes.map(keyOf));
            for (const key of heights.keys())
                if (!shown.has(key)) heights.delete(key);
            cx.notify();
        });

    const fit = () => {
        const px = glideResize({ blockPx, contentPx, lanes: lanes.length });
        if (px !== null) run('layout.resize', { id: block, px });
    };

    const keyOf = cardKey;

    /** what a card shows, drawn again for its ghost while he drags it @param {Theme} t @param {Lane} l @param {import('gpui-kit').Element} el */
    const cardBody = (t, l, el) => {
        const items = l.items ?? [];
        const current = Math.min(l.current ?? 0, items.length);
        const key = keyOf(l);
        const isOpen = open.has(key);
        const now = items[current];
        const ticketId = laneTicket(l);
        const ticket = ticketUrl(ticketId);
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
        return el
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
                                .child(ticketId ?? ''),
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

    /** @param {Theme} t @param {Lane} l @param {number} at its place among the cards */
    const card = (t, l, at) => {
        const key = keyOf(l);
        const el = cardBody(
            t,
            l,
            v_flex()
                .id(`lane-${key}`)
                .min_w(0)
                .p(12)
                .gap(8)
                .rounded(8)
                .border_1()
                .border_color(t.border)
                .cursor_pointer()
                .hover((st) => st.bg(t.hover))
                .on_size_change((size) => heights.set(key, size.height)),
        );
        return drag
            ? drag.item(
                  el,
                  {
                      from: at,
                      item: key,
                      key,
                      label: `🛼 ${l.title}`,
                      look: () =>
                          cardBody(t, l, v_flex().size_full().p(12).gap(8)),
                      places: lanes.length,
                      sizes: () => {
                          const all = lanes.map((c) => heights.get(keyOf(c)));
                          return all.every((h) => h !== undefined)
                              ? /** @type {number[]} */ (all)
                              : undefined;
                      },
                      targetFor: () => at,
                  },
                  t,
              )
            : el;
    };

    /** the cards, the drag's whole zone: a drag past its edge springs home @param {Theme} t */
    const cards = (t) => {
        const list = v_flex()
            .id('x-herdr-glide-zone')
            .relative()
            .w_full()
            .gap(CARD_GAP)
            .children(lanes.map((l, i) => card(t, l, i)));
        // the padding sits outside the zone, so the ghost, as wide as the zone, is as wide as a card
        return v_flex()
            .w_full()
            .px(12)
            .py(4)
            .child(
                drag
                    ? drag
                          .zone(list)
                          .children([drag.ghost(t)].filter((g) => g !== null))
                    : list,
            );
    };

    return {
        /** @param {Context} cx */
        init(cx) {
            const keys = cx.focus_handle();
            drag = createListDrag({
                axis: 'y',
                focus: () => keys,
                gap: CARD_GAP,
                // a click opens the card to every step or folds it; a drag never does
                onClick: (key) => {
                    open.has(key) ? open.delete(key) : open.add(key);
                },
                // the card by its key: a lanes.json read during the drag may have moved its index
                onMove: (key, _from, to) => {
                    const from = lanes.findIndex((l) => keyOf(l) === key);
                    if (from < 0) return;
                    order = movedOrder(lanes, from, to);
                    saveOrder(store, order);
                    lanes = inHisOrder(lanes, order);
                },
            });
            onShelfWrite(cx, LANES, read);
        },

        render() {
            const t = /** @type {Theme} */ (theme());
            const isRail = width < RAIL_PX;
            const head = isRail
                ? div()
                      .py(8)
                      .text_size(SIZE.secondary)
                      .text_color(t.foreground)
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
                                            el2.child(cards(t)),
                                        ),
                                ),
                        ),
                );
        },
    };
}
