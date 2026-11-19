// the round count's pure half (FRM-504, FRM-656): which key a round lands on and what that key holds after it; the
// shelf file's read, lock and write stay with the caller. no `$`

// clean: the rounds whose line named «P0/P1: 0», written only once one did; count − clean is what the cap reads, a
// round whose line named none among it
export type LaneRounds = {
    at?: number;
    clean?: number;
    count: number;
    shas: string[];
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
    round: { n: number; sha: string },
    severe: number | undefined,
    at: number,
): LaneRounds | undefined {
    if (
        kept.shas.some(
            (s) => s.startsWith(round.sha) || round.sha.startsWith(s),
        )
    )
        return undefined;
    // a round 1 opens a new chunk on its key, so a count left from before starts over (the herdr lane's 8 of 18 Nov);
    // past it a lane may open past round 1, and a number sent is never read back as less
    const was: Omit<LaneRounds, 'shas'> = round.n === 1 ? { count: 0 } : kept;
    const count = Math.max(round.n, was.count + 1);
    const clean = (was.clean ?? 0) + (severe === 0 ? 1 : 0);
    return {
        at,
        ...(clean ? { clean } : {}),
        count,
        shas: [...kept.shas, round.sha],
    };
}
