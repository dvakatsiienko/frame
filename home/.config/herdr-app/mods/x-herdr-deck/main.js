// x-herdr-deck: the live sessions from Claude Code's registry with what each waits on and its phases, the open
// orbit asks x-mod-stash keeps on disk, ticked here into each session's ticks file; a `view: 'glide'` copy draws each
// lane's glide card under antenna (glide-view.js).

import { Button, InputState, h_flex, v_flex } from 'gpui-base';
import { View, div } from 'gpui-kit';
import {
    agents,
    appHome,
    exec,
    home,
    layout,
    nextCommand,
    props,
    readTextFile,
    setShared,
    shared,
    theme,
    watchFolder,
    writeTextFile,
} from 'herdr';

import { readClipboard } from './attach-files.js';
import { attachRow } from './attach-row.js';
import {
    PRESS_DIR,
    PRESS_FILE,
    pressLine,
    withBandPress,
} from './band-press.js';
import { createCardFiles } from './card-files.js';
import { isDeckShown, takeCommands, tickAsker } from './deck-commands.js';
import { deckParts, orbitHeader } from './deck-parts.js';
import { createGlide } from './glide-view.js';
import { createCmdEnter, createKeyPress } from './keypress.js';
import { SANS, SIZE, clockOf, leadingRoom, line, prose } from './look.js';
import {
    HOT_ASK,
    ORDER_KEY,
    PIDS_KEY,
    THREADS_BEAT_MS,
    THREADS_KEY,
    askLabel,
    byName,
    cardKind,
    cardPaint,
    cardText,
    createSerial,
    createTurns,
    dropPress,
    freshHotAsk,
    keep,
    kept,
    linkOf,
    nextThreads,
    orbitPinIn,
    orbitSections,
    orbitTabOrder,
    phaseParts,
    planPress,
    pressLabel,
    pressOf,
    roundsKept,
    savePress,
    steerKeyAct,
    threadFacts,
    tickAll,
    tickAllTakes,
    withPending,
} from './orbit.js';
import { askText, isPictureName } from './pictures.js';
import { SENT_MS, next, pressState, untickDoor } from './press.js';
import {
    CLAUDE,
    SESSIONS,
    SETTINGS,
    SETTINGS_DIR,
    STATES,
    TICKS,
    USAGE,
    json,
    sessions,
    states,
} from './shelf.js';
import { createSteerFiles } from './steer-files.js';
import {
    STEER_BACK,
    STEER_CMD_ENTER,
    STEER_ENTER,
    STEER_TAB,
    pressButton,
    steerBox,
} from './steer-kit.js';
import { createTabMember } from './tab-loop.js';

/** @typedef {import('gpui-kit').Context} Context */
/** @typedef {import('gpui-kit').AsyncContext} AsyncContext */
/** @typedef {import('gpui-kit').Color} Color */
/** @typedef {Record<'accent' | 'background' | 'blocked' | 'border' | 'ansi2' | 'ansi5' | 'ansi6' | 'canvas' | 'dim' | 'foreground' | 'hover' | 'idle' | 'muted' | 'raised' | 'solid' | 'solid_foreground' | 'surface' | 'working', Color>} Theme */
/** @typedef {import('./orbit.js').Ask} Ask */
/** @typedef {import('./shelf.js').Row} Row */

