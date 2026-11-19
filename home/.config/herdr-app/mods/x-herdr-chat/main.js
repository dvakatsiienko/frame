// x-herdr-chat: the Chat view, built new in place of zoo's chat (FRM-638). it reads the thread shown,
// drawn as his messages, replies and one line per tool call, in a list that never moves without him, over the quill,
// his text box. the rules live in their own files, each tested with no herdr: reader.js, row-model.js, heights.js,
// follow.js, place.js, quill.js, send.js, magic.js.

import { mkdir, readdir, writeFile } from 'fs/promises';
import { h_flex, v_flex } from 'gpui-base';
import { View, div } from 'gpui-kit';
import {
    agents,
    appHome,
    checking,
    closeOverlay,
    exec,
    focused,
    home,
    layout,
    props,
    readTextFile,
    setShared,
    settings,
    shared,
    theme,
    watchFolder,
} from 'herdr';

import { STATE_DIR } from './band.js';
import { createBand } from './band-view.js';
import { createBlockedPanel } from './blocked-panel.js';
import { CHAT_SHOWN } from './chat-asks.js';
import { replyIdOf } from './files.js';
import { createFindBar } from './find-bar.js';
import { placeOf } from './follow.js';
import { createHeights } from './heights.js';
import { LOOK_KEY, lookOf } from './look.js';
import { createMessageList, placeKey } from './message-list.js';
import { createMessageRows } from './message-row.js';
import { createPages } from './pages.js';
import { createPickers } from './pickers.js';
import { createPictureViewer } from './picture-viewer.js';
import { createQuill } from './quill-view.js';
import { createReader } from './reader.js';
import { createRowModel } from './row-model.js';
import { addressIn } from './send.js';
import { createSendPath } from './send-path.js';
import { SENT_DIR, createSentPictures } from './sent-pictures.js';
import { readSettings, settingsDir } from './settings-io.js';
import { createSettingsWindow } from './settings-window.js';
import { saveSquareThumb } from './shots.js';
import { asksActedOn, isShownIn, pidFor, shownThread } from './shown.js';
import { loadableSkills } from './skills.js';
import { sidOf, transcriptPath } from './thread.js';

/** @typedef {import('./chat-types.js').Color} Color */
/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./chat-asks.js').ChatShown} ChatShown */
/** @typedef {import('./row-model.js').Row} Row */
/** @typedef {import('./chat-types.js').Theme} Theme */

/** @type {Row} over a thread read back to its first line: no older page is left to ask for */
const START_ROW = {
    at: null,
    delivery: null,
    files: [],
    id: 'start-of-thread',
    isTurnStart: false,
    isWaiting: false,
    kind: 'start',
    pictures: [],
    replyId: null,
    text: '',
    tools: [],
    version: 1,
};
// the ui font, as the old chat drew it
const SANS = '.AppleSystemUIFont';

// earlier pages read at most this many times while looking for the message he was reading
const PLACE_PAGES = 8;
// the terminals a pick is typing keys into, model, effort or permission: it outlives a thread switch, so a second pick
// never types beside it
const typingInto = new Set();
// how often the shown thread's session is looked up again, as the old chat's tick did
const SHOWN_LOOK_MS = 2000;
// the operator override changes with no event herdr watches, and a deck that stopped publishing changes nothing: the
// band's facts that age are read again this often
const BAND_AGE_MS = 5000;
// a blocked thread's screen is read this often while it asks, so the question card follows its cursor
const ASK_READ_MS = 1000;
// the settings folder is looked for again this often while it does not exist
const SETTINGS_RETRY_MS = 10 * 1000;
const COPIED_NOTE_MS = 1500;
/** @type {import('./sent-pictures.js').SentIo} */
const SENT_IO = {
    get home() {
        return appHome();
    },
    list: () => readdir(`${appHome()}/${SENT_DIR}`).catch(() => []),
    thumb: saveSquareThumb,
    write: async (rel, bytes) => {
        try {
            await mkdir(`${appHome()}/${SENT_DIR}`, { recursive: true });
            await writeFile(`${appHome()}/${rel}`, bytes);
            return true;
        } catch {
            return false;
        }
    },
};
/** @type {import('./skills.js').SkillFs} */
const SKILL_FS = {
    list: (dir) => readdir(dir).catch(() => []),
    read: (path) => readTextFile(path).catch(() => null),
};
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

