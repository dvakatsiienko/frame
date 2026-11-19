// x-herdr-settings, «settings» (FRM-638 slice 7), drawn by this chat, shaped like shepherdr's: a card in the middle of herdr, a page
// list on the left, each row a title, one dim line and its control on the right. rows come from settings-model.js,
// values from the one settings file through settings-io.js; colours only from theme(), so it follows herdr's theme
import { Textarea, TextareaState, h_flex, v_flex } from 'gpui-base';
import { div } from 'gpui-kit';
import { closeOverlay, notify, theme, watchFolder } from 'herdr';

import { rebind } from './hotkeys.js';
import {
    keysView,
    metalHudNow,
    readKeys,
    readSettings,
    saveKeys,
    setMetalHud,
    settingsDir,
    windDefaults,
    writeSettings,
} from './settings-io.js';
import {
    orbitNoteDefaults,
    pages,
    rowWords,
    settingRows,
} from './settings-model.js';
import { forgetPage, keepPage, pageOnOpen } from './settings-page.js';
import {
    noteHint,
    noteShown,
    noteStored,
    noteWrite,
    settingChange,
    settledPending,
} from './settings-store.js';

// shepherdr's sizes: 13 body and titles, 12 second lines, 15 the nav's title; a group's heading 18 and a page title
// 22, well above a row's 13, on his word (20:27: «the headings mix up with the options»)
const TEXT = { body: 13, heading: 18, label: 12, page: 22, title: 15 };
const CARD_MAX_H = 760;

/** @typedef {import('./settings-model.js').Row} Row */
/** @typedef {import('./settings-model.js').Page} Page */
/** @typedef {ReturnType<typeof keysView>} KeysShown */

/**
 * the window's state and its presses; `render` draws it
 * @param {{ page: string, overlay: string }} at @param {any} cx
 */
