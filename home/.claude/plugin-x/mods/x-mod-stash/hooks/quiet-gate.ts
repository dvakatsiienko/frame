// 🤫 quiet comms' gate (FRM-662): both sides of a ping to clio — the sender's SendMessage start and end, the hold in
// clio's thread until her next prompt or idle, its release, the asked and answered marks; held messages go through held.ts

import type { Args, EngineInterface, Next } from 'claude-code';

import type { QuietLogLine, QuietPing, StashQuiet } from '../types/stash.d.ts';
import {
    HELD,
    type HeldStore,
    QUIET_HELD,
    heldKeys,
    heldStore,
    heldStuckMs,
    holdAfterQuiet,
    holdSteer,
    isCompactingNow,
    isQuietHome,
    quietHeldOf,
    quietLocked,
    quietPingOf,
    saveHeld,
} from './held.ts';
import type { ViewDoors } from './keep-warm.ts';
import { LANE_OWNER } from './orbit-tool.ts';
import {
    QUIET_HELD_LINE,
    QUIET_NOTICE,
    QUIET_PUSHED,
    QUIET_SLIPSTREAMED,
    bareTo,
    isQuietAnswer,
    isQuietPause,
    isQuietQuestion,
    isQuietRefusal,
    messageKind,
    peerPing,
    quietGlued,
    quietHeldText,
    quietIdleNotices,
    quietKindHeld,
    quietPush,
    quietTag,
    rowOfTo,
} from './quiet.ts';
import {
    LEDGER_EVERY_MS,
    QUIET_ALARMED,
    QUIET_GAP,
    QUIET_PARK_MS,
    QUIET_SENT,
    quietAlarm,
    quietFlushed,
    quietLedger,
    quietLog,
    quietLogAll,
    quietLogKey,
    quietSilentMembers,
} from './quiet-books.ts';
import { settleTask } from './reply-fix.ts';
import { memberOf, registry } from './roster.ts';
import {
    MAIN_ROLE,
    currentId,
    isLaneOwner,
    sessionName,
    threadRecords,
} from './session-identity.ts';
import {
    QUIET_KINDS,
    QUIET_ON,
    partsShown,
    readNumber,
    readSwitch,
} from './settings-store.ts';
import { isTurnBusy, markActive } from './turn.ts';
import { bare, errorText, memberKey, text } from './util.ts';

// mobile mode: mods draw nothing on the phone, so the session prints the open asks as the asks fence instead
const MOBILE = { key: 'mobile', plugin: 'x-mod-stash' } as const;

// the running turn, so a mid-turn reload still knows it is busy
const TURN = { key: 'turn', plugin: 'x-mod-stash' } as const;

// the members clio asked a question, by session id, and when: the first message back inside QUIET_REPLY_MS pushes
const QUIET_ASKED = 'quiet-asked';
export const SEND_TOOL = 'SendMessage';
export async function quietKindsOff($: EngineInterface) {
    const off: string[] = [];
    for (const { kind, name } of QUIET_KINDS)
        if (!(await readSwitch($, name))) off.push(kind);
    return off;
}
// why a message starts a turn; first, a push spends the slot too
export async function quietWhy($: EngineInterface, from: string, body: string) {
    // a notice with no report says nothing, so it answers nothing: the member's real answer keeps the slot
    const isAnswer =
        body !== '' && (await quietAnswered($, from, quietTag(body)));
    const why: QuietLogLine['why'] =
        quietPush(body, await quietKindsOff($)) ??
        (isAnswer ? 'answer' : undefined);
    return why;
}
// what the next prompt carries, the list emptied; a list that would not empty waits, or it rides every prompt
export async function quietTake($: EngineInterface): Promise<StashQuiet> {
    const quiet = await quietOf($);
    if (!quiet.held.length) return quiet;
    if (!(await saveQuiet($, { ...quiet, held: [] }))) return { held: [] };
    await quietFlushed($, quiet.held).catch(() => undefined);
    return quiet;
}
// quiet comms' share of the one held store (FRM-583); the store is the list's truth, never a `$.state` read, since every
// read of one dispatch sees one moment
export async function quietOf($: EngineInterface): Promise<StashQuiet> {
    const keys = await heldKeys($);
    if (!keys) return { held: [] };
    const { messages } = await heldStore($, keys);
    return { held: messages.filter((m) => m.isQuiet).map(quietPingOf) };
}
// true once the held list is in the store; the store's other messages stay as they are
export async function saveQuiet($: EngineInterface, q: StashQuiet) {
    const keys = await heldKeys($);
    if (!keys) return false;
    const kept = await heldStore($, keys);
    return saveHeld($, keys, {
        ...kept,
        messages: [
            ...kept.messages.filter((m) => !m.isQuiet),
            ...q.held.map(quietHeldOf),
        ].sort((a, b) => a.at - b.at),
    });
}
export const quietNote = (held: QuietPing[]) =>
    [
        `🤫 quiet comms: ${held.length} held member ping${held.length === 1 ? '' : 's'}; read them, act only if one changes the plan, never relay them to dima.`,
        ...held.map(
            (p) =>
                `- ${new Date(p.at).toTimeString().slice(0, 5)} ${p.from} (${messageKind(p.text, p.tag)}): ${p.text}`,
        ),
    ].join('\n');
