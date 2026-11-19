// one message row as the chat draws it: his bubble, a reply with its fold, a run of tool calls, a file; and the rows
// the list shows of the model's, with which replies he opened and which tool calls are open
import { TextView, h_flex, v_flex } from 'gpui-base';
import { div, image } from 'gpui-kit';
import { home } from 'herdr';

import { fileName } from './attach.js';
import { splitBlocks } from './blocks.js';
import { messageDetails } from './details.js';
import { fileAt, isSentRow, unlinkFiles, withFileRows } from './files.js';
import { findSpans } from './find.js';
import { replyFold } from './fold.js';
import { ICONS } from './icons.js';
import { tint } from './tint.js';
import {
    createToolFolds,
    isCallRow,
    isCardRow,
    withCallRows,
} from './tool-folds.js';
import { typedMarkdown } from './typed.js';

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

/**
 * @typedef {object} MessageRowsDeps
 * @property {() => number} column the readable column's width
 * @property {() => number} room the width a row may take: the list's, at most the column
 * @property {() => ReturnType<typeof import('./find.js').createFind>} find the chat's search, which marks the rows it matched
 * @property {ReturnType<typeof import('./heights.js').createHeights>} heights
 * @property {() => import('./look.js').Look} look
 * @property {() => boolean} isShowMore his «Show more» switch (FRM-607)
 * @property {ReturnType<typeof import('./sent-pictures.js').createSentPictures>} sent
 */

/** @param {MessageRowsDeps} deps */
export function createMessageRows(deps) {
    // a reply's file rows, made once per reply version (files.js)
    /** @type {Map<string, { version: number, files: Row[] }>} */
    const fileRows = new Map();
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
        const fold = rowLook(row) === 'fold' ? foldOf(row) : null;
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
                                // a waiting message is an outline of his bubble, its words dim, until a turn takes it
                                .bg(
                                    row.isWaiting
                                        ? t.background
                                        : tint(t.accent, '33'),
                                )
                                .border(1)
                                .border_color(
                                    tint(t.accent, row.isWaiting ? '99' : '4d'),
                                )
                                .when(row.isWaiting, (el) => el.opacity(0.6))
                                .child(
                                    markedText(row, t, isShown) ??
                                        TextView.markdown(
                                            id,
                                            typedMarkdown(row.text),
                                        ).selectable(isShown),
                                ),
                        ),
                    )
                    .when(!row.pictures.length && !row.files.length, (el) =>
                        el.child(detailsLine(row, t)),
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
                        .when(Boolean(markedText(row, t, isShown)), (el) =>
                            el.child(markedText(row, t, isShown) ?? ''),
                        )
                        .children(
                            (markedText(row, t, isShown)
                                ? []
                                : (fold?.shown ??
                                  splitBlocks(unlinkFiles(row.text)))
                            ).map((block, i) =>
                                block.kind === 'text'
                                    ? TextView.markdown(
                                          `${id}-${i}`,
                                          block.text,
                                      ).selectable(isShown)
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
                                              ).selectable(isShown),
                                          ),
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
                            TextView.markdown(
                                `${pre}${row.id}@${row.version}`,
                                `\`\`\`json\n${row.calls?.[0]?.input ?? ''}\n\`\`\``,
                            ).selectable(isShown),
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
        return div()
            .px(4)
            .text_size(12)
            .text_color(t.muted)
            .when(details !== null, (el) => el.child(details ?? ''));
    }

    /**
     * a file a reply names, its own row under the reply (FRM-587): the list's item click opens it. no press or hover
     * handler in here, one inside a list row blanks the whole list (herdr-app#894)
     * @param {Row} row @param {Theme} t
     */
    function fileRow(row, t) {
        if (isSentRow(row.id))
            return v_flex()
                .w_full()
                .items_end()
                .gap(2)
                .child(sentFiles(row, t).cursor_pointer())
                .child(detailsLine(row, t));
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
     * how a row draws when not plain: find's word marks over the stepped row only, keyed by the query; every other
     * match keeps its markdown under a tint, since a marked row loses its bold and reflows (dima's o2, 18:46)
     * @param {Row} row
     */
    function rowLook(row) {
        const { isOpen, q } = deps.find().state;
        if (isOpen && deps.find().current() === row.id) return `find:${q}`;
        return foldOf(row) ? 'fold' : undefined;
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
            splitBlocks(unlinkFiles(row.text)),
            Math.floor(Math.max(240, width) / CHAR_PX),
            {
                isEarlierTurn: !currentTurn.has(row.id),
                isShowMoreOn: deps.isShowMore(),
            },
        );
    }

    /** the rows as the height book keys them: a row drawn another way is measured apart @param {readonly Row[]} rows */
    function booked(rows) {
        return rows.map((row) => {
            const look = rowLook(row);
            return look ? { ...row, look } : row;
        });
    }

    /**
     * the stepped row as plain words, every match in a soft accent, the stepped one in full accent; null for any
     * other row, or while its marked height is not measured yet
     * @param {Row} row @param {Theme} t
     */
    function markedText(row, t, isShown = true) {
        const look = rowLook(row);
        // the shown copy waits for its marked height, so the list never draws it at the plain one and jumps
        if (
            !look?.startsWith('find:') ||
            (isShown && !deps.heights.has({ ...row, look }))
        )
            return null;
        const { q } = deps.find().state;
        const current = deps.find().currentHit();
        return v_flex().children(
            findSpans(row.text, q).map((line) =>
                h_flex()
                    .flex_wrap()
                    .children(
                        line.flatMap((span) =>
                            span.match === null
                                ? span.text
                                      .split(/(?<=\s)/)
                                      .map((word) => div().child(word))
                                : [
                                      div()
                                          .rounded(3)
                                          .px(1)
                                          .bg(
                                              current?.id === row.id &&
                                                  current.n === span.match
                                                  ? t.accent
                                                  : tint(t.accent, '4d'),
                                          )
                                          .when(
                                              current?.id === row.id &&
                                                  current.n === span.match,
                                              (el) =>
                                                  el.text_color(t.background),
                                          )
                                          .child(span.text),
                                  ],
                        ),
                    ),
            ),
        );
    }

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
         * @returns {{ kind: 'redraw' } | { kind: 'pictures', files: string[], at: number } | { kind: 'file', path: string } | null}
         */
        press(rows, key) {
            const id = key.replace(/#(?:above|below)$/, '');
            const pressed = rows.find((r) => r.id === id);
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
                    look.tools === 'hide'
                        ? rows.filter((row) => row.kind !== 'tool')
                        : rows,
                    home(),
                    fileRows,
                ),
                toolFolds,
            ),
    };
}
