// 📥 the held store (FRM-583, FRM-662): every message a session holds for a later turn, one `held:<sid>` list under one
// lock, its holds (a compact, a second wind, quiet comms), the releases that hand it to a turn, and the tells its sender hears

import type { EngineInterface } from 'claude-code';

import type { QuietPing, StashWind } from '../types/stash.d.ts';
import { type ViewDoors, prepareTurn } from './keep-warm.ts';
import {
    QUIET_NOTICE,
    isQuietPause,
    messageKind,
    peerPing,
    rowOfTo,
} from './quiet.ts';
import { quietFlushed } from './quiet-books.ts';
import { registry } from './roster.ts';
import {
    MAIN_ROLE,
    WING_ROLE,
    currentId,
    identity,
    isLaneOwner,
    selfRecord,
    sessionName,
    threadRecords,
} from './session-identity.ts';
import { type IsPartOn, partsShown, readNumber } from './settings-store.ts';
import { REPLY, type Reply } from './store-keys.ts';
import { selfSubmit, turn } from './turn.ts';
import { CONTEXT } from './usage.ts';
import { bare, errorText, serial } from './util.ts';
import {
    COMPACTING,
    COMPACT_MAX_MS,
    WIND,
    WIND_HOW,
    WIND_WORDS,
    windOf,
} from './wind.ts';

