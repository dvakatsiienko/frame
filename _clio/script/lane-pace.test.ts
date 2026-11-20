import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import {
    type Commit,
    classify,
    currentTicketOf,
    lanePace,
    lanePaceSection,
    median,
    ownCommits,
    planOf,
    readTranscript,
    segments,
} from './lane-pace.ts';

// 20 Nov, 11:00 UTC = 13:00 local: a clock hour starts on a multiple of 3600
const T0 = Date.UTC(2026, 10, 20, 11, 0, 0) / 1000;
const iso = (s: number) => new Date(s * 1000).toISOString();

type Line = Record<string, unknown>;
const assistant = (ts: number, block: Line): Line => ({
    message: { content: [block] },
    timestamp: iso(ts),
    type: 'assistant',
});
const result = (ts: number, id: string, text: string): Line => ({
    message: {
        content: [{ content: text, tool_use_id: id, type: 'tool_result' }],
    },
    timestamp: iso(ts),
    type: 'user',
});
const note = (ts: number, id: string, use: string): Line => ({
    message: {
        content: `<task-notification><task-id>${id}</task-id><tool-use-id>${use}</tool-use-id></task-notification>`,
    },
    timestamp: iso(ts),
    type: 'user',
});
const bash = (
    ts: number,
    id: string,
    command: string,
    background = false,
): Line =>
    assistant(ts, {
        id,
        input: { command, run_in_background: background },
        name: 'Bash',
        type: 'tool_use',
    });
const text = (ts: number): Line => assistant(ts, { text: 'ok', type: 'text' });

const jsonl = (lines: Line[]) => lines.map((l) => JSON.stringify(l)).join('\n');

// a lane that lands one commit per `cycle` seconds, each cycle one background commit chain: the model works 90 s, then idles `cycle - 90 - 10`
// under the chain, which ends 10 s after the commit lands
function chainLane(opts: {
    cycles: number;
    cycle: number;
    lines: number;
    from?: number;
}) {
    const lines: Line[] = [];
    const commits: Commit[] = [];
    const from = opts.from ?? T0;
    for (let i = 0; i < opts.cycles; i++) {
        const b = from + i * opts.cycle;
        lines.push(
            text(b + 5),
            bash(
                b + 80,
                `u${i}`,
                `echo '🔧 x: a long enough step ${i}' > msg.txt && x lane commit msg.txt -- a.ts`,
                true,
            ),
            result(b + 81, `u${i}`, 'Command running in background with ID: z'),
        );
        const landed = b + opts.cycle - 10;
        commits.push({
            add: Math.ceil(opts.lines * 0.75),
            rem: Math.floor(opts.lines * 0.25),
            sha: String(i).padStart(7, '0'),
            subject: `🔧 x: a long enough step ${i}`,
            t: landed,
        });
        lines.push(note(b + opts.cycle, `z${i}`, `u${i}`));
    }
    return { commits, transcript: jsonl(lines) };
}

const lane = (extra: Partial<Parameters<typeof lanePace>[0]>) =>
    lanePace({
        commits: [],
        name: 'mods | FRM-662',
        plan: null,
        since: T0,
        size: 'S',
        transcript: '',
        ...extra,
    });

