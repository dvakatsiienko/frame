// the quill-mini's grade row (FRM-630): 👍🏼 👎🏼 and «whole message» beside the join and send; one thumb lit at a time,
// the note a reply-grade while one is. the box's own Tab walks its text and every part of the row, then the loop

import { Checkbox } from 'gpui-base';
import { div } from 'gpui-kit';

import { focusBorder } from './focus-ring.js';
import { THUMBS } from './note-text.js';
import { pressButton } from './press-button.js';

/** @typedef {import('./chat-types.js').Theme} Theme */
/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./note-states.js').Grade} Grade */

/** the box's Tab order after its text; past the last, or before the text, the loop's next stop */
export const PARTS = /** @type {const} */ ([
    'good',
    'bad',
    'whole',
    'join',
    'send',
]);
/** @typedef {(typeof PARTS)[number]} Part */

/** where Tab goes from a part, or from the text: `out`, the loop's next stop @param {Part | 'text'} at @param {boolean} isBack @returns {Part | 'text' | 'out'} */
export function partAfter(at, isBack) {
    const ring = /** @type {const} */ (['text', ...PARTS]);
    const next = ring.indexOf(at) + (isBack ? -1 : 1);
    return ring[next] ?? 'out';
}

/**
 * @param {Theme} t
 * @param {object} it
 * @param {{ grade?: Grade | null, isWhole?: boolean }} it.note
 * @param {boolean} it.isLocked the thread has it: nothing in the row changes it
 * @param {(part: Part) => import('gpui-kit').FocusHandle | null} it.keysOf
 * @param {(part: Part) => boolean} it.isFocused
 * @param {(grade: Grade, cx: Context) => void} it.onGrade
 * @param {(isWhole: boolean, cx: Context) => void} it.onWhole
 */
export function gradeParts(
    t,
    { isFocused, isLocked, keysOf, note, onGrade, onWhole },
) {
    /** @param {Grade} grade */
    const thumb = (grade) =>
        withKeys(
            pressButton(t, {
                id: `chat-mini-${grade}`,
                isFocused: isFocused(grade),
                isLocked,
                label: THUMBS[grade],
                name: grade === 'good' ? 'grade it good' : 'grade it bad',
                onClick: (cx) => onGrade(grade, cx),
                size: 'sm',
                variant: thumbVariant(note, grade),
            }),
            keysOf(grade),
        );
    const isWhole = Boolean(note.isWhole);
    return [
        thumb('good'),
        thumb('bad'),
        withKeys(
            Checkbox.new('chat-mini-whole')
                .checked(isWhole)
                .accessibility_label('the grade is of the whole message')
                .h(24)
                .flex()
                .flex_none()
                .items_center()
                .gap(6)
                .text_size(12)
                .text_color(isLocked ? t.dim : t.muted)
                .when(!isLocked, (el) =>
                    el
                        .cursor_pointer()
                        .on_change((checked, cx) => onWhole(checked, cx)),
                )
                .child(
                    div()
                        .size(14)
                        .flex()
                        .items_center()
                        .justify_center()
                        .rounded(3)
                        .border_1()
                        .border_color(
                            focusBorder(
                                isFocused('whole'),
                                t,
                                isWhole ? t.solid : t.border,
                            ),
                        )
                        .bg(isWhole ? t.solid : t.raised)
                        .text_size(10)
                        .text_color(t.solid_foreground)
                        .child(isWhole ? '✓' : ''),
                )
                .child('whole message'),
            keysOf('whole'),
        ),
    ];
}

/** the lit thumb is filled, the other plain @param {{ grade?: Grade | null }} note @param {Grade} grade @returns {'primary' | 'outline'} */
export const thumbVariant = (note, grade) =>
    note.grade === grade ? 'primary' : 'outline';

/**
 * a part the box's Tab reaches: a plain wrapper holds the keyboard, never the control in it, so a gpui-base Button or
 * Checkbox's own Enter and space never press it a second time beside the box's (the 🔎's question, 26 Nov)
 * @param {import('gpui-kit').NativeElement} el @param {import('gpui-kit').FocusHandle | null} keys
 */
export const withKeys = (el, keys) =>
    keys
        ? div()
              .flex_none()
              .track_focus(keys)
              .key_context('XChatQuillMiniPart')
              .child(el)
        : el;
