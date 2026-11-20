// 🪐 the orbit tool (FRM-662): its description and schema, every op it takes — asks, resolve, follow, assume, plan, glide,
// second wind — and the fleet's one ask counter, minted under its lock

import type { EngineInterface } from 'claude-code';

import { takeJoinLock } from './joins.ts';
import {
    LANE_MAX,
    LANE_ROLES,
    LANE_STEER,
    LANE_STEER_OLD,
    LANE_STEP,
    LANE_TEXT_MAX,
    glideOp,
    mergeLanes,
    readLanes,
    readPlanSteps,
    writeLanes,
} from './lanes.ts';
import {
    ASSUMED_MAX,
    CHANGED_MARK,
    ORBIT_TEXT_MAX,
    PLAN_MAX,
    oneLine,
    orbitOp,
} from './orbit.ts';
import {
    PREFIX,
    currentOrbit,
    dropTicks,
    inMarking,
    saveOrbit,
} from './orbit-store.ts';
import { memberOf, registry } from './roster.ts';
import {
    MAIN_ROLE,
    WING_ROLE,
    currentId,
    runnerOf,
    selfRecord,
    sessionName,
} from './session-identity.ts';
import { keepShelf } from './session-record.ts';
import { partRefusal, readNumber } from './settings-store.ts';
import { addGridQs, markWork, turn } from './turn.ts';
import { STALE_TURNS } from './turn-notes.ts';
import { bare } from './util.ts';
import { windReady } from './wind-run.ts';

// the running turn, so a mid-turn reload still knows it is busy
const TURN = { key: 'turn', plugin: 'x-mod-stash' } as const;

