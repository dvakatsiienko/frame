// the chat's message list: the rows on screen, his reading place in them, the width a row may take, and the
// right-click menu over a message
import {
    VirtualListScrollHandle,
    h_flex,
    v_flex,
    v_virtual_list,
} from 'gpui-base';
import { div } from 'gpui-kit';
import { exec, home, settings } from 'herdr';

import { openArgs } from './files.js';
import { guessHeight } from './heights.js';
import { ICONS } from './icons.js';
import { copyText, createMessageMenu, menuPlace } from './menu.js';
import { createPlace } from './place.js';

/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./row-model.js').Row} Row */
/** @typedef {import('./chat-types.js').Theme} Theme */

// the readable column of a narrow look (the old chat's)
const NARROW = 820;
// [TRACE-place] how long after an open the list's asks are traced
const TRACE_MS = 8000;
// his reading place is saved this long after his last scroll step
const PLACE_SAVE_MS = 600;
// how long after a held place was last asked for the list stays unseen: its landing takes two frames, and a
// reload asks again as each real height arrives
const SETTLE_MS = 120;
// the right-click menu's size, one row; its note under the quill once a message is copied
const MENU_SIZE = { h: 34, w: 200 };
const COPIED_NOTE = 'Message copied';

/** where his reading place in a thread is kept @param {string} file */
export const placeKey = (file) => `place:${file}`;

/**
 * @typedef {object} MessageListDeps
 * @property {() => string | null} file the shown thread's transcript
 * @property {(note: string, cx: Context) => void} flash a note under the quill that leaves on its own
 * @property {ReturnType<typeof import('./heights.js').createHeights>} heights
 * @property {(cx: Context) => void} loadEarlier the next older page, asked near the first row
 * @property {ReturnType<typeof import('./picture-viewer.js').createPictureViewer>} pictures
 * @property {() => unknown} reader the shown thread's reader: a save for an earlier opening is dropped
 * @property {ReturnType<typeof import('./message-row.js').createMessageRows>} rows
 */