export default class Chat extends View {
    model = createRowModel();
    heights = createHeights();
    /** @type {ReturnType<typeof createReader> | null} */
    reader = null;
    /** older history above what the reader handed on: the one door to its pages @type {ReturnType<typeof createPages> | null} */
    pages = null;
    /** the pid of the thread shown, found from the focused tab's Claude @type {number | null} */
    pid = null;
    /** the terminal of the thread shown @type {string | null} */
    shownAddress = null;
    /** ⌘K's last ask (the status bar takes the key and writes the time) @type {unknown} */
    quillAsk = null;
    /** ⌘F's last ask, pressed anywhere in the window (the status bar takes the key and writes the time) @type {unknown} */
    findAsk = null;
    /** Esc's last ask from outside the chat (the status bar takes the key and writes the time) @type {unknown} */
    escapeAsk = null;
    /** ⌘⇧E's last ask @type {unknown} */
    effortAsk = null;
    /** what this chat last wrote in `chat.shown`, as json: its thread on screen and whether find is open @type {string} */
    namedShown = '';
    /** whether the chat was on screen at the last draw */
    wasShown = false;
    /** @type {string | null} */
    file = null;
    /** the pid the open thread was opened for; undefined before the first @type {number | null | undefined} */
    opened = undefined;
    /** his chat look (look.js), read each render */
    look = lookOf(null);
    /** the pending wait for a change in the transcript's folder @type {import('herdr').FolderWatch | null} */
    watch = null;
    /** @type {string | null} */
    error = null;
    /** the open thread's transcript has been read once */
    isRead = false;
    /** the quill, its drafts, the files waiting over it and its / menu */
    quill = createQuill({
        column: () => this.list.column(),
        flash: (note, ms, cx) => this.flashNote(note, cx, ms),
        pickersView: (t) => this.pickers.view(t),
        say: (note, cx) => this.say(note, cx),
        sendPath: () => this.sendPath,
        showPictures: (files, at, cx) => this.pictures.show(files, at, cx),
        shownFile: () => this.file,
    });
    sent = createSentPictures(SENT_IO);
    /** where a message to the shown thread goes: its herdr address @type {string | null} */
    address = null;
    /** what the quill says about his last send: why it did not go, or why it went as a push @type {string | null} */
    note = null;
    /** the send path: the magic send's marks, the hold, a send that did not go coming back */
    sendPath = createSendPath({
        attachments: this.quill.attachments,
        pushed: (text, at) => this.model.pushed(text, at),
        quillBox: () => this.quill.box(),
        quills: this.quill.quills,
        say: (note, cx) => this.say(note, cx),
        shownAddress: () => this.address,
        shownFile: () => this.file,
        typingInto,
    });
    /** the pending wait for a change in the threads' state folder @type {import('herdr').FolderWatch | null} */
    stateWatch = null;
    /** one more at each thread opened: a state watch of an earlier opening ends */
    stateTurn = 0;
    /** the band over the quill and the bar under it */
    band = createBand({
        column: () => this.list.column(),
        pid: () => this.pid,
        shownAddress: () => this.address,
        turnStart: () => this.model.turnAt(),
    });
    /** Claude's settings.json: the model and effort a session starts on @type {import('./picker.js').ClaudeSettings} */
    claudeSettings = null;
    /** a picture's open button starts CleanShot's annotate, else Preview (`chatter.pictures.cleanshot`) */
    isCleanShot = true;
    /** the settings window this copy draws, when the gear opened it @type {{ render: () => any } | null} */
    settingsWindow = null;
    isCmdHeld = false;
    noteSerial = 0;
    /** the model, effort and permission pickers under the quill */
    pickers = createPickers({
        claudeSettings: () => this.claudeSettings,
        column: () => this.list.column(),
        hasRows: () => this.model.rows.length > 0,
        quillBox: () => this.quill.box(),
        shownAddress: () => this.address,
        status: () => this.statusNow(),
        typingInto,
    });
    /** the picture viewer over the chat (W33/W35) */
    pictures = createPictureViewer({
        file: () => this.file,
        focusQuill: () => this.quill.focus(),
        isCleanShot: () => this.isCleanShot,
        isCmdHeld: () => this.isCmdHeld,
        room: () => this.list.size(),
        say: (note, cx) => this.say(note, cx),
    });
    /** find in the chat (slice 6): the bar and the search the rows mark */
    findBar = createFindBar({
        focusQuill: () => this.quill.focus(),
        isAllLoaded: () => this.pages?.isStart() ?? false,
        rows: () => this.list.shown(),
        show: (id) => this.list.restore(id, 0),
    });
    /** a blocked thread's ask with the keys that answer it, over the quill */
    blocked = createBlockedPanel({
        address: () => this.address,
        isBlocked: () => this.statusNow() === 'blocked',
    });
    /** his «Show more» switch: a long reply of an earlier turn shows its first lines (FRM-607) */
    isShowMore = true;
    /** each row as drawn, and the rows the list shows of the model's */
    rows = createMessageRows({
        column: () => this.list.column(),
        find: () => this.findBar.find,
        heights: this.heights,
        isShowMore: () => this.isShowMore,
        look: () => this.look,
        room: () => this.list.room(),
        sent: this.sent,
    });
    /** the list on screen and his reading place in it */
    list = createMessageList({
        file: () => this.file,
        flash: (note, cx) => this.flashNote(note, cx),
        heights: this.heights,
        loadEarlier: (cx) => this.loadEarlier(cx),
        pictures: this.pictures,
        reader: () => this.reader,
        rows: this.rows,
    });

