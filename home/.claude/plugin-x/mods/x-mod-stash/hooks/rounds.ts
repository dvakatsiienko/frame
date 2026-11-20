// the round count (FRM-504, FRM-656, FRM-662): which key a round lands on and what that key holds after it, pure; and
// its `$` side, the one writer of `~/.claude/shelf/lane-rounds.json`, which reads, locks and writes it per round line

import type { EngineInterface } from 'claude-code';

import { takeJoinLock } from './joins.ts';
import { readLanes } from './lanes.ts';
import {
    ROUND_CAP,
    capLine,
    roundChunkOf,
    roundLine,
    roundOf,
    severeOf,
} from './parse.ts';
import { isToCoordinator } from './quiet-gate.ts';
import {
    MAIN_ROLE,
    type ThreadRecord,
    WING_ROLE,
    identity,
    runnerOf,
    selfRecord,
    sessionName,
    successorOf,
    threadRecords,
} from './session-identity.ts';
import { bare, errorText, memberKey, text, writeWhole } from './util.ts';

// clean: the rounds whose line named «P0/P1: 0», unknown: those that named no «P0/P1: n», each written only once one
// did; count − clean is what the cap reads, the unknown ones among it
export type LaneRounds = {
    at?: number;
    clean?: number;
    count: number;
    shas: string[];
    unknown?: number;
};

// an array is the first build's shape; anything else unreadable counts from 0
export function roundsOf(kept: unknown): LaneRounds {
    if (Array.isArray(kept))
        return {
            count: kept.length,
            shas: kept.filter((s) => typeof s === 'string'),
        };
    const v = kept as Partial<LaneRounds> | undefined;
    return {
        ...(typeof v?.clean === 'number' && v.clean > 0
            ? { clean: v.clean }
            : {}),
        count: typeof v?.count === 'number' ? v.count : 0,
        shas: Array.isArray(v?.shas) ? v.shas : [],
        ...(typeof v?.unknown === 'number' && v.unknown > 0
            ? { unknown: v.unknown }
            : {}),
    };
}

// `<lane> | <ticket>[ slice <n>]`; a lone slice joins the lane's latest key of that slice, whichever ticket a fuller
// line gave it
export function roundKeyOf(
    rounds: Record<string, LaneRounds>,
    lane: string,
    ticket: string,
    chunk: { slice?: string; ticket?: string },
) {
    const named = `${lane} | ${ticket}${chunk.slice ? ` slice ${chunk.slice}` : ''}`;
    if (!chunk.slice || chunk.ticket) return named;
    return (
        Object.entries(rounds)
            .filter(
                ([k]) =>
                    k.startsWith(`${lane} | `) &&
                    k.endsWith(` slice ${chunk.slice}`),
            )
            .sort(([, a], [, b]) => (b.at ?? 0) - (a.at ?? 0))[0]?.[0] ?? named
    );
}

// the key after one round, `severe` the P0 and P1 count its line named; undefined for a resend, its sha long or short
export function roundTaken(
    kept: LaneRounds,
    round: { isFinal?: boolean; n: number; sha: string },
    severe: number | undefined,
    at: number,
): LaneRounds | undefined {
    if (
        kept.shas.some(
            (s) => s.startsWith(round.sha) || round.sha.startsWith(s),
        )
    )
        return undefined;
    // a «round 1» opens a key fresh only past the cap, a count left from before (the herdr lane's 8 of 18 Nov): under
    // it a codie numbering every round 1 counts on, so it still reaches the cap (clio's rule, sixth sense round 1 on
    // cf12f156); a bare «final on <sha>» reads as 1 yet may follow rounds, so it never resets (wisphunter on 25430ab6);
    // a lane may open past round 1, and a number sent is never read back as less
    const was: Omit<LaneRounds, 'shas'> =
        round.n === 1 && !round.isFinal && kept.count > ROUND_CAP
            ? { count: 0 }
            : kept;
    const count = Math.max(round.n, was.count + 1);
    const clean = (was.clean ?? 0) + (severe === 0 ? 1 : 0);
    const unknown = (was.unknown ?? 0) + (severe === undefined ? 1 : 0);
    return {
        at,
        ...(clean ? { clean } : {}),
        count,
        shas: [...kept.shas, round.sha],
        ...(unknown ? { unknown } : {}),
    };
}

// the rounds the cap reads, and the unknown ones among them
export const roundOpen = (r: LaneRounds) => ({
    open: r.count - (r.clean ?? 0),
    unknown: r.unknown ?? 0,
});