// quiet comms (PK-93, FRM-501): in clio's thread a message is held, no turn, unless it pushes (hooks/quiet.ts) or is a
// member's first answer to her; held ones ride her next prompt as one hidden block, or an idle append after the wait.
// they live in the one held store (`HELD`); this key is the old store, read at the land, never written
export const QUIET_HELD = 'quiet-held:';
// a coordinator's message to a codie whose context reads past this waits for the codie's second wind (dima's o23: «~50–60%
// is fine»); it joins the first turn after the compact, so a steer never lands in a full context
const STEER_HOLD_AT = 55;
// the compact and wind holds' store before FRM-583, read at the land, never written
const STEER_HELD = 'steer-held:';
// FRM-583: one held store for every reason a message waits, `held:<sid>`, one entry per message id; release stays per
// reason: a compact or a wind hands its own to the first turn after it, quiet comms its own to the next prompt or the
// idle append. held under the session id, so a retitle while a message waits strands nothing (FRM-617 round 1); a /clear
// mints a new id, so the id it cleared away from is read too, and `held:<name>`, the store before, once
export const HELD = 'held:';
type HeldMessage = {
    id: string;
    at: number;
    from: string;
    text: string;
    // reply: the sender's address, as its message carried it; isTold: its sender heard the hold outlived STEER_TELL_MS
    reply?: string;
    isTold?: true;
    // held because the thread was compacting, not for a codie's wind
    isCompact?: true;
    // held by quiet comms in the coordinator's thread
    isQuiet?: true;
    // a compact's held message whose sender heard it outlived the deadline
    isWaitTold?: true;
    tag?: string;
    deliveryTest?: string;
};
export type HeldStore = { isCompacted?: true; messages: HeldMessage[] };
// older: the held keys read and cleared at the next save, the name's (the store before) and the id a /clear left
type HeldKeys = {
    key: string;
    steers: string;
    quiet?: string;
    older: string[];
};
// a message's id: the same delivery read from two stores is one message
function heldId(m: { at: number; from: string; text: string }) {
    let h = 0;
    for (const c of `${m.from}\n${m.text}`)
        h = (Math.imul(31, h) + (c.codePointAt(0) ?? 0)) | 0;
    return `${m.at.toString(36)}-${(h >>> 0).toString(36)}`;
}
export async function heldKeys(
    $: EngineInterface,
): Promise<HeldKeys | undefined> {
    const name = await sessionName($);
    const sid = await currentId($);
    const own = sid ?? (name ? bare(name) : undefined);
    if (!own) return undefined;
    const prior = identity.clearedFrom ?? identity.continuedFrom;
    return {
        key: HELD + own,
        steers: STEER_HELD + (name ? bare(name) : own),
        ...(sid ? { quiet: QUIET_HELD + sid } : {}),
        older: [
            ...(sid && name ? [HELD + bare(name)] : []),
            ...(sid && prior && prior !== sid ? [HELD + prior] : []),
        ],
    };
}
export const quietHeldOf = (p: QuietPing): HeldMessage => ({
    ...p,
    id: heldId(p),
    isQuiet: true,
});
export const quietPingOf = (m: HeldMessage): QuietPing => ({
    at: m.at,
    from: m.from,
    text: m.text,
    ...(m.tag ? { tag: m.tag } : {}),
    ...(m.deliveryTest ? { deliveryTest: m.deliveryTest } : {}),
});
// the one store, read with the two it replaced: a message either of them holds is read once, by its id
export async function heldStore(
    $: EngineInterface,
    keys: HeldKeys,
): Promise<HeldStore> {
    const own = (await $.store.get(keys.key).catch(() => undefined)) as
        | Partial<HeldStore>
        | undefined;
    const older = (await Promise.all(
        keys.older.map((key) => $.store.get(key).catch(() => undefined)),
    )) as (Partial<HeldStore> | undefined)[];
    const steers = (await $.store.get(keys.steers).catch(() => undefined)) as
        | { isCompacted?: true; steers?: Omit<HeldMessage, 'id'>[] }
        | undefined;
    const quiet = keys.quiet
        ? await $.store.get(keys.quiet).catch(() => undefined)
        : undefined;
    const seen = new Set<string>();
    const messages = [
        ...(own?.messages ?? []),
        ...older.flatMap((o) => o?.messages ?? []),
        ...(steers?.steers ?? []).map((m) => ({ ...m, id: heldId(m) })),
        ...(Array.isArray(quiet) ? (quiet as QuietPing[]) : [])
            .filter((p) => p.tag !== QUIET_NOTICE)
            .map(quietHeldOf),
    ]
        .filter((m) => !seen.has(m.id) && !!seen.add(m.id))
        .sort((a, b) => a.at - b.at);
    return {
        messages,
        ...(own?.isCompacted ||
        older.some((o) => o?.isCompacted) ||
        steers?.isCompacted
            ? { isCompacted: true as const }
            : {}),
    };
}
// true once the store holds the list; the two old stores go once it does
export async function saveHeld(
    $: EngineInterface,
    keys: HeldKeys,
    held: HeldStore,
) {
    const isSaved = await (held.messages.length
        ? $.store.set(keys.key, held)
        : $.store.delete(keys.key)
    )
        .then(() => true)
        .catch(() => false);
    if (!isSaved) return false;
    await $.store.delete(keys.steers).catch(() => undefined);
    if (keys.quiet) await $.store.delete(keys.quiet).catch(() => undefined);
    for (const key of keys.older)
        await $.store.delete(key).catch(() => undefined);
    return true;
}
// one message more, read and written under the one lock; a message already held is held once
function holdMessage(
    $: EngineInterface,
    keys: HeldKeys,
    message: Omit<HeldMessage, 'id'>,
) {
    return quietLocked(async () => {
        const kept = await heldStore($, keys);
        const id = heldId(message);
        if (kept.messages.some((m) => m.id === id)) return true;
        return saveHeld($, keys, {
            ...kept,
            messages: [...kept.messages, { ...message, id }],
        });
    });
}
// a message held this long for a codie that has not wound tells its sender once; the hold stays (dima's o62)
const STEER_TELL_MS = 10 * 60_000;
const steerTellLine = (name: string, context: unknown) =>
    `your message to ${name} is held: it is at ${typeof context === 'number' ? `${Math.round(context)} %` : `past ${STEER_HOLD_AT} %`} and has not wound`;
const steerHoldNote = (from: string, context: number) =>
    `🐦‍🔥 ${from}'s message is held for your second wind: your context reads ${Math.round(context)} %, past ${STEER_HOLD_AT} %. ${WIND_WORDS} finish the step you are on, then ${WIND_HOW} the held message joins your first turn after the pickup.`;
// each held message names its kind from the one list (FRM-583), after its sender
const steerLine = (s: HeldMessage) => {
    const who = `${s.from} (${messageKind(s.text, s.tag)}): ${s.text}`;
    if (s.isQuiet) return `🤫 held by quiet comms, delivered now — ${who}`;
    return s.isCompact
        ? `🌀 held while this thread compacted, delivered now — ${who}`
        : `🐦‍🔥 held for your second wind, delivered now — ${who}`;
};
const heldWaitingLine = (name: string) =>
    `held, waiting: ${name} has taken no turn since its compact; your message joins its next turn`;
const heldWaitingText = (since: number) =>
    `waiting: held messages for this thread's next turn, since ${new Date(since).toTimeString().slice(0, 5)}`;
