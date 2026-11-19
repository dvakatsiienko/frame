// the pickers under the quill: the model and effort the shown thread runs at, a pick sent through Claude's own /model
// and /effort pickers, the effort slider, the permission mode and the model switch's yes. the rules live in picker.js
// and effort.js

import { Popover, h_flex, v_flex } from 'gpui-base';
import { div, svg } from 'gpui-kit';
import { agents, hc } from 'herdr';

import {
    EFFORTS,
    effortKey,
    effortWord,
    isPickWaiting,
    pickerLabel,
    slideEffort,
} from './effort.js';
import {
    MODELS,
    NO_RUNS_AT,
    PERMISSIONS,
    effortNow,
    modelNow,
    permissionIn,
    permissionOf,
    pickIn,
    runsAtAfter,
} from './picker.js';

/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./chat-types.js').Theme} Theme */

// the picker's label flashes this long once a reply first ran at his pick
const APPLIED_FLASH_MS = 2000;
// a pick that shows no change by then says so
const PICK_WAIT_MS = 12000;

/**
 * @param {{
 *   shownAddress: () => string | null,
 *   status: () => string | undefined,
 *   claudeSettings: () => import('./picker.js').ClaudeSettings,
 *   quillBox: () => { focus: () => void } | null,
 *   hasRows: () => boolean,
 *   column: () => number,
 *   typingInto: Set<string>,
 * }} deps the shown thread and its status, Claude's settings.json, the quill's box, whether the thread has rows, the
 *   chat's column width, and the threads a send or a pick types into now (one owner: the chat)
 */
