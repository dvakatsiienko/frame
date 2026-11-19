// the shared drag drawn (FRM-664): the zone feeds the pointer, each item lifts on press, dims while it is away, the
// items between it and its target slide one slot, a ghost follows the pointer and springs into its slot on the drop.
// Escape cancels while the zone holds the keyboard, which it takes only for a real drag and gives back after.

import { div } from 'gpui-kit';
import { focused, run } from 'herdr';

import { createDrag, placeAt } from './drag.js';

const SETTLE_MS = 180;
const SLIDE_MS = 120;
const FALLBACK_SIZE = 30;

/**
 * the press, measured: its item, where its element starts in the window and its size along the axis
 * @template T
 * @typedef {{ item: T, start: number, size: number, label: string, places: number }} Held
 */

/** @typedef {Record<'raised' | 'selected' | 'border' | 'foreground', import('gpui-kit').Color>} DragTheme */
/** @typedef {import('gpui-kit').Context} Context */

/**
 * @template T
 * @param {{ axis: 'x' | 'y', gap?: number, onMove: (item: T, from: number, to: number) => void, onClick: (item: T) => void,
 *   focus: () => import('gpui-kit').FocusHandle }} options
 */
export function createListDrag({ axis, focus, gap = 0, onClick, onMove }) {
    /** @type {ReturnType<typeof createDrag<Held<T>>>} */
    const drag = createDrag({
        onClick: (/** @type {Held<T>} */ held) => onClick(held.item),
        onMove: (/** @type {Held<T>} */ held, from, to) =>
            onMove(held.item, from, to),
    });
    /** the zone's window origin along the axis, measured on every move over it */
    let origin = 0;
    /** the pane that had the keyboard before a drag took it; a drag takes it only when it can give it back */
    /** @type {{ pane: string } | { terminal: string } | null} */
    let gaveFocus = null;
    const along = (/** @type {{ x: number, y: number }} */ p) =>
        axis === 'y' ? p.y : p.x;

    /** a release or cancel that starts a settle arms its own timer; a stale one ends nothing @param {Context} cx */
    const settleLater = (cx) => {
        const s = drag.state();
        if (s.name !== 'settling') return backToIdle();
        cx.timer.after(SETTLE_MS, (cx) => {
            const isEnded = drag.settled(s.token);
            backToIdle();
            if (isEnded) cx.notify();
        });
    };
    const backToIdle = () => {
        if (drag.state().name !== 'idle' || gaveFocus === null) return;
        run('pane.focus', gaveFocus);
        gaveFocus = null;
    };
    /** @param {Context} cx */
    const cancel = (cx) => {
        if (!drag.cancel()) return;
        settleLater(cx);
        cx.notify();
    };

    return {
        cancel,

        /** the ghost under the pointer, springing into its slot on a drop or home on a cancel @param {DragTheme} t */
        ghost(t) {
            const s = drag.state();
            if (s.name !== 'dragging' && s.name !== 'settling') return null;
            const { label, size, start } = s.item;
            const offset =
                s.name === 'dragging'
                    ? along(s.pointer) - along(s.at)
                    : (s.to - s.from) * (size + gap);
            const at = start - origin + offset;
            const ghost = div()
                .id('drag-ghost')
                .absolute()
                .spring(axis === 'y' ? 'top' : 'left')
                .flex()
                .items_center()
                .px(8)
                .rounded(axis === 'y' ? 8 : 13)
                .border_1()
                .border_color(t.border)
                .bg(t.raised)
                .shadow_md()
                .text_size(12.8)
                .text_color(t.foreground)
                .truncate()
                .cursor_grabbing()
                .child(label);
            return axis === 'y'
                ? ghost.left(0).right(0).h(size).top(at)
                : ghost.top(0).bottom(0).w(size).left(at);
        },

        /**
         * one draggable element: `from` is its place among its kind's `places`, `targetFor` its place for a held item
         * of another row (null: not of its kind, so it never slides)
         * @template {import('gpui-kit').Element} E
         * @param {E} el
         * @param {{ key: string, item: T | null, from: number, places: number, targetFor: (held: T) => number | null,
         *   label: string }} it `item` null: it lifts nothing
         * @param {DragTheme} t
         * @returns {E}
         */
        item(el, { from, item, key, label, places, targetFor }, t) {
            const s = drag.state();
            const mine = s.name !== 'idle' && s.key === key;
            const at = s.name === 'idle' ? null : targetFor(s.item.item);
            // the neighbours between the source and its target slide one slot toward the source; the dimmed source
            // stands in the target's slot, so nothing overlaps
            const slot = s.name === 'idle' ? 0 : s.item.size + gap;
            const slide =
                s.name !== 'dragging' || s.to === null || at === null
                    ? 0
                    : mine
                      ? (s.to - s.from) * slot
                      : s.from < s.to && at > s.from && at <= s.to
                        ? -slot
                        : s.from > s.to && at >= s.to && at < s.from
                          ? slot
                          : 0;
            // a drop that moved reorders the rows in the same frame the slides end, and the two cancel out: animated, the
            // rows would swing out a slot and back (dima's 16:32 video), so they settle at once. a cancel slides home
            const isSliding =
                s.name === 'dragging' ||
                (s.name === 'settling' && s.to === s.from);
            const placed = el
                .relative()
                .when(isSliding, (el) =>
                    el.transition(axis === 'y' ? 'top' : 'left', SLIDE_MS),
                )
                .transition('opacity', SLIDE_MS)
                .when(axis === 'y', (el) => el.top(slide))
                .when(axis === 'x', (el) => el.left(slide))
                .opacity(mine && s.name !== 'pressed' ? 0.3 : 1)
                .when(mine && s.name === 'pressed', (el) =>
                    el
                        .bg(t.selected)
                        .border_1()
                        .border_color(t.border)
                        .shadow_lg()
                        .cursor_grabbing(),
                );
            if (item === null) return placed;
            return placed.on_mouse_down('left', (e, cx) => {
                const box = e.bounds;
                drag.press(
                    key,
                    {
                        item,
                        label,
                        places,
                        size: box
                            ? axis === 'y'
                                ? box.height
                                : box.width
                            : FALLBACK_SIZE,
                        start:
                            along(e.position) -
                            (e.local_position ? along(e.local_position) : 0),
                    },
                    from,
                    e.position,
                );
                // a press while the last drop settled ends it: the keyboard goes back now, not on its timer
                backToIdle();
                cx.notify();
            });
        },
        state: () => drag.state(),

        /**
         * the list's container: the drag's whole zone
         * @template {import('gpui-kit').Element} E @param {E} el @returns {E}
         */
        zone(el) {
            return el
                .track_focus(focus())
                .on_key_down((e, cx) => {
                    if (e.key === 'escape') cancel(cx);
                })
                .on_mouse_move((e, cx) => {
                    origin = along(e.position) - along(e.local_position);
                    const was = drag.state().name;
                    if (!drag.pointer(e.position)) return;
                    const now = drag.state();
                    if (now.name !== 'dragging') return cx.notify();
                    if (was === 'pressed') {
                        const had = focused();
                        gaveFocus = had?.pane
                            ? { pane: had.pane }
                            : had?.terminal
                              ? { terminal: had.terminal }
                              : null;
                        if (gaveFocus) focus().focus();
                    }
                    drag.over(
                        placeAt(
                            {
                                from: now.from,
                                places: now.item.places,
                                slot: now.item.size + gap,
                            },
                            along(now.pointer) - along(now.at),
                        ),
                    );
                    cx.notify();
                })
                .on_mouse_up('left', (_e, cx) => {
                    if (!drag.release()) return;
                    settleLater(cx);
                    cx.notify();
                })
                .on_hover((isOver, cx) => {
                    if (!isOver) cancel(cx);
                });
        },
    };
}
