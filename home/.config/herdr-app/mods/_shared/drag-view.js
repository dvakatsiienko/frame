// the shared drag drawn (FRM-664): the zone feeds the pointer, each item lifts on press, dims while it is away, the
// items between it and its target slide one slot, a ghost follows the pointer and springs into its slot on the drop.
// Escape cancels while the zone holds the keyboard, which it takes only for a real drag and gives back after.

import { div } from 'gpui-kit';
import { focused, run } from 'herdr';

import { createDrag } from './drag.js';

const SETTLE_MS = 180;
const SLIDE_MS = 120;
const FALLBACK_SIZE = 30;

/**
 * the press, measured: its item, where its element starts in the window and its size along the axis
 * @template T
 * @typedef {{ item: T, start: number, size: number, label: string }} Held
 */
/** @typedef {Record<'raised' | 'border' | 'foreground', import('gpui-kit').Color>} DragTheme */
/** @typedef {import('gpui-kit').Context} Context */

/**
 * @template T
 * @param {{ axis: 'x' | 'y', onMove: (item: T, from: number, to: number) => void, onClick: (item: T) => void,
 *   focus: () => import('gpui-kit').FocusHandle }} options
 */
export function createListDrag({ axis, focus, onClick, onMove }) {
    /** @type {ReturnType<typeof createDrag<Held<T>>>} */
    const drag = createDrag({
        onClick: (/** @type {Held<T>} */ held) => onClick(held.item),
        onMove: (/** @type {Held<T>} */ held, from, to) =>
            onMove(held.item, from, to),
    });
    /** the zone's window origin along the axis, measured on every move over it */
    let origin = 0;
    /** the terminal that had the keyboard before a drag took it */
    /** @type {string | null} */
    let gaveFocus = null;
    const along = (/** @type {{ x: number, y: number }} */ p) =>
        axis === 'y' ? p.y : p.x;

    /** a release or cancel that starts a settle arms its own timer; a stale one ends nothing @param {Context} cx */
    const settleLater = (cx) => {
        const s = drag.state();
        if (s.name !== 'settling') return backToIdle();
        cx.timer.after(SETTLE_MS, (cx) => {
            if (drag.settled(s.token)) {
                backToIdle();
                cx.notify();
            }
        });
    };
    const backToIdle = () => {
        if (drag.state().name !== 'idle' || gaveFocus === null) return;
        run('pane.focus', { terminal: gaveFocus });
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
                    : (s.to - s.from) * size;
            const at = start - origin + offset;
            const ghost = div()
                .id('drag-ghost')
                .absolute()
                .spring(axis === 'y' ? 'top' : 'left')
                .flex()
                .items_center()
                .px(8)
                .rounded(8)
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
         * one draggable element: `from` is its place among its kind, `targetFor` where a held item lands over it
         * @template {import('gpui-kit').Element} E
         * @param {E} el @param {string} key @param {T | null} item null: it takes drops but lifts nothing
         * @param {number} from @param {(held: T) => number | null} targetFor @param {string} label @param {DragTheme} t
         * @returns {E}
         */
        item(el, key, item, from, targetFor, label, t) {
            const s = drag.state();
            const mine = s.name !== 'idle' && s.key === key;
            const at = s.name === 'idle' ? null : targetFor(s.item.item);
            const slide =
                s.name === 'dragging' && !mine && at !== null && s.to !== null
                    ? s.from < s.to && at > s.from && at <= s.to
                        ? -s.item.size
                        : s.from > s.to && at >= s.to && at < s.from
                          ? s.item.size
                          : 0
                    : 0;
            const placed = el
                .relative()
                .transition(axis === 'y' ? 'top' : 'left', SLIDE_MS)
                .transition('opacity', SLIDE_MS)
                .when(axis === 'y', (el) => el.top(slide))
                .when(axis === 'x', (el) => el.left(slide))
                .opacity(mine && s.name !== 'pressed' ? 0.3 : 1)
                .when(mine && s.name === 'pressed', (el) =>
                    el.bg(t.raised).shadow_md().cursor_grabbing(),
                )
                .on_mouse_move((_e, cx) => {
                    const now = drag.state();
                    if (
                        now.name === 'dragging' &&
                        drag.over(targetFor(now.item.item))
                    )
                        cx.notify();
                });
            if (item === null) return placed;
            return placed.on_mouse_down('left', (e, cx) => {
                const box = e.bounds;
                drag.press(
                    key,
                    {
                        item,
                        label,
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
                    if (was === 'pressed' && drag.state().name === 'dragging') {
                        gaveFocus = focused()?.terminal ?? null;
                        focus().focus();
                    }
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
