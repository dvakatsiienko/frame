// x-herdr-chat: the Chat view, built new in place of zoo's chat (FRM-638). it reads the thread shown,
// drawn as his messages, replies and one line per tool call, in a list that never moves without him, over the quill,
// his text box. this file builds the views and composes them; MODULES.md names the module that owns each part.

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
import {
    CHAT_DROP,
    CHAT_SHOWN,
    CHAT_VIEW,
    chatDropOf,
    chatViewOf,
} from './chat-asks.js';
import { readableTheme } from './contrast.js';
import { onDisk } from './disk.js';
import { createFindBar } from './find-bar.js';
import { createHeights } from './heights.js';
import { joinIo, linesWith, logTrial, newId } from './join-io.js';
import { JOINS_DIR } from './joins.js';
import { LOOK_KEY, lookOf } from './look.js';
import { createMessageList } from './message-list.js';
import { createMessageRows } from './message-row.js';
import { createNotePopup } from './note-popup.js';
import { createNotesByRow } from './note-rows.js';
import { repliesBelow } from './note-text.js';
import { createNotes } from './notes.js';
import { audioAppOf } from './open-path.js';
import { createPathLinks } from './path-links.js';
import { createPickers } from './pickers.js';
import { createPictureViewer } from './picture-viewer.js';
import { MINI_STOP, createQuillMini } from './quill-mini.js';
import { createQuill } from './quill-view.js';
import { createRowModel } from './row-model.js';
import { createSendPath } from './send-path.js';
import { SENT_DIR, createSentPictures } from './sent-pictures.js';
import { readSettings, settingsDir } from './settings-io.js';
import { createSettingsWindow } from './settings-window.js';
import { saveSquareThumb } from './shots.js';
import {
    asksActedOn,
    isDropAsked,
    isShownIn,
    isViewAsked,
    openingKeys,
    shownThread,
} from './shown.js';
import { TAB_HELD, createTabMember, loopOf } from './tab-loop.js';
import { START_ROW, createThreadFeed } from './thread-feed.js';
import { NAMES_KEY } from './thread-keys.js';

/** @typedef {import('./chat-types.js').Color} Color */
/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./chat-asks.js').ChatShown} ChatShown */
/** @typedef {import('./row-model.js').Row} Row */
/** @typedef {import('./chat-types.js').Theme} Theme */

