// The fleet board: the live sessions from Claude Code's registry with what each waits on and its phases, the open
// orbit asks x-mod-stash keeps on disk, ticked here into each session's ticks file, and each lane's glide card.

import { readdir } from 'fs/promises';
import { Input, InputState, TextView, h_flex, v_flex } from 'gpui-base';
import { View, div } from 'gpui-kit';
import {
    agents,
    exec,
    focused,
    hc,
    home,
    props,
    readTextFile,
    run,
    terminals,
    theme,
    watchFolder,
    writeTextFile,
} from 'herdr';

import {
    asksOf,
    byName,
    currentSid,
    draftOf,
    isBoardOpen,
    isGuardGated,
    literalAngles,
    phasesOf,
    runningPids,
    savePress,
    unbold,
} from './orbit.js';

/** @typedef {import('gpui-kit').Context} Context */
/** @typedef {import('gpui-kit').Color} Color */
/** @typedef {Record<string, Color>} Theme */
/** @typedef {import('./orbit.js').Ask} Ask */
/** @typedef {{ asks: Ask[], context: number | null, model: string | null, name: string, phases: string[], pid: number, sid: string, status: string, taken: number, wait: string | null }} Row */
/** @typedef {{ id?: string, title: string, items?: { text: string }[], current?: number, endedAt?: number }} Lane */

const CLAUDE = `${home()}/.claude`;
const STORE = `${CLAUDE}/plugins/store/x-mod-stash_inline-99d499f0f4e0.json`;
const LANES = `${CLAUDE}/shelf/lanes.json`;
const USAGE = `${CLAUDE}/shelf/cc-usage-window.json`;
const SESSIONS = `${CLAUDE}/sessions`;
const TICKS = `${CLAUDE}/shelf/orbit-ticks`;
const SENT_MS = 2 * 60 * 1000;
// a gated ask's 🛎️ here counts at x-mod-guard only once its fence on the ticks folder is on main (FRM-544 slice 1):
// until then a gated ask keeps «🚦 tick in its pane». the 🛎️ stays a click: a keyed mod command is any shell's
const GATED_TICK = false;

/**
 * @param {string} path
 * @returns {Promise<any>}
 */
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
    const rows = (
        await Promise.all(names.map((f) => json(`${SESSIONS}/${f}`)))
    ).filter((s) => s?.sessionId && s.name);
    // a registry file can outlive its process: only a running pid draws a card, so no press goes to a dead session
    /** @type {Set<number> | null} */
    let live = null;
    try {
        const pids = rows.map((/** @type {{ pid: number }} */ s) => s.pid);
        live = runningPids(
            (await exec('ps', ['-o', 'pid=', '-p', pids.join(',')])).stdout,
        );
    } catch {
        // no answer from ps: every row stays, as before the liveness read
    }
    return rows
        .filter((s) => !live || live.has(s.pid))
        .map(
            /** @returns {Row} */ (s) => {
                const sid = currentSid(store, s.sessionId);
                return {
                    asks: asksOf(store, sid),
                    context: store[`context:${sid}`] ?? null,
                    model: store[`model:${sid}`] ?? null,
                    name: s.name,
                    phases: phasesOf(store, sid),
                    pid: s.pid,
                    sid,
                    status: s.status ?? 'unknown',
                    taken: store[`herdr-read:${sid}`] ?? 0,
                    wait: store[`reply:${sid}`]?.wait ?? null,
                };
            },
        );
}

