import { randomBytes } from 'node:crypto';
import {
    closeSync,
    mkdirSync,
    openSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import {
    type Arm,
    type Effort,
    MAIN_THREAD,
    type Mode,
    NOTES_PATH,
    type Phase,
    STATE_DIR,
    type State,
    VERDICTS_PATH,
    type changedList,
    localDay,
    pad,
    threadOfNoteId,
    wakeIdOf,
} from './lib.ts';

// four parallel critiques in one second minted one id (flyway f60): a random suffix keeps every run's note ids its own,
// and no shared counter means two processes never wait on each other
export function planRunIdOf(now: Date) {
    return `${wakeIdOf(now)}${pad(now.getSeconds())}-${randomBytes(3).toString('hex')}`;
}

export function appendJsonl(path: string, value: Note | PlanNote | Verdict) {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(path, `${JSON.stringify(value)}\n`, { flag: 'a' });
}

// two harvesters on one wake wrote the same note 2 ms apart (11-03, 11-04), past a read of the file, so a claim file decides
export function appendNoteOnce(path: string, value: Note) {
    if (jsonlOf<{ id?: string }>(path).some((row) => row.id === value.id))
        return;
    const claims = `${path}.ids`;
    mkdirSync(claims, { recursive: true });
    try {
        closeSync(openSync(join(claims, value.id), 'wx'));
    } catch {
        return;
    }
    appendJsonl(path, value);
}

// a held note opens with «🟡 held:» since 10-12; older ones end on «holdout»
const isHeld = (n: { note: string }) =>
    /^🟡 held:/m.test(n.note) || /holdout\s*$/.test(n.note);

// a restart loses what the last crow held: its notes of the last hour with nothing sent after them
export const HELD_HEAD = '## held by the last crow';

export function packetCarriedHeld(wakeId: string) {
    try {
        return readFileSync(
            join(STATE_DIR, 'packets', wakeId, 'packet.md'),
            'utf8',
        ).includes(HELD_HEAD);
    } catch {
        return false;
    }
}

// heldFor was one transcript before the threads split, and only main had a thread then
export const heldMapOf = (state: State): Record<string, string> =>
    typeof state.heldFor === 'string'
        ? { [MAIN_THREAD]: state.heldFor }
        : (state.heldFor ?? {});

// no heldFor yet: the crow that read the leaves is the live one, so its own hold stays its own
export const isHeldDue = (
    state: State,
    crowTranscript?: string,
    thread = MAIN_THREAD,
) => (heldMapOf(state)[thread] ?? state.leavesFor) !== crowTranscript;

// moves only after crow took a turn: a parked or dropped relay keeps the note due, and a /clear
// relay that carried none leaves it due for the transcript the relay landed in
export function heldForAfterTurn(
    state: State,
    turnPath: string,
    packetCarriedHeld: boolean,
    thread = MAIN_THREAD,
) {
    return state.leavesFor === turnPath || packetCarriedHeld
        ? turnPath
        : (heldMapOf(state)[thread] ?? state.leavesFor);
}

// a thread's packet carries only the notes crow holds for that thread, and a note sent to another settles none of them
export function heldUnsent(
    now: Date,
    notesPath = NOTES_PATH,
    thread = MAIN_THREAD,
) {
    const since = now.getTime() - 3_600_000;
    const rows = jsonlOf<{
        at?: string;
        channel?: string;
        id?: string;
        note?: string;
    }>(notesPath)
        .filter((n) => n.channel === 'session' && typeof n.note === 'string')
        .map((n) => ({
            at: n.at ?? '',
            id: n.id ?? '',
            note: (n.note ?? '').trim(),
        }))
        .filter(
            (n) =>
                new Date(n.at).getTime() > since &&
                threadOfNoteId(n.id) === thread,
        );
    const lastSent = rows.findLastIndex(
        (n) => n.note && n.note !== 'none' && !isHeld(n),
    );
    return rows.slice(lastSent + 1).filter(isHeld);
}

export function ledgerLine(
    now: Date,
    notesPath = NOTES_PATH,
    verdictsPath = VERDICTS_PATH,
    thread = MAIN_THREAD,
) {
    const today = localDay(now);
    const notes = jsonlOf<{
        at?: string;
        channel?: string;
        id?: string;
        note?: string;
    }>(notesPath)
        .filter(
            (n) =>
                n.channel === 'session' &&
                typeof n.note === 'string' &&
                threadOfNoteId(n.id ?? '') === thread,
        )
        .map((n) => ({ at: new Date(n.at ?? 0), note: (n.note ?? '').trim() }));
    const wouldSend = notes.filter((n) => n.note !== 'none' && n.note !== '');
    const sent = wouldSend.filter((n) => !isHeld(n));
    const sentToday = sent.filter((n) => localDay(n.at) === today).length;
    const last = sent.at(-1)?.at;
    const hits = jsonlOf<{ at?: string; id?: string; value?: string }>(
        verdictsPath,
    ).filter(
        (v) =>
            v.value === 'ok' &&
            localDay(new Date(v.at ?? 0)) === today &&
            threadOfNoteId(v.id ?? '') === thread,
    ).length;
    return [
        `📒 ${sentToday} sent today`,
        `last ${last ? `${pad(last.getHours())}:${pad(last.getMinutes())}` : 'none'}`,
        `🎯 ${hits} ok today`,
    ].join(' | ');
}

function jsonlOf<T>(path: string): T[] {
    let text = '';
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        return [];
    }
    return text.split('\n').flatMap((line) => {
        try {
            return line.trim() ? [JSON.parse(line) as T] : [];
        } catch {
            return [];
        }
    });
}