// another session's quiet comms pings, for its row: the one store under its id, the name's and the older one's before it
export async function quietPingsOf(
    $: EngineInterface,
    name: string,
    sid: string,
) {
    const stores = (await Promise.all(
        [HELD + sid, ...(name ? [HELD + bare(name)] : [])].map((key) =>
            $.store.get(key).catch(() => undefined),
        ),
    )) as (Partial<HeldStore> | undefined)[];
    const held = stores
        .flatMap((s) => s?.messages ?? [])
        .filter((m) => m.isQuiet);
    return held.length
        ? held.map(quietPingOf)
        : await $.store.get(QUIET_HELD + sid).catch(() => undefined);
}
// the held pings a session published, for its row; anything else reads as none
export const heldOf = (v: unknown): QuietPing[] | undefined =>
    Array.isArray(v) && v.length
        ? v.filter(
              (p): p is QuietPing =>
                  p?.tag !== QUIET_NOTICE &&
                  typeof p?.at === 'number' &&
                  typeof p?.from === 'string' &&
                  typeof p?.text === 'string',
          )
        : undefined;
// a glued message the parser could not read lets its prompt in whole: the ledger still hears of it
async function quietUnread($: EngineInterface, blocks: string[]) {
    if (!(await isQuietHome($))) return;
    const isOn = await readSwitch($, 'quiet').catch(() => true);
    const at = await $.clock.now();
    const members = await registry($);
    await quietLogAll(
        $,
        blocks.map((block) => {
            const { deliveryTest, from, tag } = peerPing(block);
            const sid = memberOf(members, from)?.base.sid;
            return {
                arm: isOn ? ('on' as const) : ('off' as const),
                ...(sid ? { sid } : {}),
                at,
                from,
                startedTurn: false,
                tag,
                verdict: 'failed-open' as const,
                ...(deliveryTest ? { deliveryTest } : {}),
            };
        }),
    );
}
// the desktop's one prompt in clio's thread, its «finished a turn» notes and glued member messages, or the engine's meta idle
// notices: each held or pushed by its own words. answers the drop's reason,
// empty since a reason draws as a blocked prompt (dima's tick, a probe), or the text left once the held blocks are out;
// undefined lets the prompt in as it came
export async function quietHoldPrompt(
    $: EngineInterface,
    prompt: string,
    isEngineNotice: boolean,
) {
    const glued = isEngineNotice
        ? quietIdleNotices(prompt)
        : quietGlued(prompt);
    if (!glued) return undefined;
    if (glued.unread) {
        await quietUnread($, [
            ...glued.messages.map((m) => m.block),
            ...glued.unread,
        ]);
        return undefined;
    }
    // messages first: an answer takes the slot before its sender's note can
    const items = [
        ...glued.messages.map(({ block, head }) => {
            const { body, deliveryTest, from, tag } = peerPing(block);
            const marks = deliveryTest ? { deliveryTest } : {};
            return {
                body,
                from,
                head,
                isTagged: true,
                kind: tag,
                marks,
                tag,
                text: quietHeldText(body),
            };
        }),
        // a report opening a tag with its kind switched off waits with its words, its log line still a note's
        ...glued.notes.map(({ body, from, head }) => {
            const kind = quietTag(body);
            return {
                body,
                from,
                head,
                isTagged: kind !== 'none' && kind !== 'progress',
                kind,
                marks: {},
                tag: QUIET_NOTICE,
                text: body,
            };
        }),
    ];
    if (!items.length || !(await isQuietHome($))) return undefined;
    const at = await $.clock.now();
    let arm: QuietLogLine['arm'] = 'on';
    try {
        const isOn = await readSwitch($, 'quiet');
        arm = isOn ? 'on' : 'off';
        const isHolding = isOn && (await $.state.get(MOBILE)).value !== true;
        const isBusyNow = await isTurnBusy($);
        const members = await registry($);
        const held: QuietPing[] = [];
        const lines: QuietLogLine[] = [];
        const cut = new Set<number>();
        const judged = [];
        for (const item of items)
            judged.push({
                ...item,
                sid: memberOf(members, item.from)?.base.sid,
                why: await quietWhy($, item.from, item.body),
            });
        // a meta prompt starting a turn takes no rewrite (the engine's isMeta docs): all of it holds, or none
        const canCut = !isEngineNotice || judged.every((j) => !j.why);
        for (const {
            from,
            head,
            isTagged,
            kind,
            marks,
            sid,
            tag,
            text,
            why,
        } of judged) {
            const line = {
                arm,
                at,
                from,
                tag,
                ...(sid ? { sid } : {}),
                ...marks,
            };
            // a turn-end note is logged and goes no further, in every mode the switch is on: nobody acted on 10 of 13 in an hour
            if (!isTagged && tag === QUIET_NOTICE && isOn && canCut && !why) {
                cut.add(head);
                lines.push({ ...line, startedTurn: false, verdict: 'logged' });
            } else if (isHolding && canCut && !why) {
                held.push({ at, from, tag: kind, text, ...marks });
                cut.add(head);
                lines.push({ ...line, startedTurn: false, verdict: 'held' });
            } else
                lines.push({
                    ...line,
                    startedTurn: !isBusyNow,
                    verdict: 'passed',
                    ...(why ? { why } : {}),
                });
        }
        const q = await quietOf($);
        if (held.length) {
            const isSaved = await saveQuiet($, {
                ...q,
                held: [...q.held, ...held],
            });
            if (!isSaved) throw new Error('the held list did not save');
        }
        if (!(await quietLogAll($, lines))) {
            if (held.length) await saveQuiet($, q);
            throw new Error('the log lines did not save');
        }
        const isAllCut = items.every((item) => cut.has(item.head));
        if (glued.silentEvent !== undefined && isOn && canCut)
            cut.add(glued.silentEvent);
        if (!cut.size) return undefined;
        if (isAllCut && !glued.hasOther) return { drop: '' };
        return {
            text: glued.heads
                .filter((_, i) => !cut.has(i))
                .join('')
                .trimStart(),
        };
    } catch (err) {
        await quietLogAll(
            $,
            items.map(({ from, marks, tag }) => ({
                arm,
                at,
                from,
                startedTurn: false,
                tag,
                verdict: 'failed-open' as const,
                ...marks,
            })),
        );
        $.ui.log(
            `x-mod-stash: quiet comms failed open on a glued prompt: ${errorText(err)}`,
        );
        return undefined;
    }
}
type QuietSend =
    | { isOwner: true; isAsking: boolean; isPause: boolean; to: string }
    | { at: number; isAnswer: boolean; isOwner: false; message: string };
