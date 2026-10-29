/* @jsx h */
import type { EngineInterface, Register, RenderElement } from 'claude-code';

import type {
    LaneItem,
    OrbitAsk,
    OrbitAssumption,
    PublishedAsk,
    QuietGap,
    QuietLogLine,
    QuietPing,
    RemoteMark,
    StashCap,
    StashDigest,
    StashEnhancer,
    StashEntry,
    StashLane,
    StashMember,
    StashMeter,
    StashOrbit,
    StashPlan,
    StashQuiet,
    StashTick,
    StashView,
    StashWind,
} from '../types/stash.d.ts';
import {
    ASSUMED_MAX,
    CHANGED_MARK,
    ORBIT_TEXT_MAX,
    ORBIT_TOOL,
    PLAN_MAX,
    SEND_MS,
    hasPlanMark,
    isDue,
    isFresh,
    isSending,
    joinText,
    linkLabel,
    lockJoined,
    moved,
    oneLine,
    orbitOp,
    planTaken,
    planText,
    steered,
    steeredOrbit,
    turnEnded,
    wrongText,
} from './orbit.ts';
import {
    type BackgroundTask,
    LEDGER_SENDS,
    backgroundWait,
    backgroundWaits,
    boldFleetWords,
    bulletDots,
    dropWaitAside,
    isFleetName,
    linkTickets,
    noticeOf,
    numberCircled,
    parseWait,
    planSteps,
    ticketOf,
    unbold,
    waitSpans,
} from './parse.ts';
import { cleanTree, drawn } from './tree.ts';

// x-mod-stash: dima's command center above the prompt, one row; FTR.md lists every feature.
// orbit: the session's asks to dima and its plan, written through its own tool, ticked in the board; its open asks are
// mirrored into $.store (one key per session), so the board counts every session's.
// afk: one switch every session polls; while it is on, every prompt carries an away note, and a flip reaches a running turn.
// keep-hot: while on and idle, one ping 50 min after the last turn ended keeps the prompt cache warm; the switch lives in $.store, so a reload keeps it

// label: the repo; name: the session's registry name, when it has one
type Entry = StashEntry;
// where an ask card's tick, replay and steer go, and the prefix its keys carry
type AskDoor = {
    prefix: string;
    mark: (a: OrbitAsk, mark: 'accepted' | 'rejected') => void;
    steer: (a: OrbitAsk, value: string) => void;
};
// a session's last reply: when it ended, its 🔭 wait; `ended` once the session itself exited
// waits: every background task's own name when the reply set no 🔭, so the board can list them all
type Reply = {
    at: number;
    // a keep-hot ping's reply end: it warms the cache without being a reply dima reads
    pingedAt?: number;
    name?: string;
    wait?: string;
    waits?: string[];
    // the background tasks the wait came from, so an end notice can settle one
    tasks?: BackgroundTask[];
    ended?: number;
};

const PREFIX = 'asks:';
// what the board draws from this session's $.state, kept per conversation in the store, so a session resumed in a new
// process — a mac reboot relaunches every one — draws it again: $.state starts empty there (dima's ✨ wisps, 10-13 16:26
// orbit and the sessions rows, 16:44 phases); kept past an exit, dropped after a week unused
const KEPT = 'kept:';
const KEPT_MS = 7 * 24 * 60 * 60 * 1000;
// `succ:<old id>` → the id a /clear continued under, so a lane linked by a session id follows it (todo 21: a clear left
// the l14 card on the codie's old id, its asks gone from the card); dropped a week after it was written
const SUCC = 'succ:';
// a glide card's mark on a member's ask, waiting for the member's own stash (FRM-385 exit 3); and when dima last prompted anywhere
const MARKS = 'marks:';
// 🛼 a member's lane step from its plan op, one key per registry name, written only by that session (todo 6)
const LANE_STEP = 'lane-step:';
// the moves clio's stash made from codie's step, held for her next tool call or prompt
const LANE_MOVES = 'lane-moves';
const DIMA_AT = 'dima-at';
const AFK_KEY = 'afk';
const AWAY_NOTE =
    'dima is afk: nothing waits on him. take reversible steps and log them, park every ask in orbit for his return, send no ping.';
const BACK_NOTE = 'dima is back from afk: orbit and pings reach him again.';
const POLL_MS = 4000;
// the fleet board: cc's registry gives each session's state; each session's stash adds its 🔭 wait and context fill
const BOARD = 'fleet-board';
// 🎛️ is a pane of its own, which the surface tabs beside 🚦: the band is capped by cc, the list outgrew it (dima's pick a of
// four homes, 16:20); a tab row inside a pane was proven too, kept as an idea in api-map.md
const SETTINGS_PANE = 'stash-settings';
const REPLY = 'reply:';
const CONTEXT = 'context:';
// the model and effort of a session's main loop, as its last model request named them
const MODEL = 'model:';
// the board's colour MVP: one fleet-wide switch, `/board colour`, off by default (FRM-329)
const COLOUR = 'board-colour';
// the row's ctx meter as a ring (C) or the % with a thin bar under it (B): dima keeps both, a 🎛️ switch picks (10-13 17:00)
const CTX_RING_KEY = 'ctx-ring';
// `/board breathe`: the bars breathe idle too, while dima refines the look (2026-10-11 12:20); off by default, a try
const BREATH_PREVIEW = 'breath-preview';
// the 🎛️ knobs (FRM-391 slice 06), fleet-wide in stash's store like the switches: a missing key is the default
const BREATHE = 'breathe';
const BREATH_SPEED = 'breath-speed';
const PHASE_LINES = 'phase-lines';
const SPEAK_ASSUMED = 'speak-assumed';
// x-mod-guard reads this key from stash's store file: true drops its rewrite, hint and delegate notes, never a refusal
const GUARD_SILENT = 'guard-silent';
// quiet comms on or off, one switch for 🎛️ and `/quiet` alike; on by default, `off` is the revert (dima, 16:53)
const QUIET_ON = 'quiet-comms';
// a tick, a replay or a phases change waits SEND_MS in «sending», undoable; off, it is ready for the next turn at once
// (dima, 10-13 17:49)
const UNDO_WINDOW = 'undo-window';
const SPEED = { max: 5, min: 0.1, of: 0.5 } as const;
const LINES = { max: 7, min: 5 } as const;
// how long held member pings wait before the hidden idle append, in minutes (dima, 16:53: 10 by default, maybe 15)
const QUIET_WAIT = 'quiet-wait';
// the undo window's length in seconds, set beside its switch (dima, 10-13 18:01)
const UNDO_DELAY = 'undo-delay';
const WAIT = { max: 60, min: 1 } as const;
// every 🎛️ knob in one table: its store key and its default; a number knob its range too. a missing or broken value reads
// as the default, and every read and write goes through readSwitch, readNumber, flipKnob and setKnobNumber
const SWITCHES = {
    always: { key: BREATH_PREVIEW, of: false },
    breathe: { key: BREATHE, of: true },
    colour: { key: COLOUR, of: false },
    quiet: { key: QUIET_ON, of: true },
    ring: { key: CTX_RING_KEY, of: true },
    silent: { key: GUARD_SILENT, of: false },
    speak: { key: SPEAK_ASSUMED, of: true },
    undo: { key: UNDO_WINDOW, of: true },
} as const;
const NUMBERS = {
    lines: { key: PHASE_LINES, of: PLAN_MAX, range: LINES },
    quietWait: { key: QUIET_WAIT, of: 10, range: WAIT },
    speed: { key: BREATH_SPEED, of: SPEED.of, range: SPEED },
    undoDelay: {
        key: UNDO_DELAY,
        of: SEND_MS / 1000,
        range: { max: 30, min: 1 },
    },
} as const;
type SwitchName = keyof typeof SWITCHES;
type NumberName = keyof typeof NUMBERS;
// the 🎛️ settings (FRM-391 slice 05): one show/hide switch per part, in the store every session reads and the poll
// re-reads, so a flip reaches every band within one poll; a missing key is shown
const SHOWN = 'shown';
// the parts dima approved (o2, 2026-10-11 13:15), grouped by where they draw; a mod's own parts, so a new one joins here
export const PARTS = [
    {
        group: 'stash · band',
        key: 'stash.chips',
        label: '🪐 🌔 asks and phases chips',
    },
    { group: 'stash · band', key: 'stash.pace', label: '🔋 🪫 pace gap' },
    {
        group: 'stash · band',
        key: 'stash.reset',
        label: '⏳ time to the 5h reset',
    },
    { group: 'stash · band', key: 'stash.wait', label: '🔭 wait line' },
    {
        group: 'stash · band',
        key: 'stash.enhancer',
        label: '🪄 ⏪ ⏩ enhancer',
    },
    { group: 'stash · band', key: 'stash.hot', label: '🔥 keep-hot' },
    { group: 'stash · band', key: 'stash.waker', label: '⏰ waker' },
    { group: 'stash · band', key: 'stash.afk', label: '💨 afk' },
    { group: 'stash · band', key: 'stash.board', label: '🚦 board button' },
    { group: 'stash · band', key: 'stash.5h', label: '🔥 5h bar (desktop)' },
    { group: 'stash · band', key: 'stash.ctx', label: '🧠 ctx bar (desktop)' },
    {
        group: 'stash · band',
        key: 'stash.digest',
        label: 'while you were away',
    },
    { group: 'stash · board', key: 'stash.orbit', label: '🪐 orbit asks' },
    { group: 'stash · board', key: 'stash.assumed', label: 'assumed section' },
    { group: 'stash · board', key: 'stash.phases', label: '🌔 phases' },
    { group: 'stash · board', key: 'stash.glide', label: '🛼 glide' },
    {
        group: 'stash · board',
        key: 'stash.speak',
        label: '🔊 ⏯️ ⏹️ speak buttons',
    },
    {
        group: 'stash · board',
        key: 'stash.rowmeta',
        label: 'session rows: model, effort and wait',
    },
    {
        group: 'stash · board',
        key: 'stash.boot',
        label: '🥾 boot keeps going after a spawn',
    },
    {
        group: 'stash · board',
        key: 'stash.second-wind',
        label: '🐦‍🔥 second wind',
    },
    {
        group: 'stash · replies',
        key: 'stash.bullets',
        label: '·-lists drawn as bullets',
    },
    {
        group: 'stash · replies',
        key: 'stash.boldwords',
        label: 'fleet words bold with their badge',
    },
    {
        group: 'stash · replies',
        key: 'stash.circled',
        label: '①②③ drawn as numbered lines',
    },
    {
        group: 'stash · replies',
        key: 'stash.tickets',
        label: 'bare ticket ids drawn as links',
    },
    {
        group: 'stash · replies',
        key: 'stash.waitaside',
        label: "a 🔭 line's (aside) dropped",
    },
    {
        group: 'stash · replies',
        key: 'stash.cost',
        label: '💵 cost questions read model-cards.md',
    },
] as const;
type PartKey = (typeof PARTS)[number]['key'];
type IsPartOn = (key: PartKey) => boolean;
// the registry names a short-lived headless run `t-` + hex (`t-70`); the board leaves those out (dima, 2026-10-05)
const HEADLESS = /^t-[0-9a-f]+$/;
// a session younger than this, counted from the registry's `startedAt`, is a probe: it gets no row until it outlives it
const SHORT_MS = 60_000;
const STALE_MS = 24 * 60 * 60 * 1000;
// dima at the prompt, typing into a background job, on his phone or the web
const DIMA_ORIGINS = ['composer', 'sdk', 'bridge'] as const;
const HOT_MS = 50 * 60 * 1000;
const HOT = 'hot:';
// a reload keeps `$.state` and resets the module: what must outlive a mod save lives there (FRM-320)
// what the band and the board draw: renders read it, and a write redraws them, no invalidate
const VIEW = { key: 'view', plugin: 'x-mod-stash' } as const;
// what only the board pane draws, its clock included: the band never reads it, so a tick never redraws the band
const BOARD_VIEW = { key: 'board', plugin: 'x-mod-stash' } as const;
// the running turn, so a mid-turn reload still knows it is busy
const TURN = { key: 'turn', plugin: 'x-mod-stash' } as const;
// when the last main turn ended: 🔥 switched on while idle counts its 50 min from here, so the ping lands inside the cache's hour
const ENDED = { key: 'ended', plugin: 'x-mod-stash' } as const;
// a 📄 line's HH:MM — the same shape reply-check.py reads
const STAMP = /(📄[^\n]*?\b)(\d{1,2}:\d{2})\b/g;
const PING =
    'x-mod-stash keep-hot ping: answer with one character, nothing else.';
// the waker: one global switch, off by default; when on, a session stopped on the 5h cap gets one resume at the reset
const WAKER_KEY = 'waker';
const CAP = { key: 'cap', plugin: 'x-mod-stash' } as const;
// the band's meters, written on every session.measure
const METER = { key: 'meter', plugin: 'x-mod-stash' } as const;
// the 5h cap ends the turn as an API error with this text; the weekly cap and spent credits read otherwise
// (8 rows in the transcripts, 2026-10-08)
const CAPPED = /hit your session limit/i;
const RESUME =
    'x-mod-stash waker: the 5h window reset. pick up where you stopped.';
// a few seconds past the reset, so the window has turned before the resume goes out
const WAKE_SLACK_MS = 5000;
// the board's one palette, every card's colours read from it (dima's o107, 21:17): mid-tones at 3.2:1 or more on a light
// pane and 4.2:1 on a dark one; `dim` is the theme's own gray; `calm` is the ctx meter's blue
export const PALETTE = {
    accent: '#d97757',
    calm: '#4f83e0',
    dim: 'inactive',
    // each member's dot, by name: six mid-tones at 3.6:1 or more on white and 4.2:1 on the dark pane, none a state tint
    // and no coral near the asks' orange; the 1st and 4th nudged off `calm` and `ok` (l13, `pnpm design:contrast`)
    dots: ['#6b7bdc', '#2f8f8a', '#a87f12', '#3c9472', '#9a74c9', '#c4689f'],
    hot: '#e5484d',
    ok: '#47915a',
    warn: '#d9661a',
} as const;
const ACCENT = PALETTE.accent;
// 🪐 orbit: the session's asks to dima, ticked in the board instead of pasted back; the session writes them through
// its own tool, never a reply block
const ORBIT = { key: 'orbit', plugin: 'x-mod-stash' } as const;
// the phases guard, no extra turn and no Stop block: one line at the first prompt, one nudge in a turn's tool results (dima's o14)
const PHASES_START = `phases are your live plan: set them with ${ORBIT_TOOL}'s plan op and keep them current as the work moves.`;
const NUDGE_AT = 3;
// a plan set in either of the last 2 turns still holds: a turn that did not move it gets no nudge (clio's brief 8)
const PLAN_QUIET_TURNS = 2;
// mobile mode: mods draw nothing on the phone, so the session prints the open asks as the asks fence instead
const MOBILE = { key: 'mobile', plugin: 'x-mod-stash' } as const;
// a board card folded to its head row, per session (dima's o5, 17:16)
const FOLDS = { key: 'folds', plugin: 'x-mod-stash' } as const;
// 🛼 glide (FRM-385): the fleet's lanes in one shelf file, written only by the session the registry names 🦉 clio, read by
// every board on its poll; at most 5 plain steps, each ≤60 chars, stale after 8 of clio's turns with nothing moved
const LANES = { key: 'lanes', plugin: 'x-mod-stash' } as const;
const LANE_ASKS = { key: 'laneAsks', plugin: 'x-mod-stash' } as const;
// dima's steer on a lane's current step and its 🛎️ tick, one store key per lane: any board writes it, so the shelf file
// keeps its one writer, clio's lane op
const LANE_STEER = 'lane-steer:';
// the retired glide reorder's store key (o84, dropped by o138): clio's stash deletes any left behind
const LANE_ORDER = 'lane-order:';
// a lane steer typed before the rename sits under the old prefix: read as a steer, retired at its next write
const LANE_STEER_OLD = 'lane-note:';
const LANE_OWNER = '🦉 clio';
const LANE_ROLES = ['codie', 'sixth-sense'] as const;
// read-both: lanes linked before the 10-29 rename keep the old role keys; both words resolve
const LANE_ROLE_OLD: Record<string, (typeof LANE_ROLES)[number]> = {
    coder: 'codie', // read-both
    verifier: 'sixth-sense', // read-both
};
const LANE_MAX = 7;
const LANE_TEXT_MAX = 60;
const LANE_STALE = 8;
const LANE_TICKET = /^[A-Z]{2,5}-\d+$/;
const MOBILE_SKILL = /(^|:)mobile-mode$/;
// clio's boot is open from the clio:boot skill's load until a reply as long as the board prints; start_session's own
// «then end your turn» hint ended the 10-29 boot early (FRM-426, exit 9). the keep is the store, so a reload still knows;
// a harness nudge answered «booting, board next» is short and never closes it, a silent turn has no reply at all
const BOOT = 'boot:';
const BOOT_SKILL = /^(?:clio:)?boot$/;
const BOARD_MIN = 300;
const BOOT_MS = 3 * 60 * 60 * 1000;
const START_SESSION_TOOL = 'mcp__ccd_session__start_session';
const BOOT_NOTE = 'the boot continues; the board ends the turn';
const MOBILE_OFF = /ARGUMENTS:\s*off\b/i;
const BACK_AT_MAC = /\bback at the mac\b|\bmobile mode off\b/i;
// the prompt enhancer: Haiku rewrites the box on a press; prev and new swap the two texts back with no call
const ENHANCER = { key: 'enhancer', plugin: 'x-mod-stash' } as const;
const ENHANCE_MODEL = 'claude-haiku-5-5';
const ENHANCE_MS = 30_000;
const WISPR_DB = 'Library/Application Support/Wispr Flow/flow.sqlite';
let isEnhancing = false;
const TICKET_ID_ALL = /(?<!\[)\b(?:FRM|BYT)-\d+\b(?!\])/g;
const STALE_TURNS = 3;
// a plan line's lead word, one short word before its colon
const PLAN_LEAD = /^[a-z]{2,10}:/i;
const PHASE_MOONS = ['🌕', '🌔', '🌓', '🌒', '🌑'];
// a quarter row between a block's lines: the desktop draws the fraction, the terminal rounds it away (dima, 21:22)
const LINE_GAP = 0.25;
// a closed ask's lead, read from its closing word: dropped 🗑️, started or queued ▶️, anything else done ✅ (dima, 20:37)
export const closedMark = (word: string) =>
    /^(drop|cut|cancel|superseded|declined)/i.test(word)
        ? '🗑️'
        : /^(start|queued|running|in progress)/i.test(word)
          ? '▶️'
          : '✅';
// the board's sections sit in cards, no colour (dima, 16:48 «colors are ugly»): the desktop a 30 % grey that reads the same on
// light and dark, a touch softer than `subtle` (16:54 too faint, 17:00 «too hard», 17:08 «slightly less»); the terminal `subtle`
const cardBorder = (surface: string) =>
    surface === 'desktop' ? '#8080804d' : 'subtle';
// a ticket id inside an ask or a phase; split keeps the id as every odd part
const TICKET_IDS = /\b((?:FRM|BYT)-\d+)\b/;
const ORBIT_ABOUT = [
    'orbit: your asks to dima on the fleet board; an ask goes here, never into a reply. 🛎️ tick = pick good to go, 🔁 replay = another round, plus his steer; marked asks reach you model-only. a --bg session has no board: its asks go to its coordinator.',
    `op add, asks [{ text, pick, hiddenNote, link }]: text one line ≤${ORBIT_TEXT_MAX} chars, subject first, readable alone (no «above», «this»); pick: your recommendation; hiddenNote: yours alone, its source and what a tick means; link: one https url, obsidian:// url or file path (spaces allowed) he opens in a click. irreversible (trash, push, close, merge) → lead with ⚠️, name the exact target.`,
    'op resolve, ids, words { id: closing word }: the asks answered this turn; they leave at its end, a worded one dim a turn more. ticked: «as ticked», or «changed: <what>» plus a follow or add.',
    'ops [{ op, … }]: several ops in one call, a result line each.',
    `op follow, id, text, pick: another round on an answered ask, same id and place, text ≤${ORBIT_TEXT_MAX} chars, marked ${CHANGED_MARK}.`,
    `op assume, texts: ≤${ASSUMED_MAX} a turn, ≤${ORBIT_TEXT_MAX} chars: unasked choices a wrong guess would cost a redo on, never routine; 🛎️ clears, ↩️ sends back with his steer.`,
    `op plan, lines: your next ${PLAN_MAX} moves, each ≤${ORBIT_TEXT_MAX} chars and readable alone; set at each turn end; untouched ${STALE_TURNS} turns reads stale. step: your lane step.`,
    `op glide (${LANE_OWNER} only): act create, title, items [{ text, ticket, done }] or plan (path to the lane-plan.md: its «- [ ] NN · text» lines are the steps, any count, a tick there moves the card, a hand step is refused): a lane's scope as 1–${LANE_MAX} plain steps ≤${LANE_TEXT_MAX} chars, no paths, op names or pr numbers; ticket optional; the result names the lane id. act link, id, session, role (codie or sixth-sense): a member's session id; a re-link of a role replaces the old one. act edit, id, title?, items?: the card refreshed in place, a kept step text keeps its done flag. act step, id, current: the step we are on, every step before it done; current = the count finishes it. act end, id: at the siesta or the halt after it finished. nothing moved for ${LANE_STALE} of your turns reads stale.`,
].join('\n');

// the orbit tool's arguments; an `ops` item takes the same ones, since the engine drops any argument a schema does not name
const ORBIT_PROPS = {
    act: {
        enum: ['create', 'edit', 'link', 'step', 'end'],
        type: 'string',
    },
    asks: {
        items: {
            properties: {
                hiddenNote: { type: 'string' },
                link: { type: 'string' },
                pick: { type: 'string' },
                text: { type: 'string' },
            },
            required: ['text', 'pick'],
            type: 'object',
        },
        type: 'array',
    },
    current: { type: 'number' },
    id: { type: 'string' },
    ids: { items: { type: 'string' }, type: 'array' },
    items: {
        items: {
            properties: {
                done: { type: 'boolean' },
                text: { type: 'string' },
                ticket: { type: 'string' },
            },
            required: ['text'],
            type: 'object',
        },
        type: 'array',
    },
    lines: { items: { type: 'string' }, type: 'array' },
    op: {
        enum: [
            'add',
            'assume',
            'resolve',
            'follow',
            'plan',
            'glide',
            'second-wind',
        ],
        type: 'string',
    },
    pending: { type: 'string' },
    pick: { type: 'string' },
    plan: { type: 'string' },
    role: { enum: [...LANE_ROLES], type: 'string' },
    session: { type: 'string' },
    slug: { type: 'string' },
    step: { type: 'number' },
    text: { type: 'string' },
    texts: { items: { type: 'string' }, type: 'array' },
    title: { type: 'string' },
    words: {
        additionalProperties: { type: 'string' },
        type: 'object',
    },
} as const;

let selfId: string | undefined;
// the id a /clear left, until the next load reads the new one and writes the successor
let clearedFrom: string | undefined;
// this session's own second wind as the store holds it, read at each load for the band's button
let selfWind: StashWind['state'] | undefined;
let label = 'session';
let isUserTurn = false;
// what this session's last reply waits on, its 🔭 line
let wait: string | undefined;
let pinged = false;
let isPolling = false;
let afk = false;
let isWaker = false;
let shown: Record<string, boolean> = {};
let isSettingsOpen = false;
// the main thread's tool calls this turn, and whether its one phases nudge went out
// a field never redraws because of its own typing: the surface runs a keystroke ahead of this module, so any changed
// `value` — the stored steer, or even the latest text this module heard — reset the field and threw the caret (dima,
// 16:15 and 16:22). while typing, the field keeps drawing the value it showed; once typing has been quiet for
// FIELD_QUIET_MS the stored text takes over. a change from outside (a steer cleared once it joined a turn) is drawn at
// once; when it equals what is already drawn the surface would keep the typed text, so the field remounts under a new key
export type FieldDraft = {
    drawn: string;
    sent: string[];
    at: number;
    isLanded: boolean;
};
// dima's o8, 17:14: «1-2 s at least» — a short pause no longer snaps a long field back to its start
const FIELD_QUIET_MS = 3000;
const FIELD_SAVE_MS = 1500;
const pendingSaves = new Map<
    string,
    { save: () => unknown; timer: { cancel: () => void } }
>();
// a field was typed into within the quiet window: the poll holds its redraw till it passes
export const isTypingAt = (typedAt: readonly number[], now: number) =>
    typedAt.some((at) => now - at < FIELD_QUIET_MS);

// every save still waiting on a pause runs now: before a press, a prompt or a tool call reads what was typed
async function flushFields() {
    const due = [...pendingSaves];
    pendingSaves.clear();
    for (const [, p] of due) p.timer.cancel();
    await Promise.all(due.map(([, p]) => p.save()));
}
const drafts = new Map<string, FieldDraft>();
const remounts = new Map<string, number>();
export type FieldView =
    | { kind: 'held'; draft: FieldDraft }
    | { kind: 'saved' }
    | { kind: 'outside'; isRemount: boolean };
export function fieldView(
    draft: FieldDraft | undefined,
    saved: string,
    now: number,
    isNumber = false,
): FieldView {
    if (!draft) return { kind: 'saved' };
    const isOwn = draft.sent.includes(saved);
    const isLag = saved === draft.drawn && !draft.isLanded;
    if (!isOwn && !isLag)
        return { isRemount: saved === draft.drawn, kind: 'outside' };
    // a text field never swaps its value for the stored one: the surface scrolls a field back to its start on any value
    // change, equal text or not; a number is short, so it may snap back to the stored value
    if (isNumber && now - draft.at >= FIELD_QUIET_MS) return { kind: 'saved' };
    return {
        draft: isOwn && !draft.isLanded ? { ...draft, isLanded: true } : draft,
        kind: 'held',
    };
}
export const typedInto = (
    draft: FieldDraft | undefined,
    drawn: string,
    text: string,
    now: number,
): FieldDraft => ({
    at: now,
    drawn: draft?.drawn ?? drawn,
    isLanded: draft?.isLanded ?? false,
    sent: [...(draft?.sent ?? []).slice(-50), text],
});
// a steer field remounts on a clear it cannot otherwise show; a number field keeps its typed text beside its refusal line
const isNumberField = (key: string) =>
    key.startsWith('knob:') || key === 'compact-at';
// a steer keeps its text as typed: a trimmed save was drawn back once typing went quiet, and the desktop field lost
// what the trim cut (dima's wisp, 10-13 15:42); only spaces is no steer, and the model reads it trimmed
const steerOf = (value: string) => (value.trim() ? value : undefined);
function field($: EngineInterface, key: string, saved: string) {
    const isNumber = isNumberField(key);
    const view = fieldView(
        drafts.get(key),
        saved,
        // clock-ok: a field draws in a sync render, where $.clock.now() cannot be awaited
        Date.now(),
        isNumber,
    );
    if (view.kind === 'held') drafts.set(key, view.draft);
    else drafts.delete(key);
    if (view.kind === 'outside' && view.isRemount && !isNumber)
        remounts.set(key, (remounts.get(key) ?? 0) + 1);
    const value = view.kind === 'held' ? view.draft.drawn : saved;
    const gen = remounts.get(key);
    return {
        key: gen ? `${key}#${gen}` : key,
        // the save waits for a pause: each save redraws the board, and a redraw mid-typing scrolled the field back to its
        // start (dima's video, 16:40); a press, a prompt or a tool call flushes it first
        type: (text: string, save: () => unknown) => {
            drafts.set(
                key,
                // clock-ok: a keystroke lands in a sync handler, where $.clock.now() cannot be awaited
                typedInto(drafts.get(key), value, text, Date.now()),
            );
            // a number is a few characters and never scrolls: it saves on each keystroke, as its refusal line needs
            if (isNumberField(key)) return void save();
            pendingSaves.get(key)?.timer.cancel();
            pendingSaves.set(key, {
                save,
                timer: $.clock.after(FIELD_SAVE_MS, () => {
                    pendingSaves.delete(key);
                    void save();
                }),
            });
        },
        value,
    };
}

let turnTools = 0;
let isNudged = false;
// the phases nudge fires only on a turn that did real work: an edit, a spawn or a stop, a commit, a lane move — a q&a
// turn keeps quiet and the 3-turn stale mark covers it (PK-70: 235 plan calls in a session, the nudge on every turn)
let isWorkTurn = false;
// this turn's wrap_up carried an ask, and the Q numbers its orbit adds opened with: the Stop checks read both (FRM-427)
let isWrapAsked = false;
let gridQs: string[] = [];
const WORK_TOOLS = new Set([
    'Edit',
    'Write',
    'NotebookEdit',
    'MultiEdit',
    'Agent',
]);
const WORK_BASH =
    /\b(claude\s+(--bg|-n\s+\S+.*--bg|stop|respawn)|git\s+commit|x\s+lane\s+(commit|push|pr-open|merge-main|seed)|x\s+mods\s+edit\s+push)\b/;
export const isWork = (tool: string, command?: string) =>
    WORK_TOOLS.has(tool) || (tool === 'Bash' && WORK_BASH.test(command ?? ''));
let isPrimed = false;
// the 5h reset as the last session.measure reported it, and this session's cap state
let fiveHourResetsAt: number | undefined;
// the dir the session started in: its project, whose .claude settings the threshold input writes
let projectDir: string | undefined;
let cap: StashCap | undefined;
let capGen = 0;
let turnAfk: boolean | undefined;
let proc: Proc | undefined;
// since: the turn end the next ping counts from; only dima's click turns it off, a 5h reset never does
let hot: { since: number } | undefined;
let endedAt: number | undefined;
let isBusy = false;
// the model label last written for this session, so a step writes the store only when it changes
let modelSeen: string | undefined;
// a turn start or a flip bumps it, so a ping armed before either never fires
let hotGen = 0;

// what the fleet did while dima was afk, shown in the band where he turned 💨 off until his next prompt
type Digest = StashDigest;
let digest: Digest | undefined;

const EMPTY_ORBIT: StashOrbit = { asks: [], next: 1, turns: 0 };
// mirrors `$.state`'s orbit, which survives a reload: a get inside one dispatch reads the moment it began
let orbit: StashOrbit = EMPTY_ORBIT;
// false until this process read its orbit back, from $.state or the kept store; until then nothing is kept, so an
// empty module copy never writes over the kept one
let isOrbitLoaded = false;

// one json line to x-speak's control socket; the text rides argv, never the shell's words
// quiet comms (PK-93, dima's o17: an a/b mvp, one switch to revert): in clio's thread a member's [progress] ping is
// held, no turn; every other tag, and no tag, passes; held pings ride her next prompt as one hidden block, or an
// idle append after 10 min. the a/b reads one log line per delivery from the store (docs/test-drive/quiet-comms.md)
const QUIET = { key: 'quiet', plugin: 'x-mod-stash' } as const;
const QUIET_HELD = 'quiet-held:';
// 🐦‍🔥 second wind (todo 16): `wind:<sid>`, written by any board's press and read by that session's own stash at its next
// turn, so the ask rides the turn and never starts one (dima's slipstream)
const WIND = 'wind:';
// dima asking clio about cost: her context points at the price facts once, so she never answers from recall (o171; 10-13
// she quoted a cache read at 1/10 of input, the file says 1/20)
export const COST_WORDS =
    /\b(?:tokens?|cach(?:e|ed|ing)|(?:ctx|context) costs?|pricing|mtok)\b/i;
const COST_HINT =
    "💵 a cost question: read ~/frame/home/.claude/plugin-x/skills/crew-lead/references/model-cards.md before answering (each model's price line, and the «cache reads are where agents spend» bullet), never from recall.";
// the button's emoji per state; idle draws the bird
export const WIND_EMOJI = {
    asked: '🥚',
    cancelled: '↩️',
    idle: '🐦‍🔥',
    refreshing: '🌀',
    refused: '🛑',
    writing: '✍️',
} as const;
const WIND_SAY = {
    asked: 'asked, waits for its next turn',
    cancelled: 'cancelled, tells it at its next turn',
    refreshing: 'compacting onto its handoff',
    refused: 'refused, work started after pending: none',
    writing: 'finishing its step, then its handoff',
} as const;
const WIND_HOW = `write your handoff with x:handoff (audience: your own role token, slug <lane or topic>-<n>); its first first-act is your role's init list — every skill your role loads at its start and every file it reads whole (codie: x:crew-codie, x:crew-dna read whole, the tree's AGENTS.md, and its lane's own, plugin-authoring for a mods codie; clio: her boot), since a compact re-attaches only some of your skills. then call ${ORBIT_TOOL} op second-wind with its slug and pending: none, or what is still pending (a subagent, a background job, a task not parked), which refuses the compact until it is resolved: at that turn's end the mod compacts this conversation and ingests the handoff, so your next turn starts fresh from it.`;
export const WIND_WORDS =
    'a second wind is a graceful context refresh, a request, never urgent — the session and its codies resolve every subagent and park everything before the compact, so nothing is lost.';
