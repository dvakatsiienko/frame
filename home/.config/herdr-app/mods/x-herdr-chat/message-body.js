// until herdr-app#942: a handler may not sit in a list row; delete this file and put the handler on the row
import { View } from 'gpui-kit';

/** @typedef {import('gpui-kit').Element} Element */
/** @typedef {import('gpui-base').TextViewElement} TextViewElement */
/** @typedef {(view: TextViewElement, block: number) => TextViewElement} Reporting a text view that reports his selection */

/**
 * one list item's text views
 * @typedef {object} BodyAt
 * @property {string} key the list item
 * @property {string} look what they draw from: another look draws them again, since a nested view is not drawn with its parent
 * @property {(reporting: Reporting) => Element} draw
 * @property {(block: number, words: string | null) => void} report his selection in one of them
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
    at.draw((view, block) =>
        view.on_selection_change((s) => at.report(block, s?.text ?? null)),
    );

export function createMessageBodies() {
    /** @type {Map<string, { at: BodyAt, entity: import('gpui-kit').Entity }>} */
    const bodies = new Map();
    return {
        clear() {
            for (const { entity } of bodies.values()) entity.release();
            bodies.clear();
        },
        /** the view that draws a list item's text, null until it is made @param {string} key */
        of: (key) => bodies.get(key)?.entity ?? null,
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
                    const isStale = body.at.look !== at.look;
                    body.at = at;
                    if (isStale) cx.notify(body.entity);
                    continue;
                }
                /** @type {{ at: BodyAt, entity: import('gpui-kit').Entity }} */
                const next = {
                    at,
                    entity: maker.new(MessageBody, {
                        draw: () => drawBody(next.at),
                    }),
                };
                bodies.set(at.key, next);
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
