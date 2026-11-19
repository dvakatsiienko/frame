// x-herdr-chat-settings: the chat's look, as a popover the chat's gear opens (FRM-641). the values live in herdr's
// shared store under `chat.look` (look.js), so whichever chat is his reads a change at once; the rows are data
// (rows.js).

import { Input, InputState, h_flex, v_flex } from 'gpui-base';
import { View, div } from 'gpui-kit';
import {
    appHome,
    readTextFile,
    setShared,
    shared,
    theme,
    writeTextFile,
} from 'herdr';

import { createForeground } from './foreground.js';
import { LOOK_KEY, SIZE_MAX, SIZE_MIN, lookOf, withChange } from './look.js';
import { ROWS } from './rows.js';

/** @typedef {import('gpui-kit').Color} Color */
/** @typedef {import('gpui-kit').Element} Element */
/** @typedef {import('./look.js').Look} Look */
/** @typedef {import('./rows.js').Row} Row */
// the theme colours this file reads, each present in every herdr theme
/** @typedef {Record<'accent' | 'border' | 'dim' | 'foreground' | 'hover' | 'popover' | 'selected' | 'surface', Color>} Theme */

const HEX = /^#[0-9a-f]{6}$/i;

/** @param {Partial<Look>} change */
const setLook = (change) =>
    setShared(LOOK_KEY, withChange(shared(LOOK_KEY), change));

export default class ChatSettings extends View {
    /** a box for any colour, per row that takes one @type {Map<string, import('gpui-base').InputState>} */
    hex = new Map();
    /** «text (all of herdr)»: herdr's own text colour, written only on his change */
    foreground = createForeground({
        read: () => readTextFile(`${appHome()}/settings.json`),
        store: localStorage,
        write: (text, expected) =>
            writeTextFile(`${appHome()}/settings.json`, text, expected),
    });

    /**
     * @param {unknown} _props
     * @param {import('gpui-kit').AsyncContext} _cx
     */
    init(_props, _cx) {
        const look = lookOf(shared(LOOK_KEY));
        for (const key of /** @type {const} */ (['fg'])) {
            const box = InputState.new({
                placeholder: '#hex',
                value: HEX.test(look[key]) ? look[key] : '',
            });
            // a whole #rrggbb takes effect as he types it
            box.on('change', () => {
                const typed = box.value().trim().replace(/^#?/, '#');
                if (
                    HEX.test(typed) &&
                    typed.toLowerCase() !==
                        lookOf(shared(LOOK_KEY))[key].toLowerCase()
                )
                    this.pick(key, typed);
            });
            this.hex.set(key, box);
        }
    }

    /** @param {import('gpui-kit').Context} _cx */
    render(_cx) {
        const t = /** @type {Theme} */ (theme());
        const look = lookOf(shared(LOOK_KEY));
        return v_flex()
            .w_full()
            .p(5)
            .bg(t.popover)
            .text_size(12.8)
            .child(
                h_flex()
                    .px(8)
                    .py(4)
                    .items_center()
                    .justify_between()
                    .child(div().text_size(11).text_color(t.dim).child('Chat'))
                    .child(
                        div()
                            .id('look-reset')
                            .text_size(11)
                            .text_color(t.dim)
                            .cursor_pointer()
                            .hover((style) => style.text_color(t.foreground))
                            .on_click((_event, cx) => {
                                setShared(LOOK_KEY, null);
                                for (const box of this.hex.values())
                                    box.set_value('');
                                cx.spawn(() => this.foreground.reset());
                            })
                            .child('Reset'),
                    ),
            )
            .children(
                ROWS.map((row) =>
                    h_flex()
                        .h(34)
                        .px(8)
                        .gap(8)
                        .items_center()
                        .child(
                            div()
                                .flex_1()
                                .text_color(t.foreground)
                                .child(row.label),
                        )
                        .child(this.control(row, look, t)),
                ),
            );
    }

    /**
     * @param {Row} row
     * @param {Look} look
     * @param {Theme} t
     * @returns {Element}
     */
    control(row, look, t) {
        const value = String(look[row.key]);
        const choices = row.choices ?? [];
        if (row.kind === 'step')
            return this.pills(t, [
                this.step('look-smaller', 'A−', look.size - 1, t),
                div()
                    .w(28)
                    .text_center()
                    .text_color(t.foreground)
                    .child(String(look.size)),
                this.step('look-bigger', 'A+', look.size + 1, t),
            ]);
        if (row.kind === 'pills')
            return this.pills(
                t,
                choices.map(([choice, label]) =>
                    div()
                        .id(`look-${row.key}-${choice}`)
                        .px(8)
                        .h(22)
                        .flex()
                        .items_center()
                        .rounded(5)
                        .text_size(12)
                        .cursor_pointer()
                        .when(value === choice, (el) =>
                            el.bg(t.selected).text_color(t.foreground),
                        )
                        .when(value !== choice, (el) =>
                            el
                                .text_color(t.dim)
                                .hover((style) =>
                                    style.text_color(t.foreground),
                                ),
                        )
                        .on_click(() => {
                            setLook({ [row.key]: choice });
                            // a surface picked here leaves no hex of his own in the colour box
                            this.hex.get(row.key)?.set_value('');
                        })
                        .child(label),
                ),
            );
        const box = this.hex.get(row.key);
        return h_flex()
            .flex_none()
            .gap(6)
            .items_center()
            .children(
                choices.map(([choice, name]) =>
                    div()
                        .id(`look-${row.key}-${choice}`)
                        .size(18)
                        .rounded(9)
                        .cursor_pointer()
                        .bg(
                            choice === 'theme'
                                ? t.foreground
                                : /** @type {Color} */ (choice),
                        )
                        .border(2)
                        .border_color(
                            value.toLowerCase() === choice
                                ? t.accent
                                : t.border,
                        )
                        .tooltip(name)
                        .on_click(() => {
                            this.pick('fg', choice);
                            box?.set_value(HEX.test(choice) ? choice : '');
                        }),
                ),
            )
            .when(Boolean(box), (el) =>
                el.child(
                    div()
                        .w(76)
                        .h(24)
                        .px(6)
                        .flex()
                        .items_center()
                        .rounded(5)
                        .border(1)
                        .border_color(t.border)
                        .bg(t.surface)
                        .text_size(12)
                        .text_color(t.foreground)
                        .when(Boolean(box), (inner) =>
                            box ? inner.child(Input.new(box)) : inner,
                        ),
                ),
            );
    }

    /**
     * a colour row's pick; the text colour also goes into herdr's settings, the whole app's text
     * @param {'bg' | 'fg'} key
     * @param {string} colour
     */
    pick(key, colour) {
        setLook({ [key]: colour });
        if (key === 'fg') this.foreground.change(colour).catch(() => {});
    }

    /** @param {Theme} t @param {Element[]} children */
    pills(t, children) {
        return h_flex()
            .flex_none()
            .p(2)
            .gap(2)
            .rounded(7)
            .bg(t.surface)
            .border(1)
            .border_color(t.border)
            .children(children);
    }

    /** @param {string} id @param {string} label @param {number} size @param {Theme} t */
    step(id, label, size, t) {
        return div()
            .id(id)
            .size(24)
            .flex()
            .items_center()
            .justify_center()
            .rounded(5)
            .cursor_pointer()
            .text_color(t.foreground)
            .hover((style) => style.bg(t.hover))
            .on_click(() =>
                setLook({ size: Math.max(SIZE_MIN, Math.min(SIZE_MAX, size)) }),
            )
            .child(label);
    }
}
