// The fleet board: the live sessions from Claude Code's registry with what each waits on and its phases, the open
// orbit asks x-mod-stash keeps on disk, ticked here into each session's ticks file, and each lane's glide card.

import { readdir } from 'fs/promises';
import { Input, InputState, TextView, h_flex, v_flex } from 'gpui-base';
import { View, div } from 'gpui-kit';
import {
    exec,
    home,
    readTextFile,
    theme,
    watchFolder,
    writeTextFile,
} from 'herdr';

import { asksOf, phasesOf, savePress } from './orbit.js';

/** @typedef {import('gpui-kit').Context} Context */
/** @typedef {import('gpui-kit').Color} Color */
/** @typedef {Record<string, Color>} Theme */
/** @typedef {import('./orbit.js').Ask} Ask */
/** @typedef {{ asks: Ask[], context: number | null, model: string | null, name: string, phases: string[], sid: string, status: string, wait: string | null }} Row */
/** @typedef {{ id?: string, title: string, items?: { text: string }[], current?: number, endedAt?: number }} Lane */

const CLAUDE = `${home()}/.claude`;
const STORE = `${CLAUDE}/plugins/store/x-mod-stash_inline-99d499f0f4e0.json`;
const LANES = `${CLAUDE}/shelf/lanes.json`;
const SESSIONS = `${CLAUDE}/sessions`;
const TICKS = `${CLAUDE}/shelf/orbit-ticks`;

/** @param {string} path */
async function json(path) {
    try {
        return JSON.parse((await readTextFile(path)) ?? 'null');
    } catch {
        return null;
    }
}

/**
 * @param {Record<string, any>} store
 * @returns {Promise<Row[]>}
 */
