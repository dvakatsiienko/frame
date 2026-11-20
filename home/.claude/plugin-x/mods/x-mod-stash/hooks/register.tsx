/* @jsx h */
import type { EngineInterface, Register } from 'claude-code';

import type { QuietLogLine, StashLane } from '../types/stash.d.ts';
import { renderBand } from './band.tsx';
import { takeBandPresses } from './band-presses.ts';
import { drawBoard } from './board.tsx';
import {
    carried,
    flushFields,
    isTypedHere,
    leaveBoxes,
    retakeFields,
    returnToBoxes,
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
import { joinsLocked, settleJoins, takeJoins } from './joins.ts';
import {
    PING,
    POLL_MS,
    armHot,
    armWake,
    capAtMeasure,
    capAtTurnEnd,
    followHot,
    holdCap,
    holdHot,
    hotLate,
    pacePoll,
    paceStep,
    prepareTurn,
    seatDefaults,
    warm,
} from './keep-warm.ts';
import {
    LANE_STEER,
    LANE_STEER_OLD,
    dropLaneOrders,
    followCodies,
    followPlans,
    laneSteers,
    openDispatchedLanes,
    readLanes,
    reshowLanes,
    showLanes,
    takeLaneMoves,
} from './lanes.ts';
import {
    ORBIT_TOOL,
    isFresh,
    joinRowsText,
    joinText,
    oneLine,
    orbitOp,
    planText,
    turnEnded,
    wrongText,
} from './orbit.ts';
import {
    DIMA_AT,
    takeMarks,
    takePlanMark,
    wakeForMarks,
} from './orbit-presses.ts';
import {
    EMPTY_ORBIT,
    absorbMarks,
    currentOrbit,
    inMarking,
    keepState,
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
import { relayCrowWake, wakeForParkedLanes } from './parked-wake.ts';
import {
    boldFleetWords,
    bulletDots,
    dropWaitAside,
    linkTickets,
    numberCircled,
    parseWait,
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
import { isOpen, memberOf, openBoard, registry } from './roster.ts';
import { laneRoundLine } from './rounds.ts';
import { showClioAsks } from './rows.ts';
import { endSession, forget, pruneEnded } from './session-end.ts';
import {
    currentId,
    identity,
    isLaneOwner,
    refreshThreads,
    sessionName,
    startIdentity,
} from './session-identity.ts';
import { keepShelf, noteModel, pollShelf } from './session-record.ts';
import { drawSettingsPane } from './settings-pane.tsx';
import {
    QUIET_ON,
    SHOWN,
    flipKnob,
    partsShown,
    readSwitch,
    setSettingsOpen,
    shownOf,
    takeHerdrRows,
} from './settings-store.ts';
import { refreshSpeaking } from './speak.ts';
import { HOT, REPLY, type Reply, hotOf } from './store-keys.ts';
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
    setPrimed,
    setTurnAfk,
    startTurn,
    turn,
} from './turn.ts';
import {
    LANE_STALE_TEXT,
    filled,
    forgetTold,
    noBoardReminder,
    orbitReminder,
    orbitTexts,
    tickSentence,
    toldOrbit,
    toldOrbitAs,
    toldStaleAs,
    toldStaleLanes,
} from './turn-notes.ts';
import {
    CONTEXT,
    countWords,
    drawFill,
    drawFillAfterCompact,
    freshMeter,
    measureUsage,
} from './usage.ts';
import { errorText } from './util.ts';
import { load, publish, viewDoors } from './view.ts';
import { COMPACTING, windOf } from './wind.ts';
import {
    COMPACT_SETTLE_MS,
    FILL,
    nextTurnNo,
    seedTurnNo,
    syncWindStore,
    takeFill,
    takeWind,
    windAfterTurn,
    windBlock,
    windOnCompact,
} from './wind-run.ts';

// x-mod-stash: dima's command center above the prompt, one row; FTR.md lists every feature.
// orbit: the session's asks to dima and its plan, written through its own tool, ticked in the board; its open asks are
// mirrored into $.store (one key per session), so the board counts every session's.
// afk: one switch every session polls; while it is on, every prompt carries an away note, and a flip reaches a running turn.
// keep-hot: while on and idle, one ping 50 min after the last turn ended keeps the prompt cache warm; the switch lives in $.store, so a reload keeps it

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
// the running turn, so a mid-turn reload still knows it is busy
const TURN = { key: 'turn', plugin: 'x-mod-stash' } as const;
// when the last main turn ended: 🔥 switched on while idle counts its 50 min from here, so the ping lands inside the cache's hour
const ENDED = { key: 'ended', plugin: 'x-mod-stash' } as const;
// a 📄 line's HH:MM — the same shape reply-check.py reads
const STAMP = /(📄[^\n]*?\b)(\d{1,2}:\d{2})\b/g;
const CAP = { key: 'cap', plugin: 'x-mod-stash' } as const;
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

// dima asking clio about cost: her context points at the price facts once, so she never answers from recall (o171; 10-13
// she quoted a cache read at 1/10 of input, the file says 1/20)
export const COST_WORDS =
    /\b(?:tokens?|cach(?:e|ed|ing)|(?:ctx|context) costs?|pricing|mtok)\b/i;
const COST_HINT =
    "💵 a cost question: read ~/frame/home/.claude/plugin-x/skills/crew-lead/references/model-cards.md before answering (each model's price line, and the «cache reads are where agents spend» bullet), never from recall.";

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
        holdCap(kept.cap ?? undefined);
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
        await armWake($, viewDoors($));
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
        await capAtTurnEnd($, e.reason === 'error', e.answer, viewDoors($));
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
        await capAtMeasure($, w?.percentUsed, resetsAt, viewDoors($));
        await measureUsage($, e);
        return next(e);
    });

    // the board shows each session's model and effort as its main loop's last request named them; a subagent's step never counts
    on('turn.step', async function* ($, e, next) {
        if (!e.agentId) await noteModel($, e.model, e.effort);
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
    on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE }, ($, e) =>
        drawSettingsPane($, e),
    );

    on('ui.render', { component: 'Pane', requestId: BOARD }, ($, e) =>
        drawBoard($, e),
    );

    on('session.end', async ($, e, next) => {
        await endSession(
            $,
            e.sessionId,
            e.reason === 'clear' || e.reason === 'resume',
        );
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
    on('ui.render', { component: 'AbovePrompt' }, ($, e, next) =>
        renderBand($, e, next),
    );
};
