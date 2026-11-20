// 🖼️ the view (FRM-662): what the band and the board draw, made from every owner's state and written to `$.state` only
// when it changed; load re-reads the store into it, a press shows its change at once; viewDoors hands load and publish
// to the owners below, the one door upward

import type { EngineInterface } from 'claude-code';

import type { StashView, StashWind } from '../types/stash.d.ts';
import {
    flushFields,
    forgetMountedText,
    isTypingAt,
    keptSteers,
    typedAts,
} from './fields.ts';
import {
    PACE,
    type ViewDoors,
    armHot,
    holdAfk,
    holdWaker,
    isAutoWind,
    isPaceOn,
    pressBegin,
    pressEnd,
    warm,
} from './keep-warm.ts';
import { readLanes, showLanes } from './lanes.ts';
import { span } from './look.ts';
import { isOverrideOn, readOverrideOn } from './override.ts';
import { isOpen, staleProbes } from './roster.ts';
import { members } from './rows.ts';
import {
    SUCC,
    clearedNow,
    continueFromCleared,
    currentId,
    identity,
    isLaneOwner,
    refreshSelfId,
} from './session-identity.ts';
import { readSwitch, refreshShown, settings } from './settings-store.ts';
import { AFK_KEY, REPLY, type Reply, WAKER_KEY } from './store-keys.ts';
import { errorText } from './util.ts';
import { windOf } from './wind.ts';

// a reload keeps `$.state` and resets the module: what must outlive a mod save lives there (FRM-320)
// what the band and the board draw: renders read it, and a write redraws them, no invalidate
const VIEW = { key: 'view', plugin: 'x-mod-stash' } as const;
// what only the board pane draws, its clock included: the band never reads it, so a tick never redraws the band
const BOARD_VIEW = { key: 'board', plugin: 'x-mod-stash' } as const;

// the band's own reads between two loads: load refreshes them, a press shows its change at once; this session's own
// second wind as the store holds it, 🍃 auto wind, 🔋 pace, and what its last reply waits on, its 🔭 line
const shown = {
    isAutoWindOn: true,
    isPaced: false,
    selfWind: undefined as StashWind['state'] | undefined,
    wait: undefined as string | undefined,
};
export const band: Readonly<typeof shown> = shown;
export function patchBand(patch: Partial<typeof shown>) {
    Object.assign(shown, patch);
}
export async function load($: EngineInterface) {
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
    shown.isPaced = isPaceOn(await $.store.get(PACE + (identity.selfId ?? '')));
    shown.selfWind = identity.selfId
        ? (await windOf($, identity.selfId))?.state
        : undefined;
    shown.isAutoWindOn = await isAutoWind($).catch(() => shown.isAutoWindOn);
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
    shown.wait = reply?.wait;
    await publish($);
}
// the band's view the module's values make
export function viewOf(isBoardOpen: boolean): StashView {
    return {
        afk: warm.afk,
        isAutoWind: shown.isAutoWindOn,
        isBoardOpen,
        isHot: Boolean(warm.hot),
        isOverrideOn: isOverrideOn(),
        isPaced: shown.isPaced,
        isSettingsOpen: settings.isSettingsOpen,
        isWaker: warm.isWaker,
        selfId: identity.selfId,
        shown: settings.shown,
        wait: shown.wait,
        wind: shown.selfWind,
    };
}
// the view's two doors, built per call for a module that must reach up: the one upward door (clio, 19:27)
export function viewDoors($: EngineInterface): ViewDoors {
    return { load: () => load($), publish: () => publish($) };
}
let published = '';
let boardPublished = '';
// writes the view to $.state when it changed; every site that reads it while drawing redraws
export async function publish($: EngineInterface) {
    const isBoardOpen = await isOpen($);
    // a closed board unmounts its fields: the next open draws the stored text, not a held one; a board typed into
    // within the quiet window is on screen, whatever the read said (FRM-492)
    if (
        isBoardOpen === false &&
        // clock-ok: compared with the fields' own Date.now() stamps, so both sides read one clock
        !isTypingAt(typedAts(), Date.now())
    ) {
        await flushFields($, viewDoors($));
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
export async function drawBand($: EngineInterface, patch: Partial<StashView>) {
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
export async function pressSwitch(
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

export async function pressPace($: EngineInterface) {
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
