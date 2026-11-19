// the picture viewer: a click on a picture opens it over the whole chat (W33/W35), with ⌘ held his desktop app;
// zoom, step, copy, open and Finder; it holds the keyboard while open. the steps' rules live in viewer.js

import { h_flex, v_flex } from 'gpui-base';
import { div, image } from 'gpui-kit';
import { exec } from 'herdr';

import { pictureOpenArgs } from './attach.js';
import { copyPicture, viewCopy } from './shots.js';
import { tint } from './tint.js';
import { openViewer, viewerAfter, viewerCount, viewerLevel } from './viewer.js';

/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./chat-types.js').Theme} Theme */
/** @typedef {import('./viewer.js').ViewerStep | 'copy' | 'open' | 'folder'} Step */

/**
 * @param {{
 *   file: () => string | null,
 *   isCleanShot: () => boolean,
 *   isCmdHeld: () => boolean,
 *   room: () => { width: number, height: number },
 *   say: (note: string, cx: Context) => void,
 *   focusQuill: () => void,
 * }} deps the thread's transcript, his CleanShot and ⌘ state, the chat's size, a note under the quill, the quill
 *   taking the keyboard back
 */
export function createPictureViewer({
    file,
    isCleanShot,
    isCmdHeld,
    room,
    say,
    focusQuill,
}) {
    /** @type {ReturnType<typeof openViewer>} */
    let viewer = null;
    /** a later click, a close or a thread switch outranks an open still reading */
    let ask = 0;
    /** made in the view's init, where herdr allows a focus handle @type {import('gpui-kit').FocusHandle | null} */
    let keys = null;

    /**
     * a click on a picture: the viewer over the chat, or with ⌘ held his desktop app (CleanShot annotate by default)
     * @param {string[]} files @param {number} at @param {Context} cx
     */
    function show(files, at, cx) {
        const clicked = files[at];
        if (isCmdHeld() && clicked)
            exec('open', pictureOpenArgs(clicked, isCleanShot())).catch(
                () => {},
            );
        else open(files, at, cx);
    }

    /**
     * the viewer opens on these pictures, at the one clicked; each is read whole first
     * @param {string[]} files @param {number} at @param {Context} cx
     */
    function open(files, at, cx) {
        const shownFile = file();
        const mine = ++ask;
        cx.spawn(async (cx) => {
            const made = await Promise.all(files.map((f) => viewCopy(f)));
            /** @type {import('./viewer.js').Shown[]} */
            const shown = [];
            if (file() !== shownFile || ask !== mine) return;
            // the picture clicked opens, or nothing: never a sibling in its place
            if (!made[at]) return say('That picture is gone', cx);
            let from = 0;
            made.forEach((copy, i) => {
                if (!copy) return;
                if (i === at) from = shown.length;
                shown.push({ ...copy, file: files[i] ?? '' });
            });
            viewer = openViewer(shown, from);
            if (viewer) cx.timer.after(16, () => keys?.focus());
            cx.notify();
        });
    }

    /** @param {Step} next @param {Context} cx */
    function step(next, cx) {
        const shown = viewer?.pictures[viewer.at];
        if (next === 'copy') {
            if (shown) copyPicture(shown.file).catch(() => {});
            return;
        }
        if (next === 'open' || next === 'folder') {
            if (shown)
                exec(
                    'open',
                    next === 'open'
                        ? pictureOpenArgs(shown.file, isCleanShot())
                        : ['-R', shown.file],
                ).catch(() => {});
            return;
        }
        viewer = viewerAfter(viewer, next);
        if (!viewer) {
            ask += 1;
            focusQuill();
        }
        cx.notify();
    }

    /** the picture viewer over the whole chat @param {Theme} t */
    function view(t) {
        const state = viewer;
        const shown = state?.pictures[state.at];
        if (!state || !shown) return div();
        const roomW = Math.max(120, room().width - 48);
        const roomH = Math.max(120, room().height - 24);
        const fit = Math.min(1, roomW / shown.w, roomH / shown.h);
        const scale = fit * state.zoom;
        /** @param {string} id @param {string} glyph @param {string} hint @param {Step} action */
        const button = (id, glyph, hint, action) =>
            div()
                .id(`chat-viewer-${id}`)
                .h(28)
                .min_w(28)
                .px(8)
                .flex()
                .items_center()
                .justify_center()
                .rounded_full()
                .cursor_pointer()
                .hover((style) => style.bg(t.border))
                .tooltip(hint)
                .on_click((_e, cx) => {
                    cx.stop_propagation();
                    step(action, cx);
                })
                .child(glyph);
        const actions = /** @type {const} */ ([
            'previous',
            'next',
            'zoom in',
            'zoom out',
            'fit',
            'copy',
            'close',
        ]);
        const root = v_flex()
            .id('chat-viewer')
            .track_focus(/** @type {import('gpui-kit').FocusHandle} */ (keys))
            .key_context('ChatViewer')
            .absolute()
            .top(0)
            .left(0)
            .size_full()
            .bg(tint(t.background, 'f2'))
            .on_mouse_down('left', (_e, cx) => {
                cx.stop_propagation();
                keys?.focus();
            })
            // the tools sit centred on a pill of their own, so they read apart from the picture (dima, 17:40)
            .child(
                h_flex()
                    .flex_none()
                    .w_full()
                    .py(10)
                    .justify_center()
                    .child(
                        h_flex()
                            .px(8)
                            .py(4)
                            .gap(2)
                            .items_center()
                            .rounded_full()
                            .bg(t.raised)
                            .border(1)
                            .border_color(t.border)
                            .text_color(t.foreground)
                            .child(
                                button('out', '−', 'Zoom out (−)', 'zoom out'),
                            )
                            .child(
                                div()
                                    .id('chat-viewer-level')
                                    .min_w(48)
                                    .flex()
                                    .justify_center()
                                    .text_size(12)
                                    .text_color(t.muted)
                                    .cursor_pointer()
                                    .tooltip('Fit (0)')
                                    .on_click((_e, cx) => step('fit', cx))
                                    .child(viewerLevel(state)),
                            )
                            .child(button('in', '+', 'Zoom in (+)', 'zoom in'))
                            .child(div().w(1).h(16).mx(6).bg(t.border))
                            .child(
                                button(
                                    'copy',
                                    '⧉',
                                    'Copy picture (⌘C)',
                                    'copy',
                                ),
                            )
                            .child(
                                button(
                                    'open',
                                    '↗',
                                    isCleanShot()
                                        ? 'Open in CleanShot (⌘-click a square)'
                                        : 'Open in Preview (⌘-click a square)',
                                    'open',
                                ),
                            )
                            .child(
                                button(
                                    'folder',
                                    '📁',
                                    'Show in Finder',
                                    'folder',
                                ),
                            )
                            .when(state.pictures.length > 1, (el) =>
                                el
                                    .child(div().w(1).h(16).mx(6).bg(t.border))
                                    .child(
                                        button(
                                            'prev',
                                            '←',
                                            'Previous (←)',
                                            'previous',
                                        ),
                                    )
                                    .child(
                                        div()
                                            .min_w(40)
                                            .flex()
                                            .justify_center()
                                            .text_size(12)
                                            .text_color(t.muted)
                                            .child(viewerCount(state)),
                                    )
                                    .child(
                                        button('next', '→', 'Next (→)', 'next'),
                                    ),
                            )
                            .child(div().w(1).h(16).mx(6).bg(t.border))
                            .child(
                                button('close', '✕', 'Close (Esc)', 'close'),
                            ),
                    ),
            )
            .child(
                div()
                    .id('chat-viewer-room')
                    .flex_1()
                    .min_h(0)
                    .overflow_scroll()
                    .flex()
                    .items_center()
                    .justify_center()
                    .child(
                        div()
                            .flex_none()
                            .w(Math.round(shown.w * scale))
                            .h(Math.round(shown.h * scale))
                            .child(image(shown.rel).size_full()),
                    ),
            );
        for (const action of actions)
            root.on_action(
                `x_herdr_chat_viewer_${action.replace(' ', '_')}`,
                (_e, cx) => step(action, cx),
            );
        return root;
    }

    return {
        /** the viewer and a still-reading open belong to the thread they opened on */
        close() {
            viewer = null;
            ask += 1;
        },
        isOpen: () => viewer !== null,
        /** the open viewer holds the keyboard: a click on the list or a later focus of the quill never keeps it @param {Context} cx */
        keepKeys(cx) {
            if (viewer && !keys?.is_focused())
                cx.timer.after(0, () => keys?.focus());
        },
        show,
        /** @param {Context} cx */
        start(cx) {
            keys = cx.focus_handle();
            // the open viewer holds the keyboard: ← → move, + − 0 zoom, ⌘C copies, Esc closes
            cx.bind_keys(
                [
                    ['left', 'previous'],
                    ['right', 'next'],
                    ['=', 'zoom in'],
                    ['+', 'zoom in'],
                    ['-', 'zoom out'],
                    ['0', 'fit'],
                    ['cmd-c', 'copy'],
                    ['escape', 'close'],
                ].map(([keystroke, step]) => ({
                    action: `x_herdr_chat_viewer_${String(step).replace(' ', '_')}`,
                    context: 'ChatViewer',
                    keystroke: String(keystroke),
                })),
            );
        },
        step,
        view,
    };
}