/** @param {MessageListDeps} deps */
export function createMessageList(deps) {
    const scroll = VirtualListScrollHandle.new();
    /** his reading place: following the newest, or the first message on screen and the px of it above the view */
    const at = createPlace();
    /** the right-click menu on a message (slice 7) */
    const messageMenu = createMessageMenu();
    let width = 0;
    let viewH = 0;
    /** bumped when the width or the look changes: rich text laid out for the old one is never reused */
    let widthGen = 0;
    /** @type {number[]} */
    let sizes = [];
    /** the rows the list draws @type {readonly Row[]} */
    let shownRows = [];
    /** the look's width, and its parts that move rows as last drawn: a change holds his place */
    let lookWidth = 'full';
    let lookKey = '';
    /** [TRACE-place] the list's asks are traced until then, after an open */
    let traceUntil = 0;
    /** until then the list is not shown: a held place is still landing as real heights arrive */
    let settleUntil = 0;
    let lastWheelAt = 0;

    /** the widest a row or the quill draws: a readable column when narrow, the list's own width when full */
    const column = () =>
        lookWidth === 'narrow' ? NARROW : Math.max(width, NARROW);
    /** the width a row may take: the list's, at most the column */
    const room = () => Math.min(width || NARROW, column());

    /**
     * @param {readonly Row[]} rows
     * @param {Theme} t
     * @param {Context} cx
     */
    function view(rows, t, cx) {
        const zoom = Number(settings().zoom) || 1;
        deps.rows.markTurn(rows);
        const booked = deps.rows.booked(rows);
        sizes = deps.heights.sizes(booked, (row) => guessHeight(row, room()));
        const pre = `w${widthGen}-`;
        const plan = at.plan(rows, sizes, viewH);
        if (plan.ask && Date.now() < traceUntil)
            trace(
                `plan ask=${plan.ask} seekAt=${plan.seekAt} follow=${at.follow} held=${at.isHeld}`,
            );
        const { cutAt, cutOffset, itemSizes, rowAt } = plan;
        // his place, or the newest: asked of the list before the frame that draws these rows
        if (plan.ask === 'lift') {
            // the list lands an item's top on the view's top only from below it: to the end first, then the place
            scroll.scroll_to_bottom();
            cx.timer.after(0, (later) => later.notify());
        } else if (plan.ask === 'seek')
            scroll.scroll_to_item(plan.seekAt, 'top');
        else if (plan.ask === 'end') scroll.scroll_to_bottom();
        // a held place lands unseen: the frames it takes would show him other rows first
        const settleFor = at.isHeld ? settleUntil - Date.now() : 0;
        const isSettling = settleFor > 0;
        if (isSettling)
            cx.timer.after(settleFor + 1, (later) => later.notify());
        const list = v_virtual_list(
            'chat-rows',
            itemSizes.length,
            itemSizes,
            (i) => {
                const id = rows[rowAt(i)]?.id ?? `end-${i}`;
                if (i === cutAt) return `${id}#above`;
                return i === cutAt + 1 && cutAt >= 0 ? `${id}#below` : id;
            },
            (drawn) => {
                // no redraw is asked for in here, herdr refuses one: a ↓ that should leave does so at the next draw
                at.drawn(drawn, plan, Date.now());
                const items = [];
                for (let i = drawn.start; i < drawn.end; i++) {
                    const row = rows[rowAt(i)];
                    const box = div()
                        .relative()
                        .w_full()
                        .h(itemSizes[i] ?? 1);
                    // an end mark (follow.js END_MARKS): the list pairs each element with its item, so none is skipped
                    if (!row) {
                        items.push(box);
                        continue;
                    }
                    if (i === cutAt)
                        items.push(
                            box
                                .overflow_hidden()
                                .child(deps.rows.row(row, t, `${pre}a-`)),
                        );
                    else if (cutAt >= 0 && i === cutAt + 1)
                        items.push(
                            box.overflow_hidden().child(
                                div()
                                    .absolute()
                                    .top(-cutOffset)
                                    .left(0)
                                    .w_full()
                                    .child(deps.rows.row(row, t, `${pre}b-`)),
                            ),
                        );
                    else items.push(box.child(deps.rows.row(row, t, pre)));
                }
                return items;
            },
        )
            .track_scroll(scroll)
            // a right-click names the row first; the list's own handler below then opens the menu where it was
            .on_item_secondary_click((key, event) => {
                const id = key.replace(/#(?:above|below)$/, '');
                messageMenu.hit(
                    event.position,
                    copyText(rows.find((r) => r.id === id)),
                );
            })
            // a file row opens its file in its app, a png in Preview (FRM-587)
            .on_item_click((key, cx) => {
                const press = deps.rows.press(rows, key);
                if (press?.kind === 'redraw') cx.notify();
                else if (press?.kind === 'pictures')
                    deps.pictures.show(press.files, press.at, cx);
                else if (press?.kind === 'file')
                    exec('open', openArgs(press.path)).catch(() => {});
            })
            .size_full();
        return div()
            .id('chat-list')
            .on_mouse_down('left', (_event, cx) => cx.stop_propagation())
            .on_mouse_down('right', (event, cx) => {
                const local = event.local_position ?? { x: 0, y: 0 };
                messageMenu.open(event.position, {
                    x: local.x / zoom,
                    y: local.y / zoom,
                });
                cx.notify();
            })
            .relative()
            .flex_1()
            .min_h(0)
            .overflow_hidden()
            .opacity(isSettling ? 0 : 1)
            .on_size_change((size, cx) => {
                const drawnWidth = size.width / zoom;
                const height = size.height / zoom;
                if (Math.abs(drawnWidth - width) > 1) {
                    width = drawnWidth;
                    widthGen += 1;
                    readPlace();
                    deps.heights.clear();
                    // every height is guessed again: his place is brought back as the real ones arrive
                    holdPlace();
                }
                viewH = height;
                cx.notify();
            })
            .on_scroll_wheel((event, cx) => {
                if (messageMenu.state) {
                    messageMenu.close();
                    cx.notify();
                }
                const step = at.wheel(
                    (event.delta?.y ?? 0) / zoom,
                    shownRows,
                    sizes,
                    viewH,
                    Date.now(),
                );
                if (step.isIgnored) return;
                savePlaceSoon(cx);
                // within a screen of the first row: the next older page, one at a time
                if (!at.follow && at.top < viewH) deps.loadEarlier(cx);
                if (step.hadCut || step.isFollowChanged) cx.notify();
            })
            .child(list)
            .child(measurer(booked, t, `m${widthGen}-`))
            .when(Boolean(messageMenu.state), (el) =>
                el.child(messageMenuView(t)),
            )
            .when(!at.follow, (el) =>
                el.child(
                    div()
                        .id('chat-newest')
                        .absolute()
                        .bottom(12)
                        .right(16)
                        .px(9)
                        .py(3)
                        .rounded(10)
                        .bg(t.raised)
                        .text_color(t.muted)
                        .tooltip('Go to the newest')
                        .child(ICONS.newest)
                        .on_click((_event, cx) => {
                            at.newest();
                            const file = deps.file();
                            if (file) localStorage.removeItem(placeKey(file));
                            cx.notify();
                        }),
                ),
            );
    }

    /** the right-click menu: «Copy message», dim when the press was on no message @param {Theme} t */
    function messageMenuView(t) {
        const menu = messageMenu.state;
        const text = menu?.text ?? null;
        const place = menuPlace(
            { x: menu?.x ?? 0, y: menu?.y ?? 0 },
            { h: viewH, w: width || NARROW },
            MENU_SIZE,
        );
        /** @param {Context} cx */
        const close = (cx) => {
            messageMenu.close();
            cx.notify();
        };
        /** @param {string} id @param {string} label @param {(cx: Context) => void} act */
        const item = (id, label, act) =>
            h_flex()
                .id(`chat-message-menu-${id}`)
                .h(26)
                .px(8)
                .items_center()
                .rounded(5)
                .text_size(13)
                .text_color(text ? t.foreground : t.dim)
                .when(Boolean(text), (el) =>
                    el
                        .cursor_pointer()
                        .hover((s) => s.bg(t.hover))
                        .on_click((_event, cx) => {
                            close(cx);
                            act(cx);
                        }),
                )
                .child(label);
        return v_flex()
            .id('chat-message-menu')
            .absolute()
            .left(place.x)
            .top(place.y)
            .w(MENU_SIZE.w)
            .p(4)
            .rounded(8)
            .bg(t.popover)
            .border_1()
            .border_color(t.border)
            .shadow_md()
            .on_mouse_down_out((_event, cx) => close(cx))
            .child(
                item('copy', 'Copy message', (cx) => {
                    cx.write_to_clipboard(text ?? '');
                    deps.flash(COPIED_NOTE, cx);
                }),
            );
    }

    /**
     * rows drawn out of sight at the list's width, so each one's real height reaches the height book
     * @param {readonly (Row & { look?: string })[]} rows
     * @param {Theme} t
     * @param {string} pre
     */
    function measurer(rows, t, pre) {
        return div()
            .absolute()
            .top(0)
            .left(0)
            .w(width || NARROW)
            .h(0)
            .overflow_hidden()
            .opacity(0)
            .child(
                v_flex()
                    .w_full()
                    .children(
                        deps.heights.toMeasure(rows, at.range).map((row) =>
                            div()
                                .id(
                                    `${pre}${row.id}@${row.version}${row.look ?? ''}`,
                                )
                                .flex_none()
                                .w_full()
                                .on_size_change((size, cx) => {
                                    const zoom = Number(settings().zoom) || 1;
                                    readPlace();
                                    if (
                                        !deps.heights.record(
                                            row,
                                            size.height / zoom,
                                        )
                                    )
                                        return;
                                    if (
                                        at.measured(
                                            rows,
                                            rows.indexOf(row),
                                            Date.now(),
                                        )
                                    )
                                        settleUntil = Date.now() + SETTLE_MS;
                                    cx.notify();
                                })
                                .child(deps.rows.row(row, t, pre, false)),
                        ),
                    ),
            );
    }

    /** his place, read from the rows the list drew last; never inside the list's row callback (see place.js) */
    function readPlace() {
        at.read(shownRows, sizes);
    }

    /** [TRACE-place] one line to the lane's trace file, until the 23:44 «opened at the newest» is caught @param {string} line */
    function trace(line) {
        const stamp = new Date().toTimeString().slice(0, 8);
        exec('/bin/sh', [
            '-c',
            'printf "%s\\n" "$1" >> "$2"',
            'sh',
            `${stamp} ${line}`,
            `${home()}/.local/state/x/lanes/herdr-lane-2/place-trace.log`,
        ]).catch(() => {});
    }

    /** his place is asked of the list again, to the pixel: after a new width; unseen while it lands */
    function holdPlace() {
        if (at.hold()) settleUntil = Date.now() + SETTLE_MS;
    }

    /**
     * his place is the first message on screen once his scroll has rested; following the newest keeps none
     * @param {Context} cx
     */
    function savePlaceSoon(cx) {
        const stepAt = Date.now();
        const file = deps.file();
        const reader = deps.reader();
        lastWheelAt = stepAt;
        let seen = '';
        /** @param {Context} later */
        const save = (later) => {
            // only his last step counts, and only for the thread it was made in
            // nor for an earlier opening of the same thread: its place may not be restored yet
            if (lastWheelAt !== stepAt || !file || deps.file() !== file) return;
            if (deps.reader() !== reader) return;
            readPlace();
            // a glide moves the list on with no wheel step: the place is saved once two reads in a row agree
            const { place } = at;
            const now = `${place?.id}@${Math.round(at.top)}`;
            if (now !== seen) {
                seen = now;
                later.timer.after(PLACE_SAVE_MS, save);
                return;
            }
            if (place)
                localStorage.setItem(placeKey(file), JSON.stringify(place));
            else {
                trace('save: following, the saved place is dropped');
                localStorage.removeItem(placeKey(file));
            }
        };
        cx.timer.after(PLACE_SAVE_MS, save);
    }

    return {
        column,
        /** a restored place lands unseen: its frames would show him other rows first @param {string} id @param {number} offset */
        land(id, offset) {
            at.restore(id, offset);
            settleUntil = Date.now() + SETTLE_MS;
        },
        /** his place as last drawn, with the height of the row it sits on */
        placeNow() {
            readPlace();
            const place = at.place;
            return {
                height: sizes[shownRows.findIndex((r) => r.id === place?.id)],
                place,
            };
        },
        /** a thread opened or its transcript replaced: no place, menu or landing of the old rows steers the new */
        reset() {
            at.reset();
            messageMenu.close();
        },
        /**
         * his place kept over a page landing: `offset` px of the row above the view; a page that joined the row above him
         * puts it `fromBottom` px above its bottom
         * @param {string} id @param {number} offset @param {number} [fromBottom]
         */
        restore(id, offset, fromBottom) {
            at.restore(id, offset, fromBottom);
        },
        room,
        /** the list's size for a view laid over it */
        /** the rows the list draws */
        shown: () => shownRows,
        size: () => ({ height: viewH || 600, width: width || NARROW }),
        /**
         * the rows and look of this draw: a change of the look's row-moving parts holds his place while new heights land
         * @param {readonly Row[]} rows @param {import('./look.js').Look} look
         */
        take(rows, look) {
            const key = [
                look.size,
                look.font,
                look.width,
                look.space,
                look.tools,
            ].join('|');
            if (lookKey && key !== lookKey) {
                widthGen += 1;
                trace(
                    `look ${lookKey} → ${key} place=${JSON.stringify(at.place)} held=${at.isHeld} rows ${shownRows.length} → ${rows.length}`,
                );
                traceUntil = Date.now() + TRACE_MS;
                if (at.restyle(shownRows, sizes, rows))
                    settleUntil = Date.now() + SETTLE_MS;
                deps.heights.clear();
            }
            lookWidth = look.width;
            lookKey = key;
            shownRows = rows;
        },
        trace,
        /** [TRACE-place] the list's asks are traced a while after an open @param {string} line */
        traceOpen(line) {
            trace(line);
            traceUntil = Date.now() + TRACE_MS;
        },
        view,
    };
}