export function createSettingsWindow(at, cx) {
    const s = {
        isNotesReady: false,
        keyCapture: cx.focus_handle(),
        keys: /** @type {KeysShown} */ (keysView({})),
        keysNote: '',
        noteBoxes: /** @type {Map<string, any>} */ (new Map()),
        noteDefaults: /** @type {Record<string, string>} */ ({}),
        notes: /** @type {Record<string, string>} */ ({}),
        page: pageOnOpen(localStorage, at.overlay, at.page),
        pending: /** @type {Record<string, unknown>} */ ({}),
        recording: /** @type {string | null} */ (null),
        values: /** @type {Record<string, unknown>} */ ({}),
    };
    // a box per note row, made here since a text state is never made while drawing
    for (const r of settingRows) {
        if (r.control.kind !== 'text') continue;
        const box = TextareaState.new({});
        box.set_auto_grow(3, 10);
        box.on('change', (/** @type {any} */ _e, /** @type {any} */ cx) =>
            cx.notify(),
        );
        s.noteBoxes.set(r.key, box);
    }
    cx.spawn(async (/** @type {any} */ cx) => {
        s.keys = keysView((await readKeys()).keys);
        cx.notify();
    });
    cx.spawn(async (/** @type {any} */ cx) => {
        const hud = await metalHudNow().catch(() => null);
        await writeSettings(
            hud == null ? {} : { 'chatter.metalHud': hud },
        ).catch((e) => console.log(`settings: ${e?.message ?? e}`));
        s.noteDefaults = { ...orbitNoteDefaults, ...(await windDefaults()) };
        s.values = await readSettings();
        for (const [key, box] of s.noteBoxes)
            box.set_value(noteShown(s.values[key], s.noteDefaults[key] ?? ''));
        s.isNotesReady = true;
        cx.notify();
        // a change made elsewhere (the old chat's window, a shell) shows here too
        for (;;) {
            await watchFolder(settingsDir());
            s.values = await readSettings();
            s.pending = settledPending(s.pending, s.values);
            cx.notify();
        }
    });

    const close = () => {
        forgetPage(localStorage, at.overlay);
        closeOverlay(at.overlay);
    };

    /** @param {string} key @param {unknown} value @param {any} cx */
    function change(key, value, cx) {
        s.pending = settledPending(s.pending, s.values);
        const judged = settingChange(s.values, s.pending, s.notes, key, value);
        s.notes = judged.notes;
        s.pending = judged.pending;
        cx.notify();
        const write = judged.write;
        if (!write) return;
        (key === 'chatter.metalHud'
            ? setMetalHud(value === true)
            : Promise.resolve()
        )
            .then(() => writeSettings(write))
            .catch((e) => {
                // a write that failed is no longer waiting: the row shows the stored value again
                const { [key]: _failed, ...rest } = s.pending;
                s.pending = rest;
                notify({
                    body: String(e?.message ?? e),
                    level: 'error',
                    title: 'the setting was not saved',
                });
                cx.notify();
            });
    }

    // a note box saves on its button, never per key
    /** @param {string} key @param {boolean} isReset @param {any} cx */
    function saveNote(key, isReset, cx) {
        const box = s.noteBoxes.get(key);
        if (!box) return;
        const next = noteWrite(
            String(box.value()),
            s.noteDefaults[key] ?? '',
            isReset,
            s.isNotesReady,
        );
        if (!next) return;
        if (next.box !== null) box.set_value(next.box);
        writeSettings({ [key]: next.row }).catch((e) =>
            notify({
                body: String(e?.message ?? e),
                level: 'error',
                title: 'the note was not saved',
            }),
        );
        cx.notify();
    }

    // the Keys page took a chord for the key being recorded: Esc gives up, a lone modifier waits for the rest
    /** @param {string} keystroke @param {any} cx */
    function recordKey(keystroke, cx) {
        const from = s.recording;
        if (!from) return;
        if (keystroke === 'escape') {
            s.recording = null;
            cx.notify();
            return;
        }
        if (
            /^(cmd|ctrl|alt|shift|fn|function|capslock|platform)(-(cmd|ctrl|alt|shift))*$/.test(
                keystroke,
            )
        )
            return;
        s.recording = null;
        cx.spawn(async (/** @type {any} */ cx) => {
            try {
                const { keys: his, text } = await readKeys();
                const r = rebind(his, from, keystroke);
                if ('refused' in r)
                    s.keysNote =
                        r.refused === 'typing'
                            ? `${keystroke} types into a terminal; pick a chord with ⌘ or ⌥`
                            : r.refused
                              ? `${keystroke} is taken by «${r.refused}»`
                              : `${from} is no longer bound`;
                else {
                    await saveKeys(text, r.keys);
                    s.keysNote = `${from} → ${keystroke}`;
                }
                s.keys = keysView((await readKeys()).keys);
            } catch (e) {
                s.keysNote = `not saved: ${/** @type {any} */ (e)?.message ?? e}`;
            }
            cx.notify();
        });
        cx.notify();
    }

    const view = {
        change,
        close,
        /** @param {string} id @param {any} cx */
        pickPage(id, cx) {
            s.page = id;
            keepPage(localStorage, at.overlay, id);
            s.recording = null;
            cx.notify();
        },
        recordKey,
        saveNote,
        /** @param {string} key @param {any} cx */
        startRecording(key, cx) {
            s.recording = key;
            s.keysNote = '';
            s.keyCapture.focus();
            cx.notify();
        },
    };
    return {
        render: () =>
            settingsWindow(theme(), {
                ...s,
                // an accepted change shows at once, before its write is read back
                values: { ...s.values, ...s.pending },
                ...view,
            }),
    };
}

/**
 * @typedef {{ page: string, values: Record<string, unknown>, notes: Record<string, string>,
 *   noteBoxes: Map<string, any>, noteDefaults: Record<string, string>, isNotesReady: boolean,
 *   keys: KeysShown, keysNote: string, keyCapture: any, recording: string | null,
 *   change: (key: string, value: unknown, cx: any) => void, close: () => void, pickPage: (id: string, cx: any) => void,
 *   recordKey: (keystroke: string, cx: any) => void, saveNote: (key: string, isReset: boolean, cx: any) => void,
 *   startRecording: (key: string, cx: any) => void }} WindowState
 */