const WIND_NOTE = `🐦‍🔥 second wind: dima asked you to refresh your context at a good stop. ${WIND_WORDS} finish the step you are on, nothing interrupts it; a member mid-round (sixth sense's loop, a designer's take) stops after that round or take. then ${WIND_HOW}`;
// clio's good stop is todo 16's nine steps (dima, 10-13)
const WIND_NOTE_OWNER = `🐦‍🔥 second wind: dima asked you to checkpoint once the topic you are on is done — no rush, no deadline. ${WIND_WORDS} finish that topic whole first: every lane and agent it started lands, its findings fold, the distill, the print, the log and the commit; a topic is never split across a compact. take nothing new after it. then run clio:checkpoint, tell the fleet, and put your «right after the pickup I'd do X» ask into orbit. then ${WIND_HOW}`;
const windRefused = (what: string) =>
    `🐦‍🔥 second wind refused: ${what} started after you said pending: none, so nothing compacted. resolve it, then call ${ORBIT_TOOL} op second-wind again.`;
const WIND_CANCELLED =
    '🐦‍🔥 second wind cancelled: dima took the refresh back. carry on; no handoff needed for it.';
// the turn's end lets the engine settle before the compact runs
const WIND_DELAY_MS = 1_000;
const QUIET_LOG = 'quiet-log:';
const QUIET_LOG_MAX = 500;
const QUIET_TAG = /^\s*\[(done|blocked|ask|progress)\]/i;
// a [progress] ping that asks dima something is pushed, never held; dima's list (o26), a bare «?» was 4 false of 4
const QUIET_PUSH = /(?<![\w-])(?:for dima|decisions|pick:|your call)(?![\w-])/i;
// the safety net (brief 6): the ledger's gaps, the canary's test ping, how long a held ping may wait past the idle wait
const QUIET_GAP = 'quiet-gap';
const QUIET_CANARY = /^\s*\[progress\]\s*quiet canary ([\w-]+)/i;
const QUIET_STUCK_MS = 2 * 60_000;
// a send younger than the grace may still be on its way, so the ledger counts it next minute
const LEDGER_GRACE_MS = 2 * 60_000;
const LEDGER_EVERY_MS = 60_000;
// the alarms already raised, so each gap and each stuck hold notifies once, across reloads too
const QUIET_ALARMED = 'quiet-alarmed';
const QUIET_ALARMED_MAX = 50;
const QUIET_ALARM_TITLE = '🚨 quiet comms';
// osascript's own argv, so no text is ever spliced into the script
const NOTIFY_SCRIPT =
    'on run argv\ndisplay notification (item 1 of argv) with title (item 2 of argv)\nend run';

// every way a member addresses clio in a SendMessage `to`: her name (any ref after it), the socket a reply copies from
// her envelope's `from`, her session ids — as one grep -E alternation, read wherever `to` sits in the input
export function clioAddress(ids: { pid?: number; sids: string[] }) {
    const literal = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const alts = [
        'clio',
        ...(ids.pid ? [`cc-socks/${ids.pid}\\.sock`] : []),
        ...ids.sids.filter(Boolean).map(literal),
    ];
    return `"to":"[^"]*(${alts.join('|')})`;
}

// only clio's thread holds anything, known by her registry name — never the cwd, which a Bash `cd` moves: her pings
// passed unheld from 16:43, the hour she worked cd'd into ~/frame (clio's wisp, 17:06)
const isQuietHome = ($: EngineInterface) => isLaneOwner($);

// a peer delivery's body and sender: a cli peer's envelope names it `from-name`, a desktop one `name` (probe, 14:49)
export function peerPing(text: string) {
    const from =
        text.match(/\bfrom-name="([^"]*)"/)?.[1] ??
        text.match(/\bname="([^"]*)"/)?.[1] ??
        'a member';
    const body = text
        .replace(/^[\s\S]*?<cross-session-message[^>]*>\n?/, '')
        .replace(/\n?<\/cross-session-message>\s*$/, '');
    const tag = body.match(QUIET_TAG)?.[1]?.toLowerCase() ?? 'none';
    const canary = body.match(QUIET_CANARY)?.[1];
    return { body, from, tag, ...(canary ? { canary } : {}) };
}

async function quietOf($: EngineInterface): Promise<StashQuiet> {
    return (
        (await $.state.get(QUIET).catch(() => undefined))?.value ?? { held: [] }
    );
}

// true once the held list is in the session's state; the store copy only feeds the board's row
async function saveQuiet($: EngineInterface, q: StashQuiet) {
    const isSaved = await $.state
        .set(QUIET, q)
        .then(() => true)
        .catch(() => false);
    const sid = await currentId($);
    if (sid) await $.store.set(QUIET_HELD + sid, q.held).catch(() => undefined);
    return isSaved;
}

// true once the line is in the day's log
async function quietLog($: EngineInterface, line: QuietLogLine) {
    const key = QUIET_LOG + new Date(line.at).toISOString().slice(0, 10);
    const was = ((await $.store.get(key).catch(() => undefined)) ??
        []) as QuietLogLine[];
    return $.store
        .set(key, [...was, line].slice(-QUIET_LOG_MAX))
        .then(() => true)
        .catch(() => false);
}

// each held ping that reached clio's thread gets a `flushed` line, so a canary sees held → delivered
async function quietFlushed($: EngineInterface, held: QuietPing[]) {
    const at = await $.clock.now();
    for (const p of held)
        await quietLog($, {
            arm: 'on',
            at,
            from: p.from,
            startedTurn: false,
            tag: 'progress',
            verdict: 'flushed',
            ...(p.canary ? { canary: p.canary } : {}),
        });
}

// the ledger: each live member's sends to clio, counted from its own transcript, against her quiet log's lines from
// it; a member that sent more than the log holds lost a ping between the two. the window opens at the day's first log
// line (before it quiet comms logged nothing) and at the member's start
async function quietLedger($: EngineInterface, now: number) {
    const day = new Date(now).toISOString().slice(0, 10);
    const judged = (
        ((await $.store.get(QUIET_LOG + day).catch(() => undefined)) ??
            []) as QuietLogLine[]
    ).filter((l) => l.verdict !== 'flushed');
    const opened = judged.length
        ? Math.min(...judged.map((l) => l.at))
        : Date.parse(`${day}T00:00:00Z`);
    const home = await $.env.get('HOME');
    const me = await currentId($);
    const pid = (await procNow($))?.pid;
    const mine = (await $.fs
        .read(`${home}/.claude/sessions/${pid}.json`)
        .then((raw) => JSON.parse(raw) as Record<string, unknown>)
        .catch(() => ({}))) as Record<string, unknown>;
    const to = clioAddress({
        pid,
        sids: [me, text(mine.hostSessionId)].filter(
            (x): x is string => typeof x === 'string',
        ),
    });
    const gaps: QuietGap[] = [];
    const members = (await registry($)).filter(
        (r) => r.isAlive && r.base.sid !== me,
    );
    // a log line is the member's by its session id, or by its name; a line from an older name (the member was renamed
    // mid-day) is its own when no live member answers to that name and the role is the member's alone
    const liveKeys = new Set(members.map((r) => memberKey(r.base.name)));
    const roles = new Map<string, number>();
    for (const r of members) {
        const role = roleKey(r.base.name);
        if (role) roles.set(role, (roles.get(role) ?? 0) + 1);
    }
    for (const r of members) {
        const since = Math.max(opened, r.startedAt ?? 0);
        // the transcript by its session id, never the cwd: the registry's cwd follows a Bash `cd`
        const out = await $.process
            .run(['sh', '-c', LEDGER_SENDS, 'sh', home ?? '', r.base.sid, to])
            .catch(() => undefined);
        if (!out) continue;
        const sent = out.stdout
            .split('\n')
            .map((t) => Date.parse(t))
            .filter((t) => t >= since && t <= now - LEDGER_GRACE_MS).length;
        // the envelope names crow as the registry stores her («🐦 ⬛», the joiner a space), the board as rejoined: bare both
        // a member keeps its identity when its mode emoji changes (☕️ → 🌗 on a rename), so the lines match without it
        const role = roleKey(r.base.name);
        const isOurs = (l: QuietLogLine) =>
            l.sid
                ? l.sid === r.base.sid
                : memberKey(l.from) === memberKey(r.base.name) ||
                  (role !== undefined &&
                      roles.get(role) === 1 &&
                      roleKey(l.from) === role &&
                      !liveKeys.has(memberKey(l.from)));
        const logged = judged.filter((l) => isOurs(l) && l.at >= since).length;
        if (sent > logged) gaps.push({ from: r.base.name, logged, sent });
    }
    return gaps;
}

// crow's wake, parked by her wake script for a desktop tab: clio's thread sends the line itself, no tool call of
// hers (brief 8 item 2), then marks it sent so her prompt hook starts the harvester; a failed send stays parked for the
// next poll
async function relayCrowWake($: EngineInterface) {
    if (!(await isLaneOwner($))) return;
    const path = `${await $.env.get('HOME')}/.local/state/crow/relay.json`;
    const raw = await $.fs.read(path).catch(() => undefined);
    if (!raw) return;
    let parked: Record<string, unknown> | null;
    try {
        parked = JSON.parse(raw) as Record<string, unknown> | null;
    } catch {
        return;
    }
    if (!parked || parked.isSent || typeof parked.line !== 'string') return;
    const crow = memberOf(await registry($), `${CROW} crow`);
    if (!crow) return;
    const r = await $.session
        .send({ text: parked.line, to: { sessionId: crow.base.sid } })
        .catch(() => undefined);
    if (!r?.isDelivered) return;
    // a newer wake parked while this one went out stays as it is
    if ((await $.fs.read(path).catch(() => undefined)) !== raw) return;
    await $.fs
        .write(path, JSON.stringify({ ...parked, isSent: true }))
        .catch(() => undefined);
}

// one native notification per alarm key: `$.ui.notify` writes only through a terminal (the desktop answers no-surface),
// so a not-sent one goes out through osascript; both failing leaves a log line, never a throw
async function quietAlarm($: EngineInterface, key: string, text: string) {
    const raised =
        ((await $.store.get(QUIET_ALARMED)) as string[] | undefined) ?? [];
    if (raised.includes(key)) return;
    await $.store.set(
        QUIET_ALARMED,
        [...raised, key].slice(-QUIET_ALARMED_MAX),
    );
    const sent = await $.ui
        .notify(text, { title: QUIET_ALARM_TITLE })
        .catch((err: unknown) => ({
            isSent: false as const,
            reason: String(err),
        }));
    if (sent.isSent) return;
    const r = await $.process
        .run(['osascript', '-e', NOTIFY_SCRIPT, text, QUIET_ALARM_TITLE])
        .catch(() => undefined);
    if (r?.exitCode === 0) return;
    await $.ui.log(
        `x-mod-stash: quiet alarm not raised (notify: ${sent.reason}; osascript: ${r ? `exit ${r.exitCode}` : 'did not run'}): ${text}`,
    );
}

// a ledger gap rides clio's next prompt once, model-only: the board draws no card for it, so this note is how
// a skipped hold reaches her turn; a gap that changes (more sends, more lines) is told again
const QUIET_GAP_TOLD = 'quiet-gap-told';
// told per member by the size of its gap (sent - logged): a standing gap that only moves with new sends is not told
// again, a bigger one is, and a gap that closes is forgotten so its next opening is told
async function takeGapNotes($: EngineInterface) {
    const gaps =
        (
            (await $.store.get(QUIET_GAP).catch(() => undefined)) as
                | { gaps?: QuietGap[] }
                | undefined
        )?.gaps ?? [];
    const told =
        ((await $.store.get(QUIET_GAP_TOLD).catch(() => undefined)) as
            | Record<string, number>
            | undefined) ?? {};
    const size = (g: QuietGap) => g.sent - g.logged;
    const fresh = gaps.filter((g) => size(g) > (told[g.from] ?? 0));
    const next = Object.fromEntries(
        gaps.map((g) => [g.from, Math.max(size(g), told[g.from] ?? 0)]),
    );
    if (JSON.stringify(next) !== JSON.stringify(told))
        await $.store.set(QUIET_GAP_TOLD, next);
    return fresh.map(
        (g) =>
            `🤫 quiet-comms ledger: ${g.from} sent you ${g.sent} pings and your quiet log holds ${g.logged}: ${size(g)} skipped the hold, check its log line.`,
    );
}

// the ledger runs once a minute in clio's thread; its gaps sit in the store for her next prompt, and each
// new gap or a held ping stuck past the idle wait + 2 min raises one native alarm
let ledgerAt = 0;
async function quietBooks($: EngineInterface) {
    if (!(await isQuietHome($))) return;
    const now = await $.clock.now();
    if (now - ledgerAt < LEDGER_EVERY_MS) return;
    ledgerAt = now;
    const gaps = await quietLedger($, now);
    await $.store.set(QUIET_GAP, { at: now, gaps });
    // a member's gap alarms once while it stays open; once it closes, its next gap alarms again
    const raised =
        ((await $.store.get(QUIET_ALARMED)) as string[] | undefined) ?? [];
    const open = new Set(gaps.map((g) => `gap:${g.from}`));
    const kept = raised.filter((k) => !k.startsWith('gap:') || open.has(k));
    if (kept.length !== raised.length) await $.store.set(QUIET_ALARMED, kept);
    for (const g of gaps)
        await quietAlarm(
            $,
            `gap:${g.from}`,
            `${g.from} sent clio ${g.sent}, her quiet log holds ${g.logged}`,
        );
    const held = heldOf(await $.store.get(QUIET_HELD + (await currentId($))));
    if (!held) return;
    const oldest = held.reduce((a, b) => (b.at < a.at ? b : a));
    const stuckMs =
        (await readNumber($, 'quietWait')) * 60_000 + QUIET_STUCK_MS;
    if (now - oldest.at > stuckMs)
        await quietAlarm(
            $,
            `stuck:${oldest.at}`,
            `${held.length} held ping${held.length === 1 ? '' : 's'} stuck ${Math.round((now - oldest.at) / 60_000)} min, oldest from ${oldest.from}`,
        );
}

export const quietNote = (held: QuietPing[]) =>
    [
        `🤫 quiet comms: ${held.length} held member ping${held.length === 1 ? '' : 's'}, [progress] only; read them, act only if one changes the plan, never relay them to dima.`,
        ...held.map(
            (p) =>
                `- ${new Date(p.at).toTimeString().slice(0, 5)} ${p.from}: ${p.text}`,
        ),
    ].join('\n');

// the held pings a session published, for its row; anything else reads as none
const heldOf = (v: unknown): QuietPing[] | undefined =>
    Array.isArray(v) && v.length
        ? v.filter(
              (p): p is QuietPing =>
                  typeof p?.at === 'number' &&
                  typeof p?.from === 'string' &&
                  typeof p?.text === 'string',
          )
        : undefined;

// held pings past 10 min while clio is idle: one hidden row, no turn (probe Q2, 11:46:50)
async function quietIdle($: EngineInterface) {
    const q = await quietOf($);
    if (!q.held.length) return;
    if ((await $.state.get(TURN).catch(() => undefined))?.value?.isBusy) return;
    const now = await $.clock.now();
    const waitMs = (await readNumber($, 'quietWait')) * 60_000;
    if (now - Math.min(...q.held.map((p) => p.at)) < waitMs) return;
    const appended = await $.session
        .append({
            message: {
                content: [{ text: quietNote(q.held), type: 'text' }],
                type: 'user',
            },
        })
        .catch(() => undefined);
    if (!appended || 'deny' in appended) return;
    await saveQuiet($, { ...q, held: [] });
    await quietFlushed($, q.held);
}

// speak's own answer to `status`: reading and not paused draws ⏸️ on every play button, else ▶️ (dima, 15:51)
const SPEAKING = { key: 'speaking', plugin: 'x-mod-stash' } as const;
async function refreshSpeaking($: EngineInterface) {
    const r = await speak($, { op: 'status' });
    let isPlaying = false;
    try {
        const v = JSON.parse(r ?? '{}') as {
            speaking?: unknown;
            paused?: unknown;
        };
        isPlaying = v.speaking === true && v.paused !== true;
    } catch {}
    if ((await $.state.get(SPEAKING)).value !== isPlaying)
        await $.state.set(SPEAKING, isPlaying).catch(() => undefined);
}

async function speak($: EngineInterface, request: Record<string, string>) {
    const socket = `${await $.env.get('HOME')}/.local/share/x-speak/control.sock`;
    const r = await $.process
        .run([
            'sh',
            '-c',
            'printf "%s\\n" "$1" | nc -U -w 2 "$2"',
            'sh',
            JSON.stringify(request),
            socket,
        ])
        .catch(() => undefined);
    if (!r || r.exitCode !== 0 || r.stdout.includes('"error"')) {
        $.ui.log(
            `x-mod-stash orbit: speak did not take ${request.op}: ${r?.stdout.trim() || r?.stderr.trim() || 'no answer'}`,
        );
        return undefined;
    }
    return r.stdout;
}

// a play press: pause or resume what reads, or read this row when nothing does; the status is read again after it
async function playPress($: EngineInterface, text: string) {
    const isPlaying = (await $.state.get(SPEAKING)).value === true;
    const status = isPlaying ? undefined : await speak($, { op: 'status' });
    const isPaused = status ? /"paused":true/.test(status) : false;
    const isSpeaking = status ? /"speaking":true/.test(status) : false;
    await speak(
        $,
        isPlaying || (isSpeaking && isPaused)
            ? { op: 'pause' }
            : { op: 'read', text },
    );
    await refreshSpeaking($);
}

// kept in $.state for this session, and its open asks mirrored into the store, where the board's `🪐 n` and the away
// digest count every session's
async function saveOrbit($: EngineInterface, next: StashOrbit) {
    orbit = next;
    await $.state
        .set(ORBIT, orbit)
        .catch((err) =>
            $.ui.log(`x-mod-stash: orbit was not kept: ${errorText(err)}`),
        );
    await keepState($, { orbit }).catch(() => undefined);
    const sid = await currentId($);
    if (!sid) return;
    const open = orbit.asks.filter((a) => !a.isResolved);
    const asks = open.map((a) => a.text);
    if (asks.length)
        await $.store
            .set(PREFIX + sid, {
                asks,
                at: await $.clock.now(),
                items: open.map((a) => ({
                    id: a.id,
                    pick: a.pick,
                    text: a.text,
                    ...(a.link ? { link: a.link } : {}),
                    ...(a.mark ? { mark: a.mark } : {}),
                    ...(a.sendAt ? { sendAt: a.sendAt } : {}),
                    ...(a.steer ? { steer: a.steer } : {}),
                    ...(a.isLocked ? { isLocked: true } : {}),
                })),
                label,
                name: await sessionName($),
            } satisfies Entry)
            .catch(() => undefined);
    else await $.store.delete(PREFIX + sid).catch(() => undefined);
}

// the orbit as $.state holds it now: a reload can run a hook before session.start reads it back, and a module copy
// that never loaded would write an empty orbit over the kept one (FRM-381: «coder wiped the orbit»)
async function currentOrbit($: EngineInterface) {
    const kept = (await $.state.get(ORBIT).catch(() => undefined))?.value;
    if (kept) orbit = steeredOrbit(kept);
    // a new process whose first hook is a turn's end, before its start (an app restart mid-turn): the kept copy first
    else if (!isOrbitLoaded)
        orbit = await resumeState($).catch(() => EMPTY_ORBIT);
    isOrbitLoaded = true;
    return orbit;
}

// a glide card's marks on one member's asks: one store key per ask, `marks:<sid>:<ask id>`, so a board writes only its
// own key and the member deletes only the keys it read — a shared map lost or re-applied marks across sessions
const markKey = (sid: string, askId: string) => `${MARKS}${sid}:${askId}`;

async function marksOf($: EngineInterface, sid: string) {
    const marks: Record<string, RemoteMark> = {};
    const keys = (await $.store.keys().catch(() => [] as string[])).filter(
        (k) => k.startsWith(`${MARKS}${sid}:`),
    );
    for (const key of keys) {
        const m = (await $.store.get(key).catch(() => undefined)) as
            | RemoteMark
            | undefined;
        if (m) marks[key.slice(`${MARKS}${sid}:`.length)] = steered(m);
    }
    return marks;
}

// a steer typed into this session's own box a moment ago is newer than a card's edit that lands now
const isTypedHere = (askId: string) =>
    isTypingAt(
        [drafts.get(`orbit:steer:${askId}`)?.at ?? 0],
        // clock-ok: compared with the drafts' own Date.now() stamps, so both sides read one clock
        Date.now(),
    );

// marks dima made on another board's glide card join this session's own orbit, as if made here; a steer typed here stays
// in its box over the remote mark's (PK-149)
async function absorbMarks($: EngineInterface) {
    const sid = await currentId($);
    if (!sid) return;
    const marks = await marksOf($, sid);
    if (!Object.keys(marks).length) return;
    const o = await currentOrbit($);
    const win = await sendWindow($);
    await saveOrbit($, {
        ...o,
        asks: o.asks.map((a) => {
            const m = marks[a.id];
            if (!m || a.isLocked || a.isResolved) return a;
            return {
                ...a,
                isChanged: false,
                mark: m.mark,
                markedAt: m.mark ? m.at : undefined,
                sendAt: m.mark ? (m.markAt ?? m.at) + win : undefined,
                steer: isTypedHere(a.id)
                    ? a.steer
                    : m.isSteerEdit
                      ? m.steer
                      : (a.steer ?? m.steer),
            };
        }),
    });
    // the marks go once the orbit holds them, and only the ones still as read: a steer typed on that board meanwhile
    // stays for the next take, and its card never sees the steer missing in between
    for (const [id, m] of Object.entries(marks)) {
        const stored = (await $.store
            .get(markKey(sid, id))
            .catch(() => undefined)) as RemoteMark | undefined;
        if (stored?.at === m.at)
            await $.store.delete(markKey(sid, id)).catch(() => undefined);
    }
}

// an idle session whose asks were marked from another board wakes once dima prompts anywhere after the marks: one turn
// carrying all of them. the submitted prompt skips this plugin's own prompt.submit hook, so the marks ride its text
async function wakeForMarks($: EngineInterface) {
    if (
        (await $.state.get(TURN).catch(() => undefined))?.value?.isBusy ??
        isBusy
    )
        return;
    if (!(await partsShown($))('stash.orbit')) return;
    const o = await currentOrbit($);
    const due = o.asks
        .filter(isDue(await $.clock.now()))
        .filter((a) => a.markedAt !== undefined);
    if (!due.length) return;
    const dimaAt = Number(await $.store.get(DIMA_AT).catch(() => 0)) || 0;
    if (dimaAt <= Math.min(...due.map((a) => a.markedAt ?? 0))) return;
    await saveOrbit($, lockJoined(o, due));
    void selfSubmit($, joinText(due)).catch(() => undefined);
}

// a plan set this turn counts from the turn's end, so a prompt landing mid-turn would read it as -1
const planAge = (o: StashOrbit) =>
    o.plan === undefined ? undefined : Math.max(0, o.turns - o.plan.at);

// the per-prompt note that keeps the habit through a compaction; none while orbit is empty
function orbitReminder(o: StashOrbit, isOn: IsPartOn) {
    const open = o.asks.filter((a) => !a.isResolved);
    const isPhasesOn = isOn('stash.phases');
    const age = isPhasesOn ? planAge(o) : undefined;
    if (!open.length && age === undefined) return undefined;
    const asks = open.length
        ? `orbit holds ${open.length} open ask${open.length === 1 ? '' : 's'} (${open.map((a) => a.id).join(', ')})`
        : 'orbit holds no open ask';
    const plan = !isPhasesOn
        ? ''
        : age === undefined
          ? '; no plan set'
          : `; plan set ${age} turn${age === 1 ? '' : 's'} ago${age >= STALE_TURNS ? ', stale: set it again' : ''}`;
    return `${asks}${plan}. asks${isPhasesOn ? ' and the plan' : ''} go through ${ORBIT_TOOL}, never into a reply.`;
}

// the one reply shape while no board reaches dima — 📱 mobile mode, where mods draw nothing, or 🪐 orbit switched off —
// the same text either way (dima's o162); x:mobile-mode keeps only its phone bits and points here
function noBoardReminder(o: StashOrbit, isOn: IsPartOn) {
    const open = o.asks.filter((a) => !a.isResolved);
    const ids = open.length ? ` (${open.map((a) => a.id).join(', ')})` : '';
    // the phases are gone off the board too: the plan's next 3 moves print under the fence (dima's o112, 2026-10-11)
    const isPhasesOn = isOn('stash.phases');
    const age = planAge(o);
    const stale =
        isPhasesOn && age !== undefined && age >= STALE_TURNS
            ? ` the plan is stale, untouched ${age} turns: set it again through ${ORBIT_TOOL}.`
            : '';
    const moves = isPhasesOn
        ? ", then «🌔 next:» and the plan's next 3 moves as bullets"
        : '';
    return `no board reaches dima: end the reply with the asks fence, «⏳ waiting on your word:», every open orbit ask${ids} with its id and pick, and each new ask as one ➡️ line${moves}. his answers come back in his prompt; resolve the ones he answered by id through ${ORBIT_TOOL} while 🪐 orbit is switched on.${stale}`;
}

const enhancerOf = async ($: EngineInterface): Promise<StashEnhancer> =>
    (await $.state.get(ENHANCER)).value ?? { status: 'idle' };
const saveEnhancer = ($: EngineInterface, next: StashEnhancer) =>
    $.state.set(ENHANCER, next).catch(() => undefined);

// what Haiku reads beside the prompt: the rules, every slash command by name, and dima's wispr dictionary
async function enhancerSystem($: EngineInterface) {
    const rules = await $.fs.read(`${$.plugin.root}/enhancer.md`);
    const commands = (await $.command.list().catch(() => []))
        .map((c) => `/${c.name} — ${c.description}`)
        .join('\n');
    const dictionary = await $.process
        .run([
            'sqlite3',
            '-readonly',
            '-separator',
            ' → ',
            `${await $.env.get('HOME')}/${WISPR_DB}`,
            'select coalesce(isSnippet, 0), phrase, replacement from Dictionary where isDeleted = 0 and replacement is not null',
        ])
        .catch(() => undefined);
    // only the mishearing rows: wispr flags a snippet (a short cue for a long text), whose extra lines lead with no flag
    // (dima, 2026-10-11 11:11)
    const heard =
        dictionary?.exitCode === 0
            ? dictionary.stdout
                  .split('\n')
                  .filter((l) => l.startsWith('0 → '))
                  .map((l) => l.slice('0 → '.length))
                  .join('\n')
            : '(unreadable now)';
    return [
        { text: rules },
        { text: `the slash commands:\n${commands}` },
        {
            cache: true as const,
            text: `dima's dictionary, heard → meant:\n${heard}`,
        },
    ];
}

// what each ticket a prompt names is, read through `x linear`, so the session starts with it instead of looking it up;
// x down or an unknown id adds nothing (dima's o14, 23:07)
async function ticketNote($: EngineInterface, text: string) {
    const ids = [...new Set(text.match(TICKET_ID_ALL) ?? [])];
    if (!ids.length) return undefined;
    const r = await $.process
        .run([
            `${await $.env.get('HOME')}/.local/bin/x`,
            'linear',
            'read',
            ...ids,
        ])
        .catch(() => undefined);
    if (r?.exitCode !== 0) return undefined;
    try {
        const tickets =
            (
                JSON.parse(r.stdout) as {
                    data?: {
                        tickets?: {
                            id?: string;
                            title?: string;
                            state?: string;
                            url?: string;
                        }[];
                    };
                }
            ).data?.tickets ?? [];
        const lines = tickets.flatMap((x) =>
            x.id && x.url
                ? [`${x.id}: ${x.title ?? ''} · ${x.state ?? ''} · ${x.url}`]
                : [],
        );
        return lines.length
            ? `the tickets this prompt names, read from linear:\n${lines.join('\n')}`
            : undefined;
    } catch {
        return undefined;
    }
}

// one call per press; a keystroke while it runs keeps his text and drops the answer, an error leaves the box alone
async function enhance($: EngineInterface) {
    // set before any await, so a second press in the same moment finds it
    if (isEnhancing) return;
    isEnhancing = true;
    try {
        await enhanceOnce($);
    } finally {
        isEnhancing = false;
    }
}

async function enhanceOnce($: EngineInterface) {
    const before = await enhancerOf($);
    const pressed = (await $.prompt.read()).text;
    if (!pressed.trim()) return;
    await saveEnhancer($, { ...before, error: undefined, status: 'running' });
    const stop = new AbortController();
    const timer = $.clock.after(ENHANCE_MS, () => stop.abort());
    let answer: string | undefined;
    let failure: string | undefined;
    try {
        const r = await $.model.complete(
            {
                maxTokens: 2048,
                model: ENHANCE_MODEL,
                prompt: pressed,
                system: await enhancerSystem($),
            },
            { signal: stop.signal },
        );
        if (r.isAnswered && r.text.trim()) answer = r.text.trim();
        else
            failure = stop.signal.aborted
                ? `Haiku took over ${ENHANCE_MS / 1000} s`
                : `Haiku gave no prompt back (${r.isAnswered ? 'empty' : r.reason})`;
    } catch (err) {
        failure = errorText(err);
    }
    timer.cancel();
    // read again, not `before`: a send while Haiku answered cleared ⏪ ⏩, and that stays
    const now = await enhancerOf($);
    if ((await $.prompt.read()).text !== pressed)
        return saveEnhancer($, { ...now, status: 'idle' });
    if (answer === undefined)
        return saveEnhancer($, {
            ...now,
            error: `enhance: ${failure}; your text is untouched`,
            status: 'idle',
        });
    if (answer === pressed)
        return saveEnhancer($, {
            ...now,
            error: 'enhance: Haiku found nothing to change',
            status: 'idle',
        });
    const filled = await $.prompt.fill({ text: answer });
    // a refused fill keeps the answer, so new can try the box again
    await saveEnhancer($, {
        error: filled.isFilled
            ? undefined
            : `enhance: the box did not take the answer (${filled.refusal ?? 'a hook kept it out'}); press new to retry`,
        latest: answer,
        original: pressed,
        status: 'idle',
    });
}

// prev keeps whatever he changed in the enhanced text, so new brings his edits back with it
async function enhancePrev($: EngineInterface) {
    const s = await enhancerOf($);
    if (s.status === 'running' || s.original === undefined) return;
    const box = (await $.prompt.read()).text;
    // an empty box is a sent prompt, never an edit: it keeps the enhanced text for new
    const latest = box === s.original || !box.trim() ? s.latest : box;
    await saveEnhancer($, { ...s, error: undefined, latest });
    await $.prompt.fill({ text: s.original });
}

async function enhanceNew($: EngineInterface) {
    const s = await enhancerOf($);
    if (s.status === 'running' || s.latest === undefined) return;
    const filled = await $.prompt.fill({ text: s.latest });
    await saveEnhancer($, {
        ...s,
        error: filled.isFilled
            ? undefined
            : `enhance: the box did not take the text (${filled.refusal ?? 'a hook kept it out'})`,
    });
}

// dima marks or steers asks; a locked ask is the running turn's and stays as it is. a mark made while a turn runs
// rides that turn's next tool result (the tool.call hook); one the turn never reaches rides his next prompt — a
// hidden message appended instead started a turn of its own when it landed after the last read (dima, 20:31)
// 🛎️ clears an assumption, ↩️ and its steer mark it wrong; a 🛎️ or ↩️ press means dima is at the mac (dima, 11:16)
async function changeAssumed(
    $: EngineInterface,
    change: (x: OrbitAssumption) => OrbitAssumption | undefined,
    isMark = false,
) {
    if (isMark) await $.state.set(MOBILE, false).catch(() => undefined);
    const o = await currentOrbit($);
    await saveOrbit($, {
        ...o,
        assumed: (o.assumed ?? []).flatMap((x) => {
            const changed = change(x);
            return changed ? [changed] : [];
        }),
    });
}

async function markAsks(
    $: EngineInterface,
    change: (a: OrbitAsk) => OrbitAsk,
    isMark = false,
) {
    // only a 🛎️ or ↩️ press means dima is at the mac: a steer or a speak press never ends mobile mode (dima, 11:16)
    if (isMark) await $.state.set(MOBILE, false).catch(() => undefined);
    const o = await currentOrbit($);
    const asks = o.asks.map((a) =>
        a.isLocked || a.isResolved ? a : change(a),
    );
    await saveOrbit($, { ...o, asks });
}

// dima's tick as x-mod-guard reads it: written here, from his own press alone, so no tool call can forge one (FRM-427);
// a press that unticks, or a mark that never took, drops the ask's record
const TICKS = { key: 'ticks', plugin: 'x-mod-stash' } as const;
const TICKS_KEPT = 20;
const quotedOf = (text: string) =>
    [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1] as string);
async function tickAsk($: EngineInterface, id: string) {
    const ask = (await currentOrbit($)).asks.find((a) => a.id === id);
    const { value: kept = [] } = await $.state.get(TICKS);
    const rest = kept.filter((t) => t.id !== id);
    const isTicked = ask?.mark === 'accepted' && !ask.isLocked;
    await $.state.set(
        TICKS,
        isTicked
            ? [
                  ...rest,
                  {
                      at: ask.sendAt ?? (await $.clock.now()),
                      id,
                      targets: quotedOf(ask.text),
                      text: ask.text,
                  } satisfies StashTick,
              ].slice(-TICKS_KEPT)
            : rest,
    );
}

