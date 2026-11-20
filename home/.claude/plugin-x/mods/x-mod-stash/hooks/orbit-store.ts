import type { EngineInterface } from 'claude-code';

import type {
    OrbitAsk,
    OrbitAssumption,
    StashEntry,
    StashOrbit,
    StashTick,
} from '../types/stash.d.ts';
import {
    allAsksTicks,
    herdrTicks,
    isGuardGated,
    isPressOn,
    mounted,
    steeredOrbit,
} from './orbit.ts';
import { currentId, identity, sessionName } from './session-identity.ts';
import { HERDR_READ } from './store-keys.ts';
import { markActive } from './turn.ts';
import { errorText } from './util.ts';

// this session's orbit and dima's tick records: the one owner of `$.state` orbit and ticks, the store's `asks:` mirror
// and the `kept:` copy a resumed process draws from; every change goes through these functions
const ORBIT = { key: 'orbit', plugin: 'x-mod-stash' } as const;
const MOBILE = { key: 'mobile', plugin: 'x-mod-stash' } as const;
const FOLDS = { key: 'folds', plugin: 'x-mod-stash' } as const;

export const PREFIX = 'asks:';
// what the board draws from this session's $.state, kept per conversation in the store, so a session resumed in a new
// process — a mac reboot relaunches every one — draws it again: $.state starts empty there (dima's ✨ wisps, 10-13 16:26
// orbit and the sessions rows, 16:44 phases); kept past an exit, dropped after a week unused
export const KEPT = 'kept:';
export const EMPTY_ORBIT: StashOrbit = { asks: [], next: 1, turns: 0 };
// mirrors `$.state`'s orbit, which survives a reload: a get inside one dispatch reads the moment it began
let orbit: StashOrbit = EMPTY_ORBIT;
// false until this process read its orbit back, from $.state or the kept store; until then nothing is kept, so an
// empty module copy never writes over the kept one
let isOrbitLoaded = false;
// kept in $.state for this session, and its open asks mirrored into the store, where the board's `🪐 n` counts every
// session's
export async function saveOrbit(
    $: EngineInterface,
    next: StashOrbit,
    // the caller's shelf write once the orbit is saved: the herdr state file reads it back
    onSaved: () => Promise<void>,
    // the one ask a steer box saved: only its steer is typing; every other ask is a read the save carried along
    typedId?: string,
) {
    // as currentOrbit: a read from before this process's last write never wins, or a steer typed since reads as cleared
    const read = await $.state.get(ORBIT).catch(() => undefined);
    const was =
        (!orbitWrites && (read?.version ?? 0) >= orbitVersion
            ? read?.value?.asks
            : undefined) ?? orbit.asks;
    orbit = {
        ...next,
        asks: next.asks.map((a) =>
            mounted(
                was.find((w) => w.id === a.id),
                a,
                a.id === typedId,
            ),
        ),
    };
    const isKept = await keepOrbit($);
    if (isKept) await keepState($, { orbit }).catch(() => undefined);
    const sid = await currentId($);
    if (!sid) return isKept;
    const open = orbit.asks.filter((a) => !a.isResolved);
    const asks = open.map((a) => a.text);
    if (asks.length)
        await $.store
            .set(PREFIX + sid, {
                asks,
                at: await $.clock.now(),
                items: open.map((a) => ({
                    id: a.id,
                    pick: a.pick,
                    text: a.text,
                    ...(a.link ? { link: a.link } : {}),
                    ...(a.mark ? { mark: a.mark } : {}),
                    ...(a.steer ? { steer: a.steer } : {}),
                    ...(a.isLocked ? { isLocked: true } : {}),
                    ...(isGuardGated(a.text) ? { isGated: true } : {}),
                })),
                label: identity.label,
                name: await sessionName($),
            } satisfies StashEntry)
            .catch(() => undefined);
    else await $.store.delete(PREFIX + sid).catch(() => undefined);
    await onSaved();
    return isKept;
}

