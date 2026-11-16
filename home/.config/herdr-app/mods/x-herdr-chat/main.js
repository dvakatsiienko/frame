// x-herdr-chat: the Chat view, built new beside x-herdr-chatter (FRM-638). so far it only reads: the thread the old
// chat shows, drawn as his messages, replies and one line per tool call, in a list that never moves without him.
// the rules live in their own files, each tested with no herdr: reader.js, row-model.js, heights.js, follow.js.

import {
    TextView,
    VirtualListScrollHandle,
    h_flex,
    v_flex,
    v_virtual_list,
} from 'gpui-base';
import { View, div } from 'gpui-kit';
import {
    checking,
    closeOverlay,
    exec,
    home,
    props,
    readTextFile,
    settings,
    shared,
    theme,
    watchFolder,
} from 'herdr';

import { splitBlocks } from './blocks.js';
import {
    followAfterWheel,
    isAtTrueEnd,
    needsLift,
    pinToRow,
    placeIndex,
    placeOf,
    splitAtPlace,
    topAfterWheel,
    topOf,
} from './follow.js';
import { createHeights, guessHeight } from './heights.js';
import { createReader } from './reader.js';
import { createRowModel } from './row-model.js';
import { transcriptPath } from './thread.js';
import { typedMarkdown } from './typed.js';

/** @typedef {import('gpui-kit').Color} Color */
/** @typedef {import('gpui-kit').Context} Context */
/** @typedef {import('./row-model.js').Row} Row */
// the theme colours this file reads, each present in every herdr theme
/** @typedef {Record<'accent' | 'background' | 'border' | 'dim' | 'foreground' | 'muted' | 'raised', Color>} Theme */

// the widest a line of text reads well, and the share of it a bubble may take
const COLUMN = 760;
const BUBBLE_SHARE = 0.8;
// his reading place is saved this long after his last scroll step
const PLACE_SAVE_MS = 600;
// how long after a held place was last asked for the list stays unseen: its landing takes two frames, and a
// reload asks again as each real height arrives
const SETTLE_MS = 120;
// earlier pages read at most this many times while looking for the message he was reading
const PLACE_PAGES = 8;
// a drawn range this soon after a wheel step is his own scroll
const WHEEL_REST_MS = 200;

/** a theme colour made see-through @param {Color} color @param {string} alpha two hex digits @returns {Color} */
const tint = (color, alpha) => `#${color.slice(1, 7)}${alpha}`;

/** @param {unknown} error */
const readError = (error) =>
    `This thread's transcript could not be read: ${error instanceof Error ? error.message : String(error)}`;

/** @param {string} program @param {string[]} args */
async function run(program, args) {
    const out = await exec(program, args);
    if (out.code !== 0)
        throw new Error(out.stderr.trim() || `${program} failed`);
    return out.stdout;
}

/**
 * the transcript file as the reader reaches it: herdr reads no byte range itself, so the shell does
 * @param {string} file
 * @returns {import('./reader.js').FileDoor}
 */
const doorTo = (file) => ({
    lineStartAt: async (at) =>
        at +
        Number(
            (
                await run('sh', [
                    '-c',
                    'tail -c +"$1" "$2" | head -n 1 | wc -c',
                    'sh',
                    String(at + 1),
                    file,
                ])
            ).trim(),
        ),
    read: (from, max) =>
        run('sh', [
            '-c',
            'tail -c +"$1" "$2" | head -c "$3"',
            'sh',
            String(from + 1),
            file,
            String(max),
        ]),
    sizeOf: async () => {
        const out = await exec('stat', ['-f', '%z', file]);
        return out.code === 0 ? Number(out.stdout.trim()) : null;
    },
});

