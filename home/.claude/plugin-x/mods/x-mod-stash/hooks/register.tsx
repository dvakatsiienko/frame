/* @jsx h */
import type { EngineInterface, Register, RenderElement } from 'claude-code';

import type {
    FieldDraft,
    OrbitAsk,
    OrbitAssumption,
    QuietLogLine,
    StashCap,
    StashEntry,
    StashField,
    StashLane,
    StashOrbit,
    StashPlan,
    StashView,
    StashWind,
} from '../types/stash.d.ts';
import {
    WIND_DELAY_MS,
    armHeldTells,
    armRelease,
    heldStuckMs,
    holdAfterQuiet,
    holdSteer,
    isQuietHome,
    quietLocked,
    releaseHeldSteers,
    steersOnCompact,
    takeSteers,
} from './held.ts';
import {
    JOIN_OWED,
    handBackJoins,
    joinsLocked,
    settleJoins,
    takeJoinLock,
    takeJoins,
} from './joins.ts';
import {
    MINUTE_MS,
    PACE,
    PING,
    POLL_MS,
    type ViewDoors,
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
    pressBegin,
    pressEnd,
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
    LANE_MAX,
    LANE_ROLES,
    LANE_STEER,
    LANE_STEER_OLD,
    LANE_STEP,
    LANE_TEXT_MAX,
    changeLaneSteer,
    dropLaneOrders,
    followCodies,
    followPlans,
    glideOp,
    laneRows,
    laneSpan,
    laneSteers,
    mergeLanes,
    openDispatchedLanes,
    readLanes,
    readPlanSteps,
    reshowLanes,
    showLanes,
    takeLaneMoves,
    writeLanes,
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
    statusOf,
} from './look.ts';
import {
    ASSUMED_MAX,
    CHANGED_MARK,
    ORBIT_TEXT_MAX,
    ORBIT_TOOL,
    PLAN_MAX,
    PRESS_DIR,
    bandPressLines,
    hasPlanMark,
    herdrTicks,
    isAllAsksMarkable,
    isFresh,
    isPressOn,
    joinRowsText,
    joinText,
    linkLabel,
    lockJoined,
    moved,
    oneLine,
    orbitOp,
    planTaken,
    planText,
    turnEnded,
    wrongText,
} from './orbit.ts';
import {
    EMPTY_ORBIT,
    KEPT,
    PREFIX,
    currentOrbit,
    dropTicks,
    inMarking,
    keepState,
    orbitNow,
    putOrbit,
    recordTicks,
    saveOrbit,
    startOrbit,
} from './orbit-store.ts';
import {
    isOverrideOn,
    readOverrideOn,
    setOverrideOn,
    takeOverridePress,
    writeOverrideOff,
} from './override.ts';
import { PACE_KEYS, PACE_SETTINGS, paceOf } from './pace.ts';
import { relayCrowWake, wakeForParkedLanes } from './parked-wake.ts';
import {
    type BackgroundTask,
    TRANSCRIPT_TAIL,
    backgroundWait,
    backgroundWaits,
    boldFleetWords,
    bulletDots,
    capOf,
    dropWaitAside,
    linkTickets,
    memberBadge,
    noticeOf,
    numberCircled,
    parseWait,
    ticketOf,
    unbold,
    waitSpans,
} from './parse.ts';
import { isAppPrompt, peerPing, quietHeldText } from './quiet.ts';
import {
    LEDGER_EVERY_MS,
    QUIET_ALARMED,
    QUIET_GAP,
    quietAlarm,
    quietLedger,
    quietLog,
    quietSilentMembers,
    takeGapNotes,
} from './quiet-books.ts';
import {
    SEND_TOOL,
    heldOf,
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
import type { Member } from './roster.ts';
import { memberOf, modelLabel, registry, staleProbes } from './roster.ts';
import { laneRoundLine } from './rounds.ts';
import { members } from './rows.ts';
import {
    MAIN_ROLE,
    SUCC,
    WING_ROLE,
    clearedNow,
    continueFromCleared,
    currentId,
    endIdentity,
    identity,
    isBgSelf,
    isLaneOwner,
    refreshSelfId,
    refreshThreads,
    runnerOf,
    selfLive,
    selfRecord,
    sessionName,
    startIdentity,
    threadRecords,
} from './session-identity.ts';
import { dropState, keepShelf, pollShelf } from './session-record.ts';
import type { IsPartOn, NumberName, SwitchName } from './settings-store.ts';
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
    herdrRows,
    knobRefusals,
    partRefusal,
    partsShown,
    readNumber,
    readSwitch,
    refreshShown,
    setKnobNumber,
    setSettingsOpen,
    settings,
    shownOf,
    takeHerdrRows,
    windEditsOf,
} from './settings-store.ts';
import { isSpeakingNow, playPress, refreshSpeaking, speak } from './speak.ts';
import {
    AFK_KEY,
    HERDR_READ,
    HOT,
    MODEL,
    REPLY,
    type Reply,
    WAKER_KEY,
    hotOf,
} from './store-keys.ts';
import { cleanTree, drawn } from './tree.ts';
import {
    addGridQs,
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
    CONTEXT,
    drawFill,
    drawFillAfterCompact,
    freshMeter,
    measureUsage,
    meterNow,
    setCompactAt,
} from './usage.ts';
import { STALE_MS, bare, errorText, writeWhole } from './util.ts';
import {
    COMPACTING,
    WIND,
    WIND_HOW,
    WIND_WORDS,
    flipWind,
    setWind,
    windAfterPress,
    windOf,
} from './wind.ts';
import {
    WIND_STORE_FILE,
    WIND_TEXT_CAP,
    WIND_TEXT_EDITS,
    type WindRow,
    isWindRow,
    windFileOf,
    windFileWith,
    windPidsOf,
    windRawTextOf,
    windTextOf,
} from './wind-store.ts';

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
// when dima last prompted anywhere: an idle session's herdr press waits for it before it wakes
const DIMA_AT = 'dima-at';
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
const LANE_OWNER = '🦉 clio';
// a glide card's member subcard or a quiet card, folded by default
const FOLDED_CARD = new RegExp(
    `^(lane:[^:]+:(${LANE_ROLES.join('|')})|quiet:.+)$`,
);
const LANE_STALE = 8;
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
// the how-to rules sit here, the tool's own text, so they load with the mod and leave with it (FRM-640; `rules/fleet-mods.md`
// keeps only what holds with the mod off). a rule line never starts with «op »: a test reads the op lines' order.
// when: dima, PK-439:W4, W13 (his tick slipstreams into a running turn). who: dima, 2026-11-11: «he should ask its
// coordinator, and if needed the coordinator asks me». guard: `x-mod-guard/FTR.md`
const ORBIT_ABOUT = [
    'orbit: your asks to dima on the fleet board; an ask goes here, never into a reply. 🛎️ tick = pick good to go, 🔁 replay = another round, plus his steer; marked asks reach you model-only; an unmarked ask means nothing yet. a --bg session has no board: its asks go to its coordinator.',
    "when: an ask goes up as soon as it is known: his tick slipstreams into a running turn, so one known at the turn's start is posted before the work, one born mid-turn the moment it is born, and the turn goes on with what does not hang on it; a recommendation, calm, never a rush, but never saved for the turn's end.",
    "who: a member's ask goes to its coordinator first, in its ping; the coordinator answers it or brings it to dima's orbit, so a member never asks dima directly.",
    'a pick names its whole outcome, so a tick needs no follow-up: a rename carries the new name («breather → breathing bars»), a choice its option, never the verb alone. a reply names an ask by its subject in plain words; its oN id stays on the board, never in the reply. another round is a follow, never a second add.',
    'guard: a command x-mod-guard refuses, or would: the first ask names its target in plain words in the text, the pick quotes it whole in one backtick span, any length, never in words, and his one tick runs exactly that once within 2 h.',
    `op add, asks [{ text, pick, hiddenNote, link }]: text one line ≤${ORBIT_TEXT_MAX} chars, subject first, readable alone (no «above», «this»); pick: your recommendation; hiddenNote: yours alone, its source and what a tick means; link: one https url, obsidian:// url or file path (spaces allowed) he opens in a click. irreversible (trash, push, close, merge) → lead with ⚠️, name the exact target.`,
    'op resolve, ids, words { id: closing word }: the asks answered this turn; they leave at its end, a worded one dim a turn more. ticked: «as ticked», or «changed: <what>» plus a follow or add.',
    'ops [{ op, … }]: several ops in one call, a result line each.',
    `op follow, id, text, pick: another round on an answered ask, same id and place, text ≤${ORBIT_TEXT_MAX} chars, marked ${CHANGED_MARK}.`,
    `op assume, texts: ≤${ASSUMED_MAX} a turn, ≤${ORBIT_TEXT_MAX} chars: unasked choices a wrong guess would cost a redo on, never routine; 🛎️ clears, ↩️ sends back with his steer.`,
    `op plan, lines: your next ${PLAN_MAX} moves, each ≤${ORBIT_TEXT_MAX} chars and readable alone; set at each turn end; untouched ${STALE_TURNS} turns reads stale. step: your lane step.`,
    `op glide (${LANE_OWNER}, or a wing on a card it created): act create, title, items [{ text, ticket, done }] or plan (path to the lane-plan.md: its «- [ ] NN · FRM-N text» lines are the steps, each with its ticket id, any count, a tick there moves the card, a hand step is refused): a lane's scope as 1–${LANE_MAX} plain steps ≤${LANE_TEXT_MAX} chars, no paths, op names or pr numbers; ticket optional; the result names the lane id. act link, id, session, role (codie or sixth-sense): a member's session id; a re-link of a role replaces the old one. act edit, id, title?, items?: the card refreshed in place, a kept step text keeps its done flag. act step, id, current: the step we are on, every step before it done; current = the count finishes it. act end, id: at the siesta or the halt after it finished. nothing moved for ${LANE_STALE} of your turns reads stale.`,
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

// this session's own second wind as the store holds it, read at each load for the band's button
let selfWind: StashWind['state'] | undefined;
let isAutoWindOn = true;
// what this session's last reply waits on, its 🔭 line
let wait: string | undefined;
let isPolling = false;
let isPaced = false;
// the main thread's tool calls this turn, and whether its one phases nudge went out
// a field never redraws because of its own typing: the surface runs a keystroke ahead of this module, so any changed
// `value` — the stored steer, or even the latest text this module heard — reset the field and threw the caret (dima,
// 16:15 and 16:22). while typing, the field keeps drawing the value it showed; once typing has been quiet for
// FIELD_QUIET_MS the stored text takes over. a change from outside (a steer cleared once it joined a turn) is drawn at
// once; when it equals what is already drawn the surface would keep the typed text, so the field remounts under a new key
// dima's o8, 17:14: «1-2 s at least» — a short pause no longer snaps a long field back to its start
const FIELD_QUIET_MS = 3000;
const FIELD_SAVE_MS = 1500;
const pendingSaves = new Map<
    string,
    { save: () => unknown; text: string; timer: { cancel: () => void } }
>();
// the boxes whose timed save is running: a flush leaves their text to that save
// a field was typed into within the quiet window: the poll holds its redraw till it passes
export const isTypingAt = (typedAt: readonly number[], now: number) =>
    typedAt.some((at) => now - at < FIELD_QUIET_MS);

// every save still waiting on a pause runs now: before a press, a prompt or a tool call reads what was typed; a text a
// reload dropped with its timer is saved by its box's key
async function flushFields($: EngineInterface) {
    await takeFieldsOnce($);
    const due = [...pendingSaves];
    pendingSaves.clear();
    for (const [, p] of due) p.timer.cancel();
    const lost = [...unsaved].filter(
        ([key]) =>
            !pendingSaves.has(key) &&
            !saving.has(key) &&
            !due.some(([k]) => k === key),
    );
    await Promise.all(
        due.map(async ([key, p]) => {
            try {
                await p.save();
            } catch (err) {
                $.ui.log(
                    `x-mod-stash: a steer was not saved (${key}): ${errorText(err)}`,
                );
            }
        }),
    );
    const failed = new Set<string>();
    const replayed = new Set<string>();
    let isOffered = false;
    for (const [key, text] of lost)
        await saveTyped($, key, text, bases.get(key))
            .then(async (isSaved) => {
                if (isSaved && !(await holdsSteer($, key, text)))
                    throw new Error('the store does not hold it');
                if (isSaved) replayed.add(key);
            })
            .catch((err) => {
                const tries = (failures.get(key) ?? 0) + 1;
                failures.set(key, tries);
                failed.add(key);
                if (tries >= REPLAY_TRIES) {
                    // a second give-up on the same box stacks: the board offers the newest, then the one before
                    keptSteers.set(key, [...(keptSteers.get(key) ?? []), text]);
                    failures.delete(key);
                    remountTexts.delete(key);
                    unsaved.delete(key);
                    isOffered = true;
                }
                $.ui.log(
                    `x-mod-stash: a kept steer was not saved (try ${tries} of ${REPLAY_TRIES}${tries >= REPLAY_TRIES ? ', kept for the board to offer back' : ''}): ${errorText(err)}`,
                );
            });
    if (!due.length && !lost.length) return;
    // only what this flush saved: a box typed into while it waited keeps its text
    for (const [key, { text }] of due) {
        if (!(await holdsSteer($, key, text))) continue;
        await settleHeld($, key);
        landed(key, text);
        if (unsaved.get(key) === text) unsaved.delete(key);
    }
    for (const [key, text] of lost)
        if (!failed.has(key) && unsaved.get(key) === text) {
            if (replayed.has(key)) await settleHeld($, key);
            else {
                // it yielded, or its box is gone: a newer steer draws, and his words stay on offer
                remountTexts.delete(key);
                const now = await storedSteer($, key);
                if (now?.trim() && !sameSteer(now, text)) {
                    keptSteers.set(key, [...(keptSteers.get(key) ?? []), text]);
                    isOffered = true;
                }
            }
            landed(key, text);
            failures.delete(key);
            unsaved.delete(key);
        }
    keepFields($);
    // publish only redraws an open board: on a closed one it would flush again and spend the other replays' tries
    if (isOffered && (await isOpen($))) await publish($);
}
const drafts = new Map<string, FieldDraft>();
const remounts = new Map<string, number>();
// the text each box typed since its last save
const unsaved = new Map<string, string>();
// what a remounted box draws while the store still refuses its text: a save that never landed has no stored steer to draw
const remountTexts = new Map<string, string>();
const heldOver = (key: string) =>
    unsaved.has(key) ? remountTexts.get(key) : undefined;
// what the store held of his typing as the view left: another board's steer that replaces it while he is away offers it back
const textsLeft = new Map<string, string>();
// the stored steer each box's unsaved text was typed over, so a replay after a reload knows a newer one came in
const bases = new Map<string, string>();
// the base before a box's own last save: a keystroke drawn from a render older than that save still reads it
const before = new Map<string, string>();
const sameSteer = (a: string | undefined, b: string | undefined) =>
    (steerOf(a ?? '') ?? '') === (steerOf(b ?? '') ?? '');
function landed(key: string, text: string) {
    before.set(key, bases.get(key) ?? '');
    bases.set(key, text);
}
// a replay the store refuses this many flushes in a row is tried no more: its text is kept by its box's key and the board
// offers it back beside the box, never dropped (dima's o123)
const REPLAY_TRIES = 3;
const keptSteers = new Map<string, string[]>();
const failures = new Map<string, number>();
const saving = new Set<string>();
const FIELDS = { key: 'fields', plugin: 'x-mod-stash' } as const;
// a hot reload starts a fresh module, and render may not write $.state: a keystroke, a save and an unmount keep the
// boxes here, in order, since a keystroke lands in a sync handler where no write can be awaited (FRM-492)
let fieldsWrite: Promise<unknown> = Promise.resolve();
let fieldsKept = '';
// only a box being typed into, holding a draft or a kept steer is kept, so the key never grows with every box ever drawn; a hook that
// runs before a reloaded module's start takes the kept boxes back first, or it would write the fresh module's empty maps
function keepFields($: EngineInterface) {
    fieldsWrite = fieldsWrite
        .then(async () => {
            await takeFieldsOnce($);
            const boxes: Record<string, StashField> = {};
            for (const key of new Set([
                ...drafts.keys(),
                ...unsaved.keys(),
                ...keptSteers.keys(),
                ...textsLeft.keys(),
            ])) {
                const draft = drafts.get(key);
                const kept = keptSteers.get(key);
                const gen = remounts.get(key);
                const pending = unsaved.get(key);
                const base = bases.get(key);
                const left = textsLeft.get(key);
                boxes[key] = {
                    ...(draft ? { draft } : {}),
                    ...(gen ? { gen } : {}),
                    ...(pending === undefined ? {} : { pending }),
                    ...(pending === undefined || base === undefined
                        ? {}
                        : { base }),
                    ...(kept?.length ? { keptSteers: kept } : {}),
                    ...(left === undefined ? {} : { left }),
                };
            }
            const text = JSON.stringify(boxes);
            if (text === fieldsKept) return;
            fieldsKept = text;
            await $.state.set(FIELDS, boxes);
        })
        .catch((err) =>
            $.ui.log(`x-mod-stash: steer boxes not kept: ${errorText(err)}`),
        );
}
// one take per module: a draw, a flush or a write that runs before the start waits on the same read
let fieldsTaken: Promise<void> | undefined;
function takeFieldsOnce($: EngineInterface) {
    fieldsTaken ??= takeFields($);
    return fieldsTaken;
}
// a reload's start takes the boxes back, so each draws on as it mounted
async function takeFields($: EngineInterface) {
    const kept = (await $.state.get(FIELDS)).value ?? {};
    for (const [key, f] of Object.entries(kept)) {
        if (f.draft && !drafts.has(key)) drafts.set(key, f.draft);
        if (f.gen && !remounts.has(key)) remounts.set(key, f.gen);
        if (f.pending !== undefined && !unsaved.has(key)) {
            unsaved.set(key, f.pending);
            if (f.base !== undefined) bases.set(key, f.base);
        }
        if (f.keptSteers?.length && !keptSteers.has(key))
            keptSteers.set(key, f.keptSteers);
        if (f.left !== undefined && !textsLeft.has(key))
            textsLeft.set(key, f.left);
    }
}
// a press on a kept steer saves it over whatever the box holds now: his own pick, so no base to yield to
async function offerBack($: EngineInterface, key: string) {
    const list = keptSteers.get(key) ?? [];
    const text = list.at(-1);
    if (text === undefined) return;
    const isSaved = await saveTyped($, key, text, undefined, false).catch(
        (err) => {
            $.ui.log(
                `x-mod-stash: a kept steer was not saved: ${errorText(err)}`,
            );
            return false;
        },
    );
    // a yield, a gone target or a locked ask wrote nothing: the offer stays
    if (!isSaved) return;
    if (list.length > 1) keptSteers.set(key, list.slice(0, -1));
    else keptSteers.delete(key);
    landed(key, text);
    keepFields($);
    await publish($);
}
// ✕ on a kept steer with no box: drops the newest, his choice, so a gone box's text has a way out
async function dropKept($: EngineInterface, key: string) {
    const list = keptSteers.get(key) ?? [];
    if (list.length > 1) keptSteers.set(key, list.slice(0, -1));
    else keptSteers.delete(key);
    keepFields($);
    await publish($);
}
// the steer the store holds for a box, read the way its save writes it; undefined for none or a box that is gone
async function storedSteer($: EngineInterface, key: string) {
    const own = /^orbit:(steer|asteer):(.+)$/.exec(key);
    if (own) {
        const o = await currentOrbit($);
        return own[1] === 'steer'
            ? o.asks.find((a) => a.id === own[2])?.steer
            : o.assumed?.find((y) => y.id === own[2])?.steer;
    }
    if (key === 'plan:steer') return (await currentOrbit($)).plan?.steer;
    const step = /^lane:([^:]+):steer$/.exec(key);
    return step?.[1] ? (await laneSteers($))[step[1]]?.steer : undefined;
}
async function holdsSteer($: EngineInterface, key: string, text: string) {
    return sameSteer(await storedSteer($, key), text);
}
// a held text reached the store: the ask's box keeps drawing it as what it mounted with, since a changed value resets the field
async function settleHeld($: EngineInterface, key: string) {
    const held = remountTexts.get(key);
    remountTexts.delete(key);
    const own = /^orbit:steer:(.+)$/.exec(key);
    if (held === undefined || !own) return;
    await inMarking(async () => {
        const o = await currentOrbit($);
        await putOrbit($, {
            ...o,
            asks: o.asks.map((a) =>
                a.id === own[1] ? { ...a, shown: held } : a,
            ),
        });
    });
}
// a dropped view's boxes mount again with the stored steer, or a text the store refused; a fold, a closed board and a
// thread switch all come through here
async function forgetMountedText($: EngineInterface) {
    await takeFieldsOnce($);
    holdUnsaved();
    await unmountSteers($);
}
function holdUnsaved() {
    drafts.clear();
    remountTexts.clear();
    for (const [key, text] of unsaved) remountTexts.set(key, text);
}
// a sent steer is the turn's, so a later clear and a newer steer offer nothing back
async function isSentSteer($: EngineInterface, key: string) {
    const own = /^orbit:steer:(.+)$/.exec(key);
    if (own)
        return !!(await currentOrbit($)).asks.find((a) => a.id === own[1])
            ?.isLocked;
    return false;
}
// a turn carried these boxes' text while he was away: it is sent, so a newer steer at his return offers nothing back
function carried($: EngineInterface, keys: string[]) {
    if (keys.filter((key) => textsLeft.delete(key)).length) keepFields($);
}
// a thread switch on the desktop drops the board's view: every word goes to the store as he leaves, however soon after
// the last keystroke, and a remote steer is no longer held off by his typing; the boxes forget what they mounted with
// here, not at the return, since the return's first draw can overtake the attach hook (FRM-531 sixth sense)
async function leaveBoxes($: EngineInterface) {
    // before the first wait: a slow save must not leave the return's first draw reading the old text
    holdUnsaved();
    try {
        await flushFields($);
    } finally {
        await forgetMountedText($);
    }
    textsLeft.clear();
    for (const [key, text] of bases)
        if (
            text.trim() &&
            !unsaved.has(key) &&
            (await holdsSteer($, key, text)) &&
            !(await isSentSteer($, key))
        )
            textsLeft.set(key, text);
    keepFields($);
}
// a steer another board wrote while he was away wins, and his text is offered
async function returnToBoxes($: EngineInterface) {
    // a steer another board wrote may still wait as a mark the poll has not read
    await absorbMarks($);
    let isOffered = false;
    const left = [...textsLeft];
    textsLeft.clear();
    for (const [key, text] of left) {
        const now = await storedSteer($, key);
        if (sameSteer(now, text) || !now?.trim()) continue;
        keptSteers.set(key, [...(keptSteers.get(key) ?? []), text]);
        isOffered = true;
    }
    keepFields($);
    if (isOffered) await publish($);
}
// the save a box's closure ran, rebuilt from its key: the closure went with the old module. it lands only while the
// stored steer is still the one the text was typed over or none at all, so a newer steer from another board wins; a text kept with no
// base came from a module before the base was kept, and lands as it did there; true only once the steer was written, so
// a yield, a target gone or a locked ask reads false; `isTyped` false (an offer pressed back) remounts an ask's box
async function saveTyped(
    $: EngineInterface,
    key: string,
    text: string,
    base?: string,
    isTyped = true,
): Promise<boolean> {
    const steer = steerOf(text);
    const isBase = (now: string | undefined) =>
        base === undefined || !now?.trim() || sameSteer(now, base);
    const yielded = () => {
        $.ui.log(`x-mod-stash: a kept steer yielded to a newer one (${key})`);
        return false;
    };
    if (key !== 'plan:steer' && !isBase(await storedSteer($, key)))
        return yielded();
    const own = /^orbit:(steer|asteer):(.+)$/.exec(key);
    if (own) {
        const o = await currentOrbit($);
        if (own[1] === 'steer') {
            // a locked or resolved ask takes no steer: markAsks skips it without a word
            const ask = o.asks.find((a) => a.id === own[2]);
            if (!ask || ask.isLocked || ask.isResolved) return false;
            await markAsks(
                $,
                (x) => (x.id === own[2] ? { ...x, steer } : x),
                false,
                isTyped ? own[2] : undefined,
            );
            return true;
        }
        if (!o.assumed?.some((y) => y.id === own[2])) return false;
        await changeAssumed($, (y) => (y.id === own[2] ? { ...y, steer } : y));
        return true;
    }
    if (key === 'plan:steer') {
        return inMarking(async () => {
            const o = await currentOrbit($);
            if (!o.plan) return false;
            if (!isBase(o.plan.steer)) return yielded();
            await saveOrbit($, { ...o, plan: { ...o.plan, steer } }, () =>
                keepShelf($),
            );
            return true;
        });
    }
    const step = /^lane:([^:]+):steer$/.exec(key);
    if (!step?.[1]) return false;
    await changeLaneSteer($, step[1], (n) => ({ ...n, steer }));
    return true;
}
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
    // a landed save drops the texts typed before it, since saves land in order: the history holds only what is in
    // flight, with no cap a long burst could overflow (FRM-492)
    return {
        draft: isOwn
            ? {
                  ...draft,
                  isLanded: true,
                  sent: draft.sent.slice(draft.sent.indexOf(saved)),
              }
            : draft,
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
    sent: [...(draft?.sent ?? []), text],
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
    const value =
        view.kind === 'held' ? view.draft.drawn : (heldOver(key) ?? saved);
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
            typed($, key, text, saved, save);
        },
        value,
    };
}

