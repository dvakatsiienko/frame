// x-herdr-chat: the Chat view, built new beside x-herdr-chatter (FRM-638). it reads the thread the old chat shows,
// drawn as his messages, replies and one line per tool call, in a list that never moves without him, over the quill,
// his text box. the rules live in their own files, each tested with no herdr: reader.js, row-model.js, heights.js,
// follow.js, place.js, draft.js, send.js, magic.js.

import {
    Popover,
    TextView,
    Textarea,
    TextareaState,
    VirtualListScrollHandle,
    h_flex,
    v_flex,
    v_virtual_list,
} from 'gpui-base';
import { View, div, svg } from 'gpui-kit';
import {
    agents,
    checking,
    closeOverlay,
    exec,
    hc,
    home,
    layout,
    notify,
    openOverlay,
    props,
    readTextFile,
    run as runCommand,
    settings,
    shared,
    terminals,
    theme,
    watchFolder,
    writeTextFile,
} from 'herdr';

import {
    AUTO_WIND_DOOR,
    DECK_BLOCK,
    OVERRIDE_STORE,
    PRESS_DIR,
    PRESS_FILE,
    STATE_DIR,
    THREADS_KEY,
    autoWind,
    autoWindAfterRead,
    autoWindFlipped,
    bandButtons,
    bandOf,
    meterCells,
    meterTip,
    overrideOf,
    pendingOf,
    pressLine,
    pressesWaiting,
    stateLine,
    stateParts,
    turnClock,
    withPress,
} from './band.js';
import { splitBlocks } from './blocks.js';
import { createDrafts } from './draft.js';
import {
    EFFORTS,
    effortKey,
    effortWord,
    isPickWaiting,
    pickerLabel,
    slideEffort,
} from './effort.js';
import { placeOf } from './follow.js';
import { createHeights, guessHeight } from './heights.js';
import { ICONS } from './icons.js';
import {
    HOLD_DELAY_MS,
    HOLD_PUSH_MS,
    JOINED_SHOWN_MS,
    JOINS_DIR,
    JOIN_TAKE_MS,
    holdSend,
} from './joins.js';
import { LOOK_KEY, lookOf } from './look.js';
import { createMagic } from './magic.js';
import {
    MODELS,
    NO_RUNS_AT,
    PERMISSIONS,
    effortNow,
    modelNow,
    permissionIn,
    permissionOf,
    pickIn,
    runsAtAfter,
} from './picker.js';
import { createPlace } from './place.js';
import { sendArgs } from './queued.js';
import { createReader } from './reader.js';
import { createRowModel } from './row-model.js';
import { SUBMIT_REST_MS, addressIn, submitted } from './send.js';
import { transcriptPath } from './thread.js';
import { typedMarkdown } from './typed.js';

/** @typedef {import('gpui-kit').Color} Color */
/** @typedef {import('gpui-kit').Context} Context */
/** @typedef {import('./row-model.js').Row} Row */
// the theme colours this file reads, each present in every herdr theme
/** @typedef {Record<'accent' | 'background' | 'blocked' | 'border' | 'dim' | 'foreground' | 'hover' | 'muted' | 'popover' | 'raised' | 'selected' | 'solid' | 'solid_foreground' | 'working', Color>} Theme */

// the readable column of a narrow look (the old chat's), and the share of the column a bubble may take
const NARROW = 820;
const BUBBLE_SHARE = 0.8;
// the room above and below each row, per spacing
const ROW_PAD = { normal: 6, roomy: 10, tight: 3 };
// the ui font, as the old chat drew it
const SANS = '.AppleSystemUIFont';
// [TRACE-place] how long after an open the list's asks are traced
const TRACE_MS = 8000;

/** the rows the list draws: the model's, less tool calls when he hides them @param {readonly Row[]} rows @param {import('./look.js').Look} look */
const shownOf = (rows, look) =>
    look.tools === 'hide' ? rows.filter((row) => row.kind !== 'tool') : rows;
// his reading place is saved this long after his last scroll step
const PLACE_SAVE_MS = 600;
// how long after a held place was last asked for the list stays unseen: its landing takes two frames, and a
// reload asks again as each real height arrives
const SETTLE_MS = 120;
// earlier pages read at most this many times while looking for the message he was reading
const PLACE_PAGES = 8;
// a meter's cells, as the old chat drew them
const METER_CELLS = 48;
const CHIP_SIZE = 26;
// his quill's two cards sit one layer under it, a little narrower, flush against it (the old chat's PK-384 pick)
const NEST_INSET = 14;
// the terminals a permission change is typing into: it outlives a thread switch, so a second pick never runs beside it
const permissionBusy = new Set();

/** @param {Theme} t @param {'top' | 'bottom'} side */
const nestedCard = (t, side) => {
    const card = v_flex()
        .px(12)
        .bg(t.raised)
        .border_color(t.border)
        .border_l(1)
        .border_r(1);
    return side === 'top'
        ? card.pt(8).pb(8).rounded_t(12).border_t(1)
        : card.pt(6).pb(6).rounded_b(12).border_b(1);
};
// a 🍃 pressed on the cc band reaches no file herdr watches: the shown thread's key is asked again this often, and a
// read that failed this soon, never a minute of grey; a door that hangs (a lock, a prompt) ends at its timeout
const AUTO_WIND_MS = 60 * 1000;
const AUTO_WIND_RETRY_MS = 10 * 1000;
const AUTO_WIND_DOOR_MS = 10 * 1000;
// the picker's label flashes this long once a reply first ran at his pick
const APPLIED_FLASH_MS = 2000;
// a pick that shows no change by then says so
const PICK_WAIT_MS = 12000;
// the operator override changes with no event herdr watches, and a deck that stopped publishing changes nothing: the
// band's facts that age are read again this often
const BAND_AGE_MS = 5000;
// the old chat's settings window, opened as it opens it until the new one moves in
const SETTINGS_OVERLAY = {
    height: 0.74,
    kind: /** @type {const} */ ('dialog'),
    mod: 'x-herdr-chatter',
    props: { settingsWindow: 'chatter' },
    width: 0.6,
};
// his settings, kept by the old chat's settings window until the new one moves in
const SETTINGS_FILE = '.claude/shelf/herdr-settings/settings.json';
// under a mark, the join row is rewritten this long after his last key
const RETEXT_MS = 400;
const SEND_SIZE = 28;
const NOT_IN_HERDR = 'This thread does not run in herdr: nothing was sent';

/** the join file's doors in herdr: a mkdir lock dir, its age from macOS stat, a write over the text it read */
/** @type {import('./joins.js').JoinIo} */
const joinIo = {
    lock: async (path) =>
        (await exec('mkdir', [path]).catch(() => null))?.code === 0,
    lockAge: async (path) => {
        const out = await exec('stat', ['-f', '%m', path]).catch(() => null);
        const at = Number(out?.stdout.trim());
        return out?.code === 0 && at ? Date.now() - at * 1000 : null;
    },
    now: () => Date.now(),
    read: (path) => readTextFile(path),
    sleep: async (ms) => {
        await exec('sleep', [String(ms / 1000)]);
    },
    unlock: async (path) => {
        await exec('rmdir', [path]);
    },
    write: (path, body, expected) => writeTextFile(path, body, expected),
};

const newId = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) =>
        (c === 'x'
            ? Math.floor(Math.random() * 16)
            : Math.floor(Math.random() * 4) + 8
        ).toString(16),
    );

/** the thread's session, which names its state and join files @param {string} file its transcript */
const sidOf = (file) => file.slice(file.lastIndexOf('/') + 1, -'.jsonl'.length);

/** herdr's window answers only inside a call it made; a timer tick may get a throw, read as «still active» */
function isWindowActive() {
    try {
        return window.is_window_active() !== false;
    } catch {
        return true;
    }
}

/** a theme colour made see-through @param {Color} color @param {string} alpha two hex digits @returns {Color} */
const tint = (color, alpha) => `#${color.slice(1, 7)}${alpha}`;

/** @param {unknown} error */
const readError = (error) =>
    `This thread's transcript could not be read: ${error instanceof Error ? error.message : String(error)}`;

/** @param {string} program @param {string[]} args */
async function run(program, args) {
    const out = await exec(program, args);
    if (out.code !== 0)
        throw new Error(out.stderr.trim() || `${program} failed`);
    return out.stdout;
}

/**
 * the transcript file as the reader reaches it: herdr reads no byte range itself, so the shell does
 * @param {string} file
 * @returns {import('./reader.js').FileDoor}
 */
const doorTo = (file) => ({
    lineStartAt: async (at) =>
        at +
        Number(
            (
                await run('sh', [
                    '-c',
                    'tail -c +"$1" "$2" | head -n 1 | wc -c',
                    'sh',
                    String(at + 1),
                    file,
                ])
            ).trim(),
        ),
    read: (from, max) =>
        run('sh', [
            '-c',
            'tail -c +"$1" "$2" | head -c "$3"',
            'sh',
            String(from + 1),
            file,
            String(max),
        ]),
    sizeOf: async () => {
        const out = await exec('stat', ['-f', '%z', file]);
        return out.code === 0 ? Number(out.stdout.trim()) : null;
    },
});

/**
 * one press appended to the band press file with herdr's compare-and-swap write: a file changed since the read is read
 * again, so no other press is lost
 * @param {import('./band.js').PressLine} line
 */
async function appendPress(line) {
    await run('mkdir', ['-p', `${home()}/${PRESS_DIR}`]);
    const path = `${home()}/${PRESS_FILE}`;
    for (let tries = 2; ; tries--) {
        const text = await readTextFile(path).catch(() => null);
        try {
            return await writeTextFile(
                path,
                withPress(text, line, line.at),
                text,
            );
        } catch (error) {
            if (tries <= 1) throw error;
        }
    }
}

/** x-mod-stash's door for a session's 🍃, run in frame where `pnpm mods:set` lives @param {string[]} args */
async function autoWindDoor(args) {
    const out = await exec('pnpm', [...AUTO_WIND_DOOR, ...args], {
        cwd: `${home()}/frame`,
        timeout: AUTO_WIND_DOOR_MS,
    });
    if (out.code !== 0)
        throw new Error(
            out.stderr.trim() || out.stdout.trim() || 'mods:set failed',
        );
    return out.stdout;
}