export default class Chat extends View {
    scroll = VirtualListScrollHandle.new();
    model = createRowModel();
    heights = createHeights();
    /** @type {ReturnType<typeof createReader> | null} */
    reader = null;
    /** the pid of the thread shown, as the old chat publishes it @type {number | null} */
    pid = null;
    /** @type {string | null} */
    file = null;
    /** the pid the open thread was opened for; undefined before the first @type {number | null | undefined} */
    opened = undefined;
    /** following the newest: only while he sits at the end */
    follow = true;
    /** the rows the list drew last @type {{ start: number, end: number } | null} */
    range = null;
    width = 0;
    viewH = 0;
    /** bumped when the width changes: rich text laid out for the old width is never reused */
    widthGen = 0;
    /** the px of the first message on screen that sit above the view */
    offset = 0;
    /** how far the list is scrolled, counted from his wheel and held to the row the list drew: herdr hands none */
    top = 0;
    /**
     * a place held to the pixel: its message is drawn as two list items cut at the place, since the list can only bring
     * an item's top to the view's top. it lasts until his next scroll step @type {{ id: string, offset: number } | null}
     */
    cut = null;
    /** the held place is asked of the list before the next frame */
    isSeekDue = false;
    /** the list was sent to its end, so the next frame can land the held place at the top */
    isLifted = false;
    /** until then the list is not shown: a held place is still landing as real heights arrive */
    settleUntil = 0;
    /** the first message on screen while he reads mid-thread; none while following @type {string | null} */
    place = null;
    /** until then a drawn range that reaches the end is his own step there */
    wheelUntil = 0;
    isLastWheelDown = false;
    /** the pending wait for a change in the transcript's folder @type {import('herdr').FolderWatch | null} */
    watch = null;
    /** @type {number[]} */
    sizes = [];
    lastWheelAt = 0;
    /** @type {string | null} */
    error = null;
    /** the open thread's transcript has been read once */
    isRead = false;

    /** wakes the loop that opens the thread shown: a draw starts no work itself */
    wake = () => {};

    /**
     * @param {unknown} _props
     * @param {import('gpui-kit').AsyncContext} cx
     */
    init(_props, cx) {
        // a check draws one frame and must read no thread
        if (checking()) return;
        cx.spawn(async (cx) => {
            for (;;) {
                const woken = new Promise((resolve) => {
                    this.wake = () => resolve(null);
                });
                // the thread to open is read after the wait is armed, so a switch during an open is never lost
                const pid = this.pid;
                if (pid !== this.opened) {
                    this.opened = pid;
                    this.open(pid, cx);
                }
                await woken;
            }
        });
    }

    /** @param {Context} _cx */
    render(_cx) {
        const t = /** @type {Theme} */ (theme());
        const shown = /** @type {{ pid?: unknown } | null} */ (
            shared('chat.shown') ?? null
        );
        const pid = typeof shown?.pid === 'number' ? shown.pid : null;
        if (pid !== this.pid) {
            this.pid = pid;
            this.wake();
        }
        const root = v_flex()
            .size_full()
            .min_h(0)
            .bg(t.background)
            .text_color(t.foreground)
            .text_size(13);
        const overlay = props()?.overlay;
        if (overlay)
            root.child(
                h_flex()
                    .px(12)
                    .py(6)
                    .justify_between()
                    .items_center()
                    .border_color(t.border)
                    .child(
                        div()
                            .text_color(t.muted)
                            .child('The new chat, read only'),
                    )
                    .child(
                        div()
                            .id('chat-close')
                            .px(10)
                            .py(3)
                            .rounded(6)
                            .bg(t.raised)
                            .child('Close')
                            .on_click(() => closeOverlay(overlay)),
                    ),
            );
        const { rows } = this.model;
        if (!rows.length)
            return root.child(
                div()
                    .flex_1()
                    .flex()
                    .items_center()
                    .justify_center()
                    .text_color(t.muted)
                    .child(this.error ?? this.emptyLine()),
            );
        if (this.error)
            root.child(
                div()
                    .px(12)
                    .py(4)
                    .text_size(12)
                    .text_color(t.muted)
                    .bg(t.raised)
                    .child(this.error),
            );
        return root.child(this.list(rows, t, _cx));
    }

