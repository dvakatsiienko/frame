// 🅿️ the parked-lane wake (PK-351, FRM-692): a lane's members read one by one, each with nothing to do wakes the clio
// running the lane, each reason once per silence; and crow's relay, the adviser's note that wakes clio's thread

import type { EngineInterface } from 'claude-code';

import type { LaneRole, StashLane } from '../types/stash.d.ts';
import {
    type ViewDoors,
    armHot,
    isWindowSpent,
    prepareTurn,
} from './keep-warm.ts';
import { readLanes } from './lanes.ts';
import { unbold } from './parse.ts';
import { LEDGER_EVERY_MS, lastTurnAt, openTags } from './quiet-books.ts';
import { laneMemberRow, registry } from './roster.ts';
import {
    ADVISER_ROLE,
    MAIN_ROLE,
    WING_ROLE,
    currentId,
    isLaneOwner,
    runnerOf,
    successorOf,
    threadRecords,
} from './session-identity.ts';
import { herdrRow, partsShown, readSwitch } from './settings-store.ts';
import { REPLY, type Reply } from './store-keys.ts';
import { idleTurn, isTurnBusy, selfSubmit } from './turn.ts';
import { bare } from './util.ts';
import { windOf } from './wind.ts';
import { peekHandoff } from './wind-run.ts';
import { xRead } from './x-cli.ts';

const PARKED_WAKE_MS = 10 * 60_000;
const PARKED_WOKE = 'parked-woke:';
// crow's wake, parked by her wake script for a desktop tab: clio's thread sends the line itself, no tool call of
// hers (brief 8 item 2), then marks it sent so her prompt hook starts the harvester; a failed send stays parked for the
// next poll
export async function relayCrowWake($: EngineInterface) {
    if (!(await isLaneOwner($))) return;
    const path = `${await $.env.get('HOME')}/.local/state/crow/relay.json`;
    const raw = await $.fs.read(path).catch(() => undefined);
    if (!raw) return;
    let parked: Record<string, unknown> | null;
    try {
        parked = JSON.parse(raw) as Record<string, unknown> | null;
    } catch {
        return;
    }
    if (!parked || parked.isSent || typeof parked.line !== 'string') return;
    // crow by her record, so a session that only names itself crow never takes clio's wake line
    const crow = (await threadRecords($)).find(
        (t) => t.role === ADVISER_ROLE && t.pid !== undefined,
    );
    if (!crow) return;
    const r = await $.session
        .send({ text: parked.line, to: { sessionId: crow.sessionId } })
        .catch(() => undefined);
    if (!r?.isDelivered) return;
    // a newer wake parked while this one went out stays as it is
    if ((await $.fs.read(path).catch(() => undefined)) !== raw) return;
    await $.fs
        .write(path, JSON.stringify({ ...parked, isSent: true }))
        .catch(() => undefined);
}
// herdr's «lane idle alarm after» row, in minutes; empty or unreadable is the 10 min line (FRM-605 exit 4, dima's o125)
export function parkedWakeMs(row: unknown) {
    const minutes =
        typeof row === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(row)
            ? Number(row)
            : row;
    return typeof minutes === 'number' &&
        Number.isFinite(minutes) &&
        minutes > 0
        ? minutes * 60_000
        : PARKED_WAKE_MS;
}
let parkedReadAt = 0;
const parkedUnreadLogged = new Map<string, string>();
// a chunk this close to its end with nothing dispatched after it is a parked lane's question (FRM-602, FRM-692)
const PARKED_STEPS_LEFT = 2;
// a reviewer's wait, and how long a 🔭 wait on anyone but the runner is taken as one
const REVIEWER_WAKE_MS = 30 * 60_000;
const WIND_STUCK_MS = 3 * 60_000;
const PEEK_MS = 8000;
const TICKET_READ_MS = 10 * 60_000;
type NextChunk = 'dispatched' | 'signed' | 'unsigned' | 'unread';
const ticketReads = new Map<
    string,
    { at: number; chunk: NextChunk; fails: number }
