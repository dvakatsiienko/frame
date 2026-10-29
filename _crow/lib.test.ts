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
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    type Note,
    type PlanReview,
    appendNoteOnce,
    blindPrompt,
    blindSections,
    buildPacket,
    cutLine,
    decisionOf,
    dropStaleRelay,
    isCoordinatorTranscript,
    isLocated,
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
    const charter = /· charter (\S+)$/.exec(line)?.[1] ?? '';
    expect(existsSync(charter)).toBe(true);
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
    ])('%s → %s', (line, kind) => {
        expect(decisionOf(line)?.kind).toBe(kind);
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
