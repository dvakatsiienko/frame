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

import { createBand } from './band-view.js';
import { createBlockedPanel } from './blocked-panel.js';
import { CHAT_SHOWN } from './chat-asks.js';
import { createFindBar } from './find-bar.js';
import { createHeights } from './heights.js';
import { LOOK_KEY, lookOf } from './look.js';
import { createMessageList } from './message-list.js';
import { createMessageRows } from './message-row.js';
import { createPickers } from './pickers.js';
import { createPictureViewer } from './picture-viewer.js';
import { createQuill } from './quill-view.js';
import { createRowModel } from './row-model.js';
import { createSendPath } from './send-path.js';
import { SENT_DIR, createSentPictures } from './sent-pictures.js';
import { readSettings, settingsDir } from './settings-io.js';
import { createSettingsWindow } from './settings-window.js';
import { saveSquareThumb } from './shots.js';
import { asksActedOn, isShownIn, shownThread } from './shown.js';
import { START_ROW, createThreadFeed } from './thread-feed.js';

/** @typedef {import('./chat-types.js').Color} Color */
/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./chat-asks.js').ChatShown} ChatShown */
/** @typedef {import('./row-model.js').Row} Row */
/** @typedef {import('./chat-types.js').Theme} Theme */

// the ui font, as the old chat drew it
const SANS = '.AppleSystemUIFont';

// the terminals a pick is typing keys into, model, effort or permission: it outlives a thread switch, so a second pick
// never types beside it
const typingInto = new Set();
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

export default class Chat extends View {
    model = createRowModel();
    heights = createHeights();
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
    /** his chat look (look.js), read each render */
    look = lookOf(null);
    /** the quill, its drafts, the files waiting over it and its / menu */
    quill = createQuill({
        column: () => this.list.column(),
        flash: (note, ms, cx) => this.flashNote(note, cx, ms),
        pickersView: (t) => this.pickers.view(t),
        say: (note, cx) => this.say(note, cx),
        sendPath: () => this.sendPath,
        showPictures: (files, at, cx) => this.pictures.show(files, at, cx),
        shownFile: () => this.feed.file(),
    });
    sent = createSentPictures(SENT_IO);
    /** what the quill says about his last send: why it did not go, or why it went as a push @type {string | null} */
    note = null;
    /** the send path: the magic send's marks, the hold, a send that did not go coming back */
    sendPath = createSendPath({
        attachments: this.quill.attachments,
        pushed: (text, at) => this.model.pushed(text, at),
        quillBox: () => this.quill.box(),
        quills: this.quill.quills,
        say: (note, cx) => this.say(note, cx),
        shownAddress: () => this.feed.address(),
        shownFile: () => this.feed.file(),
        typingInto,
    });
    /** the band over the quill and the bar under it */
    band = createBand({
        column: () => this.list.column(),
        pid: () => this.feed.pid(),
        shownAddress: () => this.feed.address(),
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
        shownAddress: () => this.feed.address(),
        status: () => this.statusNow(),
        typingInto,
    });
    /** the picture viewer over the chat (W33/W35) */
    pictures = createPictureViewer({
        file: () => this.feed.file(),
        focusQuill: () => this.quill.focus(),
        isCleanShot: () => this.isCleanShot,
        isCmdHeld: () => this.isCmdHeld,
        room: () => this.list.size(),
        say: (note, cx) => this.say(note, cx),
    });
    /** find in the chat (slice 6): the bar and the search the rows mark */
    findBar = createFindBar({
        focusQuill: () => this.quill.focus(),
        isAllLoaded: () => this.feed.isStart() ?? false,
        rows: () => this.list.shown(),
        show: (id) => this.list.restore(id, 0),
    });
    /** a blocked thread's ask with the keys that answer it, over the quill */
    blocked = createBlockedPanel({
        address: () => this.feed.address(),
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
        file: () => this.feed.file(),
        flash: (note, cx) => this.flashNote(note, cx),
        heights: this.heights,
        loadEarlier: (cx) => this.feed.loadEarlier(cx),
        pictures: this.pictures,
        reader: () => this.feed.reader(),
        rows: this.rows,
    });
    /** the thread shown: its Claude, its transcript read and watched, its earlier pages */
    feed = createThreadFeed({
        band: this.band,
        clearShown: () => this.clearShown(),
        findBar: this.findBar,
        heights: this.heights,
        list: this.list,
        look: () => this.look,
        model: this.model,
        pickers: this.pickers,
        quill: this.quill,
        rows: this.rows,
        sendPath: this.sendPath,
        sent: this.sent,
    });

    /** every view lets go of the thread it showed: nothing of the old one may act on the next */
    clearShown() {
        this.model.clear();
        this.blocked.clear();
        this.rows.clearThread();
        this.heights.clear();
        this.quill.clearThread();
        this.note = null;
        // the viewer and find belong to the thread they opened on
        this.pictures.close();
        this.findBar.reset();
        this.sendPath.takeJoins(null);
        // no button shows or presses a thread no longer on screen; the fleet's facts stay
        this.band.clear();
        this.pickers.clear();
        this.sendPath.cancelHold();
        this.quill.showDraft();
        this.list.reset();
    }

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
        cx.timer.every(ASK_READ_MS, (later) => this.blocked.read(later));
        this.ageFacts(cx);
        cx.timer.every(BAND_AGE_MS, (later) => this.ageFacts(later));
        this.feed.start(cx);
    }

    /** @param {Context} _cx */
    render(_cx) {
        if (this.settingsWindow) return this.settingsWindow.render();
        const t = /** @type {Theme} */ (theme());
        // the chat finds its own thread, as the old chat did; on screen it names it for the deck's ⌘⇧K, hidden it names none
        const { stack, self } = props() ?? {};
        const isShown = isShownIn(layout(), stack, self);
        const address = shownThread(
            agents(),
            focused(),
            this.feed.shownAddress(),
        );
        const isSwitched = this.feed.follow(address, _cx);
        /** @type {ChatShown} */
        const named = isShown
            ? {
                  address,
                  isFindOpen: this.findBar.find.state.isOpen,
                  pid: this.feed.pid() ?? null,
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
            this.feed.isRead() && shown.length && this.feed.isStart()
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
        const error = this.feed.error();
        if (rows.length) {
            if (error)
                root.child(
                    div()
                        .px(12)
                        .py(4)
                        .text_size(12)
                        .text_color(t.muted)
                        .bg(t.raised)
                        .child(error),
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
                    .child(error ?? this.emptyLine()),
            );
        if (!this.feed.file() || !this.quill.box()) return root;
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
        return agents().find((agent) => agent.address === this.feed.address())
            ?.status;
    }

    /** what the view says while it has no row to draw */
    emptyLine() {
        if (this.feed.pid() === null) return 'No thread is shown here yet';
        if (!this.feed.file()) return 'Opening the thread…';
        return this.feed.isRead()
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

    /** his settings rows as the chat uses them @param {Record<string, unknown>} values */
    applySettings(values) {
        this.sendPath.applySettings(values);
        this.isCleanShot = values['chatter.pictures.cleanshot'] === true;
        this.band.applySettings(values);
        this.isShowMore = values['chatter.showMore'] === true;
    }

    /** @param {string | null} note @param {Context} cx */
    say(note, cx) {
        this.note = note;
        cx.notify();
    }
}
