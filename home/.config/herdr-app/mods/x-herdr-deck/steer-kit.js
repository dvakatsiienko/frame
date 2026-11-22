// the press button and the steer box every deck card draws, an orbit ask's and the phases' alike, so both look and act
// the same (dima, 19:08: «it is essentially same button, you can reuse component»)

import { Button, Input } from 'gpui-base';
import { div } from 'gpui-kit';

import { focusBorder } from './focus-ring.js';
import { SIZE } from './look.js';

/** @typedef {import('./main.js').Theme} Theme */
/** @typedef {import('./main.js').Context} Context */

// Enter and ⌘Enter in a steer box are the deck's own actions, ahead of the box's submit (FRM-648 step 111)
export const STEER_ENTER = 'x_herdr_deck_steer_enter';
export const STEER_CMD_ENTER = 'x_herdr_deck_steer_cmd_enter';
// Tab and shift-Tab in a steer box loop the quill and orbit, never herdr's hidden stops (FRM-620 slice 5c)
export const STEER_TAB = 'x_herdr_deck_steer_tab';
export const STEER_BACK = 'x_herdr_deck_steer_back';

/**
 * a press button: tick is the main act, so it is the one filled; locked (delivered) it stays, still
 * @param {Theme} t
 * @param {{ id: string, label: string, tip: string, onClick: (cx: Context) => void, isPrimary?: boolean, isLocked?: boolean }} it
 */
export const pressButton = (
    t,
    { id, isLocked = false, isPrimary = false, label, onClick, tip },
) =>
    Button.new(id)
        // the steer box's Enter and ⌘Enter press these, so Tab skips them (his 14:12 steer)
        .tab_stop(false)
        .h(28)
        .px(12)
        .flex_none()
        .flex()
        .items_center()
        .rounded(6)
        .border_1()
        .border_color(isPrimary ? t.solid : t.border)
        .bg(isPrimary ? t.solid : t.surface)
        .text_size(SIZE.secondary)
        .text_color(isPrimary ? t.solid_foreground : t.foreground)
        .when(isPrimary, (el) => el.font_semibold())
        // delivered: both stay, still, the taken one reading 😋 (dima, 21:03)
        .when(isLocked, (el) =>
            el.opacity(0.6).tooltip('joined: the session took it'),
        )
        .when(!isLocked, (el) =>
            el
                .cursor_pointer()
                .hover((st) => (isPrimary ? st.opacity(0.85) : st.bg(t.hover)))
                .tooltip(tip)
                .on_click((_e, cx) => onClick(cx)),
        )
        .child(label);

/**
 * a steer box: its keys are the card's (Enter ticks, ⌘Enter replays, Tab walks the loop); delivered, its steer stays as
 * words, no longer editable
 * @param {Theme} t
 * @param {{ id: string, box: import('gpui-base').InputState, isFocused: boolean, isLocked?: boolean, tabIndex: number,
 *   onEnter: (cx: Context, isCmd: boolean) => void, onTab: (isBack: boolean) => void, onEnterUp: () => void,
 *   onCmdUp: () => void }} it
 */
export const steerBox = (
    t,
    {
        box,
        id,
        isFocused,
        isLocked = false,
        onCmdUp,
        onEnter,
        onEnterUp,
        onTab,
        tabIndex,
    },
) =>
    div()
        .id(id)
        .flex_1()
        .min_w(0)
        .h(28)
        .px(8)
        .flex()
        .items_center()
        .rounded(6)
        .border_1()
        .border_color(focusBorder(isFocused, t, t.border))
        .bg(t.surface)
        .font_weight(400)
        .when(isLocked, (el) => el.opacity(0.6))
        .when(!isLocked, (el) => el.cursor_text())
        .on_mouse_down('left', (_e, cx) => cx.stop_propagation())
        .key_context('XDeckSteer')
        .on_action(STEER_ENTER, (_e, cx) => onEnter(cx, false))
        .on_action(STEER_CMD_ENTER, (_e, cx) => onEnter(cx, true))
        .on_action(STEER_TAB, () => onTab(false))
        .on_action(STEER_BACK, () => onTab(true))
        // a let-go key ends a press, so the next Enter acts however soon; ⌘ let go ends a cmd-enter, whose Enter key-up
        // macOS never sends
        .on_key_up((e) => {
            if (e.key === 'enter') onEnterUp();
        })
        .on_modifiers_changed((e) => {
            if (!e.modifiers.platform) onCmdUp();
        })
        .child(
            isLocked
                ? div()
                      .w_full()
                      .truncate()
                      .text_size(SIZE.secondary)
                      .text_color(t.muted)
                      .child(box.value())
                : Input.new(box)
                      .tab_index(tabIndex)
                      .w_full()
                      .text_size(SIZE.secondary)
                      .text_color(t.foreground),
        );
