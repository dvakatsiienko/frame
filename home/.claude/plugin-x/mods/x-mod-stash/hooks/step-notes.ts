// what a tool step carries back into the running turn: afk flipped, a tick or a lane steer dima took, the fill and the
// wind, the phases nudge, the pace rung, herdr's joins; orbit's own calls go to orbit-tool.ts first

import type { Args, EngineInterface, Next } from 'claude-code';

import { bootNote } from './boot.ts';
import { flushFields, isTypedHere } from './fields.ts';
import { joinsLocked, takeJoins } from './joins.ts';
import { type ViewDoors, paceStep, warm } from './keep-warm.ts';
import { readLanes, takeLaneMoves } from './lanes.ts';
import {
    ORBIT_TOOL,
    isFresh,
    joinRowsText,
    joinText,
    oneLine,
    planText,
} from './orbit.ts';
import { takeMarks, takePlanMark } from './orbit-presses.ts';
import { absorbMarks, currentOrbit } from './orbit-store.ts';
import { orbitToolCall } from './orbit-tool.ts';
import { AWAY_NOTE, takeLaneSteers } from './prompt-notes.ts';
import { SEND_TOOL, quietSendEnd, quietSendStart } from './quiet-gate.ts';
import { WRAP_UP_TOOL } from './reply-fix.ts';
import { laneRoundLine } from './rounds.ts';
import { isLaneOwner } from './session-identity.ts';
import { keepShelf } from './session-record.ts';
import { partsShown } from './settings-store.ts';
import {
    countTool,
    markNudged,
    markWork,
    markWrapAsked,
    setTurnAfk,
    turn,
} from './turn.ts';
import { orbitTexts, tickSentence } from './turn-notes.ts';
import { takeFill, takeWind, windBlock } from './wind-run.ts';

const BACK_NOTE = 'dima is back from afk: orbit and pings reach him again.';
// the running turn, so a mid-turn reload still knows it is busy
const TURN = { key: 'turn', plugin: 'x-mod-stash' } as const;
const NUDGE_AT = 3;
// a plan set in either of the last 2 turns still holds: a turn that did not move it gets no nudge (clio's brief 8)
const PLAN_QUIET_TURNS = 2;
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
// every tool call: orbit's own ops, then the notes a step carries back — afk flipped, a tick, a lane steer, the
// fill, the phases nudge, the pace, herdr's joins
export async function onToolCall(
    $: EngineInterface,
    e: Args<'tool.call'>,
    next: Next<'tool.call'>,
    view: ViewDoors,
) {
    await flushFields($, view);
    if ((e.tool as string) === ORBIT_TOOL)
        return (await orbitToolCall($, e as Record<string, unknown>)) as never;
    // a wind blocks on work that STARTS after «pending: none», so the check runs before the call does
    if (!e.agentId)
        await windBlock($, e as Record<string, unknown>).catch(() => undefined);
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
    const boot = await bootNote($, e.tool as string, isOn);
    if (boot) notes.push(boot);
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
            joinText(fresh, tickSentence(await orbitTexts($), fresh.length)),
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
}