// read before the send goes out: clio's gate spends the open answer the moment it lands
export async function quietSendStart(
    $: EngineInterface,
    e: Record<string, unknown>,
): Promise<QuietSend | undefined> {
    const to = text(e.to);
    const message = text(e.message) ?? '';
    if (!to || !(await readSwitch($, 'quiet'))) return undefined;
    if (await isLaneOwner($))
        return {
            isAsking: isQuietQuestion(message),
            isOwner: true,
            isPause: isQuietPause(message),
            to,
        };
    if (!(await isToCoordinator($, to))) return undefined;
    const at = await $.clock.now();
    const name = await sessionName($);
    const asked = name ? (await askedOf($))[memberKey(name)] : undefined;
    const isAnswer =
        asked !== undefined &&
        isQuietAnswer(asked, at) &&
        quietTag(message) !== 'progress';
    return {
        at,
        isAnswer,
        isOwner: false,
        message,
    };
}
// what a finished send adds: clio's question opens its slot; a member reads the line, and a hold reads as a hold
export async function quietSendEnd(
    $: EngineInterface,
    send: QuietSend,
    result: unknown,
): Promise<{ line?: string; held?: Record<string, unknown> }> {
    const answer = result as Record<string, unknown> | undefined;
    if (send.isOwner) {
        if (answer?.success === false) return {};
        await quietLocked(async () => {
            if (send.isAsking) await quietAsked($, send.to);
            if (!send.isPause) await quietSentTo($, send.to);
        });
        return {};
    }
    const isHeld =
        isQuietRefusal(answer?.message) && (await isHeldSince($, send.at));
    // a send that went nowhere joins no turn, so the line would lie
    if (answer?.success === false && !isHeld) return {};
    // the kinds as they stand now, what a gate that ran during the send judged by; one that judges later, a send queued
    // behind her turn, can still read otherwise after a flip
    const kindsOff = await quietKindsOff($);
    const tag = quietTag(send.message);
    const isPush =
        send.isAnswer || quietPush(send.message, kindsOff) !== undefined;
    const line =
        isPush && !isHeld
            ? QUIET_PUSHED
            : kindsOff.includes(tag)
              ? quietKindHeld(tag)
              : QUIET_SLIPSTREAMED;
    return isHeld
        ? { held: { ...answer, message: QUIET_HELD_LINE, success: true }, line }
        : { line };
}
// main clio by the record of the session the `to` names, never by the name it says
export async function isToCoordinator($: EngineInterface, to: string) {
    const sid = rowOfTo(await registry($), to)?.base.sid;
    return (
        sid !== undefined &&
        (await threadRecords($)).find((t) => t.sessionId === sid)?.role ===
            MAIN_ROLE
    );
}
async function askedOf($: EngineInterface) {
    return ((await $.store.get(QUIET_ASKED).catch(() => undefined)) ??
        {}) as Record<string, number>;
}
// clio's side of a send: her question opens that member's one answer, keyed by its name without the mode emoji, the one
// form her write and its answer both reach
async function quietAsked($: EngineInterface, to: string) {
    const now = await $.clock.now();
    const row = rowOfTo(await registry($), to);
    const kept = Object.entries(await askedOf($)).filter(([, at]) =>
        isQuietAnswer(at, now),
    );
    await $.store.set(QUIET_ASKED, {
        ...Object.fromEntries(kept),
        [memberKey(row?.base.name ?? bareTo(to))]: now,
    });
}
async function quietSentTo($: EngineInterface, to: string) {
    const sid = rowOfTo(await registry($), to)?.base.sid;
    if (!sid) return;
    const now = await $.clock.now();
    const was = ((await $.store.get(QUIET_SENT).catch(() => undefined)) ??
        {}) as Record<string, number>;
    await $.store.set(QUIET_SENT, {
        ...Object.fromEntries(
            Object.entries(was).filter(([, at]) => now - at < QUIET_PARK_MS),
        ),
        [sid]: now,
    });
}
// true when this message answers clio's question, and spends the slot; a [progress] neither pushes nor spends it
async function quietAnswered($: EngineInterface, from: string, tag: string) {
    if (tag === 'progress') return false;
    const asked = await askedOf($);
    const key = memberKey(from);
    const at = asked[key];
    if (at === undefined) return false;
    const { [key]: _spent, ...rest } = asked;
    await $.store.set(QUIET_ASKED, rest);
    return isQuietAnswer(at, await $.clock.now());
}
// did clio's gate hold what this session just sent: her log line, at or after the send; the send may cross midnight
async function isHeldSince($: EngineInterface, since: number) {
    const now = await $.clock.now();
    const keys = new Set([quietLogKey(since), quietLogKey(now)]);
    const me = await currentId($);
    const name = await sessionName($);
    for (const key of keys) {
        const lines = ((await $.store.get(key).catch(() => undefined)) ??
            []) as QuietLogLine[];
        const isOurs = lines.some(
            (l) =>
                l.verdict === 'held' &&
                l.tag !== QUIET_NOTICE &&
                l.at >= since &&
                (l.sid
                    ? l.sid === me
                    : name !== undefined &&
                      memberKey(l.from) === memberKey(name)),
        );
        if (isOurs) return true;
    }
    return false;
}
// past the wait, the list is taken under the lock and written outside it: an append never holds up a message, and a
// refused one puts its lines back
async function quietDue($: EngineInterface) {
    const q = await quietOf($);
    if (!q.held.length) return [];
    if ((await $.state.get(TURN).catch(() => undefined))?.value?.isBusy)
        return [];
    // a row appended while the engine compacts lands in the messages it is replacing
    const sid = await currentId($);
    const isWindOn = (await partsShown($))('stash.second-wind');
    if (sid && (await isCompactingNow($, sid, isWindOn))) return [];
    const waitMs = (await readNumber($, 'quietWait')) * 60_000;
    if ((await $.clock.now()) - Math.min(...q.held.map((p) => p.at)) < waitMs)
        return [];
    return (await saveQuiet($, { ...q, held: [] })) ? q.held : [];
}
async function quietPutBack($: EngineInterface, held: QuietPing[]) {
    const q = await quietOf($);
    await saveQuiet($, { ...q, held: [...held, ...q.held] });
}
// held pings past the wait while clio is idle: one hidden row, no turn (probe Q2, 11:46:50)
export async function quietIdle($: EngineInterface) {
    const due = await quietLocked(() => quietDue($));
    if (!due.length) return;
    const appended = await $.session
        .append({
            message: {
                content: [{ text: quietNote(due), type: 'text' }],
                type: 'user',
            },
        })
        .catch(() => undefined);
    if (!appended || 'deny' in appended) {
        await quietLocked(() => quietPutBack($, due));
        return;
    }
    await quietLocked(() => quietFlushed($, due));
}

