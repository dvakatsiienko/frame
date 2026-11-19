// x-herdr-chat: the Chat view, built new in place of zoo's chat (FRM-638). it reads the thread shown,
// drawn as his messages, replies and one line per tool call, in a list that never moves without him, over the quill,
// his text box. the rules live in their own files, each tested with no herdr: reader.js, row-model.js, heights.js,
// follow.js, place.js, quill.js, send.js, magic.js.

import { mkdir, readdir, writeFile } from 'fs/promises';
import {
    TextView,
    Textarea,
    TextareaState,
    VirtualListScrollHandle,
    h_flex,
    v_flex,
    v_virtual_list,
} from 'gpui-base';
import { View, div, image } from 'gpui-kit';
import {
    agents,
    appHome,
    checking,
    closeOverlay,
    exec,
    focused,
    hc,
    home,
    layout,
    props,
    readTextFile,
    setShared,
    settings,
    shared,
    theme,
    watchFolder,
    writeTextFile,
} from 'herdr';

import { fileName, isImagePath, pickFiles, withPaths } from './attach.js';
import { createAttachments } from './attachments.js';
import { STATE_DIR } from './band.js';
import { createBand } from './band-view.js';
import { createBlockedPanel } from './blocked-panel.js';
import { splitBlocks } from './blocks.js';
import { CHAT_SHOWN } from './chat-asks.js';
import { messageDetails } from './details.js';
import {
    fileAt,
    isSentRow,
    openArgs,
    replyIdOf,
    unlinkFiles,
    withFileRows,
} from './files.js';
import { findSpans } from './find.js';
import { createFindBar } from './find-bar.js';
import { replyFold } from './fold.js';
import { placeOf } from './follow.js';
import { createHeights, guessHeight } from './heights.js';
import { ICONS } from './icons.js';
import {
    HOLD_DELAY_MS,
    HOLD_PUSH_MS,
    JOINED_SHOWN_MS,
    JOINS_DIR,
    JOIN_TAKE_MS,
    enterHoldStep,
    holdSend,
} from './joins.js';
import { createKeyPress } from './keypress.js';
import { LOOK_KEY, lookOf } from './look.js';
import { createMagic, retextWait } from './magic.js';
import { copyText, createMessageMenu, menuPlace } from './menu.js';
import { createPages } from './pages.js';
import { createPickers } from './pickers.js';
import { createPictureViewer } from './picture-viewer.js';
import { createPlace } from './place.js';
import { sendArgs } from './queued.js';
import { createQuills } from './quill.js';
import { createReader } from './reader.js';
import { createRowModel } from './row-model.js';
import { addressIn, sendBlocked, submitted } from './send.js';
import { SENT_DIR, createSentPictures } from './sent-pictures.js';
import { readSettings, settingsDir } from './settings-io.js';
import { createSettingsWindow } from './settings-window.js';
import {
    deletePreviewCopies,
    loadShots,
    readClipboard,
    saveFileShot,
    saveShots,
    saveSquareThumb,
} from './shots.js';
import { asksActedOn, isShownIn, pidFor, shownThread } from './shown.js';
import { loadableSkills } from './skills.js';
import { createSlashMenu, listedSkills, menuNames } from './slash.js';
import { transcriptPath } from './thread.js';
import { tint } from './tint.js';
import {
    createToolFolds,
    isCallRow,
    isCardRow,
    withCallRows,
} from './tool-folds.js';
import { typedMarkdown } from './typed.js';

/** @typedef {import('./chat-types.js').Color} Color */
/** @typedef {import('./chat-types.js').Context} Context */
/** @typedef {import('./chat-asks.js').ChatShown} ChatShown */
/** @typedef {import('./row-model.js').Row} Row */
/** @typedef {import('./chat-types.js').Theme} Theme */

// the readable column of a narrow look (the old chat's), and the share of the column a bubble may take
const NARROW = 820;
const BUBBLE_SHARE = 0.8;
// the room above and below each row, per spacing
const ROW_PAD = { normal: 6, roomy: 10, tight: 3 };
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
// [TRACE-place] how long after an open the list's asks are traced
const TRACE_MS = 8000;

// a reply's file rows, made once per reply version (files.js)
/** @type {Map<string, { version: number, files: Row[] }>} */
const fileRows = new Map();
/**
 * the rows the list draws: the model's, less tool calls when he hides them, each reply's files after it
 * @param {readonly Row[]} rows @param {import('./look.js').Look} look
 */
const shownOf = (rows, look) =>
    withCallRows(
        withFileRows(
            look.tools === 'hide'
                ? rows.filter((row) => row.kind !== 'tool')
                : rows,
            home(),
            fileRows,
        ),
        toolFolds,
    );