    /** wakes the loop that opens the thread shown: a draw starts no work itself */
    wake = () => {};

    /**
     * @param {unknown} _props
     * @param {import('gpui-kit').AsyncContext} cx
     */
    init(_props, cx) {
        if (props()?.settingsWindow) {
            this.settingsWindow = createSettingsWindow(
                {
                    overlay: props().overlay,
                    page: String(props().settingsWindow),
                },
                cx,
            );
            return;
        }
        // his settings rows, read at start and at every change of their folder, so a change applies at once
        cx.spawn(async (cx) => {
            for (;;) {
                const watch = watchFolder(settingsDir());
                this.applySettings(await readSettings());
                cx.notify();
                // a folder not made yet is asked again later, so its first write is still read
                await watch.catch(
                    () =>
                        new Promise((done) =>
                            cx.timer.after(SETTINGS_RETRY_MS, () => done(null)),
                        ),
                );
            }
        });
        this.quill.start(cx);
        this.pickers.start(cx);
        this.pictures.start(cx);
        // the open viewer holds the keyboard: ← → move, + − 0 zoom, ⌘C copies, Esc closes
        cx.bind_keys(
            [
                ['left', 'previous'],
                ['right', 'next'],
                ['=', 'zoom in'],
                ['+', 'zoom in'],
                ['-', 'zoom out'],
                ['0', 'fit'],
                ['cmd-c', 'copy'],
                ['escape', 'close'],
            ].map(([keystroke, step]) => ({
                action: `x_herdr_chat_viewer_${String(step).replace(' ', '_')}`,
                context: 'ChatViewer',
                keystroke: String(keystroke),
            })),
        );
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
        // find: ⌘F opens its bar; in the bar Enter or ↓ steps older, ⇧Enter or ↑ newer, Esc closes
        this.findBar.reset();
        cx.bind_keys([
            {
                action: 'x_herdr_chat_find_newer',
                context: 'ChatFind > Input',
                keystroke: 'up',
            },
            {
                action: 'x_herdr_chat_find_older',
                context: 'ChatFind > Input',
                keystroke: 'down',
            },
            // the bar's Esc from wherever the keyboard sits in the chat; a box deeper down keeps its own Esc
            {
                action: 'x_herdr_chat_find_close',
                context: 'XChat',
                keystroke: 'escape',
            },
            {
                action: 'x_herdr_chat_find',
                context: 'XChat',
                keystroke: 'cmd-f',
            },
            {
                action: 'x_herdr_chat_find_close',
                context: 'ChatFind',
                keystroke: 'escape',
            },
            // the find box's own Esc comes first unless ours sits on the box itself
            {
                action: 'x_herdr_chat_find_close',
                context: 'ChatFind > Input',
                keystroke: 'escape',
            },
        ]);
        // the / menu's keys, only while it shows (its wrapper carries `ChatSlash` then)
        cx.bind_keys(
            [
                ['down', 'x_herdr_chat_slash_down'],
                ['up', 'x_herdr_chat_slash_up'],
                ['tab', 'x_herdr_chat_slash_fill'],
                ['enter', 'x_herdr_chat_slash_fill'],
                ['escape', 'x_herdr_chat_slash_close'],
            ].map(([keystroke, action]) => ({
                action: String(action),
                context: 'ChatSlash > Input',
                keystroke: String(keystroke),
            })),
        );
        // a check draws one frame and must read no thread
        if (checking()) return;
        // a Claude whose session file came after its tab, or a /resume in the same pane: the thread is looked up again
        cx.timer.every(SHOWN_LOOK_MS, (later) =>
            this.showThread(this.shownAddress, later),
        );
        cx.timer.every(ASK_READ_MS, (later) => this.blocked.read(later));
        this.ageFacts(cx);
        cx.timer.every(BAND_AGE_MS, (later) => this.ageFacts(later));
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
        if (this.settingsWindow) return this.settingsWindow.render();
        const t = /** @type {Theme} */ (theme());
        // the chat finds its own thread, as the old chat did; on screen it names it for the deck's ⌘⇧K, hidden it names none
        const { stack, self } = props() ?? {};
        const isShown = isShownIn(layout(), stack, self);
        const address = shownThread(agents(), focused(), this.shownAddress);
        const isSwitched = address !== this.shownAddress;
        if (isSwitched) {
            this.shownAddress = address;
            _cx.timer.after(0, (later) => this.showThread(address, later));
        }
        /** @type {ChatShown} */
        const named = isShown
            ? {
                  address,
                  isFindOpen: this.findBar.find.state.isOpen,
                  pid: this.pid ?? null,
              }
            : { address: null, isFindOpen: false, pid: null };
        const namedKey = JSON.stringify(named);
        if (namedKey !== this.namedShown) {
            this.namedShown = namedKey;
            _cx.timer.after(0, () => setShared(CHAT_SHOWN, named));
        }
        // the keyboard comes to the quill when the chat comes on screen, on a thread switch and on ⌘K: a click on a tab
        // gives it to that tab's hidden terminal. ⌘⇧E opens the picker on the effort, a second press applies it. a press
        // the chat slept through is dropped, never acted on late
        const quillAsk = shared('chat.quill') ?? null;
        const effortAsk = shared('chat.effort') ?? null;
        const findAsk = shared('chat.find') ?? null;
        const escapeAsk = shared('chat.escape') ?? null;
        const acts = asksActedOn({
            effortAsk,
            escapeAsk,
            findAsk,
            isShown,
            isSwitched,
            lastEffort: this.effortAsk,
            lastEscape: this.escapeAsk,
            lastFind: this.findAsk,
            lastQuill: this.quillAsk,
            now: Date.now(),
            quillAsk,
            wasShown: this.wasShown,
        });
        this.quillAsk = acts.lastQuill;
        this.effortAsk = acts.lastEffort;
        this.findAsk = acts.lastFind;
        this.escapeAsk = acts.lastEscape;
        this.wasShown = isShown;
        // Esc pressed anywhere in the window closes the viewer, or find when no viewer shows (dima, 18:18)
        if (
            acts.isEscape &&
            (this.pictures.isOpen() || this.findBar.find.state.isOpen)
        )
            _cx.timer.after(0, (later) =>
                this.pictures.isOpen()
                    ? this.pictures.step('close', later)
                    : this.findBar.close(later),
            );
        if (acts.isFind && !this.pictures.isOpen())
            _cx.timer.after(0, (later) => this.findBar.open(later));
        if (acts.isFocus && !this.pictures.isOpen())
            _cx.timer.after(50, () => {
                if (!this.pickers.isOpen()) this.quill.focus();
            });
        // the open viewer holds the keyboard: a click on the list or a later focus of the quill never keeps it
        this.pictures.keepKeys(_cx);
        if (acts.isEffort)
            _cx.timer.after(0, (later) => {
                const isOpening = !this.pickers.isOpen();
                this.pickers.applyEffort(later);
                if (isOpening && this.pickers.isOpen())
                    this.pickers.readPermission(later);
            });
        const look = lookOf(shared(LOOK_KEY));
        const shown = this.rows.shown(this.model.rows, look);
        const rows =
            this.isRead && shown.length && this.pages?.isStart()
                ? [START_ROW, ...shown]
                : shown;
        this.list.take(rows, look);
        this.look = look;
        const root = v_flex()
            .size_full()
            .min_h(0)
            .key_context('XChat')
            .on_action('x_herdr_chat_find', (_e, cx) => this.findBar.open(cx))
            .on_action('x_herdr_chat_find_close', (_e, cx) =>
                this.findBar.close(cx),
            )
            // ⌘ held at a click on a picture opens it in his desktop app, not the viewer
            .on_modifiers_changed((e) => {
                this.isCmdHeld = Boolean(e.modifiers.platform);
            })
            // a ⌘ let go in another app never reaches the handler above: each move over the chat reads it again
            .on_mouse_move((e) => {
                this.isCmdHeld = Boolean(e.modifiers.platform);
            })
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
            root.child(this.list.view(rows, t, _cx));
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
        if (!this.file || !this.quill.box()) return root;
        if (this.note)
            root.child(
                div()
                    .px(32)
                    .pb(6)
                    .text_size(12)
                    .text_color(t.muted)
                    .child(this.note),
            );
        const pickNote = this.pickers.note();
        if (pickNote)
            root.child(
                div()
                    .px(32)
                    .pb(6)
                    .text_size(12)
                    .text_color(t.accent)
                    .child(pickNote),
            );
        const confirm = this.pickers.confirmView(t);
        if (confirm) root.child(confirm);
        const drawn = this.band.drawn(Date.now());
        return (
            root
                .relative()
                .when(this.statusNow() === 'blocked', (el) =>
                    el.child(this.blocked.view(t)),
                )
                .child(this.band.view(drawn.band, t))
                .child(this.quill.view(t) ?? div())
                .child(this.band.bar(drawn.bar, drawn.band.buttons, t))
                // find floats over the list, so opening it moves no message (dima, 18:39)
                .when(this.findBar.find.state.isOpen, (el) =>
                    el.child(this.findBar.view(t)),
                )
                .when(this.pictures.isOpen(), (el) =>
                    el.child(this.pictures.view(t)),
                )
        );
    }

