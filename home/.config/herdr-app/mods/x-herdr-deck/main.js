// x-herdr-deck: the live sessions from Claude Code's registry with what each waits on and its phases, the open
// orbit asks x-mod-stash keeps on disk, ticked here into each session's ticks file; a `view: 'glide'` copy draws each
// lane's glide card under antenna (glide-view.js). MODULES.md names the module that owns each part.

import { unlink } from 'fs/promises';
import { InputState, v_flex } from 'gpui-base';
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
import { CHAT_SHOWN, DECK_TOGGLED, chatShownOf } from './chat-asks.js';
import {
    hoverKept,
    isChatShown,
    isDeckShown,
    openThreadPid,
    takeCommands,
    tickAsker,
} from './deck-commands.js';
import { deckParts, orbitHeader } from './deck-parts.js';
import { createGlide } from './glide-view.js';
import { createCmdEnter, createKeyPress } from './keypress.js';
import { SANS, SIZE, clockOf } from './look.js';
import { audioAppOf } from './open-path.js';
import {
    HOT_ASK,
    PIDS_KEY,
    THREADS_BEAT_MS,
    THREADS_KEY,
    byName,
    createSerial,
    createTurns,
    dropPress,
    freshHotAsk,
    keep,
    kept,
    nextThreads,
    orbitPinIn,
    pressOf,
    roundsKept,
    savePress,
    settingRowsIn,
    steerKeyAct,
    threadFacts,
    tickAll,
    tickAllTakes,
    withPending,
} from './orbit.js';
import { createOrbitView } from './orbit-view.js';
import { createPhasesView } from './phases-view.js';
import { isPictureName } from './pictures.js';
import { SENT_MS, next, pressState, untickDoor } from './press.js';
import {
    SESSIONS,
    SETTINGS,
    SETTINGS_DIR,
    STATES,
    TICKS,
    USAGE,
    json,
    onShelfWrite,
    sessions,
    states,
} from './shelf.js';
import { createSteerFiles } from './steer-files.js';
import {
    STEER_BACK,
    STEER_CMD_ENTER,
    STEER_ENTER,
    STEER_TAB,
    steerBox,
} from './steer-kit.js';
import { createTabMember } from './tab-loop.js';
import { ORDER_KEY } from './thread-keys.js';

/** @typedef {import('./deck-types.js').Context} Context */
/** @typedef {import('./deck-types.js').AsyncContext} AsyncContext */
/** @typedef {import('./deck-types.js').Theme} Theme */
/** @typedef {import('./orbit.js').Ask} Ask */
/** @typedef {import('./shelf.js').Row} Row */

// how long a key that did nothing says why under its steer box
const KEY_NOTE_MS = 3000;
// a picture pasted into a steer box is saved here, under the app dir, and sent by its path
const PASTED_DIR = 'data/x-herdr-deck/pasted';

