// a prompt's context: dima's marks, steers and assumptions sent back, the orbit and lane notes, held pings, herdr's
// joins, the fill and the wind, the clock; each told once and only while its 🎛️ switch is on

import type { Args, EngineInterface, Next } from 'claude-code';

import type { StashLane } from '../types/stash.d.ts';
import { carried, flushFields, isTypedHere } from './fields.ts';
import { quietLocked, takeSteers } from './held.ts';
import { joinsLocked, takeJoins } from './joins.ts';
import { PING, type ViewDoors, prepareTurn, warm } from './keep-warm.ts';
import {
    LANE_STEER,
    LANE_STEER_OLD,
    dropLaneOrders,
    laneSteers,
    readLanes,
    showLanes,
    takeLaneMoves,
} from './lanes.ts';
import {
    ORBIT_TOOL,
    isFresh,
    joinRowsText,
    joinText,
    planText,
    wrongText,
} from './orbit.ts';
import { DIMA_AT, takeMarks, takePlanMark } from './orbit-presses.ts';
import {
    absorbMarks,
    currentOrbit,
    inMarking,
    orbitNow,
    saveOrbit,
} from './orbit-store.ts';
import { LANE_STALE, ticketNote } from './orbit-tool.ts';
import { isAppPrompt } from './quiet.ts';
import { takeGapNotes } from './quiet-books.ts';
import { quietHoldPrompt, quietNote, quietTake } from './quiet-gate.ts';
import { settleTask } from './reply-fix.ts';
import { currentId, isLaneOwner } from './session-identity.ts';
import { keepShelf } from './session-record.ts';
import { partsShown } from './settings-store.ts';
import { markActive, setPrimed, startTurn, turn } from './turn.ts';
import {
    LANE_STALE_TEXT,
    filled,
    noBoardReminder,
    orbitReminder,
    orbitTexts,
    tickSentence,
    toldOrbit,
    toldOrbitAs,
    toldStaleAs,
    toldStaleLanes,
} from './turn-notes.ts';
import { CONTEXT } from './usage.ts';
import { nextTurnNo, takeFill, takeWind } from './wind-run.ts';

// mobile mode: mods draw nothing on the phone, so the session prints the open asks as the asks fence instead
const MOBILE = { key: 'mobile', plugin: 'x-mod-stash' } as const;

export const AWAY_NOTE =
    'dima is afk: nothing waits on him. take reversible steps and log them, pick every pending ask and log its undo, raise one in orbit only when blocked, on his design call, or irreversible. send no ping.';
// dima at the prompt, typing into a background job, on his phone or the web
const DIMA_ORIGINS = ['composer', 'sdk', 'bridge'] as const;
// the phases guard, no extra turn and no Stop block: one line at the first prompt, one nudge in a turn's tool results (dima's o14)
const PHASES_START = `phases are your live plan: set them with ${ORBIT_TOOL}'s plan op and keep them current as the work moves.`;
const BACK_AT_MAC = /\bback at the mac\b|\bmobile mode off\b/i;
// dima asking clio about cost: her context points at the price facts once, so she never answers from recall (o171; 10-13
// she quoted a cache read at 1/10 of input, the file says 1/20)
export const COST_WORDS =
    /\b(?:tokens?|cach(?:e|ed|ing)|(?:ctx|context) costs?|pricing|mtok)\b/i;
const COST_HINT =
    "💵 a cost question: read ~/frame/home/.claude/plugin-x/skills/crew-lead/references/model-cards.md before answering (each model's price line, and the «cache reads are where agents spend» bullet), never from recall.";
// the lane steers dima took with 🛎️, as clio reads them; each leaves the lane once read
export async function takeLaneSteers($: EngineInterface, lanes: StashLane[]) {
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
// everything a prompt carries: dima's marks and steers, the orbit and lane notes, held pings, joins, the wind
export async function composePrompt(
    $: EngineInterface,
    e: Args<'prompt.submit'>,
    next: Next<'prompt.submit'>,
    view: ViewDoors,
) {
    await markActive($).catch(() => undefined);
    await flushFields($, view);
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
        await settleTask($, e.text, view).catch(() => undefined);
    const isUser =
        !e.isMeta &&
        !(isAppShaped && isAppPrompt(e.text)) &&
        e.text.trim().length > 0 &&
        (DIMA_ORIGINS as readonly string[]).includes(e.origin?.kind ?? '');
    if (isUser && BACK_AT_MAC.test(e.text))
        await $.state.set(MOBILE, false).catch(() => undefined);
    // prompt.submit fires when a prompt is queued (engine.md): one queued behind a running turn is no turn of its own yet
    const isQueued = turn.isBusy;
    await startTurn($, isUser, e.text === PING, () => prepareTurn(view));
    // the clock rides every prompt, so a reply's 📄 stamp copies it instead of guessing
    const at = new Date(await $.clock.now());
    const offset = -at.getTimezoneOffset() / 60;
    const clock = `now ${at.toTimeString().slice(0, 5)} UTC${offset >= 0 ? '+' : ''}${offset}`;
    // only dima's own prompt carries his marks; each joins once and locks until the turn ends
    if (turn.isUserTurn)
        await $.store.set(DIMA_AT, await $.clock.now()).catch(() => undefined);
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
    const tickets = turn.isUserTurn ? await ticketNote($, e.text) : undefined;
    const texts = await orbitTexts($);
    // with no board the whole reply shape rides every prompt; the board's return then prints the state once
    const isNoBoard = (await $.state.get(MOBILE)).value || !isOn('stash.orbit');
    const told = isNoBoard
        ? undefined
        : orbitReminder(orbitNow(), isOn, toldOrbit, texts.plan);
    const reminder = isNoBoard ? noBoardReminder(orbitNow(), isOn) : told?.line;
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
    const laneSteers = turn.isUserTurn ? await takeLaneSteers($, lanes) : [];
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
        if (isOwner && isOn('stash.glide')) toldStaleAs(staleNow.map(staleKey));
    }
    return sent;
}