    /**
     * the facts that age with no event, every BAND_AGE_MS: the band's, and Claude's own settings, the model and effort
     * a session starts on, which a pick in flight may be waiting to see
     * @param {Context} cx
     */
    ageFacts(cx) {
        this.band.age(cx);
        cx.spawn(async (cx) => {
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
            if (this.pickers.settle() || isChanged) cx.notify();
        });
    }

    /** the shown thread's status, as herdr reads it */
    statusNow() {
        return agents().find((agent) => agent.address === this.address)?.status;
    }

    /** what the view says while it has no row to draw */
    emptyLine() {
        if (this.pid === null) return 'No thread is shown here yet';
        if (!this.file) return 'Opening the thread…';
        return this.isRead
            ? 'Nothing to show in this thread yet'
            : 'Reading the thread…';
    }

    /** a line under the quill that leaves on its own @param {string} note @param {Context} cx @param {number} [ms] */
    flashNote(note, cx, ms = COPIED_NOTE_MS) {
        this.note = note;
        const shown = ++this.noteSerial;
        cx.timer.after(ms, (cx) => {
            if (this.note === note && this.noteSerial === shown)
                this.note = null;
            cx.notify();
        });
        cx.notify();
    }

    /**
     * the session pid of the thread shown, from the Claude whose environment names its terminal; a switch made while
     * one is read wins
     * @param {string | null} address @param {Context} cx
     */
    showThread(address, cx) {
        cx.spawn(async (cx) => {
            let pid = null;
            if (address)
                try {
                    const sessions = (
                        await readdir(`${home()}/.claude/sessions`)
                    )
                        .filter((name) => name.endsWith('.json'))
                        .map((name) => Number(name.slice(0, -5)));
                    const ps = await exec('ps', [
                        'eww',
                        '-o',
                        'pid=,etime=,command=',
                        '-p',
                        sessions.join(','),
                    ]);
                    pid = pidFor(address, ps.stdout, sessions);
                } catch {
                    // a read that failed says nothing: the thread shown stays, the next look tries again
                    return;
                }
            if (address !== this.shownAddress || pid === this.pid) return;
            this.pid = pid;
            this.wake();
            cx.notify();
        });
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
        // nothing of the old thread's ask or menu may act on the new one
        this.blocked.clear();
        this.rows.clearThread();
        this.heights.clear();
        this.quill.clearThread();
        this.reader = null;
        this.pages?.close();
        this.pages = null;
        this.file = null;
        this.address = null;
        this.note = null;
        // the viewer and find belong to the thread they opened on
        this.pictures.close();
        this.findBar.reset();
        this.sendPath.takeJoins(null);
        // no button shows or presses a thread no longer on screen; the fleet's facts stay
        this.band.clear();
        this.pickers.clear();
        this.stateWatch?.cancel();
        this.stateWatch = null;
        this.stateTurn += 1;
        this.sendPath.cancelHold();
        this.quill.showDraft();
        this.error = null;
        this.isRead = false;
        this.list.reset();
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
            this.quill.showDraft();
            cx.notify();
            const cwd = session && JSON.parse(session)?.cwd;
            if (typeof cwd === 'string')
                loadableSkills(SKILL_FS, { cwd, home: home() })
                    .then((found) => {
                        if (this.file !== file) return;
                        this.quill.setPluginSkills(found);
                    })
                    .catch(() => {});
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
            this.pages = createPages(reader);
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
            this.pickers.restart();
            this.model.clear();
            this.heights.clear();
            this.rows.clearFiles();
            // nothing of the old rows may steer the new ones: a held place, a landing under way, the rows drawn
            this.list.reset();
        }
        const hadError = this.error !== null;
        this.error = null;
        this.pickers.takeLines(lines, cx);
        const { changed, removed } = this.model.add(lines);
        this.quill.learnSkills(lines);
        this.makePictures(cx);
        // his marked words showing as his message settle the mark in this same draw: they leave the quill as they land
        const added = new Set(changed);
        const arrived = this.model.rows
            .filter((r) => added.has(r.id) && r.kind === 'mine' && !r.isWaiting)
            .map((r) => ({ at: r.at, text: r.text }));
        if (arrived.length && this.file)
            this.sendPath.showSettled(
                this.sendPath.magic.arrived(this.file, arrived),
                cx,
            );
        if (changed.length || removed || isRestart || hadError) cx.notify();
    }

    /** his settings rows as the chat uses them @param {Record<string, unknown>} values */
    applySettings(values) {
        this.sendPath.applySettings(values);
        this.isCleanShot = values['chatter.pictures.cleanshot'] === true;
        this.band.applySettings(values);
        this.isShowMore = values['chatter.showMore'] === true;
    }

    /**
     * the shown thread's state, read at each change of the state folder: its joins settle the quill's mark
     * @param {string} file the thread's transcript
     * @param {number} turn the opening this watch belongs to
     * @param {Context} cx
     */
    async watchState(file, turn, cx) {
        const dir = `${home()}/${STATE_DIR}`;
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
            this.sendPath.takeJoins(state?.joins ?? null);
            const band = {
                fleet,
                thread: state
                    ? { hot: state.hot ?? null, sid, wind: state.wind ?? null }
                    : null,
            };
            // every thread's state shares the folder: only a change of this band's facts draws again
            if (this.band.takeState(band)) {
                // a thread newly shown asks its 🍃 now, not at the next tick
                cx.spawn((cx) => this.band.readAutoWind(cx));
                cx.notify();
            }
            this.sendPath.settle(cx);
            await watch;
        }
    }

    /** @param {string | null} note @param {Context} cx */
    say(note, cx) {
        this.note = note;
        cx.notify();
    }

    /** his messages' pictures get their files; each row draws its own once made @param {Context} cx */
    makePictures(cx) {
        const pictures = this.rows
            .shown(this.model.rows, this.look)
            .flatMap((r) => (r.kind === 'file' ? r.pictures : []));
        if (!pictures.some((p) => !this.sent.relOf(p))) return;
        cx.spawn(async (cx) => {
            if (await this.sent.make(pictures)) cx.notify();
        });
    }

    /**
     * after a reload of the mod: the message he was reading comes back to the top, read in from above if it must be
     * @param {ReturnType<typeof createReader>} reader
     * @param {Context} cx
     */
    async restorePlace(reader, cx) {
        const place = placeOf(
            this.file && localStorage.getItem(placeKey(this.file)),
        );
        this.list.traceOpen(
            `open ${this.file?.slice(-12)} saved=${JSON.stringify(place)} rows=${this.model.rows.length}`,
        );
        // a place on the start row would read every page back to it: the thread opens at its newest instead
        if (!place || place.id === START_ROW.id) return;
        // a place on a file row is found through its reply, the row the transcript holds
        const lineId = replyIdOf(place.id);
        const pages = this.pages;
        for (
            let page = 0;
            this.model.indexOf(lineId) < 0 && page < PLACE_PAGES;
            page++
        ) {
            const read = pages?.next();
            if (!read) break;
            const lines = await read;
            if (this.reader !== reader) return;
            this.model.addEarlier(lines);
            this.quill.learnSkills(lines);
        }
        this.makePictures(cx);
        // the saved line may sit inside a folded row: the place is that row
        const at = this.model.indexOf(lineId);
        const row = this.model.rows[at];
        this.list.trace(
            `restore at=${at} kind=${row?.kind} tools=${this.look.tools}`,
        );
        if (!row) return;
        // a row he hides now (a tool call) hands the place to the next one shown
        const shown = this.rows.shown(this.model.rows, this.look);
        const fileRow = shown.find((r) => r.id === place.id && r !== row);
        if (fileRow) {
            this.list.land(fileRow.id, place.offset);
            cx.notify();
            return;
        }
        const next = shown.includes(row)
            ? row
            : this.model.rows.slice(at + 1).find((r) => shown.includes(r));
        this.list.trace(`restore next=${next?.id.slice(0, 8)}`);
        if (!next) return;
        this.list.land(
            next.id,
            next === row && lineId === place.id ? place.offset : 0,
        );
        cx.notify();
    }

    /**
     * the next older page drawn above, the row he reads kept at its spot on screen; nothing while one is read or at
     * the thread's start, and a page for a thread he left is dropped
     * @param {Context} cx
     */
    loadEarlier(cx) {
        const pages = this.pages;
        const read = pages?.next();
        if (!read) return;
        cx.spawn(async (cx) => {
            const lines = await read.catch(() => null);
            if (this.pages !== pages || !lines?.length) return;
            const { height, place } = this.list.placeNow();
            const firstId = this.model.rows[0]?.id ?? '';
            this.model.addEarlier(lines);
            // the page's last reply may join the first row: it keeps its lines and takes the page's id
            const first = this.model.rows[this.model.indexOf(firstId)];
            this.quill.learnSkills(lines);
            this.makePictures(cx);
            // the page's last reply joined the row he reads: that row took the page's id and grew above him
            const joined = place
                ? this.model.rows[this.model.indexOf(place.id)]
                : undefined;
            if (place && joined && joined.id !== place.id && height)
                this.list.restore(joined.id, 0, height - place.offset);
            else if (place) this.list.restore(place.id, place.offset);
            if (this.findBar.find.state.isOpen)
                this.findBar.find.recount(
                    this.rows.shown(this.model.rows, this.look),
                    first && first.id !== firstId
                        ? { from: firstId, to: first.id }
                        : null,
                );
            cx.notify();
        });
    }
}