// when each ask's own steer box was last typed into
const askTypedAt = new Map<string, number>();
// every field's last keystroke, for the holds that wait out typing
const typedAts = () => [
    ...[...drafts.values()].map((d) => d.at),
    ...askTypedAt.values(),
];
function typed(
    $: EngineInterface,
    key: string,
    text: string,
    saved: string,
    save: () => unknown,
) {
    pendingSaves.get(key)?.timer.cancel();
    // a burst's first keystroke records the steer it types over; right after his own save the render may still show the
    // steer before it, and that one is his own save too
    if (
        !unsaved.has(key) &&
        !(
            bases.has(key) &&
            (sameSteer(saved, bases.get(key)) ||
                sameSteer(saved, before.get(key)))
        )
    )
        bases.set(key, saved);
    pendingSaves.set(key, {
        save,
        text,
        timer: $.clock.after(FIELD_SAVE_MS, async () => {
            pendingSaves.delete(key);
            saving.add(key);
            try {
                await save();
            } finally {
                saving.delete(key);
            }
            if (await holdsSteer($, key, text)) {
                await settleHeld($, key);
                landed(key, text);
                if (unsaved.get(key) === text) unsaved.delete(key);
            }
            keepFields($);
        }),
    });
    unsaved.set(key, text);
    keepFields($);
}
// an ask's own steer box draws the text it mounted with, under its remount count, both kept on the ask in $.state: no
// history to cap, and a reload, a poll or another session's redraw never changes its value; only a write that
// replaces the steer does (FRM-492)
function askBox($: EngineInterface, a: OrbitAsk) {
    const key = `orbit:steer:${a.id}`;
    return {
        key: a.gen ? `${key}#${a.gen}` : key,
        type: (text: string, save: () => unknown) => {
            // clock-ok: a keystroke lands in a sync handler, where $.clock.now() cannot be awaited
            askTypedAt.set(key, Date.now());
            typed($, key, text, a.steer ?? '', save);
        },
        value: heldOver(key) ?? a.shown ?? a.steer ?? '',
    };
}
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
// the button's emoji per state; idle draws the bird
export const WIND_EMOJI = {
    asked: '🥚',
    cancelled: '↩️',
    idle: '🐦‍🔥',
    refreshing: '🌀',
    refused: '🛑',
    stopped: '⚠️',
    writing: '✍️',
} as const;
const WIND_SAY = {
    asked: 'asked, waits for its next turn',
    cancelled: 'cancelled, tells it at its next turn',
    refreshing: 'compacting onto its handoff',
    refused: 'refused, work started after pending: none',
    stopped: 'stopped, its handoff is still in the store',
    writing: 'finishing its step, then its handoff',
} as const;
const windSay = (w: StashWind) =>
    w.isGone ? 'stopped, its handoff left the store' : WIND_SAY[w.state];