describe('lanePace', () => {
    // 19 Nov's mods split: ~80 lines a move, 9 min cycles, 4 h in with 6 of 40 moves done, an S ticket
    test('flags a lane projected far past its size budget, with its why and a fix', () => {
        const { commits, transcript } = chainLane({
            cycle: 540,
            cycles: 27,
            lines: 80,
        });
        const pace = lane({
            commits,
            plan: { done: 6, total: 40 },
            transcript,
        });
        expect(pace.flag).toBe('🔴');
        expect(pace.line).toContain('projected ~');
        expect(pace.line).toContain('budget S 4 h');
        expect(pace.line).toMatch(/80 lines a commit, \d+ % waiting/);
        expect(pace.line).toContain('likely fix: bigger cycles');
    });

    // 20 Nov's stray: small commits (44 lines), two thirds of its time waiting, its batch inside the budget
    test('keeps a small-commit lane green while its projection fits the budget', () => {
        const { commits, transcript } = chainLane({
            cycle: 330,
            cycles: 13,
            lines: 44,
        });
        const pace = lane({
            commits,
            name: 'stray | FRM-662',
            plan: { done: 3, total: 4 },
            transcript,
        });
        expect(pace.flag).toBe('🟢');
        expect(pace.medianLines).toBe(44);
        expect(pace.waiting).toBeGreaterThan(0.6);
        expect(pace.line).toContain('44 lines a commit');
    });

    test('reads «no projection» with no plan tick, never green or red', () => {
        const { commits, transcript } = chainLane({
            cycle: 330,
            cycles: 13,
            lines: 44,
        });
        const pace = lane({ commits, plan: null, transcript });
        expect(pace.flag).toBe('➖');
        expect(pace.line).toContain('no projection');
    });

    test('reads «no projection» under an hour in, however slow the plan', () => {
        const { commits, transcript } = chainLane({
            cycle: 330,
            cycles: 6,
            lines: 44,
        });
        const pace = lane({
            commits,
            plan: { done: 1, total: 40 },
            transcript,
        });
        expect(pace.flag).toBe('➖');
    });

    test('reads no budget for a size with none', () => {
        const { commits, transcript } = chainLane({
            cycle: 540,
            cycles: 27,
            lines: 80,
        });
        const pace = lane({
            commits,
            plan: { done: 6, total: 40 },
            size: 'XL',
            transcript,
        });
        expect(pace.flag).toBe('🟢');
        expect(pace.line).toContain('no budget for its size');
    });

    // the lane works (a tool call every 30 s) for 3.5 h and lands at 11:10 and 14:20 only
    test('flags a worked hour that landed nothing', () => {
        const lines: Line[] = [];
        for (let t = T0 + 30; t < T0 + 3.5 * 3600; t += 30)
            lines.push(bash(t, `w${t}`, 'ls'), result(t + 2, `w${t}`, 'ok'));
        const commits: Commit[] = [
            {
                add: 60,
                rem: 10,
                sha: 'aaaaaaa',
                subject: '🔧 x: a long enough step',
                t: T0 + 600,
            },
            {
                add: 60,
                rem: 10,
                sha: 'bbbbbbb',
                subject: '🔧 x: a long enough step',
                t: T0 + 3.3 * 3600,
            },
        ];
        const pace = lane({
            commits,
            plan: { done: 1, total: 2 },
            transcript: jsonl(lines),
        });
        expect(pace.flag).toBe('🔴');
        expect(pace.line).toContain('an hour with nothing landed');
    });

    test('does not count an idle hour as worked', () => {
        // a long wait ends with the next message to the lane
        const lines: Line[] = [
            text(T0 + 30),
            {
                message: { content: 'your turn' },
                timestamp: iso(T0 + 3.4 * 3600),
                type: 'user',
            },
        ];
        const commits: Commit[] = [
            {
                add: 60,
                rem: 10,
                sha: 'aaaaaaa',
                subject: '🔧 x: a long enough step',
                t: T0 + 60,
            },
        ];
        const pace = lane({ commits, transcript: jsonl(lines) });
        expect(pace.line).not.toContain('nothing landed');
    });

    test.each([
        [
            'a typecheck first',
            ['error TS2307: gone', 'error TS2305: gone'],
            'a typecheck first',
        ],
        ['a bare red', ['ok', 'ok'], 'ask what it waits on'],
    ])(
        'names the fix for a red with big commits: %s',
        (_name, outputs, fix) => {
            // 3 h of foreground tsc runs, big commits, nothing landed in the middle hour
            const lines: Line[] = [];
            for (let t = T0 + 30; t < T0 + 3 * 3600; t += 60) {
                const out = outputs[Math.floor(t / 60) % 2] ?? 'ok';
                lines.push(
                    bash(t, `w${t}`, 'pnpm typecheck'),
                    result(t + 20, `w${t}`, out),
                );
            }
            const commits: Commit[] = [
                {
                    add: 400,
                    rem: 100,
                    sha: 'aaaaaaa',
                    subject: '🔧 x: a long enough step',
                    t: T0 + 300,
                },
                {
                    add: 400,
                    rem: 100,
                    sha: 'bbbbbbb',
                    subject: '🔧 x: a long enough step',
                    t: T0 + 2.9 * 3600,
                },
            ];
            const pace = lane({ commits, transcript: jsonl(lines) });
            expect(pace.flag).toBe('🔴');
            expect(pace.fix).toContain(fix);
        },
    );

    // a long wait is not the fix for small commits that wait little, nor for big commits that wait a lot
    test.each([
        ['big commits that wait a lot', 540, 400],
        ['small commits that wait little', 0, 40],
    ])('does not name bigger cycles for %s', (_name, cycle, size) => {
        let commits: Commit[];
        let transcript: string;
        if (cycle > 0) {
            ({ commits, transcript } = chainLane({
                cycle,
                cycles: 27,
                lines: size,
            }));
        } else {
            const lines: Line[] = [];
            for (let t = T0 + 30; t < T0 + 3 * 3600; t += 30)
                lines.push(
                    bash(t, `w${t}`, 'ls'),
                    result(t + 2, `w${t}`, 'ok'),
                );
            commits = [
                {
                    add: size,
                    rem: 0,
                    sha: 'aaaaaaa',
                    subject: '🔧 x: a long enough step',
                    t: T0 + 300,
                },
                {
                    add: size,
                    rem: 0,
                    sha: 'bbbbbbb',
                    subject: '🔧 x: a long enough step',
                    t: T0 + 2.9 * 3600,
                },
            ];
            transcript = jsonl(lines);
        }
        const pace = lane({
            commits,
            plan: { done: 6, total: 40 },
            transcript,
        });
        expect(pace.flag).toBe('🔴');
        expect(pace.fix).not.toContain('bigger cycles');
    });

    test('names a repeated loop of one test command', () => {
        const lines: Line[] = [];
        for (let t = T0 + 30; t < T0 + 3 * 3600; t += 60) {
            const body = t % 120 === 30 ? 'pnpm vitest run a.test.ts' : 'ls';
            lines.push(bash(t, `w${t}`, body), result(t + 2, `w${t}`, 'ok'));
        }
        const commits: Commit[] = [
            {
                add: 400,
                rem: 100,
                sha: 'aaaaaaa',
                subject: '🔧 x: a long enough step',
                t: T0 + 300,
            },
            {
                add: 400,
                rem: 100,
                sha: 'bbbbbbb',
                subject: '🔧 x: a long enough step',
                t: T0 + 2.9 * 3600,
            },
        ];
        const pace = lane({ commits, transcript: jsonl(lines) });
        expect(pace.fix).toContain(
            'a repeated loop: pnpm vitest run a.test.ts',
        );
    });

    // a siesta 1.2 h ago must not shrink the lane's elapsed time: 3.5 h in with 3 of 4 steps done projects ~4.7 h, past an S budget
    test("projects from the lane's own start, whatever the last siesta was", () => {
        const { commits, transcript } = chainLane({
            cycle: 330,
            cycles: 38,
            lines: 44,
        });
        const pace = lane({
            commits,
            plan: { done: 3, total: 4 },
            since: T0 + 2.3 * 3600,
            transcript,
        });
        expect(pace.flag).toBe('🔴');
        expect(pace.line).toContain('projected ~5 h');
        // under an hour into the window, an hour and a half into the lane's life: it still projects
        const late = lane({
            commits,
            plan: { done: 3, total: 4 },
            since: T0 + 3.2 * 3600,
            transcript,
        });
        expect(late.flag).toBe('🔴');
    });

    test('a lane with no record since the window reads quiet, never negative hours', () => {
        const { commits, transcript } = chainLane({
            cycle: 330,
            cycles: 4,
            lines: 44,
        });
        const pace = lane({ commits, since: T0 + 5 * 3600, transcript });
        expect(pace.flag).toBe('➖');
        expect(pace.line).toContain('no activity since the last siesta');
        expect(pace.line).not.toMatch(/-\d+(\.\d)? h/);
    });

    test('counts only commits after since', () => {
        const { commits, transcript } = chainLane({
            cycle: 330,
            cycles: 13,
            lines: 44,
        });
        const pace = lane({ commits, since: T0 + 3600, transcript });
        expect(pace.commits).toBeLessThan(13);
        expect(pace.commits).toBeGreaterThan(0);
    });
});