// a steer he is typing outlives a reload of this mod: localStorage is kept across a copy's restart
/** @param {string} key */
function keptSteer(key) {
    try {
        return localStorage.getItem(`steer:${key}`) ?? '';
    } catch {
        return '';
    }
}
/** @param {string} key @param {string} text */
function keepSteer(key, text) {
    try {
        if (text) localStorage.setItem(`steer:${key}`, text);
        else localStorage.removeItem(`steer:${key}`);
    } catch {}
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
    TextView.markdown(id, literalAngles(markdown))
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
        // a steer box per open ask, made when a read finds the ask: an InputState is never made while drawing
        /** @type {Map<string, import('gpui-base').InputState>} */
        this.steers = new Map();
        // presses written and not yet taken by the session's stash, so a second press waits
        /** @type {Map<string, { verdict: 'tick' | 'replay', at: number }>} */
        this.sent = new Map();
        /** @type {string | null} */
        this.pressError = null;
        /** @type {string | null} */
        this.pressNote = null;
        this.loadedAt = null;
        // a second copy in `view: seat` draws the facts of the seat its tab shows, above the chat view
        this.isSeat = props()?.view === 'seat';
        /** @type {{ address: string | null, pid: number | null }} */
        this.seat = { address: null, pid: null };
        /** @type {number | null} */
        this.week = null;
        if (this.isSeat) cx.timer.every(1000, (cx) => this.follow(cx));
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
                        !changed.some(
                            (p) =>
                                p === LANES ||
                                (this.isSeat && p === USAGE) ||
                                p === folder,
                        )
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
            if (this.isSeat)
                this.week =
                    (await json(USAGE))?.rate_limits?.seven_day
                        ?.used_percentage ?? null;
            this.rows = (await sessions(store)).sort(
                (a, b) =>
                    (RANK[STATE[a.status]] ?? 2) -
                        (RANK[STATE[b.status]] ?? 2) || byName(a.name, b.name),
            );
            this.lanes = lanes.filter((/** @type {Lane} */ l) => !l.endedAt);
            // a press is done once the stash marked its ask or the ask left; one the session never took gives the
            // buttons back after SENT_MS, and a steer box goes with its ask's mark
            /** @param {string} key */
            const askOf = (key) => {
                const [sid, id] = key.split(':');
                return this.rows
                    .find((s) => s.sid === sid)
                    ?.asks.find((a) => a.id === id);
            };
            for (const [key, press] of this.sent) {
                const ask = askOf(key);
                if (!ask || ask.mark || Date.now() - press.at > SENT_MS)
                    this.sent.delete(key);
            }
            for (const key of this.steers.keys()) {
                const ask = askOf(key);
                if (!ask || ask.mark) {
                    this.steers.delete(key);
                    keepSteer(key, '');
                }
            }
            for (const s of this.rows)
                for (const ask of s.asks) {
                    const key = `${s.sid}:${ask.id}`;
                    if (ask.id && !ask.mark && !this.steers.has(key))
                        // herdr documents InputState.new for init or a handler; a refusal here costs the box, never
                        // the reload that redraws the whole board
                        try {
                            const box = InputState.new({
                                placeholder: 'steer…',
                                value: keptSteer(key),
                            });
                            box.on('change', () => keepSteer(key, box.value()));
                            this.steers.set(key, box);
                        } catch (err) {
                            this.pressError = `steer box not made: ${err instanceof Error ? err.message : err}`;
                        }
                }
            this.loadedAt = new Date();
            cx.notify();
        });
    }

    /** @param {Theme} t @param {Row} s @param {number} i */
    session(t, s, i) {
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
                            .on_click((_e, cx) => {
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

    // a click's own cx is the only one valid past an await (herdr's AGENTS.md: never keep a cx), so a press runs as
    // its own task; every failure, a refused mkdir included, lands in the panel, never silently
    /** @param {Context} cx @param {Row} s @param {Ask} ask @param {'tick' | 'replay'} verdict */
    async press(cx, s, ask, verdict) {
        const key = `${s.sid}:${ask.id}`;
        const steer = this.steers.get(key)?.value().trim();
        const at = Date.now();
        this.sent.set(key, { at, verdict });
        this.pressError = null;
        cx.notify();
        try {
            const made = await exec('mkdir', ['-p', TICKS]);
            if (made.code !== 0)
                throw new Error(
                    made.stderr.trim() || `mkdir exited ${made.code}`,
                );
            await savePress(
                { read: readTextFile, write: writeTextFile },
                `${TICKS}/${s.sid}.jsonl`,
                {
                    at,
                    id: ask.id,
                    text: ask.text,
                    verdict,
                    ...(steer ? { steer } : {}),
                },
                s.taken,
            );
            this.steers.delete(key);
            keepSteer(key, '');
        } catch (err) {
            this.sent.delete(key);
            this.pressError = `${ask.id} not sent: ${err instanceof Error ? err.message : err}`;
        }
        cx.notify();
    }

    // a guard-gated ask takes only a 🛎️ press in the seat's own board, the one tick x-mod-guard reads as dima's word:
    // the board focuses the seat's pane and opens `/board` there, so the ask's 🛎️ is on screen; opening a board unlocks
    // nothing, only his 🛎️ does. it refuses rather than type over his draft or into a dialog
    /** @param {Context} cx @param {Row} s @param {Ask} ask */
    async openSeatBoard(cx, s, ask) {
        this.pressError = null;
        this.pressNote = null;
        cx.notify();
        /** @param {string} why */
        const refuse = (why) => {
            this.pressError = `${ask.id}: ${why}`;
            cx.notify();
        };
        try {
            let seat = null;
            for (const { address } of terminals()) {
                const got = await hc(['get', address, '--json']);
                if (got.code === 0 && JSON.parse(got.stdout).pid === s.pid) {
                    seat = JSON.parse(got.stdout);
                    break;
                }
            }
            if (!seat) return refuse('its seat runs outside herdr');
            if (seat.status === 'blocked')
                return refuse('its seat waits on a dialog');
            const screen = await hc(['read', seat.address]);
            if (screen.code !== 0)
                return refuse(
                    screen.stderr.trim() || 'its screen did not read',
                );
            // the chat view hides the terminal: zoo's `views` stack flips to it, as fleet-chatter's own Terminal switch
            // does; a layout with no such stack refuses this one step and stays as it is
            run('pane.focus', { terminal: seat.address });
            try {
                run('layout.select', { child: 'main', stack: 'views' });
            } catch {}
            if (isBoardOpen(screen.stdout)) return;
            const draft = draftOf(screen.stdout);
            if (draft && draft !== '/board')
                return refuse(
                    'its prompt box holds a draft: send or clear it, then 🚦 again',
                );
            // a busy seat queues /board until its turn ends: ctrl+enter would send it now, but it cuts the turn short
            const keys = draft
                ? ['enter']
                : screen.stdout.includes('-- NORMAL --')
                  ? ['i', '/', 'b', 'o', 'a', 'r', 'd', 'enter']
                  : ['/', 'b', 'o', 'a', 'r', 'd', 'enter'];
            const typed = await hc(['keys', seat.address, ...keys]);
            if (typed.code !== 0)
                return refuse(typed.stderr.trim() || '/board not opened');
            if (seat.status === 'working') {
                this.pressNote = `${ask.id}: its board opens when its turn ends, 🛎️ there`;
                cx.notify();
            }
        } catch (err) {
            refuse(err instanceof Error ? err.message : String(err));
        }
    }

    // in the chat view's strip a guarded ask draws no 🚦: it flips his view to the terminal, which the one-click 🛎️
    // replaces once GATED_TICK is on
    /** @param {Theme} t @param {Row} s @param {Ask} ask @param {number} i @param {number} j @param {boolean} [isStrip] */
    ask(t, s, ask, i, j, isStrip = false) {
        const key = `${s.sid}:${ask.id}`;
        const isPaneDoor = !GATED_TICK && isGuardGated(ask.text);
        const sent = this.sent.get(key)?.verdict;
        const steer = this.steers.get(key);
        const done = ask.mark ?? sent;
        /** @param {string} id @param {string} label @param {string} tip @param {(cx: Context) => void} onClick */
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
                .on_click((_e, cx) => onClick(cx))
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
            .when(Boolean(ask.id) && !done, (el) =>
                el.child(
                    h_flex()
                        .pl(20)
                        .gap(6)
                        .items_center()
                        .when(!(isStrip && isPaneDoor), (row) =>
                            row.child(
                                isPaneDoor
                                    ? button(
                                          'seat-board',
                                          '🚦 tick in its pane',
                                          "opens the seat's own board in its terminal, where a 🛎️ tick is the word x-mod-guard reads",
                                          (cx) =>
                                              cx.spawn((cx) =>
                                                  this.openSeatBoard(
                                                      cx,
                                                      s,
                                                      ask,
                                                  ),
                                              ),
                                      )
                                    : button(
                                          'tick',
                                          '🛎️ tick',
                                          'good to go: the session takes the pick',
                                          (cx) =>
                                              cx.spawn((cx) =>
                                                  this.press(
                                                      cx,
                                                      s,
                                                      ask,
                                                      'tick',
                                                  ),
                                              ),
                                      ),
                            ),
                        )
                        .child(
                            button(
                                'replay',
                                '🔁 replay',
                                'another round, with your steer',
                                (cx) =>
                                    cx.spawn((cx) =>
                                        this.press(cx, s, ask, 'replay'),
                                    ),
                            ),
                        )
                        .when(Boolean(steer), (row) =>
                            row.child(
                                div()
                                    .id(`steer-${key}`)
                                    .flex_1()
                                    .min_w(0)
                                    .h(28)
                                    .px(8)
                                    .flex()
                                    .items_center()
                                    .rounded(6)
                                    .border_1()
                                    .border_color(t.border)
                                    .bg(t.background)
                                    .cursor_text()
                                    .tooltip(
                                        'your steer, sent with 🛎️ tick or 🔁 replay',
                                    )
                                    .on_mouse_down('left', (_e, cx) =>
                                        cx.stop_propagation(),
                                    )
                                    .child(
                                        Input.new(steer)
                                            .w_full()
                                            .text_size(SIZE.body)
                                            .text_color(t.foreground),
                                    ),
                            ),
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
            );
    }

    /** @param {Theme} t */
    orbit(t) {
        const owners = this.rows.filter((s) => s.asks.length > 0);
        return owners.map((s, i) =>
            v_flex()
                .px(10)
                .py(4)
                .gap(4)
                .child(line(t.dim, SIZE.meta).child(s.name))
                .children(s.asks.map((ask, j) => this.ask(t, s, ask, i, j))),
        );
    }

    /** @param {Theme} t @param {Lane} l */
    lane(t, l) {
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
            .on_click((_e, cx) => {
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

    // the seat this copy's chat view shows, by fleet-chatter's own rule: its props' terminal, else the shown tab's focused
    // agent, else the one it showed, else the tab's first; a change costs one hc read for its pid, the board rows' key
    /** @param {Context} cx */
    follow(cx) {
        const claude = agents().filter((a) => a.app === 'claude-code');
        const f = focused();
        const mine = props()?.terminal
            ? claude.filter((a) => a.address === props().terminal)
            : claude.filter((a) => a.tab === f?.tab);
        const address =
            (
                mine.find((a) => a.address === (f?.agent ?? f?.terminal)) ??
                mine.find((a) => a.address === this.seat.address) ??
                mine[0]
            )?.address ?? null;
        if (address === this.seat.address) return;
        this.seat = { address, pid: null };
        cx.notify();
        if (!address) return;
        cx.spawn(async (cx) => {
            const got = await hc(['get', address, '--json']);
            if (got.code !== 0 || this.seat.address !== address) return;
            this.seat = { address, pid: JSON.parse(got.stdout).pid ?? null };
            cx.notify();
        });
    }

    /** @param {Theme} t */
    seatView(t) {
        const s = this.rows.find((r) => r.pid === this.seat.pid);
        const state = s ? (STATE[s.status] ?? s.status) : null;
        const fact = (/** @type {string} */ label, /** @type {number} */ pct) =>
            h_flex()
                .flex_none()
                .gap(6)
                .items_center()
                .tooltip(label)
                .child(
                    div()
                        .text_size(SIZE.meta)
                        .text_color(t.dim)
                        .child(label.split(' ')[0]),
                )
                .child(bar(t, pct, 36, pct >= 80 ? t.blocked : t.dim))
                .child(
                    div()
                        .w(32)
                        .text_size(SIZE.meta)
                        .text_color(pct >= 80 ? t.blocked : t.muted)
                        .child(`${Math.round(pct)}%`),
                );
        const asks = s?.asks ?? [];
        // the strip's height is its layout block's, fixed, so the transcript under it never moves: a long ask list
        // scrolls inside it, and the head counts the asks
        return v_flex()
            .id('seat-facts')
            .size_full()
            .px(12)
            .py(6)
            .gap(4)
            .overflow_y_scroll()
            .bg(t.background)
            .child(
                h_flex()
                    .h(20)
                    .gap(14)
                    .items_center()
                    .child(
                        div()
                            .w(7)
                            .h(7)
                            .rounded(4)
                            .flex_none()
                            .bg(
                                state === 'working'
                                    ? t.working
                                    : state === 'blocked'
                                      ? t.blocked
                                      : t.idle,
                            ),
                    )
                    .when(s?.context != null, (el) =>
                        el.child(
                            fact('ctx: how full its context is', s.context),
                        ),
                    )
                    .when(this.week != null, (el) =>
                        el.child(
                            fact('week: the weekly usage spent', this.week),
                        ),
                    )
                    .when(asks.length > 1, (el) =>
                        el.child(
                            div()
                                .flex_none()
                                .text_size(SIZE.meta)
                                .text_color(t.foreground)
                                .child(`🪐 ${asks.length} asks`),
                        ),
                    )
                    .child(
                        line(t.muted, SIZE.meta)
                            .id('seat-wait')
                            .when(Boolean(s?.wait), (el) =>
                                el.tooltip(unbold(s.wait)),
                            )
                            .child(
                                s?.wait
                                    ? `🔭 ${unbold(s.wait)}`
                                    : s
                                      ? ''
                                      : 'no claude seat in this tab',
                            ),
                    ),
            )
            .children(asks.map((ask, j) => this.ask(t, s, ask, 0, j, true)))
            .when(Boolean(this.pressError), (el) =>
                el.child(
                    div()
                        .text_size(SIZE.meta)
                        .text_color(t.blocked)
                        .child(`⚠️ ${this.pressError}`),
                ),
            )
            .when(Boolean(this.pressNote), (el) =>
                el.child(
                    div()
                        .text_size(SIZE.meta)
                        .text_color(t.muted)
                        .child(`⏳ ${this.pressNote}`),
                ),
            );
    }

    render() {
        const t = /** @type {Theme} */ (theme());
        if (this.isSeat) return this.seatView(t);
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
            .children(this.rows.map((s, i) => this.session(t, s, i)))
            .when(asks > 0, (el) =>
                el
                    .child(
                        header(
                            `orbit · ${asks} ${asks === 1 ? 'ask' : 'asks'}`,
                        ),
                    )
                    .children(this.orbit(t))
                    .when(Boolean(this.pressError), (el2) =>
                        el2.child(
                            div()
                                .px(10)
                                .text_size(SIZE.meta)
                                .text_color(t.blocked)
                                .child(`⚠️ ${this.pressError}`),
                        ),
                    )
                    .when(Boolean(this.pressNote), (el2) =>
                        el2.child(
                            div()
                                .px(10)
                                .text_size(SIZE.meta)
                                .text_color(t.muted)
                                .child(`⏳ ${this.pressNote}`),
                        ),
                    ),
            )
            .when(this.lanes.length > 0, (el) =>
                el
                    .child(header(`glide · ${this.lanes.length}`))
                    .children(this.lanes.map((l) => this.lane(t, l))),
            )
            .child(
                div()
                    .px(10)
                    .py(8)
                    .text_size(SIZE.meta)
                    .text_color(t.dim)
                    .child(
                        this.loadedAt
                            ? `read ${[
                                  this.loadedAt.getHours(),
                                  this.loadedAt.getMinutes(),
                                  this.loadedAt.getSeconds(),
                              ]
                                  .map((n) => String(n).padStart(2, '0'))
                                  .join(':')}`
                            : 'reading…',
                    ),
            );
    }
}