/** whether his layout shows the deck's block; a layout without it reads as shown, so 🚦 offers a hide */
function isDeckShown() {
    /** @param {any} node @returns {any} */
    const find = (node) => {
        if (node?.id === DECK_BLOCK) return node;
        for (const child of node?.children ?? []) {
            const found = find(child);
            if (found) return found;
        }
        return null;
    };
    return !find(layout())?.hidden;
}

/**
 * a meter as a row of matte cells in a recessed rail, the lit ones in one colour (the old chat's, PK-384)
 * @param {Theme} t @param {number | null} pct @param {Color} fill
 */
const meterBar = (t, pct, fill) => {
    const lit = meterCells(pct, METER_CELLS);
    return h_flex()
        .h(9)
        .p(2)
        .gap(2)
        .rounded(4)
        .bg(t.background)
        .border(1)
        .border_color(t.border)
        .children(
            Array.from({ length: METER_CELLS }, (_, i) =>
                div()
                    .flex_1()
                    .h_full()
                    .rounded(1)
                    .bg(i < lit ? fill : t.border),
            ),
        );
};

export default class Chat extends View {
    scroll = VirtualListScrollHandle.new();
    model = createRowModel();
    heights = createHeights();
    /** @type {ReturnType<typeof createReader> | null} */
    reader = null;
    /** the pid of the thread shown, as the old chat publishes it @type {number | null} */
    pid = null;
    /** @type {string | null} */
    file = null;
    /** the pid the open thread was opened for; undefined before the first @type {number | null | undefined} */
    opened = undefined;
    /** his reading place: following the newest, or the first message on screen and the px of it above the view */
    at = createPlace();
    width = 0;
    viewH = 0;
    /** bumped when the width or the look changes: rich text laid out for the old one is never reused */
    widthGen = 0;
    /** his chat look (look.js), read each render */
    look = lookOf(null);
    /** the look's parts that move rows, as last drawn: a change holds his place */
    lookKey = '';
    /** the rows the list draws: the model's, less tool calls he hides @type {readonly Row[]} */
    shownRows = [];
    /** [TRACE-place] the list's asks are traced until then, after an open */
    traceUntil = 0;
    /** until then the list is not shown: a held place is still landing as real heights arrive */
    settleUntil = 0;
    /** the pending wait for a change in the transcript's folder @type {import('herdr').FolderWatch | null} */
    watch = null;
    /** @type {number[]} */
    sizes = [];
    lastWheelAt = 0;
    /** @type {string | null} */
    error = null;
    /** the open thread's transcript has been read once */
    isRead = false;
    /** the quill: herdr draws its text itself, so a key typed in it draws nothing of ours @type {import('gpui-base').TextareaState | null} */
    box = null;
    drafts = createDrafts(localStorage);
    /** where a message to the shown thread goes: its herdr address @type {string | null} */
    address = null;
    /** what the quill says about his last send: why it did not go, or why it went as a push @type {string | null} */
    note = null;
    /** the marks of the magic send: words waiting in the quill to join a turn */
    magic = createMagic({
        dir: `${home()}/${JOINS_DIR}`,
        io: joinIo,
        newId,
        store: localStorage,
    });
    /** what the shown thread's state lists of its joins; null: joins are off for it @type {import('./magic.js').Joins | null} */
    joins = null;
    /** the pending wait for a change in the threads' state folder @type {import('herdr').FolderWatch | null} */
    stateWatch = null;
    /** a press on send under way @type {{ at: number } | null} */
    hold = null;
    holdFill = 0;
    /** @type {{ cancel: () => void } | null} */
    holdTask = null;
    /** how long a hold takes to push: his two settings rows */
    timing = { delay: HOLD_DELAY_MS, push: HOLD_PUSH_MS };
    /** how full a meter gets before it warns: his two settings rows, their defaults until read */
    meterWarn = { ctx: 60, week: 80 };
    lastKeyAt = 0;
    /** the quill's text, and its text one change earlier: Enter types its line break before it submits */
    typedNow = '';
    lastSubmitAt = 0;
    typedBefore = '';
    /** one more at each thread opened: a state watch of an earlier opening ends */
    stateTurn = 0;
    /** the shown thread's band facts, as the stash wrote them @type {(import('./band.js').ThreadState & { sid: string }) | null} */
    bandThread = null;
    /** the fleet's afk and waker, as the stash wrote them @type {import('./band.js').FleetState | null} */
    fleet = null;
    /** the band press file, which the deck's presses reach too @type {string | null} */
    pressText = null;
    /** this band's own presses, until the state reads them @type {import('./band.js').Pending} */
    pressed = {};
    /** @type {import('./band.js').Override} */
    override = { isOn: false };
    /** the band as last drawn: a tick that finds it changed draws again */
    bandKey = '';
    isPressWatched = false;
    /** Stop was pressed and the turn still works: a background task Esc cannot stop */
    isStuck = false;
    /** each thread's 🍃 as the stash's door last read it, by session @type {Map<string, import('./band.js').AutoWind>} */
    autoWinds = new Map();
    /** one flip and one read in flight per thread: a click during a read still flips */
    autoWindFlipping = new Set();
    autoWindReading = new Set();
    /** auto second wind on for the fleet: his settings row; off, 🍃 leaves the band */
    hasAutoWind = true;
    /** the model and effort the shown thread runs at, as its transcript tells them */
    runsAt = NO_RUNS_AT;
    /** Claude's settings.json: the model and effort a session starts on @type {import('./picker.js').ClaudeSettings} */
    claudeSettings = null;
    /** a pick on its way to the shown thread @type {{ kind: 'model' | 'effort', value: string, until: number } | null} */
    pending = null;
    /** why a pick did not go, or did not land @type {string | null} */
    pickNote = null;
    isPickOpen = false;
    /** the effort slider while the picker is open @type {import('./effort.js').EffortPopover | null} */
    effortPop = null;
    /** a model switch waiting on his yes: it drops the thread's cache @type {string | null} */
    askModel = null;
    /** the thread's permission mode, read off its screen when the picker opens @type {string | null} */
    permission = null;
    /** a permission change on its way @type {string | null} */
    permissionAsked = null;
    isPermsOpen = false;
    /** the open picker holds the keyboard, so ← → reach the slider @type {import('gpui-kit').FocusHandle | null} */
    pickKeys = null;

    /** wakes the loop that opens the thread shown: a draw starts no work itself */
    wake = () => {};

    /**
     * @param {unknown} _props
     * @param {import('gpui-kit').AsyncContext} cx
     */
    init(_props, cx) {
        const box = TextareaState.new({});
        box.set_auto_grow(1, 8);
        box.on('change', (_event, cx) => {
            const now = box.value();
            // a change told twice is one change
            if (now !== this.typedNow) {
                this.typedBefore = this.typedNow;
                this.typedNow = now;
            }
            this.drafts.keep(this.file, now);
            this.typedUnderMark(box, cx);
        });
        box.on('submit', (event, cx) => {
            const { act, caret, text } = submitted(
                box.value(),
                [this.typedNow, this.typedBefore],
                event,
            );
            if (text === null) return;
            // Enter's line break leaves, his caret stays; the words stay until they are sent or a turn takes them
            this.setQuill(box, text);
            box.set_selected_range({ end: caret, start: caret });
            const at = Date.now();
            const isRepeat = at - this.lastSubmitAt < SUBMIT_REST_MS;
            this.lastSubmitAt = at;
            if (isRepeat) return;
            if (act === 'push') this.push(box, cx);
            else if (act === 'click') this.click(box, cx);
        });
        this.box = box;
        this.pickKeys = cx.focus_handle();
        // ← → slide the effort thumb, Enter applies, Esc closes: the open picker holds the keyboard
        cx.bind_keys(
            [
                ['left', 'x_herdr_chat_effort_left'],
                ['right', 'x_herdr_chat_effort_right'],
                ['enter', 'x_herdr_chat_effort_apply'],
                ['escape', 'x_herdr_chat_effort_close'],
            ].map(([keystroke, action]) => ({
                action: String(action),
                context: 'ChatPick',
                keystroke: String(keystroke),
            })),
        );
        // a check draws one frame and must read no thread
        if (checking()) return;
        this.ageBand(cx);
        cx.timer.every(BAND_AGE_MS, (later) => this.ageBand(later));
        cx.spawn(async (cx) => {
            for (;;) {
                const woken = new Promise((resolve) => {
                    this.wake = () => resolve(null);
                });
                // the thread to open is read after the wait is armed, so a switch during an open is never lost
                const pid = this.pid;
                if (pid !== this.opened) {
                    this.opened = pid;
                    this.open(pid, cx);
                }
                await woken;
            }
        });
    }