// every get of one dispatch reads one moment (engine.md), so a hook running while he presses reads from before the
// press and would put that copy back: a read older than this process's last write, or racing one, never wins
let orbitVersion = 0;
let orbitWrites = 0;
async function keepOrbit($: EngineInterface) {
    orbitWrites++;
    try {
        orbitVersion = (await $.state.set(ORBIT, orbit)).version;
        return true;
    } catch (err) {
        await $.ui.log(`x-mod-stash: orbit was not kept: ${errorText(err)}`);
        return false;
    } finally {
        orbitWrites--;
    }
}

// the orbit as $.state holds it now: a reload can run a hook before session.start reads it back, and a module copy
// that never loaded would write an empty orbit over the kept one (FRM-381: «coder wiped the orbit»)
export async function currentOrbit($: EngineInterface) {
    const read = await $.state.get(ORBIT).catch(() => undefined);
    const kept = read?.value;
    if (kept && !orbitWrites && (read?.version ?? 0) >= orbitVersion) {
        orbit = steeredOrbit(kept);
        orbitVersion = read?.version ?? 0;
    }
    // a new process whose first hook is a turn's end, before its start (an app restart mid-turn): the kept copy first
    else if (!kept && !isOrbitLoaded)
        orbit = await resumeState($).catch(() => EMPTY_ORBIT);
    isOrbitLoaded = true;
    return orbit;
}
// one mark or steer write at a time: two boxes saved together each read the orbit before the other wrote it, and the
// later save put the earlier one's steer back to none while its box still showed it (FRM-492)
let marking: Promise<unknown> = Promise.resolve();
// a read-change-write of the orbit or the ticks, each whole; a step never queues another, which would wait on itself
export function inMarking<T>(step: () => Promise<T>) {
    const run = marking.then(step);
    marking = run.catch(() => undefined);
    return run;
}
// dima's tick as x-mod-guard reads it: written here, from his own press alone, so no tool call can forge one (FRM-427);
// one press is one marking step, deciding from one read: a tick's record lands before its mark, so a tool call that
// takes the mark finds it; an untick clears the mark first, so no tick is ever marked without its record
const TICKS = { key: 'ticks', plugin: 'x-mod-stash' } as const;
// every live tick counts at the guard (FRM-510), so a record leaves only past the guard's own 2 h, never by a count
const TICK_LIVE_MS = 2 * 60 * 60 * 1000;
// as the orbit's read: a read from before this process's last write never wins
let ticksKept: { sid?: string; value: StashTick[]; version: number } = {
    value: [],
    version: 0,
};
async function readTicks($: EngineInterface) {
    const read = await $.state.get(TICKS);
    // a new session id: its state was reset under this process, so the kept ticks are another conversation's
    const sid = await currentId($);
    if (sid !== ticksKept.sid || read.version >= ticksKept.version)
        ticksKept = { sid, value: read.value ?? [], version: read.version };
    return ticksKept.value;
}
async function writeTicks($: EngineInterface, value: StashTick[]) {
    const { version } = await $.state.set(TICKS, value);
    ticksKept = { sid: ticksKept.sid, value, version };
}
export async function recordTicks(
    $: EngineInterface,
    asks: OrbitAsk[],
    isTicked: boolean,
) {
    // the press still marks: a tick with no record fails closed at the guard; a drop that fails leaves his taken-back
    // tick honoured for its 2 h, so that one tells him
    try {
        const now = await $.clock.now();
        const rest = (await readTicks($)).filter(
            (t) =>
                now - t.at <= TICK_LIVE_MS && !asks.some((a) => a.id === t.id),
        );
        await writeTicks(
            $,
            isTicked ? [...rest, ...allAsksTicks(asks, now)] : rest,
        );
    } catch (err) {
        $.ui.log(`x-mod-stash: tick record not written: ${errorText(err)}`);
        if (!isTicked)
            $.ui.toast(
                '🛎️ untick not recorded: the guard may still honour this tick for 2 h',
            );
    }
}
export async function dropTicks($: EngineInterface, id: string) {
    const kept = await readTicks($);
    if (kept.some((t) => t.id === id))
        await writeTicks(
            $,
            kept.filter((t) => t.id !== id),
        );
}
type Kept = {
    folds?: Record<string, boolean>;
    mobile?: boolean;
    orbit?: StashOrbit;
};
// a part at its empty value keeps nothing, so a /clear leaves no copy of the conversation it left
const isKeptBlank = (k: Kept) =>
    !(k.orbit?.asks.length || k.orbit?.assumed?.length || k.orbit?.plan) &&
    !Object.keys(k.folds ?? {}).length &&
    !k.mobile;
