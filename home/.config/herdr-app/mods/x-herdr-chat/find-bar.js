// the find bar (⌘F): his query over the chat, «n / N», the steps and ✕. it owns the search state the rows draw their
// marks from; the search rules live in find.js

import { Input, InputState, h_flex } from 'gpui-base';
import { div } from 'gpui-kit';

import { FIND_SETTLE_MS, createFind, findCount } from './find.js';
import { tint } from './tint.js';

/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./chat-types.js').Theme} Theme */
/** @typedef {import('./row-model.js').Row} Row */

/**
 * @param {{ rows: () => readonly Row[], show: (id: string) => void, isAllLoaded: () => boolean, focusQuill: () => void }}
 *   deps the rows shown, a hit's row brought to the view's top, whether the thread's first line is loaded, the quill
 *   taking the keyboard back
 */
export function createFindBar({ rows, show, isAllLoaded, focusQuill }) {
    const find = createFind();
    /** a search waits this typing's serial out: a newer key wins */
    let typed = 0;
    /** made in the view's init, where herdr allows an input's state, and again at each reset @type {import('gpui-base').InputState | null} */
    let box = null;

    /** a hit's row scrolls in at the view's top @param {string | null} id @param {Context} cx */
    function showHit(id, cx) {
        if (id) show(id);
        cx.notify();
    }

    /** the bar's box, empty: each close leaves a new one, so a reopened bar starts blank (dima, 18:11) */
    function newBox() {
        const input = InputState.new({ placeholder: 'Find in this chat' });
        input.on('change', (_event, cx) => {
            const at = ++typed;
            cx.timer.after(FIND_SETTLE_MS, (later) => {
                if (typed !== at) return;
                find.search(rows(), input.value());
                showHit(find.current(), later);
            });
        });
        input.on('submit', (event, cx) =>
            showHit(find.step(event.shift ? 'newer' : 'older'), cx),
        );
        return input;
    }

    /** the bar shut and blank: at the view's init, and for a thread no longer shown, with no keyboard to hand back */
    function reset() {
        find.close();
        typed += 1;
        box = newBox();
    }

    /** ⌘F: the bar opens with the keyboard in it @param {Context} cx */
    function open(cx) {
        find.open();
        cx.timer.after(16, () => box?.focus());
        cx.notify();
    }

    /** @param {Context} cx */
    function close(cx) {
        if (!find.state.isOpen) return cx.propagate();
        reset();
        focusQuill();
        cx.notify();
    }

    /** the bar over the chat @param {Theme} t */
    function view(t) {
        const count = findCount(find.state);
        /** @param {string} id @param {string} glyph @param {string} hint @param {(cx: Context) => void} act */
        const button = (id, glyph, hint, act) =>
            div()
                .id(id)
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
                .on_click((_e, cx) => act(cx))
                .child(glyph);
        // the count and the steps sit beside his query on one pill, as the picture viewer's tools do (dima, 18:12)
        // the tools sit on a pill of their own inside the bar, apart from his query (dima, 18:46)
        const steps = h_flex()
            .flex_none()
            .px(4)
            .py(2)
            .gap(2)
            .items_center()
            .rounded_full()
            .bg(t.background)
            .border(1)
            .border_color(t.border)
            .when(Boolean(count), (el) =>
                el.child(
                    div()
                        .id('find-count')
                        .px(6)
                        .text_size(12)
                        .text_color(t.muted)
                        .when(!isAllLoaded(), (el) =>
                            el.tooltip(
                                'Counts the history loaded so far: scroll up for older',
                            ),
                        )
                        .child(count),
                ),
            )
            .child(
                button('chat-find-newer', '↑', 'Newer match (↑ ⇧Enter)', (cx) =>
                    showHit(find.step('newer'), cx),
                ),
            )
            .child(
                button('chat-find-older', '↓', 'Older match (↓ Enter)', (cx) =>
                    showHit(find.step('older'), cx),
                ),
            )
            .child(div().w(1).h(16).mx(6).bg(t.border))
            .child(
                button('chat-find-close', '✕', 'Close (Esc)', (cx) =>
                    close(cx),
                ),
            );
        return (
            h_flex()
                .id('chat-find')
                .key_context('ChatFind')
                // a press anywhere else closes it (dima, 21:04)
                .on_mouse_down_out((_e, cx) => close(cx))
                .on_action('x_herdr_chat_find_close', (_e, cx) => close(cx))
                .on_action('x_herdr_chat_find_newer', (_e, cx) =>
                    showHit(find.step('newer'), cx),
                )
                .on_action('x_herdr_chat_find_older', (_e, cx) =>
                    showHit(find.step('older'), cx),
                )
                .absolute()
                .top(10)
                .right(20)
                .w(460)
                .pl(14)
                .pr(8)
                .py(4)
                .gap(6)
                .items_center()
                .rounded_full()
                // lifted off the chat: the popover surface, an accent edge and a shadow (dima, 18:46: «blended with the chat»)
                .bg(t.popover)
                .border(1)
                .border_color(tint(t.accent, '66'))
                .shadow_lg()
                // a press on the bar stays on it: the list under it never takes the click
                .on_mouse_down('left', (_e, cx) => cx.stop_propagation())
                .child(
                    div()
                        .flex_1()
                        .child(
                            Input.new(
                                /** @type {import('gpui-base').InputState} */ (
                                    box
                                ),
                            ),
                        ),
                )
                .child(steps)
        );
    }

    /** find: ⌘F opens its bar; in the bar Enter or ↓ steps older, ⇧Enter or ↑ newer, Esc closes @param {Context} cx */
    function start(cx) {
        reset();
        cx.bind_keys([
            {
                action: 'x_herdr_chat_find_newer',
                context: 'ChatFind > Input',
                keystroke: 'up',
            },
            {
                action: 'x_herdr_chat_find_older',
                context: 'ChatFind > Input',
                keystroke: 'down',
            },
            // the bar's Esc from wherever the keyboard sits in the chat; a box deeper down keeps its own Esc
            {
                action: 'x_herdr_chat_find_close',
                context: 'XChat',
                keystroke: 'escape',
            },
            {
                action: 'x_herdr_chat_find',
                context: 'XChat',
                keystroke: 'cmd-f',
            },
            {
                action: 'x_herdr_chat_find_close',
                context: 'ChatFind',
                keystroke: 'escape',
            },
            // the find box's own Esc comes first unless ours sits on the box itself
            {
                action: 'x_herdr_chat_find_close',
                context: 'ChatFind > Input',
                keystroke: 'escape',
            },
        ]);
    }

    return { close, find, open, reset, start, view };
}
