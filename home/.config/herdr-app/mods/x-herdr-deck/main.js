// x-herdr-deck: the live sessions from Claude Code's registry with what each waits on and its phases, the open
// orbit asks x-mod-stash keeps on disk, ticked here into each session's ticks file, and each lane's glide card.

import { readdir } from 'fs/promises';
import { Button, Input, InputState, TextView, h_flex, v_flex } from 'gpui-base';
import { View, div } from 'gpui-kit';
import {
    exec,
    home,
    props,
    readTextFile,
    setShared,
    shared,
    theme,
    watchFolder,
    writeTextFile,
} from 'herdr';

import { rejoin } from './joined.js';
import {
    ORDER_KEY,
    PENDING_MS,
    PRESS_DIR,
    PRESS_FILE,
    THREADS_BEAT_MS,
    THREADS_KEY,
    askLabel,
    asksOf,
    byName,
    dropPress,
    hotOf,
    hotPressLine,
    hotPresses,
    inListOrder,
    isPressSettled,
    literalAngles,
    nextThreads,
    pendingPresses,
    phasesOf,
    pressLabel,
    psStartArgs,
    runningThreads,
    savePress,
    stateOfPid,
    steerKeyPress,
    threadFacts,
    tickAll,
    tickAllTakes,
    tickState,
    untickDoor,
    waitOf,
    withBandPress,
} from './orbit.js';

/** @typedef {import('gpui-kit').Context} Context */
/** @typedef {import('gpui-kit').Color} Color */
/** @typedef {Record<string, Color>} Theme */
/** @typedef {import('./orbit.js').Ask} Ask */
/** @typedef {{ asks: Ask[], context: number | null, hot: { since: number } | null, model: string | null, name: string, pending: Map<string, import('./orbit.js').Press['verdict']>, phases: string[], pid: number, sid: string, status: string, taken: number, wait: string | null }} Row */

/** @typedef {{ id?: string, title: string, items?: { text: string }[], current?: number, endedAt?: number }} Lane */

const CLAUDE = `${home()}/.claude`;
const STATES = `${CLAUDE}/shelf/herdr-state`;
const LANES = `${CLAUDE}/shelf/lanes.json`;
const USAGE = `${CLAUDE}/shelf/cc-usage-window.json`;
const SESSIONS = `${CLAUDE}/sessions`;
const THREADS = `${CLAUDE}/shelf/threads.json`;
const TICKS = `${CLAUDE}/shelf/orbit-ticks`;
const SENT_MS = 2 * 60 * 1000;

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

// each session's state file x-mod-stash writes (`fleet.json` beside them holds the fleet-wide states)
async function states() {
    const names = (
        await readdir(STATES).catch(() => /** @type {string[]} */ ([]))
    ).filter((f) => f.endsWith('.json') && f !== 'fleet.json');
    return Promise.all(names.map((f) => json(`${STATES}/${f}`)));
}

/**
 * @param {any[]} shelf
 * @returns {Promise<Row[]>}
 */
async function sessions(shelf) {
    // one rule, one reader (FRM-570 rule 8): x's thread store names the live threads, a pid kept only while x finds it
    // running on its own start time, so no press goes to a dead session; the status is still cc's, from its registry
    // file. an unreadable store answers null, and the deck keeps its last rows marked stale
    const store = await json(THREADS);
    if (!Array.isArray(store?.threads)) return null;
    const listed = store.threads.filter(
        (/** @type {any} */ t) => t?.pid && t.sessionId && t.name,
    );
    // ps exits 1 when a pid is gone, its stdout still naming the live ones; any other end is no answer, and the deck
    // keeps its last rows marked stale. its start times read in utc and the c locale, the store's own form
    const ps = listed.length
        ? await exec(
              'env',
              psStartArgs(listed.map((/** @type {any} */ t) => t.pid)),
              { timeout: 2000 },
          ).catch(() => null)
        : { code: 0, stdout: '' };
    const running = runningThreads(
        listed,
        ps && (ps.code === 0 || ps.code === 1) ? ps.stdout : null,
    );
    if (!running) return null;
    const rows = await Promise.all(
        running.map(async (/** @type {any} */ t) => ({
            ...t,
            status: (await json(`${SESSIONS}/${t.pid}.json`))?.status,
        })),
    );
    return rows.map(
        /** @returns {Row} */ (s) => {
            const state = stateOfPid(shelf, s.pid);
            const sid = state?.sid ?? s.sessionId;
            return {
                asks: asksOf(state),
                context: state?.ctx ?? null,
                hot: state?.hot ?? null,
                model: state?.model ?? null,
                name: rejoin(s.name),
                pending: new Map(),
                phases: phasesOf(state),
                pid: s.pid,
                sid,
                status: s.status ?? 'unknown',
                taken: state?.taken ?? 0,
                wait: waitOf(s.status ?? 'unknown', state?.wait),
            };
        },
    );
}

