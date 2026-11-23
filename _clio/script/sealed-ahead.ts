// the pure half of siesta-checks' «sealed ahead» (FRM-693): for each running chunk, are the next two chunks behind it
// sealed? a lane parks into a chunk nobody sealed, and the idle alarm only rings after the stall

// x brief preflight's own words for a sealed spec whose recorded hash trails the ticket's newest sign
const RESEAL_TEXT = 'sync the section to the re-sign';
const CLOSED_STATES = ['Canceled', 'Done', 'Duplicate'];
// whose move turns each state green: sealed needs none
const MOVES = {
    'none queued': 'queue one (clio)',
    reseal: 'seal (clio)',
    sealed: '',
    'signed, not sealed': 'seal (clio)',
    unsigned: 'sign (dima)',
} as const satisfies Record<string, string>;

export function sealedAhead(running: RunningChunk[]) {
    if (!running.length) return { exit: 0, lines: ['🟢 no running lane'] };
    const rows = running.map((chunk) => {
        const slots = [chunk.next, chunk.after].map((ticket) => ({
            state: aheadState(ticket),
            ticket,
        }));
        const text = slots
            .map(
                (s, i) =>
                    `${i + 1} ${s.ticket ? `${s.ticket.id} ` : ''}${s.state}`,
            )
            .join(' · ');
        const open = slots.find((s) => s.state !== 'sealed');
        return {
            line: open
                ? `🔴 ${chunk.id} → ${text} — ${MOVES[open.state]}`
                : `🟢 ${chunk.id} → ${text}`,
            red: open !== undefined,
        };
    });
    return {
        exit: rows.some((r) => r.red) ? 1 : 0,
        lines: rows.map((r) => r.line),
    };
}

// the open tickets a ticket blocks: a closed one is no chunk to queue
export function blockedIds(relations: Relation[] = []) {
    return relations
        .filter((r) => r.type === 'blocks' && !CLOSED_STATES.includes(r.state))
        .map((r) => r.id);
}

// the next chunk among several: a sealed one, then a signed one, then an unsigned one, ties by lowest id
export function pickNext<T extends Ahead>(candidates: T[]): T | null {
    const rank = (c: Ahead) => (c.preflightOk ? 0 : c.signed ? 1 : 2);
    return (
        candidates.toSorted(
            (a, b) =>
                rank(a) - rank(b) ||
                a.id.localeCompare(b.id, undefined, { numeric: true }),
        )[0] ?? null
    );
}

function aheadState(ticket: Ahead | null): AheadState {
    if (!ticket) return 'none queued';
    if (ticket.preflightOk) return 'sealed';
    if (ticket.preflightError.includes(RESEAL_TEXT)) return 'reseal';
    return ticket.signed ? 'signed, not sealed' : 'unsigned';
}

/* Types */

type AheadState = keyof typeof MOVES;

export type Ahead = {
    id: string;
    preflightError: string;
    preflightOk: boolean;
    signed: boolean;
};

export type Relation = { id: string; state: string; type: string };

export type RunningChunk = {
    after: Ahead | null;
    id: string;
    next: Ahead | null;
};
