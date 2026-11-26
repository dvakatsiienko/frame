// the quill-mini (FRM-585): the small box over the list where he writes a note on the words he selected. F6 or the
// right-click menu opens it on a passage; F6, Esc or a press outside shuts it and keeps the note as his draft. the notes
// are notes.js's; this file holds which one is open and draws it

import { Textarea, TextareaState, h_flex, v_flex } from 'gpui-base';
import { div } from 'gpui-kit';
import { exec, settings } from 'herdr';

import { focusBorder } from './focus-ring.js';
import { JOIN_TAKE_MS } from './joins.js';
import { createCmdEnter, createKeyPress } from './keypress.js';
import { retextWait } from './magic.js';
import { MINI_MOTION_MS, createMiniMotion } from './mini-motion.js';
import { isLocked, stateWord } from './note-states.js';
import { quoteOf } from './note-text.js';
import { createPressProbe } from './press-probe.js';

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
// a held F6 repeats: this mac's first repeat comes 150 ms after the press, the next every 15 ms. one faster than a hand
// is a repeat; one at the first repeat's moment waits a hand's gap to see whether a stream follows, so his own presses
// as fast as he likes keep toggling it (dima, 26 Nov 16:10: «make it work even if i press f6 very very fast»)
const F6_REPEAT_MS = 200;
const probe = createPressProbe('quill');
const F6_FIRST_REPEAT_MS = 140;
const F6_HAND_MS = 50;
const MOTION = {
    duration: MINI_MOTION_MS,
    easing: /** @type {const} */ ('ease-out'),
};
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

/** the word under the box: where the note stands @param {Note} note @param {boolean} isRefused its row would not take its last words */
export function noteWord(note, isRefused) {
    if (note.state === 'draft') return note.reason ?? '';
    return note.state === 'waiting' && isRefused
        ? 'Not in its row yet'
        : stateWord(note);
}