/** @param {any} t @param {WindowState} w */
function settingsWindow(t, w) {
    const page =
        pages.find((p) => p.id === w.page) ?? /** @type {Page} */ (pages[0]);
    const card = h_flex()
        .id('chat-settings')
        .w_full()
        .h_full()
        .max_h(CARD_MAX_H)
        .min_h(0)
        .items_start()
        .rounded(12)
        .border_1()
        .border_color(t.border)
        .bg(t.popover)
        .shadow_lg()
        .overflow_hidden()
        // a click inside stays inside: only one beside the card closes it
        .on_click((/** @type {any} */ _e, /** @type {any} */ cx) =>
            cx.stop_propagation(),
        )
        .child(nav(t, w, page.id))
        .child(content(t, w, page));
    return div()
        .id('chat-settings-root')
        .size_full()
        .flex()
        .items_center()
        .justify_center()
        .on_click(() => w.close())
        .child(card);
}

/** @param {any} t @param {WindowState} w @param {string} at */
function nav(t, w, at) {
    return v_flex()
        .flex_none()
        .w(190)
        .h_full()
        .p(10)
        .gap(2)
        .border_r(1)
        .border_color(t.border)
        .child(
            div()
                .px(10)
                .pt(6)
                .pb(12)
                .text_size(TEXT.title)
                .font_semibold()
                .text_color(t.foreground)
                .child('settings'),
        )
        .children(
            pages.map((p) => {
                const isOn = p.id === at;
                return h_flex()
                    .id(`chat-settings-nav-${p.id}`)
                    .h(30)
                    .gap(10)
                    .px(10)
                    .flex_none()
                    .items_center()
                    .rounded(8)
                    .bg(isOn ? t.raised : '#00000000')
                    .when(!isOn, (/** @type {any} */ el) =>
                        el
                            .cursor_pointer()
                            .hover((/** @type {any} */ x) => x.bg(t.hover)),
                    )
                    .on_click((/** @type {any} */ _e, /** @type {any} */ cx) =>
                        w.pickPage(p.id, cx),
                    )
                    .child(
                        div()
                            .w(16)
                            .flex_none()
                            .text_size(TEXT.body)
                            .child(p.icon),
                    )
                    .child(
                        div()
                            .flex_1()
                            .text_size(TEXT.body)
                            .text_color(isOn ? t.foreground : t.muted)
                            .child(p.title),
                    );
            }),
        )
        .child(div().flex_1())
        .child(
            div()
                .px(10)
                .pb(4)
                .text_size(TEXT.label)
                .text_color(t.dim)
                .child('colours follow herdr’s theme'),
        );
}

/** @param {any} t @param {WindowState} w @param {Page} page */
function content(t, w, page) {
    const head = h_flex()
        .w_full()
        .items_start()
        .gap(12)
        .child(
            v_flex()
                .flex_1()
                .min_w(0)
                .gap(3)
                .child(
                    div()
                        .text_size(TEXT.page)
                        .font_semibold()
                        .text_color(t.foreground)
                        .child(page.title),
                )
                .child(
                    div()
                        .text_size(TEXT.label)
                        .text_color(t.dim)
                        .child(page.about),
                ),
        )
        .child(
            div()
                .id('chat-settings-close')
                .size(24)
                .flex_none()
                .flex()
                .items_center()
                .justify_center()
                .rounded(6)
                .text_color(t.dim)
                .cursor_pointer()
                .hover((/** @type {any} */ x) =>
                    x.bg(t.hover).text_color(t.foreground),
                )
                .tooltip('close · esc')
                .on_click(() => w.close())
                .child('✕'),
        );
    const body =
        page.id === 'keys'
            ? keysPage(t, w)
            : page.groups.flatMap((g) => [
                  heading(t, g.heading),
                  ...g.rows.map((r) => row(t, w, r)),
              ]);
    return div()
        .relative()
        .flex_1()
        .min_w(0)
        .h_full()
        .child(
            v_flex()
                .id('chat-settings-body')
                .size_full()
                .overflow_y_scroll()
                .px(28)
                .py(22)
                .child(head)
                .children(body),
        );
}

