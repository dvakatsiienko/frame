import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    type Note,
    type PlanReview,
    appendNoteOnce,
    blindPrompt,
    blindSections,
    heldForAfterTurn,
    heldUnsent,
    isHeldDue,
    isLocated,
    ledgerLine,
    planNotes,
    planPrompt,
    planRunIdOf,
} from './notes.ts';
import { buildPacket } from './packet.ts';
import { fixtures, lines } from './test-rows.ts';
import { readLines, transcriptDelta } from './transcript.ts';
import { unvettedIds } from './unvetted-ids.ts';

describe('appendNoteOnce', () => {
    test('a second note with the same id is not appended', () => {
        const path = join(mkdtempSync(join(tmpdir(), 'crow-')), 'notes.jsonl');
        const note = {
            at: '2026-10-21T10:53:45Z',
            channel: 'session',
            id: 'w1-opus',
            note: 'x',
        } as Note;
        appendNoteOnce(path, note);
        appendNoteOnce(path, note);
        expect(readLines(path)).toHaveLength(1);
    });

    test('a racer that read the file before the first write still writes nothing', () => {
        const path = join(mkdtempSync(join(tmpdir(), 'crow-')), 'notes.jsonl');
        mkdirSync(`${path}.ids`);
        writeFileSync(join(`${path}.ids`, 'w1-opus'), '');
        appendNoteOnce(path, { id: 'w1-opus', note: 'x' } as Note);
        expect(existsSync(path)).toBe(false);
    });
});

const plan = readFileSync(join(fixtures, 'plan.md'), 'utf8');

describe('plan prompts', () => {
    test('carry no line of clio’s transcript and no earlier verdict', () => {
        const earlier = [
            'the rename finding was right, dima took it',
            'store writes race under two shells',
        ];
        const prompts = [
            blindPrompt(blindSections(plan)),
            planPrompt(plan, 'a blind take'),
        ].join('\n');
        const transcriptLines = transcriptDelta(lines, 0)
            .text.split('\n')
            .filter((line) => line.trim() && !line.startsWith('## '));
        expect(transcriptLines.length).toBeGreaterThan(0);
        expect(
            [...transcriptLines, ...earlier].filter((line) =>
                prompts.includes(line),
            ),
        ).toEqual([]);
    });
});

describe('blindSections', () => {
    test('keeps every want, not and done-test section', () => {
        const blind = blindSections(plan);
        expect(
            [
                'one keystroke per count',
                'not a habit tracker',
                'then it prints 4',
            ].filter((line) => !blind.includes(line)),
        ).toEqual([]);
    });

    test('drops the build sections, their subsections too', () => {
        const blind = blindSections(plan);
        expect(
            ['a go binary', 'temp file and a rename'].filter((line) =>
                blind.includes(line),
            ),
        ).toEqual([]);
    });

    test('reads a # line inside a code fence as text, never a heading', () => {
        const fenced =
            '## the want\n\n```sh\n# the build\n```\n\nstill the want';
        expect(blindSections(fenced)).toContain('still the want');
    });
});

describe('isLocated', () => {
    test('finds a quote copied with its bullet and new spacing', () => {
        expect(
            isLocated(plan, '- writes go  through a temp file and a rename'),
        ).toBe(true);
    });

    test('rejects a quote the plan does not hold', () => {
        expect(isLocated(plan, 'writes go straight to the file')).toBe(false);
    });
});

