// 🛎️ dima's presses on the orbit (FRM-662): a tick, a take-back or a steer pressed on the board or herdr's orbit, the
// marks they leave for the running turn or the next prompt, and the wake that brings an idle session to them

import type { EngineInterface } from 'claude-code';

import type { OrbitAsk, StashOrbit } from '../types/stash.d.ts';
import { carried } from './fields.ts';
import { type ViewDoors, prepareTurn } from './keep-warm.ts';
import {
    hasPlanMark,
    isAllAsksMarkable,
    isFresh,
    joinText,
    lockJoined,
    planTaken,
} from './orbit.ts';
import {
    currentOrbit,
    inMarking,
    markAsksNow,
    recordTicks,
    saveOrbit,
} from './orbit-store.ts';
import { keepShelf } from './session-record.ts';
import { partsShown } from './settings-store.ts';
import { selfSubmit, turn } from './turn.ts';
import { orbitTexts, tickSentence } from './turn-notes.ts';

// the running turn, so a mid-turn reload still knows it is busy
const TURN = { key: 'turn', plugin: 'x-mod-stash' } as const;
// mobile mode: mods draw nothing on the phone, so the session prints the open asks as the asks fence instead
const MOBILE = { key: 'mobile', plugin: 'x-mod-stash' } as const;

// when dima last prompted anywhere: an idle session's herdr press waits for it before it wakes
export const DIMA_AT = 'dima-at';
// an idle session whose asks were marked from another board wakes once dima prompts anywhere after the marks: one turn
// carrying all of them. the submitted prompt skips this plugin's own prompt.submit hook, so the marks ride its text
export async function wakeForMarks($: EngineInterface, view: ViewDoors) {
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
            () => prepareTurn(view),
        ).catch(() => undefined);
}
// a turn takes his marks in the marking queue: a press lands wholly before or after the lock, never inside it
export function takeMarks(
    $: EngineInterface,
    pick: (o: StashOrbit) => OrbitAsk[],
) {
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
export function takePlanMark($: EngineInterface) {
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
        () => keepShelf($),
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
        () => keepShelf($),
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
export async function pressAllAsks(
    $: EngineInterface,
    drawn: Pick<OrbitAsk, 'id' | 'text'>[],
) {
    await inMarking(() => pressAllAsksNow($, drawn));
}
export async function pressMark(
    $: EngineInterface,
    id: string,
    mark: 'accepted' | 'rejected',
) {
    await inMarking(() => pressMarkNow($, id, mark));
}
