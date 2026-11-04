import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    type Note,
    type PlanReview,
    appendNoteOnce,
    blindPrompt,
    blindSections,
    buildPacket,
    charterHash,
    claimOf,
    consoleOf,
    cutLine,
    decisionOf,
    dropStaleRelay,
    isCoordinatorTranscript,
    isLocated,
    isParked,
    leavesToSend,
    ledgerLine,
    meterLine,
    planNotes,
    planPrompt,
    prViewArgs,
    proposalOf,
    readCharter,
    readLines,
    readTurn,
    receiptsOf,
    resolveLeaves,
    setHot,
    stashModOf,
    transcriptDelta,
    wakeLine,
} from './lib.ts';

describe('proposalOf reads a proposal written by Bash', () => {
    test('a heredoc redirect into a proposal file wakes', () => {
        expect(
            proposalOf(
                'Bash',
                undefined,
                "cat > .scratch/x/grill-1-proposal.md <<'EOF'",
            ),
        ).toEqual({ kind: 'proposal', path: '.scratch/x/grill-1-proposal.md' });
    });

    test('a tee into a proposal file wakes', () => {
        expect(
            proposalOf(
                'Bash',
                undefined,
                'echo hi | tee -a /a/.scratch/b-proposal.md',
            ),
        ).toEqual({ kind: 'proposal', path: '/a/.scratch/b-proposal.md' });
    });

    test('a ~ path wakes with the home dir expanded', () => {
        expect(
            proposalOf(
                'Bash',
                undefined,
                "cat >> ~/frame/_clio/.scratch/pk159/grill-1-proposal.md <<'EOF'",
            ),
        ).toEqual({
            kind: 'proposal',
            path: `${homedir()}/frame/_clio/.scratch/pk159/grill-1-proposal.md`,
        });
    });

    test('a command that only reads a proposal file stays quiet', () => {
        expect(
            proposalOf('Bash', undefined, 'cat .scratch/x/grill-1-proposal.md'),
        ).toBeUndefined();
    });
});

const fixtures = join(import.meta.dirname, 'fixtures');
const leavesDir = join(fixtures, 'leaves');

test('the boot prompt is the x:crew-adviser skill body, frontmatter cut', () => {
    const charter = readCharter();
    expect(charter.startsWith('you are crow')).toBe(true);
    expect(charter).toContain('the silence bar');
});

test('a wake line names a charter a cleared session can read', () => {
    const line = wakeLine({ id: '202610100900', mode: 'day', phase: 'live' });
    const [, hash, charter] = /· charter (\w{8}) (\S+)$/.exec(line) ?? [];
    expect(hash).toBe(charterHash());
    expect(existsSync(charter ?? '')).toBe(true);
});

test('_crow/AGENTS.md holds the mechanics, never the hunts', () => {
    const agents = readFileSync(join(import.meta.dirname, 'AGENTS.md'), 'utf8');
    expect(agents).not.toMatch(/a dropped ask|the silence bar/);
});
const lines = readLines(join(fixtures, 'transcript.jsonl'));

