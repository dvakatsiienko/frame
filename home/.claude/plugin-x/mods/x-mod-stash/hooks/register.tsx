/* @jsx h */
import type { Register } from 'claude-code';

import { renderBand } from './band.tsx';
import { drawBoard } from './board.tsx';
import { openBoot } from './boot.ts';
import { flushFields, leaveBoxes, returnToBoxes } from './fields.ts';
import { WIND_DELAY_MS, armRelease, steersOnCompact } from './held.ts';
import { joinsLocked, settleJoins } from './joins.ts';
import {
    armHot,
    capAtMeasure,
    capAtTurnEnd,
    holdHot,
    seatDefaults,
    warm,
} from './keep-warm.ts';
import { turnEnded } from './orbit.ts';
import {
    EMPTY_ORBIT,
    currentOrbit,
    inMarking,
    saveOrbit,
} from './orbit-store.ts';
import { composePrompt } from './prompt-notes.ts';
import {
    quietCommand,
    quietDeliveryTest,
    receiveMessage,
} from './quiet-gate.ts';
import { fixDrawnReply, fixStoredReply, settleReply } from './reply-fix.ts';
import { openBoard } from './roster.ts';
import { endSession, forget } from './session-end.ts';
import { currentId, refreshThreads } from './session-identity.ts';
import { keepShelf, noteModel } from './session-record.ts';
import { startSession } from './session-start.ts';
import { drawSettingsPane } from './settings-pane.tsx';
import { flipKnob, setSettingsOpen } from './settings-store.ts';
import { onToolCall } from './step-notes.ts';
import { HOT, hotOf } from './store-keys.ts';
import { endBusy, endStop, markActive, turn } from './turn.ts';
import { forgetTold } from './turn-notes.ts';
import { drawFill, drawFillAfterCompact, measureUsage } from './usage.ts';
import { errorText } from './util.ts';
import { load, publish, viewDoors } from './view.ts';
import { COMPACTING, windOf } from './wind.ts';
import {
    COMPACT_SETTLE_MS,
    FILL,
    windAfterTurn,
    windOnCompact,
} from './wind-run.ts';

// x-mod-stash: dima's command center above the prompt, one row; FTR.md lists every feature.
// orbit: the session's asks to dima and its plan, written through its own tool, ticked in the board; its open asks are
// mirrored into $.store (one key per session), so the board counts every session's.
// afk: one switch every session polls; while it is on, every prompt carries an away note, and a flip reaches a running turn.
// keep-hot: while on and idle, one ping 50 min after the last turn ended keeps the prompt cache warm; the switch lives in $.store, so a reload keeps it

// the fleet board: cc's registry gives each session's state; each session's stash adds its 🔭 wait and context fill
const BOARD = 'x-cc-deck';
// 🎛️ is a pane of its own, which the surface tabs beside 🚦: the band is capped by cc, the list outgrew it (dima's pick a of
// four homes, 16:20); a tab row inside a pane was proven too, kept as an idea in api-map.md
const SETTINGS_PANE = 'stash-settings';
// mobile mode: mods draw nothing on the phone, so the session prints the open asks as the asks fence instead
const MOBILE = { key: 'mobile', plugin: 'x-mod-stash' } as const;
const MOBILE_SKILL = /(^|:)mobile-mode$/;
const MOBILE_OFF = /ARGUMENTS:\s*off\b/i;

export const register: Register = (on) => {
    // session.start fires at startup and again on every hot reload; the classic event only at startup
    on('session.start', async ($, e, next) => {
        await startSession($, e.cwd, viewDoors($));
        return next(e);
    });

    // `/mobile-mode` turns the asks fence on, `/mobile-mode off` turns it off
    on('skill.prompt', async ($, e, next) => {
        await openBoot($, e.skill);
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

    on('prompt.submit', ($, e, next) =>
        composePrompt($, e, next, viewDoors($)),
    );

    // a long turn outruns the prompt's clock: the stored reply's 📄 stamp is the time it was written
    on('session.append', { door: 'response' }, ($, e, next) =>
        fixStoredReply($, e, next),
    );

    // the drawing: the reply's ·-list shows as bullets while it streams, before the stored row exists
    on('ui.render', { component: 'AssistantMessage' }, ($, e, next) =>
        fixDrawnReply($, e, next),
    );

    on('classic.Stop', ($, e, next) => settleReply($, e, next, viewDoors($)));

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

    on('session.receive', ($, e, next) =>
        receiveMessage($, e, next, viewDoors($)),
    );

    on('command.run', { command: 'quiet-delivery-test' }, ($, e) =>
        quietDeliveryTest($, e.args),
    );

    on('command.run', { command: 'quiet' }, ($, e) => quietCommand($, e.args));

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
    on('tool.call', ($, e, next) => onToolCall($, e, next, viewDoors($)));

    // the band: one row — the meters' readings, the 🔭 mark, the switches — then the bars
    // and a refused threshold's one line
    on('ui.render', { component: 'AbovePrompt' }, ($, e, next) =>
        renderBand($, e, next),
    );
};