const blindHeading = /\b(want|constraints?|done test|not)\b/i;

// pass 1 sees only the sections that say what is wanted, never how
export function blindSections(plan: string) {
    const kept: string[] = [];
    let level = 0;
    let keep = false;
    let fenced = false;
    for (const line of plan.split('\n')) {
        if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
        const heading = fenced ? null : /^(#{1,6})\s+(.*)$/.exec(line);
        const depth = heading?.[1]?.length ?? 0;
        if (heading && (!keep || depth <= level)) {
            keep = blindHeading.test(heading[2] ?? '');
            level = depth;
        }
        if (keep) kept.push(line);
    }
    return kept.join('\n').trim();
}

export function blindPrompt(sections: string) {
    return `you are an outside adviser. someone wants the thing below built; no plan exists yet. you see the want, the constraints and the done test only.

give, in under 300 words:
- your top 3 approaches, one line each with its main tradeoff
- the 5 likeliest ways any approach to this fails

do not read files and do not ask questions; answer from the text.

${sections}`;
}

export const PLAN_FINDINGS_MAX = 5;

export function planPrompt(plan: string, blindTake: string) {
    const blind = blindTake
        ? `\n## your own take, written before you saw the plan\n\n${blindTake}\n`
        : '';
    return `you are an outside adviser arguing with a plan before anything is built. you were not in the room; the plan is all you get: do not read files and do not ask questions; answer from the text.

work through this template, in order:
1. predict the 3–5 likeliest problem areas before reading in detail
2. a pre-mortem: assume this plan was executed exactly as written and failed — 5 concrete failure scenarios
3. the strongest argument against each decision, and the alternative that was likely rejected
4. what is missing
5. the fragile assumptions, each rated high, medium or low
6. a self-audit per finding: could the author refute it with context you lack? if yes, it moves to the open questions instead
7. at most ${PLAN_FINDINGS_MAX} findings, each quoting the exact plan line it targets (copied verbatim, one line), with a cheap test that would confirm it
8. a verdict: proceed, revise, investigate or reject. «no material objection» is an allowed answer — then findings may be empty
${blind}
## the plan

${plan}`;
}

const strings = { items: { type: 'string' }, type: 'array' };

const rated = { enum: ['high', 'medium', 'low'] };

export const planSchema = {
    additionalProperties: false,
    properties: {
        againstDecisions: {
            items: {
                additionalProperties: false,
                properties: {
                    alternative: { type: 'string' },
                    argument: { type: 'string' },
                    decision: { type: 'string' },
                },
                required: ['decision', 'argument', 'alternative'],
                type: 'object',
            },
            type: 'array',
        },
        findings: {
            items: {
                additionalProperties: false,
                properties: {
                    problem: { type: 'string' },
                    quote: { type: 'string' },
                    severity: rated,
                    test: { type: 'string' },
                },
                required: ['quote', 'problem', 'severity', 'test'],
                type: 'object',
            },
            maxItems: PLAN_FINDINGS_MAX,
            type: 'array',
        },
        fragileAssumptions: {
            items: {
                additionalProperties: false,
                properties: {
                    assumption: { type: 'string' },
                    rating: rated,
                },
                required: ['assumption', 'rating'],
                type: 'object',
            },
            type: 'array',
        },
        missing: strings,
        noMaterialObjection: { type: 'boolean' },
        openQuestions: strings,
        preMortem: strings,
        problemAreas: strings,
        verdict: { enum: ['proceed', 'revise', 'investigate', 'reject'] },
    },
    required: [
        'problemAreas',
        'preMortem',
        'againstDecisions',
        'missing',
        'fragileAssumptions',
        'openQuestions',
        'findings',
        'verdict',
        'noMaterialObjection',
    ],
    type: 'object',
};

const squash = (text: string) => text.replaceAll(/\s+/g, ' ').trim();

// a finding counts as located only when its quote is really in the plan
export function isLocated(plan: string, quote: string) {
    const needle = squash(quote.replace(/^[\s>*-]+/, ''));
    return needle.length > 0 && squash(plan).includes(needle);
}

export function planNotes(run: PlanRun, review: PlanReview): PlanNote[] {
    const { planText, ...base } = run;
    const shared = {
        ...base,
        channel: 'plan' as const,
        noMaterialObjection: review.noMaterialObjection,
        verdict: review.verdict,
    };
    // the schema caps findings, but the model's json is still untrusted input
    const findings = review.findings.slice(0, PLAN_FINDINGS_MAX);
    const { costUsd, ...perFinding } = shared;
    // the -0 row is the run: the cost sits there once, so summing the rows gives the run's cost
    return [
        { ...shared, finding: null, id: `plan-${run.runId}-0` },
        ...findings.map((finding, index) => ({
            ...perFinding,
            finding: {
                ...finding,
                located: isLocated(planText, finding.quote),
            },
            id: `plan-${run.runId}-${index + 1}`,
        })),
    ];
}

/* Types */

export interface Note {
    id: string;
    wakeId: string;
    arm: Arm;
    channel: 'session' | 'one-shot';
    model: string | null;
    effort: 'medium';
    tokensIn: number;
    tokensOut: number;
    seconds: number;
    mode: Mode;
    phase: Phase;
    note: string;
    at: string;
}

export interface Verdict {
    id: string;
    value: 'ok' | 'miss';
    why: string;
    at: string;
    changed?: (typeof changedList)[number];
    ref?: string;
}

type Rating = 'high' | 'medium' | 'low';

export interface PlanFinding {
    quote: string;
    problem: string;
    severity: Rating;
    test: string;
}

export interface PlanReview {
    problemAreas: string[];
    preMortem: string[];
    againstDecisions: {
        decision: string;
        argument: string;
        alternative: string;
    }[];
    missing: string[];
    fragileAssumptions: { assumption: string; rating: Rating }[];
    openQuestions: string[];
    findings: PlanFinding[];
    verdict: 'proceed' | 'revise' | 'investigate' | 'reject';
    noMaterialObjection: boolean;
}

export interface PlanRun {
    runId: string;
    arm: Arm;
    model: string | null;
    effort: Effort;
    plan: string;
    planText: string;
    costUsd: number;
    tokensIn: number;
    tokensOut: number;
    seconds: number;
    at: string;
}

// one line per finding; accepted is a `crow:note-vet` verdict on its id, never a field here
export interface PlanNote extends Omit<PlanRun, 'planText' | 'costUsd'> {
    costUsd?: number;
    id: string;
    channel: 'plan';
    verdict: PlanReview['verdict'];
    noMaterialObjection: boolean;
    finding: (PlanFinding & { located: boolean }) | null;
}