// the lane ops on the fleet's lanes: validate, then keep each pointer honest — every step before it done, never on a done one
export function glideOp(
    lanes: StashLane[],
    input: Record<string, unknown>,
    turns: number,
    now: number,
): { lanes: StashLane[]; result: string } | { deny: string } {
    const act = input.act;
    if (act === 'create') return laneCreate(lanes, input, turns, now);
    const id = oneLine(input.id);
    const lane = lanes.find((l) => l.id === id && !l.endedAt);
    if (act !== 'link' && act !== 'step' && act !== 'end' && act !== 'edit')
        return { deny: 'orbit glide: act is create, edit, link, step or end' };
    if (!lane)
        return {
            deny: `orbit glide: no live lane «${id}»; live: ${
                lanes
                    .filter((l) => !l.endedAt)
                    .map((l) => l.id)
                    .join(', ') || 'none'
            }`,
        };
    const done = lane.items.filter((x) => x.isDone).length;
    const put = (next: StashLane, result: string) => ({
        lanes: lanes.map((l) => (l.id === lane.id ? next : l)),
        result,
    });
    if (act === 'end')
        return put(
            {
                ...lane,
                endedAt: now,
                history: [
                    ...lane.history,
                    { act, at: now, current: lane.current, done },
                ],
            },
            `lane ${lane.id} «${lane.title}» ended`,
        );
    // a card refreshed in place: the id, members and history stay; a step whose text survives keeps its done flag, and
    // the pointer lands on the first step not done (clio's ask, 18:01: ending and re-creating lost all three)
    if (act === 'edit') {
        if (lane.plan && input.items !== undefined)
            return {
                deny: `orbit glide: lane ${lane.id} follows ${lane.plan}; its steps are that file's lines, edit them there`,
            };
        const title = oneLine(input.title) || lane.title;
        const fresh =
            input.items === undefined ? lane.items : laneItems(input.items);
        if (!Array.isArray(fresh)) return fresh;
        const wasDone = new Set(
            lane.items.filter((x) => x.isDone).map((x) => x.text),
        );
        const stepped = pointed(
            fresh.map((x) => ({
                ...x,
                isDone: x.isDone || wasDone.has(x.text),
            })),
            0,
        );
        return put(
            {
                ...lane,
                current: stepped.current,
                history: [
                    ...lane.history,
                    {
                        act,
                        at: now,
                        current: stepped.current,
                        done: stepped.done,
                    },
                ],
                items: stepped.items,
                movedAt: turns,
                title,
            },
            laneSummary(lane.id, title, stepped),
        );
    }
    if (act === 'link') {
        const session = oneLine(input.session);
        const role = LANE_ROLE_OLD[input.role as string] ?? input.role;
        if (!session)
            return { deny: 'orbit glide: link names the member session id' };
        if (role !== 'codie' && role !== 'sixth-sense')
            return { deny: 'orbit glide: role is codie or sixth-sense' };
        return put(
            {
                ...lane,
                history: [
                    ...lane.history,
                    {
                        act: `link ${role}`,
                        at: now,
                        current: lane.current,
                        done,
                    },
                ],
                members: { ...lane.members, [role]: session },
            },
            `lane ${lane.id}: ${role} is ${session}`,
        );
    }
    if (lane.plan)
        return {
            deny: `orbit glide: lane ${lane.id} follows ${lane.plan}; tick the step there, a hand step is refused`,
        };
    const at = input.current;
    if (
        typeof at !== 'number' ||
        !Number.isInteger(at) ||
        at < 0 ||
        at > lane.items.length
    )
        return {
            deny: `orbit glide: current is a step from 0 to ${lane.items.length}`,
        };
    // a step back reopens the steps from the pointer on, or pointed skips forward over them again
    const stepped = pointed(
        at < lane.current
            ? lane.items.map((x, i) => (i >= at ? { ...x, isDone: false } : x))
            : lane.items,
        at,
    );
    const isMoved = stepped.current !== lane.current || stepped.done !== done;
    return put(
        {
            ...lane,
            current: stepped.current,
            history: isMoved
                ? [
                      ...lane.history,
                      {
                          act,
                          at: now,
                          current: stepped.current,
                          done: stepped.done,
                      },
                  ]
                : lane.history,
            items: stepped.items,
            movedAt: isMoved ? turns : lane.movedAt,
        },
        laneSummary(lane.id, lane.title, stepped),
    );
}

function laneCreate(
    lanes: StashLane[],
    input: Record<string, unknown>,
    turns: number,
    now: number,
): { lanes: StashLane[]; result: string } | { deny: string } {
    const title = oneLine(input.title);
    if (!title) return { deny: 'orbit glide: a title names the lane' };
    const open = lanes.find(
        (l) => !l.endedAt && laneTopic(l.title) === laneTopic(title),
    );
    if (open)
        return {
            deny: `orbit glide: lane ${open.id} «${open.title}» is still open: end it first (glide end ${open.id})`,
        };
    const plan = oneLine(input.plan);
    if (plan && !/^(?:\/|~\/)/.test(plan))
        return {
            deny: 'orbit glide: plan is an absolute or ~/ path to the lane plan file',
        };
    // a lane plan file holds any number of steps: the card windows what it draws
    const items = laneItems(input.items, plan ? Infinity : LANE_MAX);
    if (!Array.isArray(items)) return items;
    const id = `l${1 + Math.max(0, ...lanes.map((l) => Number(l.id.slice(1)) || 0))}`;
    const stepped = pointed(items, 0);
    const lane: StashLane = {
        current: stepped.current,
        history: [
            {
                act: 'create',
                at: now,
                current: stepped.current,
                done: stepped.done,
            },
        ],
        id,
        items: stepped.items,
        members: {},
        movedAt: turns,
        ...(plan ? { plan } : {}),
        title,
    };
    return {
        lanes: [...lanes, lane],
        result: laneSummary(id, title, stepped),
    };
}

// one topic, one open lane: the topic is the title before « — » or «:», case-blind; a finished lane counts until ended
const laneTopic = (title: string) =>
    (title.split(/ — |:/)[0] ?? '').trim().toLowerCase();

type LaneStep = { at: number; step: number };

// a linked codie's plan step moves its lane forward: a step ahead of the pointer and newer than the lane's last move,
// never the finish, which stays clio's act; her own step back holds until codie names a step again (todo 6)
async function followCoders($: EngineInterface) {
    if (!(await isLaneOwner($)) || !(await partsShown($))('stash.glide'))
        return;
    const lanes = await readLanes($);
    const now = await $.clock.now();
    const turns = (await currentOrbit($)).turns;
    const moves: string[] = [];
    const next: StashLane[] = [];
    for (const lane of lanes) {
        const codie = lane.members.codie;
        const m =
            lane.endedAt || lane.plan || !codie
                ? undefined
                : ((await $.store
                      .get(LANE_STEP + bare(codie))
                      .catch(() => undefined)) as LaneStep | undefined);
        if (
            !m ||
            m.at <= (lane.history.at(-1)?.at ?? 0) ||
            m.step <= lane.current ||
            m.step >= lane.items.length
        ) {
            next.push(lane);
            continue;
        }
        const stepped = pointed(lane.items, m.step);
        next.push({
            ...lane,
            current: stepped.current,
            history: [
                ...lane.history,
                {
                    act: 'step',
                    at: now,
                    by: codie,
                    current: stepped.current,
                    done: stepped.done,
                },
            ],
            items: stepped.items,
            movedAt: turns,
        });
        await $.store.delete(LANE_STEER + lane.id).catch(() => undefined);
        moves.push(
            `lane ${lane.id} «${lane.title}» moved to step ${stepped.current} by ${codie}`,
        );
    }
    if (!moves.length) return;
    await writeLanes($, next);
    await $.store.set(LANE_MOVES, [...(await heldLaneMoves($)), ...moves]);
}

// a linked card is its lane plan file: each poll its numbered lines are the steps; an unreadable file keeps the last state
async function followPlans($: EngineInterface) {
    if (!(await isLaneOwner($)) || !(await partsShown($))('stash.glide'))
        return;
    const lanes = await readLanes($);
    if (!lanes.some((l) => l.plan && !l.endedAt)) return;
    const home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
    const now = await $.clock.now();
    const turns = (await currentOrbit($)).turns;
    let isChanged = false;
    const next: StashLane[] = [];
    for (const lane of lanes) {
        if (!lane.plan || lane.endedAt) {
            next.push(lane);
            continue;
        }
        const text = await $.fs
            .read(lane.plan.replace(/^~(?=\/)/, home))
            .catch(() => undefined);
        if (text === undefined) {
            if (!lane.isPlanGone) isChanged = true;
            next.push(lane.isPlanGone ? lane : { ...lane, isPlanGone: true });
            continue;
        }
        const steps = planSteps(text).map((s) => ({
            isDone: s.isDone,
            text: [...s.text].slice(0, LANE_TEXT_MAX).join(''),
            ...(ticketOf(s.text) ? { ticket: ticketOf(s.text) } : {}),
        }));
        const items: LaneItem[] = steps.length ? steps : lane.items;
        const current = items.findIndex((x) => !x.isDone);
        const at = current < 0 ? items.length : current;
        const isSame =
            !lane.isPlanGone &&
            at === lane.current &&
            JSON.stringify(items) === JSON.stringify(lane.items);
        if (isSame) {
            next.push(lane);
            continue;
        }
        isChanged = true;
        // a steer was about the step it sat on: it leaves when the plan moves the pointer, as a hand step does
        if (
            at !== lane.current ||
            lane.items[lane.current]?.text !== items[at]?.text
        ) {
            await $.store.delete(LANE_STEER + lane.id).catch(() => undefined);
            await $.store
                .delete(LANE_STEER_OLD + lane.id)
                .catch(() => undefined);
        }
        const { isPlanGone: _, ...rest } = lane;
        next.push({
            ...rest,
            current: at,
            history:
                at === lane.current
                    ? lane.history
                    : [
                          ...lane.history,
                          {
                              act: 'plan',
                              at: now,
                              current: at,
                              done: items.filter((x) => x.isDone).length,
                          },
                      ],
            items,
            movedAt: at === lane.current ? lane.movedAt : turns,
        });
    }
    if (isChanged) await writeLanes($, next);
}

async function heldLaneMoves($: EngineInterface) {
    const held = await $.store.get(LANE_MOVES).catch(() => undefined);
    return Array.isArray(held) ? (held as string[]) : [];
}

// the held moves, once: they leave the store as they join clio's turn
async function takeLaneMoves($: EngineInterface) {
    await followCoders($);
    const held = await heldLaneMoves($);
    if (held.length) await $.store.delete(LANE_MOVES);
    return held;
}

// a card draws at most LANE_MAX rows: the current step with its neighbours, the rest named in the head
const LANE_WINDOW = LANE_MAX - 2;
function laneBounds(count: number, current: number) {
    if (count <= LANE_MAX) return { from: 0, to: count };
    const from = Math.min(Math.max(current - 1, 0), count - LANE_WINDOW);
    return { from, to: from + LANE_WINDOW };
}
const laneRows = (lane: StashLane) => {
    const { from, to } = laneBounds(lane.items.length, lane.current);
    return lane.items.map((item, i) => ({ i, item })).slice(from, to);
};
const laneSpan = (lane: StashLane) => {
    const { from, to } = laneBounds(lane.items.length, lane.current);
    return lane.items.length > LANE_MAX
        ? ` · ${from + 1}–${to} of ${lane.items.length}`
        : '';
};

// a lane's steps as clio sends them: 1 to `max`, each plain text ≤LANE_TEXT_MAX, an optional ticket id
function laneItems(
    input: unknown,
    max = LANE_MAX,
): LaneItem[] | { deny: string } {
    const raw = Array.isArray(input) ? input : [];
    if (raw.length < 1 || raw.length > max)
        return {
            deny: `orbit glide: 1 to ${max} steps, got ${raw.length}`,
        };
    const items: LaneItem[] = [];
    for (const item of raw) {
        const v = (item ?? {}) as Record<string, unknown>;
        const text = oneLine(v.text);
        if (!text) return { deny: 'orbit glide: every step needs its text' };
        if ([...text].length > LANE_TEXT_MAX)
            return {
                deny: `orbit glide: «${[...text].slice(0, 30).join('')}…» is ${[...text].length} chars; keep it ≤${LANE_TEXT_MAX}, plain words`,
            };
        const ticket = oneLine(v.ticket);
        if (ticket && !LANE_TICKET.test(ticket))
            return {
                deny: `orbit glide: ticket «${ticket}» is not an id like FRM-12`,
            };
        items.push({
            isDone: v.done === true,
            text,
            ...(ticket ? { ticket } : {}),
        });
    }
    return items;
}

// the pointer moves past what is done, and everything behind it is done
function pointed(items: LaneItem[], at: number) {
    let current = at;
    while (current < items.length && items[current]?.isDone) current++;
    const marked = items.map((x, i) => ({
        ...x,
        isDone: x.isDone || i < current,
    }));
    return {
        current,
        done: marked.filter((x) => x.isDone).length,
        items: marked,
    };
}

function laneSummary(
    id: string,
    title: string,
    { current, done, items }: ReturnType<typeof pointed>,
) {
    return current >= items.length
        ? `lane ${id} «${title}» done: it stays on every board, all done, until act end at the next siesta`
        : `lane ${id} «${title}»: ${done} of ${items.length} done, on «${items[current]?.text}»`;
}

const lanesFile = (home: string | undefined) =>
    `${home}/.claude/shelf/lanes.json`;

// read-both: a lane stored before the 10-29 rename names its members coder and verifier
function laneRolesNow(lane: StashLane): StashLane {
    const now = (r?: Partial<Record<string, string>>) =>
        r &&
        Object.fromEntries(
            Object.entries(r).map(([k, v]) => [LANE_ROLE_OLD[k] ?? k, v]),
        );
    return {
        ...lane,
        members: now(lane.members) ?? {},
        ...(lane.memberSids ? { memberSids: now(lane.memberSids) } : {}),
    };
}

// the shelf file as it stands: every lane, ended ones kept as the record
async function readLanes($: EngineInterface): Promise<StashLane[]> {
    const home = await $.env.get('HOME').catch(() => undefined);
    const text = await $.fs.read(lanesFile(home)).catch(() => undefined);
    try {
        const body = text ? JSON.parse(text) : undefined;
        return Array.isArray(body?.lanes)
            ? (body.lanes as StashLane[]).map(laneRolesNow)
            : [];
    } catch {
        return [];
    }
}

async function writeLanes($: EngineInterface, lanes: StashLane[]) {
    const home = await $.env.get('HOME').catch(() => undefined);
    await $.fs
        .write(lanesFile(home), `${JSON.stringify({ lanes }, null, 2)}\n`)
        .catch((err) =>
            $.ui.log(
                `x-mod-stash: the lanes file was not kept: ${errorText(err)}`,
            ),
        );
    await showLanes($, lanes);
}

type LaneSteer = { steer?: string; isTaken?: boolean };

async function laneSteers($: EngineInterface) {
    const steers: Record<string, LaneSteer> = {};
    for (const key of await $.store.keys().catch(() => [] as string[])) {
        const prefix = [LANE_STEER, LANE_STEER_OLD].find((p) =>
            key.startsWith(p),
        );
        if (!prefix) continue;
        const id = key.slice(prefix.length);
        const n = (await $.store.get(key).catch(() => undefined)) as
            | LaneSteer
            | undefined;
        if (n && (prefix === LANE_STEER || !steers[id]))
            steers[id] = steered(n);
    }
    return steers;
}

async function changeLaneSteer(
    $: EngineInterface,
    id: string,
    change: (n: LaneSteer) => LaneSteer,
) {
    const was = (await laneSteers($))[id] ?? {};
    const n = change(was);
    // a bare tick counts too: «good to go on this step», no steer needed (dima's shot, 10-13 18:01: the tick did nothing)
    if (n.steer || n.isTaken) await $.store.set(LANE_STEER + id, n);
    else await $.store.delete(LANE_STEER + id);
    await $.store.delete(LANE_STEER_OLD + id).catch(() => undefined);
    await showLanes($, await readLanes($));
}

// the glide reorder left (dima's o138): a `lane-order:` key a board wrote before that is dropped by clio's stash, never applied
async function dropLaneOrders($: EngineInterface) {
    for (const key of await $.store.keys().catch(() => [] as string[]))
        if (key.startsWith(LANE_ORDER))
            await $.store.delete(key).catch(() => undefined);
}

// the live lanes into this session's state, only when they changed: a write redraws the board; each carries its steer
let lanesShown = '';
async function showLanes($: EngineInterface, lanes: StashLane[]) {
    const steers = await laneSteers($);
    const win = await sendWindow($);
    const live = lanes
        .filter((l) => !l.endedAt)
        .map((l) => ({
            ...l,
            isSteerTaken: steers[l.id]?.isTaken,
            steer: steers[l.id]?.steer,
        }));
    const asks: Record<string, PublishedAsk[]> = {};
    const rows = live.some((l) => Object.keys(l.members).length)
        ? await registry($).catch(() => [])
        : [];
    // each member to the session id it runs under now; the card's asks are keyed by the member as linked
    const sids = new Map<string, string>();
    for (const member of new Set(
        live.flatMap((l) => Object.values(l.members)),
    )) {
        if (member) {
            const id = await successorOf($, member);
            sids.set(member, memberOf(rows, id)?.base.sid ?? id);
        }
    }
    for (const lane of live)
        lane.memberSids = Object.fromEntries(
            Object.entries(lane.members).map(([role, m]) => [
                role,
                sids.get(m ?? '') ?? m,
            ]),
        );
    for (const [member, sid] of sids) {
        const entry = (await $.store
            .get(PREFIX + sid)
            .catch(() => undefined)) as Entry | undefined;
        const marks = await marksOf($, sid);
        asks[member] = (entry?.items ?? []).map(steered).map((a) => {
            const m = marks[a.id];
            return m
                ? {
                      ...a,
                      mark: m.mark,
                      sendAt: m.mark ? (m.markAt ?? m.at) + win : undefined,
                      steer: m.steer,
                  }
                : a;
        });
    }
    const text = JSON.stringify({ asks, live });
    if (text === lanesShown) return;
    lanesShown = text;
    await $.state.set(LANES, live).catch(() => undefined);
    await $.state.set(LANE_ASKS, asks).catch(() => undefined);
}

// a mark or steer on a member's ask from a glide card: the store holds it until the member's own stash takes it in
async function markRemote(
    $: EngineInterface,
    sid: string,
    ask: PublishedAsk,
    change: Omit<RemoteMark, 'at'>,
) {
    const key = markKey(sid, ask.id);
    // a mark saved before the steer rename reads through steered(), or a cleared steer came back from its old `note`
    const prior = steered(
        ((await $.store.get(key).catch(() => undefined)) as
            | RemoteMark
            | undefined) ?? { mark: ask.mark, steer: ask.steer },
    );
    const now = await $.clock.now();
    await $.store.set(key, {
        ...prior,
        ...change,
        at: now,
        ...('mark' in change ? { markAt: now } : {}),
    });
    await showLanes($, await readLanes($));
    if ('mark' in change)
        $.clock.after(SEND_MS, () => $.ui.invalidate('ui.render'));
}

// the lane steers dima took with 🛎️, as clio reads them; each leaves the lane once read
async function takeLaneSteers($: EngineInterface, lanes: StashLane[]) {
    const steers = await laneSteers($);
    const taken = lanes.filter((l) => !l.endedAt && steers[l.id]?.isTaken);
    if (!taken.length) return [];
    for (const l of taken) {
        await $.store.delete(LANE_STEER + l.id);
        await $.store.delete(LANE_STEER_OLD + l.id).catch(() => undefined);
    }
    await showLanes($, lanes);
    return taken.map((l) => {
        const step = `${l.id} «${l.items[l.current]?.text ?? l.title}»`;
        const steer = steers[l.id]?.steer?.trim();
        return steer
            ? `lane steer from dima on ${step}: «${steer}»`
            : `lane tick from dima on ${step}: 🛎️ good to go`;
    });
}

// the registry names the coordinator, so a handoff's new 🦉 clio keeps the lanes
async function isLaneOwner($: EngineInterface) {
    const name = await sessionName($);
    return name !== undefined && bare(name) === bare(LANE_OWNER);
}

// a clio boot whose board has not printed: the skill loaded in the last hours, no board-length reply since
async function isBootOpen($: EngineInterface) {
    if (!(await isLaneOwner($))) return false;
    const at = await $.store.get(BOOT + (await $.session.id()));
    return typeof at === 'number' && (await $.clock.now()) - at < BOOT_MS;
}

// a member's name without its leading mode emoji: «⚡ 🔧 codie: FRM-1» and «🌗 🔧 codie: FRM-1» are one member
const memberKey = (name: string) =>
    bare(name).replace(/^(?:☕️?|🌗|⚡️?|🌘|🎯)/u, '');
const bare = (name: string) => name.replaceAll(/[\s\u200d]/g, '');
// a member keeps its role through a rename (a new ticket, a new topic): its role emoji and the word before the colon
const roleKey = (name: string) => {
    const key = memberKey(name);
    const emoji = key.match(/^\p{Extended_Pictographic}\uFE0F?/u)?.[0];
    const word = key.split(':')[0]?.match(/[A-Za-z]+$/)?.[0];
    return emoji && word ? `${emoji}${word}` : undefined;
};

// a thread's asks show while it has any and they are under a day old
const isLive = (v: Entry | undefined, now: number): v is Entry =>
    !!v && Array.isArray(v.asks) && v.asks.length > 0 && now - v.at < STALE_MS;

const errorText = (err: unknown) =>
    err instanceof Error ? err.message : String(err);

// a file an ask links to opens in its app; `~/` is the home dir, the path an argv item, never a shell word
async function openPath($: EngineInterface, path: string) {
    const home = (await $.env.get('HOME')) ?? '';
    await $.process
        .run(['open', path.replace(/^~(?=\/)/, home)])
        .catch(() => undefined);
}

const basename = (path: string) =>
    path.split('/').filter(Boolean).pop() ?? path;

type Proc = { pid: number; start: string };

const short = (sid: string) => sid.slice(0, 8);

// the name ListAgents shows lives in the session registry, keyed by the claude process id
// this session's process, resolved at its first read: a hook can run before a reloaded module's session.start, where
// a module variable is still unset (clio's glide was refused after a /reload-plugins, 2026-10-12 20:05)
async function procNow($: EngineInterface) {
    proc ??= await procOf($).catch(() => undefined);
    return proc;
}

// the Stop's two reds, once a turn (FRM-427): a wrap_up ask while an orbit ask is open (PK-227, one home for the next
// move), and an orbit add opening «Q<n>» whose round the reply never printed as «❓ **Q<n>**» (the 10-25 rider); a --bg
// session draws no board, so its asks go to its coordinator and neither applies
const WRAP_UP_TOOL = 'mcp__ccd_turn__wrap_up';
async function stopRed($: EngineInterface, reply: string) {
    if (!(await partsShown($))('stash.orbit') || (await isBgSelf($)))
        return undefined;
    const open = (await currentOrbit($)).asks.filter((a) => !a.isResolved);
    const lost = gridQs.filter((n) => !reply.includes(`❓ **Q${n}**`));
    const reds = [
        isWrapAsked && open.length
            ? `your wrap_up asks dima a question while orbit holds ${open.map((a) => `${a.id} «${a.text}»`).join(', ')} open: one home for the next move — resolve or follow the orbit ask, or drop the wrap_up ask`
            : '',
        lost.length
            ? `you added ${lost.map((n) => `Q${n}`).join(', ')} to orbit, but the reply never printed ${lost.map((n) => `❓ **Q${n}**`).join(', ')}: a grill's asks go out with their round, so print the round in the reply`
            : '',
    ].filter(Boolean);
    return reds.length ? reds.join('\n') : undefined;
}

// this session's own registry entry, `~/.claude/sessions/<pid>.json`
async function selfEntry(
    $: EngineInterface,
): Promise<{ kind?: unknown; name?: unknown } | undefined> {
    const pid = (await procNow($))?.pid;
    if (!pid) return undefined;
    const home = await $.env.get('HOME');
    const raw = await $.fs
        .read(`${home}/.claude/sessions/${pid}.json`)
        .catch(() => undefined);
    if (!raw) return undefined;
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
}

async function isBgSelf($: EngineInterface) {
    return (await selfEntry($))?.kind === 'bg';
}

async function sessionName($: EngineInterface) {
    const name = (await selfEntry($))?.name;
    return typeof name === 'string' && name ? name : undefined;
}

// twin proc-of — a copy lives in x-mod-holds; the twins lint keeps them equal
async function procOf($: EngineInterface): Promise<Proc | undefined> {
    const r = await $.process.run([
        'sh',
        '-c',
        'echo $PPID; ps -o lstart= -p $PPID',
    ]);
    const [pid, start] = r.stdout.split('\n').map((s) => s.trim());
    return r.exitCode === 0 && pid && start
        ? { pid: Number(pid), start }
        : undefined;
}
// twin end

// everything this mod keeps for one conversation: one store key per prefix, the session id after it, plus its pending
// lane marks; a new per-session key joins this list, or a /clear leaves it behind for good (marks did, FRM-400)
const SESSION_KEYS = [PREFIX, HOT, REPLY, CONTEXT, MODEL, WIND] as const;

async function forget($: EngineInterface, sid: string) {
    for (const prefix of SESSION_KEYS) await $.store.delete(prefix + sid);
    for (const key of await $.store.keys())
        if (key.startsWith(`${MARKS}${sid}:`)) await $.store.delete(key);
}

// a session that exited keeps only its last reply, marked ended, so an away digest still counts it as done
async function retire($: EngineInterface, sid: string) {
    const reply = (await $.store.get(REPLY + sid)) as Reply | undefined;
    await forget($, sid);
    if (reply)
        await $.store.set(REPLY + sid, {
            ...reply,
            ended: await $.clock.now(),
        } satisfies Reply);
}

type Kept = {
    folds?: Record<string, boolean>;
    mobile?: boolean;
    orbit?: StashOrbit;
    quiet?: StashQuiet;
};
// a part at its empty value keeps nothing, so a /clear leaves no copy of the conversation it left
const isKeptBlank = (k: Kept) =>
    !(k.orbit?.asks.length || k.orbit?.assumed?.length || k.orbit?.plan) &&
    !Object.keys(k.folds ?? {}).length &&
    !k.quiet?.held.length &&
    !k.mobile;
let keptJson = '';
// every $.state part the board draws, written when one changed; a save passes its new value, since a read in the
// same dispatch still sees the old one
async function keepState($: EngineInterface, fresh: Kept = {}) {
    if (!isOrbitLoaded) return;
    const sid = await currentId($);
    if (!sid) return;
    const k: Kept = {
        folds: fresh.folds ?? (await $.state.get(FOLDS)).value,
        mobile: fresh.mobile ?? (await $.state.get(MOBILE)).value === true,
        orbit: fresh.orbit ?? (await $.state.get(ORBIT)).value,
        quiet: fresh.quiet ?? (await $.state.get(QUIET)).value,
    };
    const json = JSON.stringify([sid, k]);
    if (json === keptJson) return;
    keptJson = json;
    if (isKeptBlank(k)) await $.store.delete(KEPT + sid);
    else await $.store.set(KEPT + sid, { ...k, at: await $.clock.now() });
}

// a new process with an empty $.state takes back what its conversation kept: folds, mobile mode and held pings into
// $.state now, the orbit returned for the start to load; a lock the old process held clears at the next turn end
async function resumeState($: EngineInterface): Promise<StashOrbit> {
    const sid = await $.session.id();
    const kept = (await $.store.get(KEPT + sid)) as Kept | undefined;
    if (!kept) return EMPTY_ORBIT;
    if (kept.folds) await $.state.set(FOLDS, kept.folds);
    if (kept.mobile) await $.state.set(MOBILE, true);
    if (kept.quiet?.held.length) await $.state.set(QUIET, kept.quiet);
    return kept.orbit ? steeredOrbit(kept.orbit) : EMPTY_ORBIT;
}

// an ended session's reply is dropped a day after it ended, a kept state a week after its last save
async function pruneEnded($: EngineInterface) {
    const now = await $.clock.now();
    for (const key of await $.store.keys()) {
        if (key.startsWith(KEPT) || key.startsWith(SUCC)) {
            const v = (await $.store.get(key)) as { at?: number } | undefined;
            if (now - (v?.at ?? 0) >= KEPT_MS) await $.store.delete(key);
            continue;
        }
        if (!key.startsWith(REPLY)) continue;
        const v = (await $.store.get(key)) as Reply | undefined;
        if (v?.ended !== undefined && now - v.ended >= STALE_MS)
            await $.store.delete(key);
    }
}

// one `words:<yyyy-mm-dd>:<session>` key a day, the fleet words a reply had bolded for it, so a halt reads the hits;
// a key past WORDS_DAYS is dropped
const WORDS = 'words:';
const WORDS_DAYS = 30;
async function countWords($: EngineInterface, hits: Record<string, number>) {
    const at = await $.clock.now();
    const day = (ms: number) => new Date(ms).toLocaleDateString('sv');
    const key = `${WORDS}${day(at)}:${await $.session.id()}`;
    const was = ((await $.store.get(key)) ?? {}) as Record<string, number>;
    const next = { ...was };
    for (const [word, n] of Object.entries(hits))
        next[word] = (next[word] ?? 0) + n;
    await $.store.set(key, next);
    const oldest = `${WORDS}${day(at - WORDS_DAYS * 86_400_000)}`;
    for (const old of await $.store.keys())
        if (old.startsWith(WORDS) && old < oldest) await $.store.delete(old);
}

async function load($: EngineInterface) {
    const flag = (await $.store.get(AFK_KEY)) as { on?: boolean } | undefined;
    const wasAfk = afk;
    afk = flag?.on === true;
    // afk flipped from any board re-arms keep-hot here, since afk warms a remote-controlled session
    if (afk !== wasAfk) await armHot($);
    const waker = (await $.store.get(WAKER_KEY)) as
        | { on?: boolean }
        | undefined;
    isWaker = waker?.on === true;
    shown = shownOf(await $.store.get(SHOWN).catch(() => undefined));
    // after a /clear the process goes on under a new id, and no session.start fires
    selfId = await $.session.id().catch(() => selfId);
    selfWind = selfId ? (await windOf($, selfId))?.state : undefined;
    if (clearedFrom && selfId && selfId !== clearedFrom) {
        await $.store
            .set(SUCC + clearedFrom, { at: await $.clock.now(), sid: selfId })
            .catch(() => undefined);
        clearedFrom = undefined;
    }
    // the band's 🔭 line: what this session's last reply said it waits on
    const reply = selfId
        ? ((await $.store.get(REPLY + selfId).catch(() => undefined)) as
              | Partial<Reply>
              | undefined)
        : undefined;
    wait = reply?.wait;
    await publish($);
}

// the band's view the module's values make
function viewOf(isBoardOpen: boolean): StashView {
    return {
        afk,
        digest,
        isBoardOpen,
        isHot: Boolean(hot),
        isSettingsOpen,
        isWaker,
        selfId,
        shown,
        wait,
        wind: selfWind,
    };
}

// the store's switches, any non-boolean dropped: a broken value never hides a part
function shownOf(v: unknown): Record<string, boolean> {
    if (!v || typeof v !== 'object') return {};
    return Object.fromEntries(
        Object.entries(v).filter(([, on]) => typeof on === 'boolean'),
    );
}

// a part hidden in 🎛️ settings is off for the model too (dima, 10-12); read fresh, since another session may have
// flipped it since this one's poll
async function partsShown($: EngineInterface): Promise<IsPartOn> {
    const now = shownOf(await $.store.get(SHOWN).catch(() => undefined));
    return (key) => now[key] !== false;
}

// the orbit ops a settings switch owns: hidden, the op is refused, so no session writes what nobody sees
const OP_PART: Partial<Record<string, PartKey>> = {
    add: 'stash.orbit',
    assume: 'stash.assumed',
    follow: 'stash.orbit',
    glide: 'stash.glide',
    plan: 'stash.phases',
    resolve: 'stash.orbit',
    'second-wind': 'stash.second-wind',
};
// 🪐 orbit switched off still leaves dima's asks somewhere: the reply (o152)
const ASKS_IN_REPLY =
    '🪐 orbit is switched off in 🎛️ settings: an ask for dima goes into the reply as one ➡️ line.';

async function partRefusal($: EngineInterface, op: unknown) {
    const key = typeof op === 'string' ? OP_PART[op] : undefined;
    if (!key || (await partsShown($))(key)) return undefined;
    const label = PARTS.find((p) => p.key === key)?.label ?? key;
    return key === 'stash.orbit'
        ? `orbit ${op}: ${ASKS_IN_REPLY}`
        : `orbit ${op}: ${label} is switched off in 🎛️ settings; nothing to write`;
}

// the id a session continues under after its /clears, followed a few hops; the id itself when it never cleared
async function successorOf($: EngineInterface, sid: string) {
    let id = sid;
    for (let hop = 0; hop < 5; hop++) {
        const next = (
            (await $.store.get(SUCC + id).catch(() => undefined)) as
                | { sid?: string }
                | undefined
        )?.sid;
        if (!next || next === id) break;
        id = next;
    }
    return id;
}

async function windOf($: EngineInterface, sid: string) {
    return (await $.store.get(WIND + sid).catch(() => undefined)) as
        | StashWind
        | undefined;
}

// a board's press on a row: asks, or takes the ask back; a note already delivered is taken back at the next turn, a
// press on a cancel not yet delivered asks again, and a session already compacting goes on (no timer cancels, o2)
async function pressWind($: EngineInterface, sid: string) {
    const was = await windOf($, sid);
    const at = await $.clock.now();
    const key = WIND + sid;
    if (!was)
        await $.store.set(key, { at, state: 'asked' } satisfies StashWind);
    else if (was.state === 'asked') await $.store.delete(key);
    else if (was.state === 'writing')
        await $.store.set(key, { at, state: 'cancelled' } satisfies StashWind);
    else if (was.state === 'cancelled')
        await $.store.set(key, { at, state: 'writing' } satisfies StashWind);
    await load($);
}