describe('the reading of a transcript', () => {
    test('skips garbled lines and keeps the rest', () => {
        const { uses } = readTranscript(
            `{broken\n${jsonl([bash(T0, 'a', 'ls')])}\n`,
        );
        expect(uses.size).toBe(1);
    });

    test.each([
        ['x lane commit m.txt -- a', 'commitpush'],
        ['x mods edit push', 'commitpush'],
        ['pnpm vitest run a', 'test'],
        ['go test ./...', 'test'],
        ['x mods edit test', 'test'],
        ['pnpm typecheck', 'tsc'],
        ['cat <<EOF\nx lane commit\nEOF\nls', 'other'],
    ])('classifies %j as %s', (command, kind) => {
        expect(classify(command)).toBe(kind);
    });

    test('idle under a background chain is waiting, idle alone is not', () => {
        const { segs } = segments(
            jsonl([
                bash(T0 + 10, 'u', 'x lane commit m', true),
                result(
                    T0 + 11,
                    'u',
                    'Command running in background with ID: z',
                ),
                note(T0 + 200, 'z', 'u'),
                text(T0 + 300),
                text(T0 + 400),
            ]),
            T0,
        );
        const sum = (state: string) =>
            segs
                .filter((s) => s.state === state)
                .reduce((n, s) => n + s.to - s.from, 0);
        expect(sum('wait_bg')).toBeGreaterThan(180);
        expect(sum('idle')).toBe(0);
    });

    test('reads what a chain script runs, from its own text', () => {
        const pad = mkdtempSync(path.join(tmpdir(), 'lane-pace-pad-'));
        writeFileSync(path.join(pad, 'chain.sh'), 'x mods edit push a.ts\n');
        try {
            const lines = jsonl([
                bash(T0 + 10, 'u', 'bash chain.sh', true),
                result(
                    T0 + 11,
                    'u',
                    'Command running in background with ID: z',
                ),
                note(T0 + 200, 'z', 'u'),
                text(T0 + 300),
            ]);
            const waits = (scratchpad: string) =>
                segments(lines, T0, undefined, scratchpad).segs.filter(
                    (s) => s.state === 'wait_bg',
                ).length;
            expect(waits(pad)).toBeGreaterThan(0);
            expect(waits('')).toBe(0);
        } finally {
            rmSync(pad, { force: true, recursive: true });
        }
    });

    test("stops at until: a later commit and a later wait are not the lane's yet", () => {
        const { commits, transcript } = chainLane({
            cycle: 330,
            cycles: 13,
            lines: 44,
        });
        const whole = lane({ commits, transcript });
        const cut = lane({ commits, transcript, until: T0 + 3600 });
        expect(cut.commits).toBeLessThan(whole.commits);
        expect(cut.hours).toBe(1);
    });

    test('takes the median of an even and an odd count', () => {
        expect([median([3, 1, 2]), median([4, 1, 2, 3]), median([])]).toEqual([
            2, 2.5, 0,
        ]);
    });
});