describe('transcriptDelta', () => {
    test('keeps dima, peer and clio text from the offset on', () => {
        expect(transcriptDelta(lines, 2).text).toBe(
            [
                '## dima\nship the crow build',
                '## clio\non it',
                '## peer\ncoder: done, pr #9',
                '## clio\ndone, all green',
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

    test("keeps dima's orbit marks and notes, drops the other hook context", () => {
        const hooked = [
            JSON.stringify({
                attachment: {
                    content: [
                        'now 15:48',
                        'orbit: dima marked 1 ask.\n- o98 🛎️ accepted: hazards · his note: «which workflows?»',
                    ],
                    hookEvent: 'UserPromptSubmit',
                    type: 'hook_additional_context',
                },
                type: 'attachment',
            }),
            JSON.stringify({
                attachment: {
                    content: ['phases not set this turn'],
                    hookEvent: 'PreToolUse',
                    type: 'hook_additional_context',
                },
                type: 'attachment',
            }),
        ];
        expect(transcriptDelta(hooked, 0).text).toBe(
            '## dima\norbit: dima marked 1 ask.\n- o98 🛎️ accepted: hazards · his note: «which workflows?»',
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
        const delta = transcriptDelta(big, 0);
        expect([delta.text.startsWith('## dima\n2'), delta.cut.blocks]).toEqual(
            [true, 2],
        );
    });

    test('counts one step per assistant message id', () => {
        expect(transcriptDelta(lines, 2).steps).toBe(2);
    });

    test('a compaction that replays the old chain keeps every block since the last wake', () => {
        const entry = (uuid: string, timestamp: string, text: string) =>
            JSON.stringify({
                message: { content: text },
                timestamp,
                type: 'user',
                uuid,
            });
        const oldChain = ['a', 'b', 'c'].map((uuid, i) =>
            entry(
                uuid,
                `2026-10-22T14:0${i}:00Z`,
                `old-${uuid} ${'x'.repeat(25_000)}`,
            ),
        );
        const compacted = [
            ...oldChain,
            entry('d', '2026-10-22T16:23:00Z', 'new-d'),
            entry('e', '2026-10-22T16:39:00Z', 'new-e'),
            ...oldChain,
            JSON.stringify({
                subtype: 'compact_boundary',
                timestamp: '2026-10-22T16:48:19Z',
                type: 'system',
                uuid: 'f',
            }),
            entry('g', '2026-10-22T16:49:00Z', 'new-g'),
        ];
        const bodies = transcriptDelta(compacted, oldChain.length)
            .text.split(/\n\n(?=## )/)
            .map((block) => block.split('\n')[1]);
        expect(bodies).toEqual(['new-d', 'new-e', 'new-g']);
    });

    test("leaves out a compaction's summary, which is cc's text, not dima's", () => {
        const summary = [
            JSON.stringify({
                isCompactSummary: true,
                message: {
                    content:
                        'This session is being continued from a previous conversation',
                },
                type: 'user',
                uuid: 'h',
            }),
        ];
        expect(transcriptDelta(summary, 0).text).toBe('');
    });
});

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

const toolUse = (id: string, name: string, input: object) =>
    JSON.stringify({
        message: {
            content: [{ id, input, name, type: 'tool_use' }],
            id: `m-${id}`,
        },
        type: 'assistant',
    });
const toolResult = (id: string, content: unknown, isError = false) =>
    JSON.stringify({
        message: {
            content: [
                {
                    content,
                    ...(isError ? { is_error: true } : {}),
                    tool_use_id: id,
                    type: 'tool_result',
                },
            ],
        },
        type: 'user',
    });
const prompt = (text: string) =>
    JSON.stringify({ message: { content: text }, type: 'user' });
const say = (text: string) =>
    JSON.stringify({
        message: { content: [{ text, type: 'text' }], id: `m-${text}` },
        type: 'assistant',
    });

describe('receiptsOf', () => {
    test('one line per call since dima last spoke, with its exit, error and image', () => {
        const receipts = receiptsOf([
            toolUse('old', 'Bash', { command: 'before his line' }),
            toolResult('old', 'x'),
            prompt('fix it'),
            toolUse('a', 'Bash', { command: 'pnpm test' }),
            toolResult('a', 'all green'),
            toolUse('b', 'Bash', { command: 'x lane commit' }),
            toolResult('b', 'Exit code 1\nbiome refused\nmore', true),
            toolUse('c', 'Read', { file_path: '/tmp/shot.png' }),
            toolResult('c', [{ source: {}, type: 'image' }]),
            toolUse('d', 'Edit', { file_path: '/tmp/a.ts' }),
        ]);
        expect(receipts.split('\n')).toEqual([
            '- Bash exit 0 · pnpm test',
            '- Bash exit 1 · x lane commit · biome refused',
            '- Read ok · /tmp/shot.png · [image: /tmp/shot.png]',
            '- Edit pending · /tmp/a.ts',
        ]);
    });

    test('a harness reminder is not dima, and his words beside one are', () => {
        const reminder = '<system-reminder>session finished</system-reminder>';
        const lines = [
            prompt('go'),
            toolUse('a', 'Bash', { command: 'ls' }),
            toolResult('a', 'x'),
            prompt(reminder),
        ];
        expect(receiptsOf(lines)).toBe('- Bash exit 0 · ls');
        expect(receiptsOf([...lines, prompt(`${reminder}\nstop`)])).toBe('');
    });

    test('a gate that echoes its exit reads red, past a long command prefix', () => {
        const prefix = `cd ~/frame && S=/tmp/${'x'.repeat(200)}`;
        const receipts = receiptsOf([
            prompt('go'),
            toolUse('a', 'Bash', { command: `${prefix} && x lane commit` }),
            toolResult('a', 'exit 1\nbiome refused'),
            toolUse('b', 'Bash', { command: 'pnpm test; echo "exit $?"' }),
            toolResult('b', 'ok\nexit 0'),
        ]).split('\n');
        expect(receipts[0]).toContain('exit 1');
        expect(receipts[0]).toContain('x lane commit');
        expect(receipts[0]).toContain('biome refused');
        expect(receipts[1]).toBe('- Bash exit 0 · pnpm test; echo "exit $?"');
    });

    test('a tool with no command or path shows its input', () => {
        expect(
            receiptsOf([
                prompt('go'),
                toolUse('a', 'orbit', { ids: ['o23'], op: 'resolve' }),
                toolResult('a', 'resolved o23'),
            ]),
        ).toBe('- orbit ok · {"ids":["o23"],"op":"resolve"}');
    });

    test('a peer and a subagent notice are not dima, so they cut nothing', () => {
        const receipts = receiptsOf([
            prompt('go'),
            toolUse('a', 'Bash', { command: 'ls' }),
            toolResult('a', 'x'),
            JSON.stringify({
                message: { content: 'from codie' },
                origin: { kind: 'peer' },
                type: 'user',
            }),
            JSON.stringify({
                message: { content: '<task-notification>x' },
                origin: { kind: 'task-notification' },
                type: 'user',
            }),
        ]);
        expect(receipts).toBe('- Bash exit 0 · ls');
    });
});

describe('claimOf', () => {
    const edit = [
        toolUse('e', 'Edit', { file_path: '/a' }),
        toolResult('e', 'ok'),
    ];
    const test0 = [
        toolUse('t', 'Bash', { command: 'pnpm test' }),
        toolResult('t', 'ok'),
    ];

    test.each([
        ['a word in the first line, no bash', [...edit], 'Fixed the gate.', 1],
        ['a ✅ line, no bash', [...edit], 'so\n✅ gate', 1],
        ['exit 0 after the last edit', [...edit, ...test0], 'Fixed it.', 0],
        ['exit 0 before the last edit', [...test0, ...edit], 'Fixed it.', 1],
        [
            'a red bash proves nothing',
            [
                toolUse('t', 'Bash', { command: 'pnpm test' }),
                toolResult('t', 'Exit code 1', true),
            ],
            'Fixed it.',
            1,
        ],
        [
            'a gate that echoed a red exit proves nothing',
            [
                toolUse('t', 'Bash', { command: 'pnpm test; echo "exit $?"' }),
                toolResult('t', 'exit 1'),
            ],
            'Fixed it.',
            1,
        ],
        ['no claim word', [...edit], 'Here is the plan.', 0],
        ['a word past the first line', [...edit], 'plan\nit is done', 0],
    ] as const)('%s', (_label, calls, reply, wakes) => {
        const lines = [prompt('go'), ...calls, say(reply)];
        expect(claimOf(lines) === undefined ? 0 : 1).toBe(wakes);
    });

    test('a reminder after the proof keeps the turn, so no false claim', () => {
        const lines = [
            prompt('go'),
            ...edit,
            ...test0,
            prompt('<system-reminder>x</system-reminder>'),
            say('Done.'),
        ];
        expect(claimOf(lines)).toBeUndefined();
    });

    test('the claim sentence is the line that made it, and the hook text wins', () => {
        expect(claimOf([prompt('go')], 'x\n✅ landed it\ny')).toBe(
            '✅ landed it',
        );
    });
});

describe('isParked', () => {
    const now = new Date('2026-11-04T12:00:00Z');
    const reset = (hoursLeft: number) =>
        now.getTime() / 1000 + hoursLeft * 3600;
    const meter = (usedPercentage: number, hoursLeft: number) => {
        const path = join(mkdtempSync(join(tmpdir(), 'crow-')), 'u.json');
        writeFileSync(
            path,
            JSON.stringify({
                rate_limits: {
                    five_hour: {
                        resets_at: reset(hoursLeft),
                        used_percentage: usedPercentage,
                    },
                },
            }),
        );
        return path;
    };

    test.each([
        ['6 over pace', 56, 2.5, true],
        ['exactly 5 over pace', 55, 2.5, false],
        ['on pace', 50, 2.5, false],
        ['90 % with more than an hour left', 90, 1.5, true],
        ['91 % with half an hour left, under pace', 91, 0.5, false],
        ['a window past its reset', 99, -1, false],
    ] as const)('%s', (_label, used, left, expected) => {
        expect(isParked(now, meter(used, left))).toBe(expected);
    });

    test('no meter file is no park', () => {
        expect(isParked(now, '/nope/u.json')).toBe(false);
    });
});

describe('readLines', () => {
    test('leaves out a last line that has no newline yet', () => {
        const path = join(mkdtempSync(join(tmpdir(), 'crow-')), 't.jsonl');
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
        const dir = mkdtempSync(join(tmpdir(), 'crow-'));
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
    test('writes one packet.md: the delta, then each leaf under its header', () => {
        const dir = join(mkdtempSync(join(tmpdir(), 'crow-')), 'packet');
        const leaf = join(leavesDir, 'strategy.md');
        buildPacket({
            deltaText: '## dima\nhi',
            dir,
            leaves: [leaf],
            missing: [],
        });
        expect(readdirSync(dir)).toEqual(['packet.md']);
        expect(readFileSync(join(dir, 'packet.md'), 'utf8')).toBe(
            `# clio since the last wake\n\n## dima\nhi\n\n## leaf · ${leaf}\n\nvector: ship the fleet\n`,
        );
    });

    const packetOf = (deltaLines: string[]) => {
        const dir = join(mkdtempSync(join(tmpdir(), 'crow-')), 'packet');
        const delta = transcriptDelta(deltaLines, 0);
        buildPacket({
            cut: cutLine(delta.cut, '/t/clio.jsonl'),
            deltaText: delta.text,
            dir,
            leaves: [],
            missing: [],
        });
        return readFileSync(join(dir, 'packet.md'), 'utf8');
    };

    test('a cut packet carries one cut line naming the transcript', () => {
        const report = 'x'.repeat(5_000);
        const packet = packetOf([
            JSON.stringify({
                message: {
                    content: `<task-notification><result>${report}</result></task-notification>`,
                },
                type: 'user',
            }),
        ]);
        expect(packet.match(/^cut: .*$/gm)).toEqual([
            'cut: 0 older blocks dropped, 1 tool outputs capped · transcript /t/clio.jsonl',
        ]);
    });

    test('an uncut packet carries no cut line', () => {
        expect(packetOf(lines)).not.toMatch(/^cut:/m);
    });
});

describe('stashModOf', () => {
    test('picks the plugin dir named stash, whatever the dir is called', () => {
        const home = mkdtempSync(join(tmpdir(), 'crow-mods-'));
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
            mkdtempSync(join(tmpdir(), 'crow-store-')),
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
});

describe('isCoordinatorTranscript', () => {
    const sessions = mkdtempSync(join(tmpdir(), 'crow-sessions-'));
    writeFileSync(
        join(sessions, '6020.json'),
        JSON.stringify({ name: '🦉 clio', sessionId: 'aaa' }),
    );
    writeFileSync(
        join(sessions, '3356.json'),
        JSON.stringify({ name: '☕️ 🔧 coder: mods', sessionId: 'bbb' }),
    );

    test('a transcript of the session named clio wakes crow', () => {
        expect(isCoordinatorTranscript('/p/aaa.jsonl', sessions)).toBe(true);
    });

    test('a coder transcript under the clio dir does not', () => {
        expect(isCoordinatorTranscript('/p/bbb.jsonl', sessions)).toBe(false);
    });
});

test('a desktop turn ends on stop_hook_summary, timed from its timestamps', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crow-turn-'));
    const path = join(dir, 't.jsonl');
    const lines = [
        {
            message: { content: 'crow wake 1 · mode day' },
            timestamp: '2026-10-09T14:45:00Z',
            type: 'user',
        },
        {
            message: {
                content: [{ text: 'none', type: 'text' }],
                id: 'a',
                model: 'claude-fable-5-1',
            },
            timestamp: '2026-10-09T14:46:00Z',
            type: 'assistant',
        },
        {
            subtype: 'stop_hook_summary',
            timestamp: '2026-10-09T14:47:00Z',
            type: 'system',
        },
    ];
    writeFileSync(path, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
    expect(readTurn(path, 'crow wake 1')).toMatchObject({
        model: 'claude-fable-5-1',
        note: 'none',
        seconds: 120,
    });
});

test('a delta block carries its local time when the entry has one', () => {
    const at = '2026-10-09T14:45:00Z';
    const local = new Date(at);
    const hhmm = `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`;
    const lines = [
        JSON.stringify({
            message: { content: 'hi' },
            timestamp: at,
            type: 'user',
        }),
    ];
    expect(transcriptDelta(lines, 0).text).toBe(`## dima · ${hhmm}\nhi`);
});

test('a leaf goes again only when it changed, or when crow started a new transcript', () => {
    const leaf = join(leavesDir, 'strategy.md');
    const first = leavesToSend([leaf], { offsets: {} }, 't1');
    expect(first.changed).toEqual([leaf]);
    const state = { leafHashes: first.hashes, leavesFor: 't1', offsets: {} };
    expect(leavesToSend([leaf], state, 't1')).toMatchObject({
        changed: [],
        unchanged: [leaf],
    });
    expect(leavesToSend([leaf], state, 't2').changed).toEqual([leaf]);
});

describe('decisionOf', () => {
    test.each([
        ['gh pr merge 82 -R dvakatsiienko/frame --squash', 'merge'],
        ['x lane push --apply && gh pr merge 82', 'merge'],
        ['GH_TOKEN=x gh pr merge 5', 'merge'],
        ['gh pr merge --subject "a; claude --bg" 82', 'merge'],
        [
            'cd ~/frame && claude --bg -n "☕️ 🔧 x" "/x:crew-codie FRM-1"',
            'spawn',
        ],
        ['A=1 claude --bg hi', 'spawn'],
        ['x lane commit -m "gh pr merge 3"', undefined],
        ["echo 'claude --bg'", undefined],
        ['gh pr view 82', undefined],
        ['claude -p hi', undefined],
        ['x lane push --apply', undefined],
        ['git log | grep "gh pr merge"', undefined],
        // the $54 batch's own command, 2026-11-03 l2543
        [
            'cd ~/frame && script/op-run.sh python3 -I /tmp/s/retro/batch.py submit 2>&1 | tail -5',
            'paid',
        ],
        [
            `script/op-run.sh sh -c 'curl -sS https://api.anthropic.com/v1/messages -d "{}"'`,
            'paid',
        ],
        ['curl https://example.com/v1/messages/batches', 'paid'],
        ["python3 -I - <<'PY'\nimport anthropic\nPY", 'paid'],
        ['batch.py status', undefined],
        ['rg -n api.anthropic.com docs', undefined],
        ['x lane commit -m "curl docs"', undefined],
        ['curl https://example.com', undefined],
        ['gh pr create --title x', 'post'],
        ['gh pr comment 5 --body-file f', 'post'],
        ['gh issue create --title x', 'post'],
        ['gh issue comment 9 --body hi', 'post'],
        ['slk send general hello', 'post'],
        ['slk s general hello', 'post'],
        ['himalaya message send < m.eml', 'post'],
        ['gh pr view 5', undefined],
        ['gh issue view 99217', undefined],
        ['slk read general', undefined],
        ['slk draft general hello', undefined],
        ['himalaya envelope list', undefined],
        ['x linear set FRM-1 --state Done', 'close'],
        ['x linear set FRM-1 --state=Canceled', 'close'],
        ['x linear set FRM-1 --state done --add-label x', 'close'],
        ['x linear set FRM-1 --state Todo', undefined],
        ['x linear set FRM-1 --add-label done', undefined],
        ['git push', undefined],
        ['rg -n ANTHROPIC_CREDITS_KEY op.env', undefined],
        ["python3 - <<'PY'\nedit = 'rg -e @anthropic-ai/sdk'\nPY", undefined],
        ['rg -l -e @anthropic-ai/sdk -e api.anthropic.com frame', undefined],
        ['echo "batch.py submit"', undefined],
        ['git commit -m "node hook: @anthropic-ai/sdk note"', undefined],
        [
            'git commit -m "curl https://api.anthropic.com/v1/messages"',
            undefined,
        ],
        [
            "cat > doc.md <<'EOF'\ngh pr merge 5\nimport anthropic\nEOF",
            undefined,
        ],
        ["x lane commit <<'EOF'\nclaude --bg hi\nEOF\ngh pr view 5", undefined],
        ["cat > a.md <<'EOF'\nx\nEOF\ngh pr merge 5", 'merge'],
        ['env A=1 gh pr merge 5', 'merge'],
        [`bash -c 'x linear set FRM-1 --state Done'`, 'close'],
    ])('%s → %s', (line, kind) => {
        expect(decisionOf(line)?.kind).toBe(kind);
    });

    test('a script counts as paid by its own source, through a runner or a pnpm verb', () => {
        const dir = mkdtempSync(join(tmpdir(), 'crow-paid-'));
        writeFileSync(
            join(dir, 'paid.ts'),
            "import Anthropic from '@anthropic-ai/sdk';\n",
        );
        writeFileSync(join(dir, 'free.ts'), 'console.log(1);\n');
        writeFileSync(
            join(dir, 'package.json'),
            JSON.stringify({
                scripts: {
                    'free:run': 'node ./free.ts',
                    'paid:run': 'node ./paid.ts',
                },
            }),
        );
        const kindOf = (line: string) => decisionOf(line, dir)?.kind;
        expect(kindOf('node paid.ts')).toBe('paid');
        expect(kindOf('node free.ts')).toBeUndefined();
        expect(kindOf('cat paid.ts')).toBeUndefined();
        expect(kindOf('pnpm paid:run')).toBe('paid');
        expect(kindOf(`pnpm -C ${dir} --silent paid:run`)).toBe('paid');
        expect(decisionOf('pnpm -C sub paid:run', join(dir, '..'))?.kind).toBe(
            undefined,
        );
        expect(kindOf('pnpm free:run')).toBeUndefined();
        expect(kindOf('rg x paid.ts')).toBeUndefined();
        expect(decisionOf(`cd ${dir} && node paid.ts`, '/')?.kind).toBe('paid');
    });

    test('the close names its ticket, the post its verb', () => {
        expect(decisionOf('x linear set FRM-1 --state Done')).toEqual({
            kind: 'close',
            what: 'FRM-1',
        });
        expect(decisionOf('gh pr comment 5')).toEqual({
            kind: 'post',
            what: 'gh pr comment',
        });
    });
});

describe('consoleOf', () => {
    const nav = 'mcp__Claude_Browser__navigate';
    const click = 'mcp__Claude_Browser__computer';
    const onConsole = () => [
        toolUse('n', nav, { url: 'https://console.anthropic.com/settings' }),
    ];

    test.each([
        [nav, { url: 'https://console.anthropic.com/x' }, 'console'],
        [nav, { url: 'https://platform.claude.com/settings/keys' }, 'console'],
        [nav, { url: 'https://vercel.com/acme/settings/billing' }, 'console'],
        [nav, { url: 'https://example.com/billingsworth' }, undefined],
        [nav, { url: 'https://example.com' }, undefined],
        [click, { action: 'left_click' }, 'console'],
        [click, { action: 'screenshot' }, undefined],
        ['Bash', { url: 'https://console.anthropic.com' }, undefined],
    ])('%s %j → %s', (tool, input, kind) => {
        expect(consoleOf(tool, input, onConsole)?.kind).toBe(kind);
    });
});

describe('prViewArgs', () => {
    const json = ['--json', 'number,headRefOid,url'];
    test.each([
        ['82 -R o/r --squash', ['82', '--repo', 'o/r']],
        [
            '--repo=o/r https://github.com/o/r/pull/9',
            ['https://github.com/o/r/pull/9', '--repo', 'o/r'],
        ],
        ['-t "x y" -b z --squash 3', ['3']],
        ['--squash', []],
        ['--subject 82 7', ['7']],
    ])('gh pr merge %s', (args, view) => {
        const merge = decisionOf(`gh pr merge ${args}`);
        expect(merge?.kind === 'merge' && prViewArgs(merge.args)).toEqual([
            'pr',
            'view',
            ...view,
            ...json,
        ]);
    });
});

describe('meterLine', () => {
    const NOW = new Date(Date.UTC(2026, 9, 12, 11, 0));
    const sec = (ms: number) => Math.floor(ms / 1000);
    test('prints both windows, their resets and the reading age', () => {
        const path = join(mkdtempSync(join(tmpdir(), 'crow-meter-')), 'u.json');
        writeFileSync(
            path,
            JSON.stringify({
                rate_limits: {
                    five_hour: {
                        resets_at: sec(NOW.getTime() + 3 * 36e5),
                        used_percentage: 6,
                    },
                    seven_day: {
                        resets_at: sec(NOW.getTime() + 160 * 36e5),
                        used_percentage: 1,
                    },
                },
                written_at: sec(NOW.getTime() - 4 * 6e4),
            }),
        );
        expect(meterLine(NOW, path)).toBe(
            '⏱️ 5h 6 %, resets in 3 h | weekly 1 %, resets in 160 h | read 4 min ago',
        );
    });
    test('a missing usage file prints nothing', () => {
        expect(meterLine(NOW, '/nonexistent/u.json')).toBe('');
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

// relay.ts: a wake x-mod-stash has not sent yet stays parked for its next poll; clio's prompt hook prints nothing
test('an unsent parked wake stays parked and puts nothing in clio’s context', () => {
    const state = mkdtempSync(join(tmpdir(), 'crow-state-'));
    const relay = join(state, 'relay.json');
    writeFileSync(
        relay,
        JSON.stringify({
            id: 'w1',
            line: 'wake w1',
            mode: 'day',
            phase: 'live',
        }),
    );
    const run = spawnSync('node', [join(import.meta.dirname, 'relay.ts')], {
        encoding: 'utf8',
        env: { ...process.env, CROW_STATE_DIR: state },
    });
    expect([run.status, run.stdout, existsSync(relay)]).toEqual([0, '', true]);
});

describe('dropStaleRelay', () => {
    const parked = () => {
        const path = join(mkdtempSync(join(tmpdir(), 'relay-')), 'relay.json');
        writeFileSync(path, '{}');
        return path;
    };

    test('drops a wake parked longer than the gap', () => {
        const path = parked();
        const old = new Date(Date.now() - 31 * 60_000);
        utimesSync(path, old, old);
        expect(dropStaleRelay(path)).toBe(true);
        expect(existsSync(path)).toBe(false);
    });

    test('keeps a wake parked inside the gap', () => {
        const path = parked();
        expect(dropStaleRelay(path)).toBe(false);
        expect(existsSync(path)).toBe(true);
    });

    test('is quiet with no parked wake', () => {
        expect(dropStaleRelay(join(tmpdir(), 'no-relay-here.json'))).toBe(
            false,
        );
    });
});
