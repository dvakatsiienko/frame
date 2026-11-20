// the quill: his text box, each thread's draft in it, the files waiting over it, the + picker, the send button with
// its hold disc, and the / menu over it. what a send does is the send path's (send-path.js); the draft's one owner is
// quill.js

import { Textarea, TextareaState, h_flex, v_flex } from 'gpui-base';
import { div, image } from 'gpui-kit';
import { appHome, setShared, shared } from 'herdr';

import { fileName, isImagePath, pickFiles } from './attach.js';
import { createAttachments } from './attachments.js';
import { focusBorder } from './focus-ring.js';
import { ICONS } from './icons.js';
import { enterHoldStep } from './joins.js';
import { createKeyPress } from './keypress.js';
import { pastedText } from './lists.js';
import { createQuills } from './quill.js';
import { submitted } from './send.js';
import {
    deletePreviewCopies,
    loadShots,
    readClipboard,
    saveFileShot,
    saveShots,
} from './shots.js';
import { createSlashMenu, listedSkills, menuNames } from './slash.js';
import { TAB_GO, loopOf, nextStop, tabAsk } from './tab-loop.js';

/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./chat-types.js').Theme} Theme */

export const QUILL_ENTER = 'x_herdr_chat_quill_enter';
// Tab and shift-Tab in the quill go to orbit's first and last steer box, never herdr's hidden stops (FRM-620 slice 5c)
const QUILL_TAB = 'x_herdr_chat_quill_tab';
const QUILL_BACK = 'x_herdr_chat_quill_back';
const SEND_SIZE = 28;
// a picture waiting over the quill, and how long a paste's «nothing there» note stays
const THUMB_SIZE = 56;
const PASTE_NOTE_MS = 6000;
const NO_IMAGE = 'No image on the clipboard';

// each save waits for the one before it, so an older store never lands last
let shotsSaved = Promise.resolve();
/** @type {import('./attachments.js').AttachmentsIo} */
const ATTACH_IO = {
    deleteCopies: (rels) => {
        deletePreviewCopies(rels).catch(() => {});
    },
    makePreview: saveFileShot,
    now: Date.now,
    save: (store) => {
        shotsSaved = shotsSaved.then(() => saveShots(store)).catch(() => {});
    },
};

/**
 * @param {{
 *   shownFile: () => string | null,
 *   column: () => number,
 *   pickersView: (t: Theme) => any,
 *   sendPath: () => ReturnType<typeof import('./send-path.js').createSendPath>,
 *   showPictures: (files: string[], at: number, cx: Context) => void,
 *   say: (note: string | null, cx: Context) => void,
 *   flash: (note: string, ms: number, cx: Context) => void,
 *   messages: () => string[],
 * }} deps the shown thread's transcript, the chat's column width, the pickers drawn in the quill, the send path, the
 *   picture viewer, the note under the quill (said, or shown for a while), and the thread's messages as written, where a
 *   paste finds its list markers
 */