const WIND_NOTE = `🐦‍🔥 second wind: dima asked you to refresh your context at a good stop. ${WIND_WORDS} finish the step you are on, nothing interrupts it; a member mid-round (sixth sense's loop, a designer's take) stops after that round or take. then ${WIND_HOW}`;
// clio's good stop is todo 16's nine steps (dima, 10-13)
const WIND_NOTE_OWNER = `🐦‍🔥 second wind: dima asked you to checkpoint once the topic you are on is done — no rush, no deadline. ${WIND_WORDS} finish that topic whole first: every lane and agent it started lands, its findings fold, the distill, the print, the log and the commit; a topic is never split across a compact. take nothing new after it. then run clio:checkpoint, tell the fleet, and put your «right after the pickup I'd do X» ask into orbit. then ${WIND_HOW}`;
const windRefused = (what: string) =>
    `🐦‍🔥 second wind refused: ${what} still runs after you said pending: none, so nothing compacted. stop it with TaskStop or name it in pending, then call ${ORBIT_TOOL} op second-wind again.`;
// FRM-505: past the 🎛️ `wind-notice` line a session hears its wind is coming, past `wind-at` the mod asks for it (W1,
// W2, W1947, W1948); a fill NOTICE_REARM under the notice re-arms it, a fill under the wind line the ask, so dima's ↩️
// holds until the fill drops; OVERRUN past the wind line the coordinator hears it (W1862)
const NOTICE_REARM = 10;
const OVERRUN = 5;
const FILL = 'fill:';
const AUTO_WIND = 'second-wind-auto:';
type AutoWind = { on: boolean; at: number };
// noticed, asked and proposed hold the turn they landed in; windAt the wind line the notice saw, so a lowered knob never
// asks a thread already past it; proposed is the 🍃-off coordinator's line, so afk turning on past it still asks
type FillMark = {
    noticed?: number;
    asked?: number;
    proposed?: number;
    windAt?: number;
    overrun?: true;
};
const FILL_NOTICE = `🐦‍🔥 context at {fill} %: a second wind is coming. {wind} % is the upper boundary, where the mod asks for it; nothing is urgent. do not compact now: plan your nearest steps so you finish the meaningful part you are in, commit it, solve its tails, write your handoff with x:handoff (or \`x handoff write\` where that skill is missing), then take the wind through ${ORBIT_TOOL} op second-wind. never mid-build or mid-step.`;
const FILL_PROPOSE =
    "🐦‍🔥 second wind due at {fill} %: past the {wind} % boundary, and this thread's 🍃 second wind auto is off: propose the wind to dima in orbit at your next good stop, never take it yourself.";
const WIND_NOTE_AUTO = `🐦‍🔥 second wind: the mod asks you for it, your context is past {wind} %: a must, never a rush. finish the step you are on and commit it, nothing interrupts it; never wind mid-build. then ${WIND_HOW}`;
const WIND_NOTE_AUTO_OWNER = `🐦‍🔥 second wind: the mod asks you to checkpoint, your context is past {wind} %: a must, never a rush. finish the topic you are on whole first: every lane and agent it started lands, its findings fold, the distill, the print, the log and the commit; a topic is never split across a compact. take nothing new after it. then run clio:checkpoint, tell the fleet, and put your «right after the pickup I'd do X» ask into orbit. then ${WIND_HOW}`;
// the five notes dima may rewrite, each a row of the second-wind store; an empty row is the default here (FRM-634).
// `{fill}` and `{wind}` take the thread's fill and the wind line
const WIND_DEFAULTS: Record<WindRow, string> = {
    'stash.wind.text.at': WIND_NOTE_AUTO,
    'stash.wind.text.at.coordinator': WIND_NOTE_AUTO_OWNER,
    'stash.wind.text.notice': FILL_NOTICE,
    'stash.wind.text.press': WIND_NOTE,
    'stash.wind.text.propose': FILL_PROPOSE,
};
const windStorePath = (home: string) =>
    `${home}/.claude/shelf/${WIND_STORE_FILE}`;