describe('planNotes', () => {
    const run = {
        arm: 'fable',
        at: '2026-10-06T20:00:00.000Z',
        costUsd: 0.4,
        effort: 'high',
        model: 'claude-fable-5-1',
        plan: '/p/plan.md',
        planText: plan,
        runId: '202610062000',
        seconds: 90,
        tokensIn: 10,
        tokensOut: 5,
    } as const;
    const review = {
        againstDecisions: [],
        findings: [],
        fragileAssumptions: [],
        missing: [],
        noMaterialObjection: true,
        openQuestions: [],
        preMortem: [],
        problemAreas: [],
        verdict: 'proceed',
    } satisfies PlanReview;

    test('logs a clean run as one line with no finding', () => {
        expect(planNotes(run, { ...review, findings: [] })).toMatchObject([
            { channel: 'plan', finding: null, id: 'plan-202610062000-0' },
        ]);
    });

    test('logs the run row plus one line per finding, the cost once', () => {
        const finding = {
            problem: 'p',
            severity: 'high',
            test: 't',
        } as const;
        const notes = planNotes(run, {
            ...review,
            findings: [
                { ...finding, quote: 'a go binary, state in one json file' },
                { ...finding, quote: 'an invented line' },
            ],
            noMaterialObjection: false,
            verdict: 'revise',
        });
        expect(
            notes.map(({ arm, costUsd, finding: f, id }) => ({
                arm,
                costUsd,
                id,
                located: f?.located,
            })),
        ).toEqual([
            {
                arm: 'fable',
                costUsd: 0.4,
                id: 'plan-202610062000-0',
                located: undefined,
            },
            {
                arm: 'fable',
                costUsd: undefined,
                id: 'plan-202610062000-1',
                located: true,
            },
            {
                arm: 'fable',
                costUsd: undefined,
                id: 'plan-202610062000-2',
                located: false,
            },
        ]);
    });

    test('five findings sum to the cost of the run', () => {
        const finding = {
            problem: 'p',
            quote: 'q',
            severity: 'high',
            test: 't',
        } as const;
        const notes = planNotes(run, {
            ...review,
            findings: Array.from({ length: 5 }, () => finding),
        });
        expect(notes.reduce((sum, n) => sum + (n.costUsd ?? 0), 0)).toBe(0.4);
    });

    // 20 Nov (flyway f60): four runs in one second minted one id, so the vet count read 5 findings as 20
    test('four runs in one second, two on one plan, never share a note id, and each finding is owed once', () => {
        const second = new Date(2026, 10, 20, 17, 12, 30);
        const finding = {
            problem: 'p',
            quote: 'a go binary, state in one json file',
            severity: 'high',
            test: 't',
        } as const;
        const notes = Array.from({ length: 4 }, () =>
            planNotes(
                { ...run, runId: planRunIdOf(second) },
                { ...review, findings: [finding] },
            ).map((note) => ({ ...note, thread: 'main' })),
        ).flat();
        const ids = notes.map((n) => n.id);
        expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
        expect(unvettedIds(notes, new Set(), 'main')).toHaveLength(4);
    });

    test('a run id reads as its minute and second, then a random suffix', () => {
        expect(planRunIdOf(new Date(2026, 10, 20, 17, 12, 30))).toMatch(
            /^20261120171230-[0-9a-f]{6}$/,
        );
    });
});

describe('heldUnsent', () => {
    const NOW = new Date(2026, 10, 3, 13, 0);
    const ago = (min: number) =>
        new Date(NOW.getTime() - min * 60_000).toISOString();
    const session = (note: string, min: number) => ({
        at: ago(min),
        channel: 'session',
        id: `n${min}`,
        note,
    });
    function notes(...rows: object[]) {
        const path = join(mkdtempSync(join(tmpdir(), 'crow-held-')), 'n.jsonl');
        writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n'));
        return path;
    }
    const HELD = '🟡 held: until the break';

    test('a held note with nothing sent after it comes back', () => {
        expect(
            heldUnsent(NOW, notes(session(HELD, 10))).map((n) => n.id),
        ).toEqual(['n10']);
    });
    test('a note sent after it settles it, so a sent note is never resent', () => {
        expect(
            heldUnsent(NOW, notes(session(HELD, 10), session('🔴 sent: x', 5))),
        ).toEqual([]);
    });
    test('a none after it settles nothing', () => {
        expect(
            heldUnsent(NOW, notes(session(HELD, 10), session('none', 5))),
        ).toHaveLength(1);
    });
    test('past 60 min it is gone, and another channel never counts', () => {
        expect(heldUnsent(NOW, notes(session(HELD, 61)))).toEqual([]);
        expect(
            heldUnsent(NOW, notes({ ...session(HELD, 10), channel: 'plan' })),
        ).toEqual([]);
    });
    test('no notes file is none', () => {
        expect(heldUnsent(NOW, '/nope/n.jsonl')).toEqual([]);
    });
    test("a thread's packet holds only its own notes, and another thread's send settles none", () => {
        const wingHeld = { ...session(HELD, 10), id: '202611031250w2-opus' };
        const path = notes(wingHeld, session('🔴 sent: x', 5));
        expect([
            heldUnsent(NOW, path, 'wing-2').map((n) => n.id),
            heldUnsent(NOW, path),
        ]).toEqual([['202611031250w2-opus'], []]);
    });
    test('the packet carries the section, and a wake with none leaves it out', () => {
        const dir = join(mkdtempSync(join(tmpdir(), 'crow-')), 'packet');
        buildPacket({
            deltaText: 'x',
            dir,
            held: [{ at: ago(10), id: 'n10', note: HELD }],
            leaves: [],
            missing: [],
        });
        const text = readFileSync(join(dir, 'packet.md'), 'utf8');
        expect(text).toContain('## held by the last crow');
        expect(text).toContain(HELD);
        buildPacket({ deltaText: 'x', dir, leaves: [], missing: [] });
        expect(readFileSync(join(dir, 'packet.md'), 'utf8')).not.toContain(
            'held by the last crow',
        );
    });
});

