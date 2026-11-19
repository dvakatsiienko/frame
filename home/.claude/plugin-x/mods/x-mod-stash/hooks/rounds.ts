// the round count's pure half (FRM-504, FRM-656): which key a round lands on and what that key holds after it; the
// shelf file's read, lock and write stay with the caller. no `$`

import { ROUND_CAP } from './parse.ts';

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