async function readWindFile($: EngineInterface) {
    const home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
    return windFileOf(
        await $.fs.read(windStorePath(home)).catch(() => undefined),
    );
}
// a text over the cap is refused where it is read: the default stands, one log line per row and process
const overCapLogged = new Set<WindRow>();
// one text per row, fleet-wide: the first written row of `rows` wins, then `fallback`, then the first row's default; so
// his `at` or `press` text reaches the coordinator too, and her own default only where he wrote none
async function windText(
    $: EngineInterface,
    rows: readonly [WindRow, ...WindRow[]],
    n: { fill?: number; wind?: number },
    fallback?: string,
) {
    const file = await readWindFile($);
    let written: string | undefined;
    for (const row of rows) {
        const { isOverCap, text } = windTextOf(file, row);
        if (isOverCap && !overCapLogged.has(row)) {
            overCapLogged.add(row);
            $.ui.log(
                `x-mod-stash second wind: the text of ${row} is over ${WIND_TEXT_CAP} chars, so its default is read`,
            );
        }
        written ??= text;
    }
    return (written ?? fallback ?? WIND_DEFAULTS[rows[0]])
        .replaceAll('{fill}', String(n.fill ?? '{fill}'))
        .replaceAll('{wind}', String(n.wind ?? '{wind}'));
}
const WIND_CANCELLED =
    '🐦‍🔥 second wind cancelled: dima took the refresh back. carry on; no handoff needed for it.';
const ingestBy = (slug: string) =>
    `run \`x handoff ingest ${slug} --for <your own role token> --json\`, read the printed CST whole (never silence it), run its META first-acts, then go on from its S`;
// a session with no plugin x skills has no /x:handoff-ingest to queue (crow's pane, FRM-505)
const windIngest = (slug: string) =>
    `🐦‍🔥 second wind: this conversation was just compacted onto your handoff «${slug}». before anything else, ${ingestBy(slug)}.`;
const windGone = (slug: string) =>
    `🐦‍🔥 second wind stopped before its compact: your handoff «${slug}» left the store, so nothing was compacted and your context is whole. write the handoff again and call ${ORBIT_TOOL} op second-wind with its slug.`;
const windStopped = (slug: string) =>
    `🐦‍🔥 second wind stopped before its ingest, so your handoff «${slug}» is still in the store. ${ingestBy(slug)}.`;

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
    if (await readSwitch($, 'quiet'))
        await quietSilentMembers($, now, viewDoors($));
    const held = heldOf((await quietOf($)).held);
    if (!held) return;
    const oldest = held.reduce((a, b) => (b.at < a.at ? b : a));
    if (now - oldest.at > (await heldStuckMs($)))
        await quietAlarm(
            $,
            `stuck:${oldest.at}`,
            `${held.length} held ping${held.length === 1 ? '' : 's'} stuck ${Math.round((now - oldest.at) / 60_000)} min, oldest from ${oldest.from}`,
        );
}

// herdr's presses for this session past what it read last; the file is herdr's board's alone, so this side only reads
// and keeps its own watermark. x-mod-guard reads the same file as his tick, its ticks-write rule keeping seats out (FRM-544)
async function herdrMarksOf($: EngineInterface, sid: string) {
    const home = await $.env.get('HOME').catch(() => undefined);
    const text = await $.fs
        .read(`${home}/.claude/shelf/orbit-ticks/${sid}.jsonl`)
        .catch(() => '');
    const read = await $.store.get(HERDR_READ + sid).catch(() => undefined);
    const after = typeof read === 'number' ? read : 0;
    return { after, ...herdrTicks(text, after) };
}

// a steer typed into this session's own box a moment ago is newer than a card's edit that lands now
const isTypedHere = (askId: string) =>
    isTypingAt(
        [askTypedAt.get(`orbit:steer:${askId}`) ?? 0],
        // clock-ok: compared with the drafts' own Date.now() stamps, so both sides read one clock
        Date.now(),
    );

// dima's presses on herdr's board join this session's own orbit, as if made here; a steer typed here stays in its box over
// the press's (PK-149)
async function absorbMarks($: EngineInterface) {
    const sid = await currentId($);
    if (!sid) return;
    const herdr = await herdrMarksOf($, sid);
    if (herdr.last <= herdr.after) return;
    // his tick from herdr is an event: the bookkeeping jobs tick at 4 s again
    await markActive($);
    let isSaved = false;
    // asks his newer ↩️ took back from an accepted mark: their tick record goes too, so the guard honours no tick the
    // board no longer shows
    const retracted: OrbitAsk[] = [];
    const accepted: OrbitAsk[] = [];
    await inMarking(async () => {
        const o = await currentOrbit($);
        isSaved = await saveOrbit(
            $,
            {
                ...o,
                asks: o.asks.map((a) => {
                    // a new herdr press replaces the ask's mark, the newest press winning as at x-mod-guard: his ↩️ then 🛎
                    // is a tick (it once kept the first, which locked him out, sixth sense round 1 on FRM-544); it marks only
                    // the question he read, never the round a follow put under the same id
                    const h = herdr.marks[a.id];
                    const m = isPressOn(h, a) ? h : undefined;
                    if (!m || a.isLocked || a.isResolved) return a;
                    // a herdr ↩️ takes back a tick a turn already took, whose mark the turn end cleared: the deck's tick is a
                    // toggle, and the record would still stand for its 2 h
                    if (m.mark !== 'accepted') retracted.push(a);
                    // his 🛎 from herdr gets the tick record a seat-board 🛎 gets: x-herdr-deck prunes the press once read
                    // and the turn that takes the ask clears its mark, so the record is what x-mod-guard honours for 2 h
                    // (clio's o49 at 19:30, wing 1's o13 at 19:08)
                    if (m.mark === 'accepted' && a.mark !== 'accepted')
                        accepted.push(a);
                    return {
                        ...a,
                        isChanged: false,
                        isHerdrMark: true,
                        mark: m.mark,
                        markedAt: m.mark ? m.at : undefined,
                        steer: isTypedHere(a.id)
                            ? a.steer
                            : m.isSteerEdit
                              ? m.steer
                              : // his untick from herdr takes back the steer his tick brought
                                !m.mark
                                ? undefined
                                : (a.steer ?? m.steer),
                    };
                }),
            },
            () => keepShelf($),
        );
    });
    if (isSaved && retracted.length) await recordTicks($, retracted, false);
    if (isSaved && accepted.length) await recordTicks($, accepted, true);
    // a press the orbit did not keep is read again at the next take
    if (isSaved && herdr.last > herdr.after)
        await $.store.set(HERDR_READ + sid, herdr.last).catch(() => undefined);
}

// an idle session whose asks were marked from another board wakes once dima prompts anywhere after the marks: one turn
// carrying all of them. the submitted prompt skips this plugin's own prompt.submit hook, so the marks ride its text
async function wakeForMarks($: EngineInterface) {
    if (
        (await $.state.get(TURN).catch(() => undefined))?.value?.isBusy ??
        turn.isBusy
    )
        return;
    if (!(await partsShown($))('stash.orbit')) return;
    const dimaAt = Number(await $.store.get(DIMA_AT).catch(() => 0)) || 0;
    const due = await takeMarks($, (o) => {
        const held = o.asks
            .filter(isFresh)
            .filter((a) => a.markedAt !== undefined);
        return held.length &&
            dimaAt > Math.min(...held.map((a) => a.markedAt ?? 0))
            ? held
            : [];
    });
    if (due.length)
        void selfSubmit(
            $,
            joinText(due, tickSentence(await orbitTexts($), due.length)),
            false,
            () => prepareTurn(viewDoors($)),
        ).catch(() => undefined);
}

// a plan set this turn counts from the turn's end, so a prompt landing mid-turn would read it as -1
const planAge = (o: StashOrbit) =>
    o.plan === undefined ? undefined : Math.max(0, o.turns - o.plan.at);

// dima's own words for three orbit lines, typed in herdr's settings and read at each nudge, no restart: a blank or
// missing row, or a settings file that does not read, is the built-in text
const ORBIT_TEXT_ROWS = {
    lane: 'stash.orbit.text.lane-stale',
    plan: 'stash.orbit.text.plan-stale',
    tick: 'stash.orbit.text.tick',
} as const;
type OrbitTexts = Partial<Record<keyof typeof ORBIT_TEXT_ROWS, string>>;
async function orbitTexts($: EngineInterface): Promise<OrbitTexts> {
    const home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
    const rows = await herdrRows($, home).catch(
        (): Record<string, unknown> => ({}),
    );
    const typed = (key: string) => {
        const text = rows[key];
        return typeof text === 'string' && text.trim()
            ? text.trim()
            : undefined;
    };
    return {
        lane: typed(ORBIT_TEXT_ROWS.lane),
        plan: typed(ORBIT_TEXT_ROWS.plan),
        tick: typed(ORBIT_TEXT_ROWS.tick),
    };
}
// `{name}` takes the value its line has, `{tool}` the orbit tool's name in every line; a name the line does not know
// stays as he typed it
const filled = (text: string, values: Record<string, string | number>) =>
    text.replace(/\{(\w+)\}/g, (all, name: string) =>
        name === 'tool'
            ? ORBIT_TOOL
            : name in values
              ? String(values[name])
              : all,
    );
const tickSentence = (texts: OrbitTexts, n: number) =>
    texts.tick === undefined ? undefined : filled(texts.tick, { n });
const PLAN_STALE_TEXT = 'stale: set it again';
const LANE_STALE_TEXT = `lane {id} «{title}» moved nothing for {n} of your turns, stale: step it or end it through ${ORBIT_TOOL} op glide.`;

// what this session was last told of its orbit and its stale lanes, in process memory as `isPrimed` is: the same state
// adds no line to the next prompt (FRM-640: a sentence on every prompt piled into the history). a compaction, a /clear
// or a resume drops what was told, so the state prints once again; a value kept by session id would outlive all three
let toldOrbit: string | undefined;
const toldStaleLanes = new Set<string>();
function forgetTold() {
    toldOrbit = undefined;
    toldStaleLanes.clear();
}