    /** what the view says while it has no row to draw */
    emptyLine() {
        if (this.pid === null) return 'No thread is shown here yet';
        if (!this.file) return 'Opening the thread…';
        return this.isRead
            ? 'Nothing to show in this thread yet'
            : 'Reading the thread…';
    }

    /**
     * @param {readonly Row[]} rows
     * @param {Theme} t
     * @param {Context} cx
     */
    list(rows, t, cx) {
        const zoom = Number(settings().zoom) || 1;
        const sizes = this.heights.sizes(rows, (row) =>
            guessHeight(row, this.width || COLUMN),
        );
        this.sizes = sizes;
        const pre = `w${this.widthGen}-`;
        const split = this.cut
            ? splitAtPlace(rows, sizes, this.cut)
            : { cut: null, seekAt: -1, sizes };
        const cutAt = split.cut?.at ?? -1;
        const cutOffset = split.cut?.offset ?? 0;
        /** the row a list item draws: past a cut row every item sits one further @param {number} i */
        const rowAt = (i) => (cutAt >= 0 && i > cutAt ? i - 1 : i);
        // his place, or the newest: asked of the list before the frame that draws these rows
        if (this.isSeekDue && this.cut) {
            if (split.seekAt < 0) {
                this.isSeekDue = false;
                this.cut = null;
            } else if (
                !this.isLifted &&
                needsLift(this.range, rowAt(split.seekAt))
            ) {
                // the list lands an item's top on the view's top only from below it: to the end first, then the place
                this.isLifted = true;
                this.scroll.scroll_to_bottom();
                cx.timer.after(0, (later) => later.notify());
            } else {
                this.isSeekDue = false;
                this.isLifted = false;
                this.scroll.scroll_to_item(split.seekAt, 'top');
            }
        } else if (this.follow) {
            this.scroll.scroll_to_bottom();
            this.top = Math.max(0, topOf(sizes, sizes.length) - this.viewH);
        }
        // a held place lands unseen: the frames it takes would show him other rows first
        const settleFor = this.cut ? this.settleUntil - Date.now() : 0;
        const isSettling = settleFor > 0;
        if (isSettling)
            cx.timer.after(settleFor + 1, (later) => later.notify());
        const list = v_virtual_list(
            'chat-rows',
            split.sizes.length,
            split.sizes,
            (i) => {
                const id = rows[rowAt(i)]?.id ?? `gone-${i}`;
                if (i === cutAt) return `${id}#above`;
                return i === cutAt + 1 && cutAt >= 0 ? `${id}#below` : id;
            },
            (drawn) => {
                const range = {
                    end: rowAt(Math.max(drawn.start, drawn.end - 1)) + 1,
                    start: rowAt(drawn.start),
                };
                this.range = range;
                if (!this.follow) {
                    // a step down that reached the end follows again, read from the range that step drew. no redraw
                    // is asked for here, herdr refuses one inside this callback: the ↓ leaves at the next draw
                    if (
                        this.isLastWheelDown &&
                        Date.now() < this.wheelUntil &&
                        isAtTrueEnd(sizes, range, this.viewH)
                    ) {
                        this.follow = true;
                        this.place = null;
                    } else if (
                        this.cut &&
                        split.seekAt >= 0 &&
                        drawn.start === split.seekAt
                    )
                        // the list drew from the held place: he is exactly there
                        this.top =
                            topOf(sizes, rowAt(split.seekAt)) + cutOffset;
                }
                const items = [];
                for (let i = drawn.start; i < drawn.end; i++) {
                    const row = rows[rowAt(i)];
                    if (!row) continue;
                    const box = div()
                        .relative()
                        .w_full()
                        .h(split.sizes[i] ?? 1);
                    if (i === cutAt)
                        items.push(
                            box
                                .overflow_hidden()
                                .child(this.row(row, t, `${pre}a-`)),
                        );
                    else if (cutAt >= 0 && i === cutAt + 1)
                        items.push(
                            box.overflow_hidden().child(
                                div()
                                    .absolute()
                                    .top(-cutOffset)
                                    .left(0)
                                    .w_full()
                                    .child(this.row(row, t, `${pre}b-`)),
                            ),
                        );
                    else items.push(box.child(this.row(row, t, pre)));
                }
                return items;
            },
        )
            .track_scroll(this.scroll)
            .size_full();
        return div()
            .id('chat-list')
            .relative()
            .flex_1()
            .min_h(0)
            .overflow_hidden()
            .opacity(isSettling ? 0 : 1)
            .on_size_change((size, cx) => {
                const width = size.width / zoom;
                const height = size.height / zoom;
                if (Math.abs(width - this.width) > 1) {
                    this.width = width;
                    this.widthGen += 1;
                    this.readPlace();
                    this.heights.clear();
                    // every height is guessed again: his place is brought back as the real ones arrive
                    this.holdPlace();
                }
                this.viewH = height;
                cx.notify();
            })
            .on_scroll_wheel((event, cx) => {
                const was = this.follow;
                const dy = event.delta?.y ?? 0;
                this.follow = followAfterWheel(
                    was,
                    dy,
                    isAtTrueEnd(this.sizes, this.range, this.viewH),
                );
                this.wheelUntil = Date.now() + WHEEL_REST_MS;
                if (dy) this.isLastWheelDown = dy < 0;
                this.readPlace();
                // his own step ends a held place: the two halves are one row again, at the same height
                const hadCut = this.cut !== null;
                this.cut = null;
                this.isSeekDue = false;
                this.isLifted = false;
                this.top = topAfterWheel(
                    this.top,
                    dy / zoom,
                    this.sizes,
                    this.viewH,
                );
                if (hadCut) cx.notify();
                if (this.follow) this.place = null;
                this.savePlaceSoon(cx);
                if (this.follow !== was) cx.notify();
            })
            .child(list)
            .child(this.measurer(rows, t, `m${this.widthGen}-`))
            .when(!this.follow, (el) =>
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
                        .child('↓')
                        .on_click((_event, cx) => {
                            this.follow = true;
                            this.place = null;
                            if (this.file)
                                localStorage.removeItem(
                                    this.placeKey(this.file),
                                );
                            cx.notify();
                        }),
                ),
            );
    }

    /**
     * rows drawn out of sight at the list's width, so each one's real height reaches the height book
     * @param {readonly Row[]} rows
     * @param {Theme} t
     * @param {string} pre
     */
    measurer(rows, t, pre) {
        return div()
            .absolute()
            .top(0)
            .left(0)
            .w(this.width || COLUMN)
            .h(0)
            .overflow_hidden()
            .opacity(0)
            .child(
                v_flex()
                    .w_full()
                    .children(
                        this.heights.toMeasure(rows, this.range).map((row) =>
                            div()
                                .id(`${pre}${row.id}@${row.version}`)
                                .flex_none()
                                .w_full()
                                .on_size_change((size, cx) => {
                                    const zoom = Number(settings().zoom) || 1;
                                    this.readPlace();
                                    if (
                                        !this.heights.record(
                                            row,
                                            size.height / zoom,
                                        )
                                    )
                                        return;
                                    // a row above his place changed height: the place is brought back to the top,
                                    // or the list, which keeps its offset in px, would slide it away
                                    const at = placeIndex(rows, this.place);
                                    if (at >= 0 && rows.indexOf(row) <= at)
                                        this.holdPlace();
                                    cx.notify();
                                })
                                .child(this.row(row, t, pre)),
                        ),
                    ),
            );
    }

    /**
     * @param {Row} row
     * @param {Theme} t
     * @param {string} pre what tells this copy's rich text from the measured copy's
     */
    row(row, t, pre) {
        const column = (/** @type {import('gpui-kit').Element} */ el) =>
            h_flex()
                .w_full()
                .justify_center()
                .child(
                    div()
                        .w_full()
                        .max_w(COLUMN + 36)
                        .px(18)
                        .py(6)
                        .child(el),
                );
        if (row.kind === 'tool')
            return column(
                h_flex()
                    .gap(6)
                    .items_center()
                    .text_size(12)
                    .text_color(t.dim)
                    .child(div().size(6).rounded(3).bg(t.dim))
                    .child(div().truncate().child(row.text)),
            );
        const most = Math.max(
            240,
            Math.floor(Math.min(this.width || COLUMN, COLUMN) * BUBBLE_SHARE),
        );
        const id = `${pre}${row.id}@${row.version}`;
        if (row.kind === 'mine')
            return column(
                h_flex()
                    .w_full()
                    .justify_end()
                    .child(
                        div()
                            .max_w(most)
                            .px(12)
                            .py(8)
                            .rounded(12)
                            .bg(tint(t.accent, '33'))
                            .border(1)
                            .border_color(tint(t.accent, '4d'))
                            .child(
                                TextView.markdown(
                                    id,
                                    typedMarkdown(row.text),
                                ).selectable(true),
                            ),
                    ),
            );
        return column(
            h_flex()
                .w_full()
                .justify_start()
                .child(
                    v_flex()
                        .max_w(most)
                        .px(12)
                        .py(8)
                        .gap(8)
                        .rounded(12)
                        .bg(t.raised)
                        .children(
                            splitBlocks(row.text).map((block, i) =>
                                block.kind === 'text'
                                    ? TextView.markdown(
                                          `${id}-${i}`,
                                          block.text,
                                      ).selectable(true)
                                    : div()
                                          .px(10)
                                          .py(8)
                                          .rounded(8)
                                          .bg(t.background)
                                          .border(1)
                                          .border_color(t.border)
                                          .child(
                                              TextView.markdown(
                                                  `${id}-${i}`,
                                                  `\`\`\`${block.lang}\n${block.text}\n\`\`\``,
                                              ).selectable(true),
                                          ),
                            ),
                        ),
                ),
        );
    }

    /**
     * shows the thread whose Claude runs as `pid`: its transcript from the tail, then every line added to it
     * @param {number | null} pid
     * @param {Context} cx
     */
    async open(pid, cx) {
        this.watch?.cancel();
        this.watch = null;
        this.model.clear();
        this.heights.clear();
        this.reader = null;
        this.file = null;
        this.error = null;
        this.isRead = false;
        this.follow = true;
        this.place = null;
        this.cut = null;
        this.isSeekDue = false;
        this.offset = 0;
        this.top = 0;
        this.range = null;
        cx.notify();
        if (pid === null) return;
        try {
            const session = await readTextFile(
                `${home()}/.claude/sessions/${pid}.json`,
            );
            const file = transcriptPath(session && JSON.parse(session), home());
            if (pid !== this.pid) return;
            if (!file) {
                this.error = 'This thread has no session file yet';
                cx.notify();
                return;
            }
            this.file = file;
            cx.notify();
            const reader = createReader(doorTo(file));
            this.reader = reader;
            const dir = file.slice(0, file.lastIndexOf('/'));
            const name = file.slice(dir.length + 1);
            // the wait is armed before each read, so a line written while one runs is never missed
            let watch = watchFolder(dir);
            this.watch = watch;
            await this.pull(reader, cx);
            this.isRead = true;
            cx.notify();
            await this.restorePlace(reader, cx);
            while (this.reader === reader) {
                const changed = await watch;
                if (this.reader !== reader) return;
                watch = watchFolder(dir);
                this.watch = watch;
                if (
                    !changed.some((path) => path === dir || path.endsWith(name))
                )
                    continue;
                // one failed read says so and keeps watching: the next change reads again
                try {
                    await this.pull(reader, cx);
                } catch (error) {
                    if (this.reader !== reader) return;
                    this.error = readError(error);
                    cx.notify();
                }
            }
        } catch (error) {
            if (pid !== this.pid) return;
            this.error = readError(error);
            cx.notify();
        }
    }

    /**
     * @param {ReturnType<typeof createReader>} reader
     * @param {Context} cx
     */
    async pull(reader, cx) {
        const { lines, isRestart } = await reader.readNew();
        if (this.reader !== reader) return;
        if (isRestart) {
            this.model.clear();
            this.heights.clear();
            this.place = null;
            this.follow = true;
        }
        const hadError = this.error !== null;
        this.error = null;
        if (this.model.add(lines).changed.length || isRestart || hadError)
            cx.notify();
    }

    /** @param {string} file */
    placeKey(file) {
        return `place:${file}`;
    }

    /**
     * after a reload of the mod: the message he was reading comes back to the top, read in from above if it must be
     * @param {ReturnType<typeof createReader>} reader
     * @param {Context} cx
     */
    async restorePlace(reader, cx) {
        const place = placeOf(
            this.file && localStorage.getItem(this.placeKey(this.file)),
        );
        if (!place) return;
        for (
            let page = 0;
            this.model.indexOf(place.id) < 0 &&
            reader.hasEarlier() &&
            page < PLACE_PAGES;
            page++
        ) {
            const lines = await reader.readEarlier();
            if (this.reader !== reader) return;
            this.model.addEarlier(lines);
        }
        // the saved line may sit inside a folded row: the place is that row
        const row = this.model.rows[this.model.indexOf(place.id)];
        if (!row) return;
        this.follow = false;
        this.place = row.id;
        this.offset = place.offset;
        this.holdPlace();
        cx.notify();
    }

    /**
     * his place, read from the rows the list drew last: the first one on screen, and the counted position held to it.
     * never read inside the list's row callback: herdr calls that once more each frame for the row it measures the
     * width by, with a range of row 0 alone, and a place taken there lost the count at every frame (found 2026-11-16)
     */
    readPlace() {
        // a held place is the truth until his next step: its heights may still be guesses
        if (this.follow || this.cut || !this.range) return;
        const row = this.model.rows[this.range.start];
        if (!row) return;
        const pinned = pinToRow(this.top, this.range.start, this.sizes);
        this.top = pinned.top;
        this.offset = pinned.offset;
        this.place = row.id;
    }

    /** his place is asked of the list again, to the pixel: after a reload, a new width, or a height that changed above it */
    holdPlace() {
        if (!this.place || this.follow) return;
        this.cut = { id: this.place, offset: this.offset };
        this.isSeekDue = true;
        this.isLifted = false;
        this.settleUntil = Date.now() + SETTLE_MS;
    }

    /**
     * his place is the first message on screen once his scroll has rested; following the newest keeps none
     * @param {Context} cx
     */
    savePlaceSoon(cx) {
        const at = Date.now();
        const { file } = this;
        this.lastWheelAt = at;
        let seen = '';
        /** @param {Context} later */
        const save = (later) => {
            // only his last step counts, and only for the thread it was made in
            if (this.lastWheelAt !== at || !file || this.file !== file) return;
            this.readPlace();
            // a glide moves the list on with no wheel step: the place is saved once two reads in a row agree
            const now = `${this.place}@${Math.round(this.top)}`;
            if (now !== seen) {
                seen = now;
                later.timer.after(PLACE_SAVE_MS, save);
                return;
            }
            if (this.follow || !this.place)
                localStorage.removeItem(this.placeKey(file));
            else
                localStorage.setItem(
                    this.placeKey(file),
                    JSON.stringify({ id: this.place, offset: this.offset }),
                );
        };
        cx.timer.after(PLACE_SAVE_MS, save);
    }
}