/**
 * @param {object} deps
 * @param {ReturnType<typeof import('./notes.js').createNotes>} deps.notes
 * @param {() => string | null} deps.thread the shown thread's transcript
 * @param {() => string} deps.threadName
 * @param {(id: string) => string} deps.rowOf the row that holds a message's line now: an older page may join it
 * @param {(id: string) => number} deps.back how many replies stand below a message
 * @param {(id: string, back: number) => Promise<string | null>} deps.sendNote why it did not go
 * @param {(note: string, cx: Context) => void} deps.say the chat's line under the quill
 * @param {(cx: Context) => void} deps.settle the shown thread's notes stand by its state
 * @param {() => { width: number, height: number }} deps.room the list's size
 * @param {ReturnType<typeof import('./tab-loop.js').createTabMember>} deps.tab
 * @param {(cx: Context) => void} deps.pressEscape what is on top of the chat closes
 * @param {(isSending: boolean) => void} deps.focusQuill `isSending`: under the ⌘Enter that sent the note, still held
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
    let lastF6 = Number.NEGATIVE_INFINITY;
    let isF6Held = false;
    /** a press at the first repeat's moment, acted on once no repeat follows @type {{ cancel: () => void } | null} */
    let pendingF6 = null;
    /** reduce motion is on in macOS: still until it is read */
    let isReduced = true;
    /** @type {ReturnType<typeof createMiniMotion<{ note: Note, at: Point | null, height: number }>>} */
    const motion = createMiniMotion(() => isReduced);
    /** notes under way to their thread, until herdr answers: the box keeps the keyboard, and no second press sends one @type {Set<string>} */
    const sending = new Set();
    /** the ⌘ of a ⌘Enter is down */
    let isCmdDown = false;
    /** why the last press did nothing, while the note stands where it stood; `isKept`: past his next key too @type {{ words: string, at: string, isKept: boolean } | null} */
    let said = null;
    const enter = createKeyPress();
    const cmdEnter = createCmdEnter();

    const noteNow = () =>
        open
            ? (deps.notes.of(open.thread).find((n) => n.id === open?.id) ??
              null)
            : null;

    /** @param {Note} note */
    const wordNow = (note) =>
        said?.at === stateWord(note)
            ? said.words
            : noteWord(note, deps.notes.isRefused(note.id));

    /** the thread has it, or herdr may be handing it over now @param {Note} note */
    const isClosed = (note) => isLocked(note) || sending.has(note.id);

    /** the box shut, its draft kept; an empty one leaves no record */
    function drop() {
        if (!open) return;
        const { id, thread } = open;
        typed += 1;
        // a waiting note he emptied comes back as the file is written
        const written = deps.notes
            .write(thread, id)
            .then(() => open?.id !== id && deps.notes.tidy(thread));
        open = null;
        said = null;
        isCmdDown = false;
        deps.notes.tidy(thread);
        return written;
    }

    /** @param {Context} cx */
    function close(cx) {
        if (!open) return;
        const isSending = isCmdDown;
        const note = noteNow();
        const { at } = open;
        const written = drop();
        if (note) motion.closed({ at, height, note }, cx);
        else motion.cut();
        deps.focusQuill(isSending);
        cx.notify();
        cx.spawn(async (cx) => {
            await written;
            cx.notify();
        });
    }

    /** the box on a note, the cursor in it while the note is his @param {Note} note @param {string} thread @param {Point | null} at @param {Context} cx */
    function openOn(note, thread, at, cx) {
        if (!box) return;
        open = { at, id: note.id, thread };
        motion.opened(cx);
        box.set_value(note.text);
        box.set_selected_range({
            end: note.text.length,
            start: note.text.length,
        });
        cx.timer.after(16, () => {
            if (open?.id === note.id && !isClosed(note)) box?.focus();
        });
        cx.notify();
    }

    /** the box on these words @param {SelectedAt} selected @param {Context} cx */
    function show({ at, passage }, cx) {
        const thread = deps.thread();
        if (!thread) return;
        drop();
        openOn(deps.notes.open(thread, passage, deps.rowOf), thread, at, cx);
    }

    /** the box on a note he made, by its row @param {string} id @param {Point | null} at @param {Context} cx */
    function openNote(id, at, cx) {
        const thread = deps.thread();
        if (!thread) return;
        drop();
        const note = deps.notes.of(thread).find((n) => n.id === id);
        if (note) openOn(note, thread, at, cx);
    }

    /** F6: the box on what stood selected, or shut @param {() => SelectedAt | null} selected @param {number} at when it was pressed @param {Context} cx */
    function toggle(selected, at, cx) {
        const gap = at - lastF6;
        lastF6 = at;
        probe('toggle', { gap, isF6Held, isOpen: Boolean(open) });
        if (gap < F6_HAND_MS || (isF6Held && gap < F6_REPEAT_MS)) {
            isF6Held = true;
            pendingF6?.cancel();
            pendingF6 = null;
            return;
        }
        isF6Held = false;
        /** @param {Context} cx */
        const act = (cx) => {
            if (open) return close(cx);
            const now = selected();
            if (now) show(now, cx);
        };
        if (gap < F6_FIRST_REPEAT_MS || gap >= F6_REPEAT_MS) return act(cx);
        pendingF6 = cx.timer.after(F6_HAND_MS, (later) => {
            pendingF6 = null;
            act(later);
        });
    }

    /** why a press did nothing: in the box, or in the chat once it is shut or on another note @param {string | null} words @param {{ thread: string, id: string }} at @param {Context} cx */
    function say(words, at, cx) {
        const note = noteNow();
        if (note?.id === at.id)
            said = words ? { at: stateWord(note), isKept: false, words } : null;
        else if (words && deps.thread() === at.thread) deps.say(words, cx);
        cx.notify();
    }

    /** the words a turn did not get of the note in the box are a new one: the box is on it, the cursor where it was in them @param {string} thread @param {string} id @param {Note} next @param {number} cut characters off their start */
    function movedOn(thread, id, next, cut) {
        if (!box || open?.id !== id || open.thread !== thread) return;
        const { end, start } = box.selected_range();
        open = { ...open, id: next.id };
        typed += 1;
        said = next.reason
            ? { at: stateWord(next), isKept: true, words: next.reason }
            : null;
        box.set_value(next.text);
        box.set_selected_range({
            end: Math.max(0, end - cut),
            start: Math.max(0, start - cut),
        });
    }

    /** Enter: the note joins, again takes it back @param {Context} cx */
    function join(cx) {
        const note = noteNow();
        if (!open || !note) return;
        const at = open;
        const isWaiting = note.state === 'waiting';
        if (sending.has(note.id)) return;
        if (!isWaiting && (isLocked(note) || !note.text.trim())) return;
        const answer = isWaiting
            ? deps.notes.takeBack(at.thread, at.id)
            : deps.notes.join(at.thread, at.id, deps.back(note.passage.row.id));
        say(null, at, cx);
        // a note no turn takes in a minute is his again by itself
        if (!isWaiting)
            cx.timer.after(JOIN_TAKE_MS + 500, (later) => deps.settle(later));
        cx.spawn(async (cx) => say(await answer.catch(String), at, cx));
    }

    /** ⌘Enter: the note goes now, and the box with it @param {Context} cx */
    function sendNow(cx) {
        const note = noteNow();
        if (!open || !note || isClosed(note) || !note.text.trim()) return;
        const at = open;
        sending.add(at.id);
        const answer = deps.sendNote(at.id, deps.back(note.passage.row.id));
        cx.spawn(async (cx) => {
            const reason = await answer.catch(String);
            sending.delete(at.id);
            if (open?.id === at.id && noteNow()?.state === 'sent')
                return close(cx);
            say(reason, at, cx);
            noteChanged(cx);
        });
        cx.notify();
    }

    /** the note in the box moved by itself: the box keeps the keyboard, whoever has the note by now @param {Context} cx */
    function noteChanged(cx) {
        const note = noteNow();
        if (!note || sending.has(note.id)) return cx.notify();
        if (box && box.value().trim() !== note.text.trim())
            box.set_value(note.text);
        cx.notify();
    }

    /** his typing: the note keeps it at once, a waiting note's row once his keys rest @param {string} text @param {Context} cx */
    function type(text, cx) {
        const note = noteNow();
        if (!open || !note || note.text === text) return;
        // no word is taken that would go nowhere
        if (sending.has(note.id)) return box?.set_value(note.text);
        const at = open;
        if (isLocked(note)) {
            // the next word after a note the thread has is a new one's; a space alone waits for it
            const isNew = deps.notes.addAfter(at.thread, at.id, text);
            if (!isNew && text.trim() !== note.text.trim())
                box?.set_value(note.text);
            return cx.notify();
        }
        if (!said?.isKept) said = null;
        deps.notes.typed(at.thread, at.id, text);
        const serial = ++typed;
        if (note.state === 'waiting')
            cx.timer.after(retextWait(text), (later) => {
                if (serial !== typed) return;
                later.spawn(async (cx) => {
                    await deps.notes.write(at.thread, at.id);
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
            isCmdDown = false;
            enter.blurred();
            deps.tab.left(MINI_STOP, (run) => cx.timer.after(0, run));
            cx.notify();
        });
        box = made;
        // init's own awaits may run under another mod's store
        cx.timer.after(0, async () => {
            const out = await exec('defaults', [
                'read',
                'com.apple.universalaccess',
                'reduceMotion',
            ]).catch(() => null);
            // no key is off
            isReduced = out?.code === 0 && out.stdout.trim() === '1';
        });
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
        const live = open ? noteNow() : null;
        // a shut box is drawn as it goes, nothing on it pressable
        const ghost = live ? null : motion.ghost();
        const note = live ?? ghost?.note ?? null;
        if (!note || !box) return null;
        const room = deps.room();
        const width = Math.min(WIDTH, Math.max(0, room.width - 2 * GAP));
        const look = motion.look();
        const place = miniPlace(
            live ? (open?.at ?? null) : (ghost?.at ?? null),
            { h: room.height, w: room.width },
            { h: height, w: width },
        );
        const isDim = !live || isClosed(note) || !note.text.trim();
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
                .when(Boolean(live), (el) => el.tooltip(hint))
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
                .absolute()
                .left(place.x)
                .top(place.y + look.lift)
                .opacity(look.opacity)
                .when(!isReduced, (el) => el.transition('opacity', MOTION))
                // only its lift moves: a new place while it stands, a line he typed, lands at once
                .when(!isReduced && motion.isMoving(), (el) =>
                    el.transition('top', MOTION),
                )
                .when(!live, (el) => el.h(ghost?.height ?? height))
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
                .when(Boolean(live), (el) =>
                    el
                        .key_context('XChatQuillMini')
                        .on_size_change((size, cx) => {
                            // herdr's sizes are window px, the box's place is not
                            const drawn =
                                size.height / (Number(settings().zoom) || 1);
                            if (Math.abs(drawn - height) < 1) return;
                            height = drawn;
                            cx.notify();
                        })
                        // a press on the box is the box's, never the list's under it; it keeps the keyboard in its field,
                        // or a click inside left it unfocused and a second gave it none (dima, 26 Nov 15:51, FRM-585:W74)
                        .on_mouse_down('left', (_e, cx) => {
                            cx.stop_propagation();
                            if (!isFocused && note && !isClosed(note))
                                box?.focus();
                        })
                        .on_mouse_down('right', (_e, cx) =>
                            cx.stop_propagation(),
                        )
                        // herdr follows a link under the box on a mouse-up
                        .on_mouse_up('left', (_e, cx) => {
                            cx.stop_propagation();
                            if (!isFocused && note && !isClosed(note))
                                box?.focus();
                        })
                        .on_mouse_up('right', (_e, cx) => cx.stop_propagation())
                        .on_mouse_down_out((_e, cx) => close(cx))
                        .on_action(ENTER, (_e, cx) => {
                            if (enter.pressed() === 'act') join(cx);
                        })
                        .on_action(CMD_ENTER, (_e, cx) => {
                            isCmdDown = true;
                            if (cmdEnter.pressed(Date.now()) === 'act')
                                sendNow(cx);
                        })
                        .on_action(ESCAPE, (_e, cx) => deps.pressEscape(cx))
                        .on_action(TAB, () => deps.tab.ask(MINI_STOP, false))
                        .on_action(BACK, () => deps.tab.ask(MINI_STOP, true))
                        .on_key_up((e) => {
                            if (e.key === 'enter') enter.released();
                        })
                        .on_modifiers_changed((e) => {
                            if (e.modifiers.platform) return;
                            isCmdDown = false;
                            enter.modifiersReleased();
                        }),
                )
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
                    !live ||
                        (isLocked(note) && !sending.has(note.id) && !isFocused)
                        ? div().child(note.text)
                        : Textarea.new(box),
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
                                .child(wordNow(note)),
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
        movedOn,
        noteChanged,
        openNote,
        /** shut with its thread, at once */
        reset() {
            motion.cut();
            return drop();
        },
        show,
        start,
        toggle,
        view,
    };
}