describe('ownCommits', () => {
    test('keeps a commit whose subject the lane wrote, never one it only read in a log', () => {
        const base = { add: 1, rem: 1, sha: 'abcdef0', t: T0 };
        const mine = { ...base, subject: '🔧 x: the lane wrote this subject' };
        const theirs = {
            ...base,
            subject: '🐞 y: another lane wrote this one',
        };
        const transcript = jsonl([
            bash(T0, 'a', "git commit -m '🔧 x: the lane wrote this subject'"),
            result(T0 + 1, 'a', 'abcdef0 🐞 y: another lane wrote this one'),
        ]);
        expect(ownCommits([mine, theirs], transcript)).toEqual([mine]);
    });
});

describe('ownCommits, short subjects', () => {
    test('never matches a subject too short to name one commit', () => {
        const commit = {
            add: 1,
            rem: 1,
            sha: 'abcdef0',
            subject: '🔧 x: a',
            t: T0,
        };
        const transcript = jsonl([bash(T0, 'a', "git commit -m '🔧 x: a'")]);
        expect(ownCommits([commit], transcript)).toEqual([]);
    });
});

describe('planOf', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'lane-pace-'));
    afterAll(() => rmSync(dir, { force: true, recursive: true }));

    test('counts ticked and total steps, and reads none ticked as no plan', () => {
        writeFileSync(
            path.join(dir, 'a.md'),
            '# plan\n\n- [x] 01 · a\n- [ ] 02 · b\n- [X] 03 · c\n',
        );
        writeFileSync(path.join(dir, 'b.md'), '- [ ] 01 · a\n- [ ] 02 · b\n');
        expect(planOf(path.join(dir, 'a.md'))).toEqual({ done: 2, total: 3 });
        expect(planOf(path.join(dir, 'b.md'))).toBeNull();
        expect(planOf(path.join(dir, 'gone.md'))).toBeNull();
    });
});