/** a small dim heading over a group of rows, sentence case @param {any} t @param {string} text */
const heading = (t, text) =>
    div()
        .pt(32)
        .pb(6)
        .text_size(TEXT.heading)
        .font_semibold()
        .text_color(t.foreground)
        .child(text);

/** one setting: its name and one line on the left, the control on the right; a note box under all of it
 * @param {any} t @param {WindowState} w @param {Row} r */
function row(t, w, r) {
    const words = rowWords(r, w.values);
    const note = w.notes[r.key];
    const isText = r.control.kind === 'text';
    return v_flex()
        .w_full()
        .gap(10)
        .py(12)
        .border_b(1)
        .border_color(t.border)
        .child(
            h_flex()
                .w_full()
                .gap(16)
                .items_center()
                .child(
                    v_flex()
                        .flex_1()
                        .min_w(0)
                        .gap(3)
                        .child(
                            div()
                                .text_size(TEXT.body)
                                .font_medium()
                                .text_color(t.foreground)
                                .child(words.title),
                        )
                        .child(
                            // a change that was not saved says why, in place of its line
                            div()
                                .text_size(TEXT.label)
                                .line_height('17px')
                                .text_color(note ? t.blocked : t.dim)
                                .child(note ?? words.why),
                        ),
                )
                .when(!isText, (/** @type {any} */ el) =>
                    el.child(
                        div()
                            .flex_none()
                            .child(control(t, w, r)),
                    ),
                ),
        )
        .when(isText, (/** @type {any} */ el) =>
            el.child(
                noteBox(
                    t,
                    w,
                    r,
                    r.control.kind === 'text' ? r.control.needs : [],
                ),
            ),
        );
}

/** @param {any} t @param {WindowState} w @param {Row} r */
function control(t, w, r) {
    const value = w.values[r.key] ?? r.default;
    const c = r.control;
    if (c.kind === 'toggle') {
        const isOn = value === true;
        // shepherdr's switch: the accent track with the knob at the right when on
        return div()
            .id(`chat-settings-${r.key}`)
            .w(36)
            .h(20)
            .flex_none()
            .rounded(10)
            .p(2)
            .flex()
            .bg(isOn ? t.accent : t.hover)
            .when(isOn, (/** @type {any} */ el) => el.justify_end())
            .cursor_pointer()
            .tooltip(isOn ? 'on · press to turn off' : 'off · press to turn on')
            .on_click((/** @type {any} */ _e, /** @type {any} */ cx) => {
                cx.stop_propagation();
                w.change(r.key, !isOn, cx);
            })
            .child(
                div()
                    .w(16)
                    .h(16)
                    .rounded(8)
                    .bg(isOn ? t.accent_foreground : t.muted),
            );
    }
    if (c.kind === 'choice')
        // shepherdr's segmented control: each option as wide as its words, the picked one lifted
        return h_flex()
            .h(24)
            .flex_none()
            .p(2)
            .gap(2)
            .rounded(6)
            .bg(t.raised)
            .children(
                c.options.map((o) => {
                    const isOn = o.value === value;
                    return h_flex()
                        .id(`chat-settings-${r.key}-${o.label}`)
                        .h_full()
                        .px(8)
                        .flex_none()
                        .items_center()
                        .justify_center()
                        .rounded(4)
                        .whitespace_nowrap()
                        .text_size(TEXT.label)
                        .when(isOn, (/** @type {any} */ el) =>
                            el
                                .bg(t.background)
                                .text_color(t.foreground)
                                .font_medium(),
                        )
                        .when(!isOn, (/** @type {any} */ el) =>
                            el
                                .text_color(t.muted)
                                .cursor_pointer()
                                .hover((/** @type {any} */ x) =>
                                    x.text_color(t.foreground),
                                )
                                .on_click(
                                    (
                                        /** @type {any} */ _e,
                                        /** @type {any} */ cx,
                                    ) => {
                                        cx.stop_propagation();
                                        w.change(r.key, o.value, cx);
                                    },
                                ),
                        )
                        .child(o.label);
                }),
            );
    if (c.kind !== 'stepper') return div();
    const n = Number(value);
    /** @param {number} d @param {string} id @param {string} label */
    const step = (d, id, label) => {
        const next = n + d * c.step;
        const isOff = next < c.min || next > c.max;
        return div()
            .id(id)
            .w(24)
            .h_full()
            .flex()
            .items_center()
            .justify_center()
            .rounded(4)
            .text_size(TEXT.body)
            .text_color(isOff ? t.dim : t.muted)
            .when(!isOff, (/** @type {any} */ el) =>
                el
                    .cursor_pointer()
                    .hover((/** @type {any} */ x) =>
                        x.bg(t.background).text_color(t.foreground),
                    )
                    .on_click(
                        (/** @type {any} */ _e, /** @type {any} */ cx) => {
                            cx.stop_propagation();
                            w.change(r.key, next, cx);
                        },
                    ),
            )
            .child(label);
    };
    // drawn like shepherdr's segmented control: a raised track, the value in the middle
    return h_flex()
        .h(24)
        .flex_none()
        .p(2)
        .gap(2)
        .items_center()
        .rounded(6)
        .bg(t.raised)
        .tooltip(`${c.min}–${c.max} ${c.unit}, default ${r.default} ${c.unit}`)
        .child(step(-1, `chat-settings-${r.key}-down`, '−'))
        .child(
            div()
                .w(56)
                .flex()
                .justify_center()
                .text_size(TEXT.label)
                .font_medium()
                .text_color(t.foreground)
                .child(`${n} ${c.unit}`),
        )
        .child(step(1, `chat-settings-${r.key}-up`, '+'));
}

