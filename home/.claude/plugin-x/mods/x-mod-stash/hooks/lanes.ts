// 🛼 glide (FRM-385): the fleet's lane store, `~/.claude/shelf/lanes.json`, its one writer clio's lane op, and its draw prep:
// the cards each board's state holds, the steers dima types on them, a linked codie's or plan file's step moving its card

import type { EngineInterface } from 'claude-code';

import type {
    LaneItem,
    LaneRole,
    PublishedAsk,
    StashEntry,
    StashLane,
} from '../types/stash.d.ts';
import { steered } from './orbit.ts';
import { PREFIX, currentOrbit } from './orbit-store.ts';
import { type Registered, laneMemberRow, registry } from './roster.ts';
import {
    MAIN_ROLE,
    type ThreadRecord,
    WING_ROLE,
    identity,
    isLaneOwner,
    runnerOf,
    selfRecord,
    successorOf,
    threadRecords,
} from './session-identity.ts';
import { partsShown } from './settings-store.ts';
import {
    bare,
    errorText,
    expandHome,
    oneLine,
    serial,
    writeWhole,
} from './util.ts';
import { xRead } from './x-cli.ts';

type Entry = StashEntry;

const LANES = { key: 'lanes', plugin: 'x-mod-stash' } as const;
const LANE_ASKS = { key: 'laneAsks', plugin: 'x-mod-stash' } as const;
// 🛼 a member's lane step from its plan op, one key per registry name, written only by that session (todo 6)
export const LANE_STEP = 'lane-step:';
// the moves clio's stash made from codie's step, held for her next tool call or prompt
const LANE_MOVES = 'lane-moves';
// dima's steer on a lane's current step and its 🛎️ tick, one store key per lane: any board writes it, so the shelf file
// keeps its one writer, clio's lane op
export const LANE_STEER = 'lane-steer:';
// the retired glide reorder's store key (o84, dropped by o138): clio's stash deletes any left behind
const LANE_ORDER = 'lane-order:';
// a lane steer typed before the rename sits under the old prefix: read as a steer, retired at its next write
export const LANE_STEER_OLD = 'lane-note:';
export const LANE_ROLES = ['codie', 'sixth-sense'] as const;
// read-both: lanes linked before the 10-29 rename keep the old role keys; both words resolve
const LANE_ROLE_OLD: Readonly<Record<string, (typeof LANE_ROLES)[number]>> = {
    coder: 'codie', // read-both
    verifier: 'sixth-sense', // read-both
};
export const LANE_MAX = 7;
export const LANE_TEXT_MAX = 60;
const LANE_TICKET = /^[A-Z]{2,5}-\d+$/;

