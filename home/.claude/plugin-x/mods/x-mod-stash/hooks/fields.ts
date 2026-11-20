// ✍️ the steer boxes (FRM-492, FRM-531, FRM-662): what dima types into an ask's or a lane's box, kept through a reload,
// a thread switch and the store's refusals; saved after a pause, flushed before a press, a prompt or a tool call reads it

import type { EngineInterface } from 'claude-code';

import type { FieldDraft, OrbitAsk, StashField } from '../types/stash.d.ts';
import type { ViewDoors } from './keep-warm.ts';
import { changeLaneSteer, laneSteers } from './lanes.ts';
import {
    absorbMarks,
    changeAssumed,
    currentOrbit,
    inMarking,
    markAsks,
    putOrbit,
    saveOrbit,
} from './orbit-store.ts';
import { isOpen } from './roster.ts';
import { keepShelf } from './session-record.ts';
import { errorText } from './util.ts';

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
export async function flushFields($: EngineInterface, view: ViewDoors) {
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
    if (isOffered && (await isOpen($))) await view.publish();
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
export const keptSteers = new Map<string, string[]>();
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
// a start always takes the kept boxes back, whatever an earlier draw took
export function retakeFields($: EngineInterface) {
    fieldsTaken = takeFields($);
    return fieldsTaken;
}
export function takeFieldsOnce($: EngineInterface) {
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
export async function offerBack(
    $: EngineInterface,
    key: string,
    view: ViewDoors,
) {
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
    await view.publish();
}
// ✕ on a kept steer with no box: drops the newest, his choice, so a gone box's text has a way out
export async function dropKept(
    $: EngineInterface,
    key: string,
    view: ViewDoors,
) {
    const list = keptSteers.get(key) ?? [];
    if (list.length > 1) keptSteers.set(key, list.slice(0, -1));
    else keptSteers.delete(key);
    keepFields($);
    await view.publish();
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
export async function forgetMountedText($: EngineInterface) {
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
export function carried($: EngineInterface, keys: string[]) {
    if (keys.filter((key) => textsLeft.delete(key)).length) keepFields($);
}
// a thread switch on the desktop drops the board's view: every word goes to the store as he leaves, however soon after
// the last keystroke, and a remote steer is no longer held off by his typing; the boxes forget what they mounted with
// here, not at the return, since the return's first draw can overtake the attach hook (FRM-531 sixth sense)
export async function leaveBoxes($: EngineInterface, view: ViewDoors) {
    // before the first wait: a slow save must not leave the return's first draw reading the old text
    holdUnsaved();
    try {
        await flushFields($, view);
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
export async function returnToBoxes($: EngineInterface, view: ViewDoors) {
    // a steer another board wrote may still wait as a mark the poll has not read
    await absorbMarks($, () => keepShelf($), isTypedHere);
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
    if (isOffered) await view.publish();
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
                () => keepShelf($),
                (x) => (x.id === own[2] ? { ...x, steer } : x),
                false,
                isTyped ? own[2] : undefined,
            );
            return true;
        }
        if (!o.assumed?.some((y) => y.id === own[2])) return false;
        await changeAssumed(
            $,
            () => keepShelf($),
            (y) => (y.id === own[2] ? { ...y, steer } : y),
        );
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
export const steerOf = (value: string) => (value.trim() ? value : undefined);
export function field($: EngineInterface, key: string, saved: string) {
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
export const typedAts = () => [
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
export function askBox($: EngineInterface, a: OrbitAsk) {
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
// a steer typed into this session's own box a moment ago is newer than a card's edit that lands now
export const isTypedHere = (askId: string) =>
    isTypingAt(
        [askTypedAt.get(`orbit:steer:${askId}`) ?? 0],
        // clock-ok: compared with the drafts' own Date.now() stamps, so both sides read one clock
        Date.now(),
    );
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