    /** @param {Context} _cx */
    render(_cx) {
        const t = /** @type {Theme} */ (theme());
        const shown = /** @type {{ pid?: unknown } | null} */ (
            shared('chat.shown') ?? null
        );
        const pid = typeof shown?.pid === 'number' ? shown.pid : null;
        if (pid !== this.pid) {
            this.pid = pid;
            this.wake();
        }
        const look = lookOf(shared(LOOK_KEY));
        const lookKey = [
            look.size,
            look.font,
            look.width,
            look.space,
            look.tools,
        ].join('|');
        const rows = shownOf(this.model.rows, look);
        if (this.lookKey && lookKey !== this.lookKey) {
            // every row takes a new height at once: his place is held as a share of its message while they land
            this.widthGen += 1;
            this.trace(
                `look ${this.lookKey} → ${lookKey} place=${JSON.stringify(this.at.place)} held=${this.at.isHeld} rows ${this.shownRows.length} → ${rows.length}`,
            );
            this.traceUntil = Date.now() + TRACE_MS;
            if (this.at.restyle(this.shownRows, this.sizes, rows))
                this.settleUntil = Date.now() + SETTLE_MS;
            this.heights.clear();
        }
        this.look = look;
        this.lookKey = lookKey;
        this.shownRows = rows;
        const root = v_flex()
            .size_full()
            .min_h(0)
            .bg(t.background)
            .text_color(t.foreground)
            .text_size(look.size)
            .font_family(
                look.font === 'mono'
                    ? String(settings().font_family ?? 'JetBrains Mono')
                    : SANS,
            );
        const overlay = props()?.overlay;
        if (overlay)
            root.child(
                h_flex()
                    .px(12)
                    .py(6)
                    .justify_between()
                    .items_center()
                    .border_color(t.border)
                    .child(div().text_color(t.muted).child('The new chat'))
                    .child(
                        div()
                            .id('chat-close')
                            .px(10)
                            .py(3)
                            .rounded(6)
                            .bg(t.raised)
                            .child('Close')
                            .on_click(() => closeOverlay(overlay)),
                    ),
            );
        if (rows.length) {
            if (this.error)
                root.child(
                    div()
                        .px(12)
                        .py(4)
                        .text_size(12)
                        .text_color(t.muted)
                        .bg(t.raised)
                        .child(this.error),
                );
            root.child(this.list(rows, t, _cx));
        } else
            root.child(
                div()
                    .flex_1()
                    .flex()
                    .items_center()
                    .justify_center()
                    .text_color(t.muted)
                    .child(this.error ?? this.emptyLine()),
            );
        if (!this.file || !this.box) return root;
        if (this.note)
            root.child(
                div()
                    .px(32)
                    .pb(6)
                    .text_size(12)
                    .text_color(t.muted)
                    .child(this.note),
            );
        if (this.pickNote)
            root.child(
                div()
                    .px(32)
                    .pb(6)
                    .text_size(12)
                    .text_color(t.accent)
                    .child(this.pickNote),
            );
        if (this.askModel) root.child(this.modelConfirm(this.askModel, t));
        const drawn = this.drawnNow(Date.now());
        this.bandKey = JSON.stringify(drawn);
        return root
            .child(this.band(drawn.band, t))
            .child(this.quill(this.box, t))
            .child(this.bar(drawn.bar, drawn.band.buttons, t));
    }

    /** the band and the bottom bar as they draw now @param {number} now */
    drawnNow(now) {
        const band = this.bandNow(now);
        return { band, bar: this.barNow(now, band.meters.wait) };
    }

    /**
     * the bottom bar as it draws now: a spinner or an idle ring, what the turn does, its clock, and Stop
     * @param {number} now
     * @param {string | null} wait what the idle thread waits on, as the deck read it
     */
    barNow(now, wait) {
        const status =
            agents().find((agent) => agent.address === this.address)?.status ??
            'idle';
        const isWorking = status === 'working';
        const turnAt = this.model.turnAt();
        const parts = stateParts({
            hasTurnAt: turnAt !== null,
            isStuck: this.isStuck,
            status,
        });
        const report = isWorking
            ? terminals().find((terminal) => terminal.address === this.address)
                  ?.report
            : null;
        return {
            clock:
                parts.hasClock && turnAt !== null
                    ? turnClock(now - turnAt)
                    : null,
            hasStop: parts.hasStop && this.address !== null,
            isWorking,
            line: stateLine({
                isBlocked: status === 'blocked',
                isStuck: isWorking && this.isStuck,
                isWorking,
                msg: typeof report === 'object' ? report?.msg : null,
                wait,
            }),
            mark: parts.mark,
        };
    }

    /**
     * the band as it draws now: its buttons, the thread's meters, and whether the deck still reads the thread
     * @param {number} now
     */
    bandNow(now) {
        const state = {
            fleet: this.fleet,
            isDeckShown: isDeckShown(),
            override: this.override,
            thread: this.bandThread,
        };
        const pending = pressesWaiting(
            this.pressed,
            pendingOf(this.pressText, this.bandThread?.sid, now),
            bandButtons(state),
            now,
        );
        return {
            buttons: bandButtons({
                ...state,
                autoWind:
                    this.autoWinds.get(this.bandThread?.sid ?? '')?.on ?? null,
                hasAutoWind: this.hasAutoWind,
                pending,
            }),
            meters: bandOf(shared(THREADS_KEY), this.pid, now),
        };
    }

    /**
     * the facts that age with no event: the override's store is read again, and the band draws again once a stale
     * deck, a press past its wait or the override changed what it shows
     * @param {Context} cx
     */
    ageBand(cx) {
        this.watchPresses(cx);
        // 🍃 asks a program, so it runs beside the file reads and never holds them
        cx.spawn((cx) => this.readAutoWind(cx));
        this.pressed = pressesWaiting(
            this.pressed,
            {},
            bandButtons({
                fleet: this.fleet,
                isDeckShown: true,
                override: this.override,
                thread: this.bandThread,
            }),
            Date.now(),
        );
        cx.spawn(async (cx) => {
            const text = await readTextFile(
                `${home()}/${OVERRIDE_STORE}`,
            ).catch(() => null);
            let store = null;
            try {
                store = JSON.parse(text ?? 'null');
            } catch {}
            this.override = overrideOf(store, Date.now());
            // Claude's own settings: the model and effort a session starts on
            const claude = await readTextFile(
                `${home()}/.claude/settings.json`,
            ).catch(() => null);
            let isChanged = false;
            try {
                const next = JSON.parse(claude ?? 'null');
                isChanged =
                    JSON.stringify(next) !==
                    JSON.stringify(this.claudeSettings);
                this.claudeSettings = next;
            } catch {}
            isChanged = this.settlePick() || isChanged;
            if (
                isChanged ||
                JSON.stringify(this.drawnNow(Date.now())) !== this.bandKey
            )
                cx.notify();
        });
    }

    /** the shown thread's 🍃 as the door reads it: asked on a new thread, then every AUTO_WIND_MS @param {Context} cx */
    async readAutoWind(cx) {
        const sid = this.bandThread?.sid;
        if (!sid || !this.hasAutoWind || this.autoWindReading.has(sid)) return;
        const last = this.autoWinds.get(sid);
        const wait = last?.on === null ? AUTO_WIND_RETRY_MS : AUTO_WIND_MS;
        if (last && Date.now() - last.at < wait) return;
        this.autoWindReading.add(sid);
        const flips = last?.flips ?? 0;
        try {
            /** @type {boolean | null} */
            let on = null;
            try {
                on = await autoWind(autoWindDoor, sid);
            } catch (error) {
                console.log(
                    `second wind auto: the door did not answer: ${error}`,
                );
            }
            this.autoWinds = autoWindAfterRead(
                this.autoWinds,
                sid,
                on,
                flips,
                Date.now(),
            );
            cx.notify();
        } finally {
            this.autoWindReading.delete(sid);
        }
    }

    /** 🍃 flips through the stash's door, and shows what the door then reads, never the click's own guess @param {import('./band.js').BandButton} btn @param {Context} cx */
    flipAutoWind(btn, cx) {
        const sid = this.bandThread?.sid;
        if (!sid || this.autoWindFlipping.has(sid)) return;
        this.autoWindFlipping.add(sid);
        cx.spawn(async (cx) => {
            try {
                const on = await autoWind(autoWindDoor, sid, !btn.isOn);
                this.autoWinds = autoWindFlipped(
                    this.autoWinds,
                    sid,
                    on,
                    Date.now(),
                );
            } catch (error) {
                notify({
                    body: String(error),
                    level: 'error',
                    title: 'second wind auto: the flip was not written',
                });
            } finally {
                this.autoWindFlipping.delete(sid);
            }
            cx.notify();
        });
    }

    /** a press on the deck or another band shows here at once; a folder not made yet is watched from the next tick @param {Context} cx */
    watchPresses(cx) {
        if (this.isPressWatched) return;
        this.isPressWatched = true;
        cx.spawn(async (cx) => {
            try {
                for (;;) {
                    const watch = watchFolder(`${home()}/${PRESS_DIR}`);
                    this.pressText = await readTextFile(
                        `${home()}/${PRESS_FILE}`,
                    ).catch(() => null);
                    cx.notify();
                    await watch;
                }
            } catch {
                this.isPressWatched = false;
            }
        });
    }

    /**
     * the card over the quill: the context and week meters, their numbers beside them
     * @param {ReturnType<Chat['bandNow']>} now
     * @param {Theme} t
     */
    band({ meters }, t) {
        /** @param {string} name @param {number | null} pct @param {number} warnAt */
        const meter = (name, pct, warnAt) =>
            h_flex()
                .id(`chat-meter-${name}`)
                .gap(8)
                .items_center()
                .tooltip(
                    meters.isStale
                        ? 'The deck has not read this thread for over 2 minutes'
                        : meterTip(name, pct),
                )
                .child(
                    div()
                        .w(20)
                        .flex_none()
                        .text_size(12)
                        .text_color(t.dim)
                        .child(name === 'ctx' ? '🧠' : '🫙'),
                )
                .child(
                    div()
                        .flex_1()
                        .child(
                            meterBar(
                                t,
                                pct,
                                meters.isStale
                                    ? t.dim
                                    : pct != null && pct >= warnAt
                                      ? t.blocked
                                      : t.accent,
                            ),
                        ),
                )
                .child(
                    div()
                        .w(36)
                        .flex_none()
                        .flex()
                        .justify_end()
                        .text_size(12)
                        .text_color(t.dim)
                        .child(pct == null ? '—' : `${Math.round(pct)}%`),
                );
        return this.nestedRow(
            'chat-band-row',
            nestedCard(t, 'top')
                .gap(3)
                // ctx above week (dima: «move ctx meter over the week»)
                .child(meter('ctx', meters.context, this.meterWarn.ctx))
                .child(meter('week', meters.week, this.meterWarn.week)),
        );
    }

    /**
     * a card nested under the quill, in the list's column, as wide as the quill less its inset
     * @param {string} id @param {ReturnType<typeof v_flex>} card
     */
    nestedRow(id, card) {
        return h_flex()
            .id(id)
            .w_full()
            .flex_none()
            .justify_center()
            .px(18)
            .on_mouse_down('left', (_event, cx) => cx.stop_propagation())
            .child(
                v_flex()
                    .w_full()
                    .max_w(this.column())
                    .px(NEST_INSET)
                    .child(card),
            );
    }