// the lane ops on the fleet's lanes: validate, then keep each pointer honest — every step before it done, never on a done one
export function glideOp(
    lanes: StashLane[],
    input: Record<string, unknown>,
    turns: number,
    now: number,
): { lanes: StashLane[]; result: string } | { deny: string } {
    const act = input.act;
    if (act === 'create') return laneCreate(lanes, input, turns, now);
    const id = oneLine(input.id);
    const lane = lanes.find((l) => l.id === id && !l.endedAt);
    if (act !== 'link' && act !== 'step' && act !== 'end' && act !== 'edit')
        return { deny: 'orbit glide: act is create, edit, link, step or end' };
    if (!lane)
        return {
            deny: `orbit glide: no live lane «${id}»; live: ${
                lanes
                    .filter((l) => !l.endedAt)
                    .map((l) => l.id)
                    .join(', ') || 'none'
            }`,
        };
    const done = lane.items.filter((x) => x.isDone).length;
    const put = (next: StashLane, result: string) => ({
        lanes: lanes.map((l) => (l.id === lane.id ? next : l)),
        result,
    });
    if (act === 'end')
        return put(
            {
                ...lane,
                endedAt: now,
                history: [
                    ...lane.history,
                    { act, at: now, current: lane.current, done },
                ],
            },
            `lane ${lane.id} «${lane.title}» ended`,
        );
    // a card refreshed in place: the id, members and history stay; a step whose text survives keeps its done flag, and
    // the pointer lands on the first step not done (clio's ask, 18:01: ending and re-creating lost all three)
    if (act === 'edit') {
        if (lane.plan && input.items !== undefined)
            return {
                deny: `orbit glide: lane ${lane.id} follows ${lane.plan}; its steps are that file's lines, edit them there`,
            };
        const title = oneLine(input.title) || lane.title;
        const fresh =
            input.items === undefined ? lane.items : laneItems(input.items);
        if (!Array.isArray(fresh)) return fresh;
        const wasDone = new Set(
            lane.items.filter((x) => x.isDone).map((x) => x.text),
        );
        const stepped = pointed(
            fresh.map((x) => ({
                ...x,
                isDone: x.isDone || wasDone.has(x.text),
            })),
            0,
        );
        return put(
            {
                ...lane,
                current: stepped.current,
                history: [
                    ...lane.history,
                    {
                        act,
                        at: now,
                        current: stepped.current,
                        done: stepped.done,
                    },
                ],
                items: stepped.items,
                movedAt: turns,
                ticket: titleTicket(title),
                title,
            },
            laneSummary(lane.id, title, stepped),
        );
    }
    if (act === 'link') {
        const session = oneLine(input.session);
        const role = LANE_ROLE_OLD[input.role as string] ?? input.role;
        if (!session)
            return { deny: 'orbit glide: link names the member session id' };
        if (role !== 'codie' && role !== 'sixth-sense')
            return { deny: 'orbit glide: role is codie or sixth-sense' };
        const linked = oneLine(input.linkedId) || session;
        // a rename re-links the same session under its new name: no new member
        const isNew = lane.linkedIds?.[role] !== linked;
        return put(
            {
                ...lane,
                history: isNew
                    ? [
                          ...lane.history,
                          {
                              act: `link ${role}`,
                              at: now,
                              current: lane.current,
                              done,
                          },
                      ]
                    : lane.history,
                linkedIds: { ...lane.linkedIds, [role]: linked },
                members: { ...lane.members, [role]: session },
            },
            `lane ${lane.id}: ${role} is ${session}`,
        );
    }
    if (lane.plan)
        return {
            deny: `orbit glide: lane ${lane.id} follows ${lane.plan}; tick the step there, a hand step is refused`,
        };
    const at = input.current;
    if (
        typeof at !== 'number' ||
        !Number.isInteger(at) ||
        at < 0 ||
        at > lane.items.length
    )
        return {
            deny: `orbit glide: current is a step from 0 to ${lane.items.length}`,
        };
    // a step back reopens the steps from the pointer on, or pointed skips forward over them again
    const stepped = pointed(
        at < lane.current
            ? lane.items.map((x, i) => (i >= at ? { ...x, isDone: false } : x))
            : lane.items,
        at,
    );
    const isMoved = stepped.current !== lane.current || stepped.done !== done;
    return put(
        {
            ...lane,
            current: stepped.current,
            history: isMoved
                ? [
                      ...lane.history,
                      {
                          act,
                          at: now,
                          current: stepped.current,
                          done: stepped.done,
                      },
                  ]
                : lane.history,
            items: stepped.items,
            movedAt: isMoved ? turns : lane.movedAt,
        },
        laneSummary(lane.id, lane.title, stepped),
    );
}

function laneCreate(
    lanes: StashLane[],
    input: Record<string, unknown>,
    turns: number,
    now: number,
): { lanes: StashLane[]; result: string } | { deny: string } {
    const title = oneLine(input.title);
    if (!title) return { deny: 'orbit glide: a title names the lane' };
    const plan = oneLine(input.plan);
    const expanded = (path: string | undefined) =>
        expandHome(path, oneLine(input.planHome));
    // the same lane is the same topic or the same lane plan file, whatever the title says
    const open = lanes.find(
        (l) =>
            !l.endedAt &&
            (laneTopic(l.title) === laneTopic(title) ||
                (!!plan && expanded(l.plan) === expanded(plan))),
    );
    if (open)
        return {
            deny: `orbit glide: lane ${open.id} «${open.title}» is live: step it (glide step ${open.id}) or edit it (glide edit ${open.id}); end it (glide end ${open.id}) only when the lane is over`,
        };
    if (plan && !/^(?:\/|~\/)/.test(plan))
        return {
            deny: 'orbit glide: plan is an absolute or ~/ path to the lane plan file',
        };
    // a lane plan file holds any number of steps: the card windows what it draws
    const items = laneItems(input.items, plan ? Infinity : LANE_MAX);
    if (!Array.isArray(items)) return items;
    const id = `l${1 + Math.max(0, ...lanes.map((l) => Number(l.id.slice(1)) || 0))}`;
    const stepped = pointed(items, 0);
    const lane: StashLane = {
        current: stepped.current,
        history: [
            {
                act: 'create',
                at: now,
                current: stepped.current,
                done: stepped.done,
            },
        ],
        id,
        items: stepped.items,
        members: {},
        movedAt: turns,
        ...(plan ? { plan } : {}),
        ticket: titleTicket(title),
        title,
    };
    return {
        lanes: [...lanes, lane],
        result: laneSummary(id, title, stepped),
    };
}