// the orbit note of a prompt, only when the state differs from `told`: the open ask ids and whether the plan is unset,
// set or stale, never its age, which moves every turn; an orbit that never held an ask or a plan says nothing
function orbitReminder(
    o: StashOrbit,
    isOn: IsPartOn,
    told: string | undefined,
    staleText = PLAN_STALE_TEXT,
) {
    const open = o.asks.filter((a) => !a.isResolved);
    const isPhasesOn = isOn('stash.phases');
    const age = isPhasesOn ? planAge(o) : undefined;
    const state = !isPhasesOn
        ? 'off'
        : age === undefined
          ? 'none'
          : age >= STALE_TURNS
            ? 'stale'
            : 'set';
    const plan = {
        none: '; no plan set',
        off: '',
        set: '; plan set',
        stale: `; plan set ${age} turns ago, ${filled(staleText, { n: age ?? 0 })}`,
    }[state];
    const key = `${open.map((a) => a.id).join(',')}|${state}`;
    if (
        key === told ||
        (told === undefined && !open.length && age === undefined)
    )
        return { key, line: undefined };
    const asks = open.length
        ? `orbit holds ${open.length} open ask${open.length === 1 ? '' : 's'} (${open.map((a) => a.id).join(', ')})`
        : 'orbit holds no open ask';
    return { key, line: `${asks}${plan}.` };
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
    await inMarking(async () => {
        const o = await currentOrbit($);
        await saveOrbit(
            $,
            {
                ...o,
                assumed: (o.assumed ?? []).flatMap((x) => {
                    const changed = change(x);
                    return changed ? [changed] : [];
                }),
            },
            () => keepShelf($),
        );
    });
}

async function markAsks(
    $: EngineInterface,
    change: (a: OrbitAsk) => OrbitAsk,
    isMark = false,
    typedId?: string,
) {
    await inMarking(() => markAsksNow($, change, isMark, typedId));
}
async function markAsksNow(
    $: EngineInterface,
    change: (a: OrbitAsk) => OrbitAsk,
    isMark: boolean,
    typedId: string | undefined,
) {
    // only a 🛎️ or ↩️ press means dima is at the mac: a steer or a speak press never ends mobile mode (dima, 11:16)
    if (isMark) await $.state.set(MOBILE, false).catch(() => undefined);
    const o = await currentOrbit($);
    const asks = o.asks.map((a) =>
        a.isLocked || a.isResolved ? a : change(a),
    );
    return saveOrbit($, { ...o, asks }, () => keepShelf($), typedId);
}

// a turn takes his marks in the marking queue: a press lands wholly before or after the lock, never inside it
function takeMarks($: EngineInterface, pick: (o: StashOrbit) => OrbitAsk[]) {
    return inMarking(async () => {
        const o = await currentOrbit($);
        const asks = pick(o);
        if (asks.length)
            await saveOrbit($, lockJoined(o, asks), () => keepShelf($));
        carried(
            $,
            asks.map((a) => `orbit:steer:${a.id}`),
        );
        return asks;
    });
}

// a turn takes his phases mark the same way: a reorder lands wholly before or after, never put back
function takePlanMark($: EngineInterface) {
    return inMarking(async () => {
        const o = await currentOrbit($);
        if (!hasPlanMark(o.plan)) return undefined;
        await saveOrbit($, { ...o, plan: planTaken(o.plan) }, () =>
            keepShelf($),
        );
        carried($, ['plan:steer']);
        return o.plan;
    });
}

// an unmounted box mounts again with the stored steer: a fold or a closed board drops what each box mounted with
async function unmountSteers($: EngineInterface) {
    askTypedAt.clear();
    keepFields($);
    await inMarking(async () => {
        const o = await currentOrbit($);
        if (!o.asks.some((a) => a.shown !== undefined)) return;
        await putOrbit($, {
            ...o,
            asks: o.asks.map(({ shown: _, ...a }) => a),
        });
    });
}

async function pressMarkNow(
    $: EngineInterface,
    id: string,
    mark: 'accepted' | 'rejected',
) {
    await $.state.set(MOBILE, false).catch(() => undefined);
    const ask = (await currentOrbit($)).asks.find((a) => a.id === id);
    // a press on a frame drawn before his prompt locked the ask changes nothing, so it keeps the record (S1)
    if (!ask || ask.isLocked || ask.isResolved) return;
    const next = ask.mark === mark ? undefined : mark;
    const isTicked = next === 'accepted';
    if (isTicked) await recordTicks($, [ask], true);
    const isKept = await markAsksNow(
        $,
        (a) =>
            a.id === id
                ? { ...a, isChanged: false, isHerdrMark: undefined, mark: next }
                : a,
        false,
        undefined,
    );
    // a mark that never landed takes its record with it, so a guard never honours a tick the board does not show
    if (!isTicked || !isKept) await recordTicks($, [ask], false);
}
// ✅ is a press on the frame he read: an ask added since waits for its own look
async function pressAllAsksNow(
    $: EngineInterface,
    drawn: Pick<OrbitAsk, 'id' | 'text'>[],
) {
    await $.state.set(MOBILE, false).catch(() => undefined);
    const open = (await currentOrbit($)).asks.filter(
        (a) => !a.mark && !a.isLocked && !a.isResolved,
    );
    // the text too: a follow keeps the id and asks a new question he has not read
    const asks = open.filter(
        (a) =>
            drawn.some((d) => d.id === a.id && d.text === a.text) &&
            isAllAsksMarkable(a),
    );
    // a merge ask is ⚠️: a silent skip would read as a block at the guard
    const skipped = open.filter((a) => !asks.includes(a));
    if (skipped.length)
        await $.ui.toast(
            `✅ left unticked: ${skipped.map((a) => `${a.id} ${a.text}`).join('; ')}`,
        );
    if (!asks.length) return;
    await recordTicks($, asks, true);
    const isKept = await markAsksNow(
        $,
        (a) =>
            asks.some((x) => x.id === a.id)
                ? {
                      ...a,
                      isChanged: false,
                      isHerdrMark: undefined,
                      mark: 'accepted',
                  }
                : a,
        false,
        undefined,
    );
    if (!isKept) await recordTicks($, asks, false);
}
async function pressAllAsks(
    $: EngineInterface,
    drawn: Pick<OrbitAsk, 'id' | 'text'>[],
) {
    await inMarking(() => pressAllAsksNow($, drawn));
}
async function pressMark(
    $: EngineInterface,
    id: string,
    mark: 'accepted' | 'rejected',
) {
    await inMarking(() => pressMarkNow($, id, mark));
}

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