    /**
     * one chip: plain off, the accent's edge and tint on, 🔓 on loud red; a button whose press herdr cannot prove is
     * greyed, and a live one is a click, never a key (a keyed command is any shell's)
     * @param {import('./band.js').BandButton} btn
     * @param {Theme} t
     */
    bandChip(btn, t) {
        const isOverride = btn.key === 'override';
        const edge = btn.isOn ? (isOverride ? t.blocked : t.accent) : t.border;
        return div()
            .id(`chat-band-${btn.key}`)
            .size(CHIP_SIZE)
            .flex_none()
            .flex()
            .items_center()
            .justify_center()
            .rounded(6)
            .border(1)
            .border_color(edge)
            .bg(btn.isOn ? (isOverride ? t.blocked : t.selected) : t.background)
            .text_size(13)
            .tooltip(btn.tip)
            .when(!btn.isLive, (el) => el.opacity(0.4).cursor_not_allowed())
            .when(btn.isLive, (el) =>
                el
                    .cursor_pointer()
                    .hover((style) =>
                        style.border_color(btn.isOn ? edge : t.muted),
                    )
                    .on_click((_event, cx) => this.pressBand(btn, cx)),
            )
            .child(btn.emoji);
    }

    /** the shown thread's status, as herdr reads it */
    statusNow() {
        return agents().find((agent) => agent.address === this.address)?.status;
    }

    /** the model and effort the shown thread runs at, a pick on its way shown in their place */
    pickNow() {
        const model = modelNow(this.runsAt, this.claudeSettings);
        const effort = effortNow(this.runsAt, this.claudeSettings);
        const { pending } = this;
        return {
            effort,
            isApplied:
                this.runsAt.appliedAt !== null &&
                Date.now() - this.runsAt.appliedAt < APPLIED_FLASH_MS,
            model,
            pending,
            shownEffort: pending?.kind === 'effort' ? pending.value : effort,
            shownModel: pending?.kind === 'model' ? pending.value : model,
        };
    }

    /**
     * a pick made in Claude's own /model or /effort picker; the label says «…» until the transcript shows it, or says
     * after 12 s that it did not. never while Claude asks him something: the keys would answer it
     * @param {'model' | 'effort'} kind @param {string} value @param {Context} cx
     */
    pick(kind, value, cx) {
        const { address } = this;
        if (!address) return;
        if (
            this.statusNow() === 'blocked' ||
            this.pending ||
            permissionBusy.has(address)
        ) {
            this.pickNote =
                this.pending || permissionBusy.has(address)
                    ? 'One switch at a time: wait for this one to land'
                    : 'Answer Claude first, then pick';
            cx.notify();
            return;
        }
        this.closePick();
        this.pending = { kind, until: Date.now() + PICK_WAIT_MS, value };
        this.pickNote = null;
        cx.notify();
        cx.spawn(async (cx) => {
            try {
                const isTaken = await pickIn(kind, value, {
                    editorMode: this.claudeSettings?.editorMode,
                    keys: async (keys) => {
                        if (keys.length) await hc(['keys', address, ...keys]);
                    },
                    screen: async () =>
                        (await hc(['read', address])).stdout.replace(/\r/g, ''),
                    sleep: (ms) => cx.sleep(ms),
                    status: () =>
                        agents().find((agent) => agent.address === address)
                            ?.status,
                });
                // mid-turn the pick writes nothing to the transcript: the label takes it once the picker closed
                if (isTaken && this.address === address)
                    this.runsAt =
                        kind === 'model'
                            ? { ...this.runsAt, model: value }
                            : {
                                  ...this.runsAt,
                                  effort: {
                                      isPicked: true,
                                      level: value,
                                      model: modelNow(
                                          this.runsAt,
                                          this.claudeSettings,
                                      ),
                                  },
                              };
            } catch (error) {
                if (this.address === address) {
                    this.pending = null;
                    this.pickNote =
                        error instanceof Error ? error.message : String(error);
                }
            }
            cx.notify();
        });
    }

    /**
     * whether the pick in flight landed or timed out: a picked effort stays «…» until a reply runs at it, mid-turn
     * too; a turn that ended first holds it for the next turn
     * @returns {boolean} whether anything changed
     */
    settlePick() {
        const p = this.pending;
        if (!p) return false;
        const { effort, model } = this.pickNow();
        const now = p.kind === 'model' ? model : effort;
        if (
            p.kind === 'effort' &&
            this.runsAt.effort?.isPicked &&
            now === p.value
        ) {
            if (isPickWaiting(true, this.statusNow())) return false;
            this.runsAt = {
                ...this.runsAt,
                effort: { ...this.runsAt.effort, isPicked: false },
            };
            this.pending = null;
            return true;
        }
        if (now === p.value) {
            this.pending = null;
            return true;
        }
        if (Date.now() <= p.until) return false;
        this.pending = null;
        this.pickNote = 'No change seen: look at the Terminal';
        return true;
    }

    closePick() {
        this.isPickOpen = false;
        this.effortPop = null;
    }

    /** the open slider holds the keyboard; closed, the caret goes back to the quill, a frame later @param {Context} cx */
    focusPick(cx) {
        if (!this.isPickOpen) {
            this.box?.focus();
            return;
        }
        cx.timer.after(16, () => this.pickKeys?.focus());
    }

    /** Enter in the open slider applies the stop picked and closes it @param {Context} cx */
    applyEffort(cx) {
        const isBlocked = this.statusNow() === 'blocked';
        const r = effortKey(
            this.isPickOpen ? this.effortPop : null,
            this.pickNow().shownEffort,
            isBlocked,
        );
        this.effortPop = r.popover;
        this.isPickOpen = Boolean(r.popover);
        this.pickNote = isBlocked ? 'Answer Claude first, then pick' : null;
        if (r.apply) this.pick('effort', r.apply, cx);
        this.focusPick(cx);
        cx.notify();
    }

    /**
     * the quill's one picker, shepherdr's shape (dima's o10 pick, 2026-11-13): «Opus 5.5 · Medium ⌄» left of send, its
     * popover the model list over the effort slider. both switch mid-turn: the next reply uses the pick
     * @param {Theme} t
     */
    picker(t) {
        const ready = this.statusNow() !== 'blocked';
        const { effort, isApplied, model, pending, shownEffort, shownModel } =
            this.pickNow();
        const trigger = h_flex()
            .id('chat-pick-trigger')
            .flex_none()
            .gap(4)
            .px(6)
            .h(24)
            .items_center()
            .rounded(6)
            .when(this.isPickOpen, (el) => el.bg(t.hover))
            .cursor_pointer()
            .text_size(12)
            .text_color(pending ? t.accent : t.muted)
            .when(isApplied, (el) =>
                el.bg(t.solid).text_color(t.solid_foreground),
            )
            .hover((style) => style.bg(t.hover).text_color(t.foreground))
            .child(pickerLabel(model, effort, pending))
            .child(
                svg('mods/workspace-chrome/chevron-down.svg')
                    .size(12)
                    .text_color(t.dim),
            );
        /** @param {string} value */
        const row = (value) =>
            h_flex()
                .id(`chat-pick-model-${value}`)
                .gap(10)
                .px(9)
                .h(31)
                .items_center()
                .rounded(7)
                .text_size(13)
                .text_color(value === shownModel ? t.foreground : t.muted)
                .when(value !== shownModel && ready, (el) =>
                    el
                        .cursor_pointer()
                        .hover((style) =>
                            style.bg(t.hover).text_color(t.foreground),
                        )
                        .on_click((_event, cx) => {
                            this.closePick();
                            // a model switch mid-conversation drops the thread's cache: it asks first
                            if (this.model.rows.length) this.askModel = value;
                            else this.pick('model', value, cx);
                            this.box?.focus();
                            cx.notify();
                        }),
                )
                .when(!ready, (el) => el.text_color(t.dim))
                .when(value === shownModel && pending?.kind === 'model', (el) =>
                    el.text_color(t.accent),
                )
                .child(div().flex_1().child(value))
                .child(
                    div()
                        .w(14)
                        .flex_none()
                        .text_color(t.foreground)
                        .child(value === shownModel ? '✓' : ''),
                );
        /** @param {string} text */
        const head = (text) =>
            div().px(9).pt(8).pb(4).text_size(11).text_color(t.dim).child(text);
        const chosenEffort =
            EFFORTS[this.effortPop?.at ?? -1] ?? shownEffort ?? null;
        // each level as wide as its word, the room left shared out, the chosen one raised (shepherdr's segments)
        const levels = h_flex()
            .mx(4)
            .my(3)
            .h(28)
            .gap(2)
            .p(2)
            .rounded(7)
            .bg(t.selected)
            .children(
                EFFORTS.map((level) =>
                    div()
                        .id(`chat-pick-level-${level}`)
                        .flex_auto()
                        .h_full()
                        .flex()
                        .items_center()
                        .justify_center()
                        .rounded(5)
                        .text_size(11.5)
                        .when(level === chosenEffort, (el) =>
                            el
                                .bg(isApplied ? t.solid : t.popover)
                                .text_color(
                                    isApplied
                                        ? t.solid_foreground
                                        : pending?.kind === 'effort'
                                          ? t.accent
                                          : t.foreground,
                                )
                                .font_weight(500)
                                .shadow_sm(),
                        )
                        .when(level !== chosenEffort, (el) =>
                            el.text_color(t.muted),
                        )
                        .when(ready && level !== shownEffort, (el) =>
                            el
                                .cursor_pointer()
                                .hover((style) =>
                                    style.text_color(t.foreground),
                                )
                                .on_click((_event, cx) => {
                                    this.closePick();
                                    if (level !== shownEffort)
                                        this.pick('effort', level, cx);
                                    this.box?.focus();
                                    cx.notify();
                                }),
                        )
                        .child(effortWord(level)),
                ),
            );
        return Popover.new('chat-pick')
            .anchor('bottom_right')
            .open(this.isPickOpen)
            .on_open_change((isOpen, cx) => {
                // a thread asking him something opens nothing: a pick would type into its question
                this.isPickOpen = isOpen && ready;
                this.effortPop = this.isPickOpen
                    ? effortKey(null, shownEffort, false).popover
                    : null;
                this.pickNote =
                    isOpen && !ready ? 'Answer Claude first, then pick' : null;
                this.isPermsOpen = false;
                if (this.isPickOpen) this.readPermission(cx);
                this.focusPick(cx);
                cx.notify();
            })
            .trigger(trigger)
            .content(
                v_flex()
                    .id('chat-pick-pop')
                    .track_focus(
                        /** @type {import('gpui-kit').FocusHandle} */ (
                            this.pickKeys
                        ),
                    )
                    .key_context('ChatPick')
                    .on_action('x_herdr_chat_effort_left', (_event, cx) =>
                        this.slideEffort('left', cx),
                    )
                    .on_action('x_herdr_chat_effort_right', (_event, cx) =>
                        this.slideEffort('right', cx),
                    )
                    .on_action('x_herdr_chat_effort_apply', (_event, cx) =>
                        this.applyEffort(cx),
                    )
                    .on_action('x_herdr_chat_effort_close', (_event, cx) => {
                        this.closePick();
                        this.box?.focus();
                        cx.notify();
                    })
                    .relative()
                    .w(340)
                    .p(5)
                    .mb(6)
                    .rounded(10)
                    .bg(t.popover)
                    .border(1)
                    .border_color(t.border)
                    .shadow_md()
                    .child(head('Model'))
                    .children(MODELS.map(([, label]) => row(label ?? '')))
                    .child(div().mx(4).my(4).h(1).bg(t.border))
                    .child(head('Reasoning'))
                    .child(levels)
                    .child(div().mx(4).my(4).h(1).bg(t.border))
                    .child(this.permissionsRow(t, ready))
                    .when(this.isPermsOpen, (el) =>
                        el.child(this.permissionsMenu(t, ready)),
                    ),
            );
    }