const steerDeliveredLine = (name: string) =>
    `delivered: your message joined ${name}'s first turn after its compact`;
// the turn's end lets the engine settle before the compact runs
export const WIND_DELAY_MS = 1_000;
const QUIET_STUCK_MS = 2 * 60_000;
// only clio's thread holds anything, known by her registry name — never the cwd, which a Bash `cd` moves: her pings
// passed unheld from 16:43, the hour she worked cd'd into ~/frame (clio's wisp, 17:06)
export function isQuietHome($: EngineInterface) {
    return isLaneOwner($);
}

// the held list is read, changed and written back across awaits: every change waits its turn, or a message landing
// between the two is lost
export const quietLocked = serial();
// past this a hold reads stuck
export async function heldStuckMs($: EngineInterface) {
    return (await readNumber($, 'quietWait')) * 60_000 + QUIET_STUCK_MS;
}
// a compact is running: from its 🌀 or the compact's start until it ends
export async function isCompactingNow(
    $: EngineInterface,
    sid: string,
    isWindOn: boolean,
) {
    // a 🌀 row is second wind's: switched off, a row left behind holds nothing, only a real compact does
    const was = isWindOn ? (await windOf($, sid))?.state : undefined;
    const since = await $.store.get(COMPACTING + sid).catch(() => undefined);
    // a process that died mid-compact never cleared its key, so the key counts only inside a compact's longest run
    return (
        was === 'refreshing' ||
        (typeof since === 'number' &&
            (await $.clock.now()) - since < COMPACT_MAX_MS)
    );
}
// every message into a compacting thread, from any sender, waits for its next turn: from its 🌀 or the compact's start
// until the compact ends; a wind refused never compacts, so it holds nothing (dima's o141, 00:20 and 00:24)
async function holdForCompact(
    $: EngineInterface,
    text: string,
    body: string,
    from: string,
    isWindOn: boolean,
    view: ViewDoors,
): Promise<{ consumed: string } | undefined> {
    const keys = await heldKeys($);
    const sid = await currentId($);
    if (!sid || !keys || !(await isCompactingNow($, sid, isWindOn)))
        return undefined;
    if ((await heldStore($, keys)).isCompacted) return undefined;
    const reply = text.match(
        /<cross-session-message[^>]*\sfrom="([^"]+)"/,
    )?.[1];
    // consumed only once the store holds it: a message no store holds is a lost one
    const isHeld = await holdMessage($, keys, {
        at: await $.clock.now(),
        from,
        isCompact: true,
        text: body,
        ...(reply ? { isTold: true as const, reply } : {}),
    });
    if (!isHeld) return undefined;
    const at = await $.clock.now();
    armHeldDeadline($, at, at, view);
    const name = (await sessionName($)) ?? 'this session';
    if (reply)
        await $.session
            .send({
                text: `held: ${name} is compacting; your message joins its next turn`,
                to: reply,
            })
            .catch(() => undefined);
    return {
        consumed: `x-mod-stash held ${from}'s message while this thread compacts`,
    };
}
// a wind still ahead of the session: an asked one, one it is writing or compacting, one refused that it will call again
const isWindAhead = (state: StashWind['state'] | undefined) =>
    state === 'asked' ||
    state === 'writing' ||
    state === 'refreshing' ||
    state === 'refused';