// the ledger runs once a minute in clio's thread; its gaps sit in the store for her next prompt, and each
// new gap or a held ping stuck past the idle wait + 2 min raises one native alarm
let ledgerAt = 0;
export async function quietBooks($: EngineInterface, view: ViewDoors) {
    if (!(await isQuietHome($))) return;
    const now = await $.clock.now();
    if (now - ledgerAt < LEDGER_EVERY_MS) return;
    ledgerAt = now;
    const gaps = await quietLedger($, now);
    await $.store.set(QUIET_GAP, { at: now, gaps });
    // a member's gap alarms once while it stays open; once it closes, its next gap alarms again
    const raised =
        ((await $.store.get(QUIET_ALARMED)) as string[] | undefined) ?? [];
    const open = new Set(gaps.map((g) => `gap:${g.from}`));
    const kept = raised.filter((k) => !k.startsWith('gap:') || open.has(k));
    if (kept.length !== raised.length) await $.store.set(QUIET_ALARMED, kept);
    for (const g of gaps)
        await quietAlarm(
            $,
            `gap:${g.from}`,
            `${g.from} sent clio ${g.sent}, her quiet log holds ${g.logged}`,
        );
    if (await readSwitch($, 'quiet')) await quietSilentMembers($, now, view);
    const held = heldOf((await quietOf($)).held);
    if (!held) return;
    const oldest = held.reduce((a, b) => (b.at < a.at ? b : a));
    if (now - oldest.at > (await heldStuckMs($)))
        await quietAlarm(
            $,
            `stuck:${oldest.at}`,
            `${held.length} held ping${held.length === 1 ? '' : 's'} stuck ${Math.round((now - oldest.at) / 60_000)} min, oldest from ${oldest.from}`,
        );
}

