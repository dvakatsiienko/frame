// orbit as drawn: each ask's card with its tick, replay and steer box, the pinned cards, each thread's section. it owns
// the widths they draw at and the id copied last; everything another view reads stays on the deck (main.js) and comes through `deps`

import { Button, h_flex, v_flex } from 'gpui-base';
import { div } from 'gpui-kit';
import { exec, home, shared } from 'herdr';

import {
    CARD_PAD,
    COPIED_MS,
    PILL,
    askMarkdown,
    askPick,
    askTitle,
    pillTop,
    titleInset,
    titleMarkdown,
} from './ask-card.js';
import {
    SIZE,
    drawnSize,
    leadingRoom,
    line,
    markdownText,
    prose,
} from './look.js';
import { openWebLink } from './open-path.js';
import {
    cardKind,
    cardPaint,
    cardText,
    linkOf,
    orbitSections,
    orbitTabOrder,
    pressLabel,
    tickAllTakes,
} from './orbit.js';
import { askText } from './pictures.js';
import { pressButton } from './steer-kit.js';
import { ORDER_KEY } from './thread-keys.js';

// an ask's title and body sizes, two looks for his pick: A the title at today's size, the body a step under it; B the
// title a step larger, the body at today's size
const LOOKS = {
    a: { body: SIZE.secondary, title: SIZE.main },
    b: { body: SIZE.main, title: SIZE.main + 2 },
};
const LOOK = LOOKS.a;

/** @typedef {import('./deck-types.js').AsyncContext} AsyncContext */
/** @typedef {import('./deck-types.js').Context} Context */
/** @typedef {import('./deck-types.js').Theme} Theme */
/** @typedef {import('./orbit.js').Ask} Ask */
/** @typedef {import('./shelf.js').Row} Row */

/**
 * @typedef {object} OrbitViewDeps
 * @property {(cx: Context, key: string, paths: string[]) => void} addSteerFiles files dropped on a card join its steer
 * @property {(t: Theme, key: string, isLocked: boolean) => ReturnType<typeof import('./attach-row.js').attachRow>[]} chipsOf
 * @property {() => ReturnType<typeof import('./card-files.js').createCardFiles>} files
 * @property {() => string | null} hoverSid
 * @property {() => Map<string, { text: string, until: number }>} keyNotes
 * @property {() => import('./orbit.js').OrbitPin} pin
 * @property {(cx: AsyncContext, s: Row, ask: Ask, verdict: 'tick' | 'replay') => Promise<void>} press
 * @property {(cx: AsyncContext, s: Row) => Promise<void>} pressAll
 * @property {(s: Row, id: string | null) => ReturnType<typeof import('./press.js').pressState>} pressStateOf
 * @property {() => Map<string, import('./press.js').PressRecord>} presses
 * @property {() => Row[]} rows
 * @property {(sid: string | null) => void} setHoverSid
 * @property {(stops: string[]) => void} setOrbitStops
 * @property {(tabAt: Map<string, number>) => void} setTabAt
 * @property {(t: Theme, key: string, tabIndex: number, isLocked: boolean) => ReturnType<typeof import('./steer-kit.js').steerBox>} steerOf
 * @property {() => Map<string, import('gpui-base').InputState>} steers
 * @property {() => Map<string, number>} tabAt
 * @property {(cx: AsyncContext, s: Row, ask: Ask) => Promise<void>} unpress
 * @property {() => Set<string> | null | undefined} updated
 */