export const LANE_OWNER = '🦉 clio';
export const LANE_STALE = 8;
const TICKET_ID_ALL = /(?<!\[)\b(?:FRM|BYT)-\d+\b(?!\])/g;
// the how-to rules sit here, the tool's own text, so they load with the mod and leave with it (FRM-640; `rules/fleet-mods.md`
// keeps only what holds with the mod off). a rule line never starts with «op »: a test reads the op lines' order.
// when: dima, PK-439:W4, W13 (his tick slipstreams into a running turn). who: dima, 2026-11-11: «he should ask its
// coordinator, and if needed the coordinator asks me». guard: `x-mod-guard/FTR.md`
export const ORBIT_ABOUT = [
    'orbit: your asks to dima on the fleet board; an ask goes here, never into a reply. 🛎️ tick = pick good to go, 🔁 replay = another round, plus his steer; marked asks reach you model-only; an unmarked ask means nothing yet. a --bg session has no board: its asks go to its coordinator.',
    "when: an ask goes up as soon as it is known: his tick slipstreams into a running turn, so one known at the turn's start is posted before the work, one born mid-turn the moment it is born, and the turn goes on with what does not hang on it; a recommendation, calm, never a rush, but never saved for the turn's end.",
    "who: a member's ask goes to its coordinator first, in its ping; the coordinator answers it or brings it to dima's orbit, so a member never asks dima directly.",
    'a pick names its whole outcome, so a tick needs no follow-up: a rename carries the new name («breather → breathing bars»), a choice its option, never the verb alone. a reply names an ask by its subject in plain words; its oN id stays on the board, never in the reply. another round is a follow, never a second add.',
    'guard: a command x-mod-guard refuses, or would: the first ask names its target in plain words in the text, the pick quotes it whole in one backtick span, any length, never in words, and his one tick runs exactly that once within 2 h.',
    `op add, asks [{ text, pick, hiddenNote, link }]: text one line ≤${ORBIT_TEXT_MAX} chars, subject first, readable alone (no «above», «this»); pick: your recommendation; hiddenNote: yours alone, its source and what a tick means; link: one https url, obsidian:// url or file path (spaces allowed) he opens in a click. irreversible (trash, push, close, merge) → lead with ⚠️, name the exact target.`,
    'op resolve, ids, words { id: closing word }: the asks answered this turn; they leave at its end, a worded one dim a turn more. ticked: «as ticked», or «changed: <what>» plus a follow or add.',
    'ops [{ op, … }]: several ops in one call, a result line each.',
    `op follow, id, text, pick: another round on an answered ask, same id and place, text ≤${ORBIT_TEXT_MAX} chars, marked ${CHANGED_MARK}.`,
    `op assume, texts: ≤${ASSUMED_MAX} a turn, ≤${ORBIT_TEXT_MAX} chars: unasked choices a wrong guess would cost a redo on, never routine; 🛎️ clears, ↩️ sends back with his steer.`,
    `op plan, lines: your next ${PLAN_MAX} moves, each ≤${ORBIT_TEXT_MAX} chars and readable alone; set at each turn end; untouched ${STALE_TURNS} turns reads stale. step: your lane step.`,
    `op glide (${LANE_OWNER}, or a wing on a card it created): act create, title, items [{ text, ticket, done }] or plan (path to the lane-plan.md: its «- [ ] NN · FRM-N text» lines are the steps, each with its ticket id, any count, a tick there moves the card, a hand step is refused): a lane's scope as 1–${LANE_MAX} plain steps ≤${LANE_TEXT_MAX} chars, no paths, op names or pr numbers; ticket optional; the result names the lane id. act link, id, session, role (codie or sixth-sense): a member's session id; a re-link of a role replaces the old one. act edit, id, title?, items?: the card refreshed in place, a kept step text keeps its done flag. act step, id, current: the step we are on, every step before it done; current = the count finishes it. act end, id: at the siesta or the halt after it finished. nothing moved for ${LANE_STALE} of your turns reads stale.`,
].join('\n');
// the orbit tool's arguments; an `ops` item takes the same ones, since the engine drops any argument a schema does not name
export const ORBIT_PROPS = {
    act: {
        enum: ['create', 'edit', 'link', 'step', 'end'],
        type: 'string',
    },
    asks: {
        items: {
            properties: {
                hiddenNote: { type: 'string' },
                link: { type: 'string' },
                pick: { type: 'string' },
                text: { type: 'string' },
            },
            required: ['text', 'pick'],
            type: 'object',
        },
        type: 'array',
    },
    current: { type: 'number' },
    id: { type: 'string' },
    ids: { items: { type: 'string' }, type: 'array' },
    items: {
        items: {
            properties: {
                done: { type: 'boolean' },
                text: { type: 'string' },
                ticket: { type: 'string' },
            },
            required: ['text'],
            type: 'object',
        },
        type: 'array',
    },
    lines: { items: { type: 'string' }, type: 'array' },
    op: {
        enum: [
            'add',
            'assume',
            'resolve',
            'follow',
            'plan',
            'glide',
            'second-wind',
        ],
        type: 'string',
    },
    pending: { type: 'string' },
    pick: { type: 'string' },
    plan: { type: 'string' },
    role: { enum: [...LANE_ROLES], type: 'string' },
    session: { type: 'string' },
    slug: { type: 'string' },
    step: { type: 'number' },
    text: { type: 'string' },
    texts: { items: { type: 'string' }, type: 'array' },
    title: { type: 'string' },
    words: {
        additionalProperties: { type: 'string' },
        type: 'object',
    },
} as const;
// what each ticket a prompt names is, read through `x linear`, so the session starts with it instead of looking it up;
// x down or an unknown id adds nothing (dima's o14, 23:07)
export async function ticketNote($: EngineInterface, text: string) {
    const ids = [...new Set(text.match(TICKET_ID_ALL) ?? [])];
    if (!ids.length) return undefined;
    const r = await $.process
        .run([
            `${await $.env.get('HOME')}/.local/bin/x`,
            'linear',
            'read',
            ...ids,
        ])
        .catch(() => undefined);
    if (r?.exitCode !== 0) return undefined;
    try {
        const tickets =
            (
                JSON.parse(r.stdout) as {
                    data?: {
                        tickets?: {
                            id?: string;
                            title?: string;
                            state?: string;
                            url?: string;
                        }[];
                    };
                }
            ).data?.tickets ?? [];
        const lines = tickets.flatMap((x) =>
            x.id && x.url
                ? [`${x.id}: ${x.title ?? ''} · ${x.state ?? ''} · ${x.url}`]
                : [],
        );
        return lines.length
            ? `the tickets this prompt names, read from linear:\n${lines.join('\n')}`
            : undefined;
    } catch {
        return undefined;
    }
}
// FRM-649 (FRM-616:W10): one ask counter for the fleet, `ask-counter` in $.store, read and bumped under a lock dir beside
// the shelf (the joins' rule: no compare-and-swap exists); with no live session's `asks:` key no thread holds an open ask,
// so the count starts at 1 again, past any id this thread still draws. `publish` saves the asks before the lock frees, or
// a thread taking it next reads no `asks:` key and mints the same o1 again. undefined: the lock stayed held; a host that
// runs no process (a test world) mints unlocked
const ASK_COUNTER = 'ask-counter';
async function mintAsks<T>(
    $: EngineInterface,
    count: number,
    drawn: string[],
    publish: (first: number) => Promise<T>,
) {
    const home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
    const lock = `${home}/.claude/shelf/ask-counter.lock`;
    let isLocked = true;
    for (let tries = 0; ; tries++) {
        const took = await takeJoinLock($, lock).catch(() => undefined);
        if (took === undefined) {
            isLocked = false;
            break;
        }
        if (took) break;
        if (tries === 20) return undefined;
        // a process sleep spends none of the hook's 10 s budget, where $.clock.sleep would (engine.md)
        await $.process.run(['sleep', '0.1']);
    }
    try {
        // a gone session's key outlives it (only its own save deletes it): only a live one holds; a registry that will
        // not read, or lists no session at all, holds on any key, the side that never mints a taken id
        const live = await registry($)
            .then((rs) =>
                rs.length
                    ? new Set(
                          rs.filter((r) => r.isAlive).map((r) => r.base.sid),
                      )
                    : undefined,
            )
            .catch(() => undefined);
        const self = await currentId($);
        const isHeld = (await $.store.keys()).some((k) => {
            const sid = k.slice(PREFIX.length);
            return (
                k.startsWith(PREFIX) && (!live || sid === self || live.has(sid))
            );
        });
        const kept = (await $.store.get(ASK_COUNTER).catch(() => undefined)) as
            | { next?: unknown }
            | undefined;
        let next = isHeld && typeof kept?.next === 'number' ? kept.next : 1;
        while (
            Array.from({ length: count }, (_, i) => `o${next + i}`).some((id) =>
                drawn.includes(id),
            )
        )
            next++;
        await $.store.set(ASK_COUNTER, { next: next + count });
        return await publish(next);
    } finally {
        if (isLocked) await $.process.run(['rmdir', lock]);
    }
}
// one orbit op, as the tool takes it alone or as one item of `ops`
export async function orbitCall(
    $: EngineInterface,
    input: Record<string, unknown>,
    isAmended: boolean,
): Promise<{ result: string } | { deny: string }> {
    const hidden = await partRefusal($, input.op);
    if (hidden) return { deny: hidden };
    if (input.op === 'second-wind') {
        const r = await windReady($, input);
        return 'deny' in r ? r : { result: r.result };
    }
    if (input.op === 'glide') {
        // main clio or a wing by its record; a wing's cards carry its display, drawn from that record
        const self = await selfRecord($);
        const isOwner = self?.role === MAIN_ROLE;
        const side = self?.role === WING_ROLE ? runnerOf(self) : undefined;
        if (!isOwner && !side)
            return {
                deny: `orbit glide: only ${LANE_OWNER} writes the lanes; every board shows them`,
            };
        const before = await readLanes($);
        if (side && input.act !== 'create') {
            const card = before.find((l) => l.id === oneLine(input.id));
            if (card && bare(card.runner ?? '') !== bare(side))
                return {
                    deny: `orbit glide: lane ${card.id} is not this wing's; it writes only a card it created, ${LANE_OWNER} the rest`,
                };
        }
        // a link keeps the member's registry name, so the card finds its asks after a /clear or by a desktop id, and the
        // session id that name resolved to, so a rename after the link keeps the member (FRM-605)
        const linkTo =
            input.act === 'link' && typeof input.session === 'string'
                ? memberOf(await registry($), input.session.trim())?.base
                : undefined;
        // a create that names its lane plan takes its first steps from that file, so the card is never drawn from a guess
        let given = linkTo
            ? { ...input, linkedId: linkTo.sid, session: linkTo.name }
            : input;
        if (
            (input.act === 'create' || input.act === 'edit') &&
            typeof input.plan === 'string'
        ) {
            if (!/^(?:\/|~\/)/.test(input.plan))
                return {
                    deny: 'orbit glide: plan is an absolute or ~/ path to the lane plan file',
                };
            const home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
            const read = await readPlanSteps(
                $,
                input.plan.replace(/^~(?=\/)/, home),
            );
            if ('state' in read)
                return {
                    deny:
                        read.state === 'gone'
                            ? `orbit glide: plan file ${input.plan} cannot be read`
                            : `orbit glide: x lane plan-steps could not read ${input.plan}; run it by hand to see why`,
                };
            const steps = read.steps.map((s) => ({
                done: s.done,
                text: [...s.text].slice(0, LANE_TEXT_MAX).join(''),
                ...(s.ticket ? { ticket: s.ticket } : {}),
            }));
            if (!steps.length)
                return {
                    deny: `orbit glide: ${input.plan} holds no numbered step line («- [ ] 01 · FRM-1 text»)`,
                };
            const unticketed = steps.find((s) => !s.ticket);
            if (unticketed)
                return {
                    deny: `orbit glide: ${input.plan} has a step with no ticket id, «${unticketed.text}»: every line reads «- [ ] NN · FRM-N text»`,
                };
            if (input.act === 'create')
                given = { ...given, items: steps, planHome: home };
            else if (
                before
                    .find((l) => l.id === oneLine(input.id))
                    ?.plan?.replace(/^~(?=\/)/, home) !==
                input.plan.replace(/^~(?=\/)/, home)
            )
                return {
                    deny: `orbit glide: edit cannot link a plan; lane ${oneLine(input.id)} takes one at create`,
                };
        }
        const op = glideOp(
            before,
            given,
            (await currentOrbit($)).turns,
            await $.clock.now(),
        );
        if ('deny' in op) return { deny: op.deny };
        const known = new Set(before.map((l) => l.id));
        const lanes = side
            ? op.lanes.map((l) =>
                  known.has(l.id) ? l : { ...l, runner: side },
              )
            : op.lanes;
        // a steer was about the step it sat on: it drops when the lane's current step is another one — by its text, so
        // an edit that only moves the step keeps dima's steer
        const was = new Map(
            before.map((l) => [l.id, l.items[l.current]?.text]),
        );
        for (const l of op.lanes)
            if (was.has(l.id) && was.get(l.id) !== l.items[l.current]?.text) {
                await $.store.delete(LANE_STEER + l.id);
                await $.store
                    .delete(LANE_STEER_OLD + l.id)
                    .catch(() => undefined);
            }
        await writeLanes($, mergeLanes(before, lanes, await readLanes($)));
        markWork();
        return { result: op.result };
    }
    // the turn as $.state holds it: a call that lands before a mid-turn reload's start reads a default isBusy
    const isTurn = (await $.state.get(TURN)).value?.isBusy ?? turn.isBusy;
    const step = input.step;
    const isPlan = input.op === 'plan';
    if (
        isPlan &&
        step !== undefined &&
        !(Number.isInteger(step) && (step as number) >= 0)
    )
        return {
            deny: 'orbit plan: step is your lane step now, a whole number from 0, as your brief numbers it',
        };
    const lines = await readNumber($, 'lines');
    const asked =
        input.op === 'add' && Array.isArray(input.asks) ? input.asks.length : 0;
    const op = await inMarking(async () => {
        const current = await currentOrbit($);
        const apply = async (first: number) => {
            const made = orbitOp(
                { ...current, next: first },
                input,
                isTurn,
                lines,
                isAmended,
            );
            if ('deny' in made) return made;
            if (asked) made.orbit = { ...made.orbit, next: current.next };
            await saveOrbit($, made.orbit, () => keepShelf($));
            // a follow asks a new question: his tick on the old one is no longer his word on it (S3); one step with the
            // save, so a press lands wholly before both or after both
            if (input.op === 'follow') await dropTicks($, oneLine(input.id));
            return made;
        };
        if (!asked) return apply(current.next);
        // an add's ids come from the fleet's one counter; the thread's own `next` keeps counting its assumptions
        return (
            (await mintAsks(
                $,
                asked,
                current.asks.map((a) => a.id),
                apply,
            )) ?? {
                deny: 'orbit add: the ask counter is held by another thread past 2 s; add the ask again in a moment',
            }
        );
    });
    if ('deny' in op) return { deny: op.deny };
    if (input.op === 'add')
        addGridQs(
            ...(Array.isArray(input.asks) ? input.asks : []).flatMap((x) => {
                const n = oneLine((x as { text?: unknown })?.text).match(
                    /^Q(\d+)\b/,
                )?.[1];
                return n ? [n] : [];
            }),
        );
    const name = isPlan && step !== undefined && (await sessionName($));
    if (name)
        await $.store.set(LANE_STEP + bare(name), {
            at: await $.clock.now(),
            step,
        });
    return { result: op.result };
}

