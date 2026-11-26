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

import { isPicture } from './file-links.js';
import { guessHeight } from './heights.js';
import { ICONS } from './icons.js';
import { copiedFrom, createMessageMenu, menuPlace } from './menu.js';
import { createMessageBodies } from './message-body.js';
import { noteOfUrl } from './note-links.js';
import { notesBefore } from './note-rows.js';
import { openPath } from './open-path.js';
import { pathOf } from './path-links.js';
import { END_GLIDE_MS, createPlace } from './place.js';
import { createSelections, passageOf, wordsOf } from './selection.js';
import { missingNote } from './viewer.js';

/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./row-model.js').Row} Row */
/** @typedef {import('./chat-types.js').Theme} Theme */

// the readable column of a narrow look (the old chat's)
const NARROW = 820;
// his reading place is saved this long after his last scroll step
const PLACE_SAVE_MS = 600;
// how long after a held place was last asked for the list stays unseen: its landing takes two frames, and a
// reload asks again as each real height arrives
const SETTLE_MS = 120;
// the list's end is looked at this often: after a draw till the list stands still, after his wheel step for a glide
const END_LOOK_MS = 50;
// the right-click menu's width, its one row's height and one more's
const MENU = { more: 26, one: 34, w: 200 };
// the rows past the view whose text views stand ready, so a row he scrolls to can report his selection at once
const BODIES_AHEAD = 10;

/** where his reading place in a thread is kept @param {string} file */
export const placeKey = (file) => `place:${file}`;

/**
 * @typedef {object} MessageListDeps
 * @property {(selected: import('./selection.js').SelectedAt, cx: Context) => void} annotate the note box on words he selected
 * @property {(id: string, at: { x: number, y: number } | null, cx: Context) => void} openNote the note box on a note he made
 * @property {() => string | null} audioApp the app his settings open audio in, null: the system's choice
 * @property {() => string | null} file the shown thread's transcript
 * @property {ReturnType<typeof import('./heights.js').createHeights>} heights
 * @property {(t: Theme) => any} noteBox the note box over the list, null while it is shut
 * @property {() => string} threadName the shown thread as antenna names it, for the menu's «tell <thread>»
 * @property {(id: string, at: { x: number, y: number } | null) => void} noteClicked a click on a note's words: the chat opens it at
 *   its own next draw, under the press
 * @property {(cx: Context) => void} loadEarlier the next older page, asked near the first row
 * @property {ReturnType<typeof import('./picture-viewer.js').createPictureViewer>} pictures
 * @property {() => unknown} reader the shown thread's reader: a save for an earlier opening is dropped
 * @property {ReturnType<typeof import('./message-row.js').createMessageRows>} rows
 * @property {(note: string, cx: Context) => void} say a note under the quill
 * @property {(queued: string, cx: Context) => void} unsend a waiting message's ×: back out of Claude Code's queue
 */