// the ui font, as the old chat drew it
const SANS = '.AppleSystemUIFont';
// the time of a press on «tell», in this window's shared store
const TELL = 'chat.tell';

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
    /** F6's last ask: the time he pressed it (the status bar takes the key and writes it) @type {unknown} */
    annotateAsk = null;
    /** ⌘F's last ask, pressed anywhere in the window (the status bar takes the key and writes the time) @type {unknown} */
    findAsk = null;
    /** Esc's last ask from outside the chat (the status bar takes the key and writes the time) @type {unknown} */
    escapeAsk = null;
    /** the time of the last viewer ask opened: one made before this load never opens again @type {number | null} */
    viewAsk = chatViewOf(shared(CHAT_VIEW))?.time ?? null;
    /** the header's drop taken last @type {number | null} */
    dropAsk = chatDropOf(shared(CHAT_DROP))?.time ?? null;
    /** ⌘⇧E's last ask @type {unknown} */
    effortAsk = null;
    /** what this chat last wrote in `chat.shown`, as json: its thread on screen and whether find is open @type {string} */
    namedShown = '';
    /** the chat has drawn since this load */
    isLoaded = false;
    /** the threads opened this load: an earlier one's landing is not the newest's */
    openedCount = 0;
    /** the keyboard on its way to a thread he opened @type {import('./shown.js').OpeningKeys} */
    keys = 'none';
    /** whether the chat was on screen at the last draw */
    wasShown = false;
    /** his chat look (look.js), read each render */
    look = lookOf(null);
    /** the chat's own keyboard focus, where Esc or a press outside the quill leaves it @type {import('gpui-kit').FocusHandle | null} */
    chatKeys = null;
    /** the chat's seat in the Tab loop: the quill, while the chat shows */
    tab = createTabMember('x-herdr-chat', { layout, setShared, shared });
    /** the quill, its drafts, the files waiting over it and its / menu */
    quill = createQuill({
        column: () => this.list.column(),
        flash: (note, ms, cx) => this.flashNote(note, cx, ms),
        leave: (cx) => this.leaveQuill(cx),
        messages: () =>
            this.model.rows
                .filter((r) => r.kind === 'mine' || r.kind === 'reply')
                .map((r) => r.text),
        pickersView: (t) => this.pickers.view(t),
        pressEscape: (cx) => {
            if (!this.closeTop(cx)) this.chatKeys?.focus();
        },
        say: (note, cx) => this.say(note, cx),
        sendPath: () => this.sendPath,
        showPictures: (files, at, cx) => this.pictures.show(files, at, cx),
        shownFile: () => this.feed.file(),
        tab: this.tab,
    });
    sent = createSentPictures(SENT_IO);
    /** the paths a reply names that are on disk */
    links = createPathLinks({ home, onDisk });
    /** what the quill says about his last send: why it did not go, or why it went as a push @type {string | null} */
    note = null;
    /** the send path: the magic send's marks, the hold, a send that did not go coming back */
    sendPath = createSendPath({
        attachments: this.quill.attachments,
        editorMode: () => this.claudeSettings?.editorMode,
        notePulled: (file, words) => this.notes.pulled(file, words),
        popped: () => this.model.popped(),
        pushed: (text, at) => this.model.pushed(text, at),
        quillBox: () => this.quill.box(),
        quills: this.quill.quills,
        resetPopped: () => this.model.resetPopped(),
        say: (note, cx) => this.say(note, cx),
        shownAddress: () => this.feed.address(),
        shownFile: () => this.feed.file(),
        typingInto,
    });
    /** the notes he writes on words he selected (FRM-585) */
    notes = createNotes({
        dir: `${home()}/${JOINS_DIR}`,
        io: joinIo,
        joinsOf: (thread) => this.feed.joinsOf(thread),
        linesWith,
        logTrial,
        movedOn: (thread, id, next, cut) =>
            this.quillMini.movedOn(thread, id, next, cut),
        newId,
        store: localStorage,
    });
    notesUnder = createNotesByRow((id) => this.rowOf(id));
    /** the box a note is written in, over the list */
    quillMini = createQuillMini({
        back: (id) => this.repliesUnder(id),
        focusQuill: (isSending) => this.quill.focus(isSending),
        notes: this.notes,
        pressEscape: (cx) => this.closeTop(cx),
        room: () => this.list.size(),
        rowOf: (id) => this.rowOf(id),
        say: (note, cx) => this.say(note, cx),
        sendNote: (id, back) => this.sendPath.sendNote(this.notes, id, back),
        settle: (cx) => this.feed.settleNotes(cx),
        tab: this.tab,
        thread: () => this.feed.file(),
        threadName: () => this.threadName(),
    });
    isNotePopup = true;
    /** the popup's last press, or a click on a note's words, as the chat saw it @type {unknown} */
    tellAsk = null;
    /** the note whose words he clicked, until the chat opens it @type {string | null} */
    noteAsk = null;
    /** «tell <thread>» beside the words he selected */
    notePopup = createNotePopup({
        ask: () => setShared(TELL, Date.now()),
        isOn: () => this.isNotePopup,
        room: () => this.list.size(),
        threadName: () => this.threadName(),
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
    /** the app a file row's audio opens in (`chatter.audio.app`); null: the system's choice @type {string | null} */
    audioApp = audioAppOf(null);
    /** x-herdr-settings, when this copy draws it @type {{ render: () => any } | null} */
    settingsWindow = null;
    isCmdHeld = false;
    noteSerial = 0;
    /** the model, effort and permission pickers under the quill */
    pickers = createPickers({
        addFiles: (paths, cx) => this.quill.addFiles(paths, cx),
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
        isShowMore: () => this.isShowMore,
        look: () => this.look,
        noteOf: (row) => {
            const file = this.feed.file();
            return file ? this.notes.noteOf(file, row.text) : null;
        },
        notesOn: (row) => this.notesOn(row),
        room: () => this.list.room(),
        sent: this.sent,
    });
    /** the list on screen and his reading place in it */
    list = createMessageList({
        annotate: (selected, cx) => this.annotate(selected, cx),
        audioApp: () => this.audioApp,
        file: () => this.feed.file(),
        heights: this.heights,
        loadEarlier: (cx) => this.feed.loadEarlier(cx),
        noteBox: (t) => this.quillMini.view(t),
        noteClicked: (id) => {
            this.noteAsk = id;
            setShared(TELL, Date.now());
        },
        notePopup: (t) => this.notePopup.element(t),
        openNote: (id, at, cx) => this.quillMini.openNote(id, at, cx),
        pictures: this.pictures,
        reader: () => this.feed.reader(),
        rows: this.rows,
        say: (note, cx) => this.say(note, cx),
        scrolled: (cx) => this.notePopup.hide(cx),
        selected: (cx) =>
            this.notePopup.reported(this.list.selectedAt(Date.now()), cx),
        unsend: (queued, cx) => this.sendPath.unsend(queued, cx),
    });
    /** the thread shown: its Claude, its transcript read and watched, its earlier pages */
    feed = createThreadFeed({
        band: this.band,
        clearShown: (cx) => this.clearShown(cx),
        findBar: this.findBar,
        heights: this.heights,
        links: this.links,
        list: this.list,
        look: () => this.look,
        model: this.model,
        notes: this.notes,
        notesChanged: (cx) => {
            this.quillMini.noteChanged(cx);
            // a message of his that turned into a note draws other words: find counts them anew
            if (this.findBar.find.state.isOpen)
                this.findBar.find.recount(
                    this.rows.shown(this.model.rows, this.look),
                );
        },
        pickers: this.pickers,
        quill: this.quill,
        rows: this.rows,
        sendPath: this.sendPath,
        sent: this.sent,
    });

    /** the row that holds a message's line now: an older page may join it under its own id @param {string} id */
    rowOf(id) {
        return this.model.rows[this.model.indexOf(id)]?.id ?? id;
    }

    /** how many replies stand below a message's line @param {string} id */
    repliesUnder(id) {
        return repliesBelow(this.model.rows, this.rowOf(id));
    }

    /** his notes on a row of the thread shown @param {Row} row */
    notesOn(row) {
        const file = this.feed.file();
        return this.notesUnder(
            row.id,
            file ? this.notes.of(file) : [],
            this.model.rows,
        );
    }

    /** every view lets go of the thread it showed: nothing of the old one may act on the next @param {Context} cx */
    clearShown(cx) {
        this.model.clear();
        this.blocked.clear();
        this.rows.clearThread();
        this.heights.clear();
        this.quill.clearThread();
        this.note = null;
        // the viewer and find belong to the thread they opened on
        this.pictures.close();
        this.findBar.reset();
        this.quillMini.reset();
        this.notePopup.hide(cx);
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
        this.chatKeys = cx.focus_handle();
        this.quill.start(cx);
        this.quillMini.start(cx);
        this.notePopup.start(cx);
        this.pickers.start(cx);
        this.pictures.start(cx);
        this.findBar.start(cx);
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
        // a theme that paints the terminal in its text colour (win98) gives the chat a background he can read on
        const t = /** @type {Theme} */ (readableTheme(theme()));
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
              }
            : { address: null, isFindOpen: false };
        const namedKey = JSON.stringify(named);
        if (namedKey !== this.namedShown) {
            this.namedShown = namedKey;
            _cx.timer.after(0, () => setShared(CHAT_SHOWN, named));
        }
        // the keyboard comes to the quill when the chat comes on screen, on a thread switch and on ⌘K: a click on a tab
        // gives it to that tab's hidden terminal. ⌘⇧E opens the picker on the effort, a second press applies it. a press
        // the chat slept through is dropped, never acted on late
        const quillAsk = shared('chat.quill') ?? null;
        const annotateAsk = shared('chat.annotate') ?? null;
        const effortAsk = shared('chat.effort') ?? null;
        const findAsk = shared('chat.find') ?? null;
        const escapeAsk = shared('chat.escape') ?? null;
        const heldStop = shared(TAB_HELD);
        const isHeldElsewhere =
            typeof heldStop === 'string' &&
            heldStop !== 'quill' &&
            heldStop !== MINI_STOP &&
            loopOf(shared, layout()).includes(heldStop);
        const acts = asksActedOn({
            annotateAsk,
            effortAsk,
            escapeAsk,
            findAsk,
            // a reload of the chat opens no thread: a steer box he types in keeps the keyboard
            isKept: !this.isLoaded && isHeldElsewhere,
            isShown,
            isSwitched,
            lastAnnotate: this.annotateAsk,
            lastEffort: this.effortAsk,
            lastEscape: this.escapeAsk,
            lastFind: this.findAsk,
            lastQuill: this.quillAsk,
            now: Date.now(),
            quillAsk,
            wasShown: this.wasShown,
        });
        this.quillAsk = acts.lastQuill;
        this.annotateAsk = acts.lastAnnotate;
        this.effortAsk = acts.lastEffort;
        this.findAsk = acts.lastFind;
        this.escapeAsk = acts.lastEscape;
        this.wasShown = isShown;
        this.isLoaded = true;
        // Esc pressed anywhere in the window closes what is on top (dima, 18:18)
        if (acts.isEscape) _cx.timer.after(0, (later) => this.closeTop(later));
        // F6: the words that stood selected at its press, since a press in between lets them go
        if (acts.isAnnotate && !this.pictures.isOpen())
            _cx.timer.after(0, (later) =>
                this.quillMini.toggle(
                    () => this.list.selectedAt(Number(annotateAsk)),
                    Number(annotateAsk),
                    later,
                ),
            );
        // a press on «tell»: the words it held go to the box, in a draw of the chat's own
        const tellAsk = shared(TELL) ?? null;
        if (tellAsk !== this.tellAsk) {
            this.tellAsk = tellAsk;
            _cx.timer.after(0, (later) => {
                const words = this.notePopup.take();
                const note = this.noteAsk;
                this.noteAsk = null;
                if (words) this.annotate(words, later);
                else if (note) this.quillMini.openNote(note, null, later);
            });
        }
        // a click on an orbit preview brings the chat into view and asks its viewer here (FRM-676)
        const viewAsk = chatViewOf(shared(CHAT_VIEW));
        if (
            isViewAsked(viewAsk, this.viewAsk, isShown, Date.now()) &&
            viewAsk
        ) {
            this.viewAsk = viewAsk.time;
            _cx.timer.after(0, (later) =>
                this.pictures.show(
                    viewAsk.files,
                    viewAsk.at,
                    later,
                    viewAsk.isDesktop,
                ),
            );
        }
        const dropAsk = chatDropOf(shared(CHAT_DROP));
        if (
            isDropAsked(dropAsk, this.dropAsk, {
                address: this.feed.address(),
                isShown,
                now: Date.now(),
            }) &&
            dropAsk
        ) {
            this.dropAsk = dropAsk.time;
            _cx.timer.after(0, (later) =>
                this.quill.addFiles(dropAsk.paths, later),
            );
        }
        if (acts.isFind && !this.pictures.isOpen())
            _cx.timer.after(0, (later) => this.findBar.open(later));
        // the quill is the chat's Tab stop while the chat shows, the note box one more while open; the loop asks for one, or
        // a reload hands it back
        const stops = this.quillMini.isOpen()
            ? ['quill', MINI_STOP]
            : ['quill'];
        const tabbed = this.tab.draw(isShown ? stops : [], (run) =>
            _cx.timer.after(0, run),
        );
        const isTabbed = tabbed === 'quill';
        if (tabbed === MINI_STOP)
            _cx.timer.after(0, () => this.quillMini.focus());
        const isAsked = isTabbed || (acts.isFocus && !this.pictures.isOpen());
        // a quill the next opening takes off the screen is no place for the keyboard
        if (isAsked && !this.isOpening())
            _cx.timer.after(isTabbed ? 0 : 50, () => {
                if (isTabbed || !this.pickers.isOpen()) this.quill.focus();
            });
        if (!isShown || !address) this.tellKeys({ type: 'left' });
        else if (acts.isOpened || (isAsked && this.isOpening())) {
            this.tellKeys({ type: 'opened' });
            this.openedCount += 1;
            const opened = this.openedCount;
            // the viewer and the picker of the thread he left hold no keyboard here
            if (isSwitched)
                _cx.timer.after(0, (later) => {
                    this.pictures.close();
                    this.pickers.clear();
                    later.notify();
                });
            // past herdr's own focus, which a tab switch gives that tab's hidden terminal
            _cx.timer.after(50, (later) => {
                if (opened !== this.openedCount) return;
                this.tellKeys({
                    isOpening: this.isOpening(),
                    type: 'landed',
                });
                later.notify();
            });
        } else if (this.keys === 'held')
            _cx.timer.after(0, () =>
                this.tellKeys({
                    isHere: Boolean(this.chatKeys?.is_focused()),
                    isOpening: this.isOpening(),
                    type: 'drawn',
                }),
            );
        // the open viewer holds the keyboard: a click on the list or a later focus of the quill never keeps it, a click into another pane or mod does
        this.pictures.keepKeys(_cx, {
            inQuill: this.quill.isFocused(),
            onList: Boolean(this.chatKeys?.is_focused()),
        });
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
            .when(Boolean(this.chatKeys), (el) =>
                el.track_focus(
                    /** @type {import('gpui-kit').FocusHandle} */ (
                        this.chatKeys
                    ),
                ),
            )
            .on_action('x_herdr_chat_find', (_e, cx) => {
                if (!this.pictures.isOpen()) this.findBar.open(cx);
            })
            // claimed with nothing to close too: herdr answers a mod's key no handler claims with an error
            .on_action('x_herdr_chat_find_close', (_e, cx) => this.closeTop(cx))
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
                // a file dropped anywhere on the chat joins the quill (FRM-620:W79): over it all, since a drop is a mouse-up and
                // a link or the viewer under the pointer takes one; herdr lets every click through a layer that only
                // takes a drop
                .child(
                    div()
                        .absolute()
                        .top(0)
                        .left(0)
                        .size_full()
                        .on_drop((e, cx) =>
                            this.quill.addFiles(e?.paths ?? [], cx),
                        ),
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

    /** a line under the quill that leaves on its own @param {string} note @param {Context} cx @param {number} ms */
    flashNote(note, cx, ms) {
        this.note = note;
        const shown = ++this.noteSerial;
        cx.timer.after(ms, (cx) => {
            if (this.note === note && this.noteSerial === shown)
                this.note = null;
            cx.notify();
        });
        cx.notify();
    }

    /** the thread shown has no quill drawn yet, or one about to go */
    isOpening() {
        return this.feed.isOpening() || !this.feed.file();
    }

    /** @param {Parameters<typeof openingKeys>[1]} event */
    tellKeys(event) {
        const { focus, keys } = openingKeys(this.keys, event);
        this.keys = keys;
        if (this.pictures.isOpen() || this.pickers.isOpen()) return;
        if (focus === 'quill') this.quill.focus();
        else if (focus === 'chat') this.chatKeys?.focus();
    }

    /** a press outside the quill: find closes, else the chat takes the keyboard, unless the note box has it @param {Context} cx */
    leaveQuill(cx) {
        if (this.findBar.find.state.isOpen) this.findBar.close(cx);
        else if (!this.quillMini.isOpen()) this.chatKeys?.focus();
    }

    /** Esc over the chat: the viewer closes, else the note box, else find (dima, 18:18) @param {Context} cx @returns {boolean} whether one did */
    closeTop(cx) {
        const isFind = this.findBar.find.state.isOpen;
        if (this.pictures.isOpen()) this.pictures.step('close', cx);
        else if (this.quillMini.isOpen()) this.quillMini.close(cx);
        else if (isFind) this.findBar.close(cx);
        else return false;
        return true;
    }

    /** the shown thread as antenna names it */
    threadName() {
        const address = this.feed.address();
        const names = /** @type {Record<string, string> | null} */ (
            shared(NAMES_KEY)
        );
        return (
            (address && names?.[address]) ??
            agents().find((agent) => agent.address === address)?.title ??
            ''
        );
    }

    /** his settings rows as the chat uses them @param {Record<string, unknown>} values */
    applySettings(values) {
        this.sendPath.applySettings(values);
        this.isCleanShot = values['chatter.pictures.cleanshot'] === true;
        this.audioApp = audioAppOf(values);
        this.band.applySettings(values);
        this.isShowMore = values['chatter.showMore'] === true;
        this.isNotePopup = values['chatter.annotate.popup'] !== false;
    }

    /** the note box on words he selected, the popup gone @param {import('./selection.js').SelectedAt} selected @param {Context} cx */
    annotate(selected, cx) {
        this.notePopup.hide(cx);
        this.quillMini.show(selected, cx);
    }

    /** @param {string | null} note @param {Context} cx */
    say(note, cx) {
        this.note = note;
        cx.notify();
    }
}