>();
const DISPATCHED = /^[\s>*-]*🚀 dispatched /u;
const TAKEN_BACK = /^[\s>*-]*↩️/u;
// a 🚀 line of the sign block, the last `## signed` heading's, stands until a later ↩️ one takes it back, x's own rule; it
// outranks the label, which a dispatch takes off; a quick ticket has no block, its 🚀 line closes the body
function chunkOf(ticket: { description?: unknown; labels?: unknown }) {
    if (!Array.isArray(ticket.labels)) return 'unread';
    const body = String(ticket.description ?? '').split('\n');
    const from = body.findLastIndex((l) => /^## signed\s*$/u.test(l)) + 1;
    const block = body.slice(from);
    const end = from ? block.findIndex((l) => l.startsWith('## ')) : -1;
    const lines = end < 0 ? block : block.slice(0, end);
    const at = lines.findLastIndex((l) => DISPATCHED.test(l));
    if (at >= 0 && !lines.slice(at).some((l) => TAKEN_BACK.test(l)))
        return 'dispatched';
    return ticket.labels.includes('signed') ? 'signed' : 'unsigned';
}
// a ticket's state through x: a dispatched one is read once in 10 min, any other no older than a poll before it is said, and
// a failed read is tried again at the next poll, «unread» only at the second in a row, 10 min apart at most
async function nextChunk(
    $: EngineInterface,
    ticket: string,
    now: number,
    isSaid: (chunk: NextChunk) => boolean,
): Promise<NextChunk | undefined> {
    const kept = ticketReads.get(ticket);
    const isKept =
        kept &&
        kept.chunk !== 'unread' &&
        now - kept.at < TICKET_READ_MS &&
        (kept.chunk === 'dispatched' || isSaid(kept.chunk));
    if (isKept) return kept.chunk;
    const read = await xRead($, ['linear', 'read', ticket], 8000);
    const first = (read?.data as { tickets?: object[] } | undefined)
        ?.tickets?.[0];
    const chunk = first ? chunkOf(first) : 'unread';
    const wasFailing = kept && now - kept.at < TICKET_READ_MS ? kept.fails : 0;
    const fails = chunk === 'unread' ? wasFailing + 1 : 0;
    ticketReads.set(ticket, { at: now, chunk, fails });
    if (fails === 1)
        await $.ui.log(
            `x-mod-stash: x linear read ${ticket} failed; tried again at the next poll`,
        );
    return fails === 1 ? undefined : chunk;
}
const CHUNK_SAYS = {
    signed: 'is signed, not dispatched',
    unread: 'could not be read from linear',
    unsigned: 'is unsigned',
} as const satisfies Record<Exclude<NextChunk, 'dispatched'>, string>;

type Parked = {
    at: number;
    isIdle: boolean;
    name: string;
    role: LaneRole;
    sid: string;
};
// what a rule says of one member or of the lane: `reason` keys «said already», `about` the members whose word re-arms it,
// `also` the ones it is counted as said of too, a member still at work on a finished card
type Hold = {
    about: Parked[];
    also?: Parked[];
    reason: string;
    text: string;
};
// what the runner was told of a member's silence: every reason, until a word of its own
type Woke = { at: number; reasons: string[] };
const wokeKey = (lane: StashLane, sid: string) =>
    `${PARKED_WOKE}${lane.id}:${sid}`;
const minutesOf = (ms: number) => Math.round(ms / 60_000);
const wingsIn = (text: string) =>
    [...text.matchAll(/wing (\d+)/giu)].map((m) => m[1]);
// a 🔭 wait on the clio running the lane: «clio» or «coordinator» with no wing named is any runner, a wing its number; `runners` are her own
// display and the card's, a dead wing's whose lane fell to her
function namesRunner(wait: string, runners: string[]) {
    const said = unbold(wait);
    const wings = runners.flatMap(wingsIn);
    return (
        wingsIn(said).some((n) => wings.includes(n)) ||
        /(?<![\w-])(?:clio|coordinator)(?![\w-])/iu.test(
            said.replace(/clio: wing \d+/giu, ''),
        )
    );
}

const goneWinds = new Set<string>();
// (3) a second wind that never fired, its handoff still in the store (23 Nov, case 4)
async function stuckWind(
    $: EngineInterface,
    m: Parked,
    now: number,
): Promise<Hold | undefined> {
    const wind = await windOf($, m.sid);
    if (!wind?.slug) return undefined;
    if (wind.state !== 'refreshing' && wind.state !== 'refused')
        return undefined;
    // a refused wind is stamped at its turn's end, so a word this far past it is a turn since; a refreshing one, at the call
    if (wind.state === 'refused' && m.at - wind.at > WIND_STUCK_MS)
        return undefined;
    if (now - Math.max(wind.at, m.at) < WIND_STUCK_MS) return undefined;
    // a handoff taken never comes back under the same wind, so it is looked for no more
    const key = `${m.sid}|${wind.slug}|${wind.at}`;
    if (goneWinds.has(key)) return undefined;
    const handoff = await peekHandoff($, wind.slug, PEEK_MS);
    if (handoff === 'gone') goneWinds.add(key);
    if (handoff !== 'here') return undefined;
    const by = wind.blocked ?? 'nothing it named';
    return {
        about: [m],
        reason: `wind:${wind.slug}`,
        text: `${m.name} said second wind «${wind.slug}» ${minutesOf(now - wind.at)} min ago, it never fired: held by ${by}; its handoff is still in the store`,
    };
}

// the member's 🔭 wait on anyone but the runner, which an open [ask] to the runner outranks; a wait drawn from a live task
// is none
async function waitOf(
    $: EngineInterface,
    m: Parked,
    runners: string[],
    isAsking: boolean,
) {
    const reply = (await $.store.get(REPLY + m.sid)) as Reply | undefined;
    const said = reply?.tasks ? undefined : reply?.wait;
    const isOnOther = said && !isAsking && !namesRunner(said, runners);
    return { onOther: isOnOther ? said : undefined, said };
}

// the member's own rules, the first that holds (FRM-692's order); `left` is the card's open steps; herdr's row is a builder's
// alone, a reviewer's 30 min and a wait's stand whatever it says
function memberHold(
    m: Parked,
    now: number,
    wakeAfter: number,
    left: number,
    tag: { at: number; tag: string } | undefined,
    wait: Awaited<ReturnType<typeof waitOf>>,
    isAsking: boolean,
): Hold | undefined {
    const idle = now - m.at;
    // a turn of its own past the row after it: the member went on, its [done] was no parking
    if (
        tag?.tag === 'done' &&
        m.at - tag.at < wakeAfter &&
        now - Math.max(tag.at, m.at) >= wakeAfter
    )
        return {
            about: [m],
            reason: 'done',
            text: `${m.name} sent its [done] ${minutesOf(now - tag.at)} min ago, unanswered`,
        };
    if (!left) return undefined;
    const sat = `${m.name} idle ${minutesOf(idle)} min`;
    if (wait.onOther)
        return idle >= REVIEWER_WAKE_MS
            ? { about: [m], reason: 'wait', text: `${sat}, ${wait.onOther}` }
            : undefined;
    const ask = isAsking ? ', its [ask] unanswered' : '';
    const on = ask || (wait.said ? `, ${wait.said}` : '');
    if (m.role === 'codie')
        return idle >= wakeAfter
            ? {
                  about: [m],
                  reason: 'builder',
                  text: `${sat} with ${left} step${left === 1 ? '' : 's'} left${on}`,
              }
            : undefined;
    return idle >= REVIEWER_WAKE_MS
        ? { about: [m], reason: 'reviewer', text: `${sat}${on}` }
        : undefined;
}

// (2) and (6), the lane's own line: a finished card with a member still idle on it, or a chunk near its end with nothing
// dispatched after it and no member working or waiting
async function laneHold(
    $: EngineInterface,
    lane: StashLane,
    members: Parked[],
    now: number,
    wakeAfter: number,
    isParked: boolean,
    isSaid: (reason: string) => boolean,
): Promise<Hold | undefined> {
    const open = lane.items.slice(lane.current).filter((x) => !x.isDone);
    if (!open.length) {
        if (!lane.items.length) return undefined;
        const idle = members.filter((m) => m.isIdle && now - m.at >= wakeAfter);
        return idle.length
            ? {
                  about: idle,
                  also: members,
                  reason: 'finished',
                  text: `«${lane.title}» (${lane.id}) finished, nothing queued for ${idle.map((m) => m.name).join(', ')}, idle ${minutesOf(now - Math.max(...idle.map((m) => m.at)))} min`,
              }
            : undefined;
    }
    if (!isParked) return undefined;
    const chunk = open[0]?.ticket;
    // a hand-made card names no ticket: it has no chunk to end, so its idle time is the wake
    if (!chunk)
        return {
            about: members,
            reason: 'open',
            text: `«${lane.title}» has open steps`,
        };
    // the chunk is the run of open steps from the pointer that share its ticket; the next ticket's steps end it
    const after = open.findIndex((x) => x.ticket !== chunk);
    const left = after < 0 ? open.length : after;
    if (left > PARKED_STEPS_LEFT) return undefined;
    const head = `«${lane.title}» (${lane.id}): ${left} step${left === 1 ? '' : 's'} left in ${chunk}`;
    const next = open.find((x) => x.ticket && x.ticket !== chunk)?.ticket;
    if (!next)
        return {
            about: members,
            reason: 'nothing',
            text: `${head}, nothing queued, sign the next`,
        };
    const state = await nextChunk($, next, now, (c) => isSaid(`${next}:${c}`));
    return state && state !== 'dispatched'
        ? {
              about: members,
              reason: `${next}:${state}`,
              text: `${head}; next chunk ${next} ${CHUNK_SAYS[state]}`,
          }
        : undefined;
}

// the one idle alarm of a lane (PK-351:W44, FRM-692): its members are read one by one, and one turn of the clio running it
// names every rule that holds, each once per silence, shift or not; a busy turn or a refused wake asks again at the next read
export async function wakeForParkedLanes($: EngineInterface, view: ViewDoors) {
    const now = await $.clock.now();
    if (now - parkedReadAt < LEDGER_EVERY_MS) return;
    parkedReadAt = now;
    const threads = await threadRecords($);
    const myId = await currentId($);
    const self = threads.find((t) => t.sessionId === myId);
    const isMain = self?.role === MAIN_ROLE;
    if (!self || (!isMain && self.role !== WING_ROLE)) return;
    const shown = await partsShown($);
    if (!shown('stash.glide') || (await isWindowSpent($))) return;
    const home = (await $.env.get('HOME')) ?? '';
    const rows = await registry($);
    const wakeAfter = parkedWakeMs(await herdrRow($, home, 'stash.park.after'));
    // main clio's sends alone are booked, and only with quiet comms on: without a book no ping reads as open
    const tagOf =
        isMain && (await readSwitch($, 'quiet'))
            ? await openTags($, now)
            : () => undefined;
    const lanes = (await readLanes($)).filter((lane) => !lane.endedAt);
    // a member reused before its old card is ended is idle on the card with steps left, never on the finished one
    const onOpenCard = new Set(
        lanes
            .filter((lane) =>
                lane.items.slice(lane.current).some((x) => !x.isDone),
            )
            .flatMap((lane) => [
                ...Object.values(lane.members),
                ...Object.values(lane.linkedIds ?? {}),
            ]),
    );
    for (const lane of lanes) {
        // a dead wing's lane falls to main; a runner is the wing's display, drawn from its record
        const isRunnerLive = threads.some(
            (t) =>
                t.pid !== undefined &&
                bare(runnerOf(t)) === bare(lane.runner ?? ''),
        );
        const isMine =
            lane.runner && (isRunnerLive || !isMain)
                ? bare(lane.runner) === bare(runnerOf(self))
                : isMain;
        if (!isMine) continue;
        const left = lane.items
            .slice(lane.current)
            .filter((x) => !x.isDone).length;
        const isFinished = !left;
        const members: Parked[] = [];
        const unread: string[] = [];
        for (const [role, name] of Object.entries(lane.members)) {
            if (!name) continue;
            const id = lane.linkedIds?.[role as LaneRole];
            if (isFinished && [name, id].some((x) => x && onOpenCard.has(x)))
                continue;
            const row = laneMemberRow(
                rows,
                await successorOf($, name),
                id && (await successorOf($, id)),
            );
            if (!row) {
                unread.push(`${role} «${name}»`);
                continue;
            }
            const { name: rowName, sid, status } = row.base;
            if (sid === myId) continue;
            // a member whose transcript does not read is at work, as far as the wake knows
            const at = await lastTurnAt($, home, sid, row.startedAt);
            members.push({
                at: at ?? now,
                // cc reads «shell» for an idle session with a watch or a background command up, and a live task is no wait
                isIdle:
                    (status === 'idle' || status === 'shell') &&
                    at !== undefined,
                name: rowName,
                role: role as LaneRole,
                sid,
            });
        }
        if (!members.length) continue;
        // a member with no live session counts as gone; said once per silence, since `at` moves only on a new word
        const silence = `${Math.max(...members.map((m) => m.at))}|${unread.join()}`;
        if (
            unread.length &&
            members.every((m) => m.isIdle) &&
            parkedUnreadLogged.get(lane.id) !== silence
        ) {
            parkedUnreadLogged.set(lane.id, silence);
            await $.ui.log(
                `x-mod-stash: lane ${lane.id} reads no live session for ${unread.join(', ')}; counted as gone`,
            );
        }
        if (await isTurnBusy($)) continue;
        const woke = new Map<string, Woke | undefined>();
        for (const m of members)
            woke.set(
                m.sid,
                (await $.store.get(wokeKey(lane, m.sid))) as Woke | undefined,
            );
        // a ping moves `at` back to the reply before it, so only a newer word re-arms
        const isSaid = (m: Parked, reason: string) => {
            const was = woke.get(m.sid);
            return (
                !!was &&
                was.at >= m.at &&
                was.reasons?.includes(reason) === true
            );
        };
        const holds: Hold[] = [];
        let isParked = true;
        for (const m of members) {
            if (!m.isIdle) {
                isParked = false;
                continue;
            }
            const tag = tagOf(m.sid);
            const isAsking = tag?.tag === 'ask' && now - tag.at >= wakeAfter;
            const wait = await waitOf(
                $,
                m,
                [runnerOf(self), lane.runner ?? ''],
                isAsking,
            );
            const idle = now - m.at;
            if (idle < wakeAfter || (wait.onOther && idle < REVIEWER_WAKE_MS))
                isParked = false;
            const hold =
                (shown('stash.second-wind')
                    ? await stuckWind($, m, now)
                    : undefined) ??
                memberHold(m, now, wakeAfter, left, tag, wait, isAsking);
            if (hold) holds.push(hold);
        }
        const ofLane = await laneHold(
            $,
            lane,
            members,
            now,
            wakeAfter,
            isParked,
            (reason) => members.every((m) => isSaid(m, reason)),
        );
        if (ofLane) holds.unshift(ofLane);
        const fresh = holds.filter((h) =>
            h.about.some((m) => !isSaid(m, h.reason)),
        );
        if (!fresh.length) continue;
        const r = await selfSubmit(
            $,
            `🅿️ parked lane: ${fresh.map((h) => h.text).join('; ')}.`,
            false,
            () => prepareTurn(view),
        ).catch(() => undefined);
        if (!r || r.drop) {
            await idleTurn($);
            await armHot($, view);
            continue;
        }
        for (const m of members) {
            const said = fresh
                .filter((h) => (h.also ?? h.about).includes(m))
                .map((h) => h.reason);
            if (!said.length) continue;
            const was = woke.get(m.sid);
            const kept = was && was.at >= m.at ? was : undefined;
            await $.store.set(wokeKey(lane, m.sid), {
                at: kept?.at ?? m.at,
                reasons: [...(kept?.reasons ?? []), ...said],
            } satisfies Woke);
        }
    }
}

export function resetParkedWake() {
    parkedReadAt = 0;
    parkedUnreadLogged.clear();
    ticketReads.clear();
    goneWinds.clear();
}
