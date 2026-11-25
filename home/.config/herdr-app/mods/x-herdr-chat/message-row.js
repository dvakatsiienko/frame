// one message row as the chat draws it: his bubble, a reply with its fold, a run of tool calls, a file; and the rows
// the list shows of the model's, with which replies he opened and which tool calls are open
import { TextView, h_flex, v_flex } from 'gpui-base';
import { div, image } from 'gpui-kit';
import { home } from 'herdr';

import { fileName } from './attach.js';
import { messageDetails } from './details.js';
import { blockSource, drawnBlocks, replyBlocks } from './drawn.js';
import { fileAt, isSentRow, isUnsendRow, withFileRows } from './files.js';
import { replyFold } from './fold.js';
import { ICONS } from './icons.js';
import { tint } from './tint.js';
import {
    createToolFolds,
    isCallRow,
    isCardRow,
    withCallRows,
} from './tool-folds.js';

/** @typedef {import('./row-model.js').Row} Row */
/** @typedef {import('./chat-types.js').Theme} Theme */

// the share of the room a bubble may take
const BUBBLE_SHARE = 0.8;
// the room above and below each row, per spacing
const ROW_PAD = { normal: 6, roomy: 10, tight: 3 };
// a picture his message sent or a reply names, a square under the words
const SENT_THUMB = 96;
// about how wide a character of a reply is, in px: the fold counts a bubble's lines from its width
const CHAR_PX = 7.5;
// how strong find paints a match, and the one it stepped to
const HIT_ALPHA = '4d';
const STEPPED_ALPHA = 'b3';

/**
 * @typedef {object} MessageRowsDeps
 * @property {() => number} column the readable column's width
 * @property {() => number} room the width a row may take: the list's, at most the column
 * @property {() => ReturnType<typeof import('./find.js').createFind>} find the chat's search, which marks the rows and the words it matched
 * @property {() => import('./look.js').Look} look
 * @property {() => boolean} isShowMore his «Show more» switch (FRM-607)
 * @property {ReturnType<typeof import('./sent-pictures.js').createSentPictures>} sent
 */