let keptJson = '';
// every $.state part the board draws, written when one changed; a save passes its new value, since a read in the
// same dispatch still sees the old one
export async function keepState($: EngineInterface, fresh: Kept = {}) {
    if (!isOrbitLoaded) return;
    const sid = await currentId($);
    if (!sid) return;
    const k: Kept = {
        folds: fresh.folds ?? (await $.state.get(FOLDS)).value,
        mobile: fresh.mobile ?? (await $.state.get(MOBILE)).value === true,
        orbit: fresh.orbit ?? (await $.state.get(ORBIT)).value,
    };
    const json = JSON.stringify([sid, k]);
    if (json === keptJson) return;
    keptJson = json;
    if (isKeptBlank(k)) await $.store.delete(KEPT + sid);
    else await $.store.set(KEPT + sid, { ...k, at: await $.clock.now() });
}

// a new process with an empty $.state takes back what its conversation kept: folds, mobile mode and held pings into
// $.state now, the orbit returned for the start to load; a lock the old process held clears at the next turn end
async function resumeState($: EngineInterface): Promise<StashOrbit> {
    const sid = await $.session.id();
    const kept = (await $.store.get(KEPT + sid)) as Kept | undefined;
    if (!kept) return EMPTY_ORBIT;
    if (kept.folds) await $.state.set(FOLDS, kept.folds);
    if (kept.mobile) await $.state.set(MOBILE, true);
    if (!kept.orbit) return EMPTY_ORBIT;
    // a new process draws a fresh pane: no box holds what the old one mounted with (FRM-492)
    const o = steeredOrbit(kept.orbit);
    return { ...o, asks: o.asks.map(({ shown: _, ...a }) => a) };
}

// the orbit this process holds now, read in a hook that cannot await
export const orbitNow = () => orbit;

// a write of the orbit alone, no store mirror and no shelf: what a box mounted with
export async function putOrbit($: EngineInterface, next: StashOrbit) {
    orbit = next;
    return keepOrbit($);
}

// a start takes the orbit a reload kept in $.state, or the conversation's kept copy
export async function startOrbit(
    $: EngineInterface,
    kept: StashOrbit | undefined,
) {
    orbit = kept
        ? steeredOrbit(kept)
        : await resumeState($).catch(() => EMPTY_ORBIT);
    isOrbitLoaded = true;
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
// dima's presses on herdr's board join this session's own orbit, as if made here; a steer typed here stays in its box over
// the press's (PK-149)
export async function absorbMarks(
    $: EngineInterface,
    onSaved: () => Promise<void>,
    isTyped: (askId: string) => boolean,
) {
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
                        steer: isTyped(a.id)
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
            onSaved,
        );
    });
    if (isSaved && retracted.length) await recordTicks($, retracted, false);
    if (isSaved && accepted.length) await recordTicks($, accepted, true);
    // a press the orbit did not keep is read again at the next take
    if (isSaved && herdr.last > herdr.after)
        await $.store.set(HERDR_READ + sid, herdr.last).catch(() => undefined);
}
// dima marks or steers asks; a locked ask is the running turn's and stays as it is. a mark made while a turn runs
// rides that turn's next tool result (the tool.call hook); one the turn never reaches rides his next prompt — a
// hidden message appended instead started a turn of its own when it landed after the last read (dima, 20:31)
// 🛎️ clears an assumption, ↩️ and its steer mark it wrong; a 🛎️ or ↩️ press means dima is at the mac (dima, 11:16)
export async function changeAssumed(
    $: EngineInterface,
    onSaved: () => Promise<void>,
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
            onSaved,
        );
    });
}
export async function markAsks(
    $: EngineInterface,
    onSaved: () => Promise<void>,
    change: (a: OrbitAsk) => OrbitAsk,
    isMark = false,
    typedId?: string,
) {
    await inMarking(() => markAsksNow($, onSaved, change, isMark, typedId));
}
export async function markAsksNow(
    $: EngineInterface,
    onSaved: () => Promise<void>,
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
    return saveOrbit($, { ...o, asks }, onSaved, typedId);
}
