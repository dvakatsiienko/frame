// the quill-mini (FRM-585): the small box over the list where he writes a note on the words he selected. F6 or the
// right-click menu opens it on a passage; F6, Esc or a press outside shuts it and keeps the note as his draft. the notes
// are notes.js's; this file holds which one is open and draws it

import { Textarea, TextareaState, h_flex, v_flex } from 'gpui-base';
import { div } from 'gpui-kit';

import { focusBorder } from './focus-ring.js';
import { createCmdEnter, createKeyPress } from './keypress.js';
import { retextWait } from './magic.js';
import { isLocked } from './note-states.js';
import { quoteOf } from './note-text.js';

/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./chat-types.js').Theme} Theme */
/** @typedef {import('./note-states.js').Note} Note */
/** @typedef {import('./selection.js').SelectedAt} SelectedAt */
/** @typedef {{ x: number, y: number }} Point */

const ENTER = 'x_herdr_chat_mini_enter';
const CMD_ENTER = 'x_herdr_chat_mini_cmd_enter';
const ESCAPE = 'x_herdr_chat_mini_escape';
const TAB = 'x_herdr_chat_mini_tab';
const BACK = 'x_herdr_chat_mini_back';
const WIDTH = 420;
// how far from the words' end, and from the list's edge
const GAP = 12;
// the box before its height was ever measured
const FIRST_HEIGHT = 130;
/** its one stop in the Tab loop */
export const MINI_STOP = 'quill-mini';

/**
 * where the box sits: under the words' end, over it when it would run off the bottom, kept inside the list; with no place
 * (a select-all, no press yet) at the bottom middle
 * @param {Point | null} end in the list's px @param {{ w: number, h: number }} view @param {{ w: number, h: number }} size
 */
export function miniPlace(end, view, size) {
    const most = {
        x: Math.max(0, view.w - size.w - GAP),
        y: Math.max(0, view.h - size.h - GAP),
    };
    if (!end) return { x: Math.max(0, (view.w - size.w) / 2), y: most.y };
    const under = end.y + GAP;
    return {
        x: Math.max(0, Math.min(end.x, most.x)),
        y:
            under > most.y
                ? Math.min(most.y, Math.max(0, end.y - GAP - size.h))
                : Math.max(0, under),
    };
}

/** the word under the box: where the note stands @param {Note} note */
export const noteWord = (note) =>
    note.state === 'draft'
        ? (note.reason ?? '')
        : note.state === 'taken'
          ? 'waiting'
          : note.state;

/**
 * @param {object} deps
 * @param {ReturnType<typeof import('./notes.js').createNotes>} deps.notes
 * @param {() => string | null} deps.thread the shown thread's transcript
 * @param {() => string} deps.threadName
 * @param {(id: string) => number} deps.back how many replies stand below a message
 * @param {() => import('./magic.js').Joins | null} deps.joins what the shown thread's state lists of its joins
 * @param {(id: string, back: number) => Promise<string | null>} deps.sendNote why it did not go
 * @param {() => { width: number, height: number }} deps.room the list's size
 * @param {ReturnType<typeof import('./tab-loop.js').createTabMember>} deps.tab
 * @param {(cx: Context) => void} deps.pressEscape what is on top of the chat closes
 * @param {() => void} deps.focusQuill
 */