// a message from outside the turn: a task's notice settles its wait, a steer is held, and in clio's thread quiet
// comms holds a ping that does not push; every delivery is logged, and a broken hold fails open
export async function receiveMessage(
    $: EngineInterface,
    e: Args<'session.receive'>,
    next: Next<'session.receive'>,
    view: ViewDoors,
) {
    await markActive($).catch(() => undefined);
    const kind = e.origin.kind;
    if (kind === 'task-notification' && !e.agentId) {
        await settleTask($, e.text, view).catch(() => undefined);
        return next(e);
    }
    if ((kind !== 'peer' && kind !== 'peer-send-message') || e.agentId)
        return next(e);
    const steer = await holdSteer($, e.text, view).catch((err) => {
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
    const compact = await holdAfterQuiet($, e.text, view).catch((err) => {
        $.ui.log(`x-mod-stash: a steer passed unheld: ${errorText(err)}`);
        return undefined;
    });
    return compact ?? next(e);
}
// the delivery test: a model-free test [progress] ping to clio through the real peer path; its run reads the log by nonce
export async function quietDeliveryTest($: EngineInterface, args: string) {
    const nonce = args.trim() || `c${(await $.clock.now()).toString(36)}`;
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
}
// `/quiet on | off`, bare shows the state
export async function quietCommand($: EngineInterface, args: string) {
    const arg = args.trim();
    if (arg === 'on' || arg === 'off') {
        await $.store.set(QUIET_ON, arg === 'on');
        $.ui.invalidate('ui.render');
        return {
            text: `quiet comms ${arg}: ${arg === 'on' ? "members' messages wait for your next turn unless they push" : 'every member ping passes'}`,
        };
    }
    const isOn = await readSwitch($, 'quiet');
    const kindsOff = isOn ? (await quietKindsOff($)).map((k) => `[${k}]`) : [];
    return {
        text: `quiet comms ${isOn ? 'on' : 'off'}, ${(await quietOf($)).held.length} held${kindsOff.length ? `; ${kindsOff.join(', ')} switched off, held like an untagged line` : ''}; /quiet on | off${arg ? ` («${arg}» is neither)` : ''}`,
    };
}
