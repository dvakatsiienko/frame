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
import { createCmdEnter, createKeyPress } from './keypress.js';
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
    createSerial,
    createTurns,
    dropPress,
    hotOf,
    hotPressLine,
    hotPresses,
    inListOrder,
    linkOf,
    literalAngles,
    nextThreads,
    phasesOf,
    pressLabel,
    psStartArgs,
    runningThreads,
    savePress,
    stateOfPid,
    steerKeyAct,
    threadFacts,
    tickAll,
    tickAllTakes,
    tickAllThread,
    waitOf,
    withBandPress,
    withPending,
} from './orbit.js';
import { SENT_MS, next, pressState, untickDoor } from './press.js';

/** @typedef {import('gpui-kit').Context} Context */
/** @typedef {import('gpui-kit').AsyncContext} AsyncContext */
/** @typedef {import('gpui-kit').Color} Color */
/** @typedef {Record<'accent' | 'background' | 'blocked' | 'border' | 'canvas' | 'dim' | 'foreground' | 'hover' | 'idle' | 'muted' | 'raised' | 'solid' | 'solid_foreground' | 'surface' | 'working', Color>} Theme */
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
 * @returns {Promise<Row[] | null>} null: no answer, the deck keeps its last rows
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

// how long a key that did nothing says why under its steer box
const KEY_NOTE_MS = 3000;
// Enter and ⌘Enter in a steer box are the deck's own actions, ahead of the box's submit (FRM-648 step 111)
const STEER_ENTER = 'x_herdr_deck_steer_enter';
const STEER_CMD_ENTER = 'x_herdr_deck_steer_cmd_enter';
// how long a press given up by time says so: long enough to be seen when he looks back at the board
const GIVEN_UP_NOTE_MS = 30 * 1000;

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
/** blocked threads first, then working, then the rest @param {string} status */
const rankOf = (status) => RANK[STATE[status] ?? ''] ?? 2;
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

// blank room at a line's start, `width` px wide at `size` px text: em spaces, then sixth-of-an-em spaces for the rest;
// both are unicode spaces markdown keeps, where it drops leading ascii ones
/** @param {number} width @param {number} size */
const leadingRoom = (width, size) => {
    const ems = Math.floor(width / size);
    const sixths = Math.ceil(((width - ems * size) * 6) / size);
    return ' '.repeat(ems) + ' '.repeat(sixths);
};

// TextView is the one element whose text can be selected, so anything worth reading aloud goes through it.
/** @param {string} id @param {string} markdown @param {Color} color @param {number} size */
const prose = (id, markdown, color, size) =>
    TextView.markdown(id, literalAngles(markdown))
        .selectable()
        .w_full()
        .text_size(size)
        .text_color(color);

/** a time as HH:MM, or HH:MM:SS with 3 parts @param {Date} at @param {2 | 3} parts */
const clockOf = (at, parts) =>
    [at.getHours(), at.getMinutes(), at.getSeconds()]
        .slice(0, parts)
        .map((n) => String(n).padStart(2, '0'))
        .join(':');