// one note in full, editable: Save writes its row, Reset brings the default back; a note that lost a word a thread
// needs to compact gets a red line under the box and still saves (a warning, never a block)
/** @param {any} t @param {WindowState} w @param {Row} r @param {string[]} needs */
function noteBox(t, w, r, needs) {
    const box = w.noteBoxes.get(r.key);
    if (!box || !w.isNotesReady)
        return div()
            .text_size(TEXT.label)
            .text_color(t.dim)
            .child('reading the note…');
    const fallback = w.noteDefaults[r.key] ?? '';
    const text = String(box.value());
    const stored = typeof w.values[r.key] === 'string' ? w.values[r.key] : '';
    const isSaved = noteStored(text, fallback) === stored;
    const isDefault = noteStored(text, fallback) === '';
    const hint = noteHint(text, needs);
    /** @param {string} id @param {string} label @param {boolean} isLive @param {boolean} isReset @param {boolean} isPrimary */
    const act = (id, label, isLive, isReset, isPrimary) =>
        h_flex()
            .id(`chat-settings-${r.key}-${id}`)
            .h(24)
            .px(8)
            .flex_none()
            .items_center()
            .rounded(6)
            .text_size(TEXT.label)
            .font_medium()
            .when(isPrimary, (/** @type {any} */ el) =>
                el.bg(t.solid).text_color(t.solid_foreground),
            )
            .when(!isPrimary, (/** @type {any} */ el) =>
                el
                    .border_1()
                    .border_color(t.input)
                    .bg(t.background)
                    .text_color(t.foreground),
            )
            .when(!isLive, (/** @type {any} */ el) => el.opacity(0.5))
            .when(isLive, (/** @type {any} */ el) =>
                el
                    .cursor_pointer()
                    .hover((/** @type {any} */ x) =>
                        isPrimary ? x.opacity(0.88) : x.bg(t.hover),
                    )
                    .on_click(
                        (/** @type {any} */ _e, /** @type {any} */ cx) => {
                            cx.stop_propagation();
                            w.saveNote(r.key, isReset, cx);
                        },
                    ),
            )
            .child(label);
    return v_flex()
        .gap(8)
        .child(
            div()
                .rounded(6)
                .border_1()
                .border_color(hint ? t.blocked : t.input)
                .bg(t.background)
                .p(10)
                .text_size(TEXT.body)
                .child(Textarea.new(box)),
        )
        .when(Boolean(hint), (/** @type {any} */ el) =>
            el.child(
                div()
                    .text_size(TEXT.label)
                    .text_color(t.blocked)
                    .child(hint ?? ''),
            ),
        )
        .child(
            h_flex()
                .items_center()
                .gap(8)
                .child(act('save', 'save', !isSaved, false, true))
                .child(
                    act('reset', 'reset to default', !isDefault, true, false),
                )
                .child(
                    div()
                        .text_size(TEXT.label)
                        .text_color(t.dim)
                        .child(
                            !isSaved
                                ? 'not saved yet'
                                : isDefault
                                  ? 'the default'
                                  : 'your text',
                        ),
                ),
        );
}

