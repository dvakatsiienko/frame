// a session's start, and every hot reload's: who it is, what `$.state` kept, its tool and commands, and the one poll
// that keeps the process's books between turns

import type { EngineInterface } from 'claude-code';

import { takeBandPresses } from './band-presses.ts';
import { isTypedHere, retakeFields } from './fields.ts';
import { armHeldTells, armRelease, isQuietHome } from './held.ts';
import {
    POLL_MS,
    type ViewDoors,
    armHot,
    armWake,
    followHot,
    holdCap,
    holdHot,
    hotLate,
    pacePoll,
    seatDefaults,
} from './keep-warm.ts';
import {
    followCodies,
    followPlans,
    openDispatchedLanes,
    reshowLanes,
} from './lanes.ts';
import { wakeForMarks } from './orbit-presses.ts';
import {
    EMPTY_ORBIT,
    absorbMarks,
    keepState,
    orbitNow,
    saveOrbit,
    startOrbit,
} from './orbit-store.ts';
import { orbitCall, registerOrbitTool } from './orbit-tool.ts';
import { relayCrowWake, wakeForParkedLanes } from './parked-wake.ts';
import { quietBooks, quietIdle } from './quiet-gate.ts';
import { isOpen, openBoard } from './roster.ts';
import { showClioAsks } from './rows.ts';
import { pruneEnded } from './session-end.ts';
import { identity, refreshThreads, startIdentity } from './session-identity.ts';
import { keepShelf, pollShelf } from './session-record.ts';
import { takeHerdrRows } from './settings-store.ts';
import { refreshSpeaking } from './speak.ts';
import { HOT, hotOf } from './store-keys.ts';
import { bookkeep, markActive, restoreTurn, turn } from './turn.ts';
import { freshMeter } from './usage.ts';
import { COMPACT_SETTLE_MS, seedTurnNo, syncWindStore } from './wind-run.ts';

// the running turn, so a mid-turn reload still knows it is busy
const TURN = { key: 'turn', plugin: 'x-mod-stash' } as const;
// a reload keeps `$.state` and resets the module: what must outlive a mod save lives there (FRM-320)
// what the band and the board draw: renders read it, and a write redraws them, no invalidate
const VIEW = { key: 'view', plugin: 'x-mod-stash' } as const;

// 5 min past its last event, a session's bookkeeping jobs tick every 30 s; what dima pressed, typed or ticked, and the
// wakes, keep 4 s (FRM-555, dima o58, o59)
const IDLE_AFTER_MS = 5 * 60_000;
const IDLE_POLL_MS = 30_000;
// read-both: the board's id before dima's x-cc-deck name (o25); a reload finds it open and swaps it
const OLD_BOARD = 'fleet-board';
// when the last main turn ended: 🔥 switched on while idle counts its 50 min from here, so the ping lands inside the cache's hour
const ENDED = { key: 'ended', plugin: 'x-mod-stash' } as const;
const CAP = { key: 'cap', plugin: 'x-mod-stash' } as const;
// 🪐 orbit: the session's asks to dima, ticked in the board instead of pasted back; the session writes them through
// its own tool, never a reply block
const ORBIT = { key: 'orbit', plugin: 'x-mod-stash' } as const;
let isPolling = false;
// a start or a reload: who this session is, what `$.state` kept, the tool and commands, the poll
export async function startSession(
    $: EngineInterface,
    cwd: string,
    view: ViewDoors,
) {
    await startIdentity($, cwd);
    await seedTurnNo($, identity.selfId).catch(() => undefined);
    await refreshThreads($);
    await seatDefaults($, view).catch(() => undefined);
    await syncWindStore($).catch(() => undefined);
    await armHeldTells($, view).catch(() => undefined);
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
        JSON.stringify(orbitNow()) !== JSON.stringify(kept.orbit ?? EMPTY_ORBIT)
    )
        await saveOrbit($, orbitNow(), () => keepShelf($));
    // every board reads the fleet's lanes from the shelf file: at a start, a reload, and on each poll
    await reshowLanes($);
    await registerOrbitTool($);
    holdCap(kept.cap ?? undefined);
    // a mid-turn reload: the turn goes on, busy, and the band keeps what only it held
    restoreTurn(kept.ended ?? undefined, kept.turn ?? undefined);
    await pruneEnded($).catch(() => undefined);
    const stored = hotOf(await $.store.get(HOT + identity.selfId));
    holdHot(stored && { since: turn.endedAt ?? stored.since });
    // a reload drops the release timer: a compact-held list waiting for it goes in once the session is idle; armed after
    // a mid-turn reload's busy flag is back, so it never submits into a running turn
    armRelease($, view, COMPACT_SETTLE_MS);
    await view.load();
    await armHot($, view);
    await armWake($, view);
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
            .catch(() => $.ui.log('x-mod-stash: /quiet was not registered'));
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
    await startPoll($, view);
}
// one poll per process: a reload's start finds it running
async function startPoll($: EngineInterface, view: ViewDoors) {
    if (isPolling) return;
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
            await view.load();
            await followHot($, view).catch(() => undefined);
            if (isBookkept) await freshMeter($).catch(() => undefined);
            await absorbMarks($, () => keepShelf($), isTypedHere).catch(
                () => undefined,
            );
            await wakeForMarks($, view).catch(() => undefined);
            await takeBandPresses($, view).catch(() => undefined);
            // pollShelf paces itself every third tick; a gate here would slow it twice over
            await pollShelf($);
            await quietIdle($).catch(() => undefined);
            if (isBookkept) await quietBooks($, view).catch(() => undefined);
            await wakeForParkedLanes($, view).catch(() => undefined);
            await pacePoll($, view).catch(() => undefined);
            await hotLate($, view).catch(() => undefined);
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
