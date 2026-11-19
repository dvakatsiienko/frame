// the blocked panel: a thread waiting on a permission, its screen's ask and the keys that answer it, over the quill

import { TextView, h_flex, v_flex } from 'gpui-base';
import { div } from 'gpui-kit';
import { hc, props, run as runCommand, settings } from 'herdr';

import { screenTail } from './blocked.js';

/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./chat-types.js').Theme} Theme */

/**
 * @param {{ address: () => string | null, isBlocked: () => boolean }} deps the shown thread, and whether it waits on
 *   a permission
 */
export function createBlockedPanel({ address, isBlocked }) {
    /** the ask as the thread's screen shows it; null while none is read @type {string | null} */
    let screen = null;

    /** its ask, read off its screen each second while it waits @param {Context} cx */
    function read(cx) {
        const shown = address();
        if (!shown || !isBlocked()) {
            if (screen !== null) {
                screen = null;
                cx.notify();
            }
            return;
        }
        cx.spawn(async (cx) => {
            const out = await hc(['read', shown]).catch(() => null);
            if (address() !== shown || !out || out.code !== 0) return;
            const tail = screenTail(out.stdout);
            if (tail === screen) return;
            screen = tail;
            cx.notify();
        });
    }

    /** Claude asking (a permission): its screen with the keys that answer it @param {Theme} t */
    function view(t) {
        const shown = address() ?? '';
        /** @param {string[]} keys */
        const keys =
            (...keys) =>
            (/** @type {any} */ _e, /** @type {Context} */ cx) => {
                cx.spawn(async (cx) => {
                    await hc(['keys', shown, ...keys]);
                    screen = null;
                    read(cx);
                });
            };
        return v_flex()
            .id('chat-blocked')
            .mx(32)
            .mb(8)
            .gap(8)
            .p(10)
            .rounded(8)
            .bg(t.raised)
            .border_1()
            .border_color(t.blocked)
            .child(
                h_flex()
                    .gap(8)
                    .items_center()
                    .child(div().size(8).rounded(4).bg(t.blocked))
                    .child(
                        div()
                            .font_semibold()
                            .text_color(t.foreground)
                            .child('Claude is asking'),
                    ),
            )
            .when(Boolean(screen), (el) =>
                el.child(
                    div()
                        .id('chat-blocked-screen')
                        .max_h(260)
                        .overflow_y_scroll()
                        .p(8)
                        .rounded(6)
                        .bg(t.background)
                        .text_size(11)
                        .font_family(
                            String(settings().font_family ?? 'JetBrains Mono'),
                        )
                        .text_color(t.foreground)
                        .child(
                            TextView.markdown(
                                'chat-blocked-text',
                                `\`\`\`\n${screen ?? ''}\n\`\`\``,
                            ).selectable(true),
                        ),
                ),
            )
            .child(
                h_flex()
                    .gap(6)
                    .flex_wrap()
                    .children(
                        ['1', '2', '3', '4'].map((k) =>
                            askButton(
                                t,
                                `chat-key-${k}`,
                                k,
                                keys(k),
                                k === '1',
                            ),
                        ),
                    )
                    .child(
                        askButton(t, 'chat-key-enter', 'Enter', keys('enter')),
                    )
                    .child(askButton(t, 'chat-key-esc', 'Esc', keys('esc')))
                    .child(div().flex_1())
                    .child(
                        askButton(t, 'chat-to-terminal', 'Open terminal', () =>
                            toTerminal(shown),
                        ),
                    ),
            );
    }

    return {
        /** a new thread is shown: nothing of the old one's ask may act on it */
        clear() {
            screen = null;
        },
        read,
        view,
    };
}

/** the Terminal view on this thread: the stack shows its other child, the thread's pane takes the keyboard @param {string} address */
function toTerminal(address) {
    const { stack, other } = props() ?? {};
    if (stack && other) runCommand('layout.select', { child: other, stack });
    if (address) runCommand('pane.focus', { terminal: address });
}

/**
 * a key of the panel; `strong` is the one that answers
 * @param {Theme} t @param {string} id @param {string} label @param {(e: any, cx: any) => void} onClick @param {boolean} [strong]
 */
function askButton(t, id, label, onClick, strong) {
    return div()
        .id(id)
        .px(10)
        .py(4)
        .rounded(6)
        .text_size(12)
        .cursor_pointer()
        .bg(strong ? t.solid : t.raised)
        .text_color(strong ? t.solid_foreground : t.foreground)
        .hover((s) =>
            strong
                ? s.bg(t.accent).text_color(t.accent_foreground)
                : s.bg(t.hover),
        )
        .on_click((e, cx) => onClick(e, cx))
        .child(label);
}
