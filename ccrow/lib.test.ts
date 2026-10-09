import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    type PlanReview,
    blindPrompt,
    blindSections,
    buildPacket,
    isCoordinatorTranscript,
    isLocated,
    planNotes,
    planPrompt,
    readCharter,
    readLines,
    resolveLeaves,
    setHot,
    stashModOf,
    transcriptDelta,
} from './lib.ts';

const fixtures = join(import.meta.dirname, 'fixtures');
const leavesDir = join(fixtures, 'leaves');

test('the boot prompt is the x:crew-adviser skill body, frontmatter cut', () => {
    const charter = readCharter();
    expect(charter.startsWith('you are a parked adviser')).toBe(true);
    expect(charter).toContain('the silence bar');
});

test('ccrow/AGENTS.md holds the mechanics, never the hunts', () => {
    const agents = readFileSync(join(import.meta.dirname, 'AGENTS.md'), 'utf8');
    expect(agents).not.toMatch(/a dropped ask|the silence bar/);
});
const lines = readLines(join(fixtures, 'transcript.jsonl'));

describe('transcriptDelta', () => {
    test('keeps dima, peer and cclio text from the offset on', () => {
        expect(transcriptDelta(lines, 2).text).toBe(
            [
                '## dima\nship the ccrow build',
                '## cclio\non it',
                '## peer\ncoder: done, pr #9',
                '## cclio\ndone, all green',
            ].join('\n\n'),
        );
    });

    test('keeps a message dima typed mid-turn, its image as a marker', () => {
        const queued = [
            JSON.stringify({
                attachment: {
                    prompt: [
                        { type: 'image' },
                        { text: 'the fold bug', type: 'text' },
                    ],
                    type: 'queued_command',
                },
                type: 'attachment',
            }),
        ];
        expect(transcriptDelta(queued, 0).text).toBe(
            '## dima\n[image]\nthe fold bug',
        );
    });

    test('leaves out a peer message queued mid-turn', () => {
        const queued = [
            JSON.stringify({
                attachment: {
                    prompt: '<cross-session-message from="x">hi</cross-session-message>',
                    type: 'queued_command',
                },
                type: 'attachment',
            }),
        ];
        expect(transcriptDelta(queued, 0).text).toBe('');
    });

    test('caps a long task notification and names its output file', () => {
        const report = 'x'.repeat(5_000);
        const note = [
            JSON.stringify({
                message: {
                    content: `<task-notification><output-file>/tmp/a.output</output-file><result>${report}</result></task-notification>`,
                },
                type: 'user',
            }),
        ];
        const text = transcriptDelta(note, 0).text;
        expect(text.length).toBeLessThan(2_200);
        expect(text).toContain('full: /tmp/a.output');
    });

    test('an over-long delta drops whole blocks from its head', () => {
        const big = Array.from({ length: 4 }, (_, i) =>
            JSON.stringify({
                message: { content: `${i}`.repeat(25_000) },
                type: 'user',
            }),
        );
        const text = transcriptDelta(big, 0).text;
        expect(
            text.startsWith('[delta cut: 2 older blocks dropped]\n## dima\n2'),
        ).toBe(true);
    });

    test('counts one step per assistant message id', () => {
        expect(transcriptDelta(lines, 2).steps).toBe(2);
    });
});

describe('readLines', () => {
    test('leaves out a last line that has no newline yet', () => {
        const path = join(mkdtempSync(join(tmpdir(), 'ccrow-')), 't.jsonl');
        writeFileSync(path, '{"a":1}\n{"b":');
        expect(readLines(path)).toEqual(['{"a":1}']);
    });
});