    /** shepherdr's row: «Permissions · Full access ›», its five modes in a small menu over the picker's foot @param {Theme} t @param {boolean} ready */
    permissionsRow(t, ready) {
        const shown = this.permissionAsked ?? this.permission;
        const label = PERMISSIONS.find((p) => p.id === shown)?.label ?? '…';
        return h_flex()
            .id('chat-permissions')
            .gap(10)
            .px(9)
            .h(31)
            .items_center()
            .rounded(7)
            .text_size(13)
            .text_color(ready ? t.foreground : t.dim)
            .when(this.isPermsOpen, (el) => el.bg(t.hover))
            .when(ready, (el) =>
                el
                    .cursor_pointer()
                    .hover((style) => style.bg(t.hover))
                    .on_click((_event, cx) => {
                        this.isPermsOpen = !this.isPermsOpen;
                        cx.notify();
                    }),
            )
            .child(div().flex_1().child('Permissions'))
            .child(
                div()
                    .text_size(12)
                    .text_color(this.permissionAsked ? t.accent : t.muted)
                    .child(label),
            )
            .child(div().text_color(t.dim).child('›'));
    }

    /** the five modes, inline under the row: a menu floating over the picker's rows would let a click reach them too @param {Theme} t @param {boolean} ready */
    permissionsMenu(t, ready) {
        const shown = this.permissionAsked ?? this.permission;
        return v_flex()
            .id('chat-permissions-menu')
            .mx(4)
            .mb(2)
            .p(3)
            .rounded(8)
            .bg(t.selected)
            .children(
                PERMISSIONS.map(({ id, label }) =>
                    h_flex()
                        .id(`chat-permission-${id}`)
                        .gap(10)
                        .px(9)
                        .h(29)
                        .items_center()
                        .rounded(6)
                        .text_size(13)
                        .text_color(id === shown ? t.foreground : t.muted)
                        .when(ready, (el) =>
                            el
                                .cursor_pointer()
                                .hover((style) =>
                                    style.bg(t.hover).text_color(t.foreground),
                                )
                                .on_click((_event, cx) => {
                                    if (id !== shown)
                                        this.pickPermission(id, label, cx);
                                    else {
                                        this.isPermsOpen = false;
                                        cx.notify();
                                    }
                                }),
                        )
                        .child(div().flex_1().child(label))
                        .child(
                            div()
                                .w(14)
                                .flex_none()
                                .text_color(t.foreground)
                                .child(id === shown ? '✓' : ''),
                        ),
                ),
            );
    }

    /** the mode line at the foot of the thread's screen, read when the picker opens @param {Context} cx */
    readPermission(cx) {
        const { address } = this;
        if (!address) return;
        cx.spawn(async (cx) => {
            const out = await hc(['read', address]).catch(() => null);
            if (this.address !== address || !out) return;
            this.permission = permissionOf(out.stdout.replace(/\r/g, ''));
            cx.notify();
        });
    }

    /**
     * Shift+Tab in the thread until its mode line reads the mode picked: it applies live, mid-turn too (probed
     * 2026-11-17), so nothing restarts
     * @param {string} mode @param {string} label @param {Context} cx
     */
    pickPermission(mode, label, cx) {
        const { address } = this;
        if (!address || permissionBusy.has(address)) return;
        const isBlocked =
            agents().find((a) => a.address === address)?.status === 'blocked';
        // keys typed into a question would answer it, and keys mixed into a model or effort pick would land in its picker
        if (isBlocked || this.pending) {
            this.pickNote = isBlocked
                ? 'Answer Claude first, then pick'
                : 'One switch at a time: wait for this one to land';
            this.isPermsOpen = false;
            cx.notify();
            return;
        }
        permissionBusy.add(address);
        this.permissionAsked = mode;
        this.isPermsOpen = false;
        cx.notify();
        cx.spawn(async (cx) => {
            try {
                const now = await permissionIn(mode, {
                    isBlocked: () =>
                        agents().find((a) => a.address === address)?.status ===
                        'blocked',
                    keys: async (keys) => {
                        await hc(['keys', address, ...keys]);
                    },
                    screen: async () =>
                        (await hc(['read', address])).stdout.replace(/\r/g, ''),
                    sleep: (ms) => cx.sleep(ms),
                });
                if (this.address !== address) return;
                this.permission = now;
                if (now !== mode)
                    this.pickNote = `${label} is not in this thread's Shift+Tab cycle`;
            } catch (error) {
                // keys may have gone before the failure: the mode shown is unknown until the picker reads it again
                if (this.address === address) {
                    this.permission = null;
                    this.pickNote =
                        error instanceof Error ? error.message : String(error);
                }
            } finally {
                permissionBusy.delete(address);
                if (this.address === address) this.permissionAsked = null;
                cx.notify();
            }
        });
    }

    /** @param {'left' | 'right'} way @param {Context} cx */
    slideEffort(way, cx) {
        if (!this.isPickOpen || !this.effortPop) return;
        this.effortPop = slideEffort(this.effortPop, way);
        cx.notify();
    }

    /** a model switch mid-conversation, asked first: the next message re-reads the whole history uncached @param {string} value @param {Theme} t */
    modelConfirm(value, t) {
        /** @param {string} id @param {string} word @param {boolean} isMain @param {(cx: Context) => void} act */
        const choice = (id, word, isMain, act) =>
            div()
                .id(id)
                .px(10)
                .py(3)
                .rounded(6)
                .bg(isMain ? t.solid : t.raised)
                .text_color(isMain ? t.solid_foreground : t.foreground)
                .cursor_pointer()
                .child(word)
                .on_click((_event, cx) => {
                    this.askModel = null;
                    act(cx);
                    cx.notify();
                });
        return h_flex()
            .w_full()
            .flex_none()
            .justify_center()
            .px(18)
            .pb(6)
            .child(
                v_flex()
                    .w_full()
                    .max_w(this.column())
                    .gap(8)
                    .p(10)
                    .rounded(8)
                    .border(1)
                    .border_color(t.border)
                    .bg(t.raised)
                    .text_size(12)
                    .child(
                        div()
                            .font_semibold()
                            .child(`Switch this thread to ${value}?`),
                    )
                    .child(
                        div()
                            .text_color(t.muted)
                            .child(
                                'Its cache is lost: the next message re-reads the whole conversation, slower and pricier.',
                            ),
                    )
                    .child(
                        h_flex()
                            .gap(6)
                            .child(
                                choice(
                                    'chat-model-switch',
                                    `Switch to ${value}`,
                                    true,
                                    (cx) => this.pick('model', value, cx),
                                ),
                            )
                            .child(
                                choice(
                                    'chat-model-keep',
                                    'Keep',
                                    false,
                                    () => {},
                                ),
                            ),
                    ),
            );
    }

    /**
     * the card under the quill: the thread's state, its turn clock and Stop, which stays pressable while the line
     * truncates in a narrow window, then the band's buttons on the right
     * @param {ReturnType<Chat['barNow']>} now
     * @param {ReturnType<Chat['bandNow']>['buttons']} buttons
     * @param {Theme} t
     */
    bar({ clock, hasStop, isWorking, line, mark }, buttons, t) {
        return this.nestedRow(
            'chat-bar-row',
            nestedCard(t, 'bottom')
                .flex_row()
                .px(8)
                .gap(6)
                .items_center()
                .child(
                    h_flex()
                        .flex_1()
                        .min_w(0)
                        .h(26)
                        .gap(8)
                        .items_center()
                        .text_size(12)
                        .text_color(t.muted)
                        .child(
                            mark === 'spinner'
                                ? svg('mods/workspace-chrome/spinner.svg')
                                      .size(12)
                                      .flex_none()
                                      .text_color(t.working)
                                      .spin(900)
                                : div()
                                      .size(10)
                                      .flex_none()
                                      .rounded_full()
                                      .border(1)
                                      .border_color(t.dim),
                        )
                        .child(
                            div()
                                .id('chat-bar-line')
                                .flex_1()
                                .min_w(0)
                                .truncate()
                                .text_color(isWorking ? t.foreground : t.muted)
                                .tooltip(line)
                                .child(line),
                        )
                        .when(clock !== null, (el) =>
                            el.child(
                                div()
                                    .flex_none()
                                    .text_color(t.dim)
                                    .child(clock ?? ''),
                            ),
                        )
                        .when(hasStop, (el) =>
                            el.child(
                                div()
                                    .id('chat-stop')
                                    .flex_none()
                                    .px(10)
                                    .py(3)
                                    .rounded(6)
                                    .bg(t.raised)
                                    .text_color(t.foreground)
                                    .cursor_pointer()
                                    .hover((style) => style.bg(t.border))
                                    .tooltip(
                                        "Stop Claude's turn (Esc in the thread)",
                                    )
                                    .child('Stop')
                                    .on_click((_event, cx) => this.stop(cx)),
                            ),
                        ),
                )
                .child(
                    h_flex()
                        .flex_none()
                        .gap(4)
                        .children(buttons.map((btn) => this.bandChip(btn, t))),
                ),
        ).pb(10);
    }

