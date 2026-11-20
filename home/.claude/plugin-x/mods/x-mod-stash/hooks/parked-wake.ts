// 🅿️ the parked-lane wake (PK-351, FRM-662): a lane with open steps and every member idle wakes the clio running it,
// once per silence; and crow's relay, the adviser's note that wakes clio's thread

import type { EngineInterface } from 'claude-code';

import type { LaneRole, StashLane } from '../types/stash.d.ts';
import {
    type ViewDoors,
    armHot,
    isWindowSpent,
    prepareTurn,
} from './keep-warm.ts';
import { readLanes } from './lanes.ts';
import { LEDGER_EVERY_MS, lastSpokeAt } from './quiet-books.ts';
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
import { herdrRow, partsShown } from './settings-store.ts';
import { idleTurn, isTurnBusy, selfSubmit } from './turn.ts';
import { bare } from './util.ts';

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
// a lane with open steps and every live member idle is parked: the clio running it hears at 10 min, once per
// silence, shift or not, since nobody else will; a busy turn or a refused wake asks again at the next read (PK-351:W44)
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
// a chunk this close to its end with nothing signed after it is what a parked lane wakes its clio for (FRM-602)
const PARKED_STEPS_LEFT = 2;
const SIGNED_READ_MS = 10 * 60_000;
const signedReads = new Map<string, { at: number; isSigned?: boolean }>();
// whether linear says a ticket is signed, read through x at most once per ticket in 10 min, a failed read too, so an
// outage logs once and spawns one read a window; undefined when x cannot read it
async function isSigned($: EngineInterface, ticket: string, now: number) {
    const kept = signedReads.get(ticket);
    if (kept && now - kept.at < SIGNED_READ_MS) return kept.isSigned;
    const run = await $.process
        .run(['x', 'linear', 'read', ticket, '--json'], {
            cwd: await $.env.get('HOME'),
            timeoutMs: 8000,
        })
        .catch(() => undefined);
    try {
        const labels = (
            JSON.parse(run?.stdout ?? '') as {
                data?: { tickets?: { labels?: unknown }[] };
            }
        ).data?.tickets?.[0]?.labels;
        if (run?.exitCode !== 0 || !Array.isArray(labels)) throw new Error();
        const isSigned = labels.includes('signed');
        signedReads.set(ticket, { at: now, isSigned });
        return isSigned;
    } catch {
        signedReads.set(ticket, { at: now });
        await $.ui.log(
            `x-mod-stash: x linear read ${ticket} failed; the parked lane waits`,
        );
        return undefined;
    }
}
// the line a parked lane wakes its clio with, or none: its chunk is more than two steps from its end, or the next chunk
// is signed (its codie goes on), or linear cannot say
async function parkedNudge(
    $: EngineInterface,
    lane: StashLane,
    now: number,
): Promise<string | undefined> {
    const open = lane.items.slice(lane.current).filter((x) => !x.isDone);
    const chunk = open[0]?.ticket;
    // a hand-made card names no ticket: it has no chunk to end, so its idle time is the wake
    if (!chunk) return `«${lane.title}» has open steps`;
    // the chunk is the run of open steps from the pointer that share its ticket; the next ticket's steps end it
    const after = open.findIndex((x) => x.ticket !== chunk);
    const left = after < 0 ? open.length : after;
    if (left > PARKED_STEPS_LEFT) return undefined;
    const head = `«${lane.title}» (${lane.id}): ${left} step${left === 1 ? '' : 's'} left in ${chunk}`;
    const next = open.find((x) => x.ticket && x.ticket !== chunk)?.ticket;
    if (!next) return `${head}, nothing queued, sign the next`;
    const signed = await isSigned($, next, now);
    return signed === false
        ? `${head}; next chunk ${next} is unsigned`
        : undefined;
}
export async function wakeForParkedLanes($: EngineInterface, view: ViewDoors) {
    const now = await $.clock.now();
    if (now - parkedReadAt < LEDGER_EVERY_MS) return;
    parkedReadAt = now;
    const threads = await threadRecords($);
    const myId = await currentId($);
    const self = threads.find((t) => t.sessionId === myId);
    const isMain = self?.role === MAIN_ROLE;
    if (!self || (!isMain && self.role !== WING_ROLE)) return;
    if (!(await partsShown($))('stash.glide') || (await isWindowSpent($)))
        return;
    const home = (await $.env.get('HOME')) ?? '';
    const rows = await registry($);
    const wakeAfter = parkedWakeMs(await herdrRow($, home, 'stash.park.after'));
    for (const lane of await readLanes($)) {
        if (lane.endedAt || lane.current >= lane.items.length) continue;
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
        const members = [];
        const unread: string[] = [];
        for (const [role, name] of Object.entries(lane.members)) {
            if (!name) continue;
            const id = lane.linkedIds?.[role as LaneRole];
            const row = laneMemberRow(
                rows,
                await successorOf($, name),
                id && (await successorOf($, id)),
            );
            if (!row) unread.push(`${role} «${name}»`);
            else if (row.base.sid !== myId) members.push(row);
        }
        if (!members.length) continue;
        if (members.some((row) => row.base.status !== 'idle')) continue;
        const spoke = await Promise.all(
            members.map((row) => lastSpokeAt($, home, row.base.sid)),
        );
        const heard = spoke.filter((at) => at !== undefined);
        if (heard.length < members.length) continue;
        const at = Math.max(...heard);
        const minutes = Math.round((now - at) / 60_000);
        // a member with no live session counts as gone; said once per silence, since `at` moves only on a new word
        const silence = `${at}|${unread.join()}`;
        if (unread.length && parkedUnreadLogged.get(lane.id) !== silence) {
            parkedUnreadLogged.set(lane.id, silence);
            await $.ui.log(
                `x-mod-stash: lane ${lane.id} reads no live session for ${unread.join(', ')}; counted as gone`,
            );
        }
        if (now - at < wakeAfter || (await isTurnBusy($))) continue;
        // a ping moves `at` back to the reply before it, so only a newer word re-arms
        const key = `${PARKED_WOKE}${lane.id}`;
        const woke = (await $.store.get(key)) as number | undefined;
        if (woke !== undefined && woke >= at) continue;
        const nudge = await parkedNudge($, lane, now);
        if (!nudge) continue;
        const r = await selfSubmit(
            $,
            `🅿️ parked lane: ${nudge}; its members sat idle ${minutes} min.`,
            false,
            () => prepareTurn(view),
        ).catch(() => undefined);
        if (!r || r.drop) {
            await idleTurn($);
            await armHot($, view);
            continue;
        }
        await $.store.set(key, at);
    }
}