// the ticket a card's title runs, «mods — FRM-555 …», kept beside it so herdr's deck links it with no parse
const titleTicket = (title: string) => /^.*? — ([A-Z]+-\d+) /.exec(title)?.[1];
// one topic, one open lane: the topic is the title before « — », « | » or «:», case-blind; a finished lane counts until ended
const laneTopic = (title: string) =>
    (title.split(/ — | \| |:/)[0] ?? '').trim().toLowerCase();

type LaneStep = { at: number; step: number };

// a linked codie's plan step moves its lane forward: a step ahead of the pointer and newer than the lane's last move,
// never the finish, which stays clio's act; her own step back holds until codie names a step again (todo 6)
export async function followCodies($: EngineInterface) {
    if (!(await isLaneOwner($)) || !(await partsShown($))('stash.glide'))
        return;
    const lanes = await readLanes($);
    const now = await $.clock.now();
    const turns = (await currentOrbit($)).turns;
    const moves: string[] = [];
    const steersDone: string[] = [];
    const next: StashLane[] = [];
    for (const lane of lanes) {
        const codie = lane.members.codie;
        const m =
            lane.endedAt || lane.plan || !codie
                ? undefined
                : ((await $.store
                      .get(LANE_STEP + bare(codie))
                      .catch(() => undefined)) as LaneStep | undefined);
        if (
            !m ||
            m.at <= (lane.history.at(-1)?.at ?? 0) ||
            m.step <= lane.current ||
            m.step >= lane.items.length
        ) {
            next.push(lane);
            continue;
        }
        const stepped = pointed(lane.items, m.step);
        next.push({
            ...lane,
            current: stepped.current,
            history: [
                ...lane.history,
                {
                    act: 'step',
                    at: now,
                    by: codie,
                    current: stepped.current,
                    done: stepped.done,
                },
            ],
            items: stepped.items,
            movedAt: turns,
        });
        steersDone.push(lane.id);
        moves.push(
            `lane ${lane.id} «${lane.title}» moved to step ${stepped.current} by ${codie}`,
        );
    }
    if (!moves.length) return;
    if (await changeLanes($, lanes, next)) return;
    for (const id of steersDone)
        await $.store.delete(LANE_STEER + id).catch(() => undefined);
    await $.store.set(LANE_MOVES, [...(await heldLaneMoves($)), ...moves]);
}

// one rule, one reader (FRM-570): x parses a lane plan's step lines; x runs only when the file's mtime moved since its
// last parse, from home so the shim runs main's x. gone: no such file; stale: x failed, the caller keeps its last steps
type PlanSteps = {
    done: boolean;
    held?: boolean;
    text: string;
    ticket?: string;
}[];
type PlanRead = { steps: PlanSteps } | { state: 'gone' | 'stale' };
const planParses = new Map<
    string,
    { mtimeMs: number; steps?: unknown; failedAt?: number }
>();
// a poll tries a failing x again on an unmoved file this often, so one that fails costs no spawn every 4 s
const PLAN_RETRY_MS = 30_000;
export async function readPlanSteps(
    $: EngineInterface,
    path: string,
    retryMs = 0,
): Promise<PlanRead> {
    const cut = path.lastIndexOf('/');
    const entry = (await $.fs.list(path.slice(0, cut)).catch(() => [])).find(
        (f) => f.name === path.slice(cut + 1),
    );
    if (!entry) return { state: 'gone' };
    const kept = planParses.get(path);
    if (kept?.mtimeMs === entry.mtimeMs && Array.isArray(kept.steps))
        return { steps: kept.steps };
    const now = await $.clock.now();
    if (
        kept?.mtimeMs === entry.mtimeMs &&
        now - (kept.failedAt ?? Number.NEGATIVE_INFINITY) < retryMs
    )
        return { state: 'stale' };
    const read = await xRead($, ['lane', 'plan-steps', path]);
    const steps = (read?.data as { steps?: unknown } | undefined)?.steps;
    if (!Array.isArray(steps)) {
        planParses.set(path, { failedAt: now, mtimeMs: entry.mtimeMs });
        return { state: 'stale' };
    }
    planParses.set(path, { mtimeMs: entry.mtimeMs, steps });
    return { steps };
}

