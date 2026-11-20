/* @jsx h */
import type { EngineInterface, Register, RenderElement } from 'claude-code';

import type {
    OrbitAsk,
    QuietLogLine,
    StashCap,
    StashEntry,
    StashLane,
    StashPlan,
} from '../types/stash.d.ts';
import { BAND_READ, BAND_REFUSED, takeBandPresses } from './band-presses.ts';
import {
    askBox,
    carried,
    dropKept,
    field,
    flushFields,
    forgetMountedText,
    isTypedHere,
    leaveBoxes,
    offerBack,
    retakeFields,
    returnToBoxes,
    steerOf,
    takeFieldsOnce,
} from './fields.ts';
import {
    WIND_DELAY_MS,
    armHeldTells,
    armRelease,
    holdAfterQuiet,
    holdSteer,
    isQuietHome,
    quietLocked,
    steersOnCompact,
    takeSteers,
} from './held.ts';
import {
    JOIN_OWED,
    handBackJoins,
    joinsLocked,
    settleJoins,
    takeJoins,
} from './joins.ts';
import {
    AUTO_WIND,
    PACE,
    PING,
    POLL_MS,
    WAKE_SLACK_MS,
    armHot,
    followHot,
    holdAfk,
    holdHot,
    holdWaker,
    hotLate,
    isPaceOn,
    pacePoll,
    paceStep,
    prepareTurn,
    pressHot,
    restoreAfk,
    seatDefaults,
    setAfk,
    setHot,
    setWaker,
    warm,
    writeWaker,
} from './keep-warm.ts';
import {
    LANE_ROLES,
    LANE_STEER,
    LANE_STEER_OLD,
    changeLaneSteer,
    dropLaneOrders,
    followCodies,
    followPlans,
    laneRows,
    laneSpan,
    laneSteers,
    openDispatchedLanes,
    readLanes,
    reshowLanes,
    showLanes,
    takeLaneMoves,
} from './lanes.ts';
import {
    BAR_HEIGHT,
    BREATH_MS,
    CELL_STEP,
    CTX_BAR,
    CTX_FALLBACK_AT,
    CTX_RING,
    EFFORT_CELL,
    METER_TINTS,
    PALETTE,
    RAMP,
    contextFill,
    ctxBar,
    ctxBarSvg,
    ctxRingSvg,
    effortCells,
    effortLevel,
    effortSvg,
    gapTint,
    huesOf,
    idleTint,
    markOf,
    meterSvg,
    span,
    statusOf,
} from './look.ts';
import {
    CHANGED_MARK,
    ORBIT_TOOL,
    isAllAsksMarkable,
    isFresh,
    joinRowsText,
    joinText,
    linkLabel,
    moved,
    oneLine,
    orbitOp,
    planText,
    turnEnded,
    wrongText,
} from './orbit.ts';
import {
    DIMA_AT,
    pressAllAsks,
    pressMark,
    takeMarks,
    takePlanMark,
    wakeForMarks,
} from './orbit-presses.ts';
import {
    EMPTY_ORBIT,
    KEPT,
    PREFIX,
    absorbMarks,
    changeAssumed,
    currentOrbit,
    inMarking,
    keepState,
    markAsks,
    orbitNow,
    saveOrbit,
    startOrbit,
} from './orbit-store.ts';
import {
    LANE_OWNER,
    LANE_STALE,
    ORBIT_ABOUT,
    ORBIT_PROPS,
    orbitCall,
    ticketNote,
} from './orbit-tool.ts';
import { setOverrideOn, writeOverrideOff } from './override.ts';
import { PACE_KEYS, PACE_SETTINGS, paceOf } from './pace.ts';
import { relayCrowWake, wakeForParkedLanes } from './parked-wake.ts';
import {
    TRANSCRIPT_TAIL,
    boldFleetWords,
    bulletDots,
    capOf,
    dropWaitAside,
    linkTickets,
    memberBadge,
    numberCircled,
    parseWait,
    ticketOf,
    unbold,
    waitSpans,
} from './parse.ts';
import { isAppPrompt, peerPing, quietHeldText } from './quiet.ts';
import { quietLog, takeGapNotes } from './quiet-books.ts';
import {
    SEND_TOOL,
    quietBooks,
    quietHoldPrompt,
    quietIdle,
    quietKindsOff,
    quietNote,
    quietOf,
    quietSendEnd,
    quietSendStart,
    quietTake,
    quietWhy,
    saveQuiet,
} from './quiet-gate.ts';
import { WRAP_UP_TOOL, settleTask, stopRed, waitsOf } from './reply-fix.ts';
import type { Member } from './roster.ts';
import { isOpen, memberOf, modelLabel, registry } from './roster.ts';
import { laneRoundLine } from './rounds.ts';
import {
    MAIN_ROLE,
    SUCC,
    WING_ROLE,
    currentId,
    endIdentity,
    identity,
    isLaneOwner,
    refreshThreads,
    sessionName,
    startIdentity,
    threadRecords,
} from './session-identity.ts';
import { dropState, keepShelf, pollShelf } from './session-record.ts';
import type { NumberName, SwitchName } from './settings-store.ts';
import {
    NUMBERS,
    PARTS,
    QUIET_KINDS,
    QUIET_ON,
    SHOWN,
    SPEED,
    SWITCHES,
    flipKnob,
    flipPart,
    knobRefusals,
    partsShown,
    readNumber,
    readSwitch,
    setKnobNumber,
    setSettingsOpen,
    shownOf,
    takeHerdrRows,
} from './settings-store.ts';
import { isSpeakingNow, playPress, refreshSpeaking, speak } from './speak.ts';
import {
    AFK_KEY,
    HOT,
    MODEL,
    REPLY,
    type Reply,
    WAKER_KEY,
    hotOf,
} from './store-keys.ts';
import { cleanTree, drawn } from './tree.ts';
import {
    bookkeep,
    clearWrap,
    countTool,
    endBusy,
    endStop,
    endUserTurn,
    isTurnBusy,
    markActive,
    markNudged,
    markWork,
    markWrapAsked,
    restoreTurn,
    selfSubmit,
    setPrimed,
    setTurnAfk,
    startTurn,
    turn,
} from './turn.ts';
import {
    LANE_STALE_TEXT,
    STALE_TURNS,
    filled,
    forgetTold,
    noBoardReminder,
    orbitReminder,
    orbitTexts,
    planAge,
    tickSentence,
    toldOrbit,
    toldOrbitAs,
    toldStaleAs,
    toldStaleLanes,
} from './turn-notes.ts';
import {
    CONTEXT,
    drawFill,
    drawFillAfterCompact,
    freshMeter,
    measureUsage,
    meterNow,
    setCompactAt,
} from './usage.ts';
import { STALE_MS, errorText } from './util.ts';
import {
    band,
    drawBand,
    load,
    patchBand,
    pressSwitch,
    publish,
    viewDoors,
    viewOf,
} from './view.ts';
import { COMPACTING, WIND, flipWind, windAfterPress, windOf } from './wind.ts';
import {
    COMPACT_SETTLE_MS,
    FILL,
    WIND_EMOJI,
    nextTurnNo,
    seedTurnNo,
    setAutoWind,
    syncWindStore,
    takeFill,
    takeWind,
    windAfterTurn,
    windBlock,
    windOnCompact,
    windSay,
} from './wind-run.ts';

// x-mod-stash: dima's command center above the prompt, one row; FTR.md lists every feature.
// orbit: the session's asks to dima and its plan, written through its own tool, ticked in the board; its open asks are
// mirrored into $.store (one key per session), so the board counts every session's.
// afk: one switch every session polls; while it is on, every prompt carries an away note, and a flip reaches a running turn.
// keep-hot: while on and idle, one ping 50 min after the last turn ended keeps the prompt cache warm; the switch lives in $.store, so a reload keeps it

// label: the repo; name: the session's registry name, when it has one
type Entry = StashEntry;
// a card that only shows asks: their keys' prefix, no tick, replay, sound or steer (a lane member's, FRM-643)
type ViewDoor = { prefix: string };
// where an ask card's tick, replay and steer go, and the prefix its keys carry
type AskDoor = {
    prefix: string;
    mark: (a: OrbitAsk, mark: 'accepted' | 'rejected') => void;
    // resolves once the steer is written: a flush before a prompt waits on it
    steer: (a: OrbitAsk, value: string) => unknown;
};

const KEPT_MS = 7 * 24 * 60 * 60 * 1000;
const AWAY_NOTE =
    'dima is afk: nothing waits on him. take reversible steps and log them, pick every pending ask and log its undo, raise one in orbit only when blocked, on his design call, or irreversible. send no ping.';