    /**
     * Stop presses Esc in the thread, never `hc interrupt`: that presses Ctrl+C, and a second one quits Claude. a turn
     * still working 3 s later runs a background task Esc cannot stop, and the bar says so for a while
     * @param {Context} cx
     */
    stop(cx) {
        const address = this.address;
        if (!address) return;
        cx.spawn(async () => {
            await hc(['keys', address, 'esc']);
        });
        cx.timer.after(3000, (later) => {
            const isStill =
                agents().find((agent) => agent.address === address)?.status ===
                'working';
            if (!isStill || this.address !== address) return;
            this.isStuck = true;
            later.notify();
            later.timer.after(8000, (after) => {
                this.isStuck = false;
                after.notify();
            });
        });
    }

    /**
     * 🚦 and 🎛️ act at once; wind, hot, waker, AFK and 🔓 write a press the stash answers, the state it asks for
     * shown until then
     * @param {import('./band.js').BandButton} btn
     * @param {Context} cx
     */
    pressBand(btn, cx) {
        if (btn.key === 'board') {
            runCommand('layout.toggle', { id: DECK_BLOCK });
            cx.notify();
            return;
        }
        if (btn.key === 'settings') {
            openOverlay(SETTINGS_OVERLAY);
            return;
        }
        if (btn.key === 'auto') {
            this.flipAutoWind(btn, cx);
            return;
        }
        const key = /** @type {import('./band.js').PressKey} */ (btn.key);
        if (!['wind', 'hot', 'waker', 'afk', 'override'].includes(key)) return;
        const sid = this.bandThread?.sid ?? null;
        if ((key === 'wind' || key === 'hot') && !sid) return;
        const at = Date.now();
        const on = !btn.isOn;
        this.pressed = { ...this.pressed, [key]: { at, on } };
        cx.notify();
        cx.spawn(async (cx) => {
            try {
                await appendPress(pressLine(key, on, sid, at));
            } catch (error) {
                const { [key]: _dropped, ...rest } = this.pressed;
                this.pressed = rest;
                notify({
                    body: String(error),
                    level: 'error',
                    title: `${btn.word}: the press was not written`,
                });
            }
            cx.notify();
        });
    }

    /**
     * his text box, in the list's column
     * @param {import('gpui-base').TextareaState} box
     * @param {Theme} t
     */
    quill(box, t) {
        return (
            h_flex()
                .id('chat-quill-row')
                .w_full()
                .flex_none()
                .justify_center()
                .px(18)
                // opened as a window, a press herdr is not told to keep drags it: only the head row moves it
                .on_mouse_down('left', (_event, cx) => cx.stop_propagation())
                .child(
                    div()
                        .w_full()
                        .max_w(this.column())
                        .relative()
                        .px(14)
                        .pt(12)
                        // the send button sits in the card's bottom right corner, the text keeps clear of it
                        .pb(SEND_SIZE + 12)
                        .rounded(12)
                        .bg(t.background)
                        .border(1)
                        .border_color(t.border)
                        .child(Textarea.new(box))
                        .child(
                            // the picker sits left of send, as shepherdr's does
                            div()
                                .absolute()
                                .right(8 + SEND_SIZE + 6)
                                .bottom(10)
                                .child(this.picker(t)),
                        )
                        .child(this.sendButton(box, t)),
                )
        );
    }

    /**
     * a click marks the quill's words to join the thread's turn, a hold sends them now
     * @param {import('gpui-base').TextareaState} box
     * @param {Theme} t
     */
    sendButton(box, t) {
        const mark = this.magic.markOf(this.file);
        const icon = !mark
            ? ICONS.sendRest
            : mark.state === 'joined'
              ? ICONS.sendTaken
              : ICONS.sendReady;
        return div()
            .id('chat-send')
            .absolute()
            .right(8)
            .bottom(8)
            .size(SEND_SIZE)
            .rounded(SEND_SIZE / 2)
            .flex()
            .items_center()
            .justify_center()
            .overflow_hidden()
            .bg(t.raised)
            .text_size(13)
            .cursor_pointer()
            .hover((style) => style.bg(t.border))
            .tooltip(
                mark?.state === 'pending'
                    ? 'Take it back (Enter), hold to send now'
                    : 'Join the turn (Enter), hold to send now (⌘Enter)',
            )
            .on_mouse_down('left', (_event, cx) => this.press(box, cx))
            .on_mouse_up('left', (_event, cx) =>
                this.holdStep(box, 'release', cx),
            )
            .on_hover((isOver, cx) => {
                if (!isOver) this.holdStep(box, 'cancel', cx);
            })
            .when(this.holdFill > 0, (el) =>
                // a disc grows from the centre while the hold runs
                el.child(
                    div()
                        .absolute()
                        .left((SEND_SIZE / 2) * (1 - this.holdFill))
                        .top((SEND_SIZE / 2) * (1 - this.holdFill))
                        .size(SEND_SIZE * this.holdFill)
                        .rounded(SEND_SIZE / 2)
                        .bg(t.accent),
                ),
            )
            .child(div().relative().child(icon));
    }

    /** what the view says while it has no row to draw */
    emptyLine() {
        if (this.pid === null) return 'No thread is shown here yet';
        if (!this.file) return 'Opening the thread…';
        return this.isRead
            ? 'Nothing to show in this thread yet'
            : 'Reading the thread…';
    }

    /**
     * @param {readonly Row[]} rows
     * @param {Theme} t
     * @param {Context} cx
     */
    list(rows, t, cx) {
        const zoom = Number(settings().zoom) || 1;
        const sizes = this.heights.sizes(rows, (row) =>
            guessHeight(row, Math.min(this.width || NARROW, this.column())),
        );
        this.sizes = sizes;
        const pre = `w${this.widthGen}-`;
        const plan = this.at.plan(rows, sizes, this.viewH);
        if (plan.ask && Date.now() < this.traceUntil)
            this.trace(
                `plan ask=${plan.ask} seekAt=${plan.seekAt} follow=${this.at.follow} held=${this.at.isHeld}`,
            );
        const { cutAt, cutOffset, itemSizes, rowAt } = plan;
        // his place, or the newest: asked of the list before the frame that draws these rows
        if (plan.ask === 'lift') {
            // the list lands an item's top on the view's top only from below it: to the end first, then the place
            this.scroll.scroll_to_bottom();
            cx.timer.after(0, (later) => later.notify());
        } else if (plan.ask === 'seek')
            this.scroll.scroll_to_item(plan.seekAt, 'top');
        else if (plan.ask === 'end') this.scroll.scroll_to_bottom();
        // a held place lands unseen: the frames it takes would show him other rows first
        const settleFor = this.at.isHeld ? this.settleUntil - Date.now() : 0;
        const isSettling = settleFor > 0;
        if (isSettling)
            cx.timer.after(settleFor + 1, (later) => later.notify());
        const list = v_virtual_list(
            'chat-rows',
            itemSizes.length,
            itemSizes,
            (i) => {
                const id = rows[rowAt(i)]?.id ?? `end-${i}`;
                if (i === cutAt) return `${id}#above`;
                return i === cutAt + 1 && cutAt >= 0 ? `${id}#below` : id;
            },
            (drawn) => {
                // no redraw is asked for in here, herdr refuses one: a ↓ that should leave does so at the next draw
                this.at.drawn(drawn, plan, Date.now());
                const items = [];
                for (let i = drawn.start; i < drawn.end; i++) {
                    const row = rows[rowAt(i)];
                    const box = div()
                        .relative()
                        .w_full()
                        .h(itemSizes[i] ?? 1);
                    // an end mark (follow.js END_MARKS): the list pairs each element with its item, so none is skipped
                    if (!row) {
                        items.push(box);
                        continue;
                    }
                    if (i === cutAt)
                        items.push(
                            box
                                .overflow_hidden()
                                .child(this.row(row, t, `${pre}a-`)),
                        );
                    else if (cutAt >= 0 && i === cutAt + 1)
                        items.push(
                            box.overflow_hidden().child(
                                div()
                                    .absolute()
                                    .top(-cutOffset)
                                    .left(0)
                                    .w_full()
                                    .child(this.row(row, t, `${pre}b-`)),
                            ),
                        );
                    else items.push(box.child(this.row(row, t, pre)));
                }
                return items;
            },
        )
            .track_scroll(this.scroll)
            .size_full();
        return div()
            .id('chat-list')
            .on_mouse_down('left', (_event, cx) => cx.stop_propagation())
            .relative()
            .flex_1()
            .min_h(0)
            .overflow_hidden()
            .opacity(isSettling ? 0 : 1)
            .on_size_change((size, cx) => {
                const width = size.width / zoom;
                const height = size.height / zoom;
                if (Math.abs(width - this.width) > 1) {
                    this.width = width;
                    this.widthGen += 1;
                    this.readPlace();
                    this.heights.clear();
                    // every height is guessed again: his place is brought back as the real ones arrive
                    this.holdPlace();
                }
                this.viewH = height;
                cx.notify();
            })
            .on_scroll_wheel((event, cx) => {
                const step = this.at.wheel(
                    (event.delta?.y ?? 0) / zoom,
                    this.shownRows,
                    this.sizes,
                    this.viewH,
                    Date.now(),
                );
                if (step.isIgnored) return;
                this.savePlaceSoon(cx);
                if (step.hadCut || step.isFollowChanged) cx.notify();
            })
            .child(list)
            .child(this.measurer(rows, t, `m${this.widthGen}-`))
            .when(!this.at.follow, (el) =>
                el.child(
                    div()
                        .id('chat-newest')
                        .absolute()
                        .bottom(12)
                        .right(16)
                        .px(9)
                        .py(3)
                        .rounded(10)
                        .bg(t.raised)
                        .text_color(t.muted)
                        .tooltip('Go to the newest')
                        .child(ICONS.newest)
                        .on_click((_event, cx) => {
                            this.at.newest();
                            if (this.file)
                                localStorage.removeItem(
                                    this.placeKey(this.file),
                                );
                            cx.notify();
                        }),
                ),
            );
    }