// which tool-call folds and calls are open (PK-432)
const toolFolds = createToolFolds();
// his reading place is saved this long after his last scroll step
const PLACE_SAVE_MS = 600;
// how long after a held place was last asked for the list stays unseen: its landing takes two frames, and a
// reload asks again as each real height arrives
const SETTLE_MS = 120;
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
const SEND_SIZE = 28;
// a picture waiting over the quill, and how long a paste's «nothing there» note stays
const THUMB_SIZE = 56;
// a picture his message sent or a reply names, a square under the words
const SENT_THUMB = 96;
const PASTE_NOTE_MS = 6000;
const NO_IMAGE = 'No image on the clipboard';
// the right-click menu's size, one row; its note under the quill once a message is copied
const MENU_SIZE = { h: 34, w: 200 };
// a blocked thread's screen is read this often while it asks, so the question card follows its cursor
const ASK_READ_MS = 1000;
// the settings folder is looked for again this often while it does not exist
const SETTINGS_RETRY_MS = 10 * 1000;
// about how wide a character of a reply is, in px: the fold counts a bubble's lines from its width
const CHAR_PX = 7.5;
const COPIED_NOTE = 'Message copied';
const COPIED_NOTE_MS = 1500;
// each save waits for the one before it, so an older store never lands last
let shotsSaved = Promise.resolve();
/** @type {import('./attachments.js').AttachmentsIo} */
const ATTACH_IO = {
    deleteCopies: (rels) => {
        deletePreviewCopies(rels).catch(() => {});
    },
    makePreview: saveFileShot,
    now: Date.now,
    save: (store) => {
        shotsSaved = shotsSaved.then(() => saveShots(store)).catch(() => {});
    },
};
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
const QUILL_ENTER = 'x_herdr_chat_quill_enter';
/** @type {import('./skills.js').SkillFs} */
const SKILL_FS = {
    list: (dir) => readdir(dir).catch(() => []),
    read: (path) => readTextFile(path).catch(() => null),
};
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
    scroll = VirtualListScrollHandle.new();
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
    /** every thread's quill and its mark, the one owner of what the box shows */
    quills = createQuills(localStorage, (text) => {
        // a write of ours (a send, a taken mark, a fill) is an edit the / menu reads too: a sent «/co» closes it
        this.slashMenu?.typed(this.typedNow ?? '', text);
        this.typedNow = text;
        this.typedBefore = text;
    });
    /** the files waiting over each thread's quill, by its transcript file; what waited comes back once the store is read */
    attachments = createAttachments(appHome(), ATTACH_IO, {});
    sent = createSentPictures(SENT_IO);
    /** where a message to the shown thread goes: its herdr address @type {string | null} */
    address = null;
    /** what the quill says about his last send: why it did not go, or why it went as a push @type {string | null} */
    note = null;
    /** the marks of the magic send: words waiting in the quill to join a turn */
    magic = createMagic({
        dir: `${home()}/${JOINS_DIR}`,
        io: joinIo,
        newId,
        quills: this.quills,
    });
    /** what the shown thread's state lists of its joins; null: joins are off for it @type {import('./magic.js').Joins | null} */
    joins = null;
    /** the pending wait for a change in the threads' state folder @type {import('herdr').FolderWatch | null} */
    stateWatch = null;
    /** a press on send under way @type {import('./joins.js').Hold | null} */
    hold = null;
    holdFill = 0;
    /** @type {{ cancel: () => void } | null} */
    holdTask = null;
    /** how long a hold takes to push: his two settings rows */
    timing = { delay: HOLD_DELAY_MS, push: HOLD_PUSH_MS };
    lastKeyAt = 0;
    /** the quill's text, and its text one change earlier: Enter types its line break before it submits */
    typedNow = '';
    /** Enter in the quill, one press at a time: a held key's repeats act once */
    quillKeys = createKeyPress();
    typedBefore = '';
    /** one more at each thread opened: a state watch of an earlier opening ends */
    stateTurn = 0;
    /** the band over the quill and the bar under it */
    band = createBand({
        column: () => this.column(),
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
        column: () => this.column(),
        hasRows: () => this.model.rows.length > 0,
        quillBox: () => this.box,
        shownAddress: () => this.address,
        status: () => this.statusNow(),
        typingInto,
    });
    /** the picture viewer over the chat (W33/W35) */
    pictures = createPictureViewer({
        file: () => this.file,
        focusQuill: () => this.box?.focus(),
        isCleanShot: () => this.isCleanShot,
        isCmdHeld: () => this.isCmdHeld,
        room: () => ({
            height: this.viewH || 600,
            width: this.width || NARROW,
        }),
        say: (note, cx) => this.say(note, cx),
    });
    /** find in the chat (slice 6): the bar and the search the rows mark */
    findBar = createFindBar({
        focusQuill: () => this.box?.focus(),
        isAllLoaded: () => this.pages?.isStart() ?? false,
        rows: () => this.shownRows,
        show: (id) => this.at.restore(id, 0),
    });
    /** the / menu over the quill (slice 6) */
    slashMenu = createSlashMenu();
    /** the right-click menu on a message (slice 7) */
    messageMenu = createMessageMenu();
    /** a blocked thread's ask with the keys that answer it, over the quill */
    blocked = createBlockedPanel({
        address: () => this.address,
        isBlocked: () => this.statusNow() === 'blocked',
    });
    /** his «Show more» switch: a long reply of an earlier turn shows its first lines (FRM-607) */
    isShowMore = true;
    /** the long replies he opened with Show more, by row id @type {Set<string>} */
    openReplies = new Set();
    /** the rows of the turn he reads now, which never fold @type {Set<string>} */
    currentTurn = new Set();
    /** the thread's skills, from its transcript's listing @type {Map<string, string>} */
    skills = new Map();
    /** the skills of the plugins its folder enables @type {Map<string, string>} */
    pluginSkills = new Map();

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
        const box = TextareaState.new({});
        box.set_auto_grow(1, 8);
        box.on('change', (_event, cx) => {
            const now = box.value();
            // a change told twice is one change
            if (now !== this.typedNow) {
                this.typedBefore = this.typedNow;
                this.typedNow = now;
            }
            this.quills.apply(this.file, { text: now, type: 'typed' });
            this.typedUnderMark(box, cx);
            this.slashMenu.typed(this.typedBefore ?? '', now);
            cx.notify();
        });
        box.on('submit', (event, cx) => {
            const { act, caret, text } = submitted(
                box.value(),
                [this.typedNow, this.typedBefore],
                event,
                Boolean(this.file && this.waitingPaths(this.file).length),
            );
            if (text === null) return;
            // Enter's line break leaves, his caret stays; the words stay until they are sent or a turn takes them
            this.quills.apply(this.file, { text, type: 'typed' });
            box.set_selected_range({ end: caret, start: caret });
            // ⌘Enter reaches here, Enter is the quill's own action (QUILL_ENTER); a held key's repeats act once
            if (this.quillKeys.pressed() === 'repeat') return;
            if (act === 'push') this.push(box, cx);
            else if (act === 'click') this.click(box, cx);
        });
        // a paste with no text: the clipboard's image saved as a png, or files copied in Finder by their paths (FRM-613)
        box.on('paste_other', (_event, cx) => this.pasteFiles(cx));
        // one owner from the start: what loads joins what he added meanwhile
        cx.spawn(async (cx) => {
            const made = this.attachments.restore(await loadShots());
            cx.notify();
            if (await made) cx.notify();
        });
        box.on('blur', (_event, cx) => {
            this.quillKeys.blurred();
            const event = enterHoldStep(this.hold, 'blur');
            if (event) this.holdStep(box, event, cx);
        });
        this.box = box;
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
        // Enter in the quill is ours before the text box's own (context `Input`): no line break typed, so no scroll to
        // the caret (dima, 13:14). a binding herdr never reaches leaves Enter to the box's submit, as before
        cx.bind_keys([
            {
                action: QUILL_ENTER,
                context: 'XChatQuill > Input',
                keystroke: 'enter',
            },
        ]);
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
                if (!this.pickers.isOpen()) this.box?.focus();
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
        const lookKey = [
            look.size,
            look.font,
            look.width,
            look.space,
            look.tools,
        ].join('|');
        const shown = shownOf(this.model.rows, look);
        const rows =
            this.isRead && shown.length && this.pages?.isStart()
                ? [START_ROW, ...shown]
                : shown;
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
                .child(this.quill(this.box, t))
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
                        .key_context('XChatQuill')
                        .on_drop((e, cx) => this.addFiles(e?.paths ?? [], cx))
                        // Enter runs the send button's hold (FRM-628 W12): a tap joins on its release, a hold fills
                        // the disc and pushes; its repeats keep the one hold going
                        .on_action(QUILL_ENTER, (_event, cx) => {
                            if (this.quillKeys.pressed() === 'act')
                                this.press(box, cx, 'enter');
                        })
                        // the box never tells Enter's key-down (FRM-628 round 2 trace): its key-up ends a press
                        .on_key_up((e, cx) => {
                            if (e.key !== 'enter') return;
                            this.quillKeys.released();
                            const event = enterHoldStep(this.hold, 'keyUp');
                            if (event) this.holdStep(box, event, cx);
                        })
                        .on_modifiers_changed((e) => {
                            if (!e.modifiers.platform)
                                this.quillKeys.modifiersReleased();
                        })
                        .child(this.slashList(t))
                        .child(this.attachmentsRow(t))
                        // while the / menu shows, its keys come before the box's own
                        .child(
                            div()
                                .w_full()
                                .when(this.slashShown().list.length > 0, (el) =>
                                    el.key_context('ChatSlash'),
                                )
                                .on_action(
                                    'x_herdr_chat_slash_down',
                                    (_e, cx) => this.slashKey('down', cx),
                                )
                                .on_action('x_herdr_chat_slash_up', (_e, cx) =>
                                    this.slashKey('up', cx),
                                )
                                .on_action(
                                    'x_herdr_chat_slash_fill',
                                    (_e, cx) => this.slashKey('fill', cx),
                                )
                                .on_action(
                                    'x_herdr_chat_slash_close',
                                    (_e, cx) => this.slashKey('close', cx),
                                )
                                .child(Textarea.new(box)),
                        )
                        .child(
                            div()
                                .absolute()
                                .left(8)
                                .bottom(10)
                                .child(this.attachButton(t)),
                        )
                        .child(
                            // the picker sits left of send, as shepherdr's does
                            div()
                                .absolute()
                                .right(8 + SEND_SIZE + 6)
                                .bottom(10)
                                .child(this.pickers.view(t)),
                        )
                        .child(this.sendButton(box, t)),
                )
        );
    }

    /** @param {Context} cx */
    pasteFiles(cx) {
        const file = this.file;
        if (!file) return;
        cx.spawn(async (cx) => {
            const read = await readClipboard();
            if (this.file !== file) return;
            if (read && 'paths' in read) return this.addFiles(read.paths, cx);
            if (read) {
                this.attachments.paste(file, read.rel);
                this.filesUnderMark(file, cx);
            }
            this.note = read ? null : NO_IMAGE;
            // only the newest note's timer clears it
            const shown = ++this.noteSerial;
            if (!read)
                cx.timer.after(PASTE_NOTE_MS, (cx) => {
                    if (this.note === NO_IMAGE && this.noteSerial === shown)
                        this.note = null;
                    cx.notify();
                });
            cx.notify();
        });
    }

    /** dropped or picked files join the thread's attachments; a picture's preview draws once it is made @param {string[]} paths @param {Context} cx */
    addFiles(paths, cx, file = this.file) {
        if (!file || !paths.length || file !== this.file) return;
        cx.spawn(async (cx) => {
            const adding = this.attachments.add(file, paths);
            this.filesUnderMark(file, cx);
            cx.notify();
            await adding;
            cx.notify();
        });
    }

    /** + in the quill's bottom left: the mac's own picker, several files at once @param {Theme} t */
    attachButton(t) {
        return div()
            .id('chat-attach')
            .size(24)
            .flex()
            .items_center()
            .justify_center()
            .rounded_full()
            .text_size(16)
            .text_color(t.muted)
            .cursor_pointer()
            .hover((s) => s.bg(t.raised).text_color(t.foreground))
            .tooltip('Attach files')
            .on_click((_e, cx) => {
                const file = this.file;
                cx.spawn(async (cx) =>
                    this.addFiles(await pickFiles(), cx, file),
                );
            })
            .child('+');
    }

    /**
     * what waits over the quill: a 56 px preview per picture, a «📎 name» chip per other file, each with its ×
     * (FRM-609: no caption, no Remove, each × takes its own)
     * @param {Theme} t
     */
    attachmentsRow(t) {
        const waiting = this.file ? this.attachments.of(this.file) : [];
        const file = this.file;
        /** @param {string} id @param {string} path */
        const remove = (id, path) =>
            div()
                .id(id)
                .absolute()
                .top(3)
                .right(3)
                .size(18)
                .flex()
                .items_center()
                .justify_center()
                .rounded_full()
                .bg(t.background)
                .text_size(11)
                .text_color(t.foreground)
                .cursor_pointer()
                .tooltip('Remove')
                .on_click((_e, cx) => {
                    cx.stop_propagation();
                    if (file) {
                        this.attachments.remove(file, path);
                        this.filesUnderMark(file, cx);
                    }
                    cx.notify();
                })
                .child('×');
        return h_flex()
            .gap(8)
            .flex_wrap()
            .items_center()
            .when(waiting.length > 0, (el) => el.pb(8))
            .children(
                waiting.map(({ path, preview }, i) =>
                    isImagePath(path)
                        ? div()
                              .id(`chat-thumb-${i}`)
                              .size(THUMB_SIZE)
                              .flex_none()
                              .relative()
                              .rounded(8)
                              .overflow_hidden()
                              .bg(t.raised)
                              .border(1)
                              .border_color(t.border)
                              .cursor_pointer()
                              .tooltip('Open')
                              .on_click((_e, cx) => {
                                  const pictures = waiting
                                      .map((w) => w.path)
                                      .filter(isImagePath);
                                  this.pictures.show(
                                      pictures,
                                      pictures.indexOf(path),
                                      cx,
                                  );
                              })
                              .when(Boolean(preview), (el) =>
                                  el.child(image(preview ?? '').size_full()),
                              )
                              .child(remove(`chat-thumb-x-${i}`, path))
                        : h_flex()
                              .id(`chat-file-${i}`)
                              .relative()
                              .gap(6)
                              .items_center()
                              .pl(8)
                              .pr(26)
                              .py(4)
                              .rounded(8)
                              .border(1)
                              .border_color(t.border)
                              .text_size(12)
                              .text_color(t.muted)
                              .tooltip(path)
                              .child(`📎 ${fileName(path)}`)
                              .child(remove(`chat-file-x-${i}`, path)),
                ),
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
        let turnAt = 0;
        rows.forEach((r, i) => {
            if (r.kind === 'mine' && r.isTurnStart) turnAt = i;
        });
        this.currentTurn = new Set(
            rows.slice(Math.max(0, turnAt)).map((r) => r.id),
        );
        const booked = this.booked(rows);
        const sizes = this.heights.sizes(booked, (row) =>
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
            // a right-click names the row first; the list's own handler below then opens the menu where it was
            .on_item_secondary_click((key, event) => {
                const id = key.replace(/#(?:above|below)$/, '');
                this.messageMenu.hit(
                    event.position,
                    copyText(rows.find((r) => r.id === id)),
                );
            })
            // a file row opens its file in its app, a png in Preview (FRM-587)
            .on_item_click((key, cx) => {
                const id = key.replace(/#(?:above|below)$/, '');
                const pressed = rows.find((r) => r.id === id);
                if (pressed?.kind === 'tool') {
                    toolFolds.toggle(id);
                    cx.notify();
                    return;
                }
                // a folded reply opens whole where it is
                if (pressed && this.foldOf(pressed)) {
                    this.openReplies.add(id);
                    cx.notify();
                    return;
                }
                const opened = this.picturesAt(rows, key);
                if (opened)
                    return this.pictures.show(opened.files, opened.at, cx);
                const path = fileAt(rows, key);
                if (path) exec('open', openArgs(path)).catch(() => {});
            })
            .size_full();
        return div()
            .id('chat-list')
            .on_mouse_down('left', (_event, cx) => cx.stop_propagation())
            .on_mouse_down('right', (event, cx) => {
                const local = event.local_position ?? { x: 0, y: 0 };
                this.messageMenu.open(event.position, {
                    x: local.x / zoom,
                    y: local.y / zoom,
                });
                cx.notify();
            })
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
                if (this.messageMenu.state) {
                    this.messageMenu.close();
                    cx.notify();
                }
                const step = this.at.wheel(
                    (event.delta?.y ?? 0) / zoom,
                    this.shownRows,
                    this.sizes,
                    this.viewH,
                    Date.now(),
                );
                if (step.isIgnored) return;
                this.savePlaceSoon(cx);
                // within a screen of the first row: the next older page, one at a time
                if (!this.at.follow && this.at.top < this.viewH)
                    this.loadEarlier(cx);
                if (step.hadCut || step.isFollowChanged) cx.notify();
            })
            .child(list)
            .child(this.measurer(booked, t, `m${this.widthGen}-`))
            .when(Boolean(this.messageMenu.state), (el) =>
                el.child(this.messageMenuView(t)),
            )
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

    /** the right-click menu: «Copy message», dim when the press was on no message @param {Theme} t */
    messageMenuView(t) {
        const menu = this.messageMenu.state;
        const text = menu?.text ?? null;
        const place = menuPlace(
            { x: menu?.x ?? 0, y: menu?.y ?? 0 },
            { h: this.viewH, w: this.width || NARROW },
            MENU_SIZE,
        );
        /** @param {Context} cx */
        const close = (cx) => {
            this.messageMenu.close();
            cx.notify();
        };
        /** @param {string} id @param {string} label @param {(cx: Context) => void} act */
        const item = (id, label, act) =>
            h_flex()
                .id(`chat-message-menu-${id}`)
                .h(26)
                .px(8)
                .items_center()
                .rounded(5)
                .text_size(13)
                .text_color(text ? t.foreground : t.dim)
                .when(Boolean(text), (el) =>
                    el
                        .cursor_pointer()
                        .hover((s) => s.bg(t.hover))
                        .on_click((_event, cx) => {
                            close(cx);
                            act(cx);
                        }),
                )
                .child(label);
        return v_flex()
            .id('chat-message-menu')
            .absolute()
            .left(place.x)
            .top(place.y)
            .w(MENU_SIZE.w)
            .p(4)
            .rounded(8)
            .bg(t.popover)
            .border_1()
            .border_color(t.border)
            .shadow_md()
            .on_mouse_down_out((_event, cx) => close(cx))
            .child(
                item('copy', 'Copy message', (cx) => {
                    cx.write_to_clipboard(text ?? '');
                    this.flashNote(COPIED_NOTE, cx);
                }),
            );
    }

    /** a line under the quill that leaves on its own @param {string} note @param {Context} cx */
    flashNote(note, cx) {
        this.note = note;
        const shown = ++this.noteSerial;
        cx.timer.after(COPIED_NOTE_MS, (cx) => {
            if (this.note === note && this.noteSerial === shown)
                this.note = null;
            cx.notify();
        });
        cx.notify();
    }

    /**
     * rows drawn out of sight at the list's width, so each one's real height reaches the height book
     * @param {readonly (Row & { look?: string })[]} rows
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
                                .id(
                                    `${pre}${row.id}@${row.version}${row.look ?? ''}`,
                                )
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
                                .child(this.row(row, t, pre, false)),
                        ),
                    ),
            );
    }

    /**
     * @param {Row} row
     * @param {Theme} t
     * @param {string} pre what tells this copy's rich text from the measured copy's
     * @param {boolean} [isShown] the copy on screen: the hidden measured copy takes no part in a selection, or its
     *   words, laid over the shown ones, flicker into his selection as he scrolls (dima, 13:51)
     */
    row(row, t, pre, isShown = true) {
        if (row.kind === 'start')
            return h_flex()
                .w_full()
                .justify_center()
                .py(10)
                .text_xs()
                .text_color(t.muted)
                .child('Start of thread');
        const { hits, isOpen } = this.findBar.find.state;
        const base = row.id.replace(/#.*$/, '');
        const hit = !isOpen
            ? null
            : this.findBar.find.current() === row.id
              ? 'current'
              : hits.some((h) => h.id === row.id || h.id === base)
                ? 'match'
                : null;
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
                        .rounded(10)
                        .border(2)
                        .border_color(tint(t.background, '00'))
                        // find marks every row it matched, the one shown in his accent (dima, 17:34)
                        .when(hit === 'match', (e) =>
                            e.bg(tint(t.accent, '1f')),
                        )
                        .when(hit === 'current', (e) =>
                            e.bg(tint(t.accent, '38')).border_color(t.accent),
                        )
                        .child(el),
                );
        if (row.kind === 'file') return column(this.fileRow(row, t));
        if (row.kind === 'tool')
            return column(this.toolRow(row, t, pre, isShown));
        const most = Math.max(
            240,
            Math.floor(
                Math.min(this.width || NARROW, this.column()) * BUBBLE_SHARE,
            ),
        );
        const id = `${pre}${row.id}@${row.version}`;
        const fold = this.lookOf(row) === 'fold' ? this.foldOf(row) : null;
        if (row.kind === 'mine')
            return column(
                v_flex()
                    .w_full()
                    .items_end()
                    .gap(2)
                    .when(Boolean(row.text) || row.isWaiting, (el) =>
                        el.child(
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
                                    this.markedText(row, t, isShown) ??
                                        TextView.markdown(
                                            id,
                                            typedMarkdown(row.text),
                                        ).selectable(isShown),
                                ),
                        ),
                    )
                    .when(!row.pictures.length && !row.files.length, (el) =>
                        el.child(this.detailsLine(row, t)),
                    ),
            );
        return column(
            v_flex()
                .w_full()
                .items_start()
                .gap(2)
                .child(
                    v_flex()
                        .max_w(most)
                        .px(12)
                        .py(8)
                        .gap(8)
                        .rounded(12)
                        .bg(t.raised)
                        .when(Boolean(this.markedText(row, t, isShown)), (el) =>
                            el.child(this.markedText(row, t, isShown) ?? ''),
                        )
                        .children(
                            (this.markedText(row, t, isShown)
                                ? []
                                : (fold?.shown ??
                                  splitBlocks(unlinkFiles(row.text)))
                            ).map((block, i) =>
                                block.kind === 'text'
                                    ? TextView.markdown(
                                          `${id}-${i}`,
                                          block.text,
                                      ).selectable(isShown)
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
                                              ).selectable(isShown),
                                          ),
                            ),
                        )
                        // the line he clicks to open it: the list's item click does, herdr-app#894 keeps a press
                        // handler out of a row
                        .when(Boolean(fold), (el) =>
                            el.child(
                                div()
                                    .text_size(12)
                                    .text_color(t.accent)
                                    .cursor_pointer()
                                    .child(
                                        `▾ Show more · ${fold?.hidden ?? 0} more lines`,
                                    ),
                            ),
                        ),
                )
                .child(this.detailsLine(row, t)),
        );
    }

    /**
     * a run of tool calls, folded behind 🛠️; opened, each call is a row that opens alone to its input (PK-432,
     * FRM-638:W23); an open call's json card is a row of its own, so a selection's release in it never closes the call
     * (FRM-659:W4). no press handler in here: the list's item click opens and closes (herdr-app#894)
     * @param {Row} row @param {Theme} t @param {string} pre
     */
    toolRow(row, t, pre, isShown = true) {
        const isOpen = toolFolds.isOpen(row.id);
        const line = (/** @type {string} */ mark, /** @type {string} */ text) =>
            h_flex()
                .gap(6)
                .items_center()
                .text_size(12)
                .text_color(t.dim)
                .cursor_pointer()
                .child(div().flex_none().w(12).child(mark))
                .child(div().truncate().child(text));
        if (isCardRow(row.id))
            return div()
                .pl(36)
                .child(
                    div()
                        .px(10)
                        .py(6)
                        .rounded(6)
                        .bg(t.raised)
                        .border(1)
                        .border_color(t.border)
                        .text_size(12)
                        .child(
                            TextView.markdown(
                                `${pre}${row.id}@${row.version}`,
                                `\`\`\`json\n${row.calls?.[0]?.input ?? ''}\n\`\`\``,
                            ).selectable(isShown),
                        ),
                );
        if (!isCallRow(row.id))
            return line(isOpen ? '▾' : '▸', `${ICONS.tools} ${row.text}`);
        return div()
            .pl(18)
            .child(line(isOpen ? '▾' : '▸', row.text));
    }

    /**
     * the pictures and files a message carries: a square per picture, a chip per file; his on the right, a reply's on
     * the left. no press or hover handler, one inside a list row blanks the whole list (herdr-app#894)
     * @param {Row} row @param {Theme} t
     */
    sentFiles(row, t) {
        return h_flex()
            .gap(6)
            .flex_wrap()
            .when(isSentRow(row.id), (el) => el.justify_end())
            .max_w(this.column())
            .children(
                row.pictures.map((picture) => {
                    const rel = this.sent.relOf(picture);
                    return div()
                        .size(SENT_THUMB)
                        .flex_none()
                        .flex()
                        .items_center()
                        .justify_center()
                        .rounded(8)
                        .overflow_hidden()
                        .bg(t.raised)
                        .border(1)
                        .border_color(t.border)
                        .text_color(t.dim)
                        .child(rel ? image(rel).size_full() : ICONS.picture);
                }),
            )
            .children(
                row.files.map((path) =>
                    div()
                        .px(8)
                        .py(3)
                        .rounded(6)
                        .border(1)
                        .border_color(t.border)
                        .text_size(12)
                        .text_color(t.muted)
                        .child(`📎 ${fileName(path)}`),
                ),
            );
    }

    /**
     * the dim line under a bubble, one state and its own time (FRM-594): always drawn, a tooltip in a list row never
     * showed for him (herdr-app#598)
     * @param {Row} row @param {Theme} t
     */
    detailsLine(row, t) {
        const details = messageDetails(row, Date.now());
        return div()
            .px(4)
            .text_size(12)
            .text_color(t.muted)
            .when(details !== null, (el) => el.child(details ?? ''));
    }

    /**
     * a file a reply names, its own row under the reply (FRM-587): the list's item click opens it. no press or hover
     * handler in here, one inside a list row blanks the whole list (herdr-app#894)
     * @param {Row} row @param {Theme} t
     */
    fileRow(row, t) {
        if (isSentRow(row.id))
            return v_flex()
                .w_full()
                .items_end()
                .gap(2)
                .child(this.sentFiles(row, t).cursor_pointer())
                .child(this.detailsLine(row, t));
        if (row.pictures.length) return this.sentFiles(row, t).cursor_pointer();
        return h_flex()
            .gap(6)
            .items_center()
            .self_start()
            .px(8)
            .py(3)
            .rounded(6)
            .border(1)
            .border_color(t.border)
            .cursor_pointer()
            .text_size(12)
            .text_color(t.muted)
            .child(ICONS.file)
            .child(div().truncate().child(row.text));
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
        this.messageMenu.close();
        this.openReplies.clear();
        this.heights.clear();
        fileRows.clear();
        toolFolds.clear();
        this.slashMenu.clear();
        this.skills = new Map();
        this.pluginSkills = new Map();
        this.reader = null;
        this.pages?.close();
        this.pages = null;
        this.file = null;
        this.address = null;
        this.note = null;
        // the viewer and find belong to the thread they opened on
        this.pictures.close();
        this.findBar.reset();
        this.joins = null;
        // no button shows or presses a thread no longer on screen; the fleet's facts stay
        this.band.clear();
        this.pickers.clear();
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
            const cwd = session && JSON.parse(session)?.cwd;
            if (typeof cwd === 'string')
                loadableSkills(SKILL_FS, { cwd, home: home() })
                    .then((found) => {
                        if (this.file !== file) return;
                        this.pluginSkills = found;
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
            fileRows.clear();
            // nothing of the old rows may steer the new ones: a held place, a landing under way, the rows drawn
            this.at.reset();
        }
        const hadError = this.error !== null;
        this.error = null;
        this.pickers.takeLines(lines, cx);
        const { changed, removed } = this.model.add(lines);
        this.learnSkills(lines);
        this.makePictures(cx);
        // his marked words showing as his message settle the mark in this same draw: they leave the quill as they land
        const added = new Set(changed);
        const arrived = this.model.rows
            .filter((r) => added.has(r.id) && r.kind === 'mine' && !r.isWaiting)
            .map((r) => ({ at: r.at, text: r.text }));
        if (arrived.length && this.file)
            this.showSettled(this.magic.arrived(this.file, arrived), cx);
        if (changed.length || removed || isRestart || hadError) cx.notify();
    }

    /** his settings rows as the chat uses them @param {Record<string, unknown>} values */
    applySettings(values) {
        this.timing = {
            delay: Number(values['chatter.send.holdDelay']),
            push: Number(values['chatter.send.holdPush']),
        };
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
            this.joins = state?.joins ?? null;
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
            this.settle(cx);
            await watch;
        }
    }

    /** the mark of the shown thread against its state: taken by a turn, or by none in a minute @param {Context} cx */
    settle(cx) {
        const { file } = this;
        if (!file) return;
        this.showSettled(this.magic.settle(file, this.joins), cx);
    }

    /**
     * a settled mark on screen: the quill already keeps only what he typed after the taken words; the taken mark
     * shows for a moment
     * @param {import('./magic.js').Settled | null} settled
     * @param {Context} cx
     */
    showSettled(settled, cx) {
        const { file } = this;
        if (!settled || !file) return;
        this.note = settled.note;
        // the files its row carried went with the words
        for (const path of settled.files ?? [])
            this.attachments.remove(file, path);
        // the taken mark shows for a moment, then the button rests
        if (!settled.note)
            cx.timer.after(JOINED_SHOWN_MS, (later) => {
                this.magic.forget(file, settled.id);
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
        if (!file) return;
        const files = this.waitingPaths(file);
        if (!text && !files.length) return;
        if (!this.address) return this.say(NOT_IN_HERDR, cx);
        const answer = this.magic.click(
            file,
            sidOf(file),
            text,
            this.joins,
            files,
        );
        cx.notify();
        cx.spawn(async (cx) => {
            const { act, note } = await answer;
            if (this.file !== file) return;
            if (act === 'push') return this.send(text, note, cx);
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
     * @param {string | null} [note] why it went as a push
     */
    push(box, cx, note = null) {
        const { file } = this;
        const text = box.value().trim();
        if (!file || (!text && !this.attachments.of(file).length)) return;
        if (!this.address) return this.say(NOT_IN_HERDR, cx);
        cx.spawn(async (cx) => {
            // checked right before the mark comes off, so a refused push keeps his words marked
            const blocked =
                this.address && sendBlocked(this.address, typingInto);
            if (blocked) return this.say(blocked, cx);
            const why = await this.magic.release(file, this.joins);
            if (this.file !== file) return;
            if (why) return this.say(why, cx);
            // the words go as the quill holds them once the row is out: an edit he made meanwhile is what he sends,
            // and the quill empties, never keeping words that already went
            this.send(box.value().trim() || text, note, cx);
        });
    }

    /**
     * the words leave the quill for the thread shown, as its Claude's next prompt, or wait in its queue while it
     * works. a message that did not go comes back to the quill
     * @param {string} text
     * @param {string | null} note why it went this way
     * @param {Context} cx
     */
    send(text, note, cx) {
        const { address, file } = this;
        if (!address) return;
        const blocked = sendBlocked(address, typingInto);
        if (blocked) return this.say(blocked, cx);
        // what he typed while a mark was taken back stays: only the words sent leave
        this.quills.apply(file, { said: text, type: 'sent' });
        // the files waiting go after the words, each path on its line as a terminal drop types it (FRM-613)
        const files = file ? this.attachments.take(file) : [];
        const message = withPaths(text, files);
        // Claude Code queues a slash command with no text: the model takes its words from here to draw it waiting
        if (message.startsWith('/')) this.model.pushed(message, Date.now());
        this.say(note, cx);
        cx.spawn(async (cx) => {
            const sent = await hc(sendArgs(address, message)).catch(
                (/** @type {unknown} */ error) => ({
                    code: 1,
                    stderr: String(error),
                }),
            );
            if (sent.code === 0) return;
            // his words come back before what he typed since, and his files with them, never lost, on screen or not
            this.quills.apply(file, { said: text, type: 'returned' });
            if (file && files.length) this.attachments.add(file, files);
            if (this.file !== file) return;
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

    /** his messages' pictures get their files; each row draws its own once made @param {Context} cx */
    makePictures(cx) {
        const pictures = shownOf(this.model.rows, this.look).flatMap((r) =>
            r.kind === 'file' ? r.pictures : [],
        );
        if (!pictures.some((p) => !this.sent.relOf(p))) return;
        cx.spawn(async (cx) => {
            if (await this.sent.make(pictures)) cx.notify();
        });
    }

    /**
     * a click on a message's or a reply's pictures: the pictures it opens, whole, the first shown; ← → reach the rest
     * @param {readonly Row[]} rows @param {string} key @returns {{ files: string[], at: number } | null}
     */
    picturesAt(rows, key) {
        const row = rows.find(
            (r) => r.id === key.replace(/#(?:above|below)$/, ''),
        );
        // his words select on a click; only the squares' own row opens the viewer
        if (row?.kind !== 'file') return null;
        const files = row.pictures.flatMap((p) => this.sent.pathOf(p) ?? []);
        return files.length ? { at: 0, files } : null;
    }

    /** the thread's skill listing, wherever its line is read: the tail or an earlier page @param {string[]} lines */
    learnSkills(lines) {
        for (const line of lines)
            if (line.includes('"skill_listing"'))
                try {
                    const content = JSON.parse(line)?.attachment?.content;
                    for (const [name, about] of listedSkills(content))
                        this.skills.set(name, about);
                } catch {
                    // half a line never reaches here: the reader hands over whole lines
                }
    }

    /**
     * how a row draws when not plain: find's word marks over the stepped row only, keyed by the query; every other
     * match keeps its markdown under a tint, since a marked row loses its bold and reflows (dima's o2, 18:46)
     * @param {Row} row
     */
    lookOf(row) {
        const { isOpen, q } = this.findBar.find.state;
        if (isOpen && this.findBar.find.current() === row.id)
            return `find:${q}`;
        return this.foldOf(row) ? 'fold' : undefined;
    }

    /**
     * how a reply folds now: only a long one of an earlier turn, while his switch is on and he has not opened it; a
     * search hit shows whole
     * @param {Row} row
     */
    foldOf(row) {
        if (row.kind !== 'reply' || this.openReplies.has(row.id)) return null;
        const { isOpen } = this.findBar.find.state;
        if (isOpen && this.findBar.find.state.hits.some((h) => h.id === row.id))
            return null;
        const width =
            Math.min(this.width || NARROW, this.column()) * BUBBLE_SHARE;
        return replyFold(
            splitBlocks(unlinkFiles(row.text)),
            Math.floor(Math.max(240, width) / CHAR_PX),
            {
                isEarlierTurn: !this.currentTurn.has(row.id),
                isShowMoreOn: this.isShowMore,
            },
        );
    }

    /** the rows as the height book keys them: a row drawn another way is measured apart @param {readonly Row[]} rows */
    booked(rows) {
        return rows.map((row) => {
            const look = this.lookOf(row);
            return look ? { ...row, look } : row;
        });
    }

    /**
     * the stepped row as plain words, every match in a soft accent, the stepped one in full accent; null for any
     * other row, or while its marked height is not measured yet
     * @param {Row} row @param {Theme} t
     */
    markedText(row, t, isShown = true) {
        const look = this.lookOf(row);
        // the shown copy waits for its marked height, so the list never draws it at the plain one and jumps
        if (
            !look?.startsWith('find:') ||
            (isShown && !this.heights.has({ ...row, look }))
        )
            return null;
        const { q } = this.findBar.find.state;
        const current = this.findBar.find.currentHit();
        return v_flex().children(
            findSpans(row.text, q).map((line) =>
                h_flex()
                    .flex_wrap()
                    .children(
                        line.flatMap((span) =>
                            span.match === null
                                ? span.text
                                      .split(/(?<=\s)/)
                                      .map((word) => div().child(word))
                                : [
                                      div()
                                          .rounded(3)
                                          .px(1)
                                          .bg(
                                              current?.id === row.id &&
                                                  current.n === span.match
                                                  ? t.accent
                                                  : tint(t.accent, '4d'),
                                          )
                                          .when(
                                              current?.id === row.id &&
                                                  current.n === span.match,
                                              (el) =>
                                                  el.text_color(t.background),
                                          )
                                          .child(span.text),
                                  ],
                        ),
                    ),
            ),
        );
    }

    /** what the / menu shows now: the caret is read off the box, so a caret moved off the word closes it */
    slashShown() {
        if (this.box)
            this.slashMenu.at(this.box.value(), this.box.selected_range().end);
        return this.slashMenu.shown(menuNames(this.skills, this.pluginSkills));
    }

    /** a / menu key: ↑ ↓ move, Tab or Enter fills the pick, Esc closes @param {'up' | 'down' | 'fill' | 'close'} key @param {Context} cx */
    slashKey(key, cx) {
        const { at, list } = this.slashShown();
        if (key !== 'fill') this.slashMenu.step(key, list.length);
        else this.slashFill(list[at]?.[0], cx);
        cx.notify();
    }

    /** @param {string | undefined} name @param {Context} cx */
    slashFill(name, cx) {
        const filled = name ? this.slashMenu.fill(name) : null;
        if (!filled || !this.box) return;
        // the quill writes the box, then the caret goes past the name; words under a 🍕 mark ride its row too
        this.quills.apply(this.file, { text: filled.text, type: 'typed' });
        this.box.set_selected_range({ end: filled.caret, start: filled.caret });
        this.typedUnderMark(this.box, cx);
        this.box.focus();
        cx.notify();
    }

    /** the / menu over the quill: a name and what it does per match, the pick marked (slice 6) @param {Theme} t */
    slashList(t) {
        const { at, list } = this.slashShown();
        return v_flex()
            .when(list.length > 0, (el) => el.pb(8))
            .children(
                list.map(([name, about], i) =>
                    h_flex()
                        .id(`chat-slash-${name}`)
                        .gap(10)
                        .px(8)
                        .py(4)
                        .rounded(6)
                        .items_center()
                        .cursor_pointer()
                        .when(i === at, (el) => el.bg(t.raised))
                        .hover((style) => style.bg(t.border))
                        .on_click((_e, cx) => this.slashFill(name, cx))
                        .child(
                            div()
                                .w(180)
                                .flex_none()
                                .truncate()
                                .text_color(t.foreground)
                                .child(`/${name}`),
                        )
                        .child(
                            div()
                                .flex_1()
                                .min_w(0)
                                .truncate()
                                .text_size(12)
                                .text_color(t.dim)
                                .child(about),
                        ),
                ),
            );
    }

    /** @param {string} file @returns {string[]} */
    waitingPaths(file) {
        return this.attachments.of(file).map((w) => w.path);
    }

    /**
     * a file came or went under a mark: its join row carries the files waiting now, or the mark comes off when nothing
     * is left to send
     * @param {string} file @param {Context} cx
     */
    filesUnderMark(file, cx) {
        const mark = this.magic.markOf(file);
        if (mark?.state !== 'pending') return;
        cx.spawn(async (cx) => {
            const isChanged = await this.magic.typed(
                file,
                this.box?.value().trim() ?? mark.said,
                this.joins,
                this.waitingPaths(file),
            );
            if (isChanged) cx.notify();
        });
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
        const text = box.value().trim();
        if (!retextWait(text)) {
            // the mark drops before the take-back's write, so 🍕 goes in this draw
            cx.spawn(async (cx) => {
                const isChanged = await this.magic.typed(
                    file,
                    '',
                    this.joins,
                    this.waitingPaths(file),
                );
                if (isChanged) cx.notify();
            });
            cx.notify();
            return;
        }
        cx.timer.after(retextWait(text), (later) => {
            if (this.lastKeyAt !== at || this.file !== file) return;
            later.spawn(async (cx) => {
                const isChanged = await this.magic.typed(
                    file,
                    box.value().trim(),
                    this.joins,
                    this.waitingPaths(file),
                );
                if (isChanged) cx.notify();
            });
        });
    }

    /**
     * a press on send starts the hold: a release before its delay is a click, a hold to its end pushes
     * @param {import('gpui-base').TextareaState} box
     * @param {Context} cx
     * @param {import('./joins.js').Hold['by']} [by]
     */
    press(box, cx, by = 'pointer') {
        // an empty quill has nothing to send: no hold, no disc
        if (
            !this.file ||
            (!box.value().trim() && !this.waitingPaths(this.file).length)
        )
            return;
        this.cancelHold();
        this.hold = holdSend(null, 'press', Date.now(), this.timing, by).hold;
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

    /** the quill holds the shown thread's draft, the caret after it; no thread, an empty quill */
    showDraft() {
        if (!this.box) return;
        const text = this.quills.show(this.file, this.box);
        this.box.set_selected_range({ end: text.length, start: text.length });
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
            this.learnSkills(lines);
        }
        this.makePictures(cx);
        // the saved line may sit inside a folded row: the place is that row
        const at = this.model.indexOf(lineId);
        const row = this.model.rows[at];
        this.trace(
            `restore at=${at} kind=${row?.kind} tools=${this.look.tools}`,
        );
        if (!row) return;
        // a row he hides now (a tool call) hands the place to the next one shown
        const shown = shownOf(this.model.rows, this.look);
        const fileRow = shown.find((r) => r.id === place.id && r !== row);
        if (fileRow) {
            this.at.restore(fileRow.id, place.offset);
            this.settleUntil = Date.now() + SETTLE_MS;
            cx.notify();
            return;
        }
        const next = shown.includes(row)
            ? row
            : this.model.rows.slice(at + 1).find((r) => shown.includes(r));
        this.trace(`restore next=${next?.id.slice(0, 8)}`);
        if (!next) return;
        this.at.restore(
            next.id,
            next === row && lineId === place.id ? place.offset : 0,
        );
        this.settleUntil = Date.now() + SETTLE_MS;
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
            this.readPlace();
            const place = this.at.place;
            const height =
                this.sizes[this.shownRows.findIndex((r) => r.id === place?.id)];
            const firstId = this.model.rows[0]?.id ?? '';
            this.model.addEarlier(lines);
            // the page's last reply may join the first row: it keeps its lines and takes the page's id
            const first = this.model.rows[this.model.indexOf(firstId)];
            this.learnSkills(lines);
            this.makePictures(cx);
            // the page's last reply joined the row he reads: that row took the page's id and grew above him
            const joined = place
                ? this.model.rows[this.model.indexOf(place.id)]
                : undefined;
            if (place && joined && joined.id !== place.id && height)
                this.at.restore(joined.id, 0, height - place.offset);
            else if (place) this.at.restore(place.id, place.offset);
            if (this.findBar.find.state.isOpen)
                this.findBar.find.recount(
                    shownOf(this.model.rows, this.look),
                    first && first.id !== firstId
                        ? { from: firstId, to: first.id }
                        : null,
                );
            cx.notify();
        });
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
