// «tell <thread>» beside the words he selected (FRM-585 C1, FRM-564:W2, W38): one press opens the note box on them. it
// is a view of its own, so a settled selection redraws only it, never the chat, whose redraw could drop the selection.
// his left press clears herdr's selection before the press reaches it, so it holds the words of the report that showed
// it, and a cleared selection hides it only a moment later, when no press came

import { View, div } from 'gpui-kit';

/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./chat-types.js').Theme} Theme */
/** @typedef {import('./selection.js').SelectedAt} SelectedAt */

// above the words' end, inside the list; a long thread name is cut to its width
const HEIGHT = 26;
const GAP = 6;
const WIDTH_GUESS = 160;
// a press on it lands after herdr cleared the selection it stood for
const CLEARED_MS = 250;

class NotePopup extends View {
    /** @type {() => import('gpui-kit').Element} */
    draw = () => div();

    /** @param {any} props */
    init(props) {
        this.draw = props.draw;
    }

    render() {
        return this.draw();
    }
}

/** herdr's types spell `cx.new` as a constructor, not a method @typedef {{ 'new': (Class: import('gpui-kit').ViewClass, props: object) => import('gpui-kit').Entity }} Maker */

/**
 * where it sits: over the words' end, under it when the list's top is too near, kept inside the list
 * @param {{ x: number, y: number }} end in the list's px @param {{ w: number, h: number }} view
 */
export function popupPlace(end, view) {
    const above = end.y - HEIGHT - GAP;
    return {
        x: Math.max(0, Math.min(end.x, view.w - WIDTH_GUESS)),
        y: above >= 0 ? above : Math.min(end.y + GAP, view.h - HEIGHT),
    };
}

/**
 * @param {object} deps
 * @param {() => boolean} deps.isOn `chatter.annotate.popup`
 * @param {() => string} deps.threadName
 * @param {() => { width: number, height: number }} deps.room the list's size
 * @param {() => void} deps.ask the chat takes the pressed words at its next draw: the box is the chat's, and this view's
 *   own redraw never reaches it
 */
export function createNotePopup(deps) {
    /** the words it stands for @type {SelectedAt | null} */
    let shown = null;
    /** @type {import('gpui-kit').Entity | null} */
    let entity = null;
    /** @type {Theme | null} */
    let theme = null;
    /** a cleared selection's hide, waiting for a press @type {{ cancel: () => void } | null} */
    let hiding = null;
    /** the words of its last press, until the chat takes them @type {SelectedAt | null} */
    let pressed = null;

    /** @param {Context} cx */
    const redraw = (cx) => {
        if (entity) cx.notify(entity);
    };

    /** @param {Context} cx */
    function press(cx) {
        const words = deps.isOn() ? shown : null;
        hiding?.cancel();
        hiding = null;
        shown = null;
        redraw(cx);
        if (!words) return;
        pressed = words;
        deps.ask();
    }

    function draw() {
        const t = theme;
        if (!shown?.at || !t || !deps.isOn()) return div().absolute();
        const room = deps.room();
        const place = popupPlace(shown.at, { h: room.height, w: room.width });
        const label = `tell ${deps.threadName()}`;
        return (
            div()
                .id('chat-note-popup')
                .absolute()
                .left(place.x)
                .top(place.y)
                .h(HEIGHT)
                .px(10)
                .flex()
                .items_center()
                .max_w(WIDTH_GUESS)
                .rounded(13)
                .bg(t.popover)
                .border_1()
                .border_color(t.border)
                .shadow_lg()
                .text_size(12)
                .text_color(t.foreground)
                .cursor_pointer()
                // the theme's hover is see-through: over the reply's words the pill must stay solid (dima, 14:27)
                .hover((s) => s.border_color(t.accent))
                // the press acts at once: its click would come after herdr cleared the words
                .on_mouse_down('left', (_e, cx) => {
                    cx.stop_propagation();
                    press(cx);
                })
                .child(div().min_w(0).truncate().child(label))
        );
    }

    return {
        /** the view, drawn over the list; made once, in the view's init @param {Theme} t */
        element(t) {
            theme = t;
            return entity;
        },
        /** shut with the box's opening or a thread switch @param {Context} cx */
        hide(cx) {
            hiding?.cancel();
            hiding = null;
            if (!shown) return;
            shown = null;
            redraw(cx);
        },
        isShown: () => shown !== null,
        press,
        /** what a settled selection stands for now, null once it is cleared @param {SelectedAt | null} selected @param {Context} cx */
        reported(selected, cx) {
            hiding?.cancel();
            hiding = null;
            if (selected && deps.isOn()) {
                shown = selected;
                return redraw(cx);
            }
            if (!shown) return;
            hiding = cx.timer.after(CLEARED_MS, (later) => {
                hiding = null;
                shown = null;
                if (entity) later.notify(entity);
            });
        },
        /** @param {Context} cx */
        start(cx) {
            const maker = /** @type {Maker} */ (/** @type {unknown} */ (cx));
            entity = maker.new(NotePopup, { draw });
        },
        /** the words of its press, once @returns {SelectedAt | null} */
        take() {
            const words = pressed;
            pressed = null;
            return words;
        },
    };
}