export default class Deck extends View {
    /** the asker under the pointer, which ⌘⇧K ticks first @type {string | null} */
    hoverSid = null;
    /** the asker he clicked last, ringed @type {string | null} */
    pickedSid = null;
    // the ticks files, one write at a time
    turns = createTurns();
    // his presses, one record per ask by `sid:id` (press.js); an in-flight press owns the timer that gives it up
    /** @type {Map<string, import('./press.js').PressRecord>} */
    presses = new Map();
    /** @type {Map<string, import('gpui-kit').Task>} */
    pressTimers = new Map();
    // reloads one at a time, the newest last: an older read never puts a gone ask back
    reloads = createSerial(Date.now);
    // Enter in every steer box, one press at a time: a held key's repeats act once
    steerKeys = createKeyPress();
    steerCmdKeys = createCmdEnter();
    /** @param {unknown} _props @param {Context} cx */
    init(_props, cx) {
        cx.bind_keys([
            {
                action: STEER_ENTER,
                context: 'XDeckSteer > Input',
                keystroke: 'enter',
            },
            {
                action: STEER_CMD_ENTER,
                context: 'XDeckSteer > Input',
                keystroke: 'cmd-enter',
            },
        ]);
        // the thread strip is gone (dima, 20:12: «it eats UI»), its block hidden; a `view: seat` copy herdr still keeps
        // alive draws nothing and reads nothing, so it never runs a second deck. «seat» is the layout's own value in
        // layouts/x-herdr-layout.json: renaming it means a layout edit, never done while a thread holds focus
        /** @type {Map<string, number>} each ask id label's drawn width */
        this.labelW = new Map();
        /** the ask whose linked file shows under it, and that file's text, or why it could not be read @type {{ id: string, text: string | null, problem: string | null } | null} */
        this.linkShown = null;
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
        // the gated asks a «tick all» passed over, `sid:id`: each says it still needs his own press
        /** @type {Set<string>} */
        this.passedOver = new Set();
        /** a key in a steer box that did nothing, and why, by ask key @type {Map<string, { text: string, until: number }>} */
        this.keyNotes = new Map();
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
            await this.reloads(
                (isCurrent) => this.read(isCurrent),
                (ms, fire) => cx.timer.after(ms, () => fire()),
            );
            // drawn once the chain holds the read's end: settled, failed or let go as stalled
            cx.notify();
        });
    }

    /**
     * one read of the shelf, whole: the rows draw only with their presses read; a read the chain let go as stalled
     * changes nothing when it answers late
     * @param {() => boolean} isCurrent
     */
    async read(isCurrent) {
        const shelf = await states();
        const lanes = (await json(LANES))?.lanes ?? [];
        const filePresses = hotPresses(
            await readTextFile(`${home()}/${PRESS_FILE}`).catch(
                () => /** @type {string | null} */ (null),
            ),
        );
        const week =
            (await json(USAGE))?.rate_limits?.seven_day?.used_percentage ??
            null;
        const listed = await sessions(shelf);
        // a stale list keeps its rows, their presses read again all the same
        const rows = await withPending(listed ?? this.rows, (sid) =>
            readTextFile(`${TICKS}/${sid}.jsonl`).catch(
                () => /** @type {string | null} */ (null),
            ),
        );
        if (!isCurrent()) return;
        this.filePresses = filePresses;
        this.week = week;
        this.isStale = listed === null;
        this.rows = !listed
            ? rows
            : rows.sort(
                  (a, b) =>
                      rankOf(a.status) - rankOf(b.status) ||
                      byName(a.name, b.name),
              );
        const next = nextThreads(
            /** @type {any} */ (shared(THREADS_KEY)),
            threadFacts(this.rows, this.week),
            Date.now(),
        );
        if (next) setShared(THREADS_KEY, next);
        this.lanes = lanes.filter((/** @type {Lane} */ l) => !l.endedAt);
        /** @param {string} key */
        const askOf = (key) => {
            const [sid, id] = key.split(':');
            return this.rows
                .find((s) => s.sid === sid)
                ?.asks.find((a) => a.id === id);
        };
        // every ask's press record hears this read; a record whose ask left goes
        const seen = new Set();
        for (const s of this.rows)
            for (const ask of s.asks) {
                const key = `${s.sid}:${ask.id}`;
                seen.add(key);
                this.pressStep(key, {
                    isGone: false,
                    isLocked: ask.isLocked,
                    mark: ask.mark,
                    pending: s.pending.get(ask.id ?? ''),
                    type: 'shelfRead',
                });
            }
        for (const key of [...this.presses.keys()])
            if (!seen.has(key))
                this.pressStep(key, {
                    isGone: true,
                    isLocked: false,
                    mark: null,
                    pending: null,
                    type: 'shelfRead',
                });
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
    }

    /** the footer, from the reload chain's one state */
    footerLine() {
        const chain = this.reloads.state();
        if (chain.settledAt === null) return 'reading…';
        const at = new Date(chain.settledAt);
        return chain.phase === 'stalled'
            ? `no read since ${clockOf(at, 2)}, reading again`
            : `updated ${clockOf(at, 3)}`;
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
        // drawn only when the thread has one
        const context = s.context ?? 0;
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
                                    context,
                                    40,
                                    context >= 60 ? t.blocked : t.muted,
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
                                    .when(context >= 60, (el2) =>
                                        el2.font_semibold(),
                                    )
                                    .text_color(
                                        context >= 60 ? t.blocked : t.muted,
                                    )
                                    .child(`${context}%`),
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

    /** what an ask's press shows, from its one record @param {Row} s @param {string | null} id */
    pressStateOf(s, id) {
        return pressState(this.presses.get(`${s.sid}:${id}`));
    }

    /** one event on an ask's press record; a press that left `local` and `written` takes its timer with it @param {string} key @param {import('./press.js').PressEvent} event */
    pressStep(key, event) {
        const record = next(this.presses.get(key) ?? null, event);
        if (record) this.presses.set(key, record);
        else this.presses.delete(key);
        if (record?.phase !== 'local' && record?.phase !== 'written') {
            this.pressTimers.get(key)?.cancel();
            this.pressTimers.delete(key);
        }
        return record;
    }

    /**
     * his press, drawn at once; one the session never answers in SENT_MS is given up and says so under its box
     * @param {Context | AsyncContext} cx @param {string} key @param {import('./press.js').Verdict} verdict @param {number} at
     */
    pressMade(cx, key, verdict, at) {
        const record = this.pressStep(key, { at, type: 'pressed', verdict });
        if (record?.phase !== 'local') return;
        this.pressTimers.get(key)?.cancel();
        this.pressTimers.set(
            key,
            cx.timer.after(SENT_MS, (later) => {
                this.pressTimers.delete(key);
                if (
                    this.pressStep(key, { at, type: 'timedOut' })?.phase ===
                    'given-up'
                ) {
                    this.keyNotes.set(key, {
                        text: 'No answer in 2 min: press again',
                        until: Date.now() + GIVEN_UP_NOTE_MS,
                    });
                    later.timer.after(GIVEN_UP_NOTE_MS + 1, (l) => l.notify());
                }
                later.notify();
            }),
        );
    }

    // a click's own cx is the only one valid past an await (herdr's AGENTS.md: never keep a cx), so a press runs as
    // its own task; every failure, a refused mkdir included, lands in the panel, never silently
    /** @param {Context} cx @param {Row} s @param {Ask} ask @param {'tick' | 'replay'} verdict */
    async press(cx, s, ask, verdict) {
        const { id } = ask;
        // an ask with no id has no line in the ticks file to name it
        if (!id) return;
        const key = `${s.sid}:${id}`;
        const steer = this.steers.get(key)?.value().trim();
        const at = Date.now();
        this.pressMade(cx, key, verdict, at);
        cx.notify();
        try {
            const made = await exec('mkdir', ['-p', TICKS]);
            if (made.code !== 0)
                throw new Error(
                    made.stderr.trim() || `mkdir exited ${made.code}`,
                );
            await this.turns(() =>
                savePress(
                    { read: readTextFile, write: writeTextFile },
                    `${TICKS}/${s.sid}.jsonl`,
                    {
                        at,
                        id,
                        text: ask.text,
                        verdict,
                        ...(steer ? { steer } : {}),
                    },
                    s.taken,
                ),
            );
            this.pressStep(key, { at, type: 'writeOk' });
        } catch (err) {
            this.pressStep(key, {
                at,
                reason: `not sent: ${err instanceof Error ? err.message : err}`,
                type: 'writeFailed',
            });
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
            s.asks.map((a) => [a.id, this.pressStateOf(s, a.id)]),
        );
        const stateOf = (/** @type {string} */ id) => was.get(id) ?? 'open';
        const takes = tickAllTakes(s.asks, stateOf);
        for (const a of takes)
            this.pressMade(cx, `${s.sid}:${a.id}`, 'tick', at);
        if (takes.length > 0)
            for (const a of s.asks)
                if (a.isGated) this.passedOver.add(`${s.sid}:${a.id}`);
        cx.notify();
        try {
            const made = await exec('mkdir', ['-p', TICKS]);
            if (made.code !== 0)
                throw new Error(
                    made.stderr.trim() || `mkdir exited ${made.code}`,
                );
            await this.turns(() =>
                tickAll(
                    { read: readTextFile, write: writeTextFile },
                    TICKS,
                    [s],
                    s.sid,
                    stateOf,
                    (id) => this.steers.get(`${s.sid}:${id}`)?.value(),
                    at,
                ),
            );
            for (const a of takes)
                this.pressStep(`${s.sid}:${a.id}`, { at, type: 'writeOk' });
        } catch (err) {
            for (const a of takes)
                this.pressStep(`${s.sid}:${a.id}`, {
                    at,
                    reason: `tick all not sent: ${err instanceof Error ? err.message : err}`,
                    type: 'writeFailed',
                });
        }
        cx.notify();
    }

    /** @param {string} key */
    makeSteerBox(key) {
        try {
            const box = InputState.new({
                placeholder: 'steer…',
                value: keptSteer(key),
            });
            box.on('change', () => keepSteer(key, box.value()));
            // Enter and ⌘Enter are the box's own actions (STEER_ENTER), never its submit; focus leaving ends a press
            box.on('blur', () => this.steerKeys.blurred());
            this.steers.set(key, box);
        } catch (err) {
            this.pressError = `steer box not made: ${err instanceof Error ? err.message : err}`;
        }
    }

    // Enter in a steer box is 🛎️, cmd-enter 🔁, as the buttons beside it (steerKeyPress); a held Enter acts once, every
    // ⌘Enter tap acts under a held ⌘ (createCmdEnter)
    /** @param {Context} cx @param {string} key @param {boolean} isCmd */
    steerKeyAct(cx, key, isCmd) {
        const said = isCmd
            ? this.steerCmdKeys.pressed(Date.now())
            : this.steerKeys.pressed();
        if (said === 'repeat') return;
        const step = steerKeyAct(this.rows, key, isCmd, (s, id) =>
            this.pressStateOf(s, id),
        );
        if (!step) return;
        const { act, ask, note, s } = step;
        if (note) {
            this.keyNotes.set(key, {
                text: note,
                until: Date.now() + KEY_NOTE_MS,
            });
            cx.notify();
            cx.timer.after(KEY_NOTE_MS + 1, (later) => later.notify());
        }
        if (act === 'untick') cx.spawn((cx) => this.unpress(cx, s, ask));
        else if (act) cx.spawn((cx) => this.press(cx, s, ask, act));
    }

    // his second click on a ticked or replayed ask takes it back until a turn took it: a press the stash has not read
    // leaves the ticks file, one it has read gets an untick line (untickDoor), which the stash answers by dropping the
    // mark (x-mod-stash hooks/orbit.ts herdrTicks)
    /** @param {Context} cx @param {Row} s @param {Ask} ask */
    async unpress(cx, s, ask) {
        const { id } = ask;
        if (!id) return;
        const key = `${s.sid}:${id}`;
        // the steer box comes back with the tick button, at once, never at the next poll
        if (!this.steers.has(key)) this.makeSteerBox(key);
        const io = { read: readTextFile, write: writeTextFile };
        const path = `${TICKS}/${s.sid}.jsonl`;
        // drawn open at once, before the write: the ticks file's last read may still hold the press
        const at = Date.now();
        const isDrop = untickDoor(this.presses.get(key), ask.mark) === 'drop';
        this.pressMade(cx, key, 'untick', at);
        cx.notify();
        try {
            await this.turns(() =>
                isDrop
                    ? dropPress(io, path, id, s.taken)
                    : savePress(
                          io,
                          path,
                          { at, id, text: ask.text, verdict: 'untick' },
                          s.taken,
                      ),
            );
            this.pressStep(key, { at, type: 'writeOk' });
        } catch (err) {
            this.pressStep(key, {
                at,
                reason: `not unticked: ${err instanceof Error ? err.message : err}`,
                type: 'writeFailed',
            });
        }
        cx.notify();
    }

    // a gated ask (the stash marks it: a sign, a ⚠️, a merge, a quoted command) takes the same 🛎️: his click writes the
    // press only his click writes, and x-mod-guard reads it as his word for that ask, once (FRM-544). a click, never a key:
    // a keyed mod command is any shell's
    /** @param {Theme} t @param {Row} s @param {Ask} ask @param {number} i @param {number} j */
    ask(t, s, ask, i, j) {
        const key = `${s.sid}:${ask.id}`;
        const steer = this.steers.get(key);
        const state = this.pressStateOf(s, ask.id);
        const record = this.presses.get(key);
        const failed =
            record?.phase === 'failed' ? (record.reason ?? '') : null;
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
                // delivered: both stay, still, the taken one reading 😋 (dima, 21:03)
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
                            ask.pick ?? '',
                            t.muted,
                            SIZE.secondary,
                        ),
                    ),
                )
                .when(Boolean(linkOf(ask.link)), (el) =>
                    el.child(this.linkLine(t, ask, `link-${i}-${j}`)),
                )
                .when(Boolean(ask.id) && this.linkShown?.id === ask.id, (el) =>
                    el.child(this.linkPreview(t, `linked-${i}-${j}`)),
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
                                          : 'tick: agree',
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
                                        : 'replay: another round',
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
                                        .key_context('XDeckSteer')
                                        .on_action(STEER_ENTER, (_e, cx) =>
                                            this.steerKeyAct(cx, key, false),
                                        )
                                        .on_action(STEER_CMD_ENTER, (_e, cx) =>
                                            this.steerKeyAct(cx, key, true),
                                        )
                                        // a let-go key ends a press, so the next Enter acts however soon; ⌘ let go
                                        // ends a cmd-enter, whose Enter key-up macOS never sends
                                        .on_key_up((e) => {
                                            if (e.key === 'enter')
                                                this.steerKeys.released();
                                        })
                                        .on_modifiers_changed((e) => {
                                            if (!e.modifiers.platform)
                                                this.steerKeys.modifiersReleased();
                                        })
                                        // delivered: the steer stays as words, no longer editable
                                        .child(
                                            isLocked
                                                ? div()
                                                      .w_full()
                                                      .truncate()
                                                      .text_size(SIZE.secondary)
                                                      .text_color(t.muted)
                                                      .child(
                                                          /** @type {InputState} */ (
                                                              steer
                                                          ).value(),
                                                      )
                                                : Input.new(
                                                      /** @type {InputState} */ (
                                                          steer
                                                      ),
                                                  )
                                                      .w_full()
                                                      .text_size(SIZE.secondary)
                                                      .text_color(t.foreground),
                                        ),
                                ),
                            ),
                    ),
                )
                .when((this.keyNotes.get(key)?.until ?? 0) > Date.now(), (el) =>
                    el.child(
                        div()
                            .text_size(SIZE.secondary)
                            .text_color(t.muted)
                            .child(this.keyNotes.get(key)?.text ?? ''),
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

    /**
     * the ask's link, one line under its pick (FRM-645: a hands-ask carries a look card): a web or app link opens
     * outside, a file shows its text under the ask, a second click folds it
     * @param {Theme} t @param {Ask} ask @param {string} id
     */
    linkLine(t, ask, id) {
        const shown = linkOf(ask.link);
        const isOpen = this.linkShown?.id === ask.id;
        return h_flex()
            .id(id)
            .gap(6)
            .items_center()
            .text_size(SIZE.secondary)
            .text_color(t.accent)
            .cursor_pointer()
            .hover((st) => st.underline())
            .tooltip(
                shown?.kind === 'file'
                    ? `${isOpen ? 'fold' : 'show'} ${ask.link}`
                    : `open ${ask.link}`,
            )
            .on_click((_e, cx) => {
                const link = ask.link ?? '';
                if (shown?.kind !== 'file') {
                    cx.spawn(async () => {
                        await exec('open', [link]).catch(
                            /** @returns {null} */ () => null,
                        );
                    });
                    return;
                }
                if (isOpen) {
                    this.linkShown = null;
                    cx.notify();
                    return;
                }
                const askId = ask.id ?? '';
                this.linkShown = { id: askId, problem: null, text: null };
                cx.notify();
                cx.spawn(async (cx) => {
                    const path = link.replace(/^~\//, `${home()}/`);
                    const text = await readTextFile(path).catch(
                        /** @returns {null} */ () => null,
                    );
                    if (this.linkShown?.id !== askId) return;
                    this.linkShown = {
                        id: askId,
                        problem:
                            typeof text === 'string'
                                ? null
                                : `cannot read ${shown.label}`,
                        text: typeof text === 'string' ? text : null,
                    };
                    cx.notify();
                });
            })
            .child('🔗')
            .child(shown?.label ?? '')
            .child(
                div()
                    .text_color(t.dim)
                    .child(isOpen ? '▾' : '▸'),
            );
    }

    /** the linked file's text under its ask, read as markdown and selectable @param {Theme} t @param {string} id */
    linkPreview(t, id) {
        const shown = this.linkShown;
        return v_flex()
            .p(10)
            .rounded(6)
            .bg(t.background)
            .child(
                shown?.text != null
                    ? prose(id, shown.text, t.foreground, SIZE.secondary)
                    : div()
                          .text_size(SIZE.small)
                          .text_color(t.dim)
                          .child(shown?.problem ?? 'reading…'),
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
                tickAllTakes(s.asks, (id) => this.pressStateOf(s, id)).length >
                0;
            // ⌘⇧K ticks the asker under the pointer, else the one he clicked last, ringed so he sees which
            const isPicked = this.pickedSid === s.sid;
            return v_flex()
                .id(`asker-${s.sid}`)
                .px(12)
                .py(4)
                .gap(8)
                .rounded(8)
                .border_1()
                .border_color(isPicked ? t.border : t.canvas)
                .on_hover((isOn, cx) => {
                    if (isOn) this.hoverSid = s.sid;
                    else if (this.hoverSid === s.sid) this.hoverSid = null;
                })
                .on_click((_e, cx) => {
                    if (this.pickedSid === s.sid) return;
                    this.pickedSid = s.sid;
                    cx.notify();
                })
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
                now ? el.child(step(now.text, current)) : el,
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
            const sid = tickAllThread(
                this.rows.filter((r) => r.asks.length > 0).map((r) => r.sid),
                {
                    hovered: this.hoverSid ?? null,
                    picked: this.pickedSid ?? null,
                    shown: this.rows.find((r) => r.pid === pid)?.sid ?? null,
                },
            );
            const asker = this.rows.find((r) => r.sid === sid);
            if (asker && tickAsk && Date.now() - tickAsk < 2000)
                cx.spawn((cx) => this.pressAll(cx, asker));
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
                    .child(header(`🪐 orbit: ${count(asks, 'ask', 'asks')}`))
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
                    .child(this.footerLine()),
            );
    }
}