/** a picture he pasted is our copy: it goes when its steer lets it go; a file from elsewhere is his @param {string[]} paths */
function forgetPasted(paths) {
    const ours = `${appHome()}/${PASTED_DIR}/`;
    for (const path of paths)
        if (path.startsWith(ours)) unlink(path).catch(() => {});
}
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
    /** the asker under the pointer, which ⌘⇧K ticks first @type {{ at: number, sid: string } | null} */
    hover = null;
    /** the copy drawing glide under antenna, `view: 'glide'` @type {ReturnType<typeof createGlide> | null} */
    glide = null;
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
    /** each thread's plan tick written and not read yet, by sid, the press's time @type {Map<string, number>} */
    planSent = new Map();
    steerFocus = /** @type {string | null} */ (null);
    /** the app a card's audio file opens in @type {string | null} */
    audioApp = audioAppOf(null);
    /** the files each ask names, previewed or listed in its card (FRM-676) */
    files = createCardFiles({ audioApp: () => this.audioApp });
    // the files each steer box carries, sent as their paths with its steer (FRM-676 slice B)
    steerFiles = createSteerFiles(localStorage, forgetPasted);
    /** the deck's seat in the Tab loop: its drawn steer boxes */
    tab = createTabMember('x-herdr-deck', { layout, setShared, shared });
    orbitView = createOrbitView({
        addSteerFiles: (cx, key, paths) => this.addSteerFiles(cx, key, paths),
        chipsOf: (t, key, isLocked) => this.chipsOf(t, key, isLocked),
        files: () => this.files,
        hoverSid: () => this.hover?.sid ?? null,
        keyNotes: () => this.keyNotes,
        passedOver: () => this.passedOver,
        pin: () => this.pin,
        press: (cx, s, ask, verdict) => this.press(cx, s, ask, verdict),
        pressAll: (cx, s) => this.pressAll(cx, s),
        pressStateOf: (s, id) => this.pressStateOf(s, id),
        presses: () => this.presses,
        rows: () => this.rows,
        setHoverSid: (sid) => {
            this.hover = sid ? { at: Date.now(), sid } : null;
        },
        setOrbitStops: (stops) => {
            this.orbitStops = stops;
        },
        setTabAt: (tabAt) => {
            this.tabAt = tabAt;
        },
        steerOf: (t, key, tabIndex, isLocked) =>
            this.steerOf(t, key, tabIndex, isLocked),
        steers: () => this.steers,
        tabAt: () => this.tabAt,
        unpress: (cx, s, ask) => this.unpress(cx, s, ask),
        updated: () => this.updated,
    });
    phasesView = createPhasesView({
        planSent: () => this.planSent,
        planTicked: () => this.planTicked,
        rows: () => this.rows,
        setPressError: (error) => {
            this.pressError = error;
        },
        steerOf: (t, key, tabIndex, isLocked) =>
            this.steerOf(t, key, tabIndex, isLocked),
        steerSent: (key) => this.steerSent(key),
        steers: () => this.steers,
        tabAt: () => this.tabAt,
        turns: (write) => this.turns(write),
    });
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
        // never in init itself: herdr runs what init queued inside the next call, another mod's, whose store and owner the
        // first read would then take for its steer boxes (kept.test.ts); a timer's call is this copy's own
        cx.timer.after(0, (cx) => {
            this.reload(cx);
            onShelfWrite(cx, USAGE, (cx) => this.reload(cx));
            // the press folder too: a 🔥 pressed on the band above a chat draws on its row at once
            for (const folder of [
                SESSIONS,
                STATES,
                `${home()}/${PRESS_DIR}`,
                SETTINGS_DIR,
            ]) {
                cx.spawn(async (cx) => {
                    for (;;) {
                        await watchFolder(folder).catch(
                            () =>
                                /** @type {Promise<string[]>} */ (
                                    new Promise((done) =>
                                        cx.timer.after(5000, () => done([])),
                                    )
                                ),
                        );
                        this.reload(cx);
                    }
                });
            }
        });
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

    /** dropped or pasted files join a steer box, a picture's thumb drawn once made: whether they joined @param {Context} cx @param {string} key @param {string[]} paths */
    addSteerFiles(cx, key, paths) {
        // a ticked ask's press is written: a file added now would draw and never ride it, so it is refused and said
        const [sid, id] = key.split(':');
        const s = this.rows.find((r) => r.sid === sid);
        if (s && this.pressStateOf(s, id ?? '') !== 'open') {
            this.keyNotes.set(key, {
                text: 'already sent: take the tick back to add a file',
                until: Date.now() + KEY_NOTE_MS,
            });
            cx.notify();
            cx.timer.after(KEY_NOTE_MS + 1, (later) => later.notify());
            return false;
        }
        if (!this.steerFiles.add(key, paths)) return false;
        cx.notify();
        cx.spawn(async (cx) => {
            if (await this.files.look(this.rows ?? [], this.steeredPaths()))
                cx.notify();
        });
        return true;
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
            const pasted = read && 'rel' in read ? paths : [];
            if (
                !this.steers.has(key) ||
                !s ||
                this.pressStateOf(s, id ?? '') === 'locked'
            )
                return forgetPasted(pasted);
            if (paths.length) {
                if (!this.addSteerFiles(cx, key, paths)) forgetPasted(pasted);
                return;
            }
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
        const usage = await json(USAGE);
        // a read in the middle of a write parses to nothing: the number stays, the write's end is read next
        const week = usage
            ? (usage.rate_limits?.seven_day?.used_percentage ?? null)
            : this.week;
        const listed = await sessions(shelf, this.rows);
        // a stale list keeps its rows, their presses read again all the same
        const rows = await withPending(listed ?? this.rows, (sid) =>
            readTextFile(`${TICKS}/${sid}.jsonl`).catch(
                () => /** @type {string | null} */ (null),
            ),
        );
        const settings = await readTextFile(SETTINGS).catch(() => null);
        if (!isCurrent()) return;
        this.pin = orbitPinIn(settings);
        this.audioApp = audioAppOf(settingRowsIn(settings));
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
        // a thread whose state file was not read has no ask known to have left: what is kept for one stays
        const isUnread = (/** @type {string} */ key) =>
            shelf?.unread.has(key.split(':')[0] ?? '') ?? true;
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
            if (!seen.has(key) && !isUnread(key))
                this.pressStep(key, {
                    isGone: true,
                    isLocked: false,
                    mark: null,
                    pending: null,
                    type: 'shelfRead',
                });
        // a read that failed knows of no ask that left: what is kept for one stays
        if (!listed) return;
        for (const key of this.steers.keys()) {
            if (isUnread(key)) continue;
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
            isUnread,
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
        this.steerFiles.sweep(
            new Set(
                this.rows.flatMap((r) => r.asks.map((a) => `${r.sid}:${a.id}`)),
            ),
            new Set(
                this.rows.map((r) => r.sid).filter((sid) => !isUnread(sid)),
            ),
        );
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

    /** the focused thread, its pid by antenna's address → pid map */
    focusedThread() {
        const address = agents().find((a) => a.focused)?.address ?? null;
        const pids = /** @type {Record<string, number> | null} */ (
            shared(PIDS_KEY)
        );
        return {
            address,
            pid: address ? (pids?.[address] ?? null) : null,
            pids,
        };
    }

    /** the hover ⌘⇧K may still act on */
    hoverNow() {
        return hoverKept(this.rows, this.hover, shared(DECK_TOGGLED));
    }

    // ⌘⇧K (FRM-589): the asker under the pointer, else the thread open on screen; a hidden deck's copy stays alive in
    // its block, so it checks its own block is shown
    /** @param {Context} cx */
    tickShown(cx) {
        const tree = layout();
        const { address, pids } = this.focusedThread();
        const sid = tickAsker(
            this.rows.map((r) => ({
                pid: r.pid,
                sid: r.sid,
                takes: tickAllTakes(r.asks, (id) => this.pressStateOf(r, id))
                    .length,
            })),
            {
                hovered: this.hoverNow()?.sid ?? null,
                isShown: isDeckShown(tree),
                openPid: openThreadPid({
                    address,
                    chatAddress: chatShownOf(shared(CHAT_SHOWN)).address,
                    isChatShown: isChatShown(tree),
                    pids,
                }),
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
            if (!isCmd) cx.spawn((cx) => this.phasesView.pressPlan(cx, key));
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
        this.hover = this.hoverNow();
        const orbitRows = asks > 0 ? this.orbitView.orbit(t) : [];
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
        // antenna lists the threads; the deck scrolls orbit and pins the focused thread's phases to its bottom
        const parts = deckParts(this.rows, {
            focusedPid: this.focusedThread().pid,
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
                el.child(this.phasesView.phasesBlock(t, parts.pinned, header)),
            );
    }
}