/** @param {MessageRowsDeps} deps */
export function createMessageRows(deps) {
    // a reply's file rows, made once per reply version (files.js)
    /** @type {Map<string, { version: number, files: Row[] }>} */
    const fileRows = new Map();
    /** the waiting messages his × took back, gone from the list at the press (each id a one-off serial) @type {Set<string>} */
    const takenBack = new Set();
    // which tool-call folds and calls are open (PK-432)
    const toolFolds = createToolFolds();
    /** the long replies he opened with Show more, by row id @type {Set<string>} */
    const openReplies = new Set();
    /** the rows of the turn he reads now, which never fold @type {Set<string>} */
    let currentTurn = new Set();

    /**
     * @param {Row} row
     * @param {Theme} t
     * @param {string} pre what tells this copy's rich text from the measured copy's
     * @param {boolean} [isShown] the copy on screen: the hidden measured copy takes no part in a selection, or its
     *   words, laid over the shown ones, flicker into his selection as he scrolls (dima, 13:51)
     */
    function row(row, t, pre, isShown = true) {
        if (row.kind === 'start')
            return h_flex()
                .w_full()
                .justify_center()
                .py(10)
                .text_xs()
                .text_color(t.muted)
                .child('Start of thread');
        const { hits, isOpen } = deps.find().state;
        const base = row.id.replace(/#.*$/, '');
        const hit = !isOpen
            ? null
            : deps.find().current() === row.id
              ? 'current'
              : hits.some((h) => h.id === row.id || h.id === base)
                ? 'match'
                : null;
        const column = (/** @type {import('gpui-kit').Element} */ el) =>
            h_flex()
                .w_full()
                .justify_center()
                .child(
                    div()
                        .w_full()
                        .max_w(deps.column() + 36)
                        .px(18)
                        .py(ROW_PAD[deps.look().space] ?? ROW_PAD.normal)
                        .rounded(10)
                        .border(2)
                        .border_color(tint(t.background, '00'))
                        // find marks every row it matched, the one shown in his accent (dima, 17:34)
                        .when(hit === 'match', (e) =>
                            e.bg(tint(t.accent, '1f')),
                        )
                        .when(hit === 'current', (e) =>
                            e.bg(tint(t.accent, '38')).border_color(t.accent),
                        )
                        .child(el),
                );
        if (row.kind === 'file') return column(fileRow(row, t));
        if (row.kind === 'tool') return column(toolRow(row, t, pre, isShown));
        const most = Math.max(240, Math.floor(deps.room() * BUBBLE_SHARE));
        const id = `${pre}${row.id}@${row.version}`;
        const fold = foldOf(row);
        if (row.kind === 'mine')
            return column(
                v_flex()
                    .w_full()
                    .items_end()
                    .gap(2)
                    .when(Boolean(row.text) || row.isWaiting, (el) =>
                        el.child(
                            div()
                                .max_w(most)
                                .px(12)
                                .py(8)
                                .rounded(12)
                                // a waiting message is a dashed outline of his bubble until a turn takes it (FRM-563:W9, W10;
                                // his pick, 20:41)
                                .bg(
                                    row.isWaiting
                                        ? t.background
                                        : tint(t.accent, '33'),
                                )
                                .border(1)
                                .when(row.isWaiting, (el) => el.border_dashed())
                                .border_color(
                                    tint(t.accent, row.isWaiting ? '99' : '4d'),
                                )
                                .when(row.isWaiting, (el) => el.opacity(0.75))
                                .child(
                                    textView(row, t, {
                                        id,
                                        isShown,
                                        source: drawnBlocks(row)[0] ?? '',
                                    }),
                                ),
                        ),
                    )
                    // a waiting message's time line is drawn by its × row, the × beside the time (his 20:24 steer)
                    .when(
                        !row.isWaiting &&
                            !row.pictures.length &&
                            !row.files.length,
                        (el) => el.child(detailsLine(row, t)),
                    ),
            );
        return column(
            v_flex()
                .w_full()
                .items_start()
                .gap(2)
                .child(
                    v_flex()
                        .max_w(most)
                        .px(12)
                        .py(8)
                        .gap(8)
                        .rounded(12)
                        .bg(t.raised)
                        .children(
                            (fold?.shown ?? replyBlocks(row)).map(
                                (block, i) => {
                                    const view = textView(row, t, {
                                        block: i,
                                        id: `${id}-${i}`,
                                        isShown,
                                        source: blockSource(block),
                                    });
                                    return block.kind === 'text'
                                        ? view
                                        : div()
                                              .px(10)
                                              .py(8)
                                              .rounded(8)
                                              .bg(t.background)
                                              .border(1)
                                              .border_color(t.border)
                                              .child(view);
                                },
                            ),
                        )
                        // the line he clicks to open it: the list's item click does, herdr-app#894 keeps a press
                        // handler out of a row
                        .when(Boolean(fold), (el) =>
                            el.child(
                                div()
                                    .text_size(12)
                                    .text_color(t.accent)
                                    .cursor_pointer()
                                    .child(
                                        `▾ Show more · ${fold?.hidden ?? 0} more lines`,
                                    ),
                            ),
                        ),
                )
                .child(detailsLine(row, t)),
        );
    }

    /**
     * one text view of a row, find's matches painted behind its words: the stepped one last, so it paints over. a mark moves
     * no line, so the measured copy has none
     * @param {Row} row @param {Theme} t
     * @param {{ block?: number, id: string, isShown: boolean, source: string }} at `block` its place in the row
     */
    function textView(row, t, { block = 0, id, isShown, source }) {
        const view = TextView.markdown(id, source).selectable(isShown);
        const find = deps.find();
        if (!isShown || !find.state.hits.some((h) => h.id === row.id))
            return view;
        const stepped = find.current() === row.id ? find.currentHit()?.n : null;
        return find
            .rangesOf(row)
            .filter((m) => m.block === block)
            .sort((a, b) => Number(a.n === stepped) - Number(b.n === stepped))
            .reduce(
                (el, { end, n, start }) =>
                    el.highlight_range(
                        start,
                        end,
                        tint(
                            t.accent,
                            n === stepped ? STEPPED_ALPHA : HIT_ALPHA,
                        ),
                    ),
                view,
            );
    }

    /**
     * a run of tool calls, folded behind 🛠️; opened, each call is a row that opens alone to its input (PK-432,
     * FRM-638:W23); an open call's json card is a row of its own, so a selection's release in it never closes the call
     * (FRM-659:W4). no press handler in here: the list's item click opens and closes (herdr-app#894)
     * @param {Row} row @param {Theme} t @param {string} pre
     */
    function toolRow(row, t, pre, isShown = true) {
        const isOpen = toolFolds.isOpen(row.id);
        const line = (/** @type {string} */ mark, /** @type {string} */ text) =>
            h_flex()
                .gap(6)
                .items_center()
                .text_size(12)
                .text_color(t.dim)
                .cursor_pointer()
                .child(div().flex_none().w(12).child(mark))
                .child(div().truncate().child(text));
        if (isCardRow(row.id))
            return div()
                .pl(36)
                .child(
                    div()
                        .px(10)
                        .py(6)
                        .rounded(6)
                        .bg(t.raised)
                        .border(1)
                        .border_color(t.border)
                        .text_size(12)
                        .child(
                            textView(row, t, {
                                id: `${pre}${row.id}@${row.version}`,
                                isShown,
                                source: drawnBlocks(row)[0] ?? '',
                            }),
                        ),
                );
        if (!isCallRow(row.id))
            return line(isOpen ? '▾' : '▸', `${ICONS.tools} ${row.text}`);
        return div()
            .pl(18)
            .child(line(isOpen ? '▾' : '▸', row.text));
    }

    /**
     * the pictures and files a message carries: a square per picture, a chip per file; his on the right, a reply's on
     * the left. no press or hover handler, one inside a list row blanks the whole list (herdr-app#894)
     * @param {Row} row @param {Theme} t
     */
    function sentFiles(row, t) {
        return h_flex()
            .gap(6)
            .flex_wrap()
            .when(isSentRow(row.id), (el) => el.justify_end())
            .max_w(deps.column())
            .children(
                row.pictures.map((picture) => {
                    const rel = deps.sent.relOf(picture);
                    return div()
                        .size(SENT_THUMB)
                        .flex_none()
                        .flex()
                        .items_center()
                        .justify_center()
                        .rounded(8)
                        .overflow_hidden()
                        .bg(t.raised)
                        .border(1)
                        .border_color(t.border)
                        .text_color(t.dim)
                        .child(rel ? image(rel).size_full() : ICONS.picture);
                }),
            )
            .children(
                row.files.map((path) =>
                    div()
                        .px(8)
                        .py(3)
                        .rounded(6)
                        .border(1)
                        .border_color(t.border)
                        .text_size(12)
                        .text_color(t.muted)
                        .child(`📎 ${fileName(path)}`),
                ),
            );
    }

    /**
     * the dim line under a bubble, one state and its own time (FRM-594): always drawn, a tooltip in a list row never
     * showed for him (herdr-app#598)
     * @param {Row} row @param {Theme} t
     */
    function detailsLine(row, t) {
        const details = messageDetails(row, Date.now());
        // ✓✓ draws as one double check, its second tick tucked under the first, read in the accent
        const mark = details?.mark;
        return h_flex()
            .px(4)
            .gap(4)
            .items_center()
            .text_size(12)
            .text_color(t.muted)
            .when(details !== null, (el) => el.child(details?.when ?? ''))
            .when(Boolean(mark), (el) =>
                el.child(
                    h_flex()
                        .text_color(mark === '✓✓' ? t.accent : t.muted)
                        .child('✓')
                        .when(mark === '✓✓', (m) =>
                            m.child(div().ml(-6).child('✓')),
                        ),
                ),
            );
    }

    /**
     * a file a reply names, its own row under the reply (FRM-587): the list's item click opens it. no press or hover
     * handler in here, one inside a list row blanks the whole list (herdr-app#894)
     * @param {Row} row @param {Theme} t
     */
    function fileRow(row, t) {
        // a message still in Claude Code's queue: its × takes it back to the quill (FRM-563 b+c)
        if (isUnsendRow(row.id))
            return h_flex()
                .w_full()
                .justify_end()
                .items_center()
                .gap(2)
                .child(
                    // ↩️, his pick (20:40): a hover cannot recolour a glyph in herdr, so the emoji keeps its own colours and the hover
                    // shows as a soft disc behind it
                    div()
                        .size(18)
                        .flex()
                        .items_center()
                        .justify_center()
                        .rounded_full()
                        .text_size(13)
                        .text_color(t.muted)
                        .cursor_pointer()
                        .hover((st) => st.bg(t.border))
                        .child('↩️'),
                )
                .child(detailsLine(row, t));
        if (isSentRow(row.id))
            return v_flex()
                .w_full()
                .items_end()
                .gap(2)
                .child(sentFiles(row, t).cursor_pointer())
                .when(!row.isWaiting, (el) => el.child(detailsLine(row, t)));
        if (row.pictures.length) return sentFiles(row, t).cursor_pointer();
        return h_flex()
            .gap(6)
            .items_center()
            .self_start()
            .px(8)
            .py(3)
            .rounded(6)
            .border(1)
            .border_color(t.border)
            .cursor_pointer()
            .text_size(12)
            .text_color(t.muted)
            .child(ICONS.file)
            .child(div().truncate().child(row.text));
    }
    /**
     * a click on a message's or a reply's pictures: the pictures it opens, whole, the first shown; ← → reach the rest
     * @param {readonly Row[]} rows @param {string} key @returns {{ files: string[], at: number } | null}
     */
    function picturesAt(rows, key) {
        const row = rows.find(
            (r) => r.id === key.replace(/#(?:above|below)$/, ''),
        );
        // his words select on a click; only the squares' own row opens the viewer
        if (row?.kind !== 'file') return null;
        const files = row.pictures.flatMap((p) => deps.sent.pathOf(p) ?? []);
        return files.length ? { at: 0, files } : null;
    }

    /**
     * how a reply folds now: only a long one of an earlier turn, while his switch is on and he has not opened it; a
     * search hit shows whole
     * @param {Row} row
     */
    function foldOf(row) {
        if (row.kind !== 'reply' || openReplies.has(row.id)) return null;
        const { isOpen } = deps.find().state;
        if (isOpen && deps.find().state.hits.some((h) => h.id === row.id))
            return null;
        const width = deps.room() * BUBBLE_SHARE;
        return replyFold(
            replyBlocks(row),
            Math.floor(Math.max(240, width) / CHAR_PX),
            {
                isEarlierTurn: !currentTurn.has(row.id),
                isShowMoreOn: deps.isShowMore(),
            },
        );
    }

    /** the rows as the height book keys them: a folded reply is measured apart @param {readonly Row[]} rows */
    const booked = (rows) =>
        rows.map((row) => (foldOf(row) ? { ...row, look: 'fold' } : row));

    return {
        booked,
        /** a replaced transcript makes its file rows again */
        clearFiles() {
            fileRows.clear();
        },
        /** the old thread's opened replies, files and tool calls: none of them belongs to the next */
        clearThread() {
            openReplies.clear();
            fileRows.clear();
            toolFolds.clear();
        },
        /**
         * the turn he reads now: from his last message to the end, never folded
         * @param {readonly Row[]} rows
         */
        markTurn(rows) {
            let turnAt = 0;
            rows.forEach((r, i) => {
                if (r.kind === 'mine' && r.isTurnStart) turnAt = i;
            });
            currentTurn = new Set(rows.slice(turnAt).map((r) => r.id));
        },
        /**
         * a click on a row: a tool call opens or closes, a folded reply opens whole, pictures open in the viewer,
         * a file in its app
         * @param {readonly Row[]} rows @param {string} key
         * @returns {{ kind: 'redraw' } | { kind: 'pictures', files: string[], at: number } | { kind: 'file', path: string } | { kind: 'unsend', queued: string } | null}
         */
        press(rows, key) {
            const id = key.replace(/#(?:above|below)$/, '');
            const pressed = rows.find((r) => r.id === id);
            if (pressed && isUnsendRow(id)) {
                if (!pressed.queued) return null;
                // the bubble leaves at the press, before the pull: his words are on their way back (his 20:24 «clunky»)
                takenBack.add(id.slice(0, -'#unsend'.length));
                return { kind: 'unsend', queued: pressed.queued };
            }
            // a click in a tool call's card moves no fold and asks no redraw, so his selection there stays
            if (pressed?.kind === 'tool')
                return toolFolds.toggle(id) ? { kind: 'redraw' } : null;
            if (pressed && foldOf(pressed)) {
                openReplies.add(id);
                return { kind: 'redraw' };
            }
            const opened = picturesAt(rows, key);
            if (opened) return { kind: 'pictures', ...opened };
            const path = fileAt(rows, key);
            return path ? { kind: 'file', path } : null;
        },
        row,
        /**
         * the rows the list draws: the model's, less tool calls when he hides them, each reply's files after it
         * @param {readonly Row[]} rows @param {import('./look.js').Look} look
         */
        shown: (rows, look) =>
            withCallRows(
                withFileRows(
                    rows.filter(
                        (row) =>
                            !takenBack.has(row.id) &&
                            (look.tools !== 'hide' || row.kind !== 'tool'),
                    ),
                    home(),
                    fileRows,
                ),
                toolFolds,
            ),
    };
}