// how long a key that did nothing says why under its steer box
const KEY_NOTE_MS = 3000;
// a picture pasted into a steer box is saved here, under the app dir, and sent by its path
const PASTED_DIR = 'data/x-herdr-deck/pasted';
// how long a press given up by time says so: long enough to be seen when he looks back at the board
const GIVEN_UP_NOTE_MS = 30 * 1000;

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
export default class Deck extends View {
    /** the asker under the pointer, which ⌘⇧K ticks first @type {string | null} */
    hoverSid = null;
    /** the copy drawing glide under antenna, `view: 'glide'` @type {ReturnType<typeof createGlide> | null} */
    glide = null;
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
    /** each steer box's Tab place, and the one holding the keyboard @type {Map<string, number>} */
    tabAt = new Map();
    /** orbit's steer stops this draw, published by the render with the phases' box after them @type {string[]} */
    orbitStops = [];
    /** each thread's plan ticked here, by sid, the plan's text as ticked, until slice E wires the stash's read @type {Map<string, string>} */
    planTicked = new Map();
    /** the threads whose plan press is being written, so a second press waits for the first @type {Set<string>} */
    planWriting = new Set();
    /** each thread's plan tick written and not read yet, by sid, the press's time @type {Map<string, number>} */
    planSent = new Map();
    steerFocus = /** @type {string | null} */ (null);
    /** the files each ask names, previewed or listed in its card (FRM-676) */
    files = createCardFiles();
    // the files each steer box carries, sent as their paths with its steer (FRM-676 slice B)
    steerFiles = createSteerFiles(localStorage);
    /** the deck's seat in the Tab loop: its drawn steer boxes */
    tab = createTabMember('x-herdr-deck', { layout, setShared, shared });
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
            {
                action: STEER_TAB,
                context: 'XDeckSteer > Input',
                keystroke: 'tab',
            },
            {
                action: STEER_BACK,
                context: 'XDeckSteer > Input',
                keystroke: 'shift-tab',
            },
        ]);
        // the thread strip is gone (dima, 20:12: «it eats UI»), its block hidden; a `view: seat` copy herdr still keeps
        // alive draws nothing and reads nothing, so it never runs a second deck. «seat» is the layout's own value in
        // layouts/itrout.json: renaming it means a layout edit, never done while a thread holds focus
        /** @type {Map<string, number>} each ask id label's drawn width */
        this.labelW = new Map();
        /** @type {Map<string, { box: number, full: number }>} each phase line's box and its uncut text's width */
        this.phaseW = new Map();
        this.isThread = props()?.view === 'seat';
        if (this.isThread) return;
        if (props()?.view === 'glide') {
            this.glide = createGlide(props().block);
            this.glide.init(cx);
            return;
        }
        /** @type {Row[]} */
        this.rows = [];
        /** @type {Set<string>} */
        this.open = new Set();
        // a steer box per open ask, made when a read finds the ask: an InputState is never made while drawing
        /** @type {Map<string, import('gpui-base').InputState>} */
        this.steers = new Map();
        /** the asks clio updated since he last pressed them (FRM-620): their steer cleared, 🆕 on them */
        this.updated = /** @type {Set<string> | null} */ (null);
        // the gated asks a «tick all» passed over, `sid:id`: each says it still needs his own press
        /** @type {Set<string>} */
        this.passedOver = new Set();
        /** a key in a steer box that did nothing, and why, by ask key @type {Map<string, { text: string, until: number }>} */
        this.keyNotes = new Map();
        // ⌘⇧K reaches this copy alone: a `view` copy returned above and never waits on a command
        cx.spawn((cx) =>
            takeCommands(nextCommand, { tickall: () => this.tickShown(cx) }),
        );
        // antenna's 🔥 asks land here; one made before this load never fires
        /** @type {number} */
        this.hotAskSeen =
            /** @type {{ at?: number } | null} */ (shared(HOT_ASK))?.at ?? 0;
        /** @type {string | null} */
        this.pressError = null;
        /** @type {string | null} */
        this.pressNote = null;
        /** @type {number | null} */
        this.week = null;
        /** @type {import('./orbit.js').OrbitPin} */
        this.pin = 'top';
        cx.timer.every(THREADS_BEAT_MS, (cx) => this.reload(cx));
        this.reload(cx);
        // the press folder too: a 🔥 pressed on the band above a chat draws on its row at once; the settings folder
        // on its own, as the tab pills watch it, since a nested path under the linked shelf never matched (13:27 probe)
        for (const folder of [
            SESSIONS,
            STATES,
            `${CLAUDE}/shelf`,
            `${home()}/${PRESS_DIR}`,
            SETTINGS_DIR,
        ]) {
            cx.spawn(async (cx) => {
                for (;;) {
                    const changed = await watchFolder(folder).catch(
                        () =>
                            /** @type {Promise<string[]>} */ (
                                new Promise((done) =>
                                    cx.timer.after(5000, () => done([])),
                                )
                            ),
                    );
                    if (
                        folder.endsWith('/shelf') &&
                        !changed.some((p) => p === USAGE || p === folder)
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
            if (await this.files.look(this.rows ?? [], this.steeredPaths()))
                cx.notify();
        });
    }

    /** the steer as it leaves: his words, then each file's path on its own line @param {string} key */
    steerSent(key) {
        return this.steerFiles.joined(key, this.steers.get(key)?.value() ?? '');
    }

    /** every file the steer boxes carry, so a picture's thumb is made @returns {string[]} */
    steeredPaths() {
        return [...this.steers.keys()].flatMap((k) => this.steerFiles.of(k));
    }

    /** dropped or pasted files join a steer box, a picture's thumb drawn once made @param {Context} cx @param {string} key @param {string[]} paths */
    addSteerFiles(cx, key, paths) {
        if (!this.steerFiles.add(key, paths)) return;
        cx.notify();
        cx.spawn(async (cx) => {
            if (await this.files.look(this.rows ?? [], this.steeredPaths()))
                cx.notify();
        });
    }

    /** a paste with no text: the clipboard's image saved as a png, or files copied in Finder @param {Context} cx @param {string} key */
    pasteSteer(cx, key) {
        cx.spawn(async (cx) => {
            const read = await readClipboard(PASTED_DIR);
            const paths = !read
                ? []
                : 'paths' in read
                  ? read.paths
                  : [`${appHome()}/${read.rel}`];
            // the ask may have left or been delivered while the clipboard was read
            const [sid, id] = key.split(':');
            const s = this.rows.find((r) => r.sid === sid);
            if (
                !this.steers.has(key) ||
                !s ||
                this.pressStateOf(s, id ?? '') === 'locked'
            )
                return;
            if (paths.length) return this.addSteerFiles(cx, key, paths);
            this.keyNotes.set(key, {
                text: 'no picture or file on the clipboard',
                until: Date.now() + KEY_NOTE_MS,
            });
            cx.notify();
            cx.timer.after(KEY_NOTE_MS + 1, (later) => later.notify());
        });
    }

    /** the files a steer box carries, drawn as the quill's are (attach-row.js); none while it carries none @param {Theme} t @param {string} key @param {boolean} isLocked */
    chipsOf(t, key, isLocked) {
        const files = this.steerFiles.of(key);
        if (!files.length) return [];
        const pictures = files.filter(isPictureName);
        return [
            attachRow(t, {
                files: files.map((path) => ({
                    isPicture: isPictureName(path),
                    path,
                    preview: this.files.previewOf(path),
                })),
                id: `chips-${key}`,
                isLocked,
                onOpen: (path) => this.files.openPicture(pictures, path),
                onRemove: (path, cx) => {
                    this.steerFiles.remove(key, path);
                    cx.notify();
                },
            }),
        ];
    }

    /**
     * one read of the shelf, whole: the rows draw only with their presses read; a read the chain let go as stalled
     * changes nothing when it answers late
     * @param {() => boolean} isCurrent
     */
    async read(isCurrent) {
        const shelf = await states();
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
        const pin = orbitPinIn(await readTextFile(SETTINGS).catch(() => null));
        if (!isCurrent()) return;
        this.pin = pin;
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
            // the phases' box (`<sid>:plan`) lives while its thread has phases
            const isKept = key.endsWith(':plan')
                ? Boolean(s?.phases.length)
                : Boolean(askOf(key));
            // his steer stays, stored and shown, until the ask leaves (dima, 21:03)
            if (!s || !isKept) {
                this.steers.delete(key);
                this.steerFiles.clear(key);
                keep(localStorage, `steer:${key}`, '');
            }
        }
        const rounds = roundsKept(
            localStorage,
            this.updated ?? null,
            this.rows,
        );
        this.updated = rounds.updated;
        for (const key of rounds.cleared) {
            this.steers.get(key)?.set_value('');
            this.steerFiles.clear(key);
        }
        // a plan press the thread has read reached it: the box empties and «tick» comes back, as an ask's does (19:19)
        for (const [sid, at] of this.planSent) {
            const s = this.rows.find((r) => r.sid === sid);
            if (s && s.taken < at) continue;
            this.planSent.delete(sid);
            this.planTicked.delete(sid);
            this.steers.get(`${sid}:plan`)?.set_value('');
            keep(localStorage, `steer:${sid}:plan`, '');
        }
        for (const s of this.rows) {
            if (s.phases.length && !this.steers.has(`${s.sid}:plan`))
                this.makeSteerBox(`${s.sid}:plan`);
            for (const ask of s.asks) {
                const key = `${s.sid}:${ask.id}`;
                if (ask.id && !this.steers.has(key))
                    // herdr documents InputState.new for init or a handler; a refusal here costs the box, never
                    // the reload that redraws the whole deck
                    this.makeSteerBox(key);
            }
        }
    }

    /** the footer, from the reload chain's one state: only a read that stalled says so; a fresh one says nothing (his
     * 18:06: «"updated…" i do not need that — hide it») @returns {string | null} */
    footerLine() {
        const chain = this.reloads.state();
        if (chain.settledAt === null || chain.phase !== 'stalled') return null;
        return `no read since ${clockOf(new Date(chain.settledAt), 2)}, reading again`;
    }

    /** @param {Context} cx @param {string} sid @param {boolean} on */
    pressHot(cx, sid, on) {
        const at = Date.now();
        const line = pressLine('hot', on, sid, at);
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
                this.pressError = `keep hot not written: ${err instanceof Error ? err.message : err}`;
            }
            cx.notify();
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
        const steer = this.steerSent(key);
        const at = Date.now();
        this.updated?.delete(key);
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
                    pressOf({ ...ask, id }, verdict, at, steer),
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

    /**
     * the phases' header with «tick» and its steer box, as an ask's (rider 4d, his 18:09 shot): the box is the Tab stop
     * after orbit's, Enter ticks or unticks, no replay
     * @param {Theme} t @param {any} head @param {string} key `<sid>:plan`
     */
    planHead(t, head, key) {
        const sid = key.slice(0, -':plan'.length);
        const plan = this.rows.find((r) => r.sid === sid)?.phases.join('\n');
        const isTicked = this.planTicked.get(sid) === plan;
        return head
            .flex()
            .items_center()
            .gap(8)
            .child(div().flex_1())
            .child(
                pressButton(t, {
                    id: `plan-tick-${sid}`,
                    isPrimary: true,
                    label: pressLabel(isTicked ? 'ticked' : 'open', null).tick,
                    onClick: (cx) => cx.spawn((cx) => this.pressPlan(cx, key)),
                    tip: isTicked
                        ? 'queued for its next turn: click to take it back'
                        : 'tick: agree with the plan',
                }),
            )
            .child(
                div()
                    .w(200)
                    .flex_none()
                    .flex()
                    .child(
                        this.steerOf(
                            t,
                            key,
                            this.tabAt.get(`steer-${key}`) ?? 0,
                            false,
                        ),
                    ),
            );
    }

    /** a card's steer box, its keys wired to this deck @param {Theme} t @param {string} key @param {number} tabIndex @param {boolean} isLocked */
    steerOf(t, key, tabIndex, isLocked) {
        return steerBox(t, {
            box: /** @type {InputState} */ (this.steers.get(key)),
            id: `steer-${key}`,
            isFocused: this.steerFocus === key,
            isLocked,
            onCmdUp: () => this.steerKeys.modifiersReleased(),
            onEnter: (cx, isCmd) => this.steerKeyAct(cx, key, isCmd),
            onEnterUp: () => this.steerKeys.released(),
            onTab: (isBack) => this.tab.ask(`steer-${key}`, isBack),
            tabIndex,
        });
    }

    // the phases' tick (rider 4d): a press naming the whole plan into the thread's ticks file; a second press unticks
    /** @param {Context} cx @param {string} key `<sid>:plan` */
    async pressPlan(cx, key) {
        const sid = key.slice(0, -':plan'.length);
        const s = this.rows.find((r) => r.sid === sid);
        if (!s || this.planWriting.has(sid)) return;
        // a tick belongs to the plan it ticked: a new plan reads open again
        const plan = s.phases.join('\n');
        const was = this.planTicked.get(sid);
        const isTick = was !== plan;
        if (isTick) this.planTicked.set(sid, plan);
        else this.planTicked.delete(sid);
        this.planWriting.add(sid);
        const at = Date.now();
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
                    `${TICKS}/${sid}.jsonl`,
                    planPress(
                        s.phases,
                        isTick ? 'tick' : 'untick',
                        at,
                        this.steerSent(key),
                    ),
                    s.taken,
                ),
            );
            if (isTick) this.planSent.set(sid, at);
            else this.planSent.delete(sid);
            this.pressError = null;
        } catch (err) {
            if (was === undefined) this.planTicked.delete(sid);
            else this.planTicked.set(sid, was);
            this.pressError = `phases not ticked: ${err instanceof Error ? err.message : err}`;
        }
        this.planWriting.delete(sid);
        cx.notify();
    }

    // ⌘⇧K (FRM-589): the asker under the pointer, else the one he picked, else the thread the chat shows; a hidden
    // deck's copy stays alive in its block, so it checks its own block is shown
    /** @param {Context} cx */
    tickShown(cx) {
        const sid = tickAsker(
            this.rows.map((r) => ({
                pid: r.pid,
                sid: r.sid,
                takes: tickAllTakes(r.asks, (id) => this.pressStateOf(r, id))
                    .length,
            })),
            {
                hovered: this.hoverSid ?? null,
                isShown: isDeckShown(layout()),
                picked: this.pickedSid ?? null,
                pid: /** @type {{ pid?: number } | null} */ (
                    shared('chat.shown')
                )?.pid,
            },
        );
        const asker = this.rows.find((r) => r.sid === sid);
        if (asker) cx.spawn((cx) => this.pressAll(cx, asker));
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
                    (id) => this.steerSent(`${s.sid}:${id}`),
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
                placeholder: key.endsWith(':plan')
                    ? 'steer…'
                    : 'steer, or drop a file…',
                value: kept(localStorage, `steer:${key}`) ?? '',
            });
            const save = () => keep(localStorage, `steer:${key}`, box.value());
            box.on('change', save);
            // files ride an ask's steer, never the phases' (dima, 19:17: FRM-676:W2 and W4 name orbit asks)
            if (!key.endsWith(':plan'))
                box.on('paste_other', (_e, cx) => this.pasteSteer(cx, key));
            // Enter and ⌘Enter are the box's own actions (STEER_ENTER), never its submit; focus leaving ends a press
            box.on('blur', (_e, cx) => {
                this.steerKeys.blurred();
                if (this.steerFocus === key) this.steerFocus = null;
                this.tab.left(`steer-${key}`, (run) => cx.timer.after(0, run));
                cx.notify();
            });
            box.on('focus', (_e, cx) => {
                this.steerFocus = key;
                this.tab.held(`steer-${key}`);
                cx.notify();
            });
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
        // the phases' box: Enter ticks or unticks the plan, and it has no replay
        if (key.endsWith(':plan')) {
            if (!isCmd) cx.spawn((cx) => this.pressPlan(cx, key));
            return;
        }
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
                          pressOf({ ...ask, id }, 'untick', at),
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
    /** @param {Theme} t @param {Row} s @param {Ask} ask */
    ask(t, s, ask) {
        const key = `${s.sid}:${ask.id}`;
        const steerTab = this.tabAt.get(`steer-${key}`) ?? 0;
        const steer = this.steers.get(key);
        const state = this.pressStateOf(s, ask.id);
        const record = this.presses.get(key);
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
        // an ask is a card: the section head carries the 🪐, the bold id leads
        return (
            v_flex()
                .p(12)
                .gap(8)
                .rounded(8)
                .bg(t.raised)
                // a file dropped anywhere on the card joins its steer: the box's own text field swallows a drop (his 19:33 test)
                .when(Boolean(steer) && !isLocked, (el) =>
                    el.on_drop((e, cx) =>
                        this.addSteerFiles(cx, key, e?.paths ?? []),
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
                .child(this.askLine(t, s, ask, `ask-${key}`))
                .when(Boolean(ask.pick), (el) =>
                    el.child(
                        prose(
                            `pick-${key}`,
                            ask.pick ?? '',
                            t.muted,
                            SIZE.secondary,
                        ),
                    ),
                )
                .when(linkOf(ask.link)?.kind === 'web', (el) =>
                    el.child(this.linkLine(t, ask, `link-${key}`)),
                )
                .children(this.files.view(t, ask, key))
                .children(this.chipsOf(t, key, isLocked))
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
                                    this.steerOf(t, key, steerTab, isLocked),
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
     * the ask's web or app link, one line under its pick: it opens outside; a file link is a button with the others
     * @param {Theme} t @param {Ask} ask @param {string} id
     */
    linkLine(t, ask, id) {
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
            .on_click(() => {
                exec('open', [ask.link ?? '']).catch(() => {});
            })
            .child('🔗')
            .child(shown?.label ?? '');
    }

    /** @param {Theme} t @param {Row} s @param {Ask} ask @param {string} id */
    askLine(t, s, ask, id) {
        if (!ask.id)
            return prose(
                id,
                cardText(askText(ask.text, home())),
                t.foreground,
                SIZE.main,
            );
        const isUpdated = this.updated?.has(`${s.sid}:${ask.id}`);
        const label = `${isUpdated ? '🆕 ' : ''}${askLabel(s.name, ask.id)}`;
        const width =
            (this.labelW.get(label) ?? label.length * 0.62 * SIZE.main) + 6;
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

    // look and 🧪 cards from every thread lead (or close, by his setting), then each thread in the agents list's order
    /** @param {Theme} t */
    orbit(t) {
        const sections = orbitSections(
            this.rows,
            /** @type {number[] | null} */ (shared(ORDER_KEY)),
            this.pin,
        );
        // only a steer box drawn as a box is a stop: a delivered ask's steer is plain words
        const stops = orbitTabOrder(
            sections,
            (s, ask) =>
                this.steers.has(`${s.sid}:${ask.id}`) &&
                this.pressStateOf(s, ask.id) !== 'locked',
        );
        // the render publishes these with the phases' box after them, one Tab loop
        this.orbitStops = stops;
        // built before the cards draw, which read their box's place from it
        this.tabAt = new Map(stops.map((id, i) => [id, i + 1]));
        return sections.map((section) => {
            if (section.kind === 'pinned')
                return v_flex()
                    .px(12)
                    .py(4)
                    .gap(8)
                    .children(
                        section.cards.map(({ ask, row }) =>
                            v_flex()
                                .gap(4)
                                .child(
                                    line(t.muted, SIZE.small).child(row.name),
                                )
                                .child(this.ask(t, row, ask)),
                        ),
                    );
            const s = section.row;
            const canTickAll =
                tickAllTakes(s.asks, (id) => this.pressStateOf(s, id)).length >
                0;
            // ⌘⇧K ticks the asker under the pointer, else the one he clicked last, ringed so he sees which
            const isPicked = this.pickedSid === s.sid;
            return v_flex()
                .id(`asker-${s.sid}`)
                .tab_stop(false)
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
                .children(section.asks.map((ask) => this.ask(t, s, ask)));
        });
    }

    /** @param {Context} cx */
    render(cx) {
        if (this.glide) return this.glide.render();
        const t = /** @type {Theme} */ (theme());
        if (this.isThread) return div();
        const hotAsk = freshHotAsk(shared(HOT_ASK), this.hotAskSeen);
        if (hotAsk) {
            this.hotAskSeen = hotAsk.at;
            cx.timer.after(0, (cx) => this.pressHot(cx, hotAsk.sid, hotAsk.on));
        }
        // his order from the agents list, read at every draw, so a drag there moves the deck at once; the read's own
        // order (blocked, working, then by name) stays for a thread the list does not show
        const asks = this.rows.reduce((n, s) => n + s.asks.length, 0);
        // orbit draws its steer boxes as Tab stops and focuses the one the loop asks for; with no asks it draws none
        this.orbitStops = [];
        this.tabAt = new Map();
        const orbitRows = asks > 0 ? this.orbit(t) : [];
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
        // antenna lists the threads; the deck scrolls orbit and pins the focused thread's phases to its bottom, its pid
        // by antenna's address → pid map
        const focusedAt = agents().find((a) => a.focused)?.address;
        const pids = /** @type {Record<string, number> | null} */ (
            shared(PIDS_KEY)
        );
        const parts = deckParts(this.rows, {
            focusedPid: focusedAt ? (pids?.[focusedAt] ?? null) : null,
            order: /** @type {number[] | null} */ (shared(ORDER_KEY)),
        });
        // the phases' steer box is the Tab stop right after orbit's (rider 4d); it shows for one thread's plan only
        const planKey =
            parts.pinned.length === 1 ? `${parts.pinned[0]?.sid}:plan` : null;
        const stops = [
            ...this.orbitStops,
            ...(planKey && this.steers.has(planKey)
                ? [`steer-${planKey}`]
                : []),
        ];
        if (stops.length > this.orbitStops.length)
            this.tabAt.set(stops.at(-1) ?? '', stops.length);
        const to = this.tab.draw(stops, (run) => cx.timer.after(0, run));
        const box = to && this.steers.get(to.slice('steer-'.length));
        if (box) cx.timer.after(0, () => box.focus());
        const scrolling = v_flex()
            .id('x-herdr-deck-scroll')
            .flex_1()
            .min_h(120)
            .overflow_y_scroll()
            // a press antenna asked for can fail with no ask on orbit, so its error draws above every section
            .when(Boolean(this.pressError), (el) =>
                el.child(
                    div()
                        .px(12)
                        .pt(8)
                        .text_size(SIZE.secondary)
                        .text_color(t.blocked)
                        .child(`⚠️ ${this.pressError}`),
                ),
            )
            .child(header(orbitHeader(asks)))
            .when(asks === 0, (el) =>
                el.child(
                    div()
                        .px(12)
                        .text_size(SIZE.secondary)
                        .text_color(t.muted)
                        .child('no asks'),
                ),
            )
            .children(orbitRows)
            .when(Boolean(this.pressNote), (el) =>
                el.child(
                    div()
                        .px(12)
                        .text_size(SIZE.secondary)
                        .text_color(t.muted)
                        .child(`⏳ ${this.pressNote}`),
                ),
            )
            .when(this.footerLine() !== null, (el) =>
                el.child(
                    div()
                        .px(12)
                        .py(8)
                        .text_size(SIZE.small)
                        .text_color(t.muted)
                        .child(this.footerLine() ?? ''),
                ),
            );
        return v_flex()
            .id('x-herdr-deck')
            .font_family(SANS)
            .size_full()
            .bg(t.canvas)
            .child(scrolling)
            .when(parts.pinned.length > 0, (el) =>
                el.child(this.phasesBlock(t, parts.pinned, header)),
            );
    }

    /**
     * every thread's phases, pinned under orbit and glide: a group per thread under its name; past its height it scrolls
     * on its own, and the scroll part above keeps at least 120 px, so orbit never vanishes
     * @param {Theme} t @param {import('./deck-parts.js').PhaseGroup[]} groups @param {(text: string) => any} header
     */
    phasesBlock(t, groups, header) {
        const planKey = groups.length === 1 ? `${groups[0]?.sid}:plan` : null;
        // one thread's plan carries no name: antenna and the tabs already say which (dima, 19:26); several keep a name each
        const isOne = groups.length === 1;
        const head = header('🌔 phases');
        return v_flex()
            .id('x-herdr-deck-phases')
            .flex_none()
            .max_h(320)
            .overflow_y_scroll()
            .pb(8)
            .child(
                planKey && this.steers.has(planKey)
                    ? this.planHead(t, head, planKey)
                    : head,
            )
            .children(
                groups.map((g, i) =>
                    v_flex()
                        .px(12)
                        .py(4)
                        .gap(2)
                        .when(!isOne, (el) =>
                            el.child(
                                line(t.foreground, SIZE.secondary)
                                    .font_semibold()
                                    .child(g.name),
                            ),
                        )
                        .children(
                            g.phases.map((phase, j) => {
                                // the moon fills by nearness, the later lines dim, only the first lead green (the
                                // stash board's look, dima's 66d)
                                const p = phaseParts(phase, j);
                                const color = j > 1 ? t.muted : t.foreground;
                                // one entry per drawn line: its uncut copy measures again whenever its text changes width
                                const key = `${i}-${j}`;
                                const w = this.phaseW.get(key);
                                const isCut = Boolean(
                                    w && w.full > w.box + 0.5,
                                );
                                /** @param {'box' | 'full'} side @param {number} px @param {Context} cx */
                                const measured = (side, px, cx) => {
                                    const was = this.phaseW.get(key) ?? {
                                        box: 0,
                                        full: 0,
                                    };
                                    if (Math.abs(was[side] - px) < 0.5) return;
                                    this.phaseW.set(key, {
                                        ...was,
                                        [side]: px,
                                    });
                                    cx.notify();
                                };
                                // one line, cut with «…» at the card's edge so the card never grows; the full line
                                // shows on hover only while it is cut, measured again on every resize (rider 4e)
                                return h_flex()
                                    .pl(8)
                                    .gap(6)
                                    .items_center()
                                    .text_size(SIZE.secondary)
                                    .child(div().flex_none().child(p.moon))
                                    .when(Boolean(p.lead), (el) =>
                                        el.child(
                                            div()
                                                .flex_none()
                                                .font_semibold()
                                                .text_color(
                                                    j === 0 ? t.ansi2 : color,
                                                )
                                                .child(p.lead),
                                        ),
                                    )
                                    .child(
                                        div()
                                            .id(`phase-${i}-${j}`)
                                            .relative()
                                            .flex_1()
                                            .min_w(0)
                                            // one line tall whatever the text view does, so the card never grows
                                            .h(20)
                                            .overflow_hidden()
                                            .on_size_change((size, cx) =>
                                                measured('box', size.width, cx),
                                            )
                                            .when(isCut, (el) =>
                                                el.tooltip(phase),
                                            )
                                            // a text view, so he can select a phase to copy or read aloud (F4, 18:51)
                                            .child(
                                                prose(
                                                    `phase-text-${i}-${j}`,
                                                    p.text,
                                                    color,
                                                    SIZE.secondary,
                                                )
                                                    .whitespace_nowrap()
                                                    .overflow_hidden()
                                                    .text_ellipsis(),
                                            )
                                            .child(
                                                div()
                                                    .id(`phase-full-${i}-${j}`)
                                                    .absolute()
                                                    .top(0)
                                                    .left(0)
                                                    .h(0)
                                                    .overflow_hidden()
                                                    .whitespace_nowrap()
                                                    .text_color('#00000000')
                                                    .on_size_change(
                                                        (size, cx) =>
                                                            measured(
                                                                'full',
                                                                size.width,
                                                                cx,
                                                            ),
                                                    )
                                                    .child(p.text),
                                            ),
                                    );
                            }),
                        ),
                ),
            );
    }
}