// a coordinator's message to a codie past STEER_HOLD_AT: the first is rewritten into the wind note, so it still starts the
// turn that winds; the next ones wait unseen while the wind is being written or compacted; all of them join the first turn
// after the compact. a wind dima took back, or one refused, passes the message as sent
export async function holdSteer(
    $: EngineInterface,
    text: string,
    view: ViewDoors,
): Promise<{ consumed: string } | { text: string } | undefined> {
    const { body, from } = peerPing(text);
    if (isQuietPause(body)) return undefined;
    // r5 first: a codie past 55 % turns a coordinator's message into its wind note; what it leaves, a compact holds. the
    // compact hold is no part of second wind: switched off, a compact still holds (FRM-564:W36 «has to work for everyone»)
    const isWindOn = (await partsShown($))('stash.second-wind');
    const wind = isWindOn
        ? await holdForWind($, text, body, from, view)
        : undefined;
    if (wind) return wind;
    // the coordinator's quiet comms judge first: a ping they hold waits for her next prompt or the idle append, never a
    // turn of its own; what they pass, holdAfterQuiet hands the compact
    if (await isQuietHome($).catch(() => false)) return undefined;
    return holdForCompact($, text, body, from, isWindOn, view);
}
export async function holdAfterQuiet(
    $: EngineInterface,
    text: string,
    view: ViewDoors,
) {
    const { body, from } = peerPing(text);
    if (isQuietPause(body)) return undefined;
    const isWindOn = (await partsShown($))('stash.second-wind');
    return holdForCompact($, text, body, from, isWindOn, view);
}
async function holdForWind(
    $: EngineInterface,
    text: string,
    body: string,
    from: string,
    view: ViewDoors,
): Promise<{ consumed: string } | { text: string } | undefined> {
    // the sender is a coordinator by the record of the session its socket names, never by the name it signs with: cc
    // writes the socket into `from`, a fork can share a name
    const socket = text.match(
        /<cross-session-message[^>]*\sfrom="([^"]*cc-socks\/\d+\.sock)"/,
    )?.[1];
    if (!socket) return undefined;
    const fromSid = rowOfTo(await registry($), socket)?.base.sid;
    const fromRole = (await threadRecords($)).find(
        (t) => t.sessionId === fromSid,
    )?.role;
    if (fromRole !== MAIN_ROLE && fromRole !== WING_ROLE) return undefined;
    if ((await selfRecord($))?.role !== 'codie') return undefined;
    const keys = await heldKeys($);
    const sid = await currentId($);
    if (!sid || !keys) return undefined;
    const kept = await heldStore($, keys);
    if (kept.isCompacted) return undefined;
    const was = (await windOf($, sid))?.state;
    const isWinding = was === 'writing' || was === 'refreshing';
    const at = await $.clock.now();
    const reply = text.match(
        /<cross-session-message[^>]*\sfrom="([^"]+)"/,
    )?.[1];
    const steer = { at, from, text: body, ...(reply ? { reply } : {}) };
    // one timer chain: only a message no older untold one waits ahead of arms its own (wisphunter on 990334f5)
    const isFirstUntold = !kept.messages.some((s) => !s.isTold && s.reply);
    if (kept.messages.length && isWinding) {
        if (!(await holdMessage($, keys, steer))) return undefined;
        if (isFirstUntold) armSteerTell($, at, at);
        return {
            consumed: `x-mod-stash held ${from}'s message for this codie's second wind`,
        };
    }
    const context = await $.store.get(CONTEXT + sid).catch(() => undefined);
    if (typeof context !== 'number' || context < STEER_HOLD_AT)
        return undefined;
    if (was !== undefined && was !== 'asked') return undefined;
    // held first: a note sent in place of a message no store holds would lose it
    if (!(await holdMessage($, keys, steer))) return undefined;
    await $.store.set(WIND + sid, { at, state: 'writing' } satisfies StashWind);
    if (isFirstUntold) armSteerTell($, at, at);
    await view.load().catch(() => undefined);
    const open = text.match(/<cross-session-message[^>]*>/)?.[0];
    const note = steerHoldNote(from, context);
    return { text: open ? `${open}\n${note}\n</cross-session-message>` : note };
}
// the held messages join a turn once no wind is ahead of the session: its compact ran, dima took it back, or the switch
// went off; read before the turn takes its own wind line, which drops a refused row
export async function takeSteers($: EngineInterface, isOn: IsPartOn) {
    const keys = await heldKeys($);
    const sid = await currentId($);
    if (!keys || !sid) return [];
    const was = (await windOf($, sid))?.state;
    // quiet comms' own went first, to this prompt's quiet note
    const steers = await takeHeld(
        $,
        keys,
        (kept) =>
            !(
                isOn('stash.second-wind') &&
                isWindAhead(was) &&
                !kept.isCompacted
            ),
    );
    await tellDelivered($, steers);
    const quiet = steers.filter((m) => m.isQuiet).map(quietPingOf);
    if (quiet.length)
        await quietLocked(() => quietFlushed($, quiet)).catch(() => undefined);
    return [...(quiet.length ? [QUIET_RIDE] : []), ...steers.map(steerLine)];
}
// a compact's and a wind's messages, read and taken under the one lock, so a prompt and a release racing each other take
// them once; quiet comms' never start a turn alone, but ride one a compact's or a wind's message starts, in the order sent
function takeHeld(
    $: EngineInterface,
    keys: HeldKeys,
    isDue: (kept: HeldStore) => boolean,
) {
    return quietLocked(async () => {
        const kept = await heldStore($, keys);
        if (!kept.messages.some((m) => !m.isQuiet) || !isDue(kept)) return [];
        const isSaved = await saveHeld($, keys, { messages: [] });
        return isSaved ? kept.messages : [];
    });
}
const QUIET_RIDE =
    '🤫 quiet comms: the member pings below rode this turn; read them, act only if one changes the plan, never relay them to dima.';