describe('resolveLeaves', () => {
    test('expands {today} into every match of the day', () => {
        const { found } = resolveLeaves(
            [`${leavesDir}/flawlog/{today}-*.md`],
            '2026-10-06',
        );
        expect(found.map((path) => path.split('/').at(-1))).toEqual([
            '2026-10-06-a.md',
            '2026-10-06-b.md',
        ]);
    });

    test('takes only the newest match for a latest line', () => {
        const dir = mkdtempSync(join(tmpdir(), 'ccrow-'));
        for (const [name, time] of [
            ['old.md', 1000],
            ['new.md', 2000],
        ] as const) {
            writeFileSync(join(dir, name), name);
            utimesSync(join(dir, name), time, time);
        }
        const { found } = resolveLeaves([`latest ${dir}/*.md`], '2026-10-06');
        expect(found.map((path) => path.split('/').at(-1))).toEqual(['new.md']);
    });

    test('reports a line with no match', () => {
        const { missing } = resolveLeaves(
            [`${leavesDir}/nope.md`],
            '2026-10-06',
        );
        expect(missing).toEqual([`${leavesDir}/nope.md`]);
    });
});

describe('buildPacket', () => {
    test('copies each leaf beside a delta file', () => {
        const dir = join(mkdtempSync(join(tmpdir(), 'ccrow-')), 'packet');
        buildPacket({
            deltaText: '## dima\nhi',
            dir,
            leaves: [join(leavesDir, 'strategy.md')],
            missing: [],
        });
        expect(readdirSync(dir).toSorted()).toEqual([
            'delta.md',
            'strategy.md',
        ]);
        expect(readFileSync(join(dir, 'strategy.md'), 'utf8')).toBe(
            'vector: ship the fleet\n',
        );
    });
});

describe('stashModOf', () => {
    test('picks the plugin dir named stash, whatever the dir is called', () => {
        const home = mkdtempSync(join(tmpdir(), 'ccrow-mods-'));
        for (const [dir, name] of [
            ['breather', 'breather'],
            ['renamed', 'x-mod-stash'],
        ] as const) {
            mkdirSync(join(home, dir, '.claude-plugin'), { recursive: true });
            writeFileSync(
                join(home, dir, '.claude-plugin/plugin.json'),
                JSON.stringify({ name }),
            );
        }
        expect(stashModOf('~/breather:~/renamed', home)).toEqual({
            dir: join(home, 'renamed'),
            name: 'x-mod-stash',
        });
    });
});

describe('setHot', () => {
    test('adds the session hot key beside the keys already stored', () => {
        const store = join(
            mkdtempSync(join(tmpdir(), 'ccrow-store-')),
            's.json',
        );
        writeFileSync(store, JSON.stringify({ afk: false }));
        setHot(store, 'abc', 5);
        expect(JSON.parse(readFileSync(store, 'utf8'))).toEqual({
            afk: false,
            'hot:abc': { since: 5 },
        });
    });
});

const plan = readFileSync(join(fixtures, 'plan.md'), 'utf8');

describe('plan prompts', () => {
    test('carry no line of cclio’s transcript and no earlier verdict', () => {
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

    test('logs one line per finding, each with its arm and cost', () => {
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
                id: 'plan-202610062000-1',
                located: true,
            },
            {
                arm: 'fable',
                costUsd: 0.4,
                id: 'plan-202610062000-2',
                located: false,
            },
        ]);
    });
});

describe('isCoordinatorTranscript', () => {
    const sessions = mkdtempSync(join(tmpdir(), 'ccrow-sessions-'));
    writeFileSync(
        join(sessions, '6020.json'),
        JSON.stringify({ name: '🦉 cclio', sessionId: 'aaa' }),
    );
    writeFileSync(
        join(sessions, '3356.json'),
        JSON.stringify({ name: '☕️ 🔧 coder: mods', sessionId: 'bbb' }),
    );

    test('a transcript of the session named cclio wakes ccrow', () => {
        expect(isCoordinatorTranscript('/p/aaa.jsonl', sessions)).toBe(true);
    });

    test('a coder transcript under the cclio dir does not', () => {
        expect(isCoordinatorTranscript('/p/bbb.jsonl', sessions)).toBe(false);
    });
});