// a key as macOS prints it: cmd-shift-k → ⌘⇧K
/** @param {string} key */
const keyLabel = (key) =>
    key
        .split('-')
        .map(
            (p) =>
                /** @type {Record<string, string>} */ ({
                    alt: '⌥',
                    cmd: '⌘',
                    ctrl: '⌃',
                    shift: '⇧',
                })[p] ?? (p.length === 1 ? p.toUpperCase() : p),
        )
        .join('');

/** @param {any} t @param {string} text @param {boolean} isRecording */
const keyCap = (t, text, isRecording) =>
    div()
        .flex_none()
        .min_w(44)
        .px(6)
        .h(22)
        .flex()
        .items_center()
        .justify_center()
        .rounded(5)
        .border_1()
        .border_color(isRecording ? t.accent : t.border)
        .bg(isRecording ? t.raised : t.background)
        .text_size(TEXT.label)
        .text_color(t.foreground)
        .child(text);

/** @param {any} t @param {WindowState} w */
function keysPage(t, w) {
    // a key's cap is its button: a press records the next chord for it, Esc gives up
    /** @param {string} key @param {string} what */
    const cap = (key, what) => {
        const isRecording = w.recording === key;
        return div()
            .id(`chat-settings-key-${key}`)
            .flex_none()
            .cursor_pointer()
            .rounded(6)
            .hover((/** @type {any} */ x) => x.opacity(0.8))
            .tooltip(
                isRecording
                    ? 'press the new keys · esc to cancel'
                    : `change the key for ${what}`,
            )
            .on_click((/** @type {any} */ _e, /** @type {any} */ cx) => {
                cx.stop_propagation();
                w.startRecording(key, cx);
            })
            .child(
                keyCap(
                    t,
                    isRecording ? 'press keys…' : keyLabel(key),
                    isRecording,
                ),
            );
    };
    /** @param {any} capEl @param {string} title @param {string | null} line */
    const keyRow = (capEl, title, line) =>
        h_flex()
            .w_full()
            .gap(16)
            .py(10)
            .items_center()
            .border_b(1)
            .border_color(t.border)
            .child(
                v_flex()
                    .flex_1()
                    .min_w(0)
                    .gap(3)
                    .child(
                        div()
                            .text_size(TEXT.body)
                            .text_color(t.foreground)
                            .child(title),
                    )
                    .when(Boolean(line), (/** @type {any} */ el) =>
                        el.child(
                            div()
                                .text_size(TEXT.label)
                                .text_color(t.blocked)
                                .child(line ?? ''),
                        ),
                    ),
            )
            .child(capEl);
    return [
        v_flex()
            .id('chat-settings-keys')
            .track_focus(w.keyCapture)
            .on_key_down((/** @type {any} */ e, /** @type {any} */ cx) => {
                if (!w.recording) return;
                w.recordKey(e.keystroke, cx);
                cx.stop_propagation();
            })
            .when(Boolean(w.keysNote), (/** @type {any} */ el) =>
                el.child(
                    div()
                        .pt(16)
                        .text_size(TEXT.label)
                        .text_color(t.muted)
                        .child(w.keysNote),
                ),
            )
            .child(heading(t, 'ours'))
            .children(
                w.keys.ours.map((k) =>
                    keyRow(
                        cap(k.key, k.title),
                        k.title,
                        k.takenBy
                            ? `refused: herdr’s «${k.takenBy}» holds this key`
                            : null,
                    ),
                ),
            )
            .child(heading(t, 'herdr’s own'))
            .children(
                w.keys.herdr.map(([key, action]) =>
                    keyRow(cap(key, action), action, null),
                ),
            ),
    ];
}