const BACK_NOTE = 'dima is back from afk: orbit and pings reach him again.';
// 5 min past its last event, a session's bookkeeping jobs tick every 30 s; what dima pressed, typed or ticked, and the
// wakes, keep 4 s (FRM-555, dima o58, o59)
const IDLE_AFTER_MS = 5 * 60_000;
const IDLE_POLL_MS = 30_000;
// the fleet board: cc's registry gives each session's state; each session's stash adds its 🔭 wait and context fill
const BOARD = 'x-cc-deck';
// read-both: the board's id before dima's x-cc-deck name (o25); a reload finds it open and swaps it
const OLD_BOARD = 'fleet-board';
// 🎛️ is a pane of its own, which the surface tabs beside 🚦: the band is capped by cc, the list outgrew it (dima's pick a of
// four homes, 16:20); a tab row inside a pane was proven too, kept as an idea in api-map.md
const SETTINGS_PANE = 'stash-settings';
// dima at the prompt, typing into a background job, on his phone or the web
const DIMA_ORIGINS = ['composer', 'sdk', 'bridge'] as const;
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
const CAP = { key: 'cap', plugin: 'x-mod-stash' } as const;
// the 5h cap ends the turn as an API error with this text; the weekly cap and spent credits read otherwise
// (8 rows in the transcripts, 2026-10-08)
const CAPPED = /hit your session limit/i;
const RESUME =
    'x-mod-stash waker: the 5h window reset. pick up where you stopped.';
// the last few error-ended turns as the hook saw them, so the cap's real text is measured, never inferred (riders 11-02)
const CAP_SEEN = 'cap-seen';
const CAP_SEEN_MAX = 5;
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
const CLIO_ASKS = { key: 'clioAsks', plugin: 'x-mod-stash' } as const;
// a glide card's member subcard or a quiet card, folded by default
const FOLDED_CARD = new RegExp(
    `^(lane:[^:]+:(${LANE_ROLES.join('|')})|quiet:.+)$`,
);
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

let isPolling = false;

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
// the 5h reset as the last session.measure reported it, and this session's cap state
let fiveHourResetsAt: number | undefined;
// the 5h window's fill at the last measure: an error end this full is read as the cap when no entry names it (FRM-488)
let fiveHourPercent: number | undefined;
const CAP_FULL_PERCENT = 95;
let cap: StashCap | undefined;
let capGen = 0;
// the model label last written for this session, so a step writes the store only when it changes
let modelSeen: string | undefined;

// dima asking clio about cost: her context points at the price facts once, so she never answers from recall (o171; 10-13
// she quoted a cache read at 1/10 of input, the file says 1/20)
export const COST_WORDS =
    /\b(?:tokens?|cach(?:e|ed|ing)|(?:ctx|context) costs?|pricing|mtok)\b/i;
const COST_HINT =
    "💵 a cost question: read ~/frame/home/.claude/plugin-x/skills/crew-lead/references/model-cards.md before answering (each model's price line, and the «cache reads are where agents spend» bullet), never from recall.";

// each live clio, main and wings, with its own orbit asks that wait on dima: unmarked, as it last published them; read at
// the poll into $.state, since the board draws with no file read
let clioAsksShown = '';
async function showClioAsks($: EngineInterface) {
    if (!(await isOpen($)) || !(await partsShown($))('stash.orbit')) return;
    const waiting = await cliosWaiting($);
    const text = JSON.stringify(waiting);
    if (text === clioAsksShown) return;
    clioAsksShown = text;
    await $.state.set(CLIO_ASKS, waiting).catch(() => undefined);
}
async function cliosWaiting($: EngineInterface) {
    const live = new Set(
        (await registry($)).filter((r) => r.isAlive).map((r) => r.base.sid),
    );
    const self = await currentId($);
    const clios = (await threadRecords($)).filter(
        (t) =>
            (t.role === MAIN_ROLE || t.role === WING_ROLE) &&
            live.has(t.sessionId),
    );
    const waiting: { isSelf: boolean; n: number; name: string; sid: string }[] =
        [];
    for (const t of clios) {
        const entry = (await $.store
            .get(PREFIX + t.sessionId)
            .catch(() => undefined)) as Entry | undefined;
        const n = (entry?.items ?? []).filter((a) => !a.mark).length;
        if (n)
            waiting.push({
                isSelf: t.sessionId === self,
                n,
                name: t.display ?? t.name ?? t.sessionId,
                sid: t.sessionId,
            });
    }
    return waiting;
}

