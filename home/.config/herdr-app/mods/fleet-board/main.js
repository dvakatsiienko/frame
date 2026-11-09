// The fleet board, read-only: the live sessions from Claude Code's registry with what each waits on,
// the open orbit asks x-mod-stash keeps on disk, and each lane's glide card from the shelf.

import { readdir } from 'fs/promises';
import { TextView, h_flex, v_flex } from 'gpui-base';
import { View, div } from 'gpui-kit';
import { home, readTextFile, theme, watchFolder } from 'herdr';

const CLAUDE = `${home()}/.claude`;
const STORE = `${CLAUDE}/plugins/store/x-mod-stash_inline-99d499f0f4e0.json`;
const LANES = `${CLAUDE}/shelf/lanes.json`;
const SESSIONS = `${CLAUDE}/sessions`;

async function json(path) {
    try {
        return JSON.parse((await readTextFile(path)) ?? 'null');
    } catch {
        return null;
    }
}

async function sessions(store) {
    const names = (await readdir(SESSIONS).catch(() => [])).filter((f) =>
        f.endsWith('.json'),
    );
    const rows = await Promise.all(names.map((f) => json(`${SESSIONS}/${f}`)));
    return rows
        .filter((s) => s?.sessionId && s.name)
        .map((s) => ({
            asks: store[`asks:${s.sessionId}`]?.asks ?? [],
            context: store[`context:${s.sessionId}`] ?? null,
            model: store[`model:${s.sessionId}`] ?? null,
            name: s.name,
            status: s.status ?? 'unknown',
            wait: store[`reply:${s.sessionId}`]?.wait ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

const STATE = {
    blocked: 'blocked',
    busy: 'working',
    idle: 'idle',
    working: 'working',
};
const RANK = { blocked: 0, working: 1 };
const SIZE = { body: 13, header: 12, meta: 12, name: 14 };

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
const prose = (id, markdown, color, size) =>
    TextView.markdown(id, markdown)
        .selectable()
        .w_full()
        .text_size(size)
        .text_color(color);

export default class FleetBoard extends View {
    init(_props, cx) {
        this.rows = [];
        this.lanes = [];
        this.open = new Set();
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
            this.lanes = lanes.filter((l) => !l.endedAt);
            this.loadedAt = new Date();
            cx.notify();
        });
    }

    session(t, s, i) {
        const state = STATE[s.status] ?? s.status;
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
                    .gap(8)
                    .items_center()
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

    orbit(t) {
        const owners = this.rows.filter((s) => s.asks.length > 0);
        return owners.map((s, i) =>
            v_flex()
                .px(10)
                .py(4)
                .gap(2)
                .child(line(t.dim, SIZE.meta).child(s.name))
                .children(
                    s.asks.map((ask, j) =>
                        div()
                            .pl(8)
                            .child(
                                prose(
                                    `ask-${i}-${j}`,
                                    `🪐 ${ask}`,
                                    t.foreground,
                                    SIZE.body,
                                ),
                            ),
                    ),
                ),
        );
    }

    lane(t, l, cx) {
        const items = l.items ?? [];
        const current = Math.min(l.current ?? 0, items.length);
        const key = l.id ?? l.title;
        const open = this.open.has(key);
        const now = items[current];
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

    render(cx) {
        const t = theme();
        const busy = this.rows.filter(
            (s) => STATE[s.status] === 'working',
        ).length;
        const asks = this.rows.reduce((n, s) => n + s.asks.length, 0);
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
            .children(this.rows.map((s, i) => this.session(t, s, i)))
            .when(asks > 0, (el) =>
                el
                    .child(header(`orbit · ${asks} asks`))
                    .children(this.orbit(t)),
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