export function createQuillMini(deps) {
    /** the note in the box @type {{ thread: string, id: string, at: Point | null } | null} */
    let open = null;
    /** made in the view's init, where herdr allows it @type {import('gpui-base').TextareaState | null} */
    let box = null;
    let isFocused = false;
    let height = FIRST_HEIGHT;
    /** a typing's serial: a newer key's rest wins */
    let typed = 0;
    /** why the last press did nothing @type {string | null} */
    let said = null;
    const enter = createKeyPress();
    const cmdEnter = createCmdEnter();

    const noteNow = () =>
        open
            ? (deps.notes.of(open.thread).find((n) => n.id === open?.id) ??
              null)
            : null;

    /** the box shut, its draft kept; an empty one leaves no record */
    function reset() {
        if (!open) return;
        const { thread } = open;
        open = null;
        said = null;
        typed += 1;
        deps.notes.tidy(thread);
    }

    /** @param {Context} cx */
    function close(cx) {
        if (!open) return;
        reset();
        deps.focusQuill();
        cx.notify();
    }

    /** the box on these words, the cursor in it @param {SelectedAt} selected @param {Context} cx */
    function show({ at, passage }, cx) {
        const thread = deps.thread();
        if (!thread || !box) return;
        reset();
        const note = deps.notes.open(thread, passage);
        open = { at, id: note.id, thread };
        box.set_value(note.text);
        box.set_selected_range({
            end: note.text.length,
            start: note.text.length,
        });
        cx.timer.after(16, () => {
            if (open?.id === note.id) box?.focus();
        });
        cx.notify();
    }

    /** F6: the box on what stood selected, or shut @param {() => SelectedAt | null} selected @param {Context} cx */
    function toggle(selected, cx) {
        if (open) return close(cx);
        const now = selected();
        if (now) show(now, cx);
    }

    /** @param {string | null} reason @param {{ thread: string, id: string }} at @param {Context} cx */
    function say(reason, at, cx) {
        if (open?.id === at.id) said = reason;
        cx.notify();
    }

    /** Enter: the note joins, again takes it back @param {Context} cx */
    function join(cx) {
        const note = noteNow();
        if (!open || !note) return;
        const at = open;
        const isWaiting = note.state === 'waiting';
        if (!isWaiting && (isLocked(note) || !note.text.trim())) return;
        const answer = isWaiting
            ? deps.notes.takeBack(at.thread, at.id, deps.joins())
            : deps.notes.join(
                  at.thread,
                  at.id,
                  deps.joins(),
                  deps.back(note.passage.row.id),
              );
        say(null, at, cx);
        cx.spawn(async (cx) => say(await answer, at, cx));
    }

    /** ⌘Enter: the note goes now, and the box with it @param {Context} cx */
    function sendNow(cx) {
        const note = noteNow();
        if (!open || !note || isLocked(note) || !note.text.trim()) return;
        const at = open;
        const answer = deps.sendNote(at.id, deps.back(note.passage.row.id));
        cx.spawn(async (cx) => {
            const reason = await answer;
            const isSent =
                deps.notes.of(at.thread).find((n) => n.id === at.id)?.state ===
                'sent';
            if (isSent && open?.id === at.id) close(cx);
            else say(reason, at, cx);
        });
    }

    /** his typing: a draft keeps it at once, a waiting note's row once his keys rest @param {string} text @param {Context} cx */
    function type(text, cx) {
        const note = noteNow();
        if (!open || !note || note.text === text) return;
        const at = open;
        const serial = ++typed;
        said = null;
        const write = () =>
            deps.notes.typed(at.thread, at.id, text, deps.joins());
        if (note.state === 'draft') write();
        else
            cx.timer.after(retextWait(text), (later) => {
                if (serial !== typed) return;
                later.spawn(async (cx) => {
                    if (!(await write()) && open?.id === at.id)
                        said = 'It joined the turn first';
                    cx.notify();
                });
            });
        cx.notify();
    }

    /** the box and its keys, made in the view's init @param {Context} cx */
    function start(cx) {
        const made = TextareaState.new({
            placeholder: 'A note on these words',
        });
        made.set_auto_grow(1, 6);
        made.on('change', (_event, cx) => type(made.value(), cx));
        made.on('focus', (_event, cx) => {
            isFocused = true;
            deps.tab.held(MINI_STOP);
            cx.notify();
        });
        made.on('blur', (_event, cx) => {
            isFocused = false;
            enter.blurred();
            deps.tab.left(MINI_STOP, (run) => cx.timer.after(0, run));
            cx.notify();
        });
        box = made;
        // each before the text box's own (context `Input`), as the quill's; Shift+Enter is the box's line break
        cx.bind_keys([
            {
                action: ENTER,
                context: 'XChatQuillMini > Input',
                keystroke: 'enter',
            },
            {
                action: CMD_ENTER,
                context: 'XChatQuillMini > Input',
                keystroke: 'cmd-enter',
            },
            {
                action: ESCAPE,
                context: 'XChatQuillMini > Input',
                keystroke: 'escape',
            },
            {
                action: TAB,
                context: 'XChatQuillMini > Input',
                keystroke: 'tab',
            },
            {
                action: BACK,
                context: 'XChatQuillMini > Input',
                keystroke: 'shift-tab',
            },
        ]);
    }

    /** @param {Theme} t */
    function view(t) {
        const note = noteNow();
        if (!open || !note || !box) return null;
        const room = deps.room();
        const width = Math.min(WIDTH, Math.max(0, room.width - 2 * GAP));
        const place = miniPlace(
            open.at,
            { h: room.height, w: room.width },
            { h: height, w: width },
        );
        const isDim = isLocked(note) || !note.text.trim();
        const isWaiting = note.state === 'waiting';
        /** @param {string} id @param {string} label @param {string} hint @param {(cx: Context) => void} act */
        const button = (id, label, hint, act) =>
            div()
                .id(id)
                .h(24)
                .px(10)
                .flex()
                .flex_none()
                .items_center()
                .rounded(6)
                .border_1()
                .border_color(t.border)
                .text_size(12)
                .text_color(isDim ? t.dim : t.foreground)
                .tooltip(hint)
                .when(!isDim, (el) =>
                    el
                        .cursor_pointer()
                        .hover((s) => s.bg(t.hover))
                        .on_click((_e, cx) => act(cx)),
                )
                .child(label);
        return (
            v_flex()
                .id('chat-quill-mini')
                .key_context('XChatQuillMini')
                .absolute()
                .left(place.x)
                .top(place.y)
                .w(width)
                .px(12)
                .py(10)
                .gap(8)
                .rounded(12)
                .bg(t.popover)
                .border(1)
                .border_color(focusBorder(isFocused, t, t.border))
                .shadow_lg()
                .cursor_default()
                .on_size_change((size, cx) => {
                    if (Math.abs(size.height - height) < 1) return;
                    height = size.height;
                    cx.notify();
                })
                // a press on the box is the box's, never the list's under it
                .on_mouse_down('left', (_e, cx) => cx.stop_propagation())
                .on_mouse_down('right', (_e, cx) => cx.stop_propagation())
                .on_mouse_down_out((_e, cx) => close(cx))
                .on_action(ENTER, (_e, cx) => {
                    if (enter.pressed() === 'act') join(cx);
                })
                .on_action(CMD_ENTER, (_e, cx) => {
                    if (cmdEnter.pressed(Date.now()) === 'act') sendNow(cx);
                })
                .on_action(ESCAPE, (_e, cx) => deps.pressEscape(cx))
                .on_action(TAB, () => deps.tab.ask(MINI_STOP, false))
                .on_action(BACK, () => deps.tab.ask(MINI_STOP, true))
                .on_key_up((e) => {
                    if (e.key === 'enter') enter.released();
                })
                .on_modifiers_changed((e) => {
                    if (!e.modifiers.platform) enter.modifiersReleased();
                })
                .child(
                    h_flex()
                        .gap(8)
                        .text_size(12)
                        .text_color(t.muted)
                        .child(
                            div()
                                .flex_1()
                                .min_w(0)
                                .truncate()
                                .child(
                                    `"${quoteOf(note.passage.parts.map((p) => p.words))}"`,
                                ),
                        )
                        .child(div().flex_none().child(deps.threadName())),
                )
                .child(
                    isLocked(note) ? div().child(note.text) : Textarea.new(box),
                )
                .child(
                    h_flex()
                        .gap(6)
                        .items_center()
                        .child(
                            div()
                                .flex_1()
                                .min_w(0)
                                .truncate()
                                .text_size(12)
                                .text_color(t.muted)
                                .child(said ?? noteWord(note)),
                        )
                        .child(
                            button(
                                'chat-mini-join',
                                isWaiting ? 'take back' : 'join',
                                isWaiting
                                    ? 'Take it back (Enter)'
                                    : "Join its turn's next step, or its next turn (Enter)",
                                join,
                            ),
                        )
                        .child(
                            button(
                                'chat-mini-send',
                                'send now',
                                'Send now: a turn starts (⌘Enter)',
                                sendNow,
                            ),
                        ),
                )
        );
    }

    return {
        close,
        /** the Tab loop's turn */
        focus: () => box?.focus(),
        isOpen: () => open !== null,
        reset,
        show,
        start,
        toggle,
        view,
    };
}