// the one round store (FRM-504:W49): `~/.claude/shelf/lane-rounds.json`, `<lane> | <ticket>` → the shas codie sent as
// rounds; only this mod writes it, clio's compact-carry and the board read it, so a compact or a reload loses no count.
// a resend adds nothing; the private `lane-rounds:` keys of the build before seed a key the file lacks (clio's call 9)
const LANE_ROUNDS = 'lane-rounds:';
const roundsPath = (home: string) => `${home}/.claude/shelf/lane-rounds.json`;
// a file that does not parse moves aside to `lane-rounds.json.bad`, kept for a look, and the count starts over: one torn
// write never stops every lane's count
async function readRounds($: EngineInterface, home: string) {
    const raw = await $.fs.read(roundsPath(home)).catch(() => undefined);
    // only a file that is not there starts empty: a write over one that would not read loses every other lane
    if (raw === undefined) {
        if (await $.fs.exists(roundsPath(home)).catch(() => true))
            throw new Error('the round file would not read');
        return {};
    }
    try {
        const { rounds } = JSON.parse(raw) as { rounds?: unknown };
        if (rounds && typeof rounds === 'object' && !Array.isArray(rounds))
            return Object.fromEntries(
                Object.entries(rounds).map(([k, v]) => [k, roundsOf(v)]),
            );
    } catch {}
    await $.process.run([
        'mv',
        '-f',
        roundsPath(home),
        `${roundsPath(home)}.bad`,
    ]);
    return {};
}
// several codies write the one file: the joins' lock dir rule, a live writer's waited out for 2 s, a crash's broken
async function roundsLocked<T>(
    $: EngineInterface,
    home: string,
    job: () => Promise<T>,
) {
    const lock = `${roundsPath(home)}.lock`;
    for (let tries = 0; !(await takeJoinLock($, lock)); tries++) {
        if (tries === 20) throw new Error('the round store is locked');
        await $.clock.sleep(100);
    }
    try {
        return await job();
    } finally {
        await $.process.run(['rmdir', lock]);
    }
}
export async function laneRoundLine(
    $: EngineInterface,
    e: Record<string, unknown>,
    result: unknown,
) {
    const round = roundOf(text(e.message) ?? '');
    const to = text(e.to);
    if (!round || !to || (result as { success?: boolean })?.success === false)
        return undefined;
    const self = await selfRecord($);
    if (self?.role !== 'codie' || !self.lane) return undefined;
    if (await isToCoordinator($, to)) return undefined;
    const home = (await $.env.get('HOME')) ?? '';
    // the lane record's ticket, as the card reads it: each chunk opens with clio's dispatch, which moves it (FRM-617 exit
    // 4), where a plan's first open step could be an old chunk's leftover (a false «round 9» on FRM-605, FRM-649)
    const chunk = roundChunkOf(text(e.message) ?? '');
    const ticket = chunk.ticket ?? self.ticket;
    if (!ticket)
        return `round ${round.n} on ${round.sha} not counted (x's record names no ticket): resend the same line once clio's dispatch writes one`;
    const severe = severeOf(text(e.message) ?? '');
    const now = await $.clock.now();
    // a count that could not be taken says so: a silent miss is a cap nobody hears
    const taken = await roundsLocked($, home, async () => {
        const rounds = await readRounds($, home);
        const lane = roundKeyOf(rounds, self.lane ?? '', ticket, chunk);
        const kept =
            rounds[lane] ??
            roundsOf(
                await $.store.get(LANE_ROUNDS + lane).catch(() => undefined),
            );
        const after = roundTaken(kept, round, severe, now);
        if (!after) return undefined;
        await writeWhole(
            $,
            identity.proc?.pid ?? 0,
            roundsPath(home),
            `${JSON.stringify(
                { rounds: { ...rounds, [lane]: after }, v: 1 },
                null,
                2,
            )}\n`,
        );
        return { lane, ...roundOpen(after) };
    }).catch((err: unknown) => errorText(err));
    if (typeof taken === 'string')
        return `round ${round.n} on ${round.sha} not counted (${taken}): resend the same line to count it`;
    // a resend changes nothing and says nothing: its first send's line stands
    // a clean round moves no cap: only the rounds with a P0 or P1 count toward it (crew-dna § the loop)
    if (!taken || severe === 0) return undefined;
    const { lane, open, unknown } = taken;
    if (open <= ROUND_CAP) return roundLine(open, unknown);
    return roundLine(
        open,
        unknown,
        await capTold($, self.sessionId, lane, open, unknown),
    );
}
// past the cap, each new round: one line to the lane's coordinator, the live wing whose glide card links this codie,
// else main clio; the reason it did not go, else undefined
async function capTold(
    $: EngineInterface,
    sid: string,
    lane: string,
    count: number,
    unknown: number,
) {
    const threads = (await threadRecords($)).filter(
        (t) => t.pid !== undefined && t.sessionId !== sid,
    );
    const name = await sessionName($);
    let wing: ThreadRecord | undefined;
    for (const card of await readLanes($)) {
        const { runner } = card;
        const codie = card.members.codie;
        if (card.endedAt || !runner || !codie) continue;
        // a card keeps its codie by registry name, by the id its link resolved, or (an old card) by id alone; the id
        // or the name, as the parked wake reads a member: a resume under a new id leaves the linked one behind
        const linked = card.linkedIds?.codie;
        const isMine =
            (linked && (await successorOf($, linked)) === sid) ||
            (await successorOf($, codie)) === sid ||
            memberKey(codie) === memberKey(name ?? '');
        if (!isMine) continue;
        wing ??= threads.find(
            (t) => t.role === WING_ROLE && bare(runnerOf(t)) === bare(runner),
        );
    }
    const lead = wing ?? threads.find((t) => t.role === MAIN_ROLE);
    if (!lead?.sessionId) return 'no live coordinator';
    const sent = await $.session
        .send({
            text: capLine(lane, count, name ?? sid, unknown),
            to: { sessionId: lead.sessionId },
        })
        .catch((err) => ({
            isDelivered: false as const,
            reason: errorText(err),
        }));
    return sent.isDelivered ? undefined : (sent.reason ?? 'not delivered');
}