async function sessions(store) {
    const names = (
        await readdir(SESSIONS).catch(() => /** @type {string[]} */ ([]))
    ).filter((f) => f.endsWith('.json'));
    const rows = await Promise.all(names.map((f) => json(`${SESSIONS}/${f}`)));
    return rows
        .filter((s) => s?.sessionId && s.name)
        .map((s) => ({
            asks: asksOf(store, s.sessionId),
            context: store[`context:${s.sessionId}`] ?? null,
            model: store[`model:${s.sessionId}`] ?? null,
            name: s.name,
            phases: phasesOf(store, s.sessionId),
            sid: s.sessionId,
            status: s.status ?? 'unknown',
            wait: store[`reply:${s.sessionId}`]?.wait ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** @type {Record<string, string>} */
const STATE = {
    blocked: 'blocked',
    busy: 'working',
    idle: 'idle',
    working: 'working',
};
/** @type {Record<string, number>} */
const RANK = { blocked: 0, working: 1 };
const SIZE = { body: 13, header: 12, meta: 12, name: 14 };

/**
 * @param {Theme} t
 * @param {number} pct
 * @param {number | `${number}%`} width
 * @param {Color} color
 */
function bar(t, pct, width, color) {
    const fill = Math.max(0, Math.min(100, Math.round(pct)));
    return div()
        .w(width)
        .h(4)
        .flex_none()
        .rounded(2)
        .bg(t.border)
        .child(div().w(`${fill}%`).h(4).rounded(2).bg(color));
}

/** @param {Color} color @param {number} size */
const line = (color, size) =>
    div()
        .flex_1()
        .min_w(0)
        .overflow_hidden()
        .whitespace_nowrap()
        .text_ellipsis()
        .text_size(size)
        .text_color(color);

// TextView is the one element whose text can be selected, so anything worth reading aloud goes through it.
/** @param {string} id @param {string} markdown @param {Color} color @param {number} size */
const prose = (id, markdown, color, size) =>
    TextView.markdown(id, markdown)
        .selectable()
        .w_full()
        .text_size(size)
        .text_color(color);

export default class FleetBoard extends View {
    /** @param {unknown} _props @param {Context} cx */
    init(_props, cx) {
        /** @type {Row[]} */
        this.rows = [];
        /** @type {Lane[]} */
        this.lanes = [];
        /** @type {Set<string>} */
        this.open = new Set();
        // a steer box per ask, made on its ✏️ press: an InputState is never made while drawing
        /** @type {Map<string, import('gpui-base').InputState>} */
        this.steers = new Map();
        // presses written and not yet taken by the session's stash, so a second press waits
        /** @type {Map<string, 'tick' | 'replay'>} */
        this.sent = new Map();
        /** @type {string | null} */
        this.pressError = null;
        this.loadedAt = null;
        this.reload(cx);
        for (const folder of [
            SESSIONS,
            `${CLAUDE}/plugins/store`,
            `${CLAUDE}/shelf`,
        ]) {
            cx.spawn(async (cx) => {
                for (;;) {
                    const changed = await watchFolder(folder);
                    if (
                        folder.endsWith('/shelf') &&
                        !changed.some((p) => p === LANES || p === folder)
                    )
                        continue;
                    this.reload(cx);
                }
            });
        }
    }

    /** @param {Context} cx */
    reload(cx) {
        cx.spawn(async (cx) => {
            const store = (await json(STORE)) ?? {};
            const lanes = (await json(LANES))?.lanes ?? [];
            this.rows = (await sessions(store)).sort(
                (a, b) =>
                    (RANK[STATE[a.status]] ?? 2) -
                        (RANK[STATE[b.status]] ?? 2) ||
                    a.name.localeCompare(b.name),
            );
            this.lanes = lanes.filter((/** @type {Lane} */ l) => !l.endedAt);
            // a press is done once the stash marked its ask, or the ask left
            for (const key of this.sent.keys()) {
                const [sid, id] = key.split(':');
                const ask = this.rows
                    .find((s) => s.sid === sid)
                    ?.asks.find((a) => a.id === id);
                if (!ask || ask.mark) this.sent.delete(key);
            }
            this.loadedAt = new Date();
            cx.notify();
        });
    }

    /** @param {Theme} t @param {Row} s @param {number} i @param {Context} cx */
    session(t, s, i, cx) {
        const state = STATE[s.status] ?? s.status;
        const key = `phases:${s.sid}`;
        const isOpen = this.open.has(key);
        const color =
            state === 'working'
                ? t.working
                : state === 'blocked'
                  ? t.blocked
                  : t.idle;
        const model = s.model?.split(' · ')[0] ?? null;
        return v_flex()
            .px(10)
            .py(4)
            .gap(1)
            .child(
                h_flex()
                    .id(`row-${s.sid}`)
                    .gap(8)
                    .items_center()
                    .when(s.phases.length > 0, (el) =>
                        el
                            .cursor_pointer()
                            .tooltip(
                                isOpen ? 'hide its phases' : 'show its phases',
                            )
                            .on_click(() => {
                                isOpen
                                    ? this.open.delete(key)
                                    : this.open.add(key);
                                cx.notify();
                            }),
                    )
                    .child(div().w(7).h(7).rounded(4).flex_none().bg(color))
                    .child(
                        line(
                            state === 'idle' ? t.muted : t.foreground,
                            SIZE.name,
                        ).child(s.name),
                    )
                    .when(Boolean(model), (el) =>
                        el.child(
                            div()
                                .flex_none()
                                .text_size(SIZE.meta)
                                .text_color(t.dim)
                                .child(model),
                        ),
                    )
                    .when(s.context != null, (el) =>
                        el
                            .child(
                                bar(
                                    t,
                                    s.context,
                                    28,
                                    s.context >= 60 ? t.blocked : t.dim,
                                ),
                            )
                            .child(
                                div()
                                    .w(30)
                                    .flex_none()
                                    .text_size(SIZE.meta)
                                    .text_color(t.dim)
                                    .child(`${s.context}%`),
                            ),
                    ),
            )
            .when(isOpen, (el) =>
                el.children(
                    s.phases.map((phase, j) =>
                        div()
                            .pl(15)
                            .child(
                                prose(
                                    `phase-${i}-${j}`,
                                    `🌔 ${phase}`,
                                    t.muted,
                                    SIZE.body,
                                ),
                            ),
                    ),
                ),
            )
            .when(Boolean(s.wait), (el) =>
                el.child(
                    div()
                        .pl(15)
                        .child(
                            prose(
                                `wait-${i}`,
                                `🔭 ${s.wait}`,
                                t.muted,
                                SIZE.body,
                            ),
                        ),
                ),
            );
    }

    /** @param {Context} cx @param {Row} s @param {Ask} ask @param {'tick' | 'replay'} verdict */
    async press(cx, s, ask, verdict) {
        const key = `${s.sid}:${ask.id}`;
        const steer = this.steers.get(key)?.value().trim();
        const at = Date.now();
        this.sent.set(key, verdict);
        this.pressError = null;
        cx.notify();
        try {
            await exec('mkdir', ['-p', TICKS]);
            await savePress(
                { read: readTextFile, write: writeTextFile },
                `${TICKS}/${s.sid}.jsonl`,
                { at, id: ask.id, verdict, ...(steer ? { steer } : {}) },
                s.asks.map((a) => a.id).filter(Boolean),
            );
            this.steers.delete(key);
        } catch (err) {
            this.sent.delete(key);
            this.pressError = `${ask.id} not sent: ${err instanceof Error ? err.message : err}`;
        }
        cx.notify();
    }

    /** @param {Theme} t @param {Row} s @param {Ask} ask @param {number} i @param {number} j @param {Context} cx */
    ask(t, s, ask, i, j, cx) {
        const key = `${s.sid}:${ask.id}`;
        const sent = this.sent.get(key);
        const steer = this.steers.get(key);
        const done = ask.mark ?? sent;
        /** @param {string} id @param {string} label @param {string} tip @param {() => void} onClick */
        const button = (id, label, tip, onClick) =>
            div()
                .id(`${id}-${key}`)
                .px(8)
                .py(2)
                .rounded(4)
                .border_1()
                .border_color(t.border)
                .text_size(SIZE.meta)
                .text_color(t.foreground)
                .cursor_pointer()
                .hover((st) => st.bg(t.hover))
                .tooltip(tip)
                .on_click(onClick)
                .child(label);
        return v_flex()
            .pl(8)
            .gap(2)
            .child(
                prose(
                    `ask-${i}-${j}`,
                    `🪐 ${ask.text}`,
                    t.foreground,
                    SIZE.body,
                ),
            )
            .when(Boolean(ask.pick), (el) =>
                el.child(
                    div()
                        .pl(20)
                        .child(
                            prose(
                                `pick-${i}-${j}`,
                                `pick: ${ask.pick}`,
                                t.muted,
                                SIZE.meta,
                            ),
                        ),
                ),
            )
            .when(Boolean(ask.id) && !ask.isLocked && !done, (el) =>
                el
                    .child(
                        h_flex()
                            .pl(20)
                            .gap(6)
                            .child(
                                button(
                                    'tick',
                                    '🛎️ tick',
                                    'good to go: the session takes the pick',
                                    () => this.press(cx, s, ask, 'tick'),
                                ),
                            )
                            .child(
                                button(
                                    'replay',
                                    '🔁 replay',
                                    'another round, with your steer',
                                    () => this.press(cx, s, ask, 'replay'),
                                ),
                            )
                            .when(!steer, (row) =>
                                row.child(
                                    button(
                                        'steer',
                                        '✏️ steer',
                                        'add a steer to send with the press',
                                        () => {
                                            const box = InputState.new({
                                                placeholder:
                                                    'your steer, sent with the press',
                                            });
                                            this.steers.set(key, box);
                                            box.focus();
                                            cx.notify();
                                        },
                                    ),
                                ),
                            ),
                    )
                    .when(Boolean(steer), (el) =>
                        el.child(
                            div()
                                .pl(20)
                                .child(Input.new(steer).text_size(SIZE.body)),
                        ),
                    ),
            )
            .when(Boolean(done), (el) =>
                el.child(
                    div()
                        .pl(20)
                        .text_size(SIZE.meta)
                        .text_color(t.dim)
                        .child(
                            ask.mark === 'accepted' ||
                                (!ask.mark && sent === 'tick')
                                ? `🛎️ ticked${ask.mark ? '' : ', waiting for the session'}`
                                : `🔁 replay${ask.mark ? '' : ', waiting for the session'}`,
                        ),
                ),
            )
            .when(ask.isLocked && !done, (el) =>
                el.child(
                    div()
                        .pl(20)
                        .text_size(SIZE.meta)
                        .text_color(t.dim)
                        .child('🔒 its turn is running'),
                ),
            );
    }

    /** @param {Theme} t @param {Context} cx */
    orbit(t, cx) {
        const owners = this.rows.filter((s) => s.asks.length > 0);
        return owners.map((s, i) =>
            v_flex()
                .px(10)
                .py(4)
                .gap(4)
                .child(line(t.dim, SIZE.meta).child(s.name))
                .children(
                    s.asks.map((ask, j) => this.ask(t, s, ask, i, j, cx)),
                ),
        );
    }

    /** @param {Theme} t @param {Lane} l @param {Context} cx */
    lane(t, l, cx) {
        const items = l.items ?? [];
        const current = Math.min(l.current ?? 0, items.length);
        const key = l.id ?? l.title;
        const open = this.open.has(key);
        const now = items[current];
        /** @param {string} text @param {number} i */
        const step = (text, i) =>
            h_flex()
                .gap(6)
                .child(
                    div()
                        .w(12)
                        .flex_none()
                        .text_size(SIZE.body)
                        .text_color(i < current ? t.working : t.dim)
                        .child(i < current ? '✓' : i === current ? '▸' : '·'),
                )
                .child(
                    line(
                        i === current ? t.foreground : t.muted,
                        SIZE.body,
                    ).child(text),
                );
        return v_flex()
            .id(`lane-${key}`)
            .mx(10)
            .my(3)
            .px(8)
            .py(6)
            .gap(4)
            .rounded(6)
            .border_1()
            .border_color(t.border)
            .cursor_pointer()
            .hover((st) => st.bg(t.hover))
            .tooltip(open ? 'collapse' : 'show every step')
            .on_click(() => {
                open ? this.open.delete(key) : this.open.add(key);
                cx.notify();
            })
            .child(
                h_flex()
                    .gap(8)
                    .items_center()
                    .child(line(t.foreground, SIZE.name).child(`🛼 ${l.title}`))
                    .child(
                        div()
                            .flex_none()
                            .text_size(SIZE.meta)
                            .text_color(t.dim)
                            .child(`${current}/${items.length}`),
                    ),
            )
            .child(
                div()
                    .w_full()
                    .child(
                        bar(
                            t,
                            items.length ? (100 * current) / items.length : 0,
                            '100%',
                            t.working,
                        ),
                    ),
            )
            .when(open, (el) =>
                el.children(items.map((it, i) => step(it.text, i))),
            )
            .when(!open && Boolean(now), (el) =>
                el.child(step(now.text, current)),
            );
    }

    /** @param {Context} cx */
    render(cx) {
        const t = /** @type {Theme} */ (theme());
        const busy = this.rows.filter(
            (s) => STATE[s.status] === 'working',
        ).length;
        const asks = this.rows.reduce((n, s) => n + s.asks.length, 0);
        /** @param {string} text */
        const header = (text) =>
            div()
                .px(10)
                .pt(12)
                .pb(3)
                .text_size(SIZE.header)
                .text_color(t.dim)
                .child(text);
        return v_flex()
            .id('fleet-board')
            .size_full()
            .overflow_y_scroll()
            .bg(t.background)
            .child(
                header(
                    `sessions · ${this.rows.length}${busy ? ` · ${busy} working` : ''}`,
                ),
            )
            .children(this.rows.map((s, i) => this.session(t, s, i, cx)))
            .when(asks > 0, (el) =>
                el
                    .child(header(`orbit · ${asks} asks`))
                    .children(this.orbit(t, cx))
                    .when(Boolean(this.pressError), (el2) =>
                        el2.child(
                            div()
                                .px(10)
                                .text_size(SIZE.meta)
                                .text_color(t.blocked)
                                .child(`⚠️ ${this.pressError}`),
                        ),
                    ),
            )
            .when(this.lanes.length > 0, (el) =>
                el
                    .child(header(`glide · ${this.lanes.length}`))
                    .children(this.lanes.map((l) => this.lane(t, l, cx))),
            )
            .child(
                div()
                    .px(10)
                    .py(8)
                    .text_size(SIZE.meta)
                    .text_color(t.dim)
                    .child(
                        this.loadedAt
                            ? `read ${this.loadedAt.toLocaleTimeString()}`
                            : 'reading…',
                    ),
            );
    }
}