// at a turn's start: the ask joins once and becomes writing; a cancel joins once and leaves
async function takeWind($: EngineInterface, isOwner: boolean) {
    const sid = await currentId($);
    const was = sid ? await windOf($, sid) : undefined;
    if (!sid || !was) return undefined;
    if (was.state === 'asked') {
        await $.store.set(WIND + sid, {
            at: await $.clock.now(),
            state: 'writing',
        } satisfies StashWind);
        return isOwner ? WIND_NOTE_OWNER : WIND_NOTE;
    }
    if (was.state === 'refused') {
        await $.store.delete(WIND + sid);
        return windRefused(was.blocked ?? 'work');
    }
    if (was.state !== 'cancelled') return undefined;
    await $.store.delete(WIND + sid);
    return WIND_CANCELLED;
}

// the op second-wind: the session names the handoff it wrote; the compact waits for this turn's end
async function windReady(
    $: EngineInterface,
    input: Record<string, unknown>,
): Promise<{ deny: string } | { result: string }> {
    const pending =
        typeof input.pending === 'string' ? input.pending.trim() : '';
    if (!pending)
        return {
            deny: 'orbit second-wind: pending is required: «none», or the work still pending (a subagent, a background job, a task not parked)',
        };
    if (pending.toLowerCase() !== 'none')
        return {
            deny: `orbit second-wind: not yet, pending: ${pending}; resolve it and park everything, then call again with pending: none`,
        };
    const name = typeof input.slug === 'string' ? input.slug.trim() : '';
    if (!/^[\w][\w.-]*$/.test(name))
        return {
            deny: 'orbit second-wind: name the handoff you just wrote, slug: "<lane or topic>-<n>"',
        };
    const home = await $.env.get('HOME');
    const peek = await $.process
        .run([`${home}/.local/bin/x`, 'handoff', 'peek', name])
        .catch(() => undefined);
    if (peek?.exitCode !== 0)
        return {
            deny: `orbit second-wind: no handoff «${name}» in the store; write it with x:handoff first`,
        };
    const sid = await currentId($);
    if (!sid) return { deny: 'orbit second-wind: this session has no id yet' };
    await $.store.set(WIND + sid, {
        at: await $.clock.now(),
        slug: name,
        state: 'refreshing',
    } satisfies StashWind);
    return {
        result: `second wind: at this turn's end the mod compacts, then ingests ${name}. end your turn now, with no «waiting on» line: the refresh runs on its own.`,
    };
}

// a compact the wind did not run (the threshold, a typed /compact) already refreshed the session: an ask or a handoff
// still being written dies with it, or the board keeps «finishing its step» forever (clio's 10-14 auto-compact, o96)
async function windOnCompact($: EngineInterface) {
    const sid = await currentId($);
    const was = sid ? await windOf($, sid) : undefined;
    if (!sid || (was?.state !== 'asked' && was?.state !== 'writing')) return;
    await $.store.delete(WIND + sid);
}

// work a session starts after it said pending: none and before the compact fires: an agent, a background command or session
const BG_SESSION = /\bclaude\b[^\n|;&]*\s--bg\b/;
function windBlocker(tool: string, input: Record<string, unknown>) {
    if (tool === 'Agent') return 'an agent';
    if (tool !== 'Bash') return undefined;
    if (input.run_in_background === true) return 'a background command';
    return typeof input.command === 'string' && BG_SESSION.test(input.command)
        ? 'a background session'
        : undefined;
}

async function windBlock($: EngineInterface, e: Record<string, unknown>) {
    const what = windBlocker(String(e.tool), e);
    const sid = what ? await currentId($) : undefined;
    const was = sid ? await windOf($, sid) : undefined;
    if (!sid || !what || was?.state !== 'refreshing' || was.blocked) return;
    await $.store.set(WIND + sid, {
        ...was,
        blocked: what,
    } satisfies StashWind);
}

// at a main turn's end: a session that named its handoff compacts onto it, then ingests it, once
async function windAfterTurn($: EngineInterface) {
    const sid = await currentId($);
    const was = sid ? await windOf($, sid) : undefined;
    if (!sid || was?.state !== 'refreshing' || !was.slug) return;
    if (!(await partsShown($))('stash.second-wind')) return;
    if (was.blocked) {
        await $.store.set(WIND + sid, {
            at: await $.clock.now(),
            blocked: was.blocked,
            state: 'refused',
        } satisfies StashWind);
        return;
    }
    const slug = was.slug;
    $.clock.after(WIND_DELAY_MS, () => runWind($, sid, slug));
}

async function runWind($: EngineInterface, sid: string, slug: string) {
    try {
        // the slug goes first, so a turn end during the compact finds nothing to run; the board keeps 🌀
        await $.store.set(WIND + sid, {
            at: await $.clock.now(),
            state: 'refreshing',
        } satisfies StashWind);
        // both queue at once: an awaited compact let a prompt dima typed during it queue ahead of the ingest (clio's
        // 19:17 press: compact 19:17, his prompt 19:19, the ingest 19:20)
        await Promise.all([
            $.command.run({
                args: `keep nothing past the handoff ${slug}; it carries the state`,
                command: 'compact',
            }),
            $.command.run({ args: slug, command: 'x:handoff-ingest' }),
        ]);
        await $.store.delete(WIND + sid);
    } catch (err) {
        await $.store.delete(WIND + sid).catch(() => undefined);
        $.ui.toast(
            `🐦‍🔥 second wind stopped: ${errorText(err)}; the handoff ${slug} is still in the store`,
        );
    }
}

// a capped session's resume, armed for the reset it waits on; a turn start or a new cap bumps capGen, so an old timer
// never fires
async function armWake($: EngineInterface) {
    const mine = ++capGen;
    const at = cap?.resetsAt;
    if (at === undefined || cap?.sentFor === at) return;
    const wait = at + WAKE_SLACK_MS - (await $.clock.now());
    $.clock.after(Math.max(0, wait), async () => {
        if (mine !== capGen || isBusy || !cap) return;
        // the reset is spent at its fire, switch on or off: ⏰ flipped on later never wakes a reset already past (o102)
        cap = { ...cap, sentFor: at };
        await $.state.set(CAP, cap).catch(() => undefined);
        const waker = (await $.store.get(WAKER_KEY)) as
            | { on?: boolean }
            | undefined;
        if (waker?.on !== true || !(await partsShown($))('stash.waker')) return;
        $.ui.log('x-mod-stash waker: resumed the session after the 5h reset');
        await selfSubmit($, RESUME);
    });
}

// the rate-limit mirror every fleet reader takes (clio's boot, the designer), in sline's old shape: seconds, and
// `null` for a window the response did not report; this mod is its one writer
async function saveUsage(
    $: EngineInterface,
    limits: { kind: string; percentUsed: number; resetsAt?: string }[],
) {
    const window = (kind: string) => {
        const w = limits.find((l) => l.kind === kind);
        return w
            ? {
                  resets_at: w.resetsAt
                      ? Math.round(Date.parse(w.resetsAt) / 1000)
                      : null,
                  used_percentage: w.percentUsed,
              }
            : null;
    };
    await $.fs.write(
        `${await $.env.get('HOME')}/.claude/shelf/cc-usage-window.json`,
        JSON.stringify({
            rate_limits: {
                five_hour: window('five_hour'),
                seven_day: window('seven_day'),
            },
            written_at: Math.round((await $.clock.now()) / 1000),
        }),
    );
}

// an idle band stays live: every session shares one 5h window, so the usage file any busy session writes carries its
// latest reading, and the minute moves the time left; written only when one of the two changed
async function freshMeter($: EngineInterface) {
    const was = (await $.state.get(METER)).value ?? {};
    const raw = await $.fs
        .read(`${await $.env.get('HOME')}/.claude/shelf/cc-usage-window.json`)
        .catch(() => undefined);
    const window = raw
        ? (
              JSON.parse(raw) as {
                  rate_limits?: {
                      five_hour?: {
                          used_percentage?: unknown;
                          resets_at?: unknown;
                      } | null;
                  };
              }
          ).rate_limits?.five_hour
        : undefined;
    const fiveHour =
        typeof window?.used_percentage === 'number'
            ? {
                  resetsAt:
                      typeof window.resets_at === 'number'
                          ? window.resets_at * 1000
                          : undefined,
                  used: window.used_percentage,
              }
            : was.fiveHour;
    const next = {
        ...was,
        fiveHour,
        minute: Math.floor((await $.clock.now()) / 60_000),
    };
    if (JSON.stringify(next) !== JSON.stringify(was))
        await $.state.set(METER, next);
}

// the engine's own compaction point as a % of the window, whatever set it: the project's override, or cc's default
async function compactAtOf($: EngineInterface, window: number) {
    // the override as cc resolves it for this session: the settings merged for its project (clio's 70 sits in
    // ~/frame/_clio/.claude/settings.json), then the process env; the engine's breakdown reports its default either way
    const merged = await $.settings.read().catch(() => undefined);
    const set =
        (typeof merged?.env === 'object' && merged.env
            ? (merged.env as Record<string, unknown>)
                  .CLAUDE_AUTOCOMPACT_PCT_OVERRIDE
            : undefined) ??
        (await $.env.get('CLAUDE_AUTOCOMPACT_PCT_OVERRIDE'));
    const override = Number(set);
    if (set !== undefined && Number.isInteger(override) && override > 0)
        return override;
    const usage = await $.session
        .usage({ breakdown: 'summary' })
        .catch(() => undefined);
    const tokens = usage?.context.breakdown?.autoCompactThreshold;
    return tokens && window ? Math.round((tokens / window) * 100) : undefined;
}

// a typed compaction point: a whole 10–99 goes into the launch dir's .claude settings `env`, keeping every
// other key; anything else, or a file that is not json, leaves the file alone and says why in one line
// typing saves each valid value as it lands; a half-typed one («8» on the way to «85») is skipped quietly, and only
// Enter names a refusal (dima, 23:31)
async function setCompactAt(
    $: EngineInterface,
    text: string,
    isTyping = false,
) {
    const was = (await $.state.get(METER)).value ?? {};
    const keep = async (note?: string) =>
        $.state
            .set(METER, { ...((await $.state.get(METER)).value ?? {}), note })
            .catch(() => undefined);
    const typed = thresholdOf(text);
    if ('refusal' in typed) {
        // a refused text takes back the saves typing made on the way to it: «10» on the way to «100»
        const t = text.trim();
        while (
            compactTrail.length > 1 &&
            t.startsWith(String(compactTrail.at(-1)))
        )
            compactTrail.pop();
        const back = compactTrail.at(-1);
        if (back !== undefined && back !== was.compactAt)
            await setCompactAt($, String(back), true);
        if (isTyping) return;
        compactTrail = [];
        return keep(typed.refusal);
    }
    if (!compactTrail.length && was.compactAt !== undefined)
        compactTrail.push(was.compactAt);
    compactTrail = isTyping ? [...compactTrail, typed.value] : [];
    // the launch dir cc keeps in the registry is the project its settings resolve from; session.start's cwd can be a
    // later one (clio's read ~/frame while it launched in ~/frame/_clio, 2026-10-09)
    const launchPid = (await procNow($))?.pid;
    const launched = launchPid
        ? await $.fs
              .read(
                  `${await $.env.get('HOME')}/.claude/sessions/${launchPid}.json`,
              )
              .then((raw) => {
                  const { cwd } = JSON.parse(raw) as { cwd?: unknown };
                  return typeof cwd === 'string' && cwd ? cwd : undefined;
              })
              .catch(() => undefined)
        : undefined;
    const dir = launched ?? projectDir;
    if (!dir) return keep('no project dir for this session');
    // a repo top's own settings.local.json outranks every subdir's, its shared settings.json does not (probed
    // 2026-10-10): the top writes the shared file, so a subdir session (clio in ~/frame/_clio) keeps its own value
    const root = (await $.session.repo().catch(() => undefined))?.root;
    const path = `${dir}/.claude/${dir === root ? 'settings.json' : 'settings.local.json'}`;
    let settings: Record<string, unknown> = {};
    if (await $.fs.exists(path)) {
        try {
            const parsed: unknown = JSON.parse(await $.fs.read(path));
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                return keep(`${path} is not a json object, left as it is`);
            settings = parsed as Record<string, unknown>;
        } catch {
            return keep(`${path} is not json, left as it is`);
        }
    }
    const env =
        settings.env && typeof settings.env === 'object'
            ? (settings.env as Record<string, unknown>)
            : {};
    await $.fs.write(
        path,
        `${JSON.stringify({ ...settings, env: { ...env, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: String(typed.value) } }, null, 2)}\n`,
    );
    await $.state
        .set(METER, { ...was, compactAt: typed.value, note: undefined })
        .catch(() => undefined);
}

let published = '';
let boardPublished = '';
// the compaction field's typing run: the value before it, then each value typing saved; Enter ends the run
let compactTrail: number[] = [];
// writes the view to $.state when it changed; every site that reads it while drawing redraws
async function publish($: EngineInterface) {
    const isBoardOpen = await isOpen($);
    // a closed board unmounts its fields: the next open draws the stored text, not a held one
    if (!isBoardOpen && drafts.size) {
        await flushFields();
        drafts.clear();
    }
    // a lane clio moved shows on this board at its next poll
    if (isBoardOpen) await showLanes($, await readLanes($));
    if (isBoardOpen) {
        // each board write redraws the pane, and the desktop then rebuilds the bars' svg in the band (a blink and a
        // restarted breath, FRM-354): it writes only when what the board shows changes — a row's facts, or a span such as
        // `busy 3m` turning its minute — never for the clock alone
        const now = await $.clock.now();
        const board = {
            at: now,
            isColour: await readSwitch($, 'colour'),
            isRing: await readSwitch($, 'ring'),
            members: await members($).catch(() => undefined),
            ...((await isLaneOwner($))
                ? {
                      staleProbes: await staleProbes($, now).catch(
                          () => undefined,
                      ),
                  }
                : {}),
        };
        const boardText = JSON.stringify({
            ...board,
            at: board.members?.map((m) =>
                m.statusSince === undefined ? null : span(now - m.statusSince),
            ),
        });
        // the poll's board redraw waits while a steer is typed into: a redraw scrolled the field back to its start
        // (dima's o8, 16:54: «far less often» after the save delay; the poll was what was left)
        if (
            boardText !== boardPublished &&
            !isTypingAt(
                [...drafts.values()].map((d) => d.at),
                // clock-ok: compared with the drafts' own Date.now() stamps, so both sides read one clock
                Date.now(),
            )
        ) {
            boardPublished = boardText;
            await $.state.set(BOARD_VIEW, board).catch(() => undefined);
        }
    }
    const view = viewOf(isBoardOpen);
    const text = JSON.stringify(view);
    if (text === published) return;
    published = text;
    await $.state
        .set(VIEW, view)
        .catch((err) =>
            $.ui.log(`x-mod-stash: the view was not kept: ${errorText(err)}`),
        );
}

async function keepTurn($: EngineInterface) {
    await $.state
        .set(TURN, { afk: turnAfk, isBusy, isPinged: pinged, isUserTurn })
        .catch(() => undefined);
}

// every turn starts here: dima's and a peer's through prompt.submit, the mod's own through selfSubmit
async function startTurn($: EngineInterface, text: string, isUser: boolean) {
    isUserTurn = isUser;
    pinged = text === PING;
    isBusy = true;
    turnTools = 0;
    isNudged = false;
    isWorkTurn = false;
    isWrapAsked = false;
    gridQs = [];
    hotGen++;
    await load($);
    turnAfk = afk;
    await keepTurn($);
}

// the mod's own prompt (the keep-hot ping, the waker's resume, a wake for marks) skips this plugin's prompt.submit hook
// (mods AGENTS, probe (d)), so its turn starts here; a submit the engine refuses leaves the session idle again
async function selfSubmit($: EngineInterface, text: string) {
    await startTurn($, text, false);
    return $.prompt.submit({ text }).catch(async (err: unknown) => {
        isBusy = false;
        await keepTurn($);
        throw err;
    });
}

// this session's id as session.start read it, else asked now; undefined when the engine cannot say
async function currentId($: EngineInterface) {
    return selfId ?? (await $.session.id().catch(() => undefined));
}

async function saveHot($: EngineInterface) {
    const sid = await currentId($);
    if (!sid) return;
    if (hot) await $.store.set(HOT + sid, hot);
    else await $.store.delete(HOT + sid);
}

// 💨 afk on keeps every remote-controlled session warm too, as if its 🔥 were on (o161): each session's own stash
// pings itself, counted from its last turn end
async function isAfkWarm($: EngineInterface) {
    if (!afk || !(await partsShown($))('stash.afk')) return false;
    const sid = await currentId($);
    return (await registry($).catch(() => [])).some(
        (r) => r.base.sid === sid && r.isBridged,
    );
}

async function armHot($: EngineInterface) {
    const mine = ++hotGen;
    if (isBusy) return;
    const now = await $.clock.now();
    const since =
        hot?.since ?? ((await isAfkWarm($)) ? (endedAt ?? now) : undefined);
    if (since === undefined) return;
    $.clock.after(Math.max(0, since + HOT_MS - now), async () => {
        if (isBusy || mine !== hotGen) return;
        if (!hot && !(await isAfkWarm($))) return;
        if (!(await partsShown($))('stash.hot')) return;
        $.ui.log('x-mod-stash keep-hot: pinged the idle session');
        await selfSubmit($, PING);
    });
}

type Member = StashMember;

// `claude-opus-5-5` + `medium` reads «opus 5.5 · medium»; a dated or `[1m]` id drops its tail, an id off the pattern shows as written
function modelLabel(model: string, effort?: string | number) {
    const m = model.match(
        /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?=$|-\d{8}|\[)/,
    );
    const name = m ? `${m[1]} ${m[2]}${m[3] ? `.${m[3]}` : ''}` : model;
    return effort === undefined ? name : `${name} · ${effort}`;
}