export async function registerOrbitTool($: EngineInterface) {
    await $.tool
        .register({
            description: ORBIT_ABOUT,
            inputSchema: {
                properties: {
                    ...ORBIT_PROPS,
                    ops: {
                        items: { properties: ORBIT_PROPS, type: 'object' },
                        type: 'array',
                    },
                },
                type: 'object',
            },
            // loaded up front: behind ToolSearch a session met «add your asks to orbit» with no schema to call
            isDeferred: false,
            name: 'orbit',
        })
        .catch(() =>
            $.ui.log('x-mod-stash: the orbit tool was not registered'),
        );
}

// one orbit call, its ops in order: a batch lands when one op does, each op's line in the answer
export async function orbitToolCall(
    $: EngineInterface,
    input: Record<string, unknown>,
): Promise<{ result: string } | { deny: string }> {
    const ops = Array.isArray(input.ops)
        ? input.ops.filter(
              (x): x is Record<string, unknown> =>
                  typeof x === 'object' && x !== null,
          )
        : [input];
    if (!ops.length) return { deny: 'orbit: ops needs one { op, … } or more' };
    // a «changed:» resolve needs a follow or an add that lands: each is tried on the orbit as it stands, op is pure
    const was = await currentOrbit($);
    const isAmended = ops.some(
        (x) =>
            (x.op === 'follow' || x.op === 'add') &&
            !('deny' in orbitOp(was, x, true)),
    );
    if (ops.length === 1)
        return orbitCall($, ops[0] as Record<string, unknown>, isAmended);
    const lines: string[] = [];
    let landed = 0;
    for (const [i, x] of ops.entries()) {
        const r = await orbitCall($, x, isAmended);
        if ('deny' in r)
            lines.push(`${i + 1} ${String(x.op)}: refused — ${r.deny}`);
        else {
            landed++;
            lines.push(`${i + 1} ${String(x.op)}: ${r.result}`);
        }
    }
    const text = lines.join('\n');
    return landed ? { result: text } : { deny: text };
}