    /**
     * rows drawn out of sight at the list's width, so each one's real height reaches the height book
     * @param {readonly Row[]} rows
     * @param {Theme} t
     * @param {string} pre
     */
    measurer(rows, t, pre) {
        return div()
            .absolute()
            .top(0)
            .left(0)
            .w(this.width || NARROW)
            .h(0)
            .overflow_hidden()
            .opacity(0)
            .child(
                v_flex()
                    .w_full()
                    .children(
                        this.heights.toMeasure(rows, this.at.range).map((row) =>
                            div()
                                .id(`${pre}${row.id}@${row.version}`)
                                .flex_none()
                                .w_full()
                                .on_size_change((size, cx) => {
                                    const zoom = Number(settings().zoom) || 1;
                                    this.readPlace();
                                    if (
                                        !this.heights.record(
                                            row,
                                            size.height / zoom,
                                        )
                                    )
                                        return;
                                    if (
                                        this.at.measured(
                                            rows,
                                            rows.indexOf(row),
                                            Date.now(),
                                        )
                                    )
                                        this.settleUntil =
                                            Date.now() + SETTLE_MS;
                                    cx.notify();
                                })
                                .child(this.row(row, t, pre)),
                        ),
                    ),
            );
    }

    /**
     * @param {Row} row
     * @param {Theme} t
     * @param {string} pre what tells this copy's rich text from the measured copy's
     */
    row(row, t, pre) {
        const column = (/** @type {import('gpui-kit').Element} */ el) =>
            h_flex()
                .w_full()
                .justify_center()
                .child(
                    div()
                        .w_full()
                        .max_w(this.column() + 36)
                        .px(18)
                        .py(ROW_PAD[this.look.space] ?? ROW_PAD.normal)
                        .child(el),
                );
        if (row.kind === 'tool')
            return column(
                h_flex()
                    .gap(6)
                    .items_center()
                    .text_size(12)
                    .text_color(t.dim)
                    .child(div().size(6).rounded(3).bg(t.dim))
                    .child(div().truncate().child(row.text)),
            );
        const most = Math.max(
            240,
            Math.floor(
                Math.min(this.width || NARROW, this.column()) * BUBBLE_SHARE,
            ),
        );
        const id = `${pre}${row.id}@${row.version}`;
        if (row.kind === 'mine')
            return column(
                v_flex()
                    .w_full()
                    .items_end()
                    .gap(2)
                    .child(
                        div()
                            .max_w(most)
                            .px(12)
                            .py(8)
                            .rounded(12)
                            // a waiting message is an outline of his bubble, its words dim, until a turn takes it
                            .bg(
                                row.isWaiting
                                    ? t.background
                                    : tint(t.accent, '33'),
                            )
                            .border(1)
                            .border_color(
                                tint(t.accent, row.isWaiting ? '99' : '4d'),
                            )
                            .when(row.isWaiting, (el) => el.opacity(0.6))
                            .child(
                                TextView.markdown(
                                    id,
                                    typedMarkdown(row.text),
                                ).selectable(true),
                            ),
                    )
                    .when(row.isWaiting, (el) =>
                        el.child(
                            div()
                                .px(4)
                                .text_size(12)
                                .text_color(t.muted)
                                .child('Waiting for the turn'),
                        ),
                    ),
            );
        return column(
            h_flex()
                .w_full()
                .justify_start()
                .child(
                    v_flex()
                        .max_w(most)
                        .px(12)
                        .py(8)
                        .gap(8)
                        .rounded(12)
                        .bg(t.raised)
                        .children(
                            splitBlocks(row.text).map((block, i) =>
                                block.kind === 'text'
                                    ? TextView.markdown(
                                          `${id}-${i}`,
                                          block.text,
                                      ).selectable(true)
                                    : div()
                                          .px(10)
                                          .py(8)
                                          .rounded(8)
                                          .bg(t.background)
                                          .border(1)
                                          .border_color(t.border)
                                          .child(
                                              TextView.markdown(
                                                  `${id}-${i}`,
                                                  `\`\`\`${block.lang}\n${block.text}\n\`\`\``,
                                              ).selectable(true),
                                          ),
                            ),
                        ),
                ),
        );
    }

    /**
     * shows the thread whose Claude runs as `pid`: its transcript from the tail, then every line added to it
     * @param {number | null} pid
     * @param {Context} cx
     */
    async open(pid, cx) {
        this.watch?.cancel();
        this.watch = null;
        this.model.clear();
        this.heights.clear();
        this.reader = null;
        this.file = null;
        this.address = null;
        this.note = null;
        this.joins = null;
        // no button shows or presses a thread no longer on screen; the fleet's facts stay
        this.bandThread = null;
        this.pressed = {};
        this.runsAt = NO_RUNS_AT;
        this.isStuck = false;
        this.pending = null;
        this.pickNote = null;
        this.askModel = null;
        this.permission = null;
        this.permissionAsked = null;
        this.isPermsOpen = false;
        this.closePick();
        this.stateWatch?.cancel();
        this.stateWatch = null;
        this.stateTurn += 1;
        this.cancelHold();
        this.showDraft();
        this.error = null;
        this.isRead = false;
        this.at.reset();
        cx.notify();
        if (pid === null) return;
        try {
            const session = await readTextFile(
                `${home()}/.claude/sessions/${pid}.json`,
            );
            const file = transcriptPath(session && JSON.parse(session), home());
            if (pid !== this.pid) return;
            if (!file) {
                this.error = 'This thread has no session file yet';
                cx.notify();
                return;
            }
            this.file = file;
            this.showDraft();
            cx.notify();
            // only a send needs the address: a ps that fails leaves the thread readable
            const claude = await exec('ps', [
                'eww',
                '-o',
                'command=',
                '-p',
                String(pid),
            ]).catch(() => null);
            if (pid !== this.pid) return;
            this.address = addressIn(claude?.stdout ?? '');
            const turn = this.stateTurn;
            cx.spawn((cx) => this.watchState(file, turn, cx));
            const reader = createReader(doorTo(file));
            this.reader = reader;
            const dir = file.slice(0, file.lastIndexOf('/'));
            const name = file.slice(dir.length + 1);
            // the wait is armed before each read, so a line written while one runs is never missed
            let watch = watchFolder(dir);
            this.watch = watch;
            await this.pull(reader, cx);
            this.isRead = true;
            cx.notify();
            await this.restorePlace(reader, cx);
            while (this.reader === reader) {
                const changed = await watch;
                if (this.reader !== reader) return;
                watch = watchFolder(dir);
                this.watch = watch;
                if (
                    !changed.some((path) => path === dir || path.endsWith(name))
                )
                    continue;
                // one failed read says so and keeps watching: the next change reads again
                try {
                    await this.pull(reader, cx);
                } catch (error) {
                    if (this.reader !== reader) return;
                    this.error = readError(error);
                    cx.notify();
                }
            }
        } catch (error) {
            if (pid !== this.pid) return;
            this.error = readError(error);
            cx.notify();
        }
    }

    /**
     * @param {ReturnType<typeof createReader>} reader
     * @param {Context} cx
     */
    async pull(reader, cx) {
        const { lines, isRestart } = await reader.readNew();
        if (this.reader !== reader) return;
        if (isRestart) {
            // a replaced transcript names its own model and effort, or none yet: never the removed one's
            this.runsAt = NO_RUNS_AT;
            this.model.clear();
            this.heights.clear();
            // nothing of the old rows may steer the new ones: a held place, a landing under way, the rows drawn
            this.at.reset();
        }
        const hadError = this.error !== null;
        this.error = null;
        const ran = this.runsAt;
        for (const line of lines)
            this.runsAt = runsAtAfter(this.runsAt, line, Date.now());
        if (this.runsAt.appliedAt !== ran.appliedAt) {
            // the picker's label flashes the moment a reply first ran at his pick, and draws again when it ends
            cx.notify();
            cx.timer.after(APPLIED_FLASH_MS + 50, (later) => later.notify());
        }
        if (this.runsAt !== ran && this.settlePick()) cx.notify();
        const { changed, removed } = this.model.add(lines);
        if (changed.length || removed || isRestart || hadError) cx.notify();
    }

    /**
     * the shown thread's state, read at each change of the state folder: its joins settle the quill's mark
     * @param {string} file the thread's transcript
     * @param {number} turn the opening this watch belongs to
     * @param {Context} cx
     */
    async watchState(file, turn, cx) {
        const dir = `${home()}/${STATE_DIR}`;
        const settings = await readTextFile(`${home()}/${SETTINGS_FILE}`)
            .then((text) => JSON.parse(text ?? 'null')?.rows)
            .catch(() => null);
        if (this.stateTurn !== turn) return;
        this.timing = {
            delay: Number(
                settings?.['chatter.send.holdDelay'] ?? HOLD_DELAY_MS,
            ),
            push: Number(settings?.['chatter.send.holdPush'] ?? HOLD_PUSH_MS),
        };
        this.meterWarn = {
            ctx: Number(settings?.['chatter.meter.ctx.warn'] ?? 60),
            week: Number(settings?.['chatter.meter.week.warn'] ?? 80),
        };
        this.hasAutoWind = settings?.['stash.second-wind-auto'] !== false;
        /** @param {string} path */
        const readJson = (path) =>
            readTextFile(path)
                .then((text) => JSON.parse(text ?? 'null'))
                .catch(() => null);
        const sid = sidOf(file);
        while (this.stateTurn === turn) {
            // armed before the read, so a change during it is never missed
            const watch = watchFolder(dir);
            this.stateWatch = watch;
            const [state, fleet] = await Promise.all([
                readJson(`${dir}/${sid}.json`),
                readJson(`${dir}/fleet.json`),
            ]);
            if (this.stateTurn !== turn) return;
            this.joins = state?.joins ?? null;
            const band = {
                fleet,
                thread: state
                    ? { hot: state.hot ?? null, sid, wind: state.wind ?? null }
                    : null,
            };
            // every thread's state shares the folder: only a change of this band's facts draws again
            if (
                JSON.stringify(band) !==
                JSON.stringify({ fleet: this.fleet, thread: this.bandThread })
            ) {
                this.fleet = fleet;
                this.bandThread = band.thread;
                // a thread newly shown asks its 🍃 now, not at the next tick
                cx.spawn((cx) => this.readAutoWind(cx));
                cx.notify();
            }
            this.settle(cx);
            await watch;
        }
    }

