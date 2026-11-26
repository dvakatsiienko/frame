// until herdr-app#942: a handler may not sit in a list row. then this file goes, the handler moves onto the row, and with
// it go message-list.js's syncBodies and message-row.js's bodyLook
import { View } from 'gpui-kit';

/** @typedef {import('gpui-kit').Element} Element */
/** @typedef {import('gpui-base').TextViewElement} TextViewElement */
/** @typedef {(view: TextViewElement, block: number, source: string) => TextViewElement} Reporting a text view that reports his selection and his click on a link */

/** @typedef {(square: Element, picture: string) => Element} Pressing a picture's square that says it was pressed */
/** @typedef {{ pressing: Pressing, reporting: Reporting }} Handlers */

/**
 * one list item's text views, or its squares
 * @typedef {object} BodyAt
 * @property {string} key the list item
 * @property {string} look what they draw from: another look draws them again, since a nested view is not drawn with its parent
 * @property {(handlers: Handlers) => Element} draw
 * @property {(url: string, cx: import('gpui-kit').Context) => void} follow a click on a link in its text
 * @property {(picture: string) => void} press a left press on one of its squares, by the picture's id
 * @property {(block: number, part: import('./selection.js').Reported | null, cx: import('gpui-kit').Context) => void} report his selection in one of them
 */

class MessageBody extends View {
    /** @type {() => Element} */
    draw = () => {
        throw new Error('a body draws nothing before init');
    };

    /** @param {any} props */
    init(props) {
        this.draw = props.draw;
    }

    render() {
        return this.draw();
    }
}

/** herdr's types spell `cx.new` as a constructor, not a method @typedef {{ 'new': (Class: import('gpui-kit').ViewClass, props: object) => import('gpui-kit').Entity }} Maker */

/** @param {BodyAt} at */
const drawBody = (at) =>
    at.draw({
        pressing: (square, picture) =>
            square.on_mouse_down('left', () => at.press(picture)),
        reporting: (view, block, source) =>
            view
                .on_link_click((url, cx) => at.follow(url, cx))
                .on_selection_change((s, cx) =>
                    at.report(
                        block,
                        s && {
                            position: s.position ?? null,
                            range: s.range ?? null,
                            source,
                            words: s.text,
                        },
                        cx,
                    ),
                ),
    });

export function createMessageBodies() {
    /** @type {Map<string, { entity: import('gpui-kit').Entity, held: { at: BodyAt } }>} */
    const bodies = new Map();
    return {
        clear() {
            for (const { entity } of bodies.values()) entity.release();
            bodies.clear();
        },
        /**
         * the view that draws a list item's text, null until it is made; it draws an older look until the next sync
         * @param {string} key @param {string} look
         */
        of(key, look) {
            const body = bodies.get(key);
            return body
                ? { entity: body.entity, isStale: body.held.at.look !== look }
                : null;
        },
        /**
         * the list items near the view each have theirs, drawn as they look now; the rest are let go. never inside a draw,
         * which may make none
         * @param {readonly BodyAt[]} near @param {import('gpui-kit').AsyncContext} cx
         * @returns {string[]} the items that got theirs now
         */
        sync(near, cx) {
            const maker = /** @type {Maker} */ (/** @type {unknown} */ (cx));
            const made = [];
            for (const at of near) {
                const body = bodies.get(at.key);
                if (body) {
                    const isStale = body.held.at.look !== at.look;
                    body.held.at = at;
                    if (isStale) cx.notify(body.entity);
                    continue;
                }
                const held = { at };
                const entity = maker.new(MessageBody, {
                    draw: () => drawBody(held.at),
                });
                bodies.set(at.key, { entity, held });
                made.push(at.key);
            }
            const keys = new Set(near.map(({ key }) => key));
            for (const [key, { entity }] of bodies)
                if (!keys.has(key)) {
                    entity.release();
                    bodies.delete(key);
                }
            return made;
        },
    };
}