// FRM-649 (FRM-616:W10): one ask counter for the fleet, `ask-counter` in $.store, read and bumped under a lock dir beside
// the shelf (the joins' rule: no compare-and-swap exists); with no live session's `asks:` key no thread holds an open ask,
// so the count starts at 1 again, past any id this thread still draws. `publish` saves the asks before the lock frees, or
// a thread taking it next reads no `asks:` key and mints the same o1 again. undefined: the lock stayed held; a host that
// runs no process (a test world) mints unlocked
const ASK_COUNTER = 'ask-counter';
async function mintAsks<T>(
    $: EngineInterface,
    count: number,
    drawn: string[],
    publish: (first: number) => Promise<T>,
) {
    const home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
    const lock = `${home}/.claude/shelf/ask-counter.lock`;
    let isLocked = true;
    for (let tries = 0; ; tries++) {
        const took = await takeJoinLock($, lock).catch(() => undefined);
        if (took === undefined) {
            isLocked = false;
            break;
        }
        if (took) break;
        if (tries === 20) return undefined;
        // a process sleep spends none of the hook's 10 s budget, where $.clock.sleep would (engine.md)
        await $.process.run(['sleep', '0.1']);
    }
    try {
        // a gone session's key outlives it (only its own save deletes it): only a live one holds; a registry that will
        // not read, or lists no session at all, holds on any key, the side that never mints a taken id
        const live = await registry($)
            .then((rs) =>
                rs.length
                    ? new Set(
                          rs.filter((r) => r.isAlive).map((r) => r.base.sid),
                      )
                    : undefined,
            )
            .catch(() => undefined);
        const self = await currentId($);
        const isHeld = (await $.store.keys()).some((k) => {
            const sid = k.slice(PREFIX.length);
            return (
                k.startsWith(PREFIX) && (!live || sid === self || live.has(sid))
            );
        });
        const kept = (await $.store.get(ASK_COUNTER).catch(() => undefined)) as
            | { next?: unknown }
            | undefined;
        let next = isHeld && typeof kept?.next === 'number' ? kept.next : 1;
        while (
            Array.from({ length: count }, (_, i) => `o${next + i}`).some((id) =>
                drawn.includes(id),
            )
        )
            next++;
        await $.store.set(ASK_COUNTER, { next: next + count });
        return await publish(next);
    } finally {
        if (isLocked) await $.process.run(['rmdir', lock]);
    }
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

// the Stop's two reds, once a turn (FRM-427): a wrap_up ask while an orbit ask is open (PK-227, one home for the next
// move), and an orbit add opening «Q<n>» whose round the reply never printed as «❓ **Q<n>**» (the 10-25 rider); a --bg
// session draws no board, so its asks go to its coordinator and neither applies
const WRAP_UP_TOOL = 'mcp__ccd_turn__wrap_up';
async function stopRed($: EngineInterface, reply: string) {
    if (!(await partsShown($))('stash.orbit') || (await isBgSelf($)))
        return undefined;
    const open = (await currentOrbit($)).asks.filter((a) => !a.isResolved);
    // a title inside the bold still printed the round; a false red here makes the model print it twice (PK-351:W54)
    const lost = turn.gridQs.filter(
        (n) => !new RegExp(`❓ \\*\\*Q${n}\\b`).test(reply),
    );
    const reds = [
        turn.isWrapAsked && open.length
            ? `your wrap_up asks dima a question while orbit holds ${open.map((a) => `${a.id} «${a.text}»`).join(', ')} open: one home for the next move — resolve or follow the orbit ask, or drop the wrap_up ask`
            : '',
        lost.length
            ? `you added ${lost.map((n) => `Q${n}`).join(', ')} to orbit, but the reply never printed ${lost.map((n) => `❓ **Q${n}**`).join(', ')}: a grill's asks go out with their round, so print the round in the reply`
            : '',
    ].filter(Boolean);
    return reds.length ? reds.join('\n') : undefined;
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

async function load($: EngineInterface) {
    if (warm.pressing) return;
    await readOverrideOn($).catch(() => undefined);
    const flag = (await $.store.get(AFK_KEY)) as { on?: boolean } | undefined;
    const wasAfk = warm.afk;
    holdAfk(flag?.on === true);
    // afk flipped from any board re-arms keep-hot here, since afk warms a remote-controlled session
    if (warm.afk !== wasAfk) await armHot($, viewDoors($));
    const waker = (await $.store.get(WAKER_KEY)) as
        | { on?: boolean }
        | undefined;
    holdWaker(waker?.on === true);
    await refreshShown($);
    // after a /clear the process goes on under a new id, and no session.start fires
    await refreshSelfId($);
    isPaced = isPaceOn(await $.store.get(PACE + (identity.selfId ?? '')));
    selfWind = identity.selfId
        ? (await windOf($, identity.selfId))?.state
        : undefined;
    isAutoWindOn = await isAutoWind($).catch(() => isAutoWindOn);
    const cleared = clearedNow();
    if (cleared) {
        await $.store
            .set(SUCC + cleared, {
                at: await $.clock.now(),
                sid: identity.selfId,
            })
            .catch(() => undefined);
        continueFromCleared();
    }
    // the band's 🔭 line: what this session's last reply said it waits on
    const reply = identity.selfId
        ? ((await $.store
              .get(REPLY + identity.selfId)
              .catch(() => undefined)) as Partial<Reply> | undefined)
        : undefined;
    wait = reply?.wait;
    await publish($);
}

// the band's view the module's values make
function viewOf(isBoardOpen: boolean): StashView {
    return {
        afk: warm.afk,
        isAutoWind: isAutoWindOn,
        isBoardOpen,
        isHot: Boolean(warm.hot),
        isOverrideOn: isOverrideOn(),
        isPaced,
        isSettingsOpen: settings.isSettingsOpen,
        isWaker: warm.isWaker,
        selfId: identity.selfId,
        shown: settings.shown,
        wait,
        wind: selfWind,
    };
}

// how far this thread read the band presses: the `at` of the newest line taken, from the thread's start on
const BAND_READ = 'band-read:';
// `band-refused:<sid>`: the times of lines this thread saw dated ahead of now
const BAND_REFUSED = 'band-refused:';
const BAND_REFUSED_MS = 24 * 60 * 60 * 1000;
// herdr's band presses reach this thread as its own band's would: wind and hot only for their sid, ⏰ and 💨 only when
// newer than the state they set, so the latest press wins whichever band it came from (FRM-568 slice 5)
async function takeBandPresses($: EngineInterface) {
    const sid = await currentId($);
    const home = await $.env.get('HOME').catch(() => undefined);
    if (!sid || !home) return;
    const now = await $.clock.now();
    const read = await $.store.get(BAND_READ + sid).catch(() => undefined);
    const after =
        typeof read === 'number'
            ? read
            : ((await registry($).catch(() => []))
                  .filter((r) => r.base.sid === sid)
                  .map((r) => r.startedAt)
                  .find((at) => typeof at === 'number') ?? now);
    const text = await $.fs
        .read(`${home}/.claude/shelf/${PRESS_DIR}/band.jsonl`)
        .catch(() => '');
    // a line dated ahead of now is refused for good, never taken once its time passes: its time is kept a day
    const refusedKey = BAND_REFUSED + sid;
    const kept = ((await $.store.get(refusedKey).catch(() => undefined)) ??
        []) as number[];
    const ahead = bandPressLines(text, after, Number.POSITIVE_INFINITY)
        .map((p) => p.at)
        .filter((at) => at > now);
    const refused = [...new Set([...kept, ...ahead])].filter(
        (at) => at > now - BAND_REFUSED_MS,
    );
    if (refused.join() !== kept.join()) await $.store.set(refusedKey, refused);
    const presses = bandPressLines(text, after, now).filter(
        (p) => !refused.includes(p.at),
    );
    // his press from herdr is an event: the bookkeeping jobs tick at 4 s again
    if (presses.length) await markActive($);
    for (const p of presses) {
        if (p.button === 'wind' && p.sid === sid) await setWind($, sid, p.on);
        if (p.button === 'hot' && p.sid === sid) {
            await setHot($, p.on);
            await armHot($, viewDoors($));
        }
        if (p.button !== 'waker' && p.button !== 'afk') continue;
        const key = p.button === 'waker' ? WAKER_KEY : AFK_KEY;
        const stored = (await $.store.get(key)) as { at?: number } | undefined;
        if (typeof stored?.at === 'number' && stored.at >= p.at) continue;
        if (p.button === 'waker') await setWaker($, p.on, p.at);
        else await setAfk($, p.on, p.at);
    }
    const override = presses.findLast((p) => p.button === 'override');
    if (override) await takeOverridePress($, home, override);
    const last = Math.max(after, ...presses.map((p) => p.at));
    if (last !== read) await $.store.set(BAND_READ + sid, last);
    if (presses.length) await load($);
}

async function pressWind($: EngineInterface, sid: string) {
    await flipWind($, sid);
    await load($);
}

// 🍃 second-wind-auto, per session (W1909–W1918, his ticks o38, o40): a press writes `{ on, at }`; unpressed, every
// thread is on, the coordinator's too (FRM-634, his tick); 💨 afk on or a shift turn a coordinator's pressed-off one on at
// read time, never by a write, and a press after the override's start wins until the next one
async function isAutoWind($: EngineInterface) {
    if (!(await partsShown($))('stash.second-wind-auto')) return false;
    const sid = await currentId($);
    if (!sid) return false;
    const pressed = (await $.store.get(AUTO_WIND + sid)) as
        | AutoWind
        | undefined;
    if ((await selfRecord($))?.role !== MAIN_ROLE) return pressed?.on ?? true;
    const away = (await $.store.get(AFK_KEY)) as
        | { on?: boolean; at?: number }
        | undefined;
    const shift = (await $.store.get(PACE + sid)) as
        | { since?: number }
        | undefined;
    const starts = [away?.on ? (away.at ?? 0) : undefined, shift?.since].filter(
        (t): t is number => typeof t === 'number',
    );
    const since = starts.length ? Math.max(...starts) : undefined;
    if (since !== undefined && (!pressed || pressed.at < since)) return true;
    return pressed?.on ?? true;
}

// a band press: the session's own key, and an off takes back the mod's pending ask, never one dima pressed
async function setAutoWind($: EngineInterface, isOn: boolean) {
    const sid = await currentId($);
    if (!sid) return;
    await $.store.set(AUTO_WIND + sid, {
        at: await $.clock.now(),
        on: isOn,
    } satisfies AutoWind);
    const wind = await windOf($, sid);
    if (!isOn && wind?.by === 'mod' && isWindOpen(wind))
        await $.store.delete(WIND + sid);
    await syncWindStore($).catch(() => undefined);
}

// the prompts this session has started, so the mod's ask lands a turn after its notice, never in the same one
let turnNo = 0;

// a hot reload restarts turnNo at 0 while the store keeps the marks: the count starts past them, so the turn after a
// reload is a later turn than any mark
async function seedTurnNo($: EngineInterface, sid: string | undefined) {
    if (!sid) return;
    const m = (await $.store.get(FILL + sid)) as FillMark | undefined;
    turnNo = Math.max(turnNo, m?.noticed ?? 0, m?.asked ?? 0, m?.proposed ?? 0);
}

// the fill crossing the notice line returns its notice once; a later turn past the wind line writes the session's own
// ask, only where no wind key stands, so a press of dima's is never written over; a turn after the ask, past the wind
// line + OVERRUN, the coordinator hears one line
async function takeFill($: EngineInterface, fill: number | undefined) {
    const sid = await currentId($);
    if (!sid || fill === undefined) return undefined;
    if (!(await partsShown($))('stash.second-wind-auto')) return undefined;
    const isAuto = await isAutoWind($);
    const isLead = (await selfRecord($))?.role === MAIN_ROLE;
    if (!isAuto && !isLead) return undefined;
    const noticeAt = await readNumber($, 'wind-notice');
    const was = ((await $.store.get(FILL + sid)) as FillMark | undefined) ?? {};
    const mark: FillMark = { ...was };
    const windAt = Math.max(await readNumber($, 'wind-at'), mark.windAt ?? 0);
    if (fill <= noticeAt - NOTICE_REARM) {
        delete mark.noticed;
        delete mark.windAt;
    }
    if (fill < windAt) {
        delete mark.asked;
        delete mark.proposed;
        delete mark.overrun;
    }
    let line: string | undefined;
    // the coordinator's 🍃 off at the keyboard: she proposes the wind to dima, never takes it (W5)
    if (!isAuto) {
        if (fill >= windAt && mark.proposed === undefined) {
            mark.proposed = turnNo;
            line = await windText($, ['stash.wind.text.propose'], {
                fill,
                wind: windAt,
            });
        }
    } else if (fill >= noticeAt && mark.noticed === undefined) {
        mark.noticed = turnNo;
        mark.windAt = windAt;
        line = await windText($, ['stash.wind.text.notice'], {
            fill,
            wind: windAt,
        });
    } else if (
        fill >= windAt &&
        mark.asked === undefined &&
        mark.noticed !== undefined &&
        mark.noticed !== turnNo
    ) {
        mark.asked = turnNo;
        if (!(await windOf($, sid)))
            await $.store.set(WIND + sid, {
                at: await $.clock.now(),
                by: 'mod',
                state: 'asked',
            } satisfies StashWind);
    } else if (
        fill >= windAt + OVERRUN &&
        mark.asked !== undefined &&
        mark.asked !== turnNo &&
        !mark.overrun &&
        isWindOpen(await windOf($, sid))
    ) {
        mark.overrun = true;
        await overrunTold($, sid, fill).catch(() => undefined);
    }
    if (JSON.stringify(mark) !== JSON.stringify(was))
        await $.store.set(FILL + sid, mark);
    return line;
}

// an ask still standing: dima's take-back deletes the key, a running or stopped wind needs no nudge
const isWindOpen = (w: StashWind | undefined) =>
    w?.state === 'asked' || w?.state === 'writing';

// a member that ignores its ask: one line to the coordinator, never from the coordinator's own thread
async function overrunTold($: EngineInterface, sid: string, fill: number) {
    const lead = (await threadRecords($)).find(
        (t) =>
            t.role === MAIN_ROLE && t.pid !== undefined && t.sessionId !== sid,
    );
    if (!lead?.sessionId) return;
    await $.session.send({
        text: `🐦‍🔥 second wind overrun: ${(await sessionName($)) ?? sid} reads ${fill} %, past its ask; nudge it to wind at its next good stop`,
        to: { sessionId: lead.sessionId },
    });
}

// at a turn's start: the ask joins once and becomes writing; a cancel joins once and leaves
async function takeWind($: EngineInterface, isOwner: boolean) {
    const sid = await currentId($);
    const was = sid ? await windOf($, sid) : undefined;
    if (!sid || !was) return undefined;
    if (was.state === 'asked') {
        await $.store.set(WIND + sid, {
            at: await $.clock.now(),
            ...(was.by ? { by: was.by } : {}),
            state: 'writing',
        } satisfies StashWind);
        const fill = await $.store.get(CONTEXT + sid).catch(() => undefined);
        const n = {
            fill: typeof fill === 'number' ? fill : undefined,
            wind: await readNumber($, 'wind-at'),
        };
        if (was.by !== 'mod')
            return windText(
                $,
                ['stash.wind.text.press'],
                n,
                isOwner ? WIND_NOTE_OWNER : undefined,
            );
        return windText(
            $,
            isOwner
                ? ['stash.wind.text.at.coordinator', 'stash.wind.text.at']
                : ['stash.wind.text.at'],
            n,
        );
    }
    if (was.state === 'refused') {
        await $.store.delete(WIND + sid);
        return windRefused(was.blocked ?? 'work');
    }
    if (was.state === 'stopped' && was.slug) {
        await $.store.delete(WIND + sid);
        return was.isGone ? windGone(was.slug) : windStopped(was.slug);
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
            deny: 'orbit second-wind: pending is required: «none», or the work still pending (a subagent, a watch, a task not parked; a background command is no pending)',
        };
    if (pending.toLowerCase() !== 'none')
        return {
            deny: `orbit second-wind: not yet, pending: ${pending}. the compact waits, the work does not: do every step that run doesn't need, then call again with pending: none once it resolves`,
        };
    const name = typeof input.slug === 'string' ? input.slug.trim() : '';
    if (!/^[\w][\w.-]*$/.test(name))
        return {
            deny: 'orbit second-wind: name the handoff you just wrote, slug: "<lane or topic>-<n>"',
        };
    if (!(await hasHandoff($, name)))
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
// a compact's fill, read once the engine has swapped in the compacted messages: its own measure inside the compact,
// and a breakdown read inside this hook, still count the messages from before it (probed on 2.1.322, FRM-505)
const COMPACT_SETTLE_MS = 1000;

async function windOnCompact($: EngineInterface) {
    const sid = await currentId($);
    const was = sid ? await windOf($, sid) : undefined;
    // a refreshing with no slug is this compact's own: its ingest may queue for a long while, and a reload loses runWind's await
    const isOurs = was?.state === 'refreshing' && !was.slug;
    if (!sid || (was?.state !== 'asked' && was?.state !== 'writing' && !isOurs))
        return;
    await $.store.delete(WIND + sid);
}

// work a session starts after it said pending: none and before the compact fires: an agent, a watch or a background
// session; a background command survives the compact, its notice landing in the fresh context (clio's pick, 11-12)
const BG_SESSION = /\bclaude\b[^\n|;&]*\s--bg\b/;
function windBlocker(tool: string, input: Record<string, unknown>) {
    if (tool === 'Agent') return 'an agent';
    if (tool === 'Monitor') return 'a watch';
    if (tool !== 'Bash') return undefined;
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
    if (!sid || was?.state !== 'refreshing') return;
    if (!was.slug) {
        // a compact that never reported back leaves no row behind
        if ((await $.clock.now()) - was.at > WIND_STALE_MS)
            await $.store.delete(WIND + sid);
        return;
    }
    if (!(await partsShown($))('stash.second-wind')) return;
    // the turn's own Stop lists what still runs: a watch started before the op holds the wind too
    const watch = (
        (await $.store.get(REPLY + sid)) as Reply | undefined
    )?.tasks?.find((t) => t.type === 'monitor' && !t.state);
    const blocked =
        was.blocked ??
        (watch && `a watch («${watch.name ?? watch.description}»)`);
    if (blocked) {
        await $.store.set(WIND + sid, {
            at: await $.clock.now(),
            blocked,
            state: 'refused',
        } satisfies StashWind);
        return;
    }
    const slug = was.slug;
    $.clock.after(WIND_DELAY_MS, () => runWind($, sid, slug));
}

async function hasHandoff($: EngineInterface, slug: string) {
    const home = await $.env.get('HOME');
    const peek = await $.process
        .run([`${home}/.local/bin/x`, 'handoff', 'peek', slug])
        .catch(() => undefined);
    return peek?.exitCode === 0;
}

async function runWind($: EngineInterface, sid: string, slug: string) {
    try {
        // the slug goes first, so a turn end during the compact finds nothing to run; the board keeps 🌀
        await $.store.set(WIND + sid, {
            at: await $.clock.now(),
            state: 'refreshing',
        } satisfies StashWind);
        // the handoff can leave the store after the op's peek (another ingest, a delete): the compact never runs on nothing
        if (!(await hasHandoff($, slug))) {
            await windGoneFor($, sid, slug);
            return;
        }
        // a failed list keeps the command, the door every session had before
        const hasIngestCommand =
            (await $.command.list().catch(() => undefined))?.some(
                (c) => c.name === 'x:handoff-ingest',
            ) ?? true;
        // both queue at once: an awaited compact let a prompt dima typed during it queue ahead of the ingest (clio's
        // 19:17 press: compact 19:17, his prompt 19:19, the ingest 19:20)
        const [compacted, ingested] = await Promise.allSettled([
            $.command.run({
                args: `keep nothing past the handoff ${slug}; it carries the state`,
                command: 'compact',
            }),
            hasIngestCommand
                ? $.command.run({ args: slug, command: 'x:handoff-ingest' })
                : $.prompt.submit({ text: windIngest(slug) }),
        ]);
        if (ingested.status === 'rejected') throw ingested.reason;
        await $.store.delete(WIND + sid);
        await releaseHeldSteers($, viewDoors($)).catch(() => undefined);
        // the ingest still ran: the handoff left the store, only the context stayed full
        if (compacted.status === 'rejected')
            await compactFailedFor($, sid, slug, errorText(compacted.reason));
    } catch (err) {
        await windStoppedFor($, sid, slug, errorText(err)).catch(
            () => undefined,
        );
    }
}

async function compactFailedFor(
    $: EngineInterface,
    sid: string,
    slug: string,
    why: string,
) {
    await toldLead(
        $,
        sid,
        `🐦‍🔥 second wind's compact failed for ${(await sessionName($)) ?? sid}: ${why}; its handoff ${slug} was ingested on the full context`,
    );
}

// a toast reaches no one in a pane nobody watches: the board shows the stop, the coordinator hears it, and the
// session's next turn says how to ingest by hand
async function windStoppedFor(
    $: EngineInterface,
    sid: string,
    slug: string,
    why: string,
) {
    await $.store.set(WIND + sid, {
        at: await $.clock.now(),
        slug,
        state: 'stopped',
    } satisfies StashWind);
    await toldLead(
        $,
        sid,
        `🐦‍🔥 second wind stopped for ${(await sessionName($)) ?? sid}: ${why}; its handoff ${slug} is still in the store`,
    );
}

async function windGoneFor($: EngineInterface, sid: string, slug: string) {
    await $.store.set(WIND + sid, {
        at: await $.clock.now(),
        isGone: true,
        slug,
        state: 'stopped',
    } satisfies StashWind);
    await toldLead(
        $,
        sid,
        `🐦‍🔥 second wind stopped for ${(await sessionName($)) ?? sid}: its handoff ${slug} left the store before the compact; nothing was compacted`,
    );
}

async function toldLead($: EngineInterface, sid: string, line: string) {
    $.ui.toast(line);
    const lead = (await threadRecords($)).find(
        (t) =>
            t.role === MAIN_ROLE && t.pid !== undefined && t.sessionId !== sid,
    );
    if (lead?.sessionId)
        await $.session.send({ text: line, to: { sessionId: lead.sessionId } });
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

const WIND_STALE_MS = 30 * MINUTE_MS;

// the view's two doors, built per call for a module that must reach up: the one upward door (clio, 19:27)
function viewDoors($: EngineInterface): ViewDoors {
    return { load: () => load($), publish: () => publish($) };
}

async function pressPace($: EngineInterface) {
    const sid = await currentId($);
    if (!sid) return;
    isPaced = !isPaced;
    await pressSwitch(
        $,
        '🔋',
        { isPaced },
        async () =>
            $.store.set(
                PACE + sid,
                isPaceOn(await $.store.get(PACE + sid))
                    ? { off: true }
                    : { on: true },
            ),
        async () => {
            isPaced = !isPaced;
        },
    );
    await load($);
    await publish($);
    $.ui.invalidate('ui.render');
}

let published = '';
let boardPublished = '';
// writes the view to $.state when it changed; every site that reads it while drawing redraws
async function publish($: EngineInterface) {
    const isBoardOpen = await isOpen($);
    // a closed board unmounts its fields: the next open draws the stored text, not a held one; a board typed into
    // within the quiet window is on screen, whatever the read said (FRM-492)
    if (
        isBoardOpen === false &&
        // clock-ok: compared with the fields' own Date.now() stamps, so both sides read one clock
        !isTypingAt(typedAts(), Date.now())
    ) {
        await flushFields($);
        await forgetMountedText($);
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
            ...(keptSteers.size
                ? { keptSteers: Object.fromEntries(keptSteers) }
                : {}),
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
                typedAts(),
                // clock-ok: compared with the drafts' own Date.now() stamps, so both sides read one clock
                Date.now(),
            )
        ) {
            boardPublished = boardText;
            await $.state.set(BOARD_VIEW, board).catch(() => undefined);
        }
    }
    const view = viewOf(isBoardOpen === true);
    const text = JSON.stringify(view);
    if (text === published) return;
    published = text;
    await $.state
        .set(VIEW, view)
        .catch((err) =>
            $.ui.log(`x-mod-stash: the view was not kept: ${errorText(err)}`),
        );
}

// a press answers at once: only the pressed chip is drawn here, and the publish after the write settles the rest
async function drawBand($: EngineInterface, patch: Partial<StashView>) {
    const view = {
        ...((await $.state.get(VIEW)).value ?? viewOf(false)),
        ...patch,
    };
    published = JSON.stringify(view);
    await $.state
        .set(VIEW, view)
        .catch((err) =>
            $.ui.log(`x-mod-stash: the view was not kept: ${errorText(err)}`),
        );
}

async function pressSwitch(
    $: EngineInterface,
    name: string,
    patch: Partial<StashView>,
    write: () => Promise<unknown>,
    undo: () => Promise<unknown>,
) {
    pressBegin();
    try {
        await drawBand($, patch);
        await write();
    } catch (err) {
        await undo();
        await $.ui.log(`x-mod-stash: ${name} was not kept: ${errorText(err)}`);
    } finally {
        pressEnd();
    }
    await publish($);
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

// undefined when the read fails: a failed read says nothing about the board (FRM-492)
async function isOpen($: EngineInterface) {
    const panes = await $.ui.panes().catch(() => undefined);
    return panes?.some((p) => p.id === BOARD);
}

async function openBoard($: EngineInterface) {
    await $.ui.open({ closeOnEscape: true, id: BOARD, title: '🚦 board' });
}

// the pids ps no longer prints; ps exits 1 when none is alive, so only its output is read
async function deadPids($: EngineInterface, pids: number[]) {
    const ps = await $.process.run(['ps', '-o', 'pid=', '-p', pids.join(',')]);
    // a ps that failed to run says nothing: only a quiet exit with no pid printed means none is alive
    if (ps.exitCode !== 0 && ps.stderr.trim()) return new Set<number>();
    const alive = new Set(ps.stdout.split('\n').map((s) => Number(s.trim())));
    return new Set(pids.filter((pid) => !alive.has(pid)));
}
// a session that died fires no end: its 🍃 entry goes at the first pass and then every WIND_PRUNE_POLLS-th, one ps
const WIND_PRUNE_POLLS = 5;
let windPolls = 0;
// the second-wind store is written here alone, whole, at a start, at each poll and at a 🍃 press, only when it
// differs: the defaults of this code, the edits the door and herdr left in `wind-text-edits`, the applied switches and
// lines, this session's 🍃 with its pid (FRM-634, FRM-625:W15); every row and field it does not know stays as found
async function syncWindStore($: EngineInterface) {
    const home = await $.env.get('HOME').catch(() => undefined);
    if (!home) return;
    const path = windStorePath(home);
    const raw = await $.fs.read(path).catch(() => undefined);
    const file = windFileOf(raw);
    const edits = windEditsOf(
        await $.store.get(WIND_TEXT_EDITS).catch(() => undefined),
    );
    const isOn = await partsShown($);
    const sid = await currentId($);
    const others = windPidsOf(file).filter((pid) => pid !== identity.proc?.pid);
    const gone =
        others.length && !(windPolls++ % WIND_PRUNE_POLLS)
            ? await deadPids($, others).catch(() => undefined)
            : undefined;
    const text = `${JSON.stringify(
        windFileWith(file, {
            applied: {
                'second-wind': isOn('stash.second-wind'),
                'second-wind-auto': isOn('stash.second-wind-auto'),
                'wind-at': await readNumber($, 'wind-at'),
                'wind-notice': await readNumber($, 'wind-notice'),
            },
            defaults: WIND_DEFAULTS,
            edits,
            gone,
            self:
                sid && identity.proc
                    ? { auto: await isAutoWind($), pid: identity.proc.pid, sid }
                    : undefined,
        }),
        null,
        2,
    )}\n`;
    if (text !== raw) await writeWhole($, identity.proc?.pid ?? 0, path, text);
    if (!Object.keys(edits).length) return;
    // an edit leaves the key only once a pass reads it back from the file: a session that wrote an older file over it
    // loses nothing, the next pass folds it again. one no row takes (an unknown row, a text over the cap) leaves at
    // once, the over-cap one with a log line, since herdr's row has no door to refuse it
    const isTaken = (row: string, edit: unknown) =>
        isWindRow(row) &&
        typeof edit === 'string' &&
        edit.length <= WIND_TEXT_CAP;
    for (const [row, edit] of Object.entries(edits))
        if (isWindRow(row) && typeof edit === 'string' && !isTaken(row, edit))
            $.ui.log(
                `x-mod-stash second wind: an edit of ${row} is over ${WIND_TEXT_CAP} chars and was not taken`,
            );
    const left = Object.entries(
        windEditsOf(await $.store.get(WIND_TEXT_EDITS).catch(() => undefined)),
    ).filter(
        ([row, edit]) =>
            edits[row] !== edit ||
            (isTaken(row, edit) && windRawTextOf(file, row) !== edit),
    );
    if (left.length)
        await $.store.set(WIND_TEXT_EDITS, Object.fromEntries(left));
    else await $.store.delete(WIND_TEXT_EDITS);
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
            ({ agent_type, command, description, id, name, state, type }) => ({
                agent_type,
                command,
                description,
                id,
                name,
                ...(state ? { state } : {}),
                ...(type ? { type } : {}),
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
        // main clio or a wing by its record; a wing's cards carry its display, drawn from that record
        const self = await selfLive($);
        const isOwner = self?.role === MAIN_ROLE;
        const side = self?.role === WING_ROLE ? runnerOf(self) : undefined;
        if (!isOwner && !side)
            return {
                deny: `orbit glide: only ${LANE_OWNER} writes the lanes; every board shows them`,
            };
        const before = await readLanes($);
        if (side && input.act !== 'create') {
            const card = before.find((l) => l.id === oneLine(input.id));
            if (card && bare(card.runner ?? '') !== bare(side))
                return {
                    deny: `orbit glide: lane ${card.id} is not this wing's; it writes only a card it created, ${LANE_OWNER} the rest`,
                };
        }
        // a link keeps the member's registry name, so the card finds its asks after a /clear or by a desktop id, and the
        // session id that name resolved to, so a rename after the link keeps the member (FRM-605)
        const linkTo =
            input.act === 'link' && typeof input.session === 'string'
                ? memberOf(await registry($), input.session.trim())?.base
                : undefined;
        // a create that names its lane plan takes its first steps from that file, so the card is never drawn from a guess
        let given = linkTo
            ? { ...input, linkedId: linkTo.sid, session: linkTo.name }
            : input;
        if (
            (input.act === 'create' || input.act === 'edit') &&
            typeof input.plan === 'string'
        ) {
            if (!/^(?:\/|~\/)/.test(input.plan))
                return {
                    deny: 'orbit glide: plan is an absolute or ~/ path to the lane plan file',
                };
            const home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
            const read = await readPlanSteps(
                $,
                input.plan.replace(/^~(?=\/)/, home),
            );
            if ('state' in read)
                return {
                    deny:
                        read.state === 'gone'
                            ? `orbit glide: plan file ${input.plan} cannot be read`
                            : `orbit glide: x lane plan-steps could not read ${input.plan}; run it by hand to see why`,
                };
            const steps = read.steps.map((s) => ({
                done: s.done,
                text: [...s.text].slice(0, LANE_TEXT_MAX).join(''),
                ...(s.ticket ? { ticket: s.ticket } : {}),
            }));
            if (!steps.length)
                return {
                    deny: `orbit glide: ${input.plan} holds no numbered step line («- [ ] 01 · FRM-1 text»)`,
                };
            const unticketed = steps.find((s) => !s.ticket);
            if (unticketed)
                return {
                    deny: `orbit glide: ${input.plan} has a step with no ticket id, «${unticketed.text}»: every line reads «- [ ] NN · FRM-N text»`,
                };
            if (input.act === 'create')
                given = { ...given, items: steps, planHome: home };
            else if (
                before
                    .find((l) => l.id === oneLine(input.id))
                    ?.plan?.replace(/^~(?=\/)/, home) !==
                input.plan.replace(/^~(?=\/)/, home)
            )
                return {
                    deny: `orbit glide: edit cannot link a plan; lane ${oneLine(input.id)} takes one at create`,
                };
        }
        const op = glideOp(
            before,
            given,
            (await currentOrbit($)).turns,
            await $.clock.now(),
        );
        if ('deny' in op) return { deny: op.deny };
        const known = new Set(before.map((l) => l.id));
        const lanes = side
            ? op.lanes.map((l) =>
                  known.has(l.id) ? l : { ...l, runner: side },
              )
            : op.lanes;
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
        await writeLanes($, mergeLanes(before, lanes, await readLanes($)));
        markWork();
        return { result: op.result };
    }
    // the turn as $.state holds it: a call that lands before a mid-turn reload's start reads a default isBusy
    const isTurn = (await $.state.get(TURN)).value?.isBusy ?? turn.isBusy;
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
    const lines = await readNumber($, 'lines');
    const asked =
        input.op === 'add' && Array.isArray(input.asks) ? input.asks.length : 0;
    const op = await inMarking(async () => {
        const current = await currentOrbit($);
        const apply = async (first: number) => {
            const made = orbitOp(
                { ...current, next: first },
                input,
                isTurn,
                lines,
                isAmended,
            );
            if ('deny' in made) return made;
            if (asked) made.orbit = { ...made.orbit, next: current.next };
            await saveOrbit($, made.orbit, () => keepShelf($));
            // a follow asks a new question: his tick on the old one is no longer his word on it (S3); one step with the
            // save, so a press lands wholly before both or after both
            if (input.op === 'follow') await dropTicks($, oneLine(input.id));
            return made;
        };
        if (!asked) return apply(current.next);
        // an add's ids come from the fleet's one counter; the thread's own `next` keeps counting its assumptions
        return (
            (await mintAsks(
                $,
                asked,
                current.asks.map((a) => a.id),
                apply,
            )) ?? {
                deny: 'orbit add: the ask counter is held by another thread past 2 s; add the ask again in a moment',
            }
        );
    });
    if ('deny' in op) return { deny: op.deny };
    if (input.op === 'add')
        addGridQs(
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
        fieldsTaken = takeFields($);
        await fieldsTaken;
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
                    await absorbMarks($).catch(() => undefined);
                    await wakeForMarks($).catch(() => undefined);
                    await takeBandPresses($).catch(() => undefined);
                    // pollShelf paces itself every third tick; a gate here would slow it twice over
                    await pollShelf($);
                    await quietIdle($).catch(() => undefined);
                    if (isBookkept) await quietBooks($).catch(() => undefined);
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
        await flushFields($);
        return next(e);
    });

    on('prompt.submit', async ($, e, next) => {
        await markActive($).catch(() => undefined);
        await flushFields($);
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
            await settleTask($, e.text).catch(() => undefined);
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
        await absorbMarks($);
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
        turnNo += 1;
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
            toldOrbit = told?.key;
            if (isOwner && isOn('stash.glide')) {
                toldStaleLanes.clear();
                for (const l of staleNow) toldStaleLanes.add(staleKey(l));
            }
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
        await windAfterTurn($).catch(() => undefined);
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
            await settleTask($, e.text).catch(() => undefined);
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
            await leaveBoxes($).catch((err) =>
                $.ui.log(
                    `x-mod-stash: steer boxes not left: ${errorText(err)}`,
                ),
            );
        return next(e);
    });
    on('session.attach', async ($, e, next) => {
        await markActive($).catch(() => undefined);
        if (e.surface === 'desktop')
            await returnToBoxes($).catch((err) =>
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
                                    onPress={() => offerBack($, key)}
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
                        changeAssumed($, (y) =>
                            y.id === id ? { ...y, steer: steerOf(value) } : y,
                        );
                    // the steer keeps every keystroke, no Enter needed
                    const handleSteer = (id: string, value: string) =>
                        markAsks(
                            $,
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
                                await flushFields($);
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
                                        onPress={() => dropKept($, key)}
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
        await flushFields($);
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
        await absorbMarks($);
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
                        selfWind = wanted;
                        return pressSwitch(
                            $,
                            '🐦‍🔥',
                            { wind: wanted },
                            async () => {
                                selfWind = await flipWind($, sid);
                            },
                            async () => {
                                selfWind = view.wind;
                            },
                        );
                    };
                    const handleAutoWindFlip = async () => {
                        const wasOn = isAutoWindOn;
                        isAutoWindOn = !view.isAutoWind;
                        await pressSwitch(
                            $,
                            '🍃',
                            { isAutoWind: isAutoWindOn },
                            () => setAutoWind($, isAutoWindOn),
                            async () => {
                                isAutoWindOn = wasOn;
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