// with no key-up seen, a submit this close to the last one is the held key's repeat (his first repeat at 150 ms)
const STEER_KEY_REPEAT_MS = 180;
// a key-down and the submit it makes land this close together
const STEER_DOWN_PAIR_MS = 60;

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
// the system font: herdr's own UI font (Geist) ships one face, so markdown's **bold** drew flat in it
const SANS = '.AppleSystemUIFont';
// one type scale: names and ask text, secondary lines, the smallest anywhere; secondary text is `muted`, never `dim`,
// which reads 2.95:1 on paper's white (muted 5.48:1, 5.07:1 on a card's `raised`)
const SIZE = { main: 15, secondary: 13, small: 12 };

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
// blank room at a line's start, `width` px wide at `size` px text: em spaces, then sixth-of-an-em spaces for the rest;
// both are unicode spaces markdown keeps, where it drops leading ascii ones
/** @param {number} width @param {number} size */
const leadingRoom = (width, size) => {
    const ems = Math.floor(width / size);
    const sixths = Math.ceil(((width - ems * size) * 6) / size);
    return ' '.repeat(ems) + ' '.repeat(sixths);
};

const prose = (id, markdown, color, size) =>
    TextView.markdown(id, literalAngles(markdown))
        .selectable()
        .w_full()
        .text_size(size)
        .text_color(color);