const heldText = (held: HeldMessage[]) =>
    [
        ...(held.some((m) => m.isQuiet) ? [QUIET_RIDE] : []),
        ...held.map(steerLine),
    ].join('\n');
// a sender that heard «held» hears its message went in, so a hold never ends in silence (FRM-597)
async function tellDelivered($: EngineInterface, steers: HeldMessage[]) {
    const told = new Set(
        steers.flatMap((s) =>
            s.isCompact && s.isTold && s.reply ? [s.reply] : [],
        ),
    );
    if (!told.size) return;
    const line = steerDeliveredLine((await sessionName($)) ?? 'this session');
    for (const to of told)
        await $.session.send({ text: line, to }).catch(() => undefined);
}
function armSteerTell($: EngineInterface, heldAt: number, now: number) {
    $.clock.after(Math.max(0, heldAt + STEER_TELL_MS - now), () =>
        tellHeldSenders($).catch(() =>
            $.ui.log("x-mod-stash: a held message's sender was not told"),
        ),
    );
}
// a reload drops the timers: the start arms one for the oldest held message whose sender has not heard
export async function armHeldTells($: EngineInterface, view: ViewDoors) {
    const keys = await heldKeys($);
    if (!keys) return;
    const kept = await heldStore($, keys);
    const first = kept.messages.find((s) => !s.isTold && s.reply);
    if (first && !kept.isCompacted)
        armSteerTell($, first.at, await $.clock.now());
    const waiting = kept.messages.find((s) => s.isCompact && !s.isWaitTold);
    if (waiting) armHeldDeadline($, waiting.at, await $.clock.now(), view);
}
function armHeldDeadline(
    $: EngineInterface,
    heldAt: number,
    now: number,
    view: ViewDoors,
) {
    $.clock.after(Math.max(0, heldAt + STEER_TELL_MS - now), () =>
        tellWaiting($, view).catch(() =>
            $.ui.log(
                "x-mod-stash: a held message's sender was not told it waits",
            ),
        ),
    );
}
// a compact's held message no turn took inside the deadline: its sender hears it waits, and the thread's 🔭 line says
// so, never silence (FRM-583 exit 4: a --bg thread's turn after its compact may never come)
async function tellWaiting($: EngineInterface, view: ViewDoors) {
    const keys = await heldKeys($);
    const sid = await currentId($);
    if (!keys || !sid) return;
    const now = await $.clock.now();
    // a compact still running is no missed turn: look again once it could have ended
    const isWindOn = (await partsShown($))('stash.second-wind');
    // a turn still running is no missed turn either: the compact ran inside it, and its end hands the message over. the
    // module's flag, as releaseIfIdle reads it: a state read inside this timer sees its arming hook's moment, busy forever
    if (turn.isBusy || (await isCompactingNow($, sid, isWindOn)))
        return armHeldDeadline($, now + 60_000 - STEER_TELL_MS, now, view);
    const due = await quietLocked(async () => {
        const kept = await heldStore($, keys);
        const late = kept.messages.filter(
            (m) => m.isCompact && !m.isWaitTold && now - m.at >= STEER_TELL_MS,
        );
        if (!late.length) return [];
        const isSaved = await saveHeld($, keys, {
            ...kept,
            messages: kept.messages.map((m) =>
                late.some((d) => d.id === m.id)
                    ? { ...m, isWaitTold: true as const }
                    : m,
            ),
        });
        return isSaved ? late : [];
    });
    if (!due.length) return;
    const line = heldWaitingLine((await sessionName($)) ?? 'this session');
    for (const to of new Set(due.flatMap((m) => (m.reply ? [m.reply] : []))))
        await $.session.send({ text: line, to }).catch(() => undefined);
    // the 🔭 line the band and every board read, until the next reply writes its own
    const { waits: _, ...reply } = ((await $.store
        .get(REPLY + sid)
        .catch(() => undefined)) as Reply | undefined) ?? { at: now };
    await $.store.set(REPLY + sid, {
        ...reply,
        wait: heldWaitingText(Math.min(...due.map((m) => m.at))),
    } satisfies Reply);
    await view.load().catch(() => undefined);
}
async function tellHeldSenders($: EngineInterface) {
    const keys = await heldKeys($);
    const sid = await currentId($);
    if (!keys || !sid) return;
    const kept = await heldStore($, keys);
    if (kept.isCompacted) return;
    const now = await $.clock.now();
    const due = kept.messages.filter(
        (s) => !s.isTold && s.reply && now - s.at >= STEER_TELL_MS,
    );
    if (!due.length) return;
    const line = steerTellLine(
        (await sessionName($)) ?? 'this codie',
        await $.store.get(CONTEXT + sid).catch(() => undefined),
    );
    const isDue = (s: HeldMessage) => due.some((d) => d.id === s.id);
    // marked told from a fresh read under the lock, before the sends: a hold written meanwhile is kept, a delivered one
    // stays gone
    const isMarked = await quietLocked(async () => {
        const fresh = await heldStore($, keys);
        if (!fresh.messages.length || fresh.isCompacted) return false;
        return saveHeld($, keys, {
            ...fresh,
            messages: fresh.messages.map((s) =>
                isDue(s) ? { ...s, isTold: true as const } : s,
            ),
        });
    });
    if (!isMarked) return;
    for (const reply of new Set(due.map((s) => s.reply as string)))
        await $.session.send({ text: line, to: reply }).catch(() => undefined);
    const next = kept.messages.find((s) => !s.isTold && s.reply && !isDue(s));
    if (next) armSteerTell($, next.at, now);
}
// the ingest is the mod's own prompt, which its hooks never see: what the wind held follows it as a turn of its own, so an
// idle session still reads it (crow's wind, 11-12)
export async function releaseHeldSteers(
    $: EngineInterface,
    view: ViewDoors,
    isDue: Parameters<typeof takeHeld>[2] = () => true,
) {
    const keys = await heldKeys($);
    if (!keys) return;
    const steers = await takeHeld($, keys, isDue);
    if (!steers.length) return;
    // through selfSubmit, so the released turn reads busy: a keep-hot ping or a wake never lands inside it
    await selfSubmit($, heldText(steers), false, () => prepareTurn(view)).catch(
        async (err: unknown) => {
            // a refused submit hands the list back ahead of what landed since, flagged, so the next release takes it
            await quietLocked(async () => {
                const now = await heldStore($, keys);
                await saveHeld($, keys, {
                    isCompacted: true,
                    messages: [...steers, ...now.messages],
                });
            });
            throw err;
        },
    );
    await tellDelivered($, steers);
    const quiet = steers.filter((m) => m.isQuiet).map(quietPingOf);
    if (quiet.length)
        await quietLocked(() => quietFlushed($, quiet)).catch(() => undefined);
}
// what a compact held goes in once the session is idle, as a prompt of its own: a session idle after its compact has no
// next prompt to carry it (FRM-597: helga's auto-compact mid-turn, then 22 min idle); a busy one hands it over at its turn's
// end, or its next prompt takes it first
async function releaseIfIdle($: EngineInterface, view: ViewDoors) {
    // the module's flag, as the keep-hot timer reads it: a state read inside the timer may see its arming hook's moment
    if (turn.isBusy) return;
    // read again under the lock: a prompt that started while this waited takes the list itself
    await releaseHeldSteers(
        $,
        view,
        (kept) => !turn.isBusy && kept.isCompacted === true,
    );
}
// a refused release tries again a few times, so an idle session with no next prompt still reads it; past them its next
// prompt or turn end takes it
const RELEASE_RETRY_MS = 30_000;
const RELEASE_TRIES = 5;
export function armRelease(
    $: EngineInterface,
    view: ViewDoors,
    ms: number,
    tries = 0,
) {
    $.clock.after(ms, () =>
        releaseIfIdle($, view).catch((err) => {
            $.ui.log(
                `x-mod-stash: a held message was not released: ${errorText(err)}`,
            );
            if (tries < RELEASE_TRIES)
                armRelease($, view, RELEASE_RETRY_MS, tries + 1);
        }),
    );
}
// a compact's own messages wait for the release; quiet comms' alone never block a hold
export async function steersOnCompact($: EngineInterface) {
    const keys = await heldKeys($);
    if (!keys) return;
    await quietLocked(async () => {
        const kept = await heldStore($, keys);
        if (kept.messages.some((m) => !m.isQuiet))
            await saveHeld($, keys, { ...kept, isCompacted: true });
    });
}