describe('lanePaceSection, per lane', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'lane-pace-lanes-'));
    afterAll(() => rmSync(home, { force: true, recursive: true }));

    test("finds a transcript under a cwd with an underscore or a space, reads commits from the lane's own cwd, and survives one unreadable lane", () => {
        const { commits, transcript } = chainLane({
            cycle: 330,
            cycles: 13,
            lines: 44,
        });
        mkdirSync(path.join(home, '.claude/shelf'), { recursive: true });
        mkdirSync(path.join(home, '.claude/projects/-a-b-c-d'), {
            recursive: true,
        });
        mkdirSync(path.join(home, '.claude/projects/-bad'), {
            recursive: true,
        });
        writeFileSync(
            path.join(home, '.claude/shelf/threads.json'),
            JSON.stringify({
                threads: [
                    {
                        area: 'odd',
                        cwd: '/a_b c.d',
                        role: 'codie',
                        sessionId: 's1',
                        ticket: 'FRM-1',
                    },
                    {
                        area: 'bad',
                        cwd: '/bad',
                        role: 'codie',
                        sessionId: 's2',
                    },
                ],
            }),
        );
        writeFileSync(
            path.join(home, '.claude/projects/-a-b-c-d/s1.jsonl'),
            transcript,
        );
        // a directory where the transcript file should be: reading it throws
        mkdirSync(path.join(home, '.claude/projects/-bad/s2.jsonl'));
        const asked: string[] = [];

        const section = lanePaceSection(home, T0, {
            commits: (dir) => {
                asked.push(dir);
                return commits;
            },
            size: () => 'S',
        });

        expect(asked).toEqual(['/a_b c.d']);
        expect(section.output).toContain('odd | FRM-1');
        expect(section.output).toMatch(/bad .*unreadable/);
        expect(section.exit).toBe(1);
    });
});

describe('lanePaceSection with no usable records', () => {
    test('a home with no thread records reads «no thread records», green; a garbled one reds', () => {
        const home = mkdtempSync(path.join(tmpdir(), 'lane-pace-empty-'));
        try {
            expect(lanePaceSection(home, T0)).toMatchObject({
                exit: 0,
                output: 'no thread records',
            });
            mkdirSync(path.join(home, '.claude/shelf'), { recursive: true });
            writeFileSync(
                path.join(home, '.claude/shelf/threads.json'),
                '{broken',
            );
            expect(lanePaceSection(home, T0).exit).toBe(1);
        } finally {
            rmSync(home, { force: true, recursive: true });
        }
    });
});

describe('lanePaceSection', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'lane-pace-home-'));
    afterAll(() => rmSync(home, { force: true, recursive: true }));

    test('reads each running codie lane off its thread record, and exits 1 on a red', () => {
        const { commits, transcript } = chainLane({
            cycle: 540,
            cycles: 27,
            lines: 80,
        });
        const sha = commits.map((c) => c.sha);
        mkdirSync(path.join(home, '.claude/shelf'), { recursive: true });
        mkdirSync(path.join(home, '.claude/projects/-frame'), {
            recursive: true,
        });
        mkdirSync(path.join(home, '.local/state/x/lanes/mods-lane-8'), {
            recursive: true,
        });
        writeFileSync(
            path.join(home, '.claude/shelf/threads.json'),
            JSON.stringify({
                threads: [
                    {
                        area: 'mods',
                        cwd: '/frame',
                        lane: 'mods-lane-8',
                        role: 'codie',
                        sessionId: 's1',
                        ticket: 'FRM-662',
                    },
                    { cwd: '/frame', role: 'coordinator', sessionId: 's2' },
                    {
                        area: 'gone',
                        cwd: '/frame',
                        role: 'codie',
                        sessionId: 's3',
                    },
                ],
            }),
        );
        writeFileSync(
            path.join(home, '.claude/projects/-frame/s1.jsonl'),
            `${transcript}\n${sha.join('\n')}`,
        );
        // a coordinator's transcript beside the lane's: only a codie lane is read
        writeFileSync(
            path.join(home, '.claude/projects/-frame/s2.jsonl'),
            transcript,
        );
        writeFileSync(
            path.join(home, '.local/state/x/lanes/mods-lane-8/lane-plan.md'),
            `${'- [x] 01 · a\n'.repeat(6)}${'- [ ] 02 · b\n'.repeat(34)}`,
        );

        const section = lanePaceSection(home, T0, {
            commits: () => commits,
            size: (ticket) => (ticket === 'FRM-662' ? 'S' : null),
        });

        expect(section.exit).toBe(1);
        expect(section.output.split('\n')).toHaveLength(1);
        expect(section.output).toContain('🔴 mods | FRM-662');
    });
});