/** @param {MessageListDeps} deps */
export function createMessageList(deps) {
    const scroll = VirtualListScrollHandle.new();
    /** his reading place: following the newest, or the first message on screen and the px of it above the view */
    const at = createPlace();
    /** the right-click menu on a message (slice 7) */
    const messageMenu = createMessageMenu();
    /** the words he selected, which the menu copies (FRM-699) */
    const selections = createSelections();
    const bodies = createMessageBodies();
    let isSyncing = false;
    /** the list's corner in the window, read off a press in it, for herdr reports a selection in window px @type {{ x: number, y: number } | null} */
    let origin = null;
    /** the square a left press is on, told before the list hears the press, and the one the last press was on @type {string | null} */
    let pressing = null;
    /** @type {string | null} */
    let pressed = null;
    /** the note rows of the last draw */
    let noteKey = '';
    /** the last left press, in the list's px @type {{ x: number, y: number } | null} */
    let pressedAt = null;
    /** the items on screen @type {string[]} */
    let drawnKeys = [];
    /**
     * the items of the last draw, and which of them herdr drew
     * @type {{ keys: string[], range: import('./follow.js').Range, rowOf: (i: number) => Row | undefined, preOf: (i: number) => string, t: Theme } | null}
     */
    let items = null;
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
    /** until then the list is not shown: a held place is still landing as real heights arrive */
    let settleUntil = 0;
    let lastWheelAt = 0;
    /** the ↓ as the last view drew it, and how long the list is still watched for its end */
    let isNewestShown = false;
    let endWatchUntil = 0;
    let isEndWatched = false;

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
        /** @param {number} i */
        const preOf = (i) =>
            i === cutAt
                ? `${pre}a-`
                : i === cutAt + 1 && cutAt >= 0
                  ? `${pre}b-`
                  : pre;
        const keys = itemSizes.map((_, i) => {
            const id = rows[rowAt(i)]?.id ?? `end-${i}`;
            if (i === cutAt) return `${id}#above`;
            return i === cutAt + 1 && cutAt >= 0 ? `${id}#below` : id;
        });
        isNewestShown = !at.isAtNewest;
        watchEnd(cx, END_LOOK_MS);
        items = {
            keys,
            preOf,
            range: items?.range ?? { end: 0, start: 0 },
            rowOf: (i) => rows[rowAt(i)],
            t,
        };
        keepDrawn();
        syncBodies(cx);
        const list = v_virtual_list(
            'chat-rows',
            itemSizes.length,
            itemSizes,
            (i) => keys[i] ?? `end-${i}`,
            (drawn) => {
                // no redraw is asked for in here, herdr refuses one: watchEnd looks after the frame
                at.drawn(drawn, plan, Date.now());
                if (items) items.range = drawn;
                drawnKeys = keys.slice(drawn.start, drawn.end);
                const drawnItems = [];
                for (let i = drawn.start; i < drawn.end; i++) {
                    const row = rows[rowAt(i)];
                    const box = div()
                        .relative()
                        .w_full()
                        .h(itemSizes[i] ?? 1);
                    // an end mark (follow.js END_MARKS): the list pairs each element with its item, so none is skipped
                    if (!row) {
                        drawnItems.push(box);
                        continue;
                    }
                    const body = deps.rows.hasBody(row)
                        ? bodies.of(
                              keys[i] ?? '',
                              deps.rows.bodyLook(row, t, preOf(i)),
                          )
                        : null;
                    // the older text of one frame stays in its own row
                    if (body?.isStale) box.overflow_hidden();
                    const drawnRow = deps.rows.row(
                        row,
                        t,
                        preOf(i),
                        true,
                        body?.entity ?? null,
                    );
                    if (i === cutAt)
                        drawnItems.push(box.overflow_hidden().child(drawnRow));
                    else if (cutAt >= 0 && i === cutAt + 1)
                        drawnItems.push(
                            box
                                .overflow_hidden()
                                .child(
                                    div()
                                        .absolute()
                                        .top(-cutOffset)
                                        .left(0)
                                        .w_full()
                                        .child(drawnRow),
                                ),
                        );
                    else drawnItems.push(box.child(drawnRow));
                }
                return drawnItems;
            },
        )
            .track_scroll(scroll)
            // a right-click names the row first; the list's own handler below then opens the menu where it was
            .on_item_secondary_click((key, event) => {
                const id = key.replace(/#(?:above|below)$/, '');
                const row = rows.find((r) => r.id === id);
                const parts = row
                    ? selections.partsFor(
                          key,
                          (k) => deps.rows.stampOf(row, preOf(keys.indexOf(k))),
                          deps.rows.textsCount(row),
                      )
                    : null;
                messageMenu.hit(event.position, {
                    copied: copiedFrom(row, parts && wordsOf(parts)),
                    selected: noteOn(row, parts, parts?.at(-1)?.position),
                });
            })
            // a file row opens its file in its app, a png in Preview (FRM-587)
            .on_item_click((key, cx) => {
                const press = deps.rows.press(rows, key, pressed);
                if (press?.kind === 'redraw') cx.notify();
                else if (press?.kind === 'pictures')
                    deps.pictures.show(press.files, press.at, cx);
                else if (press?.kind === 'unsend')
                    deps.unsend(press.queued, cx);
                else if (press?.kind === 'file') openFile(press.path, cx);
                else if (press?.kind === 'note')
                    deps.openNote(press.id, pressedAt, cx);
            })
            .size_full();
        return div()
            .id('chat-list')
            .on_mouse_down('left', (event, cx) => {
                readOrigin(event);
                const local = event.local_position;
                pressedAt = local
                    ? { x: local.x / zoom, y: local.y / zoom }
                    : null;
                pressed = pressing;
                pressing = null;
                cx.stop_propagation();
            })
            .on_mouse_down('right', (event, cx) => {
                readOrigin(event);
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
                // told again with nothing changed: the chat was off the screen, where herdr drops every selection unsaid
                if (Math.abs(drawnWidth - width) <= 1 && height === viewH) {
                    drawnKeys = [];
                    keepDrawn();
                }
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
                keepDrawn();
                syncBodies(cx);
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
                watchEnd(cx, END_GLIDE_MS);
                if (step.isIgnored) return;
                savePlaceSoon(cx);
                // within a screen of the first row: the next older page, one at a time
                // a step up in a thread that fits the view too, which follows the newest all the while
                const isUp = (event.delta?.y ?? 0) > 0;
                if ((isUp || !at.follow) && at.top < viewH)
                    deps.loadEarlier(cx);
                if (step.hadCut || step.isFollowChanged) cx.notify();
            })
            .child(list)
            .child(measurer(booked, t, `m${widthGen}-`, plan.measured))
            .when(Boolean(messageMenu.state), (el) =>
                el.child(messageMenuView(t)),
            )
            .children([deps.noteBox(t)].filter(Boolean))
            .when(isNewestShown, (el) =>
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
                            forgetPlace();
                            cx.notify();
                        }),
                ),
            );
    }

    /**
     * the list moves with no redraw of the view (his scroll, a glide after it): where it came to rest is looked at between
     * frames, and the ↓ drawn anew when it changed
     * @param {Context} cx @param {number} ms for how long
     */
    function watchEnd(cx, ms) {
        endWatchUntil = Math.max(endWatchUntil, Date.now() + ms);
        if (isEndWatched) return;
        isEndWatched = true;
        cx.timer.after(END_LOOK_MS, (later) => {
            isEndWatched = false;
            if (at.rested(Date.now())) forgetPlace();
            if (isNewestShown === at.isAtNewest) later.notify();
            if (Date.now() < endWatchUntil || !at.isQuiet(Date.now()))
                watchEnd(later, 0);
        });
    }

    /** @param {{ position: { x: number, y: number }, local_position?: { x: number, y: number } | null }} press */
    function readOrigin({ position, local_position: local }) {
        if (local)
            origin = { x: position.x - local.x, y: position.y - local.y };
    }

    /**
     * what a note would be written on, and where the words end in the list
     * @param {Row | undefined} row @param {readonly import('./selection.js').Part[] | null} parts
     * @param {{ x: number, y: number } | null | undefined} end in window px
     * @returns {import('./selection.js').SelectedAt | null}
     */
    function noteOn(row, parts, end) {
        const passage = passageOf(row, parts);
        if (!passage) return null;
        const zoom = Number(settings().zoom) || 1;
        return {
            at:
                end && origin
                    ? {
                          x: (end.x - origin.x) / zoom,
                          y: (end.y - origin.y) / zoom,
                      }
                    : null,
            passage,
        };
    }

    /** he follows the newest: the thread opens there again */
    function forgetPlace() {
        const file = deps.file();
        if (file) localStorage.removeItem(placeKey(file));
    }

    /** a message off the screen holds no selection */
    const keepDrawn = () => selections.keep(new Set(drawnKeys), Date.now());

    /**
     * the messages near the view have their text views ready; after the draw, where a view may be made
     * @param {Context} cx
     */
    function syncBodies(cx) {
        if (isSyncing) return;
        isSyncing = true;
        cx.timer.after(0, (later) => {
            isSyncing = false;
            if (!items) return;
            const { keys, preOf, range, rowOf, t } = items;
            const near = [];
            const end = Math.min(keys.length, range.end + BODIES_AHEAD);
            for (
                let i = Math.max(0, range.start - BODIES_AHEAD);
                i < end;
                i++
            ) {
                const key = keys[i] ?? '';
                const row = rowOf(i);
                if (!row || !deps.rows.hasBody(row)) continue;
                const pre = preOf(i);
                const stamp = deps.rows.stampOf(row, pre);
                near.push({
                    draw: (
                        /** @type {import('./message-body.js').Handlers} */ handlers,
                    ) => deps.rows.drawBody(row, t, pre, handlers),
                    follow: (
                        /** @type {string} */ url,
                        /** @type {Context} */ cx,
                    ) => follow(url, row, cx),
                    key,
                    look: deps.rows.bodyLook(row, t, pre),
                    press: (/** @type {string} */ picture) => {
                        pressing = picture;
                    },
                    report: (
                        /** @type {number} */ block,
                        /** @type {import('./selection.js').Reported | null} */ part,
                    ) => {
                        selections.report(key, stamp, block, part, Date.now());
                    },
                });
            }
            const made = bodies.sync(near, later);
            if (made.some((key) => drawnKeys.includes(key))) later.notify();
        });
    }

    /**
     * a link he clicked in a reply: a path opens as its file row does, a folder in Finder, any other link in his browser
     * @param {string} url @param {Row} row @param {Context} cx
     */
    function follow(url, row, cx) {
        // herdr follows a link on any button's mouse-up, one under an open menu or the viewer too
        if (messageMenu.state || deps.pictures.isOpen()) return;
        const note = noteOfUrl(url);
        if (note) return deps.noteClicked(note, pressedAt);
        const path = pathOf(url, row, home());
        if (!path) {
            if (/^https?:/.test(url)) cx.open_url(url);
            return;
        }
        if (isPicture(path)) return deps.pictures.show([path], 0, cx);
        openFile(path, cx);
    }

    /** a file or folder he clicked; one gone since is said so @param {string} path @param {Context} cx */
    function openFile(path, cx) {
        cx.spawn(async (cx) => {
            if (!(await openPath(path, deps.audioApp(), exec)))
                deps.say(missingNote(path, false), cx);
        });
    }

    /** the right-click menu: what it copies, dim when the press was on no message @param {Theme} t */
    function messageMenuView(t) {
        const menu = messageMenu.state;
        const copied = menu?.copied ?? null;
        const selected = menu?.selected ?? null;
        const place = menuPlace(
            { x: menu?.x ?? 0, y: menu?.y ?? 0 },
            { h: viewH, w: width || NARROW },
            { h: MENU.one + (selected ? MENU.more : 0), w: MENU.w },
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
                .text_color(copied ? t.foreground : t.dim)
                .when(Boolean(copied), (el) =>
                    el
                        .cursor_pointer()
                        .hover((s) => s.bg(t.hover))
                        .on_click((_event, cx) => {
                            cx.stop_propagation();
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
            .w(MENU.w)
            .p(4)
            .rounded(8)
            .bg(t.popover)
            .border_1()
            .border_color(t.border)
            .shadow_md()
            .on_mouse_down_out((_event, cx) => close(cx))
            .child(
                item(
                    'copy',
                    copied?.isSelection ? 'Copy text' : 'Copy message',
                    (cx) => cx.write_to_clipboard(copied?.text ?? ''),
                ),
            )
            .when(selected !== null, (el) =>
                el.child(
                    item(
                        'annotate',
                        `tell ${deps.threadName()}`.trimEnd(),
                        (cx) => {
                            if (selected) deps.annotate(selected, cx);
                        },
                    ),
                ),
            );
    }

    /**
     * rows drawn out of sight at the list's width, so each one's real height reaches the height book
     * @param {readonly (Row & { look?: string })[]} rows
     * @param {Theme} t
     * @param {string} pre
     * @param {import('./follow.js').Range | null} range the rows to measure around
     */
    function measurer(rows, t, pre, range) {
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
                        deps.heights.toMeasure(rows, range).map((row) =>
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

    /** a note row that comes or goes above his place moves nothing he reads @param {readonly Row[]} rows */
    function keepOverNotes(rows) {
        const key = rows
            .flatMap((row) => (row.kind === 'note' ? [row.id] : []))
            .join();
        const isChanged = key !== noteKey;
        noteKey = key;
        // his place is read only then: between a wheel step and its draw it names the old first row
        if (!isChanged) return;
        readPlace();
        const id = at.place?.id ?? '';
        const was = notesBefore(shownRows, id);
        if (was < 0 || was === notesBefore(rows, id)) return;
        if (at.restyle(shownRows, sizes, rows))
            settleUntil = Date.now() + SETTLE_MS;
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
            else localStorage.removeItem(placeKey(file));
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
            items = null;
            drawnKeys = [];
            bodies.clear();
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
        /** the words that stood selected at a press, for a note @param {number} time */
        selectedAt(time) {
            const selected = selections.current(time);
            const i = selected ? (items?.keys.indexOf(selected.key) ?? -1) : -1;
            const row = items?.rowOf(i);
            if (!selected || !items || !row) return null;
            if (deps.rows.stampOf(row, items.preOf(i)) !== selected.stamp)
                return null;
            // a fold leaves the rest of its message out, and they never say so
            const blocks = deps.rows.textsCount(row);
            return noteOn(
                row,
                selected.parts.filter((p) => p.block < blocks),
                selected.at,
            );
        },
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
                if (at.restyle(shownRows, sizes, rows))
                    settleUntil = Date.now() + SETTLE_MS;
                deps.heights.clear();
            }
            lookWidth = look.width;
            lookKey = key;
            keepOverNotes(rows);
            shownRows = rows;
        },
        view,
    };
}