// FRM-649 (FRM-616:W36–W38): a lane card's title is x's lane record, «<scope> — <what>», read once per change of the lane's
// records in x's thread store (a dispatch, a sixth sense joining; `at` moves with every x sync), never each poll, and a failed read is tried again next
// poll; title undefined when x has no record or it names no what; sixth: the sixth sense x's record names, linked beside
// the codie; isFresh: read on this call, the one time a card takes the title, so a hand retitle stands
type LaneShown = { isFresh?: boolean; title?: string; sixth?: string };
const laneShowns = new Map<string, LaneShown & { key: string }>();
async function laneShown(
    $: EngineInterface,
    codie: ThreadRecord & { lane: string },
): Promise<LaneShown> {
    const key = (await threadRecords($))
        .filter((t) => t.lane === codie.lane)
        .map(
            (t) =>
                `${t.sessionId}|${t.role}|${t.dispatchedAt ?? 0}|${t.ticket ?? ''}`,
        )
        .sort()
        .join(',');
    const kept = laneShowns.get(codie.lane);
    if (kept?.key === key) return { sixth: kept.sixth, title: kept.title };
    const read = await xRead($, ['lane', 'show', codie.lane]);
    const record = read?.data as
        | { scope?: unknown; what?: unknown; members?: unknown }
        | undefined;
    const sixth =
        record?.members && typeof record.members === 'object'
            ? Object.entries(record.members).find(
                  ([, role]) => role === 'sixth-sense',
              )?.[0]
            : undefined;
    const title =
        typeof record?.scope === 'string' &&
        typeof record.what === 'string' &&
        record.scope &&
        record.what
            ? `${record.scope} — ${codie.ticket ? `${codie.ticket} ` : ''}${record.what}`
            : undefined;
    if (read) laneShowns.set(codie.lane, { key, sixth, title });
    return { isFresh: true, sixth, title };
}

// the live hand card linked to a codie dispatched into the lane, its runner's own, the newest of two: it is the lane's
// card, so the dispatch opens no second one beside it, a resummoned codie's included (FRM-527:W139)
async function handCardOf(
    $: EngineInterface,
    lanes: StashLane[],
    codies: string[],
    runner: string,
    live: Registered[],
) {
    let hand: StashLane | undefined;
    for (const l of lanes) {
        if (l.endedAt || l.plan) continue;
        if (bare(l.runner ?? '') !== bare(runner)) continue;
        const linked = l.linkedIds?.codie;
        const sid = linked && (await successorOf($, linked));
        // a link made before its registry row, or an old card, holds a name alone: read as the board reads a member
        const row = laneMemberRow(live, l.members.codie, sid);
        if ([sid, row?.base.sid].some((id) => id && codies.includes(id)))
            hand = l;
    }
    return hand;
}

// her own last move of a card, a codie's followed step (`by`) left out; one at or past the dispatch keeps it a hand card
// till the lane's next one
const handMovedAt = (lane: StashLane) =>
    Math.max(
        0,
        ...lane.history
            .filter((h) => !h.by && ['create', 'edit', 'step'].includes(h.act))
            .map((h) => h.at),
    );