    /** the mark of the shown thread against its state: taken by a turn, or by none in a minute @param {Context} cx */
    settle(cx) {
        const { box, file } = this;
        if (!box || !file) return;
        const settled = this.magic.settle(file, this.joins, box.value());
        if (!settled) return;
        if (settled.quill !== null) this.setQuill(box, settled.quill);
        this.note = settled.note;
        // the taken mark shows for a moment, then the button rests
        if (!settled.note)
            cx.timer.after(JOINED_SHOWN_MS, (later) => {
                this.magic.forget(settled.id);
                later.notify();
            });
        cx.notify();
    }

    /**
     * a click on send, or Enter: the quill's words are marked to join the thread's turn, or the mark is taken off; a
     * thread that takes no joins, or a slash command, gets them as a plain send
     * @param {import('gpui-base').TextareaState} box
     * @param {Context} cx
     */
    click(box, cx) {
        const { file } = this;
        const text = box.value().trim();
        if (!text || !file) return;
        if (!this.address) return this.say(NOT_IN_HERDR, cx);
        const answer = this.magic.click(file, sidOf(file), text, this.joins);
        cx.notify();
        cx.spawn(async (cx) => {
            const { act, note } = await answer;
            if (this.file !== file) return;
            if (act === 'push') return this.send(box, text, note, cx);
            // a mark no turn takes in a minute comes off by itself
            if (act === 'marked')
                cx.timer.after(JOIN_TAKE_MS + 500, (later) =>
                    this.settle(later),
                );
            this.say(note, cx);
        });
    }

    /**
     * a hold on send, or cmd+Enter: the quill's words go now and a turn starts; words marked to join leave the join
     * file first, so they never go twice
     * @param {import('gpui-base').TextareaState} box
     * @param {Context} cx
     */
    push(box, cx) {
        const { file } = this;
        const text = box.value().trim();
        if (!text || !file) return;
        if (!this.address) return this.say(NOT_IN_HERDR, cx);
        cx.spawn(async (cx) => {
            const why = await this.magic.release(file, this.joins);
            if (this.file !== file) return;
            if (why) return this.say(why, cx);
            // the words go as the quill holds them once the row is out: an edit he made meanwhile is what he sends,
            // and the quill empties, never keeping words that already went
            this.send(box, box.value().trim() || text, null, cx);
        });
    }

    /**
     * the words leave the quill for the thread shown, as its Claude's next prompt, or wait in its queue while it
     * works. a message that did not go comes back to the quill
     * @param {import('gpui-base').TextareaState} box
     * @param {string} text
     * @param {string | null} note why it went this way
     * @param {Context} cx
     */
    send(box, text, note, cx) {
        const { address, file } = this;
        if (!address) return;
        // what he typed while a mark was taken back stays: only the words sent leave
        const now = box.value().trim();
        this.setQuill(
            box,
            now.startsWith(text) ? now.slice(text.length).trimStart() : now,
        );
        this.say(note, cx);
        cx.spawn(async (cx) => {
            const sent = await hc(sendArgs(address, text)).catch(
                (/** @type {unknown} */ error) => ({
                    code: 1,
                    stderr: String(error),
                }),
            );
            if (sent.code === 0) return;
            // his words come back before what he typed since, never lost
            /** @param {string} typed */
            const back = (typed) => (typed ? `${text}\n\n${typed}` : text);
            if (this.file !== file) {
                if (file) this.drafts.keep(file, back(this.drafts.kept(file)));
                return;
            }
            this.setQuill(box, back(box.value()));
            this.say(
                `Not sent: ${sent.stderr.trim() || 'herdr refused it'}`,
                cx,
            );
        });
    }

    /** @param {string | null} note @param {Context} cx */
    say(note, cx) {
        this.note = note;
        cx.notify();
    }

    /**
     * he typed under a mark: once his keys rest, the join row carries the quill's words; an emptied quill unmarks
     * @param {import('gpui-base').TextareaState} box
     * @param {Context} cx
     */
    typedUnderMark(box, cx) {
        const { file } = this;
        if (this.magic.markOf(file)?.state !== 'pending' || !file) return;
        const at = Date.now();
        this.lastKeyAt = at;
        cx.timer.after(RETEXT_MS, (later) => {
            if (this.lastKeyAt !== at || this.file !== file) return;
            later.spawn(async (cx) => {
                const isChanged = await this.magic.typed(
                    file,
                    box.value().trim(),
                    this.joins,
                );
                if (isChanged) cx.notify();
            });
        });
    }

    /**
     * a press on send starts the hold: a release before its delay is a click, a hold to its end pushes
     * @param {import('gpui-base').TextareaState} box
     * @param {Context} cx
     */
    press(box, cx) {
        // an empty quill has nothing to send: no hold, no disc
        if (!box.value().trim() || !this.file) return;
        this.cancelHold();
        this.hold = holdSend(null, 'press', Date.now(), this.timing).hold;
        this.holdTask = cx.timer.every(33, (later) =>
            this.holdStep(box, 'tick', later),
        );
    }

    /**
     * @param {import('gpui-base').TextareaState} box
     * @param {'tick' | 'release' | 'cancel'} event
     * @param {Context} cx
     */
    holdStep(box, event, cx) {
        if (!this.hold) return;
        // a window that lost focus cuts the hold, as a pointer that left the button does
        const step = holdSend(
            this.hold,
            event === 'tick' && !isWindowActive() ? 'cancel' : event,
            Date.now(),
            this.timing,
        );
        this.hold = step.hold;
        this.holdFill = step.hold ? step.fill : 0;
        if (!step.hold) this.cancelHold();
        if (step.act === 'push') this.push(box, cx);
        else if (step.act === 'join') this.click(box, cx);
        cx.notify();
    }

    cancelHold() {
        this.holdTask?.cancel();
        this.holdTask = null;
        this.hold = null;
        this.holdFill = 0;
    }

    /**
     * the quill's text set by the view: remembered as the text before the next key, so Enter's line break is found
     * against it even when no change was told for it (a restored draft, a cleared quill)
     * @param {import('gpui-base').TextareaState} box
     * @param {string} text
     */
    setQuill(box, text) {
        box.set_value(text);
        this.typedNow = text;
        this.typedBefore = text;
    }

    /** the quill holds the shown thread's draft, the caret after it; no thread, an empty quill */
    showDraft() {
        const text = this.drafts.kept(this.file);
        if (this.box) this.setQuill(this.box, text);
        this.box?.set_selected_range({ end: text.length, start: text.length });
    }

    /** @param {string} file */
    placeKey(file) {
        return `place:${file}`;
    }

    /**
     * after a reload of the mod: the message he was reading comes back to the top, read in from above if it must be
     * @param {ReturnType<typeof createReader>} reader
     * @param {Context} cx
     */
    async restorePlace(reader, cx) {
        const place = placeOf(
            this.file && localStorage.getItem(this.placeKey(this.file)),
        );
        this.trace(
            `open ${this.file?.slice(-12)} saved=${JSON.stringify(place)} rows=${this.model.rows.length}`,
        );
        this.traceUntil = Date.now() + TRACE_MS;
        if (!place) return;
        for (
            let page = 0;
            this.model.indexOf(place.id) < 0 &&
            reader.hasEarlier() &&
            page < PLACE_PAGES;
            page++
        ) {
            const lines = await reader.readEarlier();
            if (this.reader !== reader) return;
            this.model.addEarlier(lines);
        }
        // the saved line may sit inside a folded row: the place is that row
        const at = this.model.indexOf(place.id);
        const row = this.model.rows[at];
        this.trace(
            `restore at=${at} kind=${row?.kind} tools=${this.look.tools}`,
        );
        if (!row) return;
        // a row he hides now (a tool call) hands the place to the next one shown
        const shown = shownOf(this.model.rows, this.look);
        const next = shown.includes(row)
            ? row
            : this.model.rows.slice(at + 1).find((r) => shown.includes(r));
        this.trace(`restore next=${next?.id.slice(0, 8)}`);
        if (!next) return;
        this.at.restore(next.id, next === row ? place.offset : 0);
        this.settleUntil = Date.now() + SETTLE_MS;
        cx.notify();
    }

    /** his place, read from the rows the list drew last; never inside the list's row callback (see place.js) */
    readPlace() {
        this.at.read(this.shownRows, this.sizes);
    }

    /** [TRACE-place] one line to the lane's trace file, until the 23:44 «opened at the newest» is caught @param {string} line */
    trace(line) {
        const at = new Date().toTimeString().slice(0, 8);
        exec('/bin/sh', [
            '-c',
            'printf "%s\\n" "$1" >> "$2"',
            'sh',
            `${at} ${line}`,
            `${home()}/.local/state/x/lanes/herdr-lane-2/place-trace.log`,
        ]).catch(() => {});
    }

    /** the widest a row or the quill draws: a readable column when narrow, the list's own width when full */
    column() {
        return this.look.width === 'narrow'
            ? NARROW
            : Math.max(this.width, NARROW);
    }

    /** his place is asked of the list again, to the pixel: after a new width; unseen while it lands */
    holdPlace() {
        if (this.at.hold()) this.settleUntil = Date.now() + SETTLE_MS;
    }

    /**
     * his place is the first message on screen once his scroll has rested; following the newest keeps none
     * @param {Context} cx
     */
    savePlaceSoon(cx) {
        const at = Date.now();
        const { file, reader } = this;
        this.lastWheelAt = at;
        let seen = '';
        /** @param {Context} later */
        const save = (later) => {
            // only his last step counts, and only for the thread it was made in
            // nor for an earlier opening of the same thread: its place may not be restored yet
            if (this.lastWheelAt !== at || !file || this.file !== file) return;
            if (this.reader !== reader) return;
            this.readPlace();
            // a glide moves the list on with no wheel step: the place is saved once two reads in a row agree
            const { place } = this.at;
            const now = `${place?.id}@${Math.round(this.at.top)}`;
            if (now !== seen) {
                seen = now;
                later.timer.after(PLACE_SAVE_MS, save);
                return;
            }
            if (place)
                localStorage.setItem(
                    this.placeKey(file),
                    JSON.stringify(place),
                );
            else {
                this.trace('save: following, the saved place is dropped');
                localStorage.removeItem(this.placeKey(file));
            }
        };
        cx.timer.after(PLACE_SAVE_MS, save);
    }
}