// the lane steers dima took with 🛎️, as clio reads them; each leaves the lane once read
async function takeLaneSteers($: EngineInterface, lanes: StashLane[]) {
    const steers = await laneSteers($);
    const taken = lanes.filter((l) => !l.endedAt && steers[l.id]?.isTaken);
    if (!taken.length) return [];
    carried(
        $,
        taken.map((l) => `lane:${l.id}:steer`),
    );
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

// a clio boot whose board has not printed: the skill loaded in the last hours, no board-length reply since
async function isBootOpen($: EngineInterface) {
    if (!(await isLaneOwner($))) return false;
    const at = await $.store.get(BOOT + (await $.session.id()));
    return typeof at === 'number' && (await $.clock.now()) - at < BOOT_MS;
}

// a file an ask links to opens in its app; `~/` is the home dir, the path an argv item, never a shell word
async function openPath($: EngineInterface, path: string) {
    const home = (await $.env.get('HOME')) ?? '';
    await $.process
        .run(['open', path.replace(/^~(?=\/)/, home)])
        .catch(() => undefined);
}

// everything this mod keeps for one conversation: one store key per prefix, the session id after it, plus its pending
// lane marks; a new per-session key joins this list, or a /clear leaves it behind for good (marks did, FRM-400)
const SESSION_KEYS = [
    PREFIX,
    HOT,
    REPLY,
    CONTEXT,
    MODEL,
    WIND,
    FILL,
    AUTO_WIND,
] as const;

async function forget($: EngineInterface, sid: string) {
    const home = await $.env.get('HOME').catch(() => undefined);
    const isHandedBack = home
        ? await handBackJoins($, home, sid).catch(() => false)
        : true;
    if (!isHandedBack)
        await $.store.set(JOIN_OWED + sid, true).catch(() => undefined);
    await dropState($, sid).catch(() => undefined);
    await $.store.delete(BAND_READ + sid);
    await $.store.delete(BAND_REFUSED + sid);
    for (const prefix of SESSION_KEYS) await $.store.delete(prefix + sid);
}

// a session that exited keeps only its last reply, marked ended, dropped a day later
async function retire($: EngineInterface, sid: string) {
    const reply = (await $.store.get(REPLY + sid)) as Reply | undefined;
    const heat = await $.store.get(HOT + sid);
    const autoWind = await $.store.get(AUTO_WIND + sid);
    await forget($, sid);
    if (autoWind) await $.store.set(AUTO_WIND + sid, autoWind);
    // a resume of this id keeps dima's off: a seat's default fills only a key never written
    if (heat && !hotOf(heat)) await $.store.set(HOT + sid, heat);
    if (reply)
        await $.store.set(REPLY + sid, {
            ...reply,
            ended: await $.clock.now(),
        } satisfies Reply);
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

async function pressWind($: EngineInterface, sid: string) {
    await flipWind($, sid);
    await load($);
}

async function keepCapSeen(
    $: EngineInterface,
    text: string,
    isCapped: boolean,
    isUnread = false,
) {
    const kept =
        ((await $.store.get(CAP_SEEN).catch(() => undefined)) as
            | { at: number; isCapped: boolean; isUnread?: true; text: string }[]
            | undefined) ?? [];
    const seen = {
        at: await $.clock.now(),
        isCapped,
        ...(isUnread ? { isUnread: true as const } : {}),
        text: text.slice(0, 300),
    };
    await $.store
        .set(CAP_SEEN, [...kept, seen].slice(-CAP_SEEN_MAX))
        .catch(() => undefined);
}

// the reset a cap waits on: the one its entry named, unless that is already past (a text reset read to the minute),
// then the 5h reset the last measure named
const resetOf = (named: number | undefined, now: number) =>
    named !== undefined && named > now ? named : fiveHourResetsAt;

async function capFromTranscript($: EngineInterface) {
    const sid = await currentId($);
    const home = await $.env.get('HOME').catch(() => undefined);
    if (!sid || !home) return undefined;
    const out = await $.process
        .run(['sh', '-c', TRANSCRIPT_TAIL, 'sh', home, sid])
        .catch(() => undefined);
    return out ? capOf(out.stdout) : undefined;
}

// a capped session's resume, armed for the reset it waits on; a turn start or a new cap bumps capGen, so an old timer
// never fires
async function armWake($: EngineInterface) {
    const mine = ++capGen;
    const at = cap?.resetsAt;
    if (at === undefined || cap?.sentFor === at) return;
    const wait = at + WAKE_SLACK_MS - (await $.clock.now());
    $.clock.after(Math.max(0, wait), async () => {
        if (mine !== capGen || turn.isBusy || !cap) return;
        // the reset is spent at its fire, switch on or off: ⏰ flipped on later never wakes a reset already past (o102)
        cap = { ...cap, sentFor: at };
        await $.state.set(CAP, cap).catch(() => undefined);
        const waker = (await $.store.get(WAKER_KEY)) as
            | { on?: boolean }
            | undefined;
        if (waker?.on !== true || !(await partsShown($))('stash.waker')) return;
        $.ui.log('x-mod-stash waker: resumed the session after the 5h reset');
        await selfSubmit($, RESUME, false, () => prepareTurn(viewDoors($)));
    });
}

async function pressPace($: EngineInterface) {
    const sid = await currentId($);
    if (!sid) return;
    patchBand({ isPaced: !band.isPaced });
    await pressSwitch(
        $,
        '🔋',
        { isPaced: band.isPaced },
        async () =>
            $.store.set(
                PACE + sid,
                isPaceOn(await $.store.get(PACE + sid))
                    ? { off: true }
                    : { on: true },
            ),
        async () => {
            patchBand({ isPaced: !band.isPaced });
        },
    );
    await load($);
    await publish($);
    $.ui.invalidate('ui.render');
}

// each fact column's width in cells, sized to its usual reading — `🪐 12`, `FRM-306`, `ctx 54%`, `idle 12m` — so little slack shows between columns; a longer one is cut at its end
const COLUMNS = {
    asks: 4,
    // the terminal's 10-wide ctx bar; the desktop's svg takes its own width (CTX_COLUMNS)
    context: 10,
    ticket: 9,
} as const;

async function openBoard($: EngineInterface) {
    await $.ui.open({ closeOnEscape: true, id: BOARD, title: '🚦 board' });
}

// every control names itself on hover; the card stays on the control's row, since a one-row site clips the rest
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
                            onPress={() =>
                                void flipPart($, p.key, () => publish($))
                            }
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

// a pane's hover note: in the row's flow, between its label and its input; an absolute card wraps over its neighbours there
function noteOnHover(
    ui: ReturnType<EngineInterface['ui']['resolve']>,
    words: string,
) {
    const { Box, Text } = ui;
    return (
        <Box display='none' flexShrink={0} hover={{ display: 'flex' }}>
            <Text dimColor>{words}</Text>
        </Box>
    );
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

export const register: Register = (on) => {
    // session.start fires at startup and again on every hot reload; the classic event only at startup
    on('session.start', async ($, e, next) => {
        await startIdentity($, e.cwd);
        await seedTurnNo($, identity.selfId).catch(() => undefined);
        await refreshThreads($);
        await seatDefaults($, viewDoors($)).catch(() => undefined);
        await syncWindStore($).catch(() => undefined);
        await armHeldTells($, viewDoors($)).catch(() => undefined);
        const panes = await $.ui.panes().catch(() => undefined);
        if (panes?.some((p) => p.id === OLD_BOARD)) {
            await $.ui.close({ id: OLD_BOARD }).catch(() => undefined);
            await openBoard($).catch(() => undefined);
        }
        // what a reload finds in `$.state`, read once: every get of one dispatch reads the moment it began
        const kept = {
            cap: (await $.state.get(CAP)).value,
            ended: (await $.state.get(ENDED)).value,
            orbit: (await $.state.get(ORBIT)).value,
            turn: (await $.state.get(TURN)).value,
            view: (await $.state.get(VIEW)).value,
        };
        await startOrbit($, kept.orbit);
        // a start is where a reload lands: it always takes the kept boxes back
        await retakeFields($);
        // a reload after the steer rename or the catch removal keeps a held text: the migrated orbit is written back once
        // through saveOrbit, so a resumed orbit's open asks reach the store every board counts from
        if (
            JSON.stringify(orbitNow()) !==
            JSON.stringify(kept.orbit ?? EMPTY_ORBIT)
        )
            await saveOrbit($, orbitNow(), () => keepShelf($));
        // every board reads the fleet's lanes from the shelf file: at a start, a reload, and on each poll
        await reshowLanes($);
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
        // a mid-turn reload: the turn goes on, busy, and the band keeps what only it held
        restoreTurn(kept.ended ?? undefined, kept.turn ?? undefined);
        await pruneEnded($).catch(() => undefined);
        const stored = hotOf(await $.store.get(HOT + identity.selfId));
        holdHot(stored && { since: turn.endedAt ?? stored.since });
        // a reload drops the release timer: a compact-held list waiting for it goes in once the session is idle; armed after
        // a mid-turn reload's busy flag is back, so it never submits into a running turn
        armRelease($, viewDoors($), COMPACT_SETTLE_MS);
        await load($);
        await armHot($, viewDoors($));
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
                        "quiet comms: `/quiet on` holds members' messages off this thread unless they push, `off` passes them all; bare shows it",
                    name: 'quiet',
                })
                .catch(() =>
                    $.ui.log('x-mod-stash: /quiet was not registered'),
                );
        else
            await $.command
                .register({
                    description:
                        'quiet comms delivery test: send clio a test [progress] ping, no model; `pnpm mods:quiet-delivery-test` reads held → delivered',
                    name: 'quiet-delivery-test',
                })
                .catch(() =>
                    $.ui.log(
                        'x-mod-stash: /quiet-delivery-test was not registered',
                    ),
                );
        if (!isPolling) {
            isPolling = true;
            // a test's seam: a slower poll, read once, so a test over hours of mock time crosses fewer ticks; never a faster one
            const asked = Number(
                await $.env.get('X_STASH_POLL_MS').catch(() => undefined),
            );
            const pollMs = asked >= POLL_MS ? asked : POLL_MS;
            await markActive($).catch(() => undefined);
            const tick = () =>
                $.clock.after(pollMs, async () => {
                    const now = await $.clock.now();
                    const isBookkept =
                        turn.isBusy ||
                        now - turn.activeAt < IDLE_AFTER_MS ||
                        now - turn.bookkeptAt >= IDLE_POLL_MS;
                    if (isBookkept) bookkeep(now);
                    await takeHerdrRows($).catch(() => undefined);
                    await syncWindStore($).catch(() => undefined);
                    // an open board's view carries the tick's clock, so its «ago» times move on their own
                    await load($);
                    await followHot($, viewDoors($)).catch(() => undefined);
                    if (isBookkept) await freshMeter($).catch(() => undefined);
                    await absorbMarks($, () => keepShelf($), isTypedHere).catch(
                        () => undefined,
                    );
                    await wakeForMarks($, viewDoors($)).catch(() => undefined);
                    await takeBandPresses($, viewDoors($)).catch(
                        () => undefined,
                    );
                    // pollShelf paces itself every third tick; a gate here would slow it twice over
                    await pollShelf($);
                    await quietIdle($).catch(() => undefined);
                    if (isBookkept)
                        await quietBooks($, viewDoors($)).catch(
                            () => undefined,
                        );
                    await wakeForParkedLanes($, viewDoors($)).catch(
                        () => undefined,
                    );
                    await pacePoll($, viewDoors($)).catch(() => undefined);
                    await hotLate($, viewDoors($)).catch(() => undefined);
                    await relayCrowWake($).catch(() => undefined);
                    if (isBookkept) {
                        await followCodies($).catch(() => undefined);
                        await openDispatchedLanes($, (input) =>
                            orbitCall($, input, false),
                        ).catch(() => undefined);
                        await showClioAsks($).catch(() => undefined);
                        await followPlans($).catch(() => undefined);
                    }
                    // a fold or mobile mode is kept within one poll of its change
                    await keepState($).catch(() => undefined);
                    // speak's own controls move its play state: a press reads it fresh
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
    on('ui.press', async ($, e, next) => {
        await markActive($).catch(() => undefined);
        await flushFields($, viewDoors($));
        return next(e);
    });

    on('prompt.submit', async ($, e, next) => {
        await markActive($).catch(() => undefined);
        await flushFields($, viewDoors($));
        // the app sends no attachment, and a drop would lose his image with the prompt
        const isAppShaped = e.origin?.kind === 'sdk' && !e.attachments?.length;
        // the engine's own idle notice is meta; its parser takes nothing but that notice's whole shape
        const isEngineNotice = e.isMeta === true && !e.attachments?.length;
        const hold =
            isAppShaped || isEngineNotice
                ? await quietLocked(() =>
                      quietHoldPrompt($, e.text, isEngineNotice),
                  ).catch(() => undefined)
                : undefined;
        if (hold?.drop !== undefined) return { drop: hold.drop };
        // a background task's notice may reach the session as a prompt, dequeued when it went idle (the origin's docs)
        if (e.origin?.kind === 'task-notification')
            await settleTask($, e.text, viewDoors($)).catch(() => undefined);
        const isUser =
            !e.isMeta &&
            !(isAppShaped && isAppPrompt(e.text)) &&
            e.text.trim().length > 0 &&
            (DIMA_ORIGINS as readonly string[]).includes(e.origin?.kind ?? '');
        if (isUser && BACK_AT_MAC.test(e.text))
            await $.state.set(MOBILE, false).catch(() => undefined);
        // prompt.submit fires when a prompt is queued (engine.md): one queued behind a running turn is no turn of its own yet
        const isQueued = turn.isBusy;
        await startTurn($, isUser, e.text === PING, () =>
            prepareTurn(viewDoors($)),
        );
        // the clock rides every prompt, so a reply's 📄 stamp copies it instead of guessing
        const at = new Date(await $.clock.now());
        const offset = -at.getTimezoneOffset() / 60;
        const clock = `now ${at.toTimeString().slice(0, 5)} UTC${offset >= 0 ? '+' : ''}${offset}`;
        // only dima's own prompt carries his marks; each joins once and locks until the turn ends
        if (turn.isUserTurn)
            await $.store
                .set(DIMA_AT, await $.clock.now())
                .catch(() => undefined);
        await absorbMarks($, () => keepShelf($), isTypedHere);
        await currentOrbit($);
        const isOn = await partsShown($);
        const marked =
            turn.isUserTurn && isOn('stash.orbit')
                ? await takeMarks($, (o) => o.asks.filter(isFresh))
                : [];
        // an assumption dima sent back joins his prompt once and leaves orbit
        const wrong =
            turn.isUserTurn && isOn('stash.assumed')
                ? (orbitNow().assumed ?? []).filter((x) => x.isWrong)
                : [];
        if (wrong.length)
            await inMarking(async () => {
                const o = await currentOrbit($);
                await saveOrbit(
                    $,
                    {
                        ...o,
                        assumed: (o.assumed ?? []).filter(
                            (x) => !wrong.some((w) => w.id === x.id),
                        ),
                    },
                    () => keepShelf($),
                );
            });
        const tickets = turn.isUserTurn
            ? await ticketNote($, e.text)
            : undefined;
        const texts = await orbitTexts($);
        // with no board the whole reply shape rides every prompt; the board's return then prints the state once
        const isNoBoard =
            (await $.state.get(MOBILE)).value || !isOn('stash.orbit');
        const told = isNoBoard
            ? undefined
            : orbitReminder(orbitNow(), isOn, toldOrbit, texts.plan);
        const reminder = isNoBoard
            ? noBoardReminder(orbitNow(), isOn)
            : told?.line;
        const isFirst =
            orbitNow().turns === 0 && !orbitNow().plan && !turn.isPrimed;
        setPrimed(true);
        // the lanes speak only in clio's thread: a lane stale after LANE_STALE of her turns, and dima's steer on a current step
        // riding her next prompt once, from any board
        const isOwner = await isLaneOwner($);
        const laneMoves =
            isOwner && isOn('stash.glide') ? await takeLaneMoves($) : [];
        const lanes = isOwner && isOn('stash.glide') ? await readLanes($) : [];
        const live = lanes.filter((l) => !l.endedAt);
        const staleNow = live.filter(
            (l) => !l.runner && orbitNow().turns - l.movedAt >= LANE_STALE,
        );
        // a lane is told stale once, and again only after it moved and went stale anew: the move is in the key, since a
        // turn the mod started itself grows the count with no prompt to clear an id
        const staleKey = (l: { id: string; movedAt: number }) =>
            `${l.id}@${l.movedAt}`;
        const laneStale = staleNow
            .filter((l) => !toldStaleLanes.has(staleKey(l)))
            .map((l) =>
                filled(texts.lane ?? LANE_STALE_TEXT, {
                    id: l.id,
                    n: orbitNow().turns - l.movedAt,
                    title: l.title,
                }),
            );
        const laneSteers = turn.isUserTurn
            ? await takeLaneSteers($, lanes)
            : [];
        if (isOwner) await dropLaneOrders($);
        // dima's own prompt carries his phases mark
        const planMark =
            turn.isUserTurn && isOn('stash.phases')
                ? await takePlanMark($)
                : undefined;
        // held member pings ride the next prompt of any origin, once (quiet comms)
        const quiet = await quietLocked(() => quietTake($));
        // herdr's joins ride any turn but the keep-hot ping, in the order written (FRM-584); a prompt queued behind a
        // running turn takes none, since that turn's end would stamp them before the prompt runs: its tool steps take them
        const joins =
            turn.pinged || isQueued
                ? []
                : await joinsLocked(() => takeJoins($)).catch(() => []);
        const gapNotes = isOwner ? await takeGapNotes($).catch(() => []) : [];
        // 🐦‍🔥 a board asked this session for a second wind: the note rides this turn, whatever started it
        const costHint =
            isUser && isOwner && isOn('stash.cost') && COST_WORDS.test(e.text)
                ? COST_HINT
                : undefined;
        const steers = await takeSteers($, isOn).catch(() => []);
        nextTurnNo();
        const fillLine = isOn('stash.second-wind')
            ? await takeFill(
                  $,
                  (await $.store
                      .get(CONTEXT + (await currentId($)))
                      .catch(() => undefined)) as number | undefined,
              ).catch(() => undefined)
            : undefined;
        const wind = isOn('stash.second-wind')
            ? await takeWind($, isOwner).catch(() => undefined)
            : undefined;
        const sent = await next({
            ...e,
            context: [
                ...(e.context ?? []),
                clock,
                ...(warm.afk && isOn('stash.afk') ? [AWAY_NOTE] : []),
                ...(marked.length
                    ? [joinText(marked, tickSentence(texts, marked.length))]
                    : []),
                ...(wrong.length ? [wrongText(wrong)] : []),
                ...(isFirst && isOn('stash.phases') ? [PHASES_START] : []),
                ...(reminder ? [reminder] : []),
                ...laneStale,
                ...laneMoves,
                ...laneSteers,
                ...(planMark ? [planText(planMark)] : []),
                ...(quiet.held.length ? [quietNote(quiet.held)] : []),
                ...(joins.length ? [joinRowsText(joins)] : []),
                ...gapNotes,
                ...(tickets ? [tickets] : []),
                ...(fillLine ? [fillLine] : []),
                ...(wind ? [wind] : []),
                ...steers,
                ...(costHint ? [costHint] : []),
            ],
            text: hold?.text ?? e.text,
        });
        // told only once the prompt went on: one another hook dropped leaves the state to tell again
        if (sent.drop === undefined) {
            toldOrbitAs(told?.key);
            if (isOwner && isOn('stash.glide'))
                toldStaleAs(staleNow.map(staleKey));
        }
        return sent;
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
        // a fix that throws draws the reply as written, never a blank
        let text: string;
        try {
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
            text = (
                switches['stash.boldwords'] !== false
                    ? boldFleetWords(fixed)
                    : { text: fixed }
            ).text;
        } catch {
            return next(e);
        }
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
        clearWrap();
        // a keep-hot ping's one-character reply never clears what the session waits on; it only stamps the warm cache
        const was = turn.pinged
            ? ((await $.store
                  .get(REPLY + e.session_id)
                  .catch(() => undefined)) as Reply | undefined)
            : undefined;
        const reply: Reply | undefined = turn.pinged
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
        await endUserTurn($);
        await load($);
        return red ? { ...r, block: red } : r;
    });

    on('turn.complete', async ($, e, next) => {
        await markActive($).catch(() => undefined);
        const r = await next(e);
        // a subagent's turn ending is not the session going idle
        if (e.agentId) return r;
        endBusy();
        await joinsLocked(() =>
            settleJoins($, !e.isAborted && e.reason !== 'error'),
        ).catch(() => undefined);
        await refreshThreads($);
        await inMarking(async () =>
            saveOrbit($, turnEnded(await currentOrbit($)), () => keepShelf($)),
        );
        await windAfterTurn($, viewDoors($)).catch(() => undefined);
        armRelease($, viewDoors($), WIND_DELAY_MS);
        const endedAt = await $.clock.now();
        await endStop($, endedAt);
        await seatDefaults($, viewDoors($)).catch(() => undefined);
        // a stop on the 5h cap waits for the reset; any other end clears it. the cap ends the turn with an empty answer,
        // so an error end reads the transcript's last entry for the cap text and the reset it names (FRM-488)
        const read =
            e.reason === 'error' && !CAPPED.test(e.answer)
                ? await capFromTranscript($)
                : undefined;
        // the signals rank: the entry's typed field or its words, the answer's words, then a 5h window this full
        const isFull = (fiveHourPercent ?? 0) >= CAP_FULL_PERCENT;
        cap =
            e.reason === 'error' && (read || CAPPED.test(e.answer) || isFull)
                ? { resetsAt: resetOf(read?.resetsAt, await $.clock.now()) }
                : undefined;
        await $.state.set(CAP, cap ?? null).catch(() => undefined);
        // a cap only the full window named is a shape the hook could not read: never silent (dima, 2026-11-02)
        const isUnread = cap !== undefined && !read && !CAPPED.test(e.answer);
        if (e.reason === 'error' || /session limit/i.test(e.answer))
            await keepCapSeen(
                $,
                read?.text ?? e.answer,
                cap !== undefined,
                isUnread,
            );
        if (isUnread)
            $.ui.toast('⏰ waker: an unrecognised cap — check FRM-488');
        await armWake($);
        // the store is 🔥's truth: crow writes its key after session.start, and a written off turns it off
        const sid = await currentId($);
        if (sid)
            holdHot(hotOf(await $.store.get(HOT + sid).catch(() => warm.hot)));
        // it counts from this turn's end, kept in $.state; it never writes the key back, which once undid a 🌌 sessions
        // chip's delete landing between this read and the write (FRM-499)
        if (warm.hot)
            holdHot({
                ...warm.hot,
                since: turn.endedAt ?? (await $.clock.now()),
            });
        await armHot($, viewDoors($));
        await load($);
        return r;
    });

    on('session.compact', async ($, e, next) => {
        const isOwn = !e.agentId && e.trigger !== 'precompute';
        const compacting = isOwn
            ? await currentId($).catch(() => undefined)
            : undefined;
        if (compacting)
            await $.store
                .set(COMPACTING + compacting, await $.clock.now())
                .catch(() => undefined);
        const r = await next(e).finally(() =>
            compacting
                ? $.store.delete(COMPACTING + compacting).catch(() => undefined)
                : undefined,
        );
        // cc sends the whole skill list again after a compact (2.1.304), so none is reloaded here; a compact another hook
        // skipped changed nothing
        if (!e.agentId && e.trigger !== 'precompute' && !('skip' in r)) {
            // a wind's own compact: its ingest is queued behind it, and runWind hands the held messages over after it
            const wind = compacting ? await windOf($, compacting) : undefined;
            const isWinds = wind?.state === 'refreshing' && !wind.slug;
            forgetTold();
            await windOnCompact($).catch(() => undefined);
            await steersOnCompact($).catch(() => undefined);
            if (!isWinds) armRelease($, viewDoors($), COMPACT_SETTLE_MS);
            // the next measure comes only at this turn's end, and a wind's ingest is one long turn: until then the
            // fill from before the compact would stand on the band and every board
            await drawFill($, undefined).catch(() => undefined);
            const compacted = await currentId($);
            if (compacted)
                await $.store.delete(FILL + compacted).catch(() => undefined);
            $.clock.after(COMPACT_SETTLE_MS, () =>
                drawFillAfterCompact($).catch(() => undefined),
            );
            await keepShelf($);
            await load($);
        }
        return r;
    });

    // the context fill the board shows, and the 5h reset the waker waits on
    on('session.measure', async ($, e, next) => {
        const w = e.rateLimits.find((r) => r.kind === 'five_hour');
        const resetsAt = w?.resetsAt ? Date.parse(w.resetsAt) : undefined;
        if (w) fiveHourPercent = w.percentUsed;
        if (resetsAt !== undefined) {
            fiveHourResetsAt = resetsAt;
            // capped before any measure named the reset: wait for this one
            if (cap && cap.resetsAt === undefined) {
                cap = { ...cap, resetsAt };
                await $.state.set(CAP, cap).catch(() => undefined);
                await armWake($);
            }
        }
        await measureUsage($, e);
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
    // quiet comms: in clio's thread a message that does not push is held; every delivery is logged
    on('session.receive', async ($, e, next) => {
        await markActive($).catch(() => undefined);
        const kind = e.origin.kind;
        if (kind === 'task-notification' && !e.agentId) {
            await settleTask($, e.text, viewDoors($)).catch(() => undefined);
            return next(e);
        }
        if ((kind !== 'peer' && kind !== 'peer-send-message') || e.agentId)
            return next(e);
        const steer = await holdSteer($, e.text, viewDoors($)).catch((err) => {
            $.ui.log(`x-mod-stash: a steer passed unheld: ${errorText(err)}`);
            return undefined;
        });
        if (steer && 'consumed' in steer) return steer;
        if (steer) return next({ ...e, text: steer.text });
        if (!(await isQuietHome($).catch(() => false))) return next(e);
        const { body, deliveryTest, from, tag } = peerPing(e.text);
        const marks = deliveryTest ? { deliveryTest } : {};
        let arm: QuietLogLine['arm'] = 'on';
        // fail open: a throw anywhere below passes the delivery unjudged and logs it, so a broken hold never loses a ping
        try {
            const verdict = await quietLocked(async () => {
                const now = await $.clock.now();
                const isOn = await readSwitch($, 'quiet');
                arm = isOn ? 'on' : 'off';
                const isMobile = (await $.state.get(MOBILE)).value === true;
                const isBusyNow = await isTurnBusy($);
                const sid = memberOf(await registry($), from)?.base.sid;
                const why = await quietWhy($, from, body);
                const line = {
                    arm,
                    at: now,
                    from,
                    tag,
                    ...(sid ? { sid } : {}),
                    ...marks,
                } as const;
                if (isOn && !isMobile && !why) {
                    const q = await quietOf($);
                    // consumed only once both the held list and its log line landed: a ping no store holds is a lost one
                    const isSaved = await saveQuiet($, {
                        ...q,
                        held: [
                            ...q.held,
                            {
                                at: now,
                                from,
                                tag,
                                text: quietHeldText(body),
                                ...marks,
                            },
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
                        consumed: `quiet comms held ${from}'s message`,
                    };
                }
                await quietLog($, {
                    ...line,
                    startedTurn: !isBusyNow,
                    verdict: 'passed',
                    ...(why ? { why } : {}),
                });
                return undefined;
            });
            if (verdict) return verdict;
        } catch (err) {
            const at = await $.clock.now().catch(() => Date.now());
            await quietLocked(() =>
                quietLog($, {
                    arm,
                    at,
                    from,
                    startedTurn: false,
                    tag,
                    verdict: 'failed-open',
                    ...marks,
                }),
            );
            $.ui.log(
                `x-mod-stash: quiet comms failed open on ${from}'s ping: ${errorText(err)}`,
            );
        }
        const compact = await holdAfterQuiet($, e.text, viewDoors($)).catch(
            (err) => {
                $.ui.log(
                    `x-mod-stash: a steer passed unheld: ${errorText(err)}`,
                );
                return undefined;
            },
        );
        return compact ?? next(e);
    });

    // the delivery test: a model-free test [progress] ping to clio through the real peer path; its run reads the log by nonce
    on('command.run', { command: 'quiet-delivery-test' }, async ($, e) => {
        const nonce = e.args.trim() || `c${(await $.clock.now()).toString(36)}`;
        const r = await $.session
            .send({
                text: `[progress] quiet delivery test ${nonce}: a test ping from /quiet-delivery-test, nothing to do`,
                to: LANE_OWNER,
            })
            .catch((err) => ({
                isDelivered: false as const,
                reason: errorText(err),
            }));
        return {
            text: r.isDelivered
                ? `quiet delivery test ${nonce}: sent`
                : `quiet delivery test ${nonce}: FAIL, ${r.reason}`,
        };
    });

    on('command.run', { command: 'quiet' }, async ($, e) => {
        const arg = e.args.trim();
        if (arg === 'on' || arg === 'off') {
            await $.store.set(QUIET_ON, arg === 'on');
            $.ui.invalidate('ui.render');
            return {
                text: `quiet comms ${arg}: ${arg === 'on' ? "members' messages wait for your next turn unless they push" : 'every member ping passes'}`,
            };
        }
        const isOn = await readSwitch($, 'quiet');
        const kindsOff = isOn
            ? (await quietKindsOff($)).map((k) => `[${k}]`)
            : [];
        return {
            text: `quiet comms ${isOn ? 'on' : 'off'}, ${(await quietOf($)).held.length} held${kindsOff.length ? `; ${kindsOff.join(', ')} switched off, held like an untagged line` : ''}; /quiet on | off${arg ? ` («${arg}» is neither)` : ''}`,
        };
    });

    on('command.run', { command: 'board' }, async ($, e) => {
        if (e.args.trim() === 'breathe') {
            const isOn = await flipKnob($, 'always', () => publish($));
            return {
                text: `bars breathe ${isOn ? 'all the time' : 'only while a turn runs'}`,
            };
        }
        const isColourFlip = /^colou?r$/.test(e.args.trim());
        const isColour = isColourFlip
            ? await flipKnob($, 'colour', () => publish($))
            : undefined;
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
            setSettingsOpen(false);
            await publish($);
        }
        return r;
    });

    // a thread switch reaches a mod only as this client leaving and coming back (the desktop log, FRM-531); a phone's
    // comings and goings leave the desktop's view alone
    on('session.detach', async ($, e, next) => {
        if (e.surface === 'desktop' && e.reason === 'detach')
            await leaveBoxes($, viewDoors($)).catch((err) =>
                $.ui.log(
                    `x-mod-stash: steer boxes not left: ${errorText(err)}`,
                ),
            );
        return next(e);
    });
    on('session.attach', async ($, e, next) => {
        await markActive($).catch(() => undefined);
        if (e.surface === 'desktop')
            await returnToBoxes($, viewDoors($)).catch((err) =>
                $.ui.log(
                    `x-mod-stash: steer boxes not taken back: ${errorText(err)}`,
                ),
            );
        return next(e);
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
                        const meter = await meterNow($);
                        // mobile draws no Input
                        const Input = 'Input' in ui ? ui.Input : undefined;
                        // the knobs: a switch saves on its press, a number on each keystroke that makes a valid value
                        const isPaceWatched = isPaceOn(
                            await $.store.get(
                                PACE + ((await currentId($)) ?? ''),
                            ),
                        );
                        const isHotShown = (await partsShown($))('stash.hot');
                        const isAutoWindShown = (await partsShown($))(
                            'stash.second-wind-auto',
                        );
                        const isPaceShown = (await partsShown($))(
                            'stash.pace-watch',
                        );
                        const settingNumbers = await Promise.all(
                            PACE_KEYS.map(
                                async (name) =>
                                    [name, await readNumber($, name)] as const,
                            ),
                        );
                        const knobs = {
                            always: await readSwitch($, 'always'),
                            breathe: await readSwitch($, 'breathe'),
                            colour: await readSwitch($, 'colour'),
                            guard: !(await readSwitch($, 'silent')),
                            lines: await readNumber($, 'lines'),
                            quiet: await readSwitch($, 'quiet'),
                            quietKinds: await Promise.all(
                                QUIET_KINDS.map(async (k) => ({
                                    ...k,
                                    isOn: await readSwitch($, k.name),
                                })),
                            ),
                            quietWait: await readNumber($, 'quietWait'),
                            ring: await readSwitch($, 'ring'),
                            speak: await readSwitch($, 'speak'),
                            speed: await readNumber($, 'speed'),
                        };
                        const switchJSX = (
                            name: SwitchName,
                            label: string,
                            isOn: boolean,
                            note?: string,
                        ) => (
                            <Box
                                alignItems='flex-start'
                                flexDirection={note ? 'column' : 'row'}
                                key={`knob:${SWITCHES[name].key}`}>
                                <Button
                                    key={`knob:${SWITCHES[name].key}`}
                                    onPress={() =>
                                        void flipKnob($, name, () => publish($))
                                    }
                                    {...(isOn
                                        ? { variant: 'primary' as const }
                                        : { dimColor: true })}>
                                    {label}
                                </Button>
                                {/* a keyed Box is its own hover scope (engine.md), so the note lives inside this one */}
                                {note ? noteOnHover(ui, note) : null}
                            </Box>
                        );
                        const numberJSX = (
                            name: NumberName,
                            label: string,
                            value: number,
                            unit: string,
                        ) => {
                            const { key, range } = NUMBERS[name];
                            const refusal = knobRefusals.get(name);
                            const row = Input ? (
                                <Box
                                    alignItems='center'
                                    flexDirection='row'
                                    gap={1}
                                    key={`knob:${key}`}>
                                    <Text>{label}</Text>
                                    <Box flexGrow={1} />
                                    {noteOnHover(
                                        ui,
                                        `${unit} (${range.min}–${range.max})`,
                                    )}
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
                                </Box>
                            ) : null;
                            return row && refusal ? (
                                <Box
                                    flexDirection='column'
                                    key={`knob-field:${key}`}>
                                    {row}
                                    <Text
                                        dimColor>{`🛑 not saved: ${refusal}`}</Text>
                                </Box>
                            ) : (
                                row
                            );
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
                                {isPaceShown ? (
                                    <Box
                                        flexDirection='row'
                                        key='knob:pace-watch'>
                                        <Button
                                            key='knob:pace-watch'
                                            onPress={() => void pressPace($)}
                                            {...(isPaceWatched
                                                ? {
                                                      variant:
                                                          'primary' as const,
                                                  }
                                                : { dimColor: true })}>
                                            🔋 pace watch: this session
                                        </Button>
                                    </Box>
                                ) : null}
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
                                                        : flipKnob(
                                                              $,
                                                              'ring',
                                                              () => publish($),
                                                          ))
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
                                            void flipKnob($, 'silent', () =>
                                                publish($),
                                            )
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
                                key='settings:bars'
                                paddingX={1}
                                paddingY={air ? 0.5 : 0}
                                rowGap={air ? 0.3 : 0}>
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
                                key='settings:quiet'
                                paddingX={1}
                                paddingY={air ? 0.5 : 0}
                                rowGap={air ? 0.3 : 0}>
                                <Text bold>🤫 quiet comms</Text>
                                {switchJSX(
                                    'quiet',
                                    "🤫 hold members' messages unless they push",
                                    knobs.quiet,
                                )}
                                {knobs.quietKinds.map(
                                    ({ cost, isOn, kind, name }) =>
                                        knobs.quiet ? (
                                            switchJSX(
                                                name,
                                                `🤫 [${kind}] starts clio's turn`,
                                                isOn,
                                                cost,
                                            )
                                        ) : (
                                            <Box
                                                flexDirection='column'
                                                key={`quiet-kind:${kind}`}>
                                                <Text
                                                    dimColor>{`🤫 [${kind}] starts clio's turn`}</Text>
                                                {noteOnHover(ui, cost)}
                                            </Box>
                                        ),
                                )}
                                {numberJSX(
                                    'quietWait',
                                    '🤫 held pings wait',
                                    knobs.quietWait,
                                    'min',
                                )}
                                {settingNumbers
                                    .filter(([name]) =>
                                        name.startsWith('hot-')
                                            ? isHotShown
                                            : name.startsWith('wind-')
                                              ? isAutoWindShown
                                              : isPaceShown,
                                    )
                                    .map(([name, value]) =>
                                        numberJSX(
                                            name,
                                            PACE_SETTINGS[name].label,
                                            value,
                                            '',
                                        ),
                                    )}
                            </Box>
                        );
                        // the auto-compact point lives only in 🎛️, its last section (dima, 15:35: «move full autocompact part to settings»)
                        const compactJSX = Input ? (
                            <Box
                                borderColor={cardBorder(e.surface)}
                                borderStyle='round'
                                flexDirection='column'
                                key='settings:compact'
                                paddingX={1}
                                paddingY={e.surface === 'desktop' ? 0.5 : 0}>
                                <Text bold>context</Text>
                                <Box
                                    alignItems='center'
                                    flexDirection='row'
                                    gap={1}
                                    key='knob-row:compact'>
                                    <Text>📦 auto-compact at</Text>
                                    <Box flexGrow={1} />
                                    {noteOnHover(ui, '% of the context window')}
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
                                </Box>
                            </Box>
                        ) : null;
                        return (
                            // two columns of cards: the switches left, the knobs and the number tiles right
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
                                        {barsJSX}
                                        {quietJSX}
                                        {compactJSX}
                                    </Box>
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
        // a reload can draw the board before its start: the kept boxes come back first, or each remounts under a new key
        await takeFieldsOnce($);
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
                    // a steer the store refused three times, offered back beside its box: a press saves it (dima's o123)
                    const keptDrawn = new Set<string>();
                    const keptJSX = (key: string) => {
                        const list = board?.keptSteers?.[key] ?? [];
                        const kept = list.at(-1);
                        if (kept !== undefined) keptDrawn.add(key);
                        return kept === undefined ? null : (
                            <Box flexShrink={0} key={`kept:${key}`}>
                                <Button
                                    key={`kept:${key}`}
                                    onPress={() =>
                                        offerBack($, key, viewDoors($))
                                    }
                                    plain>
                                    {`↩️ kept «${kept.length > 40 ? `${kept.slice(0, 39)}…` : kept}»${list.length > 1 ? ` +${list.length - 1}` : ''}`}
                                </Button>
                            </Box>
                        );
                    };
                    const now = board?.at ?? 0;
                    const me = (await $.state.get(VIEW)).value?.selfId;
                    // the board's lower half: this session's orbit and its plan, read here so a mark or a tool call redraws it
                    const o = (await $.state.get(ORBIT)).value ?? orbitNow();
                    // mobile draws no Input: its steers wait for another surface
                    const Input = 'Input' in ui ? ui.Input : undefined;
                    const open = o.asks.filter((a) => !a.isResolved);
                    const age = planAge(o);
                    // 🛎️ and ↩️ are one toggle each, side by side at the row's left: lit while it holds, plain while it does not
                    // an ask card's door: this session's own orbit; a lane card passes a view door, which draws no control
                    const ownDoor: AskDoor = {
                        mark: (a, mark) => void pressMark($, a.id, mark),
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
                            {`${a.mark === mark ? (a.isLocked ? '🔓' : '✅') : mark === 'accepted' ? '🛎️' : '🔁'} ${mark === 'accepted' ? 'tick' : 'replay'}`}
                        </Button>
                    );
                    const handleAssumedSteer = (id: string, value: string) =>
                        changeAssumed(
                            $,
                            () => keepShelf($),
                            (y) =>
                                y.id === id
                                    ? { ...y, steer: steerOf(value) }
                                    : y,
                        );
                    // the steer keeps every keystroke, no Enter needed
                    const handleSteer = (id: string, value: string) =>
                        markAsks(
                            $,
                            () => keepShelf($),
                            (x) =>
                                x.id === id
                                    ? { ...x, steer: steerOf(value) }
                                    : x,
                            false,
                            id,
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
                    ) => kept[card] ?? FOLDED_CARD.test(card);
                    const isFolded = (card: string) => foldedOf(folds, card);
                    // 📂 sits at the far right of each card's head line and folds the card to that line, then reads 📁 (dima's o5, 17:21)
                    const foldJSX = (card: string) => (
                        <Button
                            key={`fold:${card}`}
                            onPress={async () => {
                                // a fold remounts its fields: they draw the stored text again
                                await flushFields($, viewDoors($));
                                await forgetMountedText($);
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
                    const isSpeaking = await isSpeakingNow($);
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
                        door: AskDoor | ViewDoor,
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
                        door: AskDoor | ViewDoor = ownDoor,
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
                                {'mark' in door ? (
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
                                                <Box
                                                    flexShrink={1}
                                                    minWidth={0}>
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
                                                    key={askBox($, a).key}
                                                    onInput={(
                                                        value: string,
                                                    ) => {
                                                        askBox($, a).type(
                                                            value,
                                                            () => {
                                                                return door.steer(
                                                                    a,
                                                                    value,
                                                                );
                                                            },
                                                        );
                                                    }}
                                                    onSubmit={(value: string) =>
                                                        door.steer(a, value)
                                                    }
                                                    placeholder='steer'
                                                    value={askBox($, a).value}
                                                />
                                            </Box>
                                        ) : null}
                                        {/* a locked row takes no steer, so it offers none */}
                                        {a.isLocked
                                            ? null
                                            : keptJSX(
                                                  `${door.prefix}:steer:${a.id}`,
                                              )}
                                        {/* the steer comes first, the file link after it, at the row's end (dima's shot, 20:57) */}
                                        {a.link
                                            ? askLinkJSX(a.id, a.link)
                                            : null}
                                    </Box>
                                ) : a.link ? (
                                    <Box key={`${door.prefix}:row:${a.id}`}>
                                        {askLinkJSX(a.id, a.link)}
                                    </Box>
                                ) : null}
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
                                    {open.some(isAllAsksMarkable) ? (
                                        <Button
                                            key='orbit:all'
                                            onPress={() =>
                                                void pressAllAsks(
                                                    $,
                                                    open.map(
                                                        ({ id, text }) => ({
                                                            id,
                                                            text,
                                                        }),
                                                    ),
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
                                                                () =>
                                                                    keepShelf(
                                                                        $,
                                                                    ),
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
                                                                () =>
                                                                    keepShelf(
                                                                        $,
                                                                    ),
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
                                                    {keptJSX(
                                                        `orbit:asteer:${x.id}`,
                                                    )}
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
                        const member = lane.members[role];
                        if (!member) return null;
                        const asks =
                            laneAsks[lane.memberSids?.[role] ?? member] ?? [];
                        const card = `lane:${lane.id}:${role}`;
                        const isOpen = !isFolded(card);
                        const badge = memberBadge(role);
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
                                              prefix: card,
                                          }),
                                      )
                                    : null}
                            </Box>
                        );
                    };
                    // 🙋 the board's top while a clio's own orbit asks wait on dima: their count, then each clio, a press scrolls
                    // to its asks; a member's asks show only on its lane card, since they reach dima through a clio (FRM-643)
                    const waitingOn = isPartOn('stash.orbit')
                        ? ((await $.state.get(CLIO_ASKS)).value ?? [])
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
                                        key={`asks-strip:${w.sid}`}
                                        onPress={() =>
                                            void $.ui
                                                .scroll({
                                                    block: 'start',
                                                    to: {
                                                        key: w.isSelf
                                                            ? 'orbit'
                                                            : 'sessions',
                                                    },
                                                })
                                                .catch(() => undefined)
                                        }
                                        plain>
                                        {`· ${w.name} ${w.n}`}
                                    </Button>
                                ))}
                            </Box>
                        ) : null,
                    );
                    // o84: dima's hand on this session's phases — a move, a tick, a steer
                    const changePlan = async (
                        change: (p: StashPlan) => StashPlan,
                    ) => {
                        await inMarking(async () => {
                            const was = await currentOrbit($);
                            if (!was.plan) return;
                            await saveOrbit(
                                $,
                                {
                                    ...was,
                                    plan: change(was.plan),
                                },
                                () => keepShelf($),
                            );
                        });
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
                        changePlan((p) => ({ ...p, steer: steerOf(value) }));
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
                    // the running ticket in a card's title opens in linear (FRM-649:W39)
                    const laneTitleJSX = (lane: StashLane, tail: string) => {
                        const [, head, ticket, rest] =
                            /^(.*? — )([A-Z]+-\d+)( .*)$/.exec(lane.title) ??
                            [];
                        if (!ticket || ticket !== lane.ticket)
                            return (
                                <Text
                                    bold>{`🛼 glide: ${lane.title}${tail}`}</Text>
                            );
                        return (
                            <Box flexDirection='row' flexShrink={1}>
                                <Text bold>{`🛼 glide: ${head}`}</Text>
                                <Link
                                    href={`https://linear.app/x-com/issue/${ticket}`}
                                    key={`lane:${lane.id}:title-ticket`}>
                                    {ticket}
                                </Link>
                                <Text bold>{`${rest}${tail}`}</Text>
                            </Box>
                        );
                    };
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
                                          {laneTitleJSX(
                                              lane,
                                              `${laneSpan(lane)}${lane.isPlanGone ? ' · plan file gone' : lane.isPlanStale ? ' · steps stale, x lane plan-steps failed' : ''}`,
                                          )}
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
                                                                {keptJSX(
                                                                    `lane:${lane.id}:steer`,
                                                                )}
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
                                                      {`${o.plan.mark ? '✅' : '🛎️'} tick`}
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
                                                  {keptJSX('plan:steer')}
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
                    // a kept steer whose box is not drawn (its ask resolved, its lane gone or folded): shown here with a ✕, the way
                    // out, read after every card drew its own offers
                    const keptElsewhereJSX = () =>
                        Object.entries(board?.keptSteers ?? {})
                            .filter(([key]) => !keptDrawn.has(key))
                            .map(([key, list]) => (
                                <Box
                                    flexDirection='row'
                                    gap={1}
                                    key={`kept-elsewhere:${key}`}>
                                    <Box flexShrink={1} minWidth={0}>
                                        <Text dimColor wrap='truncate-end'>
                                            {`↩️ kept, its box is not on the board: «${list.at(-1) ?? ''}»${list.length > 1 ? ` +${list.length - 1}` : ''}`}
                                        </Text>
                                    </Box>
                                    <Button
                                        key={`kept-drop:${key}`}
                                        onPress={() =>
                                            dropKept($, key, viewDoors($))
                                        }
                                        plain>
                                        ✕
                                    </Button>
                                </Box>
                            ));
                    const arranged = (top: RenderElement) => (
                        <Box flexDirection='column' minHeight={fill}>
                            {stripJSX}
                            {probesJSX}
                            {keptElsewhereJSX()}
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
                        (await meterNow($))?.compactAt ?? CTX_FALLBACK_AT;
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
                                        {/* 🔥 keep-hot for any session, a --bg one included: the band's own toggle, filled while its key is in
                                            the store, plain while not — a faint dim read the same both ways (FRM-499, dima's 20:41 shots) */}
                                        {isPartOn('stash.hot') ? (
                                            <Box flexShrink={0}>
                                                <Button
                                                    key={`hot:${m.sid}`}
                                                    onPress={() =>
                                                        pressHot(
                                                            $,
                                                            m.sid,
                                                            viewDoors($),
                                                        )
                                                    }
                                                    {...(m.isHot
                                                        ? {
                                                              variant:
                                                                  'secondary' as const,
                                                          }
                                                        : {
                                                              plain: true as const,
                                                          })}>
                                                    🔥
                                                </Button>
                                            </Box>
                                        ) : null}
                                        {/* 🐦‍🔥 second wind beside the meter it answers: the emoji alone, its state under the row */}
                                        {isPartOn('stash.second-wind') ? (
                                            <Box flexShrink={0}>
                                                <Button
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
                                            {`🐦‍🔥 second wind: ${windSay(m.wind)} (${span(Math.max(0, now - m.wind.at))})`}
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
                                                    {`🤫 ${p.from} · ${span(now - p.at)} ago: ${p.text.split('\n')[0]}`}
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

    // a /clear or a resume leaves the conversation behind; an exit keeps only its last reply
    on('session.end', async ($, e, next) => {
        await refreshThreads($);
        if (e.reason === 'clear' || e.reason === 'resume') {
            // the process outlives a /clear, so the next conversation is primed again: no session.start fires for it
            setPrimed(false);
            forgetTold();
            // the process goes on under a new id with no session.start: the next read takes it fresh
            endIdentity(e.sessionId);
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
        await markActive($).catch(() => undefined);
        if (e.command !== 'clear' && e.command !== 'resume') return next(e);
        const left = await currentId($);
        const r = await next(e);
        if (left) await forget($, left).catch(() => undefined);
        await saveOrbit($, EMPTY_ORBIT, () => keepShelf($));
        await load($);
        await seatDefaults($, viewDoors($)).catch(() => undefined);
        return r;
    });

    // orbit's write door, where the session adds, resolves and follows up its asks and sets its plan; and afk flipped
    // mid-turn: the next tool result carries the new state once
    on('tool.call', async ($, e, next) => {
        await flushFields($, viewDoors($));
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
        const send =
            (e.tool as string) === SEND_TOOL && !e.agentId
                ? await quietSendStart($, e as Record<string, unknown>).catch(
                      () => undefined,
                  )
                : undefined;
        const r = await next(e);
        if (r.deny !== undefined || e.agentId) return r;
        if (
            (e.tool as string) === WRAP_UP_TOOL &&
            oneLine((e as Record<string, unknown>).ask)
        )
            markWrapAsked();
        if (
            isWork(
                e.tool as string,
                (e as { command?: unknown }).command as string | undefined,
            )
        )
            markWork();
        const notes: string[] = [];
        const sent = send
            ? await quietSendEnd($, send, r.result).catch(() => undefined)
            : undefined;
        if (sent?.line) notes.push(sent.line);
        // a fresh answer: core's `text` and `ref` still name the refusal
        const answer = sent?.held ? ({ result: sent.held } as never) : r;
        const isOn = await partsShown($);
        if ((e.tool as string) === SEND_TOOL && isOn('stash.rounds')) {
            const round = await laneRoundLine(
                $,
                e as Record<string, unknown>,
                r.result,
            ).catch(() => undefined);
            if (round) notes.push(round);
        }
        if (turn.turnAfk !== undefined && turn.turnAfk !== warm.afk) {
            setTurnAfk(warm.afk);
            if (isOn('stash.afk')) notes.push(warm.afk ? AWAY_NOTE : BACK_NOTE);
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
        await absorbMarks($, () => keepShelf($), isTypedHere);
        const isPing = (await $.state.get(TURN)).value?.isPinged ?? turn.pinged;
        const fresh =
            isPing || !isOn('stash.orbit')
                ? []
                : await takeMarks($, (o) => o.asks.filter(isFresh));
        if (fresh.length)
            notes.push(
                joinText(
                    fresh,
                    tickSentence(await orbitTexts($), fresh.length),
                ),
            );
        // a lane steer dima took while clio's turn runs joins it here too, as an orbit mark does
        if (!isPing && isOn('stash.glide') && (await isLaneOwner($))) {
            notes.push(...(await takeLaneMoves($)));
            notes.push(...(await takeLaneSteers($, await readLanes($))));
        }
        // 🐦‍🔥 a press while this session works slipstreams into its next tool step, as a tick does; an idle one waits
        // for its next turn, never woken (dima, 19:14)
        if (isOn('stash.second-wind')) {
            // a long turn crosses the lines with no prompt: the step reads its fill live (probed, 2.1.322)
            const fill = await $.session
                .usage()
                .then((u) => u.context.percent)
                .catch(() => undefined);
            const fillLine = await takeFill($, fill).catch(() => undefined);
            if (fillLine) notes.push(fillLine);
            const wind = await takeWind($, await isLaneOwner($)).catch(
                () => undefined,
            );
            if (wind) notes.push(wind);
        }
        // dima's phases mark joins the running turn at its next tool call
        const p =
            !isPing && isOn('stash.phases') ? await takePlanMark($) : undefined;
        if (p) notes.push(planText(p));
        const o = await currentOrbit($);
        if (
            !turn.isNudged &&
            isOn('stash.phases') &&
            countTool() >= NUDGE_AT &&
            turn.isWorkTurn &&
            !(o.plan && o.plan.at >= o.turns + 1 - PLAN_QUIET_TURNS)
        ) {
            markNudged();
            notes.push(
                o.plan
                    ? `phases not set for ${PLAN_QUIET_TURNS + 1} turns — update them with ${ORBIT_TOOL} plan`
                    : `no phases yet — set them with ${ORBIT_TOOL} plan`,
            );
        }
        // last: the rung moves here, and everything above may still throw
        if (!isPing) {
            const pace = await paceStep($).catch(() => undefined);
            if (pace) notes.push(pace);
        }
        // a join herdr wrote mid-turn lands at the next tool step, as a tick does; taken after every step that could
        // throw, since a taken row is stamped joined at the turn's end
        const joins = isPing
            ? []
            : await joinsLocked(() => takeJoins($)).catch(() => []);
        if (joins.length) notes.push(joinRowsText(joins));
        if (!notes.length) return answer;
        return { ...answer, context: [...(r.context ?? []), ...notes] };
    });

    // the band: one row — the meters' readings, the 🔭 mark, the switches — then the bars
    // and a refused threshold's one line
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
        try {
            return cleanTree(
                await (async () => {
                    if (e.surface !== 'terminal' && e.surface !== 'desktop')
                        return next(e);
                    // the published view, never the module's value: reading it subscribes this band, and a write redraws it
                    const view =
                        (await $.state.get(VIEW)).value ?? viewOf(false);
                    const ui = $.ui.resolve(e);
                    const { Box, Text, Button } = ui;
                    // off only: a session's Bash can press a band button through rex (probed 2026-11-07), so no press turns it on
                    const handleOverrideOff = () =>
                        pressSwitch(
                            $,
                            '🔓',
                            { isOverrideOn: false },
                            async () => {
                                await writeOverrideOff($);
                            },
                            async () => {
                                setOverrideOn(view.isOverrideOn === true);
                            },
                        );
                    const handleAfkFlip = () => {
                        holdAfk(!view.afk);
                        let isRead = false;
                        let was:
                            | {
                                  at?: number;
                                  on?: boolean;
                                  wakerBefore?: boolean;
                              }
                            | undefined;
                        return pressSwitch(
                            $,
                            '💨',
                            { afk: warm.afk },
                            async () => {
                                // the store's value, never the module copy: another session may have flipped it since the last poll
                                const read = (await $.store.get(AFK_KEY)) as
                                    | typeof was
                                    | undefined;
                                isRead = true;
                                was = await setAfk($, !read?.on);
                            },
                            async () => {
                                holdAfk(view.afk === true);
                                holdWaker(view.isWaker === true);
                                // a read that failed wrote nothing, so nothing goes back
                                if (isRead) await restoreAfk($, was);
                            },
                        );
                    };
                    // one switch for every session, kept in the store so a restart keeps it
                    const handleWakerFlip = () => {
                        const wanted = !view.isWaker;
                        holdWaker(wanted);
                        return pressSwitch(
                            $,
                            '⏰',
                            { isWaker: warm.isWaker },
                            // a poll already past load's guard may have read the old value
                            () => setWaker($, wanted),
                            async () => {
                                holdWaker(view.isWaker === true);
                                await writeWaker($, warm.isWaker).catch(
                                    () => undefined,
                                );
                            },
                        );
                    };
                    const handleWindFlip = () => {
                        const sid = view.selfId ?? '';
                        const wanted = windAfterPress(view.wind);
                        patchBand({ selfWind: wanted });
                        return pressSwitch(
                            $,
                            '🐦‍🔥',
                            { wind: wanted },
                            async () => {
                                patchBand({ selfWind: await flipWind($, sid) });
                            },
                            async () => {
                                patchBand({ selfWind: view.wind });
                            },
                        );
                    };
                    const handleAutoWindFlip = async () => {
                        const wasOn = band.isAutoWindOn;
                        patchBand({ isAutoWindOn: !view.isAutoWind });
                        await pressSwitch(
                            $,
                            '🍃',
                            { isAutoWind: band.isAutoWindOn },
                            () => setAutoWind($, band.isAutoWindOn),
                            async () => {
                                patchBand({ isAutoWindOn: wasOn });
                            },
                        );
                    };
                    const handleHotFlip = async () => {
                        const hotWas = warm.hot;
                        const isWanted = !warm.hot;
                        await pressSwitch(
                            $,
                            '🔥',
                            { isHot: isWanted },
                            // a poll already past followHot's guard may have read the old value
                            () => setHot($, isWanted),
                            async () => {
                                holdHot(hotWas);
                            },
                        );
                        await armHot($, viewDoors($));
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
                    const isPaceSeat =
                        isShown('stash.pace-watch') && (await isLaneOwner($));
                    const isPaceWatched = view.isPaced === true;
                    const handleSettingsFlip = async () => {
                        const isSettingsOpen = !view.isSettingsOpen;
                        setSettingsOpen(isSettingsOpen);
                        await drawBand($, { isSettingsOpen });
                        if (isSettingsOpen)
                            await $.ui.open({
                                id: SETTINGS_PANE,
                                title: '🎛️ settings',
                            });
                        else await $.ui.close({ id: SETTINGS_PANE });
                        await publish($);
                    };
                    const handleBoardFlip = async () => {
                        await drawBand($, { isBoardOpen: !view.isBoardOpen });
                        if (await isOpen($)) await $.ui.close({ id: BOARD });
                        else await openBoard($);
                        await publish($);
                    };
                    // a terminal draws a chromed Button as `[ label ]`
                    const leftOf = (label: string, chrome: boolean) => ({
                        right: [...label].length + (chrome ? 4 : 0) + 1,
                    });

                    // the meters: two short bars in the row, each ending in its %; the readings sit beside them
                    const meter = await meterNow($);
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
                                      'second wind',
                                      <Button
                                          key='wind'
                                          onPress={() => void handleWindFlip()}
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
                            {!isShown('stash.second-wind-auto') || !view.selfId
                                ? null
                                : tip(
                                      'auto-wind',
                                      'second wind auto',
                                      <Button
                                          key='auto-wind'
                                          onPress={() =>
                                              void handleAutoWindFlip()
                                          }
                                          {...(view.isAutoWind
                                              ? {
                                                    variant:
                                                        'secondary' as const,
                                                }
                                              : { plain: true as const })}>
                                          🍃
                                      </Button>,
                                      leftOf('🍃', !!view.isAutoWind),
                                  )}
                            {!isShown('stash.hot')
                                ? null
                                : tip(
                                      'hot',
                                      'keep cache hot',
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
                            {!isPaceSeat
                                ? null
                                : tip(
                                      'pace-watch',
                                      'pace watch: this session',
                                      <Button
                                          key='pace-watch'
                                          onPress={() => void pressPace($)}
                                          {...(isPaceWatched
                                              ? {
                                                    variant:
                                                        'secondary' as const,
                                                }
                                              : { plain: true as const })}>
                                          🔋
                                      </Button>,
                                      leftOf('🔋', isPaceWatched),
                                  )}
                            {!isShown('stash.waker')
                                ? null
                                : tip(
                                      'waker',
                                      'fleet wake',
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
                                      'afk',
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
                            {!view.isOverrideOn
                                ? null
                                : tip(
                                      'operator-override',
                                      'operator override',
                                      <Button
                                          key='operator-override'
                                          onPress={() =>
                                              void handleOverrideOff()
                                          }
                                          variant='secondary'>
                                          🔓
                                      </Button>,
                                      leftOf('🔓', true),
                                  )}
                            {tip(
                                'settings',
                                'settings',
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
                                      'board',
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
                    // the readings pack left, then this session's 🔭 mark, always drawn; the switches hold the right
                    // edge (dima's o6 and o7, 22:03)
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
                    return (
                        <Box flexDirection='column'>
                            {row}
                            {/* the terminal reads the 5h and ctx on sline's line; the desktop keeps the bars (dima, 15:06) */}
                            {Svg ? meters : null}
                            {meter?.note ? (
                                <Text color='error' wrap='truncate-end'>
                                    {meter.note}
                                </Text>
                            ) : null}
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