describe('currentTicketOf', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'lane-pace-current-'));
    afterAll(() => rmSync(dir, { force: true, recursive: true }));

    test("reads the ticket of the plan's first open step, never the record's", () => {
        writeFileSync(
            path.join(dir, 'a.md'),
            '# plan\n\n## FRM-673\n\n- [x] 01 · FRM-673 a\n- [ ] 02 · FRM-618 b\n- [ ] 03 · FRM-700 c\n',
        );
        writeFileSync(path.join(dir, 'b.md'), '- [x] 01 · FRM-1 a\n');
        writeFileSync(path.join(dir, 'c.md'), '- [ ] 01 · no ticket here\n');
        expect(currentTicketOf(path.join(dir, 'a.md'))).toBe('FRM-618');
        expect(currentTicketOf(path.join(dir, 'b.md'))).toBeNull();
        expect(currentTicketOf(path.join(dir, 'c.md'))).toBeNull();
        expect(currentTicketOf(path.join(dir, 'gone.md'))).toBeNull();
    });
});

// 20 Nov 16:50: the herdr lane built FRM-618 (M) while its record still named FRM-673 (S), and the stray kept the mods
// lane's record: each row reads the chunk its own lane plan marks current, its budget as «S 4 h» or «M 8 h»
describe('lanePaceSection, the chunk a lane builds', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'lane-pace-chunk-'));
    afterAll(() => rmSync(home, { force: true, recursive: true }));
    const { commits, transcript } = chainLane({
        cycle: 540,
        cycles: 27,
        lines: 80,
    });
    const plan = (lane: string, text: string) => {
        mkdirSync(path.join(home, '.local/state/x/lanes', lane), {
            recursive: true,
        });
        writeFileSync(
            path.join(home, '.local/state/x/lanes', lane, 'lane-plan.md'),
            text,
        );
    };
    const ticks = '- [x] 01 · FRM-673 a\n'.repeat(5);
    mkdirSync(path.join(home, '.claude/shelf'), { recursive: true });
    mkdirSync(path.join(home, '.claude/projects/-frame'), { recursive: true });
    for (const sid of ['s1', 's2', 's3'])
        writeFileSync(
            path.join(home, `.claude/projects/-frame/${sid}.jsonl`),
            transcript,
        );
    plan('herdr-lane-3', `${ticks}${'- [ ] 02 · FRM-618 b\n'.repeat(3)}`);
    plan(
        'mods-lane-8',
        `${'- [x] 01 · FRM-662 a\n'.repeat(6)}- [ ] 02 · FRM-662 b\n`,
    );
    plan('stray-batch-9', '- [ ] 01 · chore 1\n');
    writeFileSync(
        path.join(home, '.claude/shelf/threads.json'),
        JSON.stringify({
            threads: [
                {
                    area: 'herdr',
                    cwd: '/frame',
                    lane: 'herdr-lane-3',
                    role: 'codie',
                    sessionId: 's1',
                    ticket: 'FRM-673',
                },
                {
                    area: 'mods',
                    cwd: '/frame',
                    lane: 'mods-lane-8',
                    role: 'codie',
                    sessionId: 's2',
                    ticket: 'FRM-662',
                },
                {
                    area: 'stray',
                    cwd: '/frame',
                    lane: 'stray-batch-9',
                    role: 'codie',
                    sessionId: 's3',
                },
            ],
        }),
    );
    const sizes: Record<string, string> = {
        'FRM-618': 'M',
        'FRM-662': 'M',
        'FRM-673': 'S',
    };
    const asked: string[] = [];
    const section = lanePaceSection(home, T0, {
        commits: () => commits,
        size: (ticket) => {
            asked.push(ticket);
            return sizes[ticket] ?? null;
        },
    });
    const rows = section.output.split('\n');

    test('a row is projected against the size of the chunk its plan marks current', () => {
        const herdr = rows.find((r) => r.includes('herdr |')) ?? '';
        expect(herdr).toContain('herdr | FRM-618');
        expect(herdr).toMatch(/^🟢/);
        expect(herdr).toContain('budget M 8 h');
        expect(asked).not.toContain('FRM-673');
    });

    test('each row reads its own lane plan, the stray never the mods lane', () => {
        expect(rows.find((r) => r.includes('mods |'))).toContain(
            'mods | FRM-662',
        );
        expect(rows.find((r) => r.includes('stray |'))).not.toContain(
            'FRM-662',
        );
    });

    test('a budget prints as its size and hours, never as sessions', () => {
        expect(section.output).not.toContain('session');
    });
});