// the colour look, borrowed from the reference on FRM-329: calm by default, each member's dot its own hue, and a
// colour only where something is live — theme keys follow light and dark; orange stays the asks' alone
// the hues live in the palette's dot list
const HUES = PALETTE.dots;
// each member's hue: the one its name hashes to, so it holds across reloads, or the next free one when an earlier
// row took it — up to six members never share a colour
export function huesOf(names: string[]) {
    const used = new Set<number>();
    return names.map((name) => {
        let h = 0;
        for (const c of name) h = (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0;
        let at = h % HUES.length;
        for (let n = 0; n < HUES.length && used.has(at); n++)
            at = (at + 1) % HUES.length;
        used.add(at);
        return HUES[at];
    });
}
// cc's registry status: the emoji in the row's state column, its time's tint, and whether it counts as working (the
// head's «n busy»); `shell` is a long command inside a turn. the words leave the row (dima's o106, 21:17); a status cc
// adds later reads ❔, warn
const STATUS = {
    blocked: { emoji: '🚧', isWorking: false, tint: PALETTE.hot },
    busy: { emoji: '🐆', isWorking: true, tint: PALETTE.ok },
    idle: { emoji: '💤', isWorking: false, tint: undefined },
    needs_input: { emoji: '🙋', isWorking: false, tint: PALETTE.warn },
    shell: { emoji: '🐚', isWorking: true, tint: PALETTE.ok },
    waiting: { emoji: '⏳', isWorking: false, tint: PALETTE.warn },
} as const satisfies Record<
    string,
    { emoji: string; isWorking: boolean; tint: string | undefined }
>;
const isStatus = (status: string): status is keyof typeof STATUS =>
    Object.hasOwn(STATUS, status);
const statusOf = (status: string | undefined) =>
    status !== undefined && isStatus(status)
        ? { ...STATUS[status], isIdle: status === 'idle' }
        : { emoji: '❔', isIdle: false, isWorking: false, tint: PALETTE.warn };
// sline's bar ramp, yellow, orange, red, tuned to 3.2:1 or more on a light pane and 4.2:1 on a dark one
const RAMP = ['#b98500', '#d9661a', '#e5484d'] as const;
// idle only: gray, amber from 30 min, red from 45 (dima's o106)
const IDLE_WARN_MS = 30 * 60_000;
const IDLE_HOT_MS = 45 * 60_000;
// the prompt cache lives an hour: an idle row past it is cold, marked ❄️ (FRM-426, W5)
const CACHE_TTL_MS = 60 * 60_000;

// the meters: a bar of whole cells, the reading filled and one cell marked — the pace on the 5h bar, the compaction
// point on the context one; runs of one kind come out joined, so each draws as one Text
// sline's bar ramp, cell by cell — green, yellow, orange, red — so a bar warms as it fills (sline/usage.go `barRamp`)
const BAR_RAMP = [
    '#a9b665',
    '#b5ba61',
    '#c1b25d',
    '#cdac5a',
    '#d8a657',
    '#e09852',
    '#e78a4e',
    '#e87f47',
    '#e97454',
    '#ea6962',
] as const;
export type BarRun = {
    kind: 'fill' | 'empty' | 'mark';
    text: string;
    color?: string;
    tone?: 'hi';
};
// the breathing (FRM-391), dima's pick C2 (2026-10-11 12:53, kept 13:01 over C): while a turn runs most lit cells spark
// white-hot now and then and cool back through a slow afterglow, each on its own seeded period, so a few embers are always
// cooling; the bars' length, labels and values never change, a flash may tint a cell (dima's o55), and an idle bar stands
// still (no ticks, no GPU)
// dima 12:58 «speed 0.5»: 16 s, so a cell sparks every 3.2–8.8 s
const BREATH_MS = 16000;
// the spark's shape over its period: dark, a flash, a slow cool-down
const EMBER_KEYS = [0, 0.5, 0.56, 0.66, 0.8, 1] as const;
const EMBER_GLOW = [0, 0, 1, 0.6, 0.25, 0] as const;
const EMBER_COLOR = '#ffe08a';
// a seeded hash, so a cell sparks the same way on every redraw and both surfaces agree
function seeded(n: number) {
    let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 16;
    return (x >>> 0) / 2 ** 32;
}
/** a cell's spark: whether it has one, its period and its offset into it, in ms */
export function emberOf(cell: number, row: number, breathMs = BREATH_MS) {
    const k = cell * 2 + row;
    return {
        isOn: seeded(k * 3 + 1) < 0.85,
        offsetMs: seeded(k * 3 + 3) * breathMs,
        periodMs: breathMs * (0.2 + seeded(k * 3 + 2) * 0.35),
    };
}
// one bar as cells: the reading filled, one cell marked — the pace on the 5h bar, the compaction point on the context
// one; each filled cell takes the ramp by its place, so the bar warms as it fills. `scale` is the % the ramp turns red
// at: 100 for the 5h window, the compaction point for the context
export function meterCells(
    percent: number,
    width: number,
    mark?: number,
    scale = 100,
) {
    const filled = Math.min(width, Math.round((percent / 100) * width));
    const at =
        mark === undefined
            ? -1
            : Math.min(
                  width - 1,
                  Math.max(0, Math.round((mark / 100) * width)),
              );
    return Array.from({ length: width }, (_, i) => {
        const kind: BarRun['kind'] =
            i === at ? 'mark' : i < filled ? 'fill' : 'empty';
        const step = Math.floor(
            (((i + 0.5) / width) * 100 * BAR_RAMP.length) / scale,
        );
        return {
            color:
                kind === 'fill'
                    ? BAR_RAMP[Math.min(BAR_RAMP.length - 1, step)]
                    : undefined,
            kind,
        };
    });
}
// the desktop's bar in the retired breather's design language: its 5px cells, 2px gaps and light and dark palettes, the
// ramp painted through the lit cells; two cell rows tall, so it still reads as a bar
const CELL = { gap: 2, rows: 2, size: 5 } as const;
const CELL_STEP = CELL.size + CELL.gap;
export const BAR_HEIGHT = CELL.rows * CELL_STEP - CELL.gap;
const BAR_STYLE =
    ':root{color-scheme:light dark}.off{fill:#cfcfcf;opacity:.5}.mark{fill:none;stroke:#7c7670;stroke-width:1}.r0{stop-color:#7fb83a}.r1{stop-color:#f2b400}.r2{stop-color:#ff7a1a}.r3{stop-color:#f2364d}.ember{fill:#ffe08a}' +
    '@media (prefers-color-scheme:dark){.off{fill:#504945;opacity:.45}.mark{stroke:#a89984}.r0{stop-color:#a9b665}.r1{stop-color:#d8a657}.r2{stop-color:#e78a4e}.r3{stop-color:#ea6962}.ember{fill:#fff1c2}}';
export function meterSvg(
    percent: number,
    width: number,
    mark?: number,
    scale = 100,
    breathAt?: number,
    breathMs = BREATH_MS,
) {
    const w = width * CELL_STEP - CELL.gap;
    // the ramp reaches red where `scale` sits on the bar: the whole bar for the 5h window, the compaction point for ctx
    const redAt = Math.max(CELL_STEP, (Math.min(scale, 100) / 100) * w);
    // a redraw rebuilds the svg and restarts its clock: each spark's begin carries where its period stands at `breathAt`,
    // so a rebuild resumes every ember mid-flight instead of snapping back (the breather's fix, FRM-354)
    const sparkOf = (i: number, x: number, y: number, row: number) => {
        if (breathAt === undefined) return '';
        const e = emberOf(i, row, breathMs);
        if (!e.isOn) return '';
        const into = ((breathAt + e.offsetMs) % e.periodMs) / 1000;
        return `<rect class="ember" x="${x}" y="${y}" width="${CELL.size}" height="${CELL.size}" rx="1" opacity="0"><animate attributeName="opacity" values="${EMBER_GLOW.join(';')}" keyTimes="${EMBER_KEYS.join(';')}" dur="${(e.periodMs / 1000).toFixed(2)}s" begin="-${into.toFixed(2)}s" repeatCount="indefinite"/></rect>`;
    };
    const cells = meterCells(percent, width, mark, scale).flatMap((c, i) => {
        const x = i * CELL_STEP;
        // the mark is a hollow cell in the grid: a 2px bar across both rows read as a stray bar (dima's wisp, 10-28)
        return Array.from({ length: CELL.rows }, (_, r) => {
            const y = r * CELL_STEP;
            if (c.kind === 'mark')
                return `<rect class="mark" x="${x + 0.5}" y="${y + 0.5}" width="${CELL.size - 1}" height="${CELL.size - 1}" rx="1"/>`;
            return c.kind === 'fill'
                ? `<rect x="${x}" y="${y}" width="${CELL.size}" height="${CELL.size}" rx="1" fill="url(#ramp)"/>${sparkOf(i, x, y, r)}`
                : `<rect class="off" x="${x}" y="${y}" width="${CELL.size}" height="${CELL.size}" rx="1"/>`;
        });
    });
    return (
        // the desktop clamps an Svg to its slot and never stretches one: the bar is drawn a little wider than the slot and
        // squeezed in, so it always ends at the % (dima's wisp, 10-28; a `width="100%"` fell to the 300 px default)
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${BAR_HEIGHT}" viewBox="0 0 ${w} ${BAR_HEIGHT}" preserveAspectRatio="none">` +
        `<style>${BAR_STYLE}</style>` +
        `<defs><linearGradient id="ramp" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${redAt.toFixed(1)}" y2="0">` +
        '<stop class="r0" offset="0"/><stop class="r1" offset=".45"/><stop class="r2" offset=".75"/><stop class="r3" offset="1"/>' +
        '</linearGradient>' +
        `</defs>${cells.join('')}</svg>`
    );
}
// cc's effort words, low to max: a row draws its session's as that many of 5 cells, in the bars' own cells and ramp
// (dima's o4, 15:35: «b, but coloured», the 5h bar's look in one row)
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export const effortLevel = (word: string | undefined) => {
    const i = EFFORTS.indexOf(word as (typeof EFFORTS)[number]);
    return i < 0 ? undefined : i + 1;
};
export const effortCells = (level: number) =>
    meterCells((level / EFFORTS.length) * 100, EFFORTS.length);
// a session row's two meters, effort and context, in one bright look (dima, 10-13 16:50: «looks like a swamp. make
// prettier, brighter»): five steps, green, lime, amber, orange, red, never blended — an RGB mix of green and amber is
// the olive he saw; light mode takes tailwind's 600s (3:1 or more on white), dark its 400s (6:1 or more)
export const ROW_STEPS = {
    dark: ['#4ade80', '#a3e635', '#fbbf24', '#fb923c', '#f87171'],
    light: ['#16a34a', '#65a30d', '#d97706', '#ea580c', '#dc2626'],
} as const;
const TRACK = { dark: '#3a3836', light: '#e5e7eb' } as const;
const ROW_CELL = { gap: 2, size: 6 } as const;
const ROW_STEP = ROW_CELL.size + ROW_CELL.gap;
// the step at t: four below the compaction point (t < 1), red from it on
const stepOf = (t: number) => (t >= 1 ? 4 : Math.max(0, Math.floor(t * 4)));
const themed = (light: string, dark: string) =>
    `:root{color-scheme:light dark}${light}@media (prefers-color-scheme:dark){${dark}}`;
const svgOf = (w: number, h: number, style: string, body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>${style}</style>${body}</svg>`;
const NUMBER_FONT =
    'font-family="-apple-system,system-ui,sans-serif" font-size="12" font-weight="650" style="font-variant-numeric:tabular-nums"';
export function effortSvg(level: number) {
    const w = EFFORTS.length * ROW_STEP - ROW_CELL.gap;
    const css = (mode: 'light' | 'dark') =>
        `.off{fill:${TRACK[mode]}}${ROW_STEPS[mode].map((c, i) => `.e${i}{fill:${c}}`).join('')}`;
    const cells = effortCells(level).map(
        (c, i) =>
            `<rect class="${c.kind === 'fill' ? `e${i}` : 'off'}" x="${i * ROW_STEP}" y="0" width="${ROW_CELL.size}" height="${ROW_CELL.size}" rx="1.5"/>`,
    );
    return svgOf(
        w,
        ROW_CELL.size,
        themed(css('light'), css('dark')),
        cells.join(''),
    );
}
export const EFFORT_CELL = ROW_CELL.size;

const rgbOf = (hex: string) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const hexOf = (rgb: number[]) =>
    `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const mix = (a: string, b: string, t: number) => {
    const [x, y] = [rgbOf(a), rgbOf(b)];
    return hexOf(x.map((v, i) => v + ((y[i] ?? v) - v) * t));
};
// WCAG's contrast ratio of two #rrggbb colours
export function contrastOf(a: string, b: string) {
    const lum = (hex: string) => {
        const [r = 0, g = 0, bl = 0] = rgbOf(hex).map((v) => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}
// a light-pane text tint darkened until it reads at 4.5:1 on white; the dark steps read at 6:1 or more as they are
const readable = (tint: string) => {
    let c = tint;
    for (let k = 1; contrastOf(c, '#ffffff') < 4.5 && k <= 20; k++)
        c = mix(tint, '#000000', k * 0.05);
    return c;
};

// a row's context, its % merged into the meter (dima, 10-13 16:50), the meter and the % in the step the fill has reached,
// red at the session's compaction point (80 when it is unknown); two takes he switches in 🎛️ (17:00: «i like B (more
// compact) and C (more pretty)»)
const CTX_FALLBACK_AT = 80;
const ctxStyle = (
    percent: number,
    compactAt: number,
    mark: 'fill' | 'stroke',
) => {
    const i = stepOf(percent / compactAt);
    const css = (mode: 'light' | 'dark') => {
        const tint = ROW_STEPS[mode][i] ?? '';
        return `.t{${mark}:${TRACK[mode]}}.c{${mark}:${tint}}.n{fill:${mode === 'light' ? readable(tint) : tint}}`;
    };
    return themed(css('light'), css('dark'));
};
const pctOf = (percent: number) =>
    Math.min(100, Math.max(0, Math.round(percent)));
// B: the % with a 3-px bar under it, as wide as «100%»
export const CTX_BAR = { height: 18, width: 34 } as const;
export function ctxBarSvg(percent: number, compactAt = CTX_FALLBACK_AT) {
    const { height: h, width: w } = CTX_BAR;
    const p = pctOf(percent);
    const fill = (p / 100) * w;
    return svgOf(
        w,
        h,
        ctxStyle(p, compactAt, 'fill'),
        `<text class="n" x="${w}" y="10" text-anchor="end" ${NUMBER_FONT}>${p}%</text>` +
            `<rect class="t" x="0" y="14" width="${w}" height="3" rx="1.5"/>` +
            (p > 0
                ? `<rect class="c" x="0" y="14" width="${fill.toFixed(1)}" height="3" rx="1.5"/>`
                : ''),
    );
}
// C: a ring filled to the %, the % beside it
export const CTX_RING = { height: 16, width: 50 } as const;
export function ctxRingSvg(percent: number, compactAt = CTX_FALLBACK_AT) {
    const { height: h, width: w } = CTX_RING;
    const p = pctOf(percent);
    const [r, c] = [6, 8];
    const whole = 2 * Math.PI * r;
    return svgOf(
        w,
        h,
        ctxStyle(p, compactAt, 'stroke'),
        `<circle class="t" cx="${c}" cy="${c}" r="${r}" fill="none" stroke-width="3"/>` +
            (p > 0
                ? `<circle class="c" cx="${c}" cy="${c}" r="${r}" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="${((p / 100) * whole).toFixed(2)} ${whole.toFixed(2)}" transform="rotate(-90 ${c} ${c})"/>`
                : '') +
            `<text class="n" x="${w}" y="${h / 2}" dy=".35em" text-anchor="end" ${NUMBER_FONT}>${p}%</text>`,
    );
}
// the terminal's pill: five cells and the %, always 10 wide
export const ctxBar = (percent: number) => {
    const p = Math.min(100, Math.max(0, Math.round(percent)));
    const on = Math.round(p / 20);
    return `${'▮'.repeat(on)}${'▯'.repeat(5 - on)} ${`${p}%`.padStart(4)}`;
};
// a calm meter's fill: the board's green and blue mid-tones, 3.6:1 or more on white and 4.2:1 on a dark pane
const METER_TINTS = { calm5h: PALETTE.ok, calmCtx: PALETTE.calm } as const;
// the 5h window runs five hours; its pace is the share of it already gone, so a used % on pace keeps up exactly
const FIVE_HOUR_MS = 5 * 60 * 60_000;
export const paceOf = (resetsAt: number, now: number) =>
    Math.round(
        Math.min(100, Math.max(0, (1 - (resetsAt - now) / FIVE_HOUR_MS) * 100)),
    );
// used − pace: spare at 0 or under, a debt up to 10 is amber, past it red
export const gapTint = (gap: number) =>
    gap <= 0 ? METER_TINTS.calm5h : gap <= 10 ? RAMP[1] : RAMP[2];
// the context fill reads calm until 10 points short of its compaction point, then amber, red at and past it
export const contextFill = (percent: number, compactAt?: number) =>
    compactAt === undefined || percent < compactAt - 10
        ? METER_TINTS.calmCtx
        : percent < compactAt
          ? RAMP[1]
          : RAMP[2];
// a threshold dima types: a whole 10 to 99, else the one line that refuses it
export const thresholdOf = (text: string) => {
    const n = Number(text.trim());
    return Number.isInteger(n) && n >= 10 && n <= 99
        ? { value: n }
        : {
              refusal: `compaction point must be a whole 10–99, got «${text.trim()}»`,
          };
};
export const idleTint = (ms: number) =>
    ms >= IDLE_HOT_MS
        ? PALETTE.hot
        : ms >= IDLE_WARN_MS
          ? PALETTE.warn
          : undefined;

// the mark beside a row's name: ⚠ for a fault (a background name off the fleet pattern) beats ❄️ for an idle row past the cache
export const markOf = (m: {
    isIdle: boolean;
    ms: number;
    isOffPattern: boolean;
}) =>
    m.isOffPattern ? '⚠' : m.isIdle && m.ms >= CACHE_TTL_MS ? '❄️' : undefined;

const text = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

// every session whose reply ended since `since`: those that left asks first, then those that finished —
// a session the registry still shows busy has not finished; one that exited meanwhile has
async function awayDigest($: EngineInterface, since: number): Promise<Digest> {
    const needs: Digest['needs'] = [];
    const done: Digest['done'] = [];
    const keys = await $.store.keys();
    const running = new Set(
        (await registry($).catch(() => []))
            .filter((r) => r.isAlive && statusOf(r.base.status).isWorking)
            .map((r) => r.base.sid),
    );
    for (const key of keys) {
        if (!key.startsWith(PREFIX)) continue;
        const v = (await $.store.get(key)) as Entry | undefined;
        if (!v || v.at < since || !v.asks.length) continue;
        const sid = key.slice(PREFIX.length);
        needs.push({ asks: v.asks.length, name: v.name ?? short(sid), sid });
    }
    for (const key of keys) {
        if (!key.startsWith(REPLY)) continue;
        const sid = key.slice(REPLY.length);
        const v = (await $.store.get(key)) as Partial<Reply> | undefined;
        if (
            v?.at === undefined ||
            v.at < since ||
            running.has(sid) ||
            needs.some((n) => n.sid === sid)
        )
            continue;
        done.push({ name: v.name ?? short(sid), sid });
    }
    const byName = (a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name);
    return { done: done.sort(byName), needs: needs.sort(byName) };
}

type Registered = {
    pid: number;
    bg: boolean;
    isAlive: boolean;
    cwd?: string;
    startedAt?: number;
    // the desktop's own id for the session (`local_…`), which a peer's envelope or a link may carry
    hostId?: string;
    // remote control holds the session: the registry names its bridge
    isBridged?: boolean;
    base: Pick<Member, 'sid' | 'name' | 'status' | 'statusSince'>;
};

// a lane's member as the registry knows it now: by its name first — a /clear mints a new session id under the same
// name — the newest live one when two share it; else by its session id, an 8-char prefix of it, or its desktop id
// (clio's wisp, 18:01: a linked `local_` id and a /clear both left the subcard at «0 asks»)
export function memberOf(
    rows: Pick<Registered, 'base' | 'hostId' | 'isAlive' | 'startedAt'>[],
    member: string,
) {
    const live = rows.filter((r) => r.isAlive);
    const named = live
        .filter((r) => bare(r.base.name) === bare(member))
        .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))[0];
    return (
        named ??
        live.find(
            (r) =>
                r.base.sid === member ||
                r.hostId === member ||
                (member.length >= 8 && r.base.sid.startsWith(member)),
        )
    );
}

// cc's registry stores the black bird's zero-width joiner as a space: «🐦 ⬛ crow» for «🐦‍⬛ crow»
const SPLIT_CROW = '\u{1F426} \u{2B1B}';
const CROW = '\u{1F426}\u{200D}\u{2B1B}';

// every session in cc's registry and whether its process still runs; a registry file mid-write is skipped
async function registry($: EngineInterface): Promise<Registered[]> {
    const dir = `${await $.env.get('HOME')}/.claude/sessions`;
    const rows: Omit<Registered, 'isAlive'>[] = [];
    for (const f of await $.fs.list(dir)) {
        if (!f.name.endsWith('.json')) continue;
        try {
            const v = JSON.parse(await $.fs.read(`${dir}/${f.name}`)) as Record<
                string,
                unknown
            >;
            if (typeof v.pid !== 'number' || typeof v.sessionId !== 'string')
                continue;
            const bg = v.kind === 'bg';
            rows.push({
                base: {
                    name:
                        text(v.name)?.replaceAll(SPLIT_CROW, CROW) ??
                        short(v.sessionId),
                    sid: v.sessionId,
                    status: text(v.status),
                    statusSince:
                        typeof v.statusUpdatedAt === 'number'
                            ? v.statusUpdatedAt
                            : undefined,
                },
                bg,
                cwd: text(v.cwd),
                hostId: text(v.hostSessionId),
                isBridged: Boolean(text(v.bridgeSessionId)),
                pid: v.pid,
                startedAt:
                    typeof v.startedAt === 'number' ? v.startedAt : undefined,
            });
        } catch {}
    }
    if (!rows.length) return [];
    // ps prints the pids still alive and skips the rest
    const ps = await $.process.run([
        'ps',
        '-o',
        'pid=',
        '-p',
        rows.map((r) => r.pid).join(','),
    ]);
    const alive = new Set(
        ps.stdout
            .split('\n')
            .map((s) => Number(s.trim()))
            .filter(Boolean),
    );
    return rows.map((r) => ({ ...r, isAlive: alive.has(r.pid) }));
}

// a session that never ran a turn has no transcript yet: the desktop's warm spares sit in the registry like this
// (clio-9a, 2026-10-09); a missing project folder keeps the row, since cc hashes the folder name of a long path
async function isUnstarted(
    $: EngineInterface,
    home: string | undefined,
    cwd: string | undefined,
    sid: string,
) {
    if (!home || !cwd) return false;
    const dir = `${home}/.claude/projects/${cwd.replace(/[^a-zA-Z0-9]/g, '-')}`;
    return (
        (await $.fs.exists(dir).catch(() => false)) &&
        !(await $.fs.exists(`${dir}/${sid}.jsonl`).catch(() => true))
    );
}

// a session under a minute old is a probe, unless its transcript is older than its process: a resume, as every session
// is after a mac reboot (dima's ✨ wisp, 10-13 16:26: the card showed clio alone); FsStat has no birth time, so one
// `stat` asks, and only for a young row
async function isResumed(
    $: EngineInterface,
    home: string | undefined,
    r: Registered,
) {
    if (!home || !r.cwd || r.startedAt === undefined) return false;
    const path = `${home}/.claude/projects/${r.cwd.replace(/[^a-zA-Z0-9]/g, '-')}/${r.base.sid}.jsonl`;
    const out = await $.process
        .run(['stat', '-f', '%B', path])
        .catch(() => undefined);
    const born = Number(out?.stdout.trim()) * 1000;
    return born > 0 && born < r.startedAt - SHORT_MS;
}

// crow's newest 👀 «for you» line from her notes file, written today, its bold stripped (PK-73, dima 14:16: «i'd like to
// see this note somewhere in a mod», the 👀 line only, no numbers); a past day's tip is stale even under 24 h (dima, 10-13),
// and her notes print the line with or without a leading bullet
const CROW_TIP = /^(?:- )?👀 \*\*for you:\*\*\s*(.+)$/mu;
async function crowTip(
    $: EngineInterface,
    home: string | undefined,
    now: number,
) {
    const raw = await $.fs
        .read(`${home}/.local/state/crow/notes.jsonl`)
        .catch(() => '');
    for (const line of raw.trim().split('\n').reverse()) {
        try {
            const v = JSON.parse(line) as { at?: string; note?: unknown };
            const day = new Date(Date.parse(v.at ?? '')).toDateString();
            if (day !== new Date(now).toDateString()) return undefined;
            const tip =
                typeof v.note === 'string' && v.note.match(CROW_TIP)?.[1];
            if (tip) return tip.replaceAll('**', '').trim();
        } catch {}
    }
    return undefined;
}

// live sessions from the registry, each with what its own stash wrote
async function members($: EngineInterface): Promise<Member[]> {
    const out: Member[] = [];
    const now = await $.clock.now();
    const home = await $.env.get('HOME');
    const shown: Registered[] = [];
    for (const r of await registry($)) {
        if (!r.isAlive || HEADLESS.test(r.base.name)) continue;
        const isYoung =
            r.startedAt !== undefined && now - r.startedAt < SHORT_MS;
        if (isYoung && !(await isResumed($, home, r))) continue;
        shown.push(r);
    }
    const stuckMs =
        (await readNumber($, 'quietWait')) * 60_000 + QUIET_STUCK_MS;
    for (const { bg, cwd, base: r } of shown) {
        if (await isUnstarted($, home, cwd, r.sid)) continue;
        const reply = (await $.store.get(REPLY + r.sid)) as
            | Partial<Reply>
            | undefined;
        const asks = (await $.store.get(PREFIX + r.sid)) as Entry | undefined;
        const held = heldOf(await $.store.get(QUIET_HELD + r.sid));
        out.push({
            ...r,
            asks: isLive(asks, now) ? asks.asks.length : 0,
            context: (await $.store.get(CONTEXT + r.sid)) as number | undefined,
            held,
            isHeldStuck:
                !!held && now - Math.min(...held.map((p) => p.at)) > stuckMs,
            model: text(await $.store.get(MODEL + r.sid)),
            offPattern: bg && !isFleetName(r.name),
            // an idle row counts from the session's last reply, or a later keep-hot ping: cc restamps the registry
            // whenever a thread is opened, which read «idle 55m» on a thread quiet for 9 h (PK-77)
            statusSince:
                !statusOf(r.status).isWorking && reply?.at !== undefined
                    ? Math.max(reply.at, reply.pingedAt ?? reply.at)
                    : r.statusSince,
            tip: pinOf(r.name) === 1 ? await crowTip($, home, now) : undefined,
            // the band says «first +n»; the board has the room to name every wait (dima's o75)
            wait:
                reply?.waits && reply.waits.length > 1
                    ? `waiting on ${reply.waits.join('; ')}`
                    : reply?.wait,
            wind: await windOf($, r.sid),
        });
    }
    // the coordinator first, her adviser second, the rest by name
    return out.sort(
        (a, b) => pinOf(a.name) - pinOf(b.name) || a.name.localeCompare(b.name),
    );
}

// a probe mod left in `~/.claude/dev-mods/<session id>/` past its probe: a day old, or its session gone — a loaded
// probe keeps acting on live traffic (pk-93's qc-view swallowed clio's brief after its proof)
async function staleProbes($: EngineInterface, now: number) {
    const dir = `${await $.env.get('HOME')}/.claude/dev-mods`;
    const held: { sid: string; mods: string[]; at: number }[] = [];
    for (const f of await $.fs.list(dir).catch(() => [])) {
        if (f.kind !== 'dir') continue;
        const mods = (
            await $.fs.list(`${dir}/${f.name}`).catch(() => [])
        ).filter((m) => m.kind === 'dir');
        if (mods.length)
            held.push({
                at: Math.max(...mods.map((m) => m.mtimeMs)),
                mods: mods.map((m) => m.name),
                sid: f.name,
            });
    }
    if (!held.length) return [];
    const live = new Set(
        (await registry($)).filter((r) => r.isAlive).map((r) => r.base.sid),
    );
    return held
        .filter((h) => now - h.at > STALE_MS || !live.has(h.sid))
        .flatMap((h) => h.mods.map((m) => `${m} (${short(h.sid)})`));
}

const span = (ms: number) => {
    // a status stamped a moment ahead of this clock reads 0m, never -1m
    const m = Math.max(0, Math.floor(ms / 60000));
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

// each fact column's width in cells, sized to its usual reading — `🪐 12`, `FRM-306`, `ctx 54%`, `idle 12m` — so little slack shows between columns; a longer one is cut at its end
const COLUMNS = {
    asks: 4,
    // the terminal's 10-wide ctx bar; the desktop's svg takes its own width (CTX_COLUMNS)
    context: 10,
    ticket: 9,
} as const;

// the fleet's coordinator, pinned to the board's top in bold (dima, 2026-10-05)
// a member is the name's last word: a codie named «… + crow at decisions» is not crow (2026-10-10)
const isCoordinator = (name: string) => /(^|\s)clio$/.test(name);
// clio, then crow, then everyone else, the two pinned ones bold (dima, 2026-10-10)
const pinOf = (name: string) =>
    isCoordinator(name) ? 0 : /(^|\s)crow$/.test(name) ? 1 : 2;

async function isOpen($: EngineInterface) {
    const panes = await $.ui.panes().catch(() => []);
    return panes.some((p) => p.id === BOARD);
}

async function openBoard($: EngineInterface) {
    await $.ui.open({ closeOnEscape: true, id: BOARD, title: '🚦 board' });
}

// every control names itself on hover; the card stays on the control's row, since a one-row site clips the rest
// re-read before the write: another session may have flipped a part since this one's poll
async function flipPart($: EngineInterface, key: string) {
    const now = shownOf(await $.store.get(SHOWN).catch(() => undefined));
    shown = { ...now, [key]: now[key] === false };
    await $.store.set(SHOWN, shown);
    await publish($);
}

// a 🎛️ number knob's value: a whole or decimal number inside its range, else undefined — a half-typed «0.» or an out of
// range «8» on the way to nothing is never applied
function numberOf(v: unknown, range: { min: number; max: number }) {
    const text =
        typeof v === 'number'
            ? String(v)
            : typeof v === 'string'
              ? v.trim()
              : '';
    if (!/^\d+(\.\d+)?$/.test(text)) return undefined;
    const n = Number(text);
    return n >= range.min && n <= range.max ? n : undefined;
}

async function readSwitch($: EngineInterface, name: SwitchName) {
    const v = await $.store.get(SWITCHES[name].key).catch(() => undefined);
    return typeof v === 'boolean' ? v : SWITCHES[name].of;
}

// how long a mark waits in «sending» before a turn may take it: SEND_MS, or nothing with the undo window off
async function sendWindow($: EngineInterface) {
    return (await readSwitch($, 'undo'))
        ? (await readNumber($, 'undoDelay')) * 1000
        : 0;
}

async function readNumber($: EngineInterface, name: NumberName) {
    const { key, of, range } = NUMBERS[name];
    return numberOf(await $.store.get(key).catch(() => undefined), range) ?? of;
}

// the one door for every switch: a 🎛️ press and its slash command alike; the board's colour rides the view, so it
// republishes at once instead of at the next poll
async function flipKnob($: EngineInterface, name: SwitchName) {
    const isOn = !(await readSwitch($, name));
    await $.store.set(SWITCHES[name].key, isOn);
    if (name === 'colour' || name === 'ring') await publish($);
    $.ui.invalidate('ui.render');
    return isOn;
}

// a keystroke saves at once when it makes a valid value, and is never applied when it does not (exit 6)
async function setKnobNumber(
    $: EngineInterface,
    name: NumberName,
    text: string,
) {
    const n = numberOf(text, NUMBERS[name].range);
    if (n === undefined) return;
    await $.store.set(NUMBERS[name].key, n);
    $.ui.invalidate('ui.render');
}

// the 🎛️ pane's switch list: a column per group
function settingsListJSX(
    $: EngineInterface,
    ui: ReturnType<EngineInterface['ui']['resolve']>,
    shownNow: Record<string, boolean>,
    air: boolean,
) {
    const { Box, Text, Button } = ui;
    const groups = [...new Set(PARTS.map((p) => p.group))];
    return groups.map((group) => (
        <Box
            borderColor={cardBorder(air ? 'desktop' : 'terminal')}
            borderStyle='round'
            flexDirection='column'
            key={`settings:${group}`}
            paddingX={1}
            paddingY={air ? 0.5 : 0}
            rowGap={air ? 0.3 : 0}>
            <Text bold>{group}</Text>
            <Box flexDirection='column' rowGap={air ? 0.3 : 0}>
                {PARTS.filter((p) => p.group === group).map((p) => (
                    <Box flexDirection='row' key={`settings:row:${p.key}`}>
                        <Button
                            key={`part:${p.key}`}
                            onPress={() => void flipPart($, p.key)}
                            {...(shownNow[p.key] !== false
                                ? { variant: 'primary' as const }
                                : { dimColor: true })}>
                            {p.label}
                        </Button>
                    </Box>
                ))}
            </Box>
        </Box>
    ));
}

function hoverTip(
    ui: ReturnType<EngineInterface['ui']['resolve']>,
    key: string,
    words: string,
    control: RenderElement,
    place: { left: number } | { right: number },
    press?: { hotkey: string; onPress: () => void },
) {
    const { Box, Text, Button } = ui;
    return (
        <Box key={`tip:${key}`}>
            {control}
            <Box
                display='none'
                hover={{ display: 'flex' }}
                position='absolute'
                top={0}
                {...place}>
                {/* the key rides the card, not the icon: the surface draws its own key badge beside a Button with a hotkey */}
                {press ? (
                    <Button
                        dimColor
                        hotkey={press.hotkey}
                        key={`key:${key}`}
                        onPress={press.onPress}
                        plain>
                        {words}
                    </Button>
                ) : (
                    <Text dimColor>{words}</Text>
                )}
            </Box>
        </Box>
    );
}

// a reply's own 🔭 line wins; else its background tasks, the first named for the band and all of them for the board
function waitsOf(
    said: string | undefined,
    tasks: readonly BackgroundTask[] | undefined,
): Pick<Reply, 'wait' | 'waits' | 'tasks'> {
    if (said) return { wait: said };
    // a Stop may still list a task whose own status says it ended: read as the end notice would
    const ended = (status: string): BackgroundTask['state'] =>
        /^(?:completed|failed|killed|stopped)/i.test(status)
            ? /^completed/i.test(status)
                ? 'done'
                : 'failed'
            : undefined;
    const listed = tasks?.map((t) => ({
        ...t,
        state: ended((t as { status?: string }).status ?? '') ?? t.state,
    }));
    return {
        tasks: listed?.map(
            ({ agent_type, command, description, id, name, state }) => ({
                agent_type,
                command,
                description,
                id,
                name,
                ...(state ? { state } : {}),
            }),
        ),
        wait: backgroundWait(listed),
        waits: backgroundWaits(listed),
    };
}

// a background task's end notice: the task leaves the session's waits and the band reads it done or failed
async function settleTask($: EngineInterface, text: string) {
    const notice = noticeOf(text);
    if (!notice) return;
    const sid = await $.session.id();
    const was = (await $.store.get(REPLY + sid)) as Reply | undefined;
    if (!was?.tasks?.some((t) => t.id === notice.id)) return;
    const tasks = was.tasks.map((t) =>
        t.id === notice.id ? { ...t, state: notice.state } : t,
    );
    await $.store.set(REPLY + sid, {
        ...was,
        tasks,
        wait: backgroundWait(tasks),
        waits: backgroundWaits(tasks),
    } satisfies Reply);
    await load($);
}

// one orbit op, as the tool takes it alone or as one item of `ops`
async function orbitCall(
    $: EngineInterface,
    input: Record<string, unknown>,
    isAmended: boolean,
): Promise<{ result: string } | { deny: string }> {
    const hidden = await partRefusal($, input.op);
    if (hidden) return { deny: hidden };
    if (input.op === 'second-wind') {
        const r = await windReady($, input);
        return 'deny' in r ? r : { result: r.result };
    }
    if (input.op === 'glide') {
        if (!(await isLaneOwner($)))
            return {
                deny: `orbit glide: only ${LANE_OWNER} writes the lanes; every board shows them`,
            };
        const before = await readLanes($);
        // a link keeps the member's registry name, so the card finds its asks after a /clear or by a desktop id
        const linkTo =
            input.act === 'link' && typeof input.session === 'string'
                ? memberOf(await registry($), input.session.trim())?.base.name
                : undefined;
        // a create that names its lane plan takes its first steps from that file, so the card is never drawn from a guess
        let given = linkTo ? { ...input, session: linkTo } : input;
        if (input.act === 'create' && typeof input.plan === 'string') {
            if (!/^(?:\/|~\/)/.test(input.plan))
                return {
                    deny: 'orbit glide: plan is an absolute or ~/ path to the lane plan file',
                };
            const home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
            const text = await $.fs
                .read(input.plan.replace(/^~(?=\/)/, home))
                .catch(() => undefined);
            if (text === undefined)
                return {
                    deny: `orbit glide: plan file ${input.plan} cannot be read`,
                };
            const steps = planSteps(text).map((s) => ({
                done: s.isDone,
                text: [...s.text].slice(0, LANE_TEXT_MAX).join(''),
            }));
            if (!steps.length)
                return {
                    deny: `orbit glide: ${input.plan} holds no numbered step line («- [ ] 01 · text»)`,
                };
            given = { ...given, items: steps };
        }
        const op = glideOp(
            before,
            given,
            (await currentOrbit($)).turns,
            await $.clock.now(),
        );
        if ('deny' in op) return { deny: op.deny };
        // a steer was about the step it sat on: it drops when the lane's current step is another one — by its text, so
        // an edit that only moves the step keeps dima's steer
        const was = new Map(
            before.map((l) => [l.id, l.items[l.current]?.text]),
        );
        for (const l of op.lanes)
            if (was.has(l.id) && was.get(l.id) !== l.items[l.current]?.text) {
                await $.store.delete(LANE_STEER + l.id);
                await $.store
                    .delete(LANE_STEER_OLD + l.id)
                    .catch(() => undefined);
            }
        await writeLanes($, op.lanes);
        isWorkTurn = true;
        return { result: op.result };
    }
    // the turn as $.state holds it: a call that lands before a mid-turn reload's start reads a default isBusy
    const isTurn = (await $.state.get(TURN)).value?.isBusy ?? isBusy;
    const step = input.step;
    const isPlan = input.op === 'plan';
    if (
        isPlan &&
        step !== undefined &&
        !(Number.isInteger(step) && (step as number) >= 0)
    )
        return {
            deny: 'orbit plan: step is your lane step now, a whole number from 0, as your brief numbers it',
        };
    const op = orbitOp(
        await currentOrbit($),
        input,
        isTurn,
        await readNumber($, 'lines'),
        isAmended,
    );
    if ('deny' in op) return { deny: op.deny };
    await saveOrbit($, op.orbit);
    if (input.op === 'add')
        gridQs.push(
            ...(Array.isArray(input.asks) ? input.asks : []).flatMap((x) => {
                const n = oneLine((x as { text?: unknown })?.text).match(
                    /^Q(\d+)\b/,
                )?.[1];
                return n ? [n] : [];
            }),
        );
    const name = isPlan && step !== undefined && (await sessionName($));
    if (name)
        await $.store.set(LANE_STEP + bare(name), {
            at: await $.clock.now(),
            step,
        });
    return { result: op.result };
}

export const register: Register = (on) => {
    // session.start fires at startup and again on every hot reload; the classic event only at startup
    on('session.start', async ($, e, next) => {
        // the repo root, not the cwd: a cd in the shell must not rename the thread
        selfId = await $.session.id();
        // a hot reload's start carries the shell's cwd, which follows a `cd`: the root stays the project's
        projectDir = await $.session.root().catch(() => e.cwd);
        const top = (await $.session.repo())?.root ?? e.cwd;
        label = basename(top);
        proc = await procOf($).catch(() => {
            $.ui.log(
                'x-mod-stash: no pid for this session, so its row reads no registry name',
            );
            return undefined;
        });
        // what a reload finds in `$.state`, read once: every get of one dispatch reads the moment it began
        const kept = {
            cap: (await $.state.get(CAP)).value,
            ended: (await $.state.get(ENDED)).value,
            orbit: (await $.state.get(ORBIT)).value,
            turn: (await $.state.get(TURN)).value,
            view: (await $.state.get(VIEW)).value,
        };
        orbit = kept.orbit
            ? steeredOrbit(kept.orbit)
            : await resumeState($).catch(() => EMPTY_ORBIT);
        isOrbitLoaded = true;
        // a reload after the steer rename or the catch removal keeps a held text: the migrated orbit is written back once
        // through saveOrbit, so a resumed orbit's open asks reach the store every board counts from
        if (JSON.stringify(orbit) !== JSON.stringify(kept.orbit ?? EMPTY_ORBIT))
            await saveOrbit($, orbit);
        // every board reads the fleet's lanes from the shelf file: at a start, a reload, and on each poll
        lanesShown = '';
        await showLanes($, await readLanes($));
        await $.tool
            .register({
                description: ORBIT_ABOUT,
                inputSchema: {
                    properties: {
                        ...ORBIT_PROPS,
                        ops: {
                            items: { properties: ORBIT_PROPS, type: 'object' },
                            type: 'array',
                        },
                    },
                    type: 'object',
                },
                // loaded up front: behind ToolSearch a session met «add your asks to orbit» with no schema to call
                isDeferred: false,
                name: 'orbit',
            })
            .catch(() =>
                $.ui.log('x-mod-stash: the orbit tool was not registered'),
            );
        cap = kept.cap ?? undefined;
        endedAt = kept.ended ?? undefined;
        await pruneEnded($).catch(() => undefined);
        hot = (await $.store.get(HOT + selfId)) as typeof hot;
        // a mid-turn reload: the turn goes on, busy, and the band keeps what only it held
        if (kept.turn) {
            isBusy = kept.turn.isBusy;
            isUserTurn = kept.turn.isUserTurn;
            pinged = kept.turn.isPinged;
            turnAfk = kept.turn.afk;
        }
        digest = kept.view?.digest;
        // a reload unloads the old module and aborts its Haiku call, so a stored «running» is stale
        const enhancer = await enhancerOf($);
        if (enhancer.status === 'running')
            await saveEnhancer($, { ...enhancer, status: 'idle' });
        await load($);
        await armHot($);
        await armWake($);
        await $.command
            .register({
                description:
                    'open the fleet board: every live session, busy or idle, its last message; `/board colour` flips its colour',
                name: 'board',
            })
            .catch(() => $.ui.log('x-mod-stash: /board was not registered'));
        if (await isQuietHome($))
            await $.command
                .register({
                    description:
                        "quiet comms: `/quiet on` holds members' [progress] pings off this thread, `off` passes them all; bare shows it",
                    name: 'quiet',
                })
                .catch(() =>
                    $.ui.log('x-mod-stash: /quiet was not registered'),
                );
        else
            await $.command
                .register({
                    description:
                        'quiet comms canary: send clio a test [progress] ping, no model; `pnpm mods:quiet-canary` reads held → delivered',
                    name: 'quiet-canary',
                })
                .catch(() =>
                    $.ui.log('x-mod-stash: /quiet-canary was not registered'),
                );
        if (!isPolling) {
            isPolling = true;
            const tick = () =>
                $.clock.after(POLL_MS, async () => {
                    // an open board's view carries the tick's clock, so its «ago» times move on their own
                    await load($);
                    await freshMeter($).catch(() => undefined);
                    await absorbMarks($).catch(() => undefined);
                    await wakeForMarks($).catch(() => undefined);
                    await quietIdle($).catch(() => undefined);
                    await quietBooks($).catch(() => undefined);
                    await relayCrowWake($).catch(() => undefined);
                    await followCoders($).catch(() => undefined);
                    await followPlans($).catch(() => undefined);
                    // a fold or mobile mode is kept within one poll of its change
                    await keepState($).catch(() => undefined);
                    if (await isOpen($))
                        await refreshSpeaking($).catch(() => undefined);
                    tick();
                });
            tick();
        }
        return next(e);
    });

    // `/mobile-mode` turns the asks fence on, `/mobile-mode off` turns it off
    on('skill.prompt', async ($, e, next) => {
        if (BOOT_SKILL.test(e.skill) && (await isLaneOwner($)))
            await $.store
                .set(BOOT + (await $.session.id()), await $.clock.now())
                .catch(() => undefined);
        if (MOBILE_SKILL.test(e.skill))
            await $.state
                .set(MOBILE, !MOBILE_OFF.test(e.text))
                .catch(() => undefined);
        return next(e);
    });

    // only dima's own hands make his turn; a reply to any other origin may drop the block
    // a press reads what was typed: a steer still waiting for its pause saves first
    on('ui.press', async (_$, e, next) => {
        await flushFields();
        return next(e);
    });

    on('prompt.submit', async ($, e, next) => {
        await flushFields();
        // a background task's notice may reach the session as a prompt, dequeued when it went idle (the origin's docs)
        if (e.origin?.kind === 'task-notification')
            await settleTask($, e.text).catch(() => undefined);
        const isUser =
            e.text.trim().length > 0 &&
            (DIMA_ORIGINS as readonly string[]).includes(e.origin?.kind ?? '');
        if (isUser) {
            // dima read the away digest once he types again
            digest = undefined;
            // a sent box ends the enhance: ⏪ ⏩ leave the band (dima's o11, 11:11)
            const { status } = await enhancerOf($);
            await saveEnhancer($, { status });
            if (BACK_AT_MAC.test(e.text))
                await $.state.set(MOBILE, false).catch(() => undefined);
        }
        await startTurn($, e.text, isUser);
        // the clock rides every prompt, so a reply's 📄 stamp copies it instead of guessing
        const at = new Date(await $.clock.now());
        const offset = -at.getTimezoneOffset() / 60;
        const clock = `now ${at.toTimeString().slice(0, 5)} UTC${offset >= 0 ? '+' : ''}${offset}`;
        // only dima's own prompt carries his marks; each joins once and locks until the turn ends
        if (isUserTurn)
            await $.store
                .set(DIMA_AT, await $.clock.now())
                .catch(() => undefined);
        await absorbMarks($);
        await currentOrbit($);
        const isOn = await partsShown($);
        const marked =
            isUserTurn && isOn('stash.orbit') ? orbit.asks.filter(isFresh) : [];
        // an assumption dima sent back joins his prompt once and leaves orbit
        const wrong =
            isUserTurn && isOn('stash.assumed')
                ? (orbit.assumed ?? []).filter((x) => x.isWrong)
                : [];
        if (marked.length || wrong.length)
            await saveOrbit($, {
                ...lockJoined(orbit, marked),
                assumed: (orbit.assumed ?? []).filter(
                    (x) => !wrong.includes(x),
                ),
            });
        const tickets = isUserTurn ? await ticketNote($, e.text) : undefined;
        const reminder =
            (await $.state.get(MOBILE)).value || !isOn('stash.orbit')
                ? noBoardReminder(orbit, isOn)
                : orbitReminder(orbit, isOn);
        const isFirst = orbit.turns === 0 && !orbit.plan && !isPrimed;
        isPrimed = true;
        // the lanes speak only in clio's thread: a lane stale after LANE_STALE of her turns, and dima's steer on a current step
        // riding her next prompt once, from any board
        const isOwner = await isLaneOwner($);
        const laneMoves =
            isOwner && isOn('stash.glide') ? await takeLaneMoves($) : [];
        const lanes = isOwner && isOn('stash.glide') ? await readLanes($) : [];
        const live = lanes.filter((l) => !l.endedAt);
        const laneStale = live
            .filter((l) => orbit.turns - l.movedAt >= LANE_STALE)
            .map(
                (l) =>
                    `lane ${l.id} «${l.title}» moved nothing for ${orbit.turns - l.movedAt} of your turns, stale: step it or end it through ${ORBIT_TOOL} op glide.`,
            );
        const laneSteers = isUserTurn ? await takeLaneSteers($, lanes) : [];
        if (isOwner) await dropLaneOrders($);
        // dima's own prompt sends his phases mark at once, as it sends a tick still sending
        const planMark =
            isUserTurn && isOn('stash.phases') && hasPlanMark(orbit.plan)
                ? orbit.plan
                : undefined;
        if (planMark)
            await saveOrbit($, { ...orbit, plan: planTaken(planMark) });
        // held member pings ride the next prompt of any origin, once (quiet comms)
        const quiet = await quietOf($);
        if (quiet.held.length) {
            await saveQuiet($, { ...quiet, held: [] });
            await quietFlushed($, quiet.held).catch(() => undefined);
        }
        const gapNotes = isOwner ? await takeGapNotes($).catch(() => []) : [];
        // 🐦‍🔥 a board asked this session for a second wind: the note rides this turn, whatever started it
        const costHint =
            isUser && isOwner && isOn('stash.cost') && COST_WORDS.test(e.text)
                ? COST_HINT
                : undefined;
        const wind = isOn('stash.second-wind')
            ? await takeWind($, isOwner).catch(() => undefined)
            : undefined;
        return next({
            ...e,
            context: [
                ...(e.context ?? []),
                clock,
                ...(afk && isOn('stash.afk') ? [AWAY_NOTE] : []),
                ...(marked.length ? [joinText(marked)] : []),
                ...(wrong.length ? [wrongText(wrong)] : []),
                ...(isFirst && isOn('stash.phases') ? [PHASES_START] : []),
                ...(reminder ? [reminder] : []),
                ...laneStale,
                ...laneMoves,
                ...laneSteers,
                ...(planMark ? [planText(planMark)] : []),
                ...(quiet.held.length ? [quietNote(quiet.held)] : []),
                ...gapNotes,
                ...(tickets ? [tickets] : []),
                ...(wind ? [wind] : []),
                ...(costHint ? [costHint] : []),
            ],
        });
    });

    // a long turn outruns the prompt's clock: the stored reply's 📄 stamp is the time it was written
    on('session.append', { door: 'response' }, async ($, e, next) => {
        const now = new Date(await $.clock.now()).toTimeString().slice(0, 5);
        // the 🎛️ switches gate the stored rewrite, not only its look (the part list's 📌)
        const switches = shownOf(
            await $.store.get(SHOWN).catch(() => undefined),
        );
        const isOn = {
            bold: switches['stash.boldwords'] !== false,
            bullets: switches['stash.bullets'] !== false,
        };
        let isChanged = false;
        const hits: Record<string, number> = {};
        const content = e.message.content.map((b) => {
            if (b.type !== 'text' || typeof b.text !== 'string') return b;
            // the stored row is what the Stop hooks read: a ·-list fixed here never trips reply-check
            const dotted = isOn.bullets ? bulletDots(b.text) : b.text;
            const fixed = isOn.bold
                ? boldFleetWords(dotted)
                : { hits: {}, text: dotted };
            for (const [word, n] of Object.entries(fixed.hits))
                hits[word] = (hits[word] ?? 0) + n;
            const bulleted = fixed.text;
            if (bulleted !== b.text) isChanged = true;
            const text = bulleted.replace(
                STAMP,
                (whole: string, head: string, at: string) => {
                    if (at === now) return whole;
                    isChanged = true;
                    return `${head}${now}`;
                },
            );
            return { ...b, text };
        });
        if (Object.keys(hits).length)
            await countWords($, hits).catch((err) =>
                $.ui.log(
                    `x-mod-stash: the fleet-word count was not kept: ${errorText(err)}`,
                ),
            );
        if (!isChanged) return next(e);
        return next({ ...e, message: { ...e.message, content } });
    });

    // the drawing: the reply's ·-list shows as bullets while it streams, before the stored row exists
    on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
        const switches = (await $.state.get(VIEW)).value?.shown ?? {};
        const dotted =
            switches['stash.bullets'] !== false
                ? bulletDots(e.props.text)
                : e.props.text;
        // each fix is mechanical and behind its own switch; reply-check no longer logs what these redraw (todo 29)
        const fixes: [string, (t: string) => string][] = [
            ['stash.circled', numberCircled],
            ['stash.tickets', linkTickets],
            ['stash.waitaside', dropWaitAside],
        ];
        const fixed = fixes.reduce(
            (t, [key, fix]) => (switches[key] !== false ? fix(t) : t),
            dotted,
        );
        const { text } =
            switches['stash.boldwords'] !== false
                ? boldFleetWords(fixed)
                : { text: fixed };
        if (text === e.props.text) return next(e);
        return next({ ...e, props: { ...e.props, text } });
    });

    on('classic.Stop', async ($, e, next) => {
        const r = await next(e);
        if ((e.last_assistant_message ?? '').length >= BOARD_MIN)
            await $.store.delete(BOOT + e.session_id).catch(() => undefined);
        const red = e.stop_hook_active
            ? undefined
            : await stopRed($, e.last_assistant_message ?? '');
        isWrapAsked = false;
        gridQs = [];
        // a keep-hot ping's one-character reply never clears what the session waits on; it only stamps the warm cache
        const was = pinged
            ? ((await $.store
                  .get(REPLY + e.session_id)
                  .catch(() => undefined)) as Reply | undefined)
            : undefined;
        const reply: Reply | undefined = pinged
            ? was && { ...was, pingedAt: await $.clock.now() }
            : {
                  at: await $.clock.now(),
                  name: await sessionName($),
                  ...waitsOf(
                      parseWait(e.last_assistant_message ?? ''),
                      e.background_tasks,
                  ),
              };
        if (reply)
            await $.store
                .set(REPLY + e.session_id, reply)
                .catch(() => undefined);
        isUserTurn = false;
        await keepTurn($);
        await load($);
        return red ? { ...r, block: red } : r;
    });

    on('turn.complete', async ($, e, next) => {
        const r = await next(e);
        // a subagent's turn ending is not the session going idle
        if (e.agentId) return r;
        isBusy = false;
        await saveOrbit($, turnEnded(await currentOrbit($)));
        await windAfterTurn($).catch(() => undefined);
        endedAt = await $.clock.now();
        await $.state.set(ENDED, endedAt).catch(() => undefined);
        await keepTurn($);
        // a stop on the 5h cap waits for the reset; any other end clears it
        cap =
            e.reason === 'error' && CAPPED.test(e.answer)
                ? { resetsAt: fiveHourResetsAt }
                : undefined;
        await $.state.set(CAP, cap ?? null).catch(() => undefined);
        await armWake($);
        // the store is 🔥's truth: crow writes its key after session.start, and a deleted key turns it off
        const sid = await currentId($);
        if (sid)
            hot = (await $.store.get(HOT + sid).catch(() => hot)) as typeof hot;
        if (hot) {
            hot = { ...hot, since: await $.clock.now() };
            await saveHot($);
        }
        await armHot($);
        await load($);
        return r;
    });

    on('session.compact', async ($, e, next) => {
        const r = await next(e);
        if (!e.agentId && e.trigger !== 'precompute') {
            await windOnCompact($).catch(() => undefined);
            await load($);
            // a compact keeps only some skills: the full list is sent again once it ends
            $.clock.after(WIND_DELAY_MS, () =>
                $.command
                    .run({ args: '', command: 'reload-skills' })
                    .catch(() => undefined),
            );
        }
        return r;
    });

    // the context fill the board shows, and the 5h reset the waker waits on
    on('session.measure', async ($, e, next) => {
        const w = e.rateLimits.find((r) => r.kind === 'five_hour');
        const resetsAt = w?.resetsAt ? Date.parse(w.resetsAt) : undefined;
        if (resetsAt !== undefined) {
            fiveHourResetsAt = resetsAt;
            // capped before any measure named the reset: wait for this one
            if (cap && cap.resetsAt === undefined) {
                cap = { ...cap, resetsAt };
                await $.state.set(CAP, cap).catch(() => undefined);
                await armWake($);
            }
        }
        const sid = await currentId($);
        if (sid && e.context.percent !== undefined)
            await $.store
                .set(CONTEXT + sid, e.context.percent)
                .catch(() => undefined);
        if (e.changed.includes('rateLimits') && e.rateLimits.length)
            await saveUsage($, e.rateLimits).catch((err) =>
                $.ui.log(
                    `x-mod-stash: usage file not written: ${errorText(err)}`,
                ),
            );
        const was = (await $.state.get(METER)).value;
        const meter: StashMeter = {
            compactAt: e.changed.includes('context')
                ? ((await compactAtOf($, e.context.window)) ?? was?.compactAt)
                : was?.compactAt,
            context: e.context.percent,
            fiveHour: w ? { resetsAt, used: w.percentUsed } : was?.fiveHour,
            minute: was?.minute,
            note: was?.note,
        };
        // a write redraws the band, so only a reading that moved is written
        if (JSON.stringify(meter) !== JSON.stringify(was))
            await $.state.set(METER, meter).catch(() => undefined);
        return next(e);
    });

    // the board shows each session's model and effort as its main loop's last request named them; a subagent's step never counts
    on('turn.step', async function* ($, e, next) {
        if (!e.agentId) {
            const sid = await currentId($);
            const said = modelLabel(e.model, e.effort);
            if (sid && modelSeen !== `${sid}\u0000${said}`) {
                modelSeen = `${sid}\u0000${said}`;
                await $.store.set(MODEL + sid, said).catch(() => undefined);
            }
        }
        return yield* next(e);
    });

    // `/board colour` flips the colour MVP for every session's board, and opens it to look
    // quiet comms: a member's [progress] ping is held in clio's thread, every other delivery passes and is logged
    on('session.receive', async ($, e, next) => {
        const kind = e.origin.kind;
        if (kind === 'task-notification' && !e.agentId) {
            await settleTask($, e.text).catch(() => undefined);
            return next(e);
        }
        if ((kind !== 'peer' && kind !== 'peer-send-message') || e.agentId)
            return next(e);
        if (!(await isQuietHome($).catch(() => false))) return next(e);
        const { body, canary, from, tag } = peerPing(e.text);
        const marks = canary ? { canary } : {};
        let arm: QuietLogLine['arm'] = 'on';
        // fail open: a throw anywhere below passes the delivery unjudged and logs it, so a broken hold never loses a ping
        try {
            const now = await $.clock.now();
            const q = await quietOf($);
            const isOn = await readSwitch($, 'quiet');
            arm = isOn ? 'on' : 'off';
            const isMobile = (await $.state.get(MOBILE)).value === true;
            const isBusyNow =
                (await $.state.get(TURN).catch(() => undefined))?.value
                    ?.isBusy ?? isBusy;
            const sid = memberOf(await registry($), from)?.base.sid;
            const line = {
                arm,
                at: now,
                from,
                tag,
                ...(sid ? { sid } : {}),
                ...marks,
            } as const;
            if (
                isOn &&
                !isMobile &&
                tag === 'progress' &&
                !QUIET_PUSH.test(body)
            ) {
                const first =
                    body.replace(QUIET_TAG, '').trim().split('\n')[0] ?? '';
                // consumed only once both the held list and its log line landed: a ping no store holds is a lost one
                const isSaved = await saveQuiet($, {
                    ...q,
                    held: [
                        ...q.held,
                        { at: now, from, text: first.slice(0, 300), ...marks },
                    ],
                });
                if (!isSaved) throw new Error('the held list did not save');
                const isLogged = await quietLog($, {
                    ...line,
                    startedTurn: false,
                    verdict: 'held',
                });
                if (!isLogged) {
                    await saveQuiet($, q);
                    throw new Error('the held line did not log');
                }
                return {
                    consumed: `quiet comms held ${from}'s [progress] ping`,
                };
            }
            await quietLog($, {
                ...line,
                startedTurn: !isBusyNow,
                verdict: 'passed',
            });
        } catch (err) {
            await quietLog($, {
                arm,
                at: await $.clock.now().catch(() => Date.now()),
                from,
                startedTurn: false,
                tag,
                verdict: 'failed-open',
                ...marks,
            });
            $.ui.log(
                `x-mod-stash: quiet comms failed open on ${from}'s ping: ${errorText(err)}`,
            );
        }
        return next(e);
    });

    // the canary: a model-free test [progress] ping to clio through the real peer path; its run reads the log by nonce
    on('command.run', { command: 'quiet-canary' }, async ($, e) => {
        const nonce = e.args.trim() || `c${(await $.clock.now()).toString(36)}`;
        const r = await $.session
            .send({
                text: `[progress] quiet canary ${nonce}: a test ping from /quiet-canary, nothing to do`,
                to: LANE_OWNER,
            })
            .catch((err) => ({
                isDelivered: false as const,
                reason: errorText(err),
            }));
        return {
            text: r.isDelivered
                ? `quiet canary ${nonce}: sent`
                : `quiet canary ${nonce}: FAIL, ${r.reason}`,
        };
    });

    on('command.run', { command: 'quiet' }, async ($, e) => {
        const arg = e.args.trim();
        if (arg === 'on' || arg === 'off') {
            await $.store.set(QUIET_ON, arg === 'on');
            $.ui.invalidate('ui.render');
            return {
                text: `quiet comms ${arg}: ${arg === 'on' ? "members' [progress] pings wait for your next turn" : 'every member ping passes'}`,
            };
        }
        const isOn = await readSwitch($, 'quiet');
        return {
            text: `quiet comms ${isOn ? 'on' : 'off'}, ${(await quietOf($)).held.length} held; /quiet on | off${arg ? ` («${arg}» is neither)` : ''}`,
        };
    });

    on('command.run', { command: 'board' }, async ($, e) => {
        if (e.args.trim() === 'breathe') {
            const isOn = await flipKnob($, 'always');
            return {
                text: `bars breathe ${isOn ? 'all the time' : 'only while a turn runs'}`,
            };
        }
        const isColourFlip = /^colou?r$/.test(e.args.trim());
        const isColour = isColourFlip ? await flipKnob($, 'colour') : undefined;
        await openBoard($);
        await publish($);
        if (isColour === undefined) return { text: 'fleet board opened' };
        return { text: `fleet board colour ${isColour ? 'on' : 'off'}` };
    });

    // the row's 🚦 shows whether the board is open
    on('ui.close', async ($, e, next) => {
        const r = await next(e);
        if (e.id === BOARD) await publish($);
        if (e.id === SETTINGS_PANE) {
            isSettingsOpen = false;
            await publish($);
        }
        return r;
    });

    // 🎛️: the switch list, then the auto-compact point, in a pane of its own (dima's pick a, 16:20)
    on(
        'ui.render',
        { component: 'Pane', requestId: SETTINGS_PANE },
        async ($, e) => {
            try {
                return cleanTree(
                    await (async () => {
                        const ui = $.ui.resolve(e);
                        const { Box, Text, Button } = ui;
                        const meter = (await $.state.get(METER)).value;
                        // mobile draws no Input
                        const Input = 'Input' in ui ? ui.Input : undefined;
                        // the knobs: a switch saves on its press, a number on each keystroke that makes a valid value
                        const knobs = {
                            always: await readSwitch($, 'always'),
                            breathe: await readSwitch($, 'breathe'),
                            colour: await readSwitch($, 'colour'),
                            guard: !(await readSwitch($, 'silent')),
                            lines: await readNumber($, 'lines'),
                            quiet: await readSwitch($, 'quiet'),
                            quietWait: await readNumber($, 'quietWait'),
                            ring: await readSwitch($, 'ring'),
                            speak: await readSwitch($, 'speak'),
                            speed: await readNumber($, 'speed'),
                            undo: await readSwitch($, 'undo'),
                            undoDelay: await readNumber($, 'undoDelay'),
                        };
                        const switchJSX = (
                            name: SwitchName,
                            label: string,
                            isOn: boolean,
                        ) => (
                            <Box
                                flexDirection='row'
                                key={`knob:${SWITCHES[name].key}`}>
                                <Button
                                    key={`knob:${SWITCHES[name].key}`}
                                    onPress={() => void flipKnob($, name)}
                                    {...(isOn
                                        ? { variant: 'primary' as const }
                                        : { dimColor: true })}>
                                    {label}
                                </Button>
                            </Box>
                        );
                        const numberJSX = (
                            name: NumberName,
                            label: string,
                            value: number,
                            unit: string,
                        ) => {
                            const { key, range } = NUMBERS[name];
                            return Input ? (
                                <Box
                                    alignItems='center'
                                    flexDirection='row'
                                    gap={1}
                                    key={`knob:${key}`}>
                                    {label ? <Text>{label}</Text> : null}
                                    <Box flexShrink={0} width={8}>
                                        <Input
                                            key={
                                                field(
                                                    $,
                                                    `knob:${key}`,
                                                    String(value),
                                                ).key
                                            }
                                            onInput={(text) => {
                                                field(
                                                    $,
                                                    `knob:${key}`,
                                                    String(value),
                                                ).type(text, () => {
                                                    return setKnobNumber(
                                                        $,
                                                        name,
                                                        text,
                                                    );
                                                });
                                            }}
                                            onSubmit={(text) =>
                                                void setKnobNumber(
                                                    $,
                                                    name,
                                                    text,
                                                )
                                            }
                                            value={
                                                field(
                                                    $,
                                                    `knob:${key}`,
                                                    String(value),
                                                ).value
                                            }
                                        />
                                    </Box>
                                    <Text
                                        dimColor>{`${unit} (${range.min}–${range.max})`}</Text>
                                </Box>
                            ) : null;
                        };
                        const air = e.surface === 'desktop';
                        const knobsJSX = (
                            <Box
                                borderColor={cardBorder(e.surface)}
                                borderStyle='round'
                                flexDirection='column'
                                key='settings:knobs'
                                paddingX={1}
                                paddingY={air ? 0.5 : 0}
                                rowGap={air ? 0.3 : 0}>
                                <Text bold>stash · knobs</Text>
                                {switchJSX(
                                    'colour',
                                    '🎨 board colour',
                                    knobs.colour,
                                )}
                                {/* one of two shapes, so two buttons, the one in use lit (dima, 10-13 17:45) */}
                                <Box
                                    alignItems='center'
                                    flexDirection='row'
                                    gap={1}
                                    key='knob:ctx-shape'>
                                    <Text>🧠 sessions: ctx meter type</Text>
                                    {(
                                        [
                                            ['ring', '◯ ring', true],
                                            ['bar', '▬ bar', false],
                                        ] as const
                                    ).map(([shape, label, isRing]) => {
                                        return (
                                            <Button
                                                key={`knob:ctx-${shape}`}
                                                onPress={() =>
                                                    void (knobs.ring === isRing
                                                        ? undefined
                                                        : flipKnob($, 'ring'))
                                                }
                                                {...(knobs.ring === isRing
                                                    ? {
                                                          variant:
                                                              'primary' as const,
                                                      }
                                                    : { dimColor: true })}>
                                                {label}
                                            </Button>
                                        );
                                    })}
                                </Box>
                                {numberJSX(
                                    'lines',
                                    '🌔 phase lines',
                                    knobs.lines,
                                    'lines',
                                )}
                                {/* the toggle and its seconds on one line, as phase lines reads (dima, 10-13 18:14) */}
                                <Box
                                    alignItems='center'
                                    flexDirection='row'
                                    gap={1}
                                    key='knob:undo-row'>
                                    {switchJSX(
                                        'undo',
                                        '📨 undo tick',
                                        knobs.undo,
                                    )}
                                    {knobs.undo
                                        ? numberJSX(
                                              'undoDelay',
                                              '',
                                              knobs.undoDelay,
                                              's',
                                          )
                                        : null}
                                </Box>
                                {switchJSX(
                                    'speak',
                                    '🔊 read-aloud on assumptions',
                                    knobs.speak,
                                )}
                                {/* the switch reads «shown» while lit, so it flips the stored «silent» the other way */}
                                <Box
                                    flexDirection='row'
                                    key='knob:guard-silent'>
                                    <Button
                                        key='knob:guard-silent'
                                        onPress={() =>
                                            void flipKnob($, 'silent')
                                        }
                                        {...(knobs.guard
                                            ? { variant: 'primary' as const }
                                            : { dimColor: true })}>
                                        🛡️ guard notes to the model
                                    </Button>
                                </Box>
                            </Box>
                        );
                        // the bars' animation, its own card at the pane's bottom beside the context (dima, 18:06)
                        const barsJSX = (
                            <Box
                                borderColor={cardBorder(e.surface)}
                                borderStyle='round'
                                flexDirection='column'
                                flexGrow={1}
                                key='settings:bars'
                                paddingX={1}
                                paddingY={air ? 0.5 : 0}
                                rowGap={air ? 0.3 : 0}
                                width={0}>
                                <Text bold>🔥 bars</Text>
                                {switchJSX(
                                    'breathe',
                                    '🔥 bars breathe while a turn runs',
                                    knobs.breathe,
                                )}
                                {switchJSX(
                                    'always',
                                    '🔥 bars breathe all the time',
                                    knobs.always,
                                )}
                                {numberJSX(
                                    'speed',
                                    '🔥 breath speed',
                                    knobs.speed,
                                    '×',
                                )}
                            </Box>
                        );
                        // quiet comms' own card: the wait before an idle append (dima's brief 5, 16:53)
                        const quietJSX = (
                            <Box
                                borderColor={cardBorder(e.surface)}
                                borderStyle='round'
                                flexDirection='column'
                                flexGrow={1}
                                key='settings:quiet'
                                paddingX={1}
                                paddingY={air ? 0.5 : 0}
                                rowGap={air ? 0.3 : 0}
                                width={0}>
                                <Text bold>🤫 quiet comms</Text>
                                {switchJSX(
                                    'quiet',
                                    "🤫 hold members' [progress] pings",
                                    knobs.quiet,
                                )}
                                {numberJSX(
                                    'quietWait',
                                    '🤫 held pings wait',
                                    knobs.quietWait,
                                    'min',
                                )}
                            </Box>
                        );
                        // the auto-compact point lives only in 🎛️, its last section (dima, 15:35: «move full autocompact part to settings»)
                        const compactJSX = Input ? (
                            <Box
                                borderColor={cardBorder(e.surface)}
                                borderStyle='round'
                                flexDirection='column'
                                flexGrow={1}
                                key='settings:compact'
                                paddingX={1}
                                paddingY={e.surface === 'desktop' ? 0.5 : 0}
                                width={0}>
                                <Text bold>context</Text>
                                <Box
                                    alignItems='center'
                                    flexDirection='row'
                                    gap={1}>
                                    <Text>📦 auto-compact at</Text>
                                    <Box flexShrink={0} width={8}>
                                        <Input
                                            key={
                                                field(
                                                    $,
                                                    'compact-at',
                                                    meter?.compactAt ===
                                                        undefined
                                                        ? ''
                                                        : String(
                                                              meter.compactAt,
                                                          ),
                                                ).key
                                            }
                                            onInput={(value) => {
                                                field(
                                                    $,
                                                    'compact-at',
                                                    meter?.compactAt ===
                                                        undefined
                                                        ? ''
                                                        : String(
                                                              meter.compactAt,
                                                          ),
                                                ).type(value, () => {
                                                    return setCompactAt(
                                                        $,
                                                        value,
                                                        true,
                                                    );
                                                });
                                            }}
                                            onSubmit={(value) =>
                                                void setCompactAt($, value)
                                            }
                                            placeholder='70'
                                            value={
                                                field(
                                                    $,
                                                    'compact-at',
                                                    meter?.compactAt ===
                                                        undefined
                                                        ? ''
                                                        : String(
                                                              meter.compactAt,
                                                          ),
                                                ).value
                                            }
                                        />
                                    </Box>
                                    <Text dimColor>
                                        % of the context window
                                    </Text>
                                </Box>
                            </Box>
                        ) : null;
                        return (
                            // two columns of cards, the switches left and the knobs right (dima, 17:42); the bars and the context sit at the
                            // pane's bottom, side by side, a gap growing above them as the phases do on the board (dima, 18:06)
                            <Box
                                flexDirection='column'
                                gap={1}
                                key='settings:view'
                                minHeight={
                                    e.props.placement === 'dock'
                                        ? e.props.scroll.bodyRows
                                        : undefined
                                }>
                                <Box
                                    flexDirection='row'
                                    gap={1}
                                    key='settings:columns'>
                                    <Box
                                        flexDirection='column'
                                        flexGrow={1}
                                        gap={1}
                                        width={0}>
                                        {settingsListJSX(
                                            $,
                                            ui,
                                            (await $.state.get(VIEW)).value
                                                ?.shown ?? {},
                                            e.surface === 'desktop',
                                        )}
                                    </Box>
                                    <Box
                                        flexDirection='column'
                                        flexGrow={1}
                                        gap={1}
                                        width={0}>
                                        {knobsJSX}
                                    </Box>
                                </Box>
                                <Box flexGrow={1} key='settings:gap' />
                                <Box
                                    flexDirection='row'
                                    gap={1}
                                    key='settings:bottom'>
                                    {barsJSX}
                                    {quietJSX}
                                    {compactJSX}
                                </Box>
                            </Box>
                        );
                    })(),
                );
            } catch (err) {
                $.ui.log(
                    `x-mod-stash: the settings failed to draw: ${String(err)}`,
                );
                const { Box, Text } = $.ui.resolve(e);
                return cleanTree(
                    <Box>
                        <Text color='error'>
                            ⚠️ x-mod-stash: the settings failed to draw, the
                            debug log names why
                        </Text>
                    </Box>,
                );
            }
        },
    );

    on('ui.render', { component: 'Pane', requestId: BOARD }, async ($, e) => {
        try {
            return cleanTree(
                await (async () => {
                    const ui = $.ui.resolve(e);
                    const { Box, Text, Button, Link } = ui;
                    const Svg =
                        e.surface === 'desktop' && 'Svg' in ui
                            ? ui.Svg
                            : undefined;
                    // the poll read the registry into the view; the pane only draws it, so a draw costs no file or process read
                    const board = (await $.state.get(BOARD_VIEW)).value;
                    const now = board?.at ?? 0;
                    const me = (await $.state.get(VIEW)).value?.selfId;
                    // the board's lower half: this session's orbit and its plan, read here so a mark or a tool call redraws it
                    const o = (await $.state.get(ORBIT)).value ?? orbit;
                    // mobile draws no Input: its steers wait for another surface
                    const Input = 'Input' in ui ? ui.Input : undefined;
                    const open = o.asks.filter((a) => !a.isResolved);
                    const age = planAge(o);
                    // 🛎️ and ↩️ are one toggle each, side by side at the row's left: lit while it holds, plain while it does not
                    // an ask card's door: this session's own orbit by default; a glide card passes the member's, through the store
                    const drawnAt = await $.clock.now();
                    // a press starts the 5 s «sending» window (PK-88); a second press inside it unsends, and one redraw shows it sent
                    const ownDoor: AskDoor = {
                        mark: (a, mark) =>
                            void (async () => {
                                const now = await $.clock.now();
                                const win = await sendWindow($);
                                await markAsks(
                                    $,
                                    (x) => {
                                        if (x.id !== a.id) return x;
                                        const isOff = x.mark === mark;
                                        return {
                                            ...x,
                                            isChanged: false,
                                            mark: isOff ? undefined : mark,
                                            sendAt:
                                                isOff || !win
                                                    ? undefined
                                                    : now + win,
                                        };
                                    },
                                    true,
                                );
                                await tickAsk($, a.id);
                                if (win)
                                    $.clock.after(win, () =>
                                        $.ui.invalidate('ui.render'),
                                    );
                            })(),
                        prefix: 'orbit',
                        steer: (a, value) => handleSteer(a.id, value),
                    };
                    const markJSX = (
                        a: OrbitAsk,
                        mark: 'accepted' | 'rejected',
                        door: AskDoor = ownDoor,
                    ) => (
                        <Button
                            key={`${door.prefix}:${mark}:${a.id}`}
                            onPress={() => door.mark(a, mark)}
                            // take is always the filled button (dima, 17:08); a held mark swaps its emoji for ✅, so the size never
                            // changes (dima's o7, 17:16) — one mark per ask, so only one of the two ever shows ✅
                            {...(mark === 'accepted'
                                ? { variant: 'primary' as const }
                                : {})}>
                            {`${a.mark === mark ? (a.isLocked ? '🔓' : isSending(a, drawnAt) ? '📨' : '✅') : mark === 'accepted' ? '🛎️' : '🔁'} ${mark === 'accepted' ? 'tick' : 'replay'}`}
                        </Button>
                    );
                    const handleAssumedSteer = (id: string, value: string) =>
                        void changeAssumed($, (y) =>
                            y.id === id ? { ...y, steer: steerOf(value) } : y,
                        );
                    // the steer keeps every keystroke, no Enter needed
                    const handleSteer = (id: string, value: string) =>
                        void markAsks($, (x) =>
                            x.id === id ? { ...x, steer: steerOf(value) } : x,
                        );
                    // a locked ask is the running turn's: no control at all, its mark and steer as dim text (the api has no disabled)
                    // speak reads, pauses or stops through its control socket: a mod's text can't be selected for F4 on the desktop
                    // (claude-code#101090) — a workaround, see mods/workarounds.md
                    const boardShown =
                        (await $.state.get(VIEW)).value?.shown ?? {};
                    const isPartOn = (key: string) => boardShown[key] !== false;
                    const speakAssumed = await readSwitch($, 'speak');
                    const folds = (await $.state.get(FOLDS)).value ?? {};
                    // one fold rule for every card: open until folded, but a glide card's member subcard starts folded to its count
                    const foldedOf = (
                        kept: Record<string, boolean>,
                        card: string,
                    ) =>
                        kept[card] ??
                        /^(lane:[^:]+:(codie|sixth-sense|coder|verifier)|quiet:.+)$/.test(
                            // read-both
                            card,
                        );
                    const flipFold = async (card: string) => {
                        const was = (await $.state.get(FOLDS)).value ?? {};
                        await $.state.set(FOLDS, {
                            ...was,
                            [card]: !foldedOf(was, card),
                        });
                    };
                    const isFolded = (card: string) => foldedOf(folds, card);
                    // 📂 sits at the far right of each card's head line and folds the card to that line, then reads 📁 (dima's o5, 17:21)
                    const foldJSX = (card: string) => (
                        <Button
                            key={`fold:${card}`}
                            onPress={async () => {
                                // a fold remounts its fields: they draw the stored text again
                                await flushFields();
                                drafts.clear();
                                const was =
                                    (await $.state.get(FOLDS)).value ?? {};
                                await $.state.set(FOLDS, {
                                    ...was,
                                    [card]: !foldedOf(was, card),
                                });
                            }}
                            plain>
                            {isFolded(card) ? '📁' : '📂'}
                        </Button>
                    );
                    // every card's frame; a card adds its key, its margin and its row gap
                    const cardProps = {
                        borderColor: cardBorder(e.surface),
                        borderStyle: 'round',
                        flexDirection: 'column',
                        paddingX: 1,
                        paddingY: 0.5,
                    } as const;
                    // ⏸️ while speak reads, ▶️ when it is paused or quiet: a press pauses, resumes, or reads this row (dima, 15:51)
                    const isSpeaking =
                        (await $.state.get(SPEAKING)).value === true;
                    // an ask's one link: an https url opens as a link, a file path or an obsidian:// url through `open` (a mod Link takes https only)
                    const askLinkJSX = (id: string, target: string) => {
                        return target.startsWith('https://') ? (
                            <Link href={target} key={`ask:link:${id}`}>
                                {`🔗 ${target.slice('https://'.length).split('/')[0]}`}
                            </Link>
                        ) : (
                            <Button
                                key={`ask:link:${id}`}
                                onPress={() => void openPath($, target)}
                                plain>
                                {`🔗 ${linkLabel(target)}`}
                            </Button>
                        );
                    };
                    const speakJSX = (id: string, text: string) =>
                        !isPartOn('stash.speak')
                            ? []
                            : [
                                  <Button
                                      key={`orbit:read:${id}`}
                                      onPress={() =>
                                          void speak($, {
                                              op: 'read',
                                              text,
                                          }).then(() => refreshSpeaking($))
                                      }
                                      plain>
                                      🔊
                                  </Button>,
                                  <Button
                                      key={`orbit:pause:${id}`}
                                      onPress={() => void playPress($, text)}
                                      plain>
                                      {isSpeaking ? '⏸️' : '▶️'}
                                  </Button>,
                                  <Button
                                      key={`orbit:stop:${id}`}
                                      onPress={() =>
                                          void speak($, { op: 'stop' }).then(
                                              () => refreshSpeaking($),
                                          )
                                      }
                                      plain>
                                      ⏹️
                                  </Button>,
                              ];
                    // a ticket id in an ask or a phase opens its linear page, as a session row's does (dima's o62, 22:13)
                    const linkedJSX = (text: string, key: string) =>
                        text.split(TICKET_IDS).map((part, i) => {
                            if (i % 2 === 0) return part;
                            return (
                                <Link
                                    href={`https://linear.app/x-com/issue/${part}`}
                                    key={`${key}:${i}`}>
                                    {part}
                                </Link>
                            );
                        });
                    // the ask on its own line, the bold id leading it; under it one row: the steer, 🛎️ ↩️, then speak's 🔊 ⏯ ⏹
                    // (dima, 20:08); a full row of air between asks (dima, 19:52)
                    // an ask resolved with a closing word draws dim, the word after its text and no controls, for its turn and one more
                    // no card: its emoji from the word and the ask on one line, the word under it, dim and whole (dima's shots,
                    // 20:37 and 10-13 18:20: on one line the word got cut)
                    const closedJSX = (
                        a: OrbitAsk,
                        i: number,
                        door: AskDoor,
                    ) => (
                        <Box
                            flexDirection='column'
                            key={`${door.prefix}:ask:${a.id}`}
                            marginTop={i > 0 ? 0.5 : 0}
                            paddingX={1}>
                            <Text dimColor wrap='truncate-end'>
                                {`${closedMark(a.word ?? '')} ${a.id}: ${a.text}`}
                            </Text>
                            <Text bold dimColor>
                                {`➡️ ${a.word}`}
                            </Text>
                        </Box>
                    );
                    const askJSX = (
                        a: OrbitAsk,
                        i: number,
                        door: AskDoor = ownDoor,
                    ) =>
                        a.word ? (
                            closedJSX(a, i, door)
                        ) : (
                            <Box
                                borderDimColor
                                borderStyle='round'
                                flexDirection='column'
                                key={`${door.prefix}:ask:${a.id}`}
                                marginTop={i > 0 ? 0.5 : 0}
                                paddingX={1}
                                rowGap={LINE_GAP}>
                                <Box flexDirection='row' gap={1}>
                                    <Box
                                        flexDirection='column'
                                        flexGrow={1}
                                        flexShrink={1}
                                        minWidth={0}
                                        rowGap={LINE_GAP}>
                                        {/* the id and the pick bold, so the proposal stands out (dima, 20:30) */}
                                        {/* an ask answered this turn leads its line with 👀 until the turn ends — inline, so the row keeps its left
                                edge; a hover card would need a box of its own (dima, 20:34, 20:39) */}
                                        <Text>
                                            {a.isResolved ? '👀 ' : ''}
                                            {/* a joined ask's mark leads its line, so the row below holds only 🔊 and the steer (dima, 11:57) */}
                                            {a.isChanged
                                                ? `${CHANGED_MARK} `
                                                : ''}
                                            <Text bold>{a.id}</Text>
                                            {': '}
                                            {linkedJSX(a.text, `ask:${a.id}`)}
                                        </Text>
                                        {/* the pick on a line of its own, the mock's card shape (dima, 17:00) */}
                                        <Text>
                                            {'➡️ '}
                                            <Text bold>
                                                {linkedJSX(
                                                    a.pick,
                                                    `pick:${a.id}`,
                                                )}
                                            </Text>
                                        </Text>
                                    </Box>
                                </Box>
                                {/* the buttons lead, the steer follows them, on the line under the pick — never beside it (dima, 20:19; 20:23) */}
                                <Box
                                    alignItems='center'
                                    flexDirection='row'
                                    gap={1}
                                    key={`${door.prefix}:row:${a.id}`}>
                                    {/* a joined ask keeps both buttons; the held one reads 🔓 while the turn holds it (dima, 17:42) */}
                                    {[
                                        markJSX(a, 'accepted', door),
                                        markJSX(a, 'rejected', door),
                                    ]}
                                    {/* reading aloud edits nothing, so a locked row keeps 🔊 ⏯️ ⏹️ (dima, 20:25) */}
                                    {/* 🔊 reads what the card shows, no «pick» word (dima, 17:14) */}
                                    {speakJSX(a.id, `${a.text}. ${a.pick}`)}
                                    {a.isLocked ? (
                                        a.steer ? (
                                            <Box flexShrink={1} minWidth={0}>
                                                <Text
                                                    dimColor
                                                    wrap='truncate-end'>
                                                    {/* a sent steer leads with 💬, drawn for dima only: the model gets «his steer: …» (dima, 18:14) */}
                                                    {`💬 «${a.steer}»`}
                                                </Text>
                                            </Box>
                                        ) : null
                                    ) : Input ? (
                                        <Box
                                            flexGrow={1}
                                            flexShrink={1}
                                            minWidth={0}>
                                            <Input
                                                key={
                                                    field(
                                                        $,
                                                        `${door.prefix}:steer:${a.id}`,
                                                        a.steer ?? '',
                                                    ).key
                                                }
                                                onInput={(value: string) => {
                                                    field(
                                                        $,
                                                        `${door.prefix}:steer:${a.id}`,
                                                        a.steer ?? '',
                                                    ).type(value, () => {
                                                        return door.steer(
                                                            a,
                                                            value,
                                                        );
                                                    });
                                                }}
                                                onSubmit={(value: string) =>
                                                    door.steer(a, value)
                                                }
                                                placeholder='steer'
                                                value={
                                                    field(
                                                        $,
                                                        `${door.prefix}:steer:${a.id}`,
                                                        a.steer ?? '',
                                                    ).value
                                                }
                                            />
                                        </Box>
                                    ) : null}
                                    {/* the steer comes first, the file link after it, at the row's end (dima's shot, 20:57) */}
                                    {a.link ? askLinkJSX(a.id, a.link) : null}
                                </Box>
                            </Box>
                        );
                    const orbitJSX = drawn('orbit', () => (
                        <Box
                            key='orbit'
                            {...cardProps}
                            marginTop={1}
                            rowGap={0.5}>
                            <Box
                                flexDirection='row'
                                justifyContent='space-between'>
                                <Text bold>🪐 orbit</Text>
                                <Box
                                    alignItems='center'
                                    flexDirection='row'
                                    gap={1}>
                                    {open.some(
                                        (a) => !a.mark && !a.isLocked,
                                    ) ? (
                                        <Button
                                            key='orbit:all'
                                            onPress={() =>
                                                void markAsks(
                                                    $,
                                                    (x) =>
                                                        x.mark
                                                            ? x
                                                            : {
                                                                  ...x,
                                                                  isChanged: false,
                                                                  mark: 'accepted',
                                                              },
                                                    true,
                                                )
                                            }
                                            plain>
                                            ✅
                                        </Button>
                                    ) : null}
                                    {foldJSX('orbit')}
                                </Box>
                            </Box>
                            {/* an answered ask stays until its turn ends, so dima sees it go */}
                            {isFolded('orbit')
                                ? null
                                : o.asks.map((a, i) => askJSX(a, i))}
                            {!isFolded('orbit') &&
                            o.assumed?.length &&
                            isPartOn('stash.assumed') ? (
                                <Box
                                    flexDirection='column'
                                    key='orbit:assumed'
                                    marginTop={1}
                                    rowGap={LINE_GAP}>
                                    <Text bold>assumed</Text>
                                    {o.assumed.map((x) => {
                                        return (
                                            <Box
                                                flexDirection='column'
                                                key={`orbit:assumption:${x.id}`}
                                                rowGap={LINE_GAP}>
                                                <Text>
                                                    <Text bold>{x.id}</Text>
                                                    {`: ${x.text}`}
                                                </Text>
                                                <Box
                                                    alignItems='center'
                                                    flexDirection='row'
                                                    gap={1}>
                                                    <Button
                                                        key={`orbit:right:${x.id}`}
                                                        onPress={() =>
                                                            void changeAssumed(
                                                                $,
                                                                (y) =>
                                                                    y.id ===
                                                                    x.id
                                                                        ? undefined
                                                                        : y,
                                                                true,
                                                            )
                                                        }
                                                        plain>
                                                        🛎️
                                                    </Button>
                                                    <Button
                                                        key={`orbit:wrong:${x.id}`}
                                                        onPress={() =>
                                                            void changeAssumed(
                                                                $,
                                                                (y) =>
                                                                    y.id ===
                                                                    x.id
                                                                        ? {
                                                                              ...y,
                                                                              isWrong:
                                                                                  !y.isWrong,
                                                                          }
                                                                        : y,
                                                                true,
                                                            )
                                                        }
                                                        {...(x.isWrong
                                                            ? {
                                                                  variant:
                                                                      'secondary' as const,
                                                              }
                                                            : {
                                                                  plain: true as const,
                                                              })}>
                                                        ↩️
                                                    </Button>
                                                    {speakAssumed
                                                        ? speakJSX(x.id, x.text)
                                                        : null}
                                                    {Input ? (
                                                        <Box
                                                            flexGrow={1}
                                                            flexShrink={1}
                                                            minWidth={0}>
                                                            <Input
                                                                key={
                                                                    field(
                                                                        $,
                                                                        `orbit:asteer:${x.id}`,
                                                                        x.steer ??
                                                                            '',
                                                                    ).key
                                                                }
                                                                onInput={(
                                                                    value: string,
                                                                ) => {
                                                                    field(
                                                                        $,
                                                                        `orbit:asteer:${x.id}`,
                                                                        x.steer ??
                                                                            '',
                                                                    ).type(
                                                                        value,
                                                                        () => {
                                                                            return handleAssumedSteer(
                                                                                x.id,
                                                                                value,
                                                                            );
                                                                        },
                                                                    );
                                                                }}
                                                                onSubmit={(
                                                                    value: string,
                                                                ) =>
                                                                    handleAssumedSteer(
                                                                        x.id,
                                                                        value,
                                                                    )
                                                                }
                                                                placeholder='steer'
                                                                value={
                                                                    field(
                                                                        $,
                                                                        `orbit:asteer:${x.id}`,
                                                                        x.steer ??
                                                                            '',
                                                                    ).value
                                                                }
                                                            />
                                                        </Box>
                                                    ) : null}
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            ) : null}
                        </Box>
                    ));
                    // 🛼 glide (FRM-385): each live lane a card on every board, its whole scope in order, done steps kept and marked, the
                    // current one «← we are here»; a steer on it reaches clio's next prompt, whichever board took it
                    const lanes = (await $.state.get(LANES)).value ?? [];
                    const laneAsks = (await $.state.get(LANE_ASKS)).value ?? {};
                    // a member's asks on the glide card: folded to their count by default, its rows marked as on the member's own board
                    const memberJSX = (
                        lane: StashLane,
                        role: (typeof LANE_ROLES)[number],
                    ) => {
                        const sid = lane.members[role];
                        if (!sid) return null;
                        const asks = laneAsks[sid] ?? [];
                        // a mark goes to the session the member runs under now, which its own stash absorbs
                        const markSid = lane.memberSids?.[role] ?? sid;
                        const card = `lane:${lane.id}:${role}`;
                        const isOpen = !isFolded(card);
                        const badge = role === 'codie' ? '🔧' : '🔎';
                        return (
                            <Box
                                flexDirection='column'
                                key={card}
                                rowGap={LINE_GAP}>
                                <Box
                                    alignItems='center'
                                    flexDirection='row'
                                    gap={1}>
                                    {/* asks waiting read amber with a 🙋, the one colour dima reads as «waits on you» (dima, 19:45) */}
                                    <Text
                                        bold
                                        color={
                                            asks.length
                                                ? PALETTE.warn
                                                : undefined
                                        }>
                                        {`${asks.length ? '🙋 ' : ''}${badge} ${role.replace('-', ' ')} · ${asks.length} ask${asks.length === 1 ? '' : 's'}`}
                                    </Text>
                                    {foldJSX(card)}
                                </Box>
                                {isOpen
                                    ? asks.map((a, i) =>
                                          askJSX(a as OrbitAsk, i, {
                                              // a press reads what was typed: the steer waiting for its pause saves first
                                              mark: async (x, mark) => {
                                                  await flushFields();
                                                  await markRemote(
                                                      $,
                                                      markSid,
                                                      x,
                                                      {
                                                          mark:
                                                              x.mark === mark
                                                                  ? undefined
                                                                  : mark,
                                                      },
                                                  );
                                              },
                                              prefix: card,
                                              steer: (x, value) =>
                                                  markRemote($, markSid, x, {
                                                      isSteerEdit: true,
                                                      steer: steerOf(value),
                                                  }),
                                          }),
                                      )
                                    : null}
                            </Box>
                        );
                    };
                    // 🙋 the board's top while a lane member's asks wait on dima: their count, then each member, a press scrolls to its asks
                    const waitingOn = isPartOn('stash.glide')
                        ? lanes.flatMap((lane) =>
                              LANE_ROLES.flatMap((role) => {
                                  const sid = lane.members[role];
                                  const n = sid
                                      ? (
                                            (laneAsks[sid] ?? []) as OrbitAsk[]
                                        ).filter((a) => !a.mark).length
                                      : 0;
                                  return n ? [{ lane, n, role }] : [];
                              }),
                          )
                        : [];
                    const waitingCount = waitingOn.reduce(
                        (sum, w) => sum + w.n,
                        0,
                    );
                    const stripJSX = drawn('asks', () =>
                        waitingCount ? (
                            <Box
                                key='asks-strip'
                                {...cardProps}
                                alignItems='center'
                                borderColor={PALETTE.warn}
                                columnGap={1}
                                flexDirection='row'
                                flexWrap='wrap'
                                marginBottom={1}>
                                <Text bold color={PALETTE.warn}>
                                    {`🙋 ${waitingCount} ask${waitingCount === 1 ? ' waits' : 's wait'} for you`}
                                </Text>
                                {waitingOn.map((w) => (
                                    <Button
                                        key={`asks-strip:${w.lane.id}:${w.role}`}
                                        onPress={() =>
                                            void $.ui
                                                .scroll({
                                                    block: 'start',
                                                    to: {
                                                        key: `lane:${w.lane.id}:${w.role}`,
                                                    },
                                                })
                                                .catch(() => undefined)
                                        }
                                        plain>
                                        {`· ${w.role === 'codie' ? '🔧' : '🔎'} ${w.role.replace('-', ' ')} ${w.n}`}
                                    </Button>
                                ))}
                            </Box>
                        ) : null,
                    );
                    // o84: dima's hand on this session's phases — a move, a tick, a steer — waits SEND_MS like an orbit tick
                    const changePlan = async (
                        change: (p: StashPlan) => StashPlan,
                        isSend = true,
                    ) => {
                        const was = await currentOrbit($);
                        if (!was.plan) return;
                        const win = await sendWindow($);
                        const sendAt = isSend
                            ? (await $.clock.now()) + win
                            : was.plan.sendAt;
                        await saveOrbit($, {
                            ...was,
                            plan: { ...change(was.plan), sendAt },
                        });
                        if (isSend && win)
                            $.clock.after(win, () =>
                                $.ui.invalidate('ui.render'),
                            );
                    };
                    const handlePlanMove = (i: number, by: -1 | 1) =>
                        void changePlan((p) => ({
                            ...p,
                            isMoved: true,
                            lines: moved(p.lines, i, by),
                        }));
                    const handlePlanTick = () =>
                        void changePlan((p) => ({
                            ...p,
                            mark: p.mark ? undefined : 'accepted',
                        }));
                    const handlePlanSteer = (value: string) =>
                        changePlan(
                            (p) => ({ ...p, steer: steerOf(value) }),
                            false,
                        );
                    const arrowsJSX = (
                        key: string,
                        canUp: boolean,
                        canDown: boolean,
                        onMove: (by: -1 | 1) => void,
                    ) => (
                        <Box
                            flexDirection='row'
                            flexShrink={0}
                            gap={1}
                            key={`${key}:arrows`}>
                            {/* every row keeps the same two buttons, so the column never drifts and no size changes (dima, 21:23–21:24);
                        an end's dead arrow is the same button, a press on it does nothing — the api has no disabled */}
                            {(['up', 'down'] as const).map((dir) => {
                                const isLive = dir === 'up' ? canUp : canDown;
                                const glyph = dir === 'up' ? '↑' : '↓';
                                return (
                                    <Button
                                        key={`${key}:${dir}`}
                                        onPress={() => {
                                            if (isLive)
                                                onMove(dir === 'up' ? -1 : 1);
                                        }}
                                        plain>
                                        {glyph}
                                    </Button>
                                );
                            })}
                        </Box>
                    );
                    const handleLaneSteer = (id: string, value: string) =>
                        changeLaneSteer($, id, (n) => ({
                            ...n,
                            steer: steerOf(value),
                        }));
                    const handleLaneTake = (id: string) =>
                        changeLaneSteer($, id, (n) => ({
                            ...n,
                            isTaken: !n.isTaken || undefined,
                        }));
                    const laneJSX = isPartOn('stash.glide')
                        ? lanes.map((lane) =>
                              drawn(`lane ${lane.id}`, () => (
                                  <Box
                                      key={`lane:${lane.id}`}
                                      {...cardProps}
                                      marginTop={1}
                                      rowGap={LINE_GAP}>
                                      <Box
                                          flexDirection='row'
                                          justifyContent='space-between'>
                                          <Text
                                              bold>{`🛼 glide: ${lane.title}${laneSpan(lane)}${lane.isPlanGone ? ' · plan file gone' : ''}`}</Text>
                                          {foldJSX(`lane:${lane.id}`)}
                                      </Box>
                                      {isFolded(`lane:${lane.id}`)
                                          ? null
                                          : laneRows(lane).map(
                                                ({ i, item }) => (
                                                    <Box
                                                        alignItems='center'
                                                        flexDirection='row'
                                                        gap={1}
                                                        // biome-ignore lint/suspicious/noArrayIndexKey: a lane step's place is its identity
                                                        key={`lane:${lane.id}:${i}`}>
                                                        <Box flexShrink={0}>
                                                            <Text
                                                                dimColor={
                                                                    item.isDone
                                                                }>
                                                                {item.isDone
                                                                    ? '✅'
                                                                    : i ===
                                                                        lane.current
                                                                      ? '➡️'
                                                                      : '⬜'}{' '}
                                                            </Text>
                                                        </Box>
                                                        {/* the ticket leads the step's text (dima's shot, 2026-10-23 19:44) */}
                                                        {item.ticket ? (
                                                            <Box flexShrink={0}>
                                                                <Link
                                                                    href={`https://linear.app/x-com/issue/${item.ticket}`}
                                                                    key={`lane:${lane.id}:t:${i}`}>
                                                                    {
                                                                        item.ticket
                                                                    }
                                                                </Link>
                                                            </Box>
                                                        ) : null}
                                                        {/* the step's text gives way first: the link, tick and steer keep their room (dima's shots, 17:41, 17:46) */}
                                                        <Box
                                                            flexShrink={1}
                                                            minWidth={0}>
                                                            <Text
                                                                bold={
                                                                    i ===
                                                                    lane.current
                                                                }
                                                                dimColor={
                                                                    item.isDone
                                                                }
                                                                wrap='truncate-end'>
                                                                {item.text}
                                                            </Text>
                                                        </Box>
                                                        {/* tick leads, the steer follows, on the step's own line after its link (dima's shot, 17:46) */}
                                                        {i === lane.current ? (
                                                            <Box
                                                                alignItems='center'
                                                                flexDirection='row'
                                                                flexGrow={1}
                                                                flexShrink={0}
                                                                gap={1}
                                                                key={`lane:${lane.id}:act`}
                                                                minWidth={24}>
                                                                {/* the steer waits as a draft until 🛎️ tick sends it; no replay, a steer has nothing to redo (dima, 20:51) */}
                                                                <Button
                                                                    key={`lane:${lane.id}:take`}
                                                                    onPress={() =>
                                                                        void handleLaneTake(
                                                                            lane.id,
                                                                        )
                                                                    }
                                                                    variant='primary'>
                                                                    {`${lane.isSteerTaken ? '✅' : '🛎️'} tick`}
                                                                </Button>
                                                                {Input ? (
                                                                    <Box
                                                                        flexGrow={
                                                                            1
                                                                        }
                                                                        minWidth={
                                                                            0
                                                                        }>
                                                                        <Input
                                                                            key={
                                                                                field(
                                                                                    $,
                                                                                    `lane:${lane.id}:steer`,
                                                                                    lane.steer ??
                                                                                        '',
                                                                                )
                                                                                    .key
                                                                            }
                                                                            onInput={(
                                                                                value: string,
                                                                            ) => {
                                                                                field(
                                                                                    $,
                                                                                    `lane:${lane.id}:steer`,
                                                                                    lane.steer ??
                                                                                        '',
                                                                                ).type(
                                                                                    value,
                                                                                    () => {
                                                                                        return handleLaneSteer(
                                                                                            lane.id,
                                                                                            value,
                                                                                        );
                                                                                    },
                                                                                );
                                                                            }}
                                                                            onSubmit={(
                                                                                value: string,
                                                                            ) =>
                                                                                void handleLaneSteer(
                                                                                    lane.id,
                                                                                    value,
                                                                                )
                                                                            }
                                                                            placeholder='steer'
                                                                            value={
                                                                                field(
                                                                                    $,
                                                                                    `lane:${lane.id}:steer`,
                                                                                    lane.steer ??
                                                                                        '',
                                                                                )
                                                                                    .value
                                                                            }
                                                                        />
                                                                    </Box>
                                                                ) : null}
                                                            </Box>
                                                        ) : null}
                                                    </Box>
                                                ),
                                            )}
                                      {isFolded(`lane:${lane.id}`)
                                          ? null
                                          : LANE_ROLES.map((role) =>
                                                memberJSX(lane, role),
                                            )}
                                  </Box>
                              )),
                          )
                        : null;
                    // the lanes and the phases stick to the board's bottom, the lanes on top of the phases: a docked board fills its rows
                    // and a gap grows above them (dima, 11:07; the lanes, 20:12)
                    const phasesJSX = drawn('phases', () =>
                        o.plan && isPartOn('stash.phases')
                            ? [
                                  <Box
                                      key='phases'
                                      {...cardProps}
                                      marginTop={1}
                                      rowGap={LINE_GAP}>
                                      {/* one row: the title, then one tick and one steer for the whole order at the right, then 📂 — every
                                  part centered on the row (dima's o84; moved into the head, 21:26: «looks off and steals vertical space») */}
                                      <Box
                                          alignItems='center'
                                          flexDirection='row'
                                          gap={1}
                                          justifyContent='space-between'
                                          key='phases:head'>
                                          <Box flexShrink={0}>
                                              <Text bold>
                                                  {`🌔 phases${age !== undefined && age >= STALE_TURNS ? ` · stale, untouched ${age} turns` : ''}`}
                                              </Text>
                                          </Box>
                                          {isFolded('phases') ? null : (
                                              <Box
                                                  alignItems='center'
                                                  flexDirection='row'
                                                  flexGrow={1}
                                                  flexShrink={1}
                                                  gap={1}
                                                  justifyContent='flex-end'
                                                  key='plan:act'
                                                  minWidth={0}>
                                                  <Button
                                                      key='plan:tick'
                                                      onPress={handlePlanTick}
                                                      variant='primary'>
                                                      {`${o.plan.mark ? (isSending(o.plan, drawnAt) ? '📨' : '✅') : '🛎️'} tick`}
                                                  </Button>
                                                  {Input ? (
                                                      <Box
                                                          flexShrink={1}
                                                          minWidth={0}
                                                          width={24}>
                                                          <Input
                                                              key={
                                                                  field(
                                                                      $,
                                                                      'plan:steer',
                                                                      o.plan
                                                                          .steer ??
                                                                          '',
                                                                  ).key
                                                              }
                                                              onInput={(
                                                                  value: string,
                                                              ) => {
                                                                  field(
                                                                      $,
                                                                      'plan:steer',
                                                                      o.plan
                                                                          ?.steer ??
                                                                          '',
                                                                  ).type(
                                                                      value,
                                                                      () =>
                                                                          handlePlanSteer(
                                                                              value,
                                                                          ),
                                                                  );
                                                              }}
                                                              onSubmit={(
                                                                  value: string,
                                                              ) =>
                                                                  void handlePlanSteer(
                                                                      value,
                                                                  )
                                                              }
                                                              placeholder='steer'
                                                              value={
                                                                  field(
                                                                      $,
                                                                      'plan:steer',
                                                                      o.plan
                                                                          .steer ??
                                                                          '',
                                                                  ).value
                                                              }
                                                          />
                                                      </Box>
                                                  ) : null}
                                              </Box>
                                          )}
                                          {foldJSX('phases')}
                                      </Box>
                                      {(isFolded('phases')
                                          ? []
                                          : o.plan.lines
                                      ).map((line, i) => {
                                          // a line's lead word — `now:`, `next:`, `then:` — prints bold (dima, 20:40)
                                          const lead = line.match(PLAN_LEAD);
                                          return (
                                              // the moon fills by nearness, the then lines dim (dima, 20:58); only the now lead is green (21:08)
                                              <Box
                                                  alignItems='center'
                                                  flexDirection='row'
                                                  gap={1}
                                                  // biome-ignore lint/suspicious/noArrayIndexKey: a plan line's place is its identity
                                                  key={`plan:${i}`}>
                                                  <Box
                                                      flexGrow={1}
                                                      flexShrink={1}
                                                      minWidth={0}>
                                                      <Text dimColor={i > 1}>
                                                          {/* a siesta is a pause, not a step: 🌤️ in place of its moon (dima, 20:37) */}
                                                          {`${/^siesta:/i.test(line) ? '🌤️' : PHASE_MOONS[Math.min(i, PHASE_MOONS.length - 1)]} `}
                                                          {lead ? (
                                                              <Text
                                                                  bold
                                                                  color={
                                                                      i === 0
                                                                          ? METER_TINTS.calm5h
                                                                          : undefined
                                                                  }>
                                                                  {lead[0]}
                                                              </Text>
                                                          ) : null}
                                                          {linkedJSX(
                                                              lead
                                                                  ? line.slice(
                                                                        lead[0]
                                                                            .length,
                                                                    )
                                                                  : line,
                                                              `plan:${i}`,
                                                          )}
                                                      </Text>
                                                  </Box>
                                                  {arrowsJSX(
                                                      `plan:${i}`,
                                                      i > 0,
                                                      i <
                                                          (o.plan?.lines
                                                              .length ?? 0) -
                                                              1,
                                                      (by) =>
                                                          handlePlanMove(i, by),
                                                  )}
                                              </Box>
                                          );
                                      })}
                                  </Box>,
                              ]
                            : null,
                    );
                    const fill =
                        e.props.placement === 'dock'
                            ? e.props.scroll.bodyRows
                            : undefined;
                    // the board top to bottom: what the sessions part shows, orbit, then a gap that docks the glide and phase cards at
                    // the bottom (dima's shot, 20:12)
                    const probes = board?.staleProbes ?? [];
                    const probesJSX = probes.length ? (
                        <Text
                            color={PALETTE.warn}
                            key='probes'
                            wrap='truncate-end'>
                            {`🧪 stale probe mods in ~/.claude/dev-mods, unload them: ${probes.join(', ')}`}
                        </Text>
                    ) : null;
                    const arranged = (top: RenderElement) => (
                        <Box flexDirection='column' minHeight={fill}>
                            {stripJSX}
                            {probesJSX}
                            {top}
                            {isPartOn('stash.orbit') ? orbitJSX : null}
                            <Box flexGrow={1} key='phases:gap' />
                            {laneJSX}
                            {phasesJSX}
                        </Box>
                    );
                    const list = board?.members;
                    if (!list)
                        return arranged(
                            <Text dimColor>
                                the session registry is unreadable
                            </Text>,
                        );
                    if (!list.length)
                        return arranged(<Text dimColor>no live sessions</Text>);
                    const isColour = board.isColour;
                    // the band's ctx ramp needs this session's compaction point, which the rows share; unknown, it falls back to 80, the
                    // old red line, so a full session never reads calm
                    const compactAt =
                        (await $.state.get(METER)).value?.compactAt ??
                        CTX_FALLBACK_AT;
                    const PillSvg =
                        e.surface === 'desktop' && 'Svg' in ui
                            ? ui.Svg
                            : undefined;
                    // the desktop's ctx meter as dima switched it: the ring takes 7 cells, the bar 5, the terminal's text bar 10
                    const isRing = board.isRing;
                    const ctxTake = isRing ? CTX_RING : CTX_BAR;
                    const contextColumns = PillSvg
                        ? isRing
                            ? 7
                            : 5
                        : COLUMNS.context;
                    const hues = huesOf(list.map((m) => m.name));
                    // the ticket column is drawn only when some row names a ticket: empty on every row, it was 9 cells of nothing (dima, 15:41)
                    const hasTickets = list.some((m) => ticketOf(m.name));
                    // the state column as wide as the board's longest time, its emoji and gap included: a fixed 9 left «1m» rows a
                    // gap before their 🪐 n (dima, 10-13 17:45)
                    const stateColumns = Math.max(
                        ...list.map(
                            (m) =>
                                4 +
                                (m.statusSince === undefined
                                    ? 0
                                    : span(now - m.statusSince).length),
                        ),
                    );
                    const row = (m: Member, i: number) => {
                        const status = statusOf(m.status);
                        const sinceMs =
                            m.statusSince === undefined
                                ? undefined
                                : now - m.statusSince;
                        // the time's tint: idle by its thresholds alone, a working row always green, the rest with colour on
                        const timeTint = status.isIdle
                            ? idleTint(sinceMs ?? 0)
                            : status.isWorking || isColour
                              ? status.tint
                              : undefined;
                        const ticket = ticketOf(m.name);
                        const mark = markOf({
                            isIdle: status.isIdle,
                            isOffPattern: !!m.offPattern,
                            ms: sinceMs ?? 0,
                        });
                        const name = m.sid === me ? `${m.name} (here)` : m.name;
                        const line = m.tip
                            ? `👀 ${m.tip}`
                            : m.wait && `🔭 ${unbold(m.wait)}`;
                        // «opus 5.5 · medium» as kept: the model in words, its effort as cells beside it on the name's line
                        const [model, effort] = (m.model ?? '').split(' · ');
                        const level = effortLevel(effort);
                        const effortJSX =
                            level === undefined ? (
                                effort ? (
                                    <Text dimColor>{effort}</Text>
                                ) : null
                            ) : Svg ? (
                                <Svg
                                    alt={`effort ${effort}`}
                                    height={EFFORT_CELL}
                                    key={`m:${m.sid}:effort`}
                                    source={effortSvg(level)}
                                />
                            ) : (
                                <Text>
                                    {effortCells(level).map((c, k) => {
                                        return (
                                            // biome-ignore lint/suspicious/noArrayIndexKey: a cell's place is its identity
                                            <Text
                                                color={c.color}
                                                dimColor={!c.color}
                                                key={`c:${k}`}>
                                                {c.kind === 'fill' ? '▮' : '▯'}
                                            </Text>
                                        );
                                    })}
                                </Text>
                            );
                        return (
                            <Box
                                flexDirection='column'
                                key={`m:${m.sid}`}
                                // the desktop's rows sit closer, the cards mock's spacing (dima, 17:27); a terminal row cannot be split
                                marginTop={
                                    i > 0
                                        ? e.surface === 'desktop'
                                            ? 0.6
                                            : 1
                                        : 0
                                }
                                rowGap={LINE_GAP}>
                                <Box
                                    flexDirection='row'
                                    gap={1}
                                    justifyContent='space-between'>
                                    {/* the name side gives way, clipped, so a long name never pushes the fact columns out of line */}
                                    <Box
                                        flexDirection='row'
                                        flexGrow={1}
                                        flexShrink={1}
                                        gap={1}
                                        minWidth={0}
                                        overflow='hidden'>
                                        {/* the dot leads the row, the reference's cue: with colour on, the member's own hue, dimmed while idle */}
                                        <Box flexShrink={0}>
                                            <Text
                                                color={
                                                    isColour
                                                        ? hues[i]
                                                        : undefined
                                                }
                                                dimColor={
                                                    !isColour || status.isIdle
                                                }>
                                                ●
                                            </Text>
                                        </Box>
                                        {/* every name bold text, no control: the board opens no session (dima, 17:42) */}
                                        <Text bold wrap='truncate-end'>
                                            {name}
                                        </Text>
                                        {mark === '⚠' ? (
                                            <Text color={ACCENT}>⚠</Text>
                                        ) : mark ? (
                                            <Text>{mark}</Text>
                                        ) : null}
                                        {/* quiet comms: the member pings held for clio's next turn, nothing at 0 */}
                                        {m.held ? (
                                            <Box flexShrink={0}>
                                                <Button
                                                    key={`fold:quiet:${m.sid}`}
                                                    onPress={async () => {
                                                        const was =
                                                            (
                                                                await $.state.get(
                                                                    FOLDS,
                                                                )
                                                            ).value ?? {};
                                                        await $.state.set(
                                                            FOLDS,
                                                            {
                                                                ...was,
                                                                [`quiet:${m.sid}`]:
                                                                    !foldedOf(
                                                                        was,
                                                                        `quiet:${m.sid}`,
                                                                    ),
                                                            },
                                                        );
                                                    }}
                                                    plain>
                                                    {m.isHeldStuck ? (
                                                        <Text color='error'>
                                                            {`🤫 ${m.held.length}`}
                                                        </Text>
                                                    ) : (
                                                        `🤫 ${m.held.length}`
                                                    )}
                                                </Button>
                                            </Box>
                                        ) : null}
                                        {/* the name's line: the model and its effort cells right of the name (dima, 15:27; o6, 15:49) */}
                                        {model && isPartOn('stash.rowmeta') ? (
                                            <Box
                                                alignItems='center'
                                                flexDirection='row'
                                                flexShrink={0}
                                                gap={
                                                    e.surface === 'desktop'
                                                        ? 0.5
                                                        : 1
                                                }>
                                                <Text dimColor>{model}</Text>
                                                {effortJSX}
                                            </Box>
                                        ) : null}
                                    </Box>
                                    {/* one fixed-width, right-aligned cell per fact, drawn empty when it has no reading, so the columns line up across rows (dima, 2026-10-05) */}
                                    <Box
                                        flexDirection='row'
                                        flexShrink={0}
                                        gap={e.surface === 'desktop' ? 0.5 : 1}>
                                        {/* no hover card in the pane: an absolute card in a narrow row wraps and clips (dima, 2026-10-05) */}
                                        {hasTickets ? (
                                            <Box
                                                justifyContent='flex-end'
                                                width={COLUMNS.ticket}>
                                                {ticket ? (
                                                    // never wraps: `FRM-306` broke at its hyphen in the desktop font
                                                    <Text
                                                        dimColor
                                                        wrap='truncate-end'>
                                                        <Link
                                                            href={`https://linear.app/x-com/issue/${ticket}`}>
                                                            {ticket}
                                                        </Link>
                                                    </Text>
                                                ) : null}
                                            </Box>
                                        ) : null}
                                        {/* 🐦‍🔥 second wind beside the meter it answers: the emoji alone, its state under the row */}
                                        {isPartOn('stash.second-wind') ? (
                                            <Box flexShrink={0}>
                                                <Button
                                                    dimColor={!m.wind}
                                                    key={`wind:${m.sid}`}
                                                    onPress={() =>
                                                        pressWind($, m.sid)
                                                    }
                                                    plain>
                                                    {
                                                        WIND_EMOJI[
                                                            m.wind?.state ??
                                                                'idle'
                                                        ]
                                                    }
                                                </Button>
                                            </Box>
                                        ) : null}
                                        <Box
                                            justifyContent='flex-end'
                                            width={contextColumns}>
                                            {/* every row's meter one width, its % merged in, stepping to red at the compaction point */}
                                            {m.context ===
                                            undefined ? null : PillSvg ? (
                                                <PillSvg
                                                    alt={`ctx ${m.context}%`}
                                                    height={ctxTake.height}
                                                    key={`ctx:${m.sid}`}
                                                    source={(isRing
                                                        ? ctxRingSvg
                                                        : ctxBarSvg)(
                                                        m.context,
                                                        compactAt,
                                                    )}
                                                />
                                            ) : (
                                                <Text
                                                    color={contextFill(
                                                        m.context,
                                                        compactAt,
                                                    )}>
                                                    {ctxBar(m.context)}
                                                </Text>
                                            )}
                                        </Box>
                                        {/* the state: its emoji in a column of its own, the time right-aligned beside it, so every row lines up
                                    (dima's o106, 21:17) */}
                                        {/* the emoji sits against its time, both packed left: they say one thing, the state and how long
                                    (dima, 22:11: «join pace emojis with time»), and every row's emoji lines up (dima, 10-13 16:59:
                                    right-aligned, they read as a ladder) */}
                                        {/* a little air after the ctx meter (dima's shot, 18:14: «slightly more breathing room») */}
                                        <Box
                                            flexDirection='row'
                                            gap={1}
                                            justifyContent='flex-start'
                                            key={`state:${m.sid}`}
                                            marginLeft={
                                                e.surface === 'desktop' ? 1 : 0
                                            }
                                            width={stateColumns}>
                                            <Text>{status.emoji}</Text>
                                            {sinceMs === undefined ? null : (
                                                <Text
                                                    bold
                                                    color={timeTint}
                                                    dimColor={!timeTint}
                                                    wrap='truncate-end'>
                                                    {span(sinceMs)}
                                                </Text>
                                            )}
                                        </Box>
                                        {/* the asks close the row, always drawn: `🪐 0` dimmed when none (dima, 2026-10-05) */}
                                        <Box
                                            justifyContent='flex-end'
                                            width={COLUMNS.asks}>
                                            <Text
                                                bold={!!m.asks}
                                                color={
                                                    m.asks
                                                        ? PALETTE.warn
                                                        : undefined
                                                }
                                                dimColor={!m.asks}>
                                                🪐 {m.asks}
                                            </Text>
                                        </Box>
                                    </Box>
                                </Box>
                                {/* the second line, under the name: crow's 👀 tip with speak's buttons, or the 🔭 wait — one clipped row,
                            so a session waiting on many things never pushes the name's line (dima's o6, 15:49) */}
                                {(m.tip || line) &&
                                isPartOn('stash.rowmeta') ? (
                                    <Box
                                        alignItems='center'
                                        flexDirection='row'
                                        gap={1}
                                        paddingLeft={2}>
                                        {/* read, pause and stop all lead the tip (dima's shots, 18:29, 19:40) */}
                                        {m.tip
                                            ? speakJSX(`crow:${m.sid}`, m.tip)
                                            : null}
                                        {m.tip ? (
                                            <Box
                                                flexShrink={1}
                                                height={1}
                                                minWidth={0}
                                                overflow='hidden'>
                                                <Text
                                                    dimColor
                                                    wrap='truncate-end'>
                                                    {line}
                                                </Text>
                                            </Box>
                                        ) : line &&
                                          (m.wait ?? '').includes('; ') ? (
                                            // several waits are one plain run: styled pieces wrap on the desktop, and the clip then showed the
                                            // middle of two lines (dima's shot, 19:36: «what is this? looks off»)
                                            <Box
                                                flexShrink={1}
                                                height={1}
                                                minWidth={0}
                                                overflow='hidden'>
                                                <Text
                                                    dimColor
                                                    wrap='truncate-end'>
                                                    {line}
                                                </Text>
                                            </Box>
                                        ) : line ? (
                                            // one row, clipped: the desktop wraps a run of styled pieces instead of cutting it (dima, 15:41)
                                            <Box
                                                flexShrink={1}
                                                height={1}
                                                minWidth={0}
                                                overflow='hidden'>
                                                <Text
                                                    dimColor
                                                    wrap='truncate-end'>
                                                    {/* each «waiting on <who>» part prints <who> bold, as the band does (dima, 17:20) */}
                                                    {'🔭 '}
                                                    {(m.wait ?? '')
                                                        .split('; ')
                                                        .map((part, k) => (
                                                            <Text
                                                                key={`w:${k}`}>
                                                                {k > 0
                                                                    ? '; '
                                                                    : ''}
                                                                {waitSpans(
                                                                    part,
                                                                ).map(
                                                                    (
                                                                        span,
                                                                        j,
                                                                    ) =>
                                                                        span.isBold ? (
                                                                            <Text
                                                                                bold
                                                                                key={`s:${j}`}>
                                                                                {
                                                                                    span.text
                                                                                }
                                                                            </Text>
                                                                        ) : (
                                                                            span.text
                                                                        ),
                                                                )}
                                                            </Text>
                                                        ))}
                                                </Text>
                                            </Box>
                                        ) : null}
                                    </Box>
                                ) : null}
                                {/* a pane draws no hover card (engine.md), so second wind names its state and wait here */}
                                {m.wind && isPartOn('stash.second-wind') ? (
                                    <Box
                                        key={`wind:say:${m.sid}`}
                                        paddingLeft={2}>
                                        <Text dimColor wrap='truncate-end'>
                                            {`🐦‍🔥 second wind: ${WIND_SAY[m.wind.state]} (${span(Math.max(0, now - m.wind.at))})`}
                                        </Text>
                                    </Box>
                                ) : null}
                                {/* the held member pings, opened from 🤫 n: sender, age, first line (dima's o34) */}
                                {m.held && !isFolded(`quiet:${m.sid}`) ? (
                                    <Box
                                        flexDirection='column'
                                        key={`quiet:${m.sid}`}
                                        paddingLeft={2}>
                                        {m.held.map((p, k) => {
                                            return (
                                                // biome-ignore lint/suspicious/noArrayIndexKey: a held ping's place is its identity
                                                <Text
                                                    dimColor
                                                    key={`quiet:${m.sid}:${k}`}
                                                    wrap='truncate-end'>
                                                    {`🤫 ${p.from} · ${span(now - p.at)} ago: ${p.text}`}
                                                </Text>
                                            );
                                        })}
                                    </Box>
                                ) : null}
                            </Box>
                        );
                    };
                    const busyCount = list.filter(
                        (m) => statusOf(m.status).isWorking,
                    ).length;
                    return arranged(
                        <Box key='sessions' {...cardProps}>
                            {/* the head: what the pane holds on the left, how many work right now on the right */}
                            <Box
                                flexDirection='row'
                                justifyContent='space-between'
                                marginBottom={isFolded('sessions') ? 0 : 1}>
                                <Text bold>🌌 sessions</Text>
                                <Box
                                    alignItems='center'
                                    flexDirection='row'
                                    gap={1}>
                                    {/* the mock's head: the count and the busy on the right, the busy bold (dima, 17:00) */}
                                    <Text>
                                        <Text
                                            dimColor>{`${list.length} on this mac · `}</Text>
                                        <Text
                                            bold
                                            color={
                                                busyCount
                                                    ? PALETTE.ok
                                                    : undefined
                                            }>
                                            {`${busyCount} busy`}
                                        </Text>
                                    </Text>
                                    {foldJSX('sessions')}
                                </Box>
                            </Box>
                            {isFolded('sessions')
                                ? null
                                : list.map((m, i) =>
                                      drawn(`session ${m.sid}`, () =>
                                          row(m, i),
                                      ),
                                  )}
                        </Box>,
                    );
                })(),
            );
        } catch (err) {
            $.ui.log(`x-mod-stash: the board failed to draw: ${String(err)}`);
            const { Box, Text } = $.ui.resolve(e);
            return cleanTree(
                <Box>
                    <Text color='error'>
                        ⚠️ x-mod-stash: the board failed to draw, the debug log
                        names why
                    </Text>
                </Box>,
            );
        }
    });

    // a /clear or a resume leaves the conversation behind; an exit leaves its last reply for the away digest
    on('session.end', async ($, e, next) => {
        if (e.reason === 'clear' || e.reason === 'resume') {
            // the process outlives a /clear, so the next conversation is primed again: no session.start fires for it
            isPrimed = false;
            // the process goes on under a new id with no session.start: the next read takes it fresh
            selfId = undefined;
            clearedFrom = e.sessionId;
            await forget($, e.sessionId);
        } else {
            // a quit keeps what the board drew, so the resumed session draws it again
            await keepState($).catch(() => undefined);
            await retire($, e.sessionId);
        }
        return next(e);
    });

    // `/clear` and `/resume` leave the conversation: its asks and holds go now, not at the next poll
    on('command.run', async ($, e, next) => {
        if (e.command !== 'clear' && e.command !== 'resume') return next(e);
        const left = await currentId($);
        const r = await next(e);
        if (left) await forget($, left).catch(() => undefined);
        await saveOrbit($, EMPTY_ORBIT);
        await load($);
        return r;
    });

    // orbit's write door, where the session adds, resolves and follows up its asks and sets its plan; and afk flipped
    // mid-turn: the next tool result carries the new state once
    on('tool.call', async ($, e, next) => {
        await flushFields();
        if ((e.tool as string) === ORBIT_TOOL) {
            const input = e as Record<string, unknown>;
            const ops = Array.isArray(input.ops)
                ? input.ops.filter(
                      (x): x is Record<string, unknown> =>
                          typeof x === 'object' && x !== null,
                  )
                : [input];
            if (!ops.length)
                return { deny: 'orbit: ops needs one { op, … } or more' };
            // a «changed:» resolve needs a follow or an add that lands: each is tried on the orbit as it stands, op is pure
            const was = await currentOrbit($);
            const isAmended = ops.some(
                (x) =>
                    (x.op === 'follow' || x.op === 'add') &&
                    !('deny' in orbitOp(was, x, true)),
            );
            if (ops.length === 1) {
                const r = await orbitCall(
                    $,
                    ops[0] as Record<string, unknown>,
                    isAmended,
                );
                return ('deny' in r ? r : { result: r.result }) as never;
            }
            const lines: string[] = [];
            let landed = 0;
            for (const [i, x] of ops.entries()) {
                const r = await orbitCall($, x, isAmended);
                if ('deny' in r)
                    lines.push(`${i + 1} ${String(x.op)}: refused — ${r.deny}`);
                else {
                    landed++;
                    lines.push(`${i + 1} ${String(x.op)}: ${r.result}`);
                }
            }
            const text = lines.join('\n');
            return (landed ? { result: text } : { deny: text }) as never;
        }
        // a wind blocks on work that STARTS after «pending: none», so the check runs before the call does
        if (!e.agentId)
            await windBlock($, e as Record<string, unknown>).catch(
                () => undefined,
            );
        const r = await next(e);
        if (r.deny !== undefined || e.agentId) return r;
        if (
            (e.tool as string) === WRAP_UP_TOOL &&
            oneLine((e as Record<string, unknown>).ask)
        )
            isWrapAsked = true;
        if (
            isWork(
                e.tool as string,
                (e as { command?: unknown }).command as string | undefined,
            )
        )
            isWorkTurn = true;
        const notes: string[] = [];
        const isOn = await partsShown($);
        if (turnAfk !== undefined && turnAfk !== afk) {
            turnAfk = afk;
            if (isOn('stash.afk')) notes.push(afk ? AWAY_NOTE : BACK_NOTE);
        }
        if (
            (e.tool as string) === START_SESSION_TOOL &&
            isOn('stash.boot') &&
            (await isBootOpen($))
        )
            notes.push(BOOT_NOTE);
        // a mark dima made while any turn of this session runs joins it here, model-only, and locks — a peer's or a task's
        // turn too, only the keep-hot ping never takes one (dima's o10, 2026-10-11); the turn is read from $.state, which a
        // mid-turn reload keeps
        await absorbMarks($);
        const o = await currentOrbit($);
        const isPing = (await $.state.get(TURN)).value?.isPinged ?? pinged;
        const fresh =
            isPing || !isOn('stash.orbit')
                ? []
                : o.asks.filter(isDue(await $.clock.now()));
        if (fresh.length) {
            await saveOrbit($, lockJoined(o, fresh));
            notes.push(joinText(fresh));
        }
        // a lane steer dima took while clio's turn runs joins it here too, as an orbit mark does
        if (!isPing && isOn('stash.glide') && (await isLaneOwner($))) {
            notes.push(...(await takeLaneMoves($)));
            notes.push(...(await takeLaneSteers($, await readLanes($))));
        }
        // 🐦‍🔥 a press while this session works slipstreams into its next tool step, as a tick does; an idle one waits
        // for its next turn, never woken (dima, 19:14)
        if (isOn('stash.second-wind')) {
            const wind = await takeWind($, await isLaneOwner($)).catch(
                () => undefined,
            );
            if (wind) notes.push(wind);
        }
        // dima's phases mark joins the running turn once its sending window passed
        const p = (await currentOrbit($)).plan;
        if (
            !isPing &&
            isOn('stash.phases') &&
            hasPlanMark(p) &&
            (p.sendAt ?? 0) <= (await $.clock.now())
        ) {
            await saveOrbit($, {
                ...(await currentOrbit($)),
                plan: planTaken(p),
            });
            notes.push(planText(p));
        }
        if (
            !isNudged &&
            isOn('stash.phases') &&
            ++turnTools >= NUDGE_AT &&
            isWorkTurn &&
            !(o.plan && o.plan.at >= o.turns + 1 - PLAN_QUIET_TURNS)
        ) {
            isNudged = true;
            notes.push(
                o.plan
                    ? `phases not set for ${PLAN_QUIET_TURNS + 1} turns — update them with ${ORBIT_TOOL} plan`
                    : `no phases yet — set them with ${ORBIT_TOOL} plan`,
            );
        }
        if (!notes.length) return r;
        return { ...r, context: [...(r.context ?? []), ...notes] };
    });

    // the band: one row — orbit's and the plan's counts, the meters' readings, the 🔭 mark, the switches — then the bars,
    // the away digest and a refused threshold's one line
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
        try {
            return cleanTree(
                await (async () => {
                    if (e.surface !== 'terminal' && e.surface !== 'desktop')
                        return next(e);
                    // the published view and orbit, never the module's values: reading them subscribes this band, and a write redraws it
                    const view =
                        (await $.state.get(VIEW)).value ?? viewOf(false);
                    const enhancer = (await $.state.get(ENHANCER)).value ?? {
                        status: 'idle' as const,
                    };
                    const o = (await $.state.get(ORBIT)).value ?? orbit;
                    const ui = $.ui.resolve(e);
                    const { Box, Text, Button } = ui;
                    const handleAfkFlip = async () => {
                        const was = (await $.store.get(AFK_KEY)) as
                            | { at?: number; on?: boolean }
                            | undefined;
                        // the store's value, never the module copy: another session may have flipped it since the last poll
                        afk = !was?.on;
                        digest =
                            !afk && was?.on && was.at !== undefined
                                ? await awayDigest($, was.at)
                                : undefined;
                        await $.store.set(AFK_KEY, {
                            at: await $.clock.now(),
                            on: afk,
                        });
                        await publish($);
                    };
                    // one switch for every session, kept in the store so a restart keeps it
                    const handleWakerFlip = async () => {
                        isWaker = !view.isWaker;
                        await $.store.set(WAKER_KEY, { on: isWaker });
                        await publish($);
                    };
                    const handleHotFlip = async () => {
                        const now = await $.clock.now();
                        hot = hot
                            ? undefined
                            : { since: isBusy ? now : (endedAt ?? now) };
                        await saveHot($);
                        await armHot($);
                        await publish($);
                    };
                    const tip = (
                        key: string,
                        words: string,
                        control: RenderElement,
                        place: { left: number } | { right: number },
                        press?: { hotkey: string; onPress: () => void },
                    ) => hoverTip(ui, key, words, control, place, press);
                    const boardOpen = view.isBoardOpen;
                    const isShown = (key: string) =>
                        view.shown?.[key] !== false;
                    const handleSettingsFlip = async () => {
                        isSettingsOpen = !view.isSettingsOpen;
                        if (isSettingsOpen)
                            await $.ui.open({
                                id: SETTINGS_PANE,
                                title: '🎛️ settings',
                            });
                        else await $.ui.close({ id: SETTINGS_PANE });
                        await publish($);
                    };
                    const handleBoardFlip = async () => {
                        if (await isOpen($)) await $.ui.close({ id: BOARD });
                        else await openBoard($);
                        await publish($);
                    };
                    // a terminal draws a chromed Button as `[ label ]`
                    const leftOf = (label: string, chrome: boolean) => ({
                        right: [...label].length + (chrome ? 4 : 0) + 1,
                    });

                    // the chips: text, never a control — 🚦 already opens the board, where orbit and the plan live (dima, 2026-10-10)
                    const openAsks = o.asks.filter((a) => !a.isResolved).length;
                    // every chip names itself on hover in five words or fewer (dima, 20:13)
                    const planned = o.plan?.lines.length ?? 0;
                    const asksChip = `🪐 ${openAsks}`;
                    const planChip = `🌔 ${planned}`;
                    const chips = (
                        <Box
                            flexDirection='row'
                            flexShrink={0}
                            gap={1}
                            key='chips'>
                            {tip(
                                'chip:asks',
                                `${openAsks} open ask${openAsks === 1 ? '' : 's'} for you`,
                                <Text
                                    bold={openAsks > 0}
                                    color={openAsks ? ACCENT : undefined}
                                    dimColor={!openAsks}>
                                    {asksChip}
                                </Text>,
                                { left: [...asksChip].length + 1 },
                            )}
                            {tip(
                                'chip:plan',
                                `${planned} phase${planned === 1 ? '' : 's'}`,
                                <Text dimColor={!planned}>{planChip}</Text>,
                                { left: [...planChip].length + 1 },
                            )}
                        </Box>
                    );

                    // the meters: two short bars in the row, each ending in its %; the readings sit beside them
                    const meter = (await $.state.get(METER)).value;
                    const now = await $.clock.now();
                    const Svg =
                        e.surface === 'desktop'
                            ? $.ui.resolve(e).Svg
                            : undefined;
                    const isBreathing =
                        (Boolean(e.props.isWorking) &&
                            (await readSwitch($, 'breathe'))) ||
                        (await readSwitch($, 'always'));
                    // the 🎛️ speed: 1× sparks a cell every 1.6–4.4 s, 0.5× (the default, dima 12:58) twice as slow
                    const breathMs =
                        (BREATH_MS * SPEED.of) / (await readNumber($, 'speed'));
                    const five = meter?.fiveHour;
                    const pace =
                        five?.resetsAt === undefined
                            ? undefined
                            : paceOf(five.resetsAt, now);
                    const gap =
                        five && pace !== undefined
                            ? Math.round(five.used - pace)
                            : undefined;
                    const fiveTint = gapTint(gap ?? 0);
                    const ctx = meter?.context;
                    const ctxTint = contextFill(ctx ?? 0, meter?.compactAt);
                    // the meters run the band's full width, one bar a row under the row (dima, 20:45: «bring back old wide meters»);
                    // the band knows only its columns: 9.6 px a column overshoots every desktop seen (7.8 once, ~9 after the 10-28
                    // update), and the slot clamps the bar back to its width
                    const svgCells = Math.max(
                        8,
                        Math.floor(
                            (e.props.bodyColumns * 9.6 - 90) / CELL_STEP,
                        ),
                    );
                    const barJSX = (
                        key: string,
                        label: string,
                        words: string,
                        tint: string,
                        bar?: {
                            percent: number;
                            mark?: number;
                            scale?: number;
                        },
                        marginTop = 0,
                    ) => (
                        <Box
                            alignItems='center'
                            flexDirection='row'
                            gap={Svg ? 0.5 : 1}
                            key={key}
                            marginTop={marginTop}>
                            <Box flexShrink={0} width={Svg ? 5 : 6}>
                                {tip(
                                    key,
                                    words,
                                    <Text wrap='truncate-end'>{label}</Text>,
                                    {
                                        left: [...label].length + 1,
                                    },
                                )}
                            </Box>
                            {bar === undefined ? (
                                <Text dimColor>no reading yet</Text>
                            ) : (
                                // the % ends on the band's right edge, under the row's last button
                                <Box
                                    alignItems='center'
                                    flexDirection='row'
                                    flexGrow={1}
                                    gap={1}
                                    justifyContent='space-between'>
                                    {Svg ? (
                                        <Box flexGrow={1} minWidth={0}>
                                            <Svg
                                                alt={`${label} ${Math.round(bar.percent)}%`}
                                                height={BAR_HEIGHT}
                                                key={`${key}:svg`}
                                                source={meterSvg(
                                                    bar.percent,
                                                    svgCells,
                                                    bar.mark,
                                                    bar.scale,
                                                    isBreathing
                                                        ? now
                                                        : undefined,
                                                    breathMs,
                                                )}
                                            />
                                        </Box>
                                    ) : null}
                                    <Box
                                        flexShrink={0}
                                        justifyContent='flex-end'
                                        width={4}>
                                        <Text bold color={tint}>
                                            {`${Math.round(bar.percent)}%`}
                                        </Text>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    );
                    const meterInfoJSX = (
                        <Box
                            flexDirection='row'
                            flexShrink={1}
                            gap={1}
                            key='meter:info'
                            minWidth={0}>
                            {!isShown('stash.pace') || gap === undefined
                                ? null
                                : tip(
                                      'pace',
                                      gap > 0
                                          ? 'behind the 5h pace'
                                          : 'ahead of the 5h pace',
                                      // room reads 🔋 green, over the pace 🪫 red at any size (dima's o46, 21:37)
                                      <Text
                                          bold
                                          color={
                                              gap > 0
                                                  ? RAMP[2]
                                                  : METER_TINTS.calm5h
                                          }>
                                          {gap > 0
                                              ? `🪫 -${gap}%`
                                              : `🔋 +${-gap}%`}
                                      </Text>,
                                      { left: 10 },
                                  )}
                            {!isShown('stash.reset') ||
                            five?.resetsAt === undefined ||
                            five.resetsAt <= now
                                ? null
                                : tip(
                                      'reset',
                                      'until the 5h window resets',
                                      // rounded up like cc's own «resets in 1 min», so it never reads 0m (o103)
                                      <Text>
                                          ⏳{' '}
                                          {span(
                                              Math.ceil(
                                                  (five.resetsAt - now) /
                                                      60_000,
                                              ) * 60_000,
                                          )}
                                      </Text>,
                                      { left: 9 },
                                  )}
                        </Box>
                    );
                    const switches = (
                        <Box
                            flexDirection='row'
                            flexShrink={0}
                            gap={e.surface === 'desktop' ? 0.6 : 1}
                            key='switches'>
                            {!isShown('stash.second-wind') || !view.selfId
                                ? null
                                : tip(
                                      'wind',
                                      view.wind
                                          ? `second wind: ${WIND_SAY[view.wind]}`
                                          : 'second wind: refresh this session at a good stop',
                                      <Button
                                          key='wind'
                                          onPress={() =>
                                              void pressWind(
                                                  $,
                                                  view.selfId ?? '',
                                              )
                                          }
                                          {...(view.wind
                                              ? {
                                                    variant:
                                                        'secondary' as const,
                                                }
                                              : { plain: true as const })}>
                                          {WIND_EMOJI[view.wind ?? 'idle']}
                                      </Button>,
                                      leftOf(
                                          WIND_EMOJI[view.wind ?? 'idle'],
                                          !!view.wind,
                                      ),
                                  )}
                            {!isShown('stash.hot')
                                ? null
                                : tip(
                                      'hot',
                                      view.isHot
                                          ? "stop keeping this session's cache hot"
                                          : "keep this session's cache hot: ping every 50 min",
                                      <Button
                                          key='hot'
                                          onPress={() => void handleHotFlip()}
                                          {...(view.isHot
                                              ? {
                                                    variant:
                                                        'secondary' as const,
                                                }
                                              : { plain: true as const })}>
                                          🔥
                                      </Button>,
                                      leftOf('🔥', !!view.isHot),
                                  )}
                            {!isShown('stash.waker')
                                ? null
                                : tip(
                                      'waker',
                                      view.isWaker
                                          ? 'stop waking capped sessions at the 5h reset'
                                          : 'wake every session stopped on the 5h cap',
                                      <Button
                                          key='waker'
                                          onPress={() => void handleWakerFlip()}
                                          {...(view.isWaker
                                              ? {
                                                    variant:
                                                        'secondary' as const,
                                                }
                                              : { plain: true as const })}>
                                          ⏰
                                      </Button>,
                                      leftOf('⏰', view.isWaker),
                                  )}
                            {!isShown('stash.afk')
                                ? null
                                : tip(
                                      'afk',
                                      view.afk
                                          ? 'back: tell fleet that dima is here'
                                          : 'afk: tell fleet that dima is away',
                                      <Button
                                          key='afk'
                                          onPress={() => void handleAfkFlip()}
                                          {...(view.afk
                                              ? {
                                                    variant:
                                                        'secondary' as const,
                                                }
                                              : { plain: true as const })}>
                                          💨
                                      </Button>,
                                      leftOf('💨', view.afk),
                                  )}
                            {tip(
                                'settings',
                                view.isSettingsOpen
                                    ? 'fold the settings'
                                    : 'settings: show or hide each part',
                                <Button
                                    key='settings'
                                    onPress={() => void handleSettingsFlip()}
                                    {...(view.isSettingsOpen
                                        ? { variant: 'secondary' as const }
                                        : { plain: true as const })}>
                                    🎛️
                                </Button>,
                                leftOf('🎛️', view.isSettingsOpen),
                            )}
                            {!isShown('stash.board')
                                ? null
                                : tip(
                                      'board',
                                      boardOpen
                                          ? 'fold fleet board'
                                          : 'unfold fleet board',
                                      <Button
                                          key='board'
                                          onPress={() => void handleBoardFlip()}
                                          {...(boardOpen
                                              ? {
                                                    variant:
                                                        'secondary' as const,
                                                }
                                              : { plain: true as const })}>
                                          🚦
                                      </Button>,
                                      leftOf('🚦', boardOpen),
                                      {
                                          hotkey: 'b',
                                          onPress: () => void handleBoardFlip(),
                                      },
                                  )}
                        </Box>
                    );
                    // the readings pack left after the chips, then this session's 🔭 mark, always drawn; the switches hold the right
                    // edge (dima's o6 and o7, 22:03)
                    // 🪄 ⏪ ⏩, beside the switches, each named on hover in a few words (dima, 23:13); while the call runs 🪄 rests
                    // dimmed as if disabled, the api has no `disabled` and a press then is a no-op (dima, 2026-10-11 11:56); each emoji
                    // draws two cells, so its card sits two past it
                    const isEnhancing = enhancer.status === 'running';
                    const enhancerJSX = (
                        <Box
                            flexDirection='row'
                            flexShrink={0}
                            gap={1}
                            key='enhancer'>
                            {tip(
                                'enh:enhance',
                                isEnhancing
                                    ? 'enhancing; type to cancel'
                                    : 'enhance prompt',
                                <Button
                                    dimColor={isEnhancing}
                                    key='enh:enhance'
                                    onPress={() => void enhance($)}
                                    plain>
                                    🪄
                                </Button>,
                                { right: 3 },
                            )}
                            {enhancer.original !== undefined
                                ? tip(
                                      'enh:prev',
                                      'your text',
                                      <Button
                                          key='enh:prev'
                                          onPress={() => void enhancePrev($)}
                                          plain>
                                          ⏪
                                      </Button>,
                                      { right: 3 },
                                  )
                                : null}
                            {enhancer.latest !== undefined
                                ? tip(
                                      'enh:new',
                                      'enhanced text',
                                      <Button
                                          key='enh:new'
                                          onPress={() => void enhanceNew($)}
                                          plain>
                                          ⏩
                                      </Button>,
                                      { right: 3 },
                                  )
                                : null}
                        </Box>
                    );
                    // each «waiting on <who>» part of a 🔭 wait prints <who> bold, its «— how» tail plain (dima, 2026-10-10 23:54)
                    const waitJSX = (wait: string) =>
                        wait.split('; ').map((part, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: a wait's place in the line is its identity
                            <Text key={`wait:${i}`}>
                                {i > 0 ? '; ' : ''}
                                {waitSpans(part).map((span, k) =>
                                    span.isBold ? (
                                        // biome-ignore lint/suspicious/noArrayIndexKey: a span's place in the part is its identity
                                        <Text bold key={`span:${k}`}>
                                            {span.text}
                                        </Text>
                                    ) : (
                                        span.text
                                    ),
                                )}
                            </Text>
                        ));
                    const row = (
                        <Box
                            alignItems='center'
                            flexDirection='row'
                            gap={1}
                            justifyContent='space-between'
                            key='row'>
                            <Box
                                alignItems='center'
                                flexDirection='row'
                                flexGrow={1}
                                flexShrink={1}
                                gap={1}
                                key='row:readings'
                                minWidth={0}>
                                {isShown('stash.chips') ? chips : null}
                                {meterInfoJSX}
                                {isShown('stash.wait') ? (
                                    <Box flexShrink={1} key='wait' minWidth={0}>
                                        <Text
                                            color='inactive'
                                            wrap='truncate-end'>
                                            {'🔭 '}
                                            {view.wait
                                                ? waitJSX(view.wait)
                                                : 'not waiting'}
                                        </Text>
                                    </Box>
                                ) : null}
                            </Box>
                            {isShown('stash.enhancer') ? enhancerJSX : null}
                            {switches}
                        </Box>
                    );
                    // desktop air above and between the bars; a terminal row cannot be split, so none there
                    const air = e.surface === 'desktop';
                    const meters = (
                        <Box
                            flexDirection='column'
                            flexShrink={0}
                            key='meters'
                            marginTop={air ? 0.5 : 0}
                            paddingRight={air ? 1 : 0}>
                            {!isShown('stash.5h')
                                ? null
                                : barJSX(
                                      'meter:5h',
                                      '🔥 5h',
                                      '5h window used',
                                      fiveTint,
                                      five
                                          ? { mark: pace, percent: five.used }
                                          : undefined,
                                  )}
                            {!isShown('stash.ctx')
                                ? null
                                : barJSX(
                                      'meter:ctx',
                                      '🧠 ctx',
                                      'context window used',
                                      ctxTint,
                                      ctx === undefined
                                          ? undefined
                                          : {
                                                mark: meter?.compactAt,
                                                percent: ctx,
                                                scale: meter?.compactAt ?? 100,
                                            },
                                      air ? 0.4 : 0,
                                  )}
                        </Box>
                    );
                    const away =
                        isShown('stash.digest') &&
                        view.digest &&
                        (view.digest.needs.length || view.digest.done.length)
                            ? [
                                  <Text dimColor key='away'>
                                      while you were away
                                  </Text>,
                                  ...view.digest.needs.map((n) => (
                                      <Text
                                          key={`away:n:${n.sid}`}
                                          wrap='truncate-end'>
                                          {`needs you · ${n.name} · 🪐 ${n.asks}`}
                                      </Text>
                                  )),
                                  ...view.digest.done.map((d) => (
                                      <Text
                                          dimColor
                                          key={`away:d:${d.sid}`}
                                          wrap='truncate-end'>
                                          {`done · ${d.name}`}
                                      </Text>
                                  )),
                              ]
                            : [];
                    return (
                        <Box flexDirection='column'>
                            {row}
                            {/* the terminal reads the 5h and ctx on sline's line; the desktop keeps the bars (dima, 15:06) */}
                            {Svg ? meters : null}
                            {enhancer.error ? (
                                <Text
                                    color='error'
                                    key='enh:error'
                                    wrap='truncate-end'>
                                    {enhancer.error}
                                </Text>
                            ) : null}
                            {meter?.note ? (
                                <Text color='error' wrap='truncate-end'>
                                    {meter.note}
                                </Text>
                            ) : null}
                            {away}
                            {await next(e)}
                        </Box>
                    );
                })(),
            );
        } catch (err) {
            $.ui.log(`x-mod-stash: the band failed to draw: ${String(err)}`);
            const { Box, Text } = $.ui.resolve(e);
            return cleanTree(
                <Box>
                    <Text color='error'>
                        ⚠️ x-mod-stash: the band failed to draw, the debug log
                        names why
                    </Text>
                </Box>,
            );
        }
    });
};