describe('ledgerLine', () => {
    const NOW = new Date(2026, 9, 11, 21, 0);
    const at = (h: number, m: number, day = 11) =>
        new Date(2026, 9, day, h, m).toISOString();
    function files(notes: object[], verdicts: object[] = []) {
        const dir = mkdtempSync(join(tmpdir(), 'crow-ledger-'));
        const jsonl = (rows: object[]) =>
            rows.map((r) => JSON.stringify(r)).join('\n');
        writeFileSync(join(dir, 'notes.jsonl'), jsonl(notes));
        writeFileSync(join(dir, 'verdicts.jsonl'), jsonl(verdicts));
        return [join(dir, 'notes.jsonl'), join(dir, 'verdicts.jsonl')] as const;
    }
    const session = (note: string, time: string) => ({
        at: time,
        channel: 'session',
        note,
    });

    test('counts today sent notes, never a none, a holdout or another day', () => {
        const [n, v] = files([
            session('🐦‍⬛ **a** | sent | x', at(9, 0)),
            session('none', at(10, 0)),
            session('🐦‍⬛ **b** | held | y\nholdout', at(11, 0)),
            session('🐦‍⬛ 21:10 wake 1\n🟡 held: one finding', at(21, 10)),
            session('🐦‍⬛ **c** | sent | z', at(9, 0, 10)),
            { at: at(12, 0), channel: 'plan', note: 'p' },
            session('🐦‍⬛ **d** | sent | w', at(20, 56)),
        ]);
        expect(ledgerLine(NOW, n, v)).toBe(
            '📒 2 sent today | last 20:56 | 🎯 0 ok today',
        );
    });

    test("counts only today's ok verdicts", () => {
        const [n, v] = files(
            [],
            [
                { at: at(9, 0), id: 'a', value: 'ok' },
                { at: at(9, 0), id: 'b', value: 'miss' },
                { at: at(9, 0, 10), id: 'c', value: 'ok' },
            ],
        );
        expect(ledgerLine(NOW, n, v)).toBe(
            '📒 0 sent today | last none | 🎯 1 ok today',
        );
    });
});

describe('heldForAfterTurn', () => {
    const state = (heldFor: string, leavesFor: string) => ({
        heldFor,
        leavesFor,
        offsets: {},
    });

    test('a turn in the packed transcript settles it', () => {
        expect(heldForAfterTurn(state('t1', 't2'), 't2', false)).toBe('t2');
    });

    test('a /clear relay with no note leaves it due for the new transcript', () => {
        expect(heldForAfterTurn(state('t1', 't1'), 't2', false)).toBe('t1');
    });

    test('a /clear relay that carried the note settles it, no second copy', () => {
        expect(heldForAfterTurn(state('t0', 't1'), 't2', true)).toBe('t2');
    });
});

test('before any heldFor, the crow that read the leaves keeps its own hold', () => {
    expect(isHeldDue({ leavesFor: 't1', offsets: {} }, 't1')).toBe(false);
    expect(isHeldDue({ leavesFor: 't1', offsets: {} }, 't2')).toBe(true);
});