export default class Deck extends View {
    /** @param {unknown} _props @param {Context} cx */
    init(_props, cx) {
        // the thread strip is gone (dima, 20:12: «it eats UI»), its block hidden; a `view: seat` copy herdr still keeps
        // alive draws nothing and reads nothing, so it never runs a second deck. «seat» is the layout's own value in
        // layouts/x-herdr-layout.json: renaming it means a layout edit, never done while a thread holds focus
        /** @type {Map<string, number>} each ask id label's drawn width */
        this.labelW = new Map();
        this.isThread = props()?.view === 'seat';
        if (this.isThread) return;
        /** @type {Row[]} */
        this.rows = [];
        /** @type {Lane[]} */
        this.lanes = [];
        /** @type {Set<string>} */
        this.open = new Set();
        // a steer box per open ask, made when a read finds the ask: an InputState is never made while drawing
        /** @type {Map<string, import('gpui-base').InputState>} */
        this.steers = new Map();
        /** @type {Promise<unknown>} */
        this.writing = Promise.resolve();
        // presses written and not yet taken by the session's stash, so a second press waits
        /** @type {Map<string, { verdict: import('./orbit.js').Press['verdict'], at: number }>} */
        this.sent = new Map();
        // the gated asks a «tick all» passed over, `sid:id`: each says it still needs his own press
        /** @type {Set<string>} */
        this.passedOver = new Set();
        /** @type {number | null} the last ⌘⇧K press seen */
        this.tickAsk = /** @type {number | null} */ (
            shared('deck.tickAll') ?? null
        );
        // his 🔥 presses by sid, drawn until the thread's state file reads them
        /** @type {Map<string, { at: number, on: boolean }>} */
        this.hotPressed = new Map();
        /** @type {Map<string, { at: number, on: boolean }>} */
        this.filePresses = new Map();
        /** @type {string | null} */
        this.pressError = null;
        /** @type {string | null} */
        this.pressNote = null;
        this.loadedAt = null;
        /** @type {number | null} */
        this.week = null;
        cx.timer.every(THREADS_BEAT_MS, (cx) => this.reload(cx));
        this.reload(cx);
        // the press folder too: a 🔥 pressed on the band above a chat draws on its row at once
        for (const folder of [
            SESSIONS,
            STATES,
            `${CLAUDE}/shelf`,
            `${home()}/${PRESS_DIR}`,
        ]) {
            cx.spawn(async (cx) => {
                for (;;) {
                    const changed = await watchFolder(folder);
                    if (
                        folder.endsWith('/shelf') &&
                        !changed.some(
                            (p) => p === LANES || p === USAGE || p === folder,
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
            const shelf = await states();
            const lanes = (await json(LANES))?.lanes ?? [];
            this.filePresses = hotPresses(
                await readTextFile(`${home()}/${PRESS_FILE}`).catch(
                    () => /** @type {string | null} */ (null),
                ),
            );
            this.week =
                (await json(USAGE))?.rate_limits?.seven_day?.used_percentage ??
                null;
            const listed = await sessions(shelf);
            this.isStale = listed === null;
            if (listed)
                this.rows = listed.sort(
                    (a, b) =>
                        (RANK[STATE[a.status]] ?? 2) -
                            (RANK[STATE[b.status]] ?? 2) ||
                        byName(a.name, b.name),
                );
            const next = nextThreads(
                /** @type {any} */ (shared(THREADS_KEY)),
                threadFacts(this.rows, this.week),
                Date.now(),
            );
            if (next) setShared(THREADS_KEY, next);
            for (const row of this.rows)
                if (row.asks.length)
                    row.pending = pendingPresses(
                        await readTextFile(`${TICKS}/${row.sid}.jsonl`).catch(
                            () => /** @type {string | null} */ (null),
                        ),
                        row.taken,
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
                const pending = this.rows
                    .find((s) => s.sid === key.split(':')[0])
                    ?.pending.get(ask?.id ?? '');
                if (
                    !ask ||
                    isPressSettled(ask, pending, press.verdict) ||
                    Date.now() - press.at > SENT_MS
                )
                    this.sent.delete(key);
            }
            for (const key of this.steers.keys()) {
                const s = this.rows.find((r) => r.sid === key.split(':')[0]);
                const ask = askOf(key);
                // his steer stays, stored and shown, until the ask leaves (dima, 21:03)
                if (!s || !ask) {
                    this.steers.delete(key);
                    keepSteer(key, '');
                }
            }
            for (const s of this.rows)
                for (const ask of s.asks) {
                    const key = `${s.sid}:${ask.id}`;
                    if (ask.id && !this.steers.has(key))
                        // herdr documents InputState.new for init or a handler; a refusal here costs the box, never
                        // the reload that redraws the whole deck
                        this.makeSteerBox(key);
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
            .px(12)
            .py(4)
            .gap(2)
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
                            SIZE.main,
                        ).child(s.name),
                    )
                    // 🔥 before the model, one aligned column down the rows, as the old desktop list had it (dima,
                    // 23:22): the model and the meter keep their width on a row that has neither
                    .child(this.hotButton(t, s))
                    .child(
                        div()
                            .w(64)
                            .flex_none()
                            .flex()
                            .justify_end()
                            .text_size(SIZE.secondary)
                            .text_color(t.muted)
                            .child(model ?? ''),
                    )
                    .when(s.context == null, (el) =>
                        el.child(div().w(84).flex_none()),
                    )
                    .when(s.context != null, (el) =>
                        el
                            .child(
                                bar(
                                    t,
                                    s.context,
                                    40,
                                    s.context >= 60 ? t.blocked : t.muted,
                                ),
                            )
                            // a fixed width and right-aligned digits stand in for tabular-nums, which gpui does not offer
                            .child(
                                div()
                                    .w(36)
                                    .flex_none()
                                    .flex()
                                    .justify_end()
                                    .text_size(SIZE.secondary)
                                    .when(s.context >= 60, (el2) =>
                                        el2.font_semibold(),
                                    )
                                    .text_color(
                                        s.context >= 60 ? t.blocked : t.muted,
                                    )
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
                                    SIZE.secondary,
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
                                SIZE.secondary,
                            ),
                        ),
                ),
            );
    }

    // keep hot for this row's thread, as the old desktop board had it (dima, 23:16): filled when on, a click is its
    // own, never the row's phases toggle
    /** @param {Theme} t @param {Row} s */
    hotButton(t, s) {
        // the newest press for this thread, its own click or one from any band
        const own = this.hotPressed.get(s.sid);
        const filed = this.filePresses?.get(s.sid);
        const hot = hotOf(
            s.hot,
            own && (!filed || own.at >= filed.at) ? own : filed,
            Date.now(),
        );
        return Button.new(`hot-${s.sid}`)
            .size(22)
            .flex_none()
            .flex()
            .items_center()
            .justify_center()
            .rounded(11)
            .border_1()
            .border_color(hot.isOn ? t.solid : t.border)
            .bg(hot.isOn ? t.solid : t.surface)
            .text_size(SIZE.small)
            .tooltip(hot.tip)
            .cursor_pointer()
            .hover((st) => st.opacity(0.85))
            .on_mouse_down('left', (_e, cx) => cx.stop_propagation())
            .on_click((_e, cx) => {
                cx.stop_propagation();
                this.pressHot(cx, s.sid, !hot.isOn);
            })
            .child('🔥');
    }

    /** @param {Context} cx @param {string} sid @param {boolean} on */
    pressHot(cx, sid, on) {
        const at = Date.now();
        this.hotPressed.set(sid, { at, on });
        cx.notify();
        const line = hotPressLine(sid, on, at);
        cx.spawn(async (cx) => {
            try {
                const made = await exec('mkdir', [
                    '-p',
                    `${home()}/${PRESS_DIR}`,
                ]);
                if (made.code !== 0)
                    throw new Error(made.stderr.trim() || 'mkdir failed');
                const path = `${home()}/${PRESS_FILE}`;
                for (let tries = 2; ; tries--) {
                    const text = await readTextFile(path).catch(
                        () => /** @type {string | null} */ (null),
                    );
                    try {
                        await writeTextFile(
                            path,
                            withBandPress(text, line, at),
                            text,
                        );
                        break;
                    } catch (err) {
                        if (tries <= 1) throw err;
                    }
                }
                this.pressError = null;
            } catch (err) {
                this.hotPressed.delete(sid);
                this.pressError = `keep hot not written: ${err instanceof Error ? err.message : err}`;
            }
            cx.notify();
            // the button gives its state back if the thread never answers
            cx.timer.after(PENDING_MS + 1000, (cx) => cx.notify());
        });
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
            await this.inTurn(() =>
                savePress(
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
                ),
            );
        } catch (err) {
            if (this.sent.get(key)?.at === at) this.sent.delete(key);
            this.pressError = `${ask.id} not sent: ${err instanceof Error ? err.message : err}`;
        }
        cx.notify();
    }

    // «tick all» (FRM-589): every open, ungated ask of one thread in one write; the asks draw ticked at once, and a
    // failure takes them back and lands in the panel
    /** @param {Context} cx @param {Row} s */
    async pressAll(cx, s) {
        const at = Date.now();
        // read before the asks draw ticked below, or the write would find nothing left to take
        const was = new Map(
            s.asks.map((a) => [
                a.id,
                this.sent.get(`${s.sid}:${a.id}`)?.verdict ??
                    s.pending.get(a.id ?? ''),
            ]),
        );
        const sentOf = (/** @type {string} */ id) => was.get(id);
        const takes = tickAllTakes(s.asks, sentOf);
        for (const a of takes)
            this.sent.set(`${s.sid}:${a.id}`, { at, verdict: 'tick' });
        if (takes.length > 0)
            for (const a of s.asks)
                if (a.isGated) this.passedOver.add(`${s.sid}:${a.id}`);
        this.pressError = null;
        cx.notify();
        try {
            const made = await exec('mkdir', ['-p', TICKS]);
            if (made.code !== 0)
                throw new Error(
                    made.stderr.trim() || `mkdir exited ${made.code}`,
                );
            await this.inTurn(() =>
                tickAll(
                    { read: readTextFile, write: writeTextFile },
                    TICKS,
                    [s],
                    s.sid,
                    sentOf,
                    (id) => this.steers.get(`${s.sid}:${id}`)?.value(),
                    at,
                ),
            );
        } catch (err) {
            for (const a of takes) this.sent.delete(`${s.sid}:${a.id}`);
            this.pressError = `tick all not sent: ${err instanceof Error ? err.message : err}`;
        }
        cx.notify();
    }

    // the ticks files are written one at a time: two presses in flight would each read the file before the other's
    // write, and herdr refuses the second (it writes only over the text it read), so the press flipped back. one retry
    // covers a write the stash slipped in between
    /** @template T @param {() => Promise<T>} write @returns {Promise<T>} */
    inTurn(write) {
        const run = this.writing
            .catch(() => {})
            .then(() => write().catch(() => write()));
        this.writing = run;
        return run;
    }

    /** @param {string} key */
    makeSteerBox(key) {
        try {
            const box = InputState.new({
                placeholder: 'steer…',
                value: keptSteer(key),
            });
            box.on('change', () => keepSteer(key, box.value()));
            box.on('submit', (e, cx) =>
                this.steerKey(cx, key, Boolean(e.secondary)),
            );
            this.steers.set(key, box);
        } catch (err) {
            this.pressError = `steer box not made: ${err instanceof Error ? err.message : err}`;
        }
    }

    // Enter in a steer box is 🛎️, cmd-enter 🔁, as the buttons beside it (steerKeyPress); a held key's repeats act once
    /** @param {Context} cx @param {string} key @param {boolean} isCmd */
    steerKey(cx, key, isCmd) {
        const at = Date.now();
        // a beat later, so the key-down of this very press has landed whichever way herdr orders the two
        cx.timer.after(1, (cx) => this.steerKeyAct(cx, key, isCmd, at));
    }

    // the key-down's own held flag says a repeat, exactly, ⌘ down or not; with none seen, a key-up or a gap does
    /** @param {Context} cx @param {string} key @param {boolean} isCmd @param {number} at */
    steerKeyAct(cx, key, isCmd, at) {
        const down = this.steerDown;
        const isRepeat =
            down && Math.abs(at - down.at) < STEER_DOWN_PAIR_MS
                ? down.isHeld
                : !this.isSteerKeyUp &&
                  at - (this.steerKeyAt ?? 0) < STEER_KEY_REPEAT_MS;
        this.steerKeyAt = at;
        if (isRepeat) return;
        this.isSteerKeyUp = false;
        for (const s of this.rows)
            for (const ask of s.asks) {
                if (`${s.sid}:${ask.id}` !== key) continue;
                const sent =
                    this.sent.get(key)?.verdict ?? s.pending.get(ask.id);
                const act = steerKeyPress(
                    tickState(ask, sent),
                    isCmd,
                    Boolean(ask.isGated),
                );
                if (act === 'untick')
                    cx.spawn((cx) => this.unpress(cx, s, ask));
                else if (act) cx.spawn((cx) => this.press(cx, s, ask, act));
                return;
            }
    }

    // his second click on a ticked or replayed ask takes it back until a turn took it: a press the stash has not read
    // leaves the ticks file, one it has read gets an untick line (untickDoor), which the stash answers by dropping the
    // mark (x-mod-stash hooks/orbit.ts herdrTicks)
    /** @param {Context} cx @param {Row} s @param {Ask} ask */
    async unpress(cx, s, ask) {
        const key = `${s.sid}:${ask.id}`;
        // the steer box comes back with the tick button, at once, never at the next poll
        if (!this.steers.has(key)) this.makeSteerBox(key);
        const io = { read: readTextFile, write: writeTextFile };
        const path = `${TICKS}/${s.sid}.jsonl`;
        this.pressError = null;
        // drawn open at once, before the write: the ticks file's last read may still hold the press
        const at = Date.now();
        const isDrop = untickDoor(s.pending.get(ask.id), ask.mark) === 'drop';
        this.sent.set(key, { at, verdict: 'untick' });
        cx.notify();
        try {
            await this.inTurn(() =>
                isDrop
                    ? dropPress(io, path, ask.id, s.taken)
                    : savePress(
                          io,
                          path,
                          { at, id: ask.id, text: ask.text, verdict: 'untick' },
                          s.taken,
                      ),
            );
        } catch (err) {
            if (this.sent.get(key)?.at === at) this.sent.delete(key);
            this.pressError = `${ask.id} not unticked: ${err instanceof Error ? err.message : err}`;
        }
        cx.notify();
    }

    // a gated ask (the stash marks it: a sign, a ⚠️, a merge, a quoted command) takes the same 🛎️: his click writes the
    // press only his click writes, and x-mod-guard reads it as his word for that ask, once (FRM-544). a click, never a key:
    // a keyed mod command is any shell's
    /** @param {Theme} t @param {Row} s @param {Ask} ask @param {number} i @param {number} j */
    ask(t, s, ask, i, j) {
        const key = `${s.sid}:${ask.id}`;
        const sent = this.sent.get(key)?.verdict ?? s.pending.get(ask.id);
        const steer = this.steers.get(key);
        const state = tickState(ask, sent);
        const isLocked = state === 'locked';
        const labels = pressLabel(state, ask.mark);
        // tick is the main act, so it is the one filled button
        /** @param {string} id @param {string} label @param {string} tip @param {(cx: Context) => void} onClick @param {boolean} [isPrimary] */
        const button = (id, label, tip, onClick, isPrimary = false) =>
            Button.new(`${id}-${key}`)
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
                // delivered: both stay, still, the taken one reading ✉️ (dima, 21:03)
                .when(isLocked, (el) =>
                    el.opacity(0.6).tooltip('joined: the session took it'),
                )
                .when(!isLocked, (el) =>
                    el
                        .cursor_pointer()
                        .hover((st) =>
                            isPrimary ? st.opacity(0.85) : st.bg(t.hover),
                        )
                        .tooltip(tip)
                        .on_click((_e, cx) => onClick(cx)),
                )
                .child(label);
        // an ask is a card: the section head carries the 🪐, the bold id leads
        return (
            v_flex()
                .p(12)
                .gap(8)
                .rounded(8)
                .bg(t.raised)
                // the id sits outside the selectable text, so a double-click or a drag takes the ask alone (his F4 reads
                // the selection aloud, dima 16:33); it lies over the text's first line, held free by leading em spaces,
                // so the next lines run the full width (16:35: no hanging gap under the id)
                .child(this.askLine(t, s, ask, `ask-${i}-${j}`))
                .when(Boolean(ask.pick), (el) =>
                    el.child(
                        prose(
                            `pick-${i}-${j}`,
                            `pick: ${ask.pick}`,
                            t.muted,
                            SIZE.secondary,
                        ),
                    ),
                )
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
                                        : ask.isGated
                                          ? 'tick: your word for this guarded action, it runs once within 2 h'
                                          : 'tick: good to go, the session takes the pick (Enter in the steer box)',
                                    (cx) =>
                                        cx.spawn((cx) =>
                                            state === 'ticked'
                                                ? this.unpress(cx, s, ask)
                                                : this.press(
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
                                        : 'replay: another round, with your steer (⌘ Enter in the steer box)',
                                    (cx) =>
                                        cx.spawn((cx) =>
                                            state === 'replayed'
                                                ? this.unpress(cx, s, ask)
                                                : this.press(
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
                                    div()
                                        .id(`steer-${key}`)
                                        .flex_1()
                                        .min_w(0)
                                        .h(28)
                                        .px(8)
                                        .flex()
                                        .items_center()
                                        .rounded(6)
                                        .focus((st) =>
                                            st
                                                .border_color(t.accent)
                                                .border_2(),
                                        )
                                        .border_1()
                                        .border_color(t.border)
                                        .bg(t.surface)
                                        .when(isLocked, (el) => el.opacity(0.6))
                                        .when(!isLocked, (el) =>
                                            el.cursor_text(),
                                        )
                                        .on_mouse_down('left', (_e, cx) =>
                                            cx.stop_propagation(),
                                        )
                                        // a let-go key ends a press, so the next Enter acts however soon; ⌘ let go
                                        // ends a cmd-enter, whose Enter key-up macOS never sends
                                        .on_key_down((e) => {
                                            if (e.key === 'enter')
                                                this.steerDown = {
                                                    at: Date.now(),
                                                    isHeld: Boolean(e.is_held),
                                                };
                                        })
                                        .on_key_up((e) => {
                                            if (e.key === 'enter')
                                                this.isSteerKeyUp = true;
                                        })
                                        .on_modifiers_changed((e) => {
                                            if (!e.modifiers.platform)
                                                this.isSteerKeyUp = true;
                                        })
                                        // delivered: the steer stays as words, no longer editable
                                        .child(
                                            isLocked
                                                ? div()
                                                      .w_full()
                                                      .truncate()
                                                      .text_size(SIZE.secondary)
                                                      .text_color(t.muted)
                                                      .child(steer.value())
                                                : Input.new(steer)
                                                      .w_full()
                                                      .text_size(SIZE.secondary)
                                                      .text_color(t.foreground),
                                        ),
                                ),
                            ),
                    ),
                )
                .when(
                    ask.isGated && !isLocked && this.passedOver.has(key),
                    (el) =>
                        el.child(
                            div()
                                .text_size(SIZE.secondary)
                                .text_color(t.muted)
                                .child('needs your own press'),
                        ),
                )
        );
    }

    /** @param {Theme} t @param {Row} s @param {Ask} ask @param {string} id */
    askLine(t, s, ask, id) {
        if (!ask.id) return prose(id, ask.text, t.foreground, SIZE.main);
        const label = askLabel(s.name, ask.id);
        const width =
            (this.labelW.get(label) ?? label.length * 0.62 * SIZE.main) + 6;
        return div()
            .relative()
            .w_full()
            .child(
                prose(
                    id,
                    `${leadingRoom(width, SIZE.main)}${ask.text}`,
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
                    .on_size_change((size, cx) => {
                        if (
                            Math.abs(
                                (this.labelW.get(label) ?? 0) - size.width,
                            ) < 0.5
                        )
                            return;
                        this.labelW.set(label, size.width);
                        cx.notify();
                    })
                    .child(label),
            );
    }

    /** @param {Theme} t @param {Row[]} rows */
    orbit(t, rows) {
        const owners = rows.filter((s) => s.asks.length > 0);
        return owners.map((s, i) => {
            const canTickAll =
                tickAllTakes(
                    s.asks,
                    (id) =>
                        this.sent.get(`${s.sid}:${id}`)?.verdict ??
                        s.pending.get(id),
                ).length > 0;
            return v_flex()
                .px(12)
                .py(4)
                .gap(8)
                .child(
                    h_flex()
                        .gap(8)
                        .items_center()
                        .child(
                            line(t.foreground, SIZE.main)
                                .flex_1()
                                .font_semibold()
                                .child(s.name),
                        )
                        .when(canTickAll, (row) =>
                            row.child(
                                Button.new(`tick-all-${s.sid}`)
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
                                        cx.spawn((cx) => this.pressAll(cx, s)),
                                    )
                                    .gap(6)
                                    .child('🛎️ tick all')
                                    .child(
                                        div().text_color(t.muted).child('⌘⇧K'),
                                    ),
                            ),
                        ),
                )
                .children(s.asks.map((ask, j) => this.ask(t, s, ask, i, j)));
        });
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
                        .text_size(SIZE.secondary)
                        .text_color(i < current ? t.working : t.muted)
                        .child(i < current ? '✓' : i === current ? '▸' : '·'),
                )
                .child(
                    line(i === current ? t.foreground : t.muted, SIZE.secondary)
                        .when(i === current, (el) => el.font_semibold())
                        .child(text),
                );
        return v_flex()
            .id(`lane-${key}`)
            .mx(12)
            .my(4)
            .p(12)
            .gap(8)
            .rounded(8)
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
                    .child(line(t.foreground, SIZE.main).child(`🛼 ${l.title}`))
                    .child(
                        div()
                            .flex_none()
                            .text_size(SIZE.small)
                            .text_color(t.muted)
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
        if (this.isThread) return div();
        // ⌘⇧K (FRM-589): the status bar relays the key, the chat names the thread it shows by pid; a press older than
        // 2 s, or one made before this load, never fires
        const tickAsk = /** @type {number | null} */ (
            shared('deck.tickAll') ?? null
        );
        if (tickAsk !== this.tickAsk) {
            this.tickAsk = tickAsk;
            const pid = /** @type {{ pid?: number } | null} */ (
                shared('chat.shown')
            )?.pid;
            const shown = this.rows.find((r) => r.pid === pid);
            if (shown && tickAsk && Date.now() - tickAsk < 2000)
                cx.spawn((cx) => this.pressAll(cx, shown));
        }
        // his order from the agents list, read at every draw, so a drag there moves the deck at once; the read's own
        // order (blocked, working, then by name) stays for a thread the list does not show
        const rows = inListOrder(
            this.rows,
            /** @type {number[] | null} */ (shared(ORDER_KEY)),
        );
        const busy = this.rows.filter(
            (s) => STATE[s.status] === 'working',
        ).length;
        const asks = this.rows.reduce((n, s) => n + s.asks.length, 0);
        // one head for every section: a hairline above, its emoji, its name and its count in words
        /** @param {string} text */
        const header = (text) =>
            div()
                .mx(12)
                .mt(12)
                .mb(4)
                .pt(8)
                .border_t_1()
                .border_color(t.border)
                .text_size(SIZE.secondary)
                .font_semibold()
                .text_color(t.foreground)
                .child(text);
        /** @param {number} n @param {string} one @param {string} many */
        const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
        return v_flex()
            .id('x-herdr-deck')
            .font_family(SANS)
            .size_full()
            .overflow_y_scroll()
            .bg(t.canvas)
            .child(
                header(
                    `🧵 sessions: ${this.rows.length}${busy ? `, ${busy} working` : ''}${this.isStale ? ' · stale, the last list kept' : ''}`,
                ),
            )
            .children(rows.map((s, i) => this.session(t, s, i)))
            .when(asks > 0, (el) =>
                el
                    .child(
                        header(
                            `🪐 orbit: ${count(asks, 'ask', 'asks')} waiting on you`,
                        ),
                    )
                    .children(this.orbit(t, rows))
                    .when(Boolean(this.pressError), (el2) =>
                        el2.child(
                            div()
                                .px(12)
                                .text_size(SIZE.secondary)
                                .text_color(t.blocked)
                                .child(`⚠️ ${this.pressError}`),
                        ),
                    )
                    .when(Boolean(this.pressNote), (el2) =>
                        el2.child(
                            div()
                                .px(12)
                                .text_size(SIZE.secondary)
                                .text_color(t.muted)
                                .child(`⏳ ${this.pressNote}`),
                        ),
                    ),
            )
            .when(this.lanes.length > 0, (el) =>
                el
                    .child(
                        header(
                            `🛼 glide: ${count(this.lanes.length, 'lane', 'lanes')}`,
                        ),
                    )
                    .children(this.lanes.map((l) => this.lane(t, l))),
            )
            .child(
                div()
                    .px(12)
                    .py(8)
                    .text_size(SIZE.small)
                    .text_color(t.muted)
                    .child(
                        this.loadedAt
                            ? `updated ${[
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