export function createPickers({
    shownAddress,
    status,
    claudeSettings,
    quillBox,
    hasRows,
    column,
    typingInto,
}) {
    /** the model and effort the shown thread runs at, as its transcript tells them */
    let runsAt = NO_RUNS_AT;
    /** a pick on its way to the shown thread @type {{ kind: 'model' | 'effort', value: string, until: number } | null} */
    let pending = null;
    /** why a pick did not go, or did not land @type {string | null} */
    let pickNote = null;
    let isPickOpen = false;
    /** the effort slider while the picker is open @type {import('./effort.js').EffortPopover | null} */
    let effortPop = null;
    /** a model switch waiting on his yes: it drops the thread's cache @type {string | null} */
    let askModel = null;
    /** the thread's permission mode, read off its screen when the picker opens @type {string | null} */
    let permission = null;
    /** a permission change on its way @type {string | null} */
    let permissionAsked = null;
    let isPermsOpen = false;
    /** the open picker holds the keyboard, so ← → reach the slider; made in the view's init @type {import('gpui-kit').FocusHandle | null} */
    let pickKeys = null;

    /** the model and effort the shown thread runs at, a pick on its way shown in their place */
    function pickNow() {
        const model = modelNow(runsAt, claudeSettings());
        const effort = effortNow(runsAt, claudeSettings());
        return {
            effort,
            isApplied:
                runsAt.appliedAt !== null &&
                Date.now() - runsAt.appliedAt < APPLIED_FLASH_MS,
            model,
            pending,
            shownEffort: pending?.kind === 'effort' ? pending.value : effort,
            shownModel: pending?.kind === 'model' ? pending.value : model,
        };
    }

    /**
     * a pick made in Claude's own /model or /effort picker; the label says «…» until the transcript shows it, or says
     * after 12 s that it did not. never while Claude asks him something: the keys would answer it
     * @param {'model' | 'effort'} kind @param {string} value @param {Context} cx
     */
    function pick(kind, value, cx) {
        const address = shownAddress();
        if (!address) return;
        if (status() === 'blocked' || pending || typingInto.has(address)) {
            pickNote =
                pending || typingInto.has(address)
                    ? 'One switch at a time: wait for this one to land'
                    : 'Answer Claude first, then pick';
            cx.notify();
            return;
        }
        closePick();
        pending = { kind, until: Date.now() + PICK_WAIT_MS, value };
        pickNote = null;
        typingInto.add(address);
        cx.notify();
        cx.spawn(async (cx) => {
            try {
                const isTaken = await pickIn(kind, value, {
                    editorMode: claudeSettings()?.editorMode,
                    keys: async (keys) => {
                        if (keys.length) await hc(['keys', address, ...keys]);
                    },
                    screen: async () =>
                        (await hc(['read', address])).stdout.replace(/\r/g, ''),
                    sleep: (ms) => cx.sleep(ms),
                    status: () =>
                        agents().find((agent) => agent.address === address)
                            ?.status,
                });
                // mid-turn the pick writes nothing to the transcript: the label takes it once the picker closed
                if (isTaken && shownAddress() === address)
                    runsAt =
                        kind === 'model'
                            ? { ...runsAt, model: value }
                            : {
                                  ...runsAt,
                                  effort: {
                                      isPicked: true,
                                      level: value,
                                      model: modelNow(runsAt, claudeSettings()),
                                  },
                              };
            } catch (error) {
                if (shownAddress() === address) {
                    pending = null;
                    pickNote =
                        error instanceof Error ? error.message : String(error);
                }
            } finally {
                typingInto.delete(address);
            }
            cx.notify();
        });
    }

    /**
     * whether the pick in flight landed or timed out: a picked effort stays «…» until a reply runs at it, mid-turn
     * too; a turn that ended first holds it for the next turn
     * @returns {boolean} whether anything changed
     */
    function settlePick() {
        const p = pending;
        if (!p) return false;
        const { effort, model } = pickNow();
        const now = p.kind === 'model' ? model : effort;
        if (p.kind === 'effort' && runsAt.effort?.isPicked && now === p.value) {
            if (isPickWaiting(true, status())) return false;
            runsAt = {
                ...runsAt,
                effort: { ...runsAt.effort, isPicked: false },
            };
            pending = null;
            return true;
        }
        if (now === p.value) {
            pending = null;
            return true;
        }
        if (Date.now() <= p.until) return false;
        pending = null;
        pickNote = 'No change seen: look at the Terminal';
        return true;
    }

    function closePick() {
        isPickOpen = false;
        effortPop = null;
    }

    /** the open slider holds the keyboard; closed, the caret goes back to the quill, a frame later @param {Context} cx */
    function focusPick(cx) {
        if (!isPickOpen) {
            quillBox()?.focus();
            return;
        }
        cx.timer.after(16, () => pickKeys?.focus());
    }

    /** Enter in the open slider applies the stop picked and closes it @param {Context} cx */
    function applyEffort(cx) {
        const isBlocked = status() === 'blocked';
        const r = effortKey(
            isPickOpen ? effortPop : null,
            pickNow().shownEffort,
            isBlocked,
        );
        effortPop = r.popover;
        isPickOpen = Boolean(r.popover);
        pickNote = isBlocked ? 'Answer Claude first, then pick' : null;
        if (r.apply) pick('effort', r.apply, cx);
        focusPick(cx);
        cx.notify();
    }

    /**
     * the quill's one picker, shepherdr's shape (dima's o10 pick, 2026-11-13): «Opus 5.5 · Medium ⌄» left of send, its
     * popover the model list over the effort slider. both switch mid-turn: the next reply uses the pick
     * @param {Theme} t
     */
    function picker(t) {
        const ready = status() !== 'blocked';
        const { effort, isApplied, model, pending, shownEffort, shownModel } =
            pickNow();
        const trigger = h_flex()
            .id('chat-pick-trigger')
            .flex_none()
            .gap(4)
            .px(6)
            .h(24)
            .items_center()
            .rounded(6)
            .when(isPickOpen, (el) => el.bg(t.hover))
            .cursor_pointer()
            .text_size(12)
            .text_color(pending ? t.accent : t.muted)
            .when(isApplied, (el) =>
                el.bg(t.solid).text_color(t.solid_foreground),
            )
            .hover((style) => style.bg(t.hover).text_color(t.foreground))
            .child(pickerLabel(model, effort, pending))
            .child(
                svg('mods/workspace-chrome/chevron-down.svg')
                    .size(12)
                    .text_color(t.dim),
            );
        /** @param {string} value */
        const row = (value) =>
            h_flex()
                .id(`chat-pick-model-${value}`)
                .gap(10)
                .px(9)
                .h(31)
                .items_center()
                .rounded(7)
                .text_size(13)
                .text_color(value === shownModel ? t.foreground : t.muted)
                .when(value !== shownModel && ready, (el) =>
                    el
                        .cursor_pointer()
                        .hover((style) =>
                            style.bg(t.hover).text_color(t.foreground),
                        )
                        .on_click((_event, cx) => {
                            closePick();
                            // a model switch mid-conversation drops the thread's cache: it asks first
                            if (hasRows()) askModel = value;
                            else pick('model', value, cx);
                            quillBox()?.focus();
                            cx.notify();
                        }),
                )
                .when(!ready, (el) => el.text_color(t.dim))
                .when(value === shownModel && pending?.kind === 'model', (el) =>
                    el.text_color(t.accent),
                )
                .child(div().flex_1().child(value))
                .child(
                    div()
                        .w(14)
                        .flex_none()
                        .text_color(t.foreground)
                        .child(value === shownModel ? '✓' : ''),
                );
        /** @param {string} text */
        const head = (text) =>
            div().px(9).pt(8).pb(4).text_size(11).text_color(t.dim).child(text);
        const chosenEffort =
            EFFORTS[effortPop?.at ?? -1] ?? shownEffort ?? null;
        // each level as wide as its word, the room left shared out, the chosen one raised (shepherdr's segments)
        const levels = h_flex()
            .mx(4)
            .my(3)
            .h(28)
            .gap(2)
            .p(2)
            .rounded(7)
            .bg(t.selected)
            .children(
                EFFORTS.map((level) =>
                    div()
                        .id(`chat-pick-level-${level}`)
                        .flex_auto()
                        .h_full()
                        .flex()
                        .items_center()
                        .justify_center()
                        .rounded(5)
                        .text_size(11.5)
                        .when(level === chosenEffort, (el) =>
                            el
                                .bg(isApplied ? t.solid : t.popover)
                                .text_color(
                                    isApplied
                                        ? t.solid_foreground
                                        : pending?.kind === 'effort'
                                          ? t.accent
                                          : t.foreground,
                                )
                                .font_weight(500)
                                .shadow_sm(),
                        )
                        .when(level !== chosenEffort, (el) =>
                            el.text_color(t.muted),
                        )
                        .when(ready && level !== shownEffort, (el) =>
                            el
                                .cursor_pointer()
                                .hover((style) =>
                                    style.text_color(t.foreground),
                                )
                                .on_click((_event, cx) => {
                                    closePick();
                                    if (level !== shownEffort)
                                        pick('effort', level, cx);
                                    quillBox()?.focus();
                                    cx.notify();
                                }),
                        )
                        .child(effortWord(level)),
                ),
            );
        return Popover.new('chat-pick')
            .anchor('bottom_right')
            .open(isPickOpen)
            .on_open_change((isOpen, cx) => {
                // a thread asking him something opens nothing: a pick would type into its question
                isPickOpen = isOpen && ready;
                effortPop = isPickOpen
                    ? effortKey(null, shownEffort, false).popover
                    : null;
                pickNote =
                    isOpen && !ready ? 'Answer Claude first, then pick' : null;
                isPermsOpen = false;
                if (isPickOpen) readPermission(cx);
                focusPick(cx);
                cx.notify();
            })
            .trigger(trigger)
            .content(
                v_flex()
                    .id('chat-pick-pop')
                    .track_focus(
                        /** @type {import('gpui-kit').FocusHandle} */ (
                            pickKeys
                        ),
                    )
                    .key_context('ChatPick')
                    .on_action('x_herdr_chat_effort_left', (_event, cx) =>
                        slide('left', cx),
                    )
                    .on_action('x_herdr_chat_effort_right', (_event, cx) =>
                        slide('right', cx),
                    )
                    .on_action('x_herdr_chat_effort_apply', (_event, cx) =>
                        applyEffort(cx),
                    )
                    .on_action('x_herdr_chat_effort_close', (_event, cx) => {
                        closePick();
                        quillBox()?.focus();
                        cx.notify();
                    })
                    .relative()
                    .w(340)
                    .p(5)
                    .mb(6)
                    .rounded(10)
                    .bg(t.popover)
                    .border(1)
                    .border_color(t.border)
                    .shadow_md()
                    .child(head('Model'))
                    .children(MODELS.map(([, label]) => row(label ?? '')))
                    .child(div().mx(4).my(4).h(1).bg(t.border))
                    .child(head('Reasoning'))
                    .child(levels)
                    .child(div().mx(4).my(4).h(1).bg(t.border))
                    .child(permissionsRow(t, ready))
                    .when(isPermsOpen, (el) =>
                        el.child(permissionsMenu(t, ready)),
                    ),
            );
    }

    /** shepherdr's row: «Permissions · Bypass permissions ›», its five modes listed under it, named as Claude Code names them @param {Theme} t @param {boolean} ready */
    function permissionsRow(t, ready) {
        const shown = permissionAsked ?? permission;
        const label = PERMISSIONS.find((p) => p.id === shown)?.label ?? '…';
        return h_flex()
            .id('chat-permissions')
            .gap(10)
            .px(9)
            .h(31)
            .items_center()
            .rounded(7)
            .text_size(13)
            .text_color(ready ? t.foreground : t.dim)
            .when(isPermsOpen, (el) => el.bg(t.hover))
            .when(ready, (el) =>
                el
                    .cursor_pointer()
                    .hover((style) => style.bg(t.hover))
                    .on_click((_event, cx) => {
                        isPermsOpen = !isPermsOpen;
                        cx.notify();
                    }),
            )
            .child(div().flex_1().child('Permissions'))
            .child(
                div()
                    .text_size(12)
                    .text_color(permissionAsked ? t.accent : t.muted)
                    .child(label),
            )
            .child(div().text_color(t.dim).child('›'));
    }

    /** the five modes, inline under the row: a menu floating over the picker's rows would let a click reach them too @param {Theme} t @param {boolean} ready */
    function permissionsMenu(t, ready) {
        const shown = permissionAsked ?? permission;
        return v_flex()
            .id('chat-permissions-menu')
            .mx(4)
            .mb(2)
            .p(3)
            .rounded(8)
            .bg(t.selected)
            .children(
                PERMISSIONS.map(({ id, label }) =>
                    h_flex()
                        .id(`chat-permission-${id}`)
                        .gap(10)
                        .px(9)
                        .h(29)
                        .items_center()
                        .rounded(6)
                        .text_size(13)
                        .text_color(id === shown ? t.foreground : t.muted)
                        .when(ready, (el) =>
                            el
                                .cursor_pointer()
                                .hover((style) =>
                                    style.bg(t.hover).text_color(t.foreground),
                                )
                                .on_click((_event, cx) => {
                                    if (id !== shown)
                                        pickPermission(id, label, cx);
                                    else {
                                        isPermsOpen = false;
                                        cx.notify();
                                    }
                                }),
                        )
                        .child(div().flex_1().child(label))
                        .child(
                            div()
                                .w(14)
                                .flex_none()
                                .text_color(t.foreground)
                                .child(id === shown ? '✓' : ''),
                        ),
                ),
            );
    }

    /** the mode line at the foot of the thread's screen, read when the picker opens @param {Context} cx */
    function readPermission(cx) {
        const address = shownAddress();
        if (!address) return;
        cx.spawn(async (cx) => {
            const out = await hc(['read', address]).catch(() => null);
            if (shownAddress() !== address || !out) return;
            permission = permissionOf(out.stdout.replace(/\r/g, ''));
            cx.notify();
        });
    }

    /**
     * Shift+Tab in the thread until its mode line reads the mode picked: it applies live, mid-turn too (probed
     * 2026-11-17), so nothing restarts
     * @param {string} mode @param {string} label @param {Context} cx
     */
    function pickPermission(mode, label, cx) {
        const address = shownAddress();
        if (!address || typingInto.has(address)) return;
        const isBlocked =
            agents().find((a) => a.address === address)?.status === 'blocked';
        // keys typed into a question would answer it, and keys mixed into a model or effort pick would land in its picker
        if (isBlocked || pending) {
            pickNote = isBlocked
                ? 'Answer Claude first, then pick'
                : 'One switch at a time: wait for this one to land';
            isPermsOpen = false;
            cx.notify();
            return;
        }
        typingInto.add(address);
        permissionAsked = mode;
        isPermsOpen = false;
        cx.notify();
        cx.spawn(async (cx) => {
            try {
                const now = await permissionIn(mode, {
                    isBlocked: () =>
                        agents().find((a) => a.address === address)?.status ===
                        'blocked',
                    keys: async (keys) => {
                        await hc(['keys', address, ...keys]);
                    },
                    screen: async () =>
                        (await hc(['read', address])).stdout.replace(/\r/g, ''),
                    sleep: (ms) => cx.sleep(ms),
                });
                if (shownAddress() !== address) return;
                permission = now;
                if (now !== mode)
                    pickNote = `${label} is not in this thread's Shift+Tab cycle`;
            } catch (error) {
                // keys may have gone before the failure: the mode shown is unknown until the picker reads it again
                if (shownAddress() === address) {
                    permission = null;
                    pickNote =
                        error instanceof Error ? error.message : String(error);
                }
            } finally {
                typingInto.delete(address);
                if (shownAddress() === address) permissionAsked = null;
                cx.notify();
            }
        });
    }

    /** @param {'left' | 'right'} way @param {Context} cx */
    function slide(way, cx) {
        if (!isPickOpen || !effortPop) return;
        effortPop = slideEffort(effortPop, way);
        cx.notify();
    }

    /** a model switch mid-conversation, asked first: the next message re-reads the whole history uncached @param {string} value @param {Theme} t */
    function modelConfirm(value, t) {
        /** @param {string} id @param {string} word @param {boolean} isMain @param {(cx: Context) => void} act */
        const choice = (id, word, isMain, act) =>
            div()
                .id(id)
                .px(10)
                .py(3)
                .rounded(6)
                .bg(isMain ? t.solid : t.raised)
                .text_color(isMain ? t.solid_foreground : t.foreground)
                .cursor_pointer()
                .child(word)
                .on_click((_event, cx) => {
                    askModel = null;
                    act(cx);
                    cx.notify();
                });
        return h_flex()
            .w_full()
            .flex_none()
            .justify_center()
            .px(18)
            .pb(6)
            .child(
                v_flex()
                    .w_full()
                    .max_w(column())
                    .gap(8)
                    .p(10)
                    .rounded(8)
                    .border(1)
                    .border_color(t.border)
                    .bg(t.raised)
                    .text_size(12)
                    .child(
                        div()
                            .font_semibold()
                            .child(`Switch this thread to ${value}?`),
                    )
                    .child(
                        div()
                            .text_color(t.muted)
                            .child(
                                'Its cache is lost: the next message re-reads the whole conversation, slower and pricier.',
                            ),
                    )
                    .child(
                        h_flex()
                            .gap(6)
                            .child(
                                choice(
                                    'chat-model-switch',
                                    `Switch to ${value}`,
                                    true,
                                    (cx) => pick('model', value, cx),
                                ),
                            )
                            .child(
                                choice(
                                    'chat-model-keep',
                                    'Keep',
                                    false,
                                    () => {},
                                ),
                            ),
                    ),
            );
    }

    return {
        applyEffort,
        /** a new thread is shown: nothing of the old one's pick, ask or menu may act on it */
        clear() {
            runsAt = NO_RUNS_AT;
            pending = null;
            pickNote = null;
            askModel = null;
            permission = null;
            permissionAsked = null;
            isPermsOpen = false;
            closePick();
        },
        /** a model switch waiting on his yes, over the quill @param {Theme} t */
        confirmView: (t) => (askModel ? modelConfirm(askModel, t) : null),
        isOpen: () => isPickOpen,
        /** why a pick did not go, or did not land: a line under the quill */
        note: () => pickNote,
        readPermission,
        /** a replaced transcript names its own model and effort, or none yet: never the removed one's */
        restart() {
            runsAt = NO_RUNS_AT;
        },
        settle: settlePick,
        /** @param {Context} cx */
        start(cx) {
            pickKeys = cx.focus_handle();
            // ← → slide the effort thumb, Enter applies, Esc closes: the open picker holds the keyboard
            cx.bind_keys(
                [
                    ['left', 'x_herdr_chat_effort_left'],
                    ['right', 'x_herdr_chat_effort_right'],
                    ['enter', 'x_herdr_chat_effort_apply'],
                    ['escape', 'x_herdr_chat_effort_close'],
                ].map(([keystroke, action]) => ({
                    action: String(action),
                    context: 'ChatPick',
                    keystroke: String(keystroke),
                })),
            );
        },
        /**
         * the thread's new lines: the model and effort it ran at; the label flashes the moment a reply first ran at
         * his pick, and draws again when it ends
         * @param {string[]} lines @param {Context} cx
         */
        takeLines(lines, cx) {
            const ran = runsAt;
            for (const line of lines)
                runsAt = runsAtAfter(runsAt, line, Date.now());
            if (runsAt.appliedAt !== ran.appliedAt) {
                cx.notify();
                cx.timer.after(APPLIED_FLASH_MS + 50, (later) =>
                    later.notify(),
                );
            }
            if (runsAt !== ran && settlePick()) cx.notify();
        },
        view: picker,
    };
}