/** @param {OrbitViewDeps} deps */
export function createOrbitView(deps) {
    /** @type {Map<string, number>} each ask id label's drawn width */
    const labelW = new Map();
    /** each id pill's drawn width @type {Map<string, number>} */
    const pillW = new Map();
    /** each card's inner width, by its ask: a look's border takes two pixels of it @type {Map<string, number>} */
    const cardW = new Map();
    /** each title's width on one line, by its ask @type {Map<string, number>} */
    const titleW = new Map();
    /** the id copied last, its ✓ shown for a moment; each copy its own record @type {{ key: string } | null} */
    let copied = null;
    /** the title row's height and the id pill's, every card's the same; 0 until drawn */
    const heights = { pill: 0, title: 0 };
    /** a height herdr reports, kept as drawn @param {'pill' | 'title'} of */
    const keepHeight =
        (of) =>
        (/** @type {{ height: number }} */ size, /** @type {Context} */ cx) => {
            const height = drawnSize(size.height);
            if (Math.abs(heights[of] - height) < 0.5) return;
            heights[of] = height;
            cx.notify();
        };
    /** a width herdr reports, kept as drawn; one that moved draws again @param {Map<string, number>} widths @param {string} key */
    const keepWidth =
        (widths, key) =>
        (/** @type {{ width: number }} */ size, /** @type {Context} */ cx) => {
            const width = drawnSize(size.width);
            if (Math.abs((widths.get(key) ?? 0) - width) < 0.5) return;
            widths.set(key, width);
            cx.notify();
        };

    /** @param {Theme} t @param {Row} s @param {Ask} ask */
    function ask(t, s, ask) {
        const key = `${s.sid}:${ask.id}`;
        const steerTab = deps.tabAt().get(`steer-${key}`) ?? 0;
        const steer = deps.steers().get(key);
        const state = deps.pressStateOf(s, ask.id);
        const record = deps.presses().get(key);
        const failed =
            record?.phase === 'failed' ? (record.reason ?? '') : null;
        const isLocked = state === 'locked';
        const labels = pressLabel(state, ask.mark);
        /** @param {string} id @param {string} label @param {string} tip @param {(cx: Context) => void} onClick @param {boolean} [isPrimary] */
        const button = (id, label, tip, onClick, isPrimary = false) =>
            pressButton(t, {
                id: `${id}-${key}`,
                isLocked,
                isPrimary,
                label,
                onClick,
                tip,
            });
        // an ask is a card: the section head carries the 🪐
        return (
            v_flex()
                .relative()
                .p(CARD_PAD)
                .gap(8)
                .rounded(8)
                .bg(t.raised)
                // a file dropped anywhere on the card joins its steer: the box's own text field swallows a drop (his 19:33 test)
                .when(Boolean(steer) && !isLocked, (el) =>
                    el.on_drop((e, cx) =>
                        deps.addSteerFiles(cx, key, e?.paths ?? []),
                    ),
                )
                .when(Boolean(cardKind(ask.text)), (el) =>
                    cardPaint(
                        el,
                        cardKind(ask.text) === 'look' ? t.ansi5 : t.ansi6,
                    ),
                )
                // the id sits outside the selectable text, so a double-click or a drag takes the ask alone (his F4 reads
                // the selection aloud, dima 16:33); it lies over the text's first line, held free by leading em spaces,
                // so the next lines run the full width (16:35: no hanging gap under the id)
                .children(
                    ask.title
                        ? view.askParts(t, s, ask, key)
                        : [
                              view.askLine(t, s, ask, `ask-${key}`),
                              ...(ask.pick
                                  ? [
                                        prose(
                                            `pick-${key}`,
                                            ask.pick,
                                            t.muted,
                                            SIZE.secondary,
                                        ),
                                    ]
                                  : []),
                          ],
                )
                .when(linkOf(ask.link)?.kind === 'web', (el) =>
                    el.child(view.linkLine(t, ask, `link-${key}`)),
                )
                .children(deps.files().view(t, ask, key))
                .children(deps.chipsOf(t, key, isLocked))
                .when(Boolean(ask.id), (el) =>
                    el.child(
                        h_flex()
                            .gap(8)
                            .items_center()
                            .child(
                                button(
                                    'tick',
                                    labels.tick,
                                    state === 'ticked'
                                        ? 'queued for its next turn: click to take it back'
                                        : 'tick: agree',
                                    (cx) =>
                                        cx.spawn((cx) =>
                                            state === 'ticked'
                                                ? deps.unpress(cx, s, ask)
                                                : deps.press(
                                                      cx,
                                                      s,
                                                      ask,
                                                      'tick',
                                                  ),
                                        ),
                                    true,
                                ),
                            )
                            .child(
                                button(
                                    'replay',
                                    labels.replay,
                                    state === 'replayed'
                                        ? 'queued for its next turn: click to take it back'
                                        : 'replay: another round',
                                    (cx) =>
                                        cx.spawn((cx) =>
                                            state === 'replayed'
                                                ? deps.unpress(cx, s, ask)
                                                : deps.press(
                                                      cx,
                                                      s,
                                                      ask,
                                                      'replay',
                                                  ),
                                        ),
                                ),
                            )
                            .when(Boolean(steer), (row) =>
                                row.child(
                                    deps.steerOf(t, key, steerTab, isLocked),
                                ),
                            ),
                    ),
                )
                .when(
                    (deps.keyNotes().get(key)?.until ?? 0) > Date.now(),
                    (el) =>
                        el.child(
                            div()
                                .text_size(SIZE.secondary)
                                .text_color(t.muted)
                                .child(deps.keyNotes().get(key)?.text ?? ''),
                        ),
                )
                // a write that failed says why under its box until his next press
                .when(failed !== null, (el) =>
                    el.child(
                        div()
                            .text_size(SIZE.secondary)
                            .text_color(t.blocked)
                            .child(`⚠️ ${failed}`),
                    ),
                )
                // last, so it lies over the card
                .when(Boolean(ask.title && ask.id), (el) =>
                    el.child(view.idPill(t, s, ask)),
                )
        );
    }

    /** @param {Row} s @param {Ask} ask */
    const pillLabel = (s, ask) =>
        `${deps.updated()?.has(`${s.sid}:${ask.id}`) ? '🆕 ' : ''}${ask.id ?? ''}`;

    /** the id pill's width as drawn, guessed wide until it is @param {string} key @param {string} label */
    const pillWidth = (key, label) =>
        pillW.get(key) ?? label.length * 0.75 * SIZE.small + 2 * PILL.padX + 2;

    /**
     * an ask in its three parts (FRM-620 slice 7): the title, bold on one line that ends before the id, its body as
     * small markdown, the pick in grey
     * @param {Theme} t @param {Row} s @param {Ask} ask @param {string} key
     */
    function askParts(t, s, ask, key) {
        const title = askTitle({
            ...ask,
            title: askText(ask.title ?? '', home()),
        });
        const inset = titleInset(pillWidth(key, pillLabel(s, ask)));
        const isWhole =
            (titleW.get(key) ?? Number.POSITIVE_INFINITY) <=
            (cardW.get(key) ?? 0) - inset;
        const body = ask.body ? askMarkdown(askText(ask.body, home())) : '';
        return [
            h_flex()
                .w_full()
                .pr(inset)
                .id(`head-${key}`)
                .relative()
                .overflow_hidden()
                .on_size_change((size, cx) => {
                    keepWidth(cardW, key)(size, cx);
                    keepHeight('title')(size, cx);
                })
                // unseen, it tells the title's width: one that fits is text he can select, which ends in no «…»
                .child(
                    div()
                        .id(`title-width-${key}`)
                        .absolute()
                        .top(0)
                        .left(0)
                        .opacity(0)
                        .whitespace_nowrap()
                        .font_bold()
                        .text_size(LOOK.title)
                        .on_size_change(keepWidth(titleW, key))
                        .child(title),
                )
                .child(
                    isWhole
                        ? div()
                              .flex_1()
                              .min_w(0)
                              .overflow_hidden()
                              .whitespace_nowrap()
                              .child(
                                  markdownText(
                                      `title-${key}`,
                                      titleMarkdown(title),
                                      t.foreground,
                                      LOOK.title,
                                  ),
                              )
                        : line(t.foreground, LOOK.title)
                              .id(`title-cut-${key}`)
                              .font_bold()
                              .tooltip(title)
                              .child(title),
                ),
            ...(body
                ? [markdownText(`body-${key}`, body, t.foreground, LOOK.body)]
                : []),
            ...(ask.pick
                ? [
                      markdownText(
                          `pick-${key}`,
                          askMarkdown(askPick(ask.pick)),
                          t.muted,
                          SIZE.secondary,
                      ),
                  ]
                : []),
        ];
    }

    /** the ask's id over the card's top right corner; a click copies it bare, and is no press on the card @param {Theme} t @param {Row} s @param {Ask} ask */
    function idPill(t, s, ask) {
        const key = `${s.sid}:${ask.id}`;
        const label = pillLabel(s, ask);
        const isCopied = copied?.key === key;
        return (
            div()
                .id(`id-${key}`)
                .tab_stop(false)
                .absolute()
                // its middle on the title's
                .top(pillTop(heights))
                .right(PILL.right)
                .px(PILL.padX)
                .rounded(4)
                .border_1()
                .border_color(t.border)
                .bg(t.background)
                .text_size(SIZE.small)
                .text_color(t.muted)
                .cursor_pointer()
                .hover((st) =>
                    st.text_color(t.foreground).border_color(t.accent),
                )
                .tooltip('copy')
                // the ✓ takes the id's own room, so the title beside it does not move
                .when(isCopied, (el) =>
                    el.w(pillWidth(key, label)).text_center(),
                )
                .when(!isCopied, (el) =>
                    el.on_size_change((size, cx) => {
                        keepWidth(pillW, key)(size, cx);
                        keepHeight('pill')(size, cx);
                    }),
                )
                .on_mouse_down('left', (_e, cx) => cx.stop_propagation())
                .on_click((_e, cx) => {
                    cx.stop_propagation();
                    cx.write_to_clipboard(ask.id ?? '');
                    const made = { key };
                    copied = made;
                    cx.notify();
                    cx.timer.after(COPIED_MS, (cx) => {
                        if (copied !== made) return;
                        copied = null;
                        cx.notify();
                    });
                })
                .child(isCopied ? '✓' : label)
        );
    }

    /**
     * the ask's web or app link, one line under its pick: it opens outside; a file link is a button with the others
     * @param {Theme} t @param {Ask} ask @param {string} id
     */
    function linkLine(t, ask, id) {
        const shown = linkOf(ask.link);
        return h_flex()
            .id(id)
            .tab_stop(false)
            .gap(6)
            .items_center()
            .text_size(SIZE.secondary)
            .text_color(t.accent)
            .cursor_pointer()
            .hover((st) => st.underline())
            .on_click((_e, cx) =>
                openWebLink(ask.link ?? '', (url) => cx.open_url(url), exec),
            )
            .child('🔗')
            .child(shown?.label ?? '');
    }

    /** @param {Theme} t @param {Row} s @param {Ask} ask @param {string} id */
    function askLine(t, s, ask, id) {
        if (!ask.id)
            return prose(
                id,
                cardText(askText(ask.text, home())),
                t.foreground,
                SIZE.main,
            );
        const isUpdated = deps.updated()?.has(`${s.sid}:${ask.id}`);
        const label = `${isUpdated ? '🆕 ' : ''}${ask.id}`;
        const width = (labelW.get(id) ?? label.length * 0.62 * SIZE.main) + 6;
        return div()
            .relative()
            .w_full()
            .child(
                prose(
                    id,
                    `${leadingRoom(width, SIZE.main)}${cardText(askText(ask.text, home()))}`,
                    t.foreground,
                    SIZE.main,
                ),
            )
            .child(
                div()
                    .id(`${id}-label`)
                    .absolute()
                    .top(0)
                    .left(0)
                    .font_semibold()
                    .text_size(SIZE.main)
                    .text_color(t.foreground)
                    .on_size_change(keepWidth(labelW, id))
                    .child(label),
            );
    }

    /** a section's heading, the thread its asks come from @param {Theme} t @param {Row} s */
    const senderName = (t, s) =>
        line(t.foreground, SIZE.main).flex_1().font_semibold().child(s.name);

    // look and 🧪 cards from every thread lead (or close, by his setting), then each thread in the agents list's order
    /** @param {Theme} t */
    function orbit(t) {
        const sections = orbitSections(
            deps.rows(),
            /** @type {number[] | null} */ (shared(ORDER_KEY)),
            deps.pin(),
        );
        // only a steer box drawn as a box is a stop: a delivered ask's steer is plain words
        const stops = orbitTabOrder(
            sections,
            (s, ask) =>
                deps.steers().has(`${s.sid}:${ask.id}`) &&
                deps.pressStateOf(s, ask.id) !== 'locked',
        );
        // the render publishes these with the phases' box after them, one Tab loop
        deps.setOrbitStops(stops);
        // built before the cards draw, which read their box's place from it
        deps.setTabAt(new Map(stops.map((id, i) => [id, i + 1])));
        return sections.map((section) => {
            if (section.kind === 'pinned')
                return v_flex().children(
                    section.groups.map(({ asks, row }) =>
                        v_flex()
                            .px(12)
                            .py(4)
                            .gap(8)
                            .child(
                                h_flex()
                                    .items_center()
                                    .child(senderName(t, row)),
                            )
                            .children(asks.map((ask) => view.ask(t, row, ask))),
                    ),
                );
            const s = section.row;
            const canTickAll =
                tickAllTakes(s.asks, (id) => deps.pressStateOf(s, id)).length >
                0;
            return (
                v_flex()
                    .id(`asker-${s.sid}`)
                    .tab_stop(false)
                    .px(12)
                    .py(4)
                    .gap(8)
                    // ⌘⇧K ticks the asker under the pointer
                    .on_hover((isOn) => {
                        if (isOn) deps.setHoverSid(s.sid);
                        else if (deps.hoverSid() === s.sid)
                            deps.setHoverSid(null);
                    })
                    .child(
                        h_flex()
                            .gap(8)
                            .items_center()
                            .child(senderName(t, s))
                            .when(canTickAll, (row) =>
                                row.child(
                                    Button.new(`tick-all-${s.sid}`)
                                        .tab_stop(false)
                                        .h(24)
                                        .px(10)
                                        .flex_none()
                                        .flex()
                                        .items_center()
                                        .rounded(6)
                                        .border_1()
                                        .border_color(t.border)
                                        .bg(t.surface)
                                        .text_size(SIZE.secondary)
                                        .text_color(t.foreground)
                                        .cursor_pointer()
                                        .hover((st) => st.bg(t.hover))
                                        .on_click((_e, cx) =>
                                            cx.spawn((cx) =>
                                                deps.pressAll(cx, s),
                                            ),
                                        )
                                        .gap(6)
                                        .child('🛎️ tick all')
                                        .child(
                                            div()
                                                .text_color(t.muted)
                                                .child('⌘⇧K'),
                                        ),
                                ),
                            ),
                    )
                    .children(section.asks.map((ask) => view.ask(t, s, ask)))
            );
        });
    }

    const view = { ask, askLine, askParts, idPill, linkLine, orbit };
    return view;
}