// a dispatch opens its lane's card (FRM-602): x's record of a live codie names the lane, whose plan file holds the steps,
// and the clio that dispatched it, whose session opens the card; a record with no dispatching clio (a summon's) opens
// none. a lane whose card ended after its newest dispatch opens none again, and the newest live codie dispatched into a
// lane holds its link
export async function openDispatchedLanes(
    $: EngineInterface,
    glide: (input: Record<string, unknown>) => Promise<object>,
) {
    const self = await selfRecord($);
    const label =
        self?.role === MAIN_ROLE
            ? 'clio-main'
            : self?.role === WING_ROLE && self.wing
              ? `clio-wing-${self.wing}`
              : undefined;
    if (!label || !(await partsShown($))('stash.glide')) return;
    const runner = self?.role === WING_ROLE ? runnerOf(self) : '';
    const dispatched = (await threadRecords($)).filter(
        (t): t is ThreadRecord & { lane: string } =>
            t.role === 'codie' &&
            /^[\w.-]+$/.test(t.lane ?? '') &&
            t.dispatchedBy === label,
    );
    if (!dispatched.length) return;
    const home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
    const live = (await registry($)).filter((r) => r.isAlive);
    const newest = new Map<
        string,
        { codie: ThreadRecord & { lane: string }; member: Registered }
    >();
    for (const codie of dispatched) {
        const member = live.find((r) => r.base.sid === codie.sessionId);
        const was = newest.get(codie.lane);
        if (member && (!was || (codie.at ?? 0) > (was.codie.at ?? 0)))
            newest.set(codie.lane, { codie, member });
    }
    for (const { codie, member } of newest.values()) {
        const plan = `~/.local/state/x/lanes/${codie.lane}/lane-plan.md`;
        const path = expandHome(plan, home);
        const lanes = await laneStore($);
        if (!lanes) return;
        const onPlan = lanes.filter((l) => expandHome(l.plan, home) === path);
        const open = onPlan.find((l) => !l.endedAt);
        const shown = await laneShown($, codie);
        // a card that took this dispatch's plan keeps the title she gave it, a reload's fresh read included
        const isTaken = open?.history.some(
            (h) => h.act === 'take' && h.at >= (codie.dispatchedAt ?? 0),
        );
        if (
            open &&
            !isTaken &&
            shown.isFresh &&
            shown.title &&
            open.title !== shown.title
        )
            await glide({
                act: 'edit',
                id: open.id,
                op: 'glide',
                title: shown.title,
            });
        const sixth = shown.sixth;
        if (
            open &&
            sixth &&
            open.linkedIds?.['sixth-sense'] !== sixth &&
            live.some((r) => r.base.sid === sixth)
        )
            await glide({
                act: 'link',
                id: open.id,
                op: 'glide',
                role: 'sixth-sense',
                session: sixth,
            });
        if (open) {
            if (bare(open.members.codie ?? '') !== bare(member.base.name))
                await glide({
                    act: 'link',
                    id: open.id,
                    op: 'glide',
                    role: 'codie',
                    session: codie.sessionId,
                });
            continue;
        }
        // a card ended before this dispatch frees the plan for a new one; one ended after it closed the lane for good.
        // the dispatch's time is `dispatchedAt`: `at` is moved by every x sync, which brought an ended card back
        if (onPlan.some((l) => (l.endedAt ?? 0) >= (codie.dispatchedAt ?? 0)))
            continue;
        const text = await $.fs.read(path).catch(() => undefined);
        if (text === undefined) continue;
        const steps = await readPlanSteps($, path);
        // read again: a move of hers may have landed while x answered
        const fresh = await laneStore($);
        if (!fresh) return;
        const codies = dispatched.filter((t) => t.lane === codie.lane);
        const hand = await handCardOf(
            $,
            fresh,
            codies.map((t) => t.sessionId),
            runner,
            live,
        );
        if (hand) {
            const at = await $.clock.now();
            // the plan create refuses (no step, one with no ticket) would freeze the card, so it stays by hand
            const isFollowable =
                'steps' in steps &&
                steps.steps.length > 0 &&
                steps.steps.every((x) => x.ticket);
            if (isFollowable && (codie.dispatchedAt ?? 0) > handMovedAt(hand))
                await changeLanes(
                    $,
                    fresh,
                    fresh.map((l) =>
                        l.id === hand.id
                            ? {
                                  ...l,
                                  history: [
                                      ...l.history,
                                      {
                                          act: 'take',
                                          at,
                                          current: l.current,
                                          done: l.items.filter((x) => x.isDone)
                                              .length,
                                      },
                                  ],
                                  plan,
                              }
                            : l,
                    ),
                );
            continue;
        }
        const title =
            shown.title ||
            text
                .match(/^# (.+)$/m)?.[1]
                ?.replace(/\s+—\s+lane plan\s*$/, '')
                .trim() ||
            codie.lane;
        const made = await glide({ act: 'create', op: 'glide', plan, title });
        if ('deny' in made) continue;
        const card = (await readLanes($)).find(
            (l) => !l.endedAt && l.plan === plan,
        );
        if (card)
            await glide({
                act: 'link',
                id: card.id,
                op: 'glide',
                role: 'codie',
                session: codie.sessionId,
            });
    }
}

// a linked card is its lane plan file: each poll its numbered lines are the steps; an unreadable file keeps the last state
export async function followPlans($: EngineInterface) {
    if (!(await isLaneOwner($)) || !(await partsShown($))('stash.glide'))
        return;
    const lanes = await readLanes($);
    if (!lanes.some((l) => l.plan && !l.endedAt)) return;
    const home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
    const now = await $.clock.now();
    const turns = (await currentOrbit($)).turns;
    let isChanged = false;
    const steersDone: string[] = [];
    const next: StashLane[] = [];
    for (const lane of lanes) {
        if (!lane.plan || lane.endedAt) {
            next.push(lane);
            continue;
        }
        const read = await readPlanSteps(
            $,
            expandHome(lane.plan, home),
            PLAN_RETRY_MS,
        );
        if ('state' in read) {
            const isMarked =
                read.state === 'gone' ? lane.isPlanGone : lane.isPlanStale;
            if (!isMarked) isChanged = true;
            next.push(
                isMarked
                    ? lane
                    : read.state === 'gone'
                      ? { ...lane, isPlanGone: true }
                      : { ...lane, isPlanStale: true },
            );
            continue;
        }
        const steps = read.steps.map((s) => ({
            isDone: s.done,
            text: [...s.text].slice(0, LANE_TEXT_MAX).join(''),
            ...(s.ticket ? { ticket: s.ticket } : {}),
        }));
        const items: LaneItem[] = steps.length ? steps : lane.items;
        // «we are here» is the first open step of the ticket the card runs; an older chunk's open close line is passed
        // over (clio's ruling, FRM-649 step 132), the plan's first open line when none of its steps carry that ticket
        const runs = items.some((x) => x.ticket && x.ticket === lane.ticket);
        const running = items.findIndex(
            (x) => !x.isDone && (!runs || x.ticket === lane.ticket),
        );
        // a running ticket with every step done leaves the pointer on the plan's first open step, not past its end
        const current =
            running < 0 ? items.findIndex((x) => !x.isDone) : running;
        const at = current < 0 ? items.length : current;
        const isSame =
            !lane.isPlanGone &&
            !lane.isPlanStale &&
            at === lane.current &&
            JSON.stringify(items) === JSON.stringify(lane.items);
        if (isSame) {
            next.push(lane);
            continue;
        }
        isChanged = true;
        // a steer was about the step it sat on: it leaves when the plan moves the pointer, as a hand step does
        if (
            at !== lane.current ||
            lane.items[lane.current]?.text !== items[at]?.text
        )
            steersDone.push(lane.id);
        const { isPlanGone: _, isPlanStale: __, ...rest } = lane;
        next.push({
            ...rest,
            current: at,
            history:
                at === lane.current
                    ? lane.history
                    : [
                          ...lane.history,
                          {
                              act: 'plan',
                              at: now,
                              current: at,
                              done: items.filter((x) => x.isDone).length,
                          },
                      ],
            items,
            movedAt: at === lane.current ? lane.movedAt : turns,
        });
    }
    if (!isChanged || (await changeLanes($, lanes, next))) return;
    for (const id of steersDone) {
        await $.store.delete(LANE_STEER + id).catch(() => undefined);
        await $.store.delete(LANE_STEER_OLD + id).catch(() => undefined);
    }
}

async function heldLaneMoves($: EngineInterface) {
    const held = await $.store.get(LANE_MOVES).catch(() => undefined);
    return Array.isArray(held) ? (held as string[]) : [];
}

// the held moves, once: they leave the store as they join clio's turn
export async function takeLaneMoves($: EngineInterface) {
    await followCodies($);
    const held = await heldLaneMoves($);
    if (held.length) await $.store.delete(LANE_MOVES);
    return held;
}

// a card draws at most LANE_MAX rows: the current step with its neighbours, the rest named in the head
const LANE_WINDOW = LANE_MAX - 2;
function laneBounds(count: number, current: number) {
    if (count <= LANE_MAX) return { from: 0, to: count };
    const from = Math.min(Math.max(current - 1, 0), count - LANE_WINDOW);
    return { from, to: from + LANE_WINDOW };
}
export const laneRows = (lane: StashLane) => {
    const { from, to } = laneBounds(lane.items.length, lane.current);
    return lane.items.map((item, i) => ({ i, item })).slice(from, to);
};
export const laneSpan = (lane: StashLane) => {
    const { from, to } = laneBounds(lane.items.length, lane.current);
    return lane.items.length > LANE_MAX
        ? ` · ${from + 1}–${to} of ${lane.items.length}`
        : '';
};

// a lane's steps as clio sends them: 1 to `max`, each plain text ≤LANE_TEXT_MAX, an optional ticket id
function laneItems(
    input: unknown,
    max = LANE_MAX,
): LaneItem[] | { deny: string } {
    const raw = Array.isArray(input) ? input : [];
    if (raw.length < 1 || raw.length > max)
        return {
            deny: `orbit glide: 1 to ${max} steps, got ${raw.length}`,
        };
    const items: LaneItem[] = [];
    for (const item of raw) {
        const v = (item ?? {}) as Record<string, unknown>;
        const text = oneLine(v.text);
        if (!text) return { deny: 'orbit glide: every step needs its text' };
        if ([...text].length > LANE_TEXT_MAX)
            return {
                deny: `orbit glide: «${[...text].slice(0, 30).join('')}…» is ${[...text].length} chars; keep it ≤${LANE_TEXT_MAX}, plain words`,
            };
        const ticket = oneLine(v.ticket);
        if (ticket && !LANE_TICKET.test(ticket))
            return {
                deny: `orbit glide: ticket «${ticket}» is not an id like FRM-12`,
            };
        items.push({
            isDone: v.done === true,
            text,
            ...(ticket ? { ticket } : {}),
        });
    }
    return items;
}

// the pointer moves past what is done, and everything behind it is done
function pointed(items: LaneItem[], at: number) {
    let current = at;
    while (current < items.length && items[current]?.isDone) current++;
    const marked = items.map((x, i) => ({
        ...x,
        isDone: x.isDone || i < current,
    }));
    return {
        current,
        done: marked.filter((x) => x.isDone).length,
        items: marked,
    };
}

function laneSummary(
    id: string,
    title: string,
    { current, done, items }: ReturnType<typeof pointed>,
) {
    return current >= items.length
        ? `lane ${id} «${title}» done: it stays on every board, all done, until act end at the next siesta`
        : `lane ${id} «${title}»: ${done} of ${items.length} done, on «${items[current]?.text}»`;
}

const lanesFile = (home: string | undefined) =>
    `${home}/.claude/shelf/lanes.json`;
export const LANES_UNREAD =
    'the lanes file is there but would not read, so nothing was written over it';

// read-both: a lane stored before the 10-29 rename names its members coder and verifier
function laneRolesNow(lane: StashLane): StashLane {
    const now = (r?: Partial<Record<string, string>>) =>
        r &&
        Object.fromEntries(
            Object.entries(r).map(([k, v]) => [LANE_ROLE_OLD[k] ?? k, v]),
        );
    return {
        ...lane,
        members: now(lane.members) ?? {},
        ...(lane.memberSids ? { memberSids: now(lane.memberSids) } : {}),
        ...(lane.linkedIds ? { linkedIds: now(lane.linkedIds) } : {}),
    };
}

// the shelf file as it stands: every lane, ended ones kept as the record; only a file that is not there is no lanes, one
// that is there and would not read is `undefined`, never written over
export async function laneStore(
    $: EngineInterface,
): Promise<StashLane[] | undefined> {
    const file = lanesFile(await $.env.get('HOME').catch(() => undefined));
    const text = await $.fs.read(file).catch(() => undefined);
    if (text === undefined)
        return (await $.fs.exists(file).catch(() => true)) ? undefined : [];
    try {
        const body = JSON.parse(text);
        return Array.isArray(body?.lanes)
            ? (body.lanes as StashLane[]).map(laneRolesNow)
            : undefined;
    } catch {
        return undefined;
    }
}
// for a draw or a read that writes nothing back
export async function readLanes($: EngineInterface) {
    return (await laneStore($)) ?? [];
}

// the file a peer wrote while this write was being worked out: mine wins only on a lane mine changed, and a lane ended
// there stays ended. it narrows the gap, it holds no lock
export function mergeLanes(
    before: StashLane[],
    mine: StashLane[],
    fresh: StashLane[],
) {
    if (!fresh.length) return mine;
    const was = new Map(before.map((l) => [l.id, l]));
    const mineById = new Map(mine.map((l) => [l.id, l]));
    const held = new Set(fresh.map((l) => l.id));
    return [
        ...fresh.map((f) => {
            const m = mineById.get(f.id);
            if (!m || m === was.get(f.id)) return f;
            return f.endedAt && !m.endedAt ? f : m;
        }),
        ...mine.filter((m) => !held.has(m.id) && !was.has(m.id)),
    ];
}

// a change onto the file as it stands now, or why it was not kept; one at a time in this session, since a poll, a prompt and
// a glide op share the temp file; each card carries its ticked steps: the deck's count is
// done of all, never the pointer (FRM-656: l96 read 49/116)
const lanesLocked = serial();
export function changeLanes(
    $: EngineInterface,
    before: StashLane[],
    mine: StashLane[],
) {
    return lanesLocked(() => lanesChanged($, before, mine));
}
async function lanesChanged(
    $: EngineInterface,
    before: StashLane[],
    mine: StashLane[],
): Promise<string | undefined> {
    const fresh = await laneStore($);
    if (!fresh) return LANES_UNREAD;
    const lanes = mergeLanes(before, mine, fresh);
    const home = await $.env.get('HOME').catch(() => undefined);
    const counted = lanes.map((l) => ({
        ...l,
        done: l.items.filter((x) => x.isDone).length,
    }));
    try {
        await writeWhole(
            $,
            identity.proc?.pid ?? 0,
            lanesFile(home),
            `${JSON.stringify({ lanes: counted }, null, 2)}\n`,
        );
    } catch (err) {
        const why = `the lanes file was not kept: ${errorText(err)}`;
        $.ui.log(`x-mod-stash: ${why}`);
        return why;
    }
    await showLanes($, lanes);
    return undefined;
}

type LaneSteer = { steer?: string; isTaken?: boolean };

export async function laneSteers($: EngineInterface) {
    const steers: Record<string, LaneSteer> = {};
    for (const key of await $.store.keys().catch(() => [] as string[])) {
        const prefix = [LANE_STEER, LANE_STEER_OLD].find((p) =>
            key.startsWith(p),
        );
        if (!prefix) continue;
        const id = key.slice(prefix.length);
        const n = (await $.store.get(key).catch(() => undefined)) as
            | LaneSteer
            | undefined;
        if (n && (prefix === LANE_STEER || !steers[id]))
            steers[id] = steered(n);
    }
    return steers;
}

export async function changeLaneSteer(
    $: EngineInterface,
    id: string,
    change: (n: LaneSteer) => LaneSteer,
) {
    const was = (await laneSteers($))[id] ?? {};
    const n = change(was);
    // a bare tick counts too: «good to go on this step», no steer needed (dima's shot, 10-13 18:01: the tick did nothing)
    if (n.steer || n.isTaken) await $.store.set(LANE_STEER + id, n);
    else await $.store.delete(LANE_STEER + id);
    await $.store.delete(LANE_STEER_OLD + id).catch(() => undefined);
    await showLanes($, await readLanes($));
}

// the glide reorder left (dima's o138): a `lane-order:` key a board wrote before that is dropped by clio's stash, never applied
export async function dropLaneOrders($: EngineInterface) {
    for (const key of await $.store.keys().catch(() => [] as string[]))
        if (key.startsWith(LANE_ORDER))
            await $.store.delete(key).catch(() => undefined);
}

// the live lanes into this session's state, only when they changed: a write redraws the board; each carries its steer
let lanesShown = '';
export async function showLanes($: EngineInterface, lanes: StashLane[]) {
    const steers = await laneSteers($);
    const live = lanes
        .filter((l) => !l.endedAt)
        .map((l) => ({
            ...l,
            isSteerTaken: steers[l.id]?.isTaken,
            steer: steers[l.id]?.steer,
        }));
    const asks: Record<string, PublishedAsk[]> = {};
    const rows = live.some((l) => Object.keys(l.members).length)
        ? await registry($).catch(() => [])
        : [];
    // each lane's member to the session id it runs under now, its linked id first, so a retitle after the link keeps it;
    // the card's asks are keyed by that id, so two lanes whose members share a name never swap asks
    for (const lane of live) {
        const memberSids: Partial<Record<LaneRole, string>> = {};
        for (const [role, member] of Object.entries(lane.members)) {
            if (!member) continue;
            const linked = lane.linkedIds?.[role as LaneRole];
            const id = await successorOf($, member);
            const sid =
                laneMemberRow(
                    rows,
                    id,
                    linked && (await successorOf($, linked)),
                )?.base.sid ?? id;
            memberSids[role as LaneRole] = sid;
            if (asks[sid]) continue;
            const entry = (await $.store
                .get(PREFIX + sid)
                .catch(() => undefined)) as Entry | undefined;
            asks[sid] = (entry?.items ?? []).map(steered);
        }
        lane.memberSids = memberSids;
    }
    const text = JSON.stringify({ asks, live });
    if (text === lanesShown) return;
    lanesShown = text;
    await $.state.set(LANES, live).catch(() => undefined);
    await $.state.set(LANE_ASKS, asks).catch(() => undefined);
}

// a start or a reload draws the lanes again, whatever this module drew before it
export async function reshowLanes($: EngineInterface) {
    lanesShown = '';
    await showLanes($, await readLanes($));
}

export function resetLanes() {
    planParses.clear();
    laneShowns.clear();
    lanesLocked.reset();
    lanesShown = '';
}