export function createQuill({
    shownFile,
    column,
    pickersView,
    sendPath,
    showPictures,
    say,
    flash,
    messages,
}) {
    /** the box: herdr draws its text itself, so a key typed in it draws nothing of ours; made at start @type {import('gpui-base').TextareaState | null} */
    let box = null;
    // the quill's focus, for its ring (FRM-620 slice 5c)
    let isQuillFocused = false;
    /** the quill's text, and its text one change earlier: Enter types its line break before it submits */
    let typedNow = '';
    let typedBefore = '';
    /** Enter in the quill, one press at a time: a held key's repeats act once */
    const quillKeys = createKeyPress();
    /** the / menu over the quill (slice 6) */
    const slashMenu = createSlashMenu();
    /** the thread's skills, from its transcript's listing @type {Map<string, string>} */
    let skills = new Map();
    /** the skills of the plugins its folder enables @type {Map<string, string>} */
    let pluginSkills = new Map();
    /** every thread's quill and its mark, the one owner of what the box shows */
    const quills = createQuills(localStorage, (text) => {
        // a write of ours (a send, a taken mark, a fill) is an edit the / menu reads too: a sent «/co» closes it
        slashMenu.typed(typedNow ?? '', text);
        typedNow = text;
        typedBefore = text;
    });
    /** the files waiting over each thread's quill, by its transcript file; what waited comes back once the store is read */
    const attachments = createAttachments(appHome(), ATTACH_IO, {});

    /** the box, its keys and its paste, made in the view's init where herdr allows them @param {Context} cx */
    function start(cx) {
        const made = TextareaState.new({});
        made.set_auto_grow(1, 8);
        made.on('change', (_event, cx) => {
            const was = typedNow;
            const typed = made.value();
            // a paste reads plain, its list lines with their markers back, written through the quill's owner; that
            // write tells no change, so this one goes on with the fixed text
            const now = pastedText(
                was,
                typed,
                cx.read_from_clipboard(),
                messages,
            );
            if (now !== typed)
                quills.apply(shownFile(), { text: now, type: 'typed' });
            // a change told twice is one change
            if (now !== was) {
                typedBefore = was;
                typedNow = now;
            }
            quills.apply(shownFile(), { text: now, type: 'typed' });
            sendPath().typedUnderMark(made, cx);
            slashMenu.typed(typedBefore ?? '', now);
            cx.notify();
        });
        made.on('submit', (event, cx) => {
            const file = shownFile();
            const { act, caret, text } = submitted(
                made.value(),
                [typedNow, typedBefore],
                event,
                Boolean(file && sendPath().waitingPaths(file).length),
            );
            if (text === null) return;
            // Enter's line break leaves, his caret stays; the words stay until they are sent or a turn takes them
            quills.apply(file, { text, type: 'typed' });
            made.set_selected_range({ end: caret, start: caret });
            // ⌘Enter reaches here, Enter is the quill's own action (QUILL_ENTER); a held key's repeats act once
            if (quillKeys.pressed() === 'repeat') return;
            if (act === 'push') sendPath().push(made, cx);
            else if (act === 'click') sendPath().click(made, cx);
        });
        // a paste with no text: the clipboard's image saved as a png, or files copied in Finder by their paths (FRM-613)
        made.on('paste_other', (_event, cx) => pasteFiles(cx));
        // one owner from the start: what loads joins what he added meanwhile
        cx.spawn(async (cx) => {
            const restored = attachments.restore(await loadShots());
            cx.notify();
            if (await restored) cx.notify();
        });
        made.on('focus', (_event, cx) => {
            isQuillFocused = true;
            cx.notify();
        });
        made.on('blur', (_event, cx) => {
            isQuillFocused = false;
            cx.notify();
            quillKeys.blurred();
            const event = enterHoldStep(sendPath().hold(), 'blur');
            if (event) sendPath().holdStep(made, event, cx);
        });
        box = made;
        // Enter in the quill is ours before the text box's own (context `Input`): no line break typed, so no scroll to
        // the caret (dima, 13:14). a binding herdr never reaches leaves Enter to the box's submit, as before
        cx.bind_keys([
            {
                action: QUILL_ENTER,
                context: 'XChatQuill > Input',
                keystroke: 'enter',
            },
            {
                action: QUILL_TAB,
                context: 'XChatQuill > Input',
                keystroke: 'tab',
            },
            {
                action: QUILL_BACK,
                context: 'XChatQuill > Input',
                keystroke: 'shift-tab',
            },
        ]);
        // the / menu's keys, only while it shows (its wrapper carries `ChatSlash` then)
        cx.bind_keys(
            [
                ['down', 'x_herdr_chat_slash_down'],
                ['up', 'x_herdr_chat_slash_up'],
                ['tab', 'x_herdr_chat_slash_fill'],
                ['enter', 'x_herdr_chat_slash_fill'],
                ['escape', 'x_herdr_chat_slash_close'],
            ].map(([keystroke, action]) => ({
                action: String(action),
                context: 'ChatSlash > Input',
                keystroke: String(keystroke),
            })),
        );
    }

    /** Tab and shift-Tab in the quill ask the Tab loop for the next stop @param {boolean} isBack */
    function tabFromQuill(isBack) {
        const to = nextStop(loopOf(shared), 'quill', isBack);
        setShared(TAB_GO, tabAsk(shared, to));
    }

    /**
     * his text box, in the list's column
     * @param {import('gpui-base').TextareaState} box
     * @param {Theme} t
     */
    function quill(box, t) {
        return (
            h_flex()
                .id('chat-quill-row')
                .w_full()
                .flex_none()
                .justify_center()
                .px(18)
                // opened as a window, a press herdr is not told to keep drags it: only the head row moves it
                .on_mouse_down('left', (_event, cx) => cx.stop_propagation())
                .child(
                    div()
                        .w_full()
                        .max_w(column())
                        .relative()
                        .px(14)
                        .pt(12)
                        // the send button sits in the card's bottom right corner, the text keeps clear of it
                        .pb(SEND_SIZE + 12)
                        .rounded(12)
                        .bg(t.background)
                        .border(1)
                        .border_color(focusBorder(isQuillFocused, t, t.border))
                        .key_context('XChatQuill')
                        .on_drop((e, cx) => addFiles(e?.paths ?? [], cx))
                        // Enter runs the send button's hold (FRM-628 W12): a tap joins on its release, a hold fills
                        // the disc and pushes; its repeats keep the one hold going
                        .on_action(QUILL_TAB, () => tabFromQuill(false))
                        .on_action(QUILL_BACK, () => tabFromQuill(true))
                        .on_action(QUILL_ENTER, (_event, cx) => {
                            if (quillKeys.pressed() === 'act')
                                sendPath().press(box, cx, 'enter');
                        })
                        // the box never tells Enter's key-down (FRM-628 round 2 trace): its key-up ends a press
                        .on_key_up((e, cx) => {
                            if (e.key !== 'enter') return;
                            quillKeys.released();
                            const event = enterHoldStep(
                                sendPath().hold(),
                                'keyUp',
                            );
                            if (event) sendPath().holdStep(box, event, cx);
                        })
                        .on_modifiers_changed((e) => {
                            if (!e.modifiers.platform)
                                quillKeys.modifiersReleased();
                        })
                        .child(slashList(t))
                        .child(attachmentsRow(t))
                        // while the / menu shows, its keys come before the box's own
                        .child(
                            div()
                                .w_full()
                                .when(slashShown().list.length > 0, (el) =>
                                    el.key_context('ChatSlash'),
                                )
                                .on_action(
                                    'x_herdr_chat_slash_down',
                                    (_e, cx) => slashKey('down', cx),
                                )
                                .on_action('x_herdr_chat_slash_up', (_e, cx) =>
                                    slashKey('up', cx),
                                )
                                .on_action(
                                    'x_herdr_chat_slash_fill',
                                    (_e, cx) => slashKey('fill', cx),
                                )
                                .on_action(
                                    'x_herdr_chat_slash_close',
                                    (_e, cx) => slashKey('close', cx),
                                )
                                .child(Textarea.new(box)),
                        )
                        .child(
                            div()
                                .absolute()
                                .left(8)
                                .bottom(10)
                                .child(attachButton(t)),
                        )
                        .child(
                            // the picker sits left of send, as shepherdr's does
                            div()
                                .absolute()
                                .right(8 + SEND_SIZE + 6)
                                .bottom(10)
                                .child(pickersView(t)),
                        )
                        .child(sendButton(box, t)),
                )
        );
    }

    /** @param {Context} cx */
    function pasteFiles(cx) {
        const file = shownFile();
        if (!file) return;
        cx.spawn(async (cx) => {
            const read = await readClipboard();
            if (shownFile() !== file) return;
            if (read && 'paths' in read) return addFiles(read.paths, cx);
            if (read) {
                attachments.paste(file, read.rel);
                sendPath().filesUnderMark(file, cx);
            }
            if (read) say(null, cx);
            else flash(NO_IMAGE, PASTE_NOTE_MS, cx);
        });
    }

    /** dropped or picked files join the thread's attachments; a picture's preview draws once it is made @param {string[]} paths @param {Context} cx */
    function addFiles(paths, cx, file = shownFile()) {
        if (!file || !paths.length || file !== shownFile()) return;
        cx.spawn(async (cx) => {
            const adding = attachments.add(file, paths);
            sendPath().filesUnderMark(file, cx);
            cx.notify();
            await adding;
            cx.notify();
        });
    }

    /** + in the quill's bottom left: the mac's own picker, several files at once @param {Theme} t */
    function attachButton(t) {
        return div()
            .id('chat-attach')
            .size(24)
            .flex()
            .items_center()
            .justify_center()
            .rounded_full()
            .text_size(16)
            .text_color(t.muted)
            .cursor_pointer()
            .hover((s) => s.bg(t.raised).text_color(t.foreground))
            .tooltip('Attach files')
            .on_click((_e, cx) => {
                const file = shownFile();
                cx.spawn(async (cx) => addFiles(await pickFiles(), cx, file));
            })
            .child('+');
    }

    /**
     * what waits over the quill: a 56 px preview per picture, a «📎 name» chip per other file, each with its ×
     * (FRM-609: no caption, no Remove, each × takes its own)
     * @param {Theme} t
     */
    function attachmentsRow(t) {
        const file = shownFile();
        const waiting = file ? attachments.of(file) : [];
        /** @param {string} id @param {string} path */
        const remove = (id, path) =>
            div()
                .id(id)
                .absolute()
                .top(3)
                .right(3)
                .size(18)
                .flex()
                .items_center()
                .justify_center()
                .rounded_full()
                .bg(t.background)
                .text_size(11)
                .text_color(t.foreground)
                .cursor_pointer()
                .tooltip('Remove')
                .on_click((_e, cx) => {
                    cx.stop_propagation();
                    if (file) {
                        attachments.remove(file, path);
                        sendPath().filesUnderMark(file, cx);
                    }
                    cx.notify();
                })
                .child('×');
        return h_flex()
            .gap(8)
            .flex_wrap()
            .items_center()
            .when(waiting.length > 0, (el) => el.pb(8))
            .children(
                waiting.map(({ path, preview }, i) =>
                    isImagePath(path)
                        ? div()
                              .id(`chat-thumb-${i}`)
                              .size(THUMB_SIZE)
                              .flex_none()
                              .relative()
                              .rounded(8)
                              .overflow_hidden()
                              .bg(t.raised)
                              .border(1)
                              .border_color(t.border)
                              .cursor_pointer()
                              .tooltip('Open')
                              .on_click((_e, cx) => {
                                  const pictures = waiting
                                      .map((w) => w.path)
                                      .filter(isImagePath);
                                  showPictures(
                                      pictures,
                                      pictures.indexOf(path),
                                      cx,
                                  );
                              })
                              .when(Boolean(preview), (el) =>
                                  el.child(image(preview ?? '').size_full()),
                              )
                              .child(remove(`chat-thumb-x-${i}`, path))
                        : h_flex()
                              .id(`chat-file-${i}`)
                              .relative()
                              .gap(6)
                              .items_center()
                              .pl(8)
                              .pr(26)
                              .py(4)
                              .rounded(8)
                              .border(1)
                              .border_color(t.border)
                              .text_size(12)
                              .text_color(t.muted)
                              .tooltip(path)
                              .child(`📎 ${fileName(path)}`)
                              .child(remove(`chat-file-x-${i}`, path)),
                ),
            );
    }

    /**
     * a click marks the quill's words to join the thread's turn, a hold sends them now
     * @param {import('gpui-base').TextareaState} box
     * @param {Theme} t
     */
    function sendButton(box, t) {
        const mark = sendPath().magic.markOf(shownFile());
        const icon = !mark
            ? ICONS.sendRest
            : mark.state === 'joined'
              ? ICONS.sendTaken
              : ICONS.sendReady;
        return div()
            .id('chat-send')
            .absolute()
            .right(8)
            .bottom(8)
            .size(SEND_SIZE)
            .rounded(SEND_SIZE / 2)
            .flex()
            .items_center()
            .justify_center()
            .overflow_hidden()
            .bg(t.raised)
            .text_size(13)
            .cursor_pointer()
            .hover((style) => style.bg(t.border))
            .tooltip(
                mark?.state === 'pending'
                    ? 'Take it back (Enter), hold to send now'
                    : 'Join the turn (Enter), hold to send now (⌘Enter)',
            )
            .on_mouse_down('left', (_event, cx) => sendPath().press(box, cx))
            .on_mouse_up('left', (_event, cx) =>
                sendPath().holdStep(box, 'release', cx),
            )
            .on_hover((isOver, cx) => {
                if (!isOver) sendPath().holdStep(box, 'cancel', cx);
            })
            .when(sendPath().holdFill() > 0, (el) =>
                // a disc grows from the centre while the hold runs
                el.child(
                    div()
                        .absolute()
                        .left((SEND_SIZE / 2) * (1 - sendPath().holdFill()))
                        .top((SEND_SIZE / 2) * (1 - sendPath().holdFill()))
                        .size(SEND_SIZE * sendPath().holdFill())
                        .rounded(SEND_SIZE / 2)
                        .bg(t.accent),
                ),
            )
            .child(div().relative().child(icon));
    }

    /** the thread's skill listing, wherever its line is read: the tail or an earlier page @param {string[]} lines */
    function learnSkills(lines) {
        for (const line of lines)
            if (line.includes('"skill_listing"'))
                try {
                    const content = JSON.parse(line)?.attachment?.content;
                    for (const [name, about] of listedSkills(content))
                        skills.set(name, about);
                } catch {
                    // half a line never reaches here: the reader hands over whole lines
                }
    }
    /** what the / menu shows now: the caret is read off the box, so a caret moved off the word closes it */
    function slashShown() {
        if (box) slashMenu.at(box.value(), box.selected_range().end);
        return slashMenu.shown(menuNames(skills, pluginSkills));
    }

    /** a / menu key: ↑ ↓ move, Tab or Enter fills the pick, Esc closes @param {'up' | 'down' | 'fill' | 'close'} key @param {Context} cx */
    function slashKey(key, cx) {
        const { at, list } = slashShown();
        if (key !== 'fill') slashMenu.step(key, list.length);
        else slashFill(list[at]?.[0], cx);
        cx.notify();
    }

    /** @param {string | undefined} name @param {Context} cx */
    function slashFill(name, cx) {
        const filled = name ? slashMenu.fill(name) : null;
        if (!filled || !box) return;
        // the quill writes the box, then the caret goes past the name; words under a 🍕 mark ride its row too
        quills.apply(shownFile(), { text: filled.text, type: 'typed' });
        box.set_selected_range({ end: filled.caret, start: filled.caret });
        sendPath().typedUnderMark(box, cx);
        box.focus();
        cx.notify();
    }

    /** the / menu over the quill: a name and what it does per match, the pick marked (slice 6) @param {Theme} t */
    function slashList(t) {
        const { at, list } = slashShown();
        return v_flex()
            .when(list.length > 0, (el) => el.pb(8))
            .children(
                list.map(([name, about], i) =>
                    h_flex()
                        .id(`chat-slash-${name}`)
                        .gap(10)
                        .px(8)
                        .py(4)
                        .rounded(6)
                        .items_center()
                        .cursor_pointer()
                        .when(i === at, (el) => el.bg(t.raised))
                        .hover((style) => style.bg(t.border))
                        .on_click((_e, cx) => slashFill(name, cx))
                        .child(
                            div()
                                .w(180)
                                .flex_none()
                                .truncate()
                                .text_color(t.foreground)
                                .child(`/${name}`),
                        )
                        .child(
                            div()
                                .flex_1()
                                .min_w(0)
                                .truncate()
                                .text_size(12)
                                .text_color(t.dim)
                                .child(about),
                        ),
                ),
            );
    }

    /** the quill holds the shown thread's draft, the caret after it; no thread, an empty quill */
    function showDraft() {
        if (!box) return;
        const text = quills.show(shownFile(), box);
        box.set_selected_range({ end: text.length, start: text.length });
    }

    return {
        addFiles,
        attachments,
        box: () => box,
        /** a new thread is shown: its / menu and skills start empty */
        clearThread() {
            slashMenu.clear();
            skills = new Map();
            pluginSkills = new Map();
        },
        focus: () => box?.focus(),
        learnSkills,
        quills,
        /** the skills of the plugins the shown thread's folder enables @param {Map<string, string>} found */
        setPluginSkills(found) {
            pluginSkills = found;
        },
        showDraft,
        start,
        /** @param {Theme} t */
        view: (t) => (box ? quill(box, t) : null),
    };
}
