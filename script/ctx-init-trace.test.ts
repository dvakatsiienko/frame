import { execFileSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
    type Alarm,
    type Baseline,
    type TraceRow,
    alarmsOf,
    baselineOf,
    causeOf,
    digestOf,
    growthOf,
    lineOf,
    readTrace,
    scan,
    seatOf,
    verbFor,
} from './ctx-init-trace.ts';

const AT = '2026-10-20T10:00:00.000Z';

const assistant = (
    sessionId: string,
    over: Record<string, unknown> = {},
    usage = {
        cache_creation_input_tokens: 40,
        cache_read_input_tokens: 50,
        input_tokens: 10,
    },
) =>
    JSON.stringify({
        isSidechain: false,
        message: { model: 'claude-opus-5-5', usage },
        sessionId,
        timestamp: AT,
        type: 'assistant',
        version: '2.1.309',
        ...over,
    });

const user = (text: string) =>
    JSON.stringify({
        isSidechain: false,
        message: { content: text },
        timestamp: AT,
        type: 'user',
    });

function fixture() {
    const root = mkdtempSync(path.join(tmpdir(), 'ctx-init-'));
    const projects = path.join(root, 'projects');
    const put = (dir: string, sid: string, lines: string[]) => {
        mkdirSync(path.join(projects, dir), { recursive: true });
        writeFileSync(
            path.join(projects, dir, `${sid}.jsonl`),
            lines.join('\n'),
        );
    };
    return { file: path.join(root, 'trace.jsonl'), projects, put };
}

describe('the init-context scan', () => {
    it('writes a row with the session seat, model, init number', async () => {
        const f = fixture();
        f.put('-Users-dima-frame-cclio', 's1', [user('hi'), assistant('s1')]);
        await scan(f.file, f.projects);
        expect(readTrace(f.file)).toEqual([
            {
                at: AT,
                chars: 2,
                date: '2026-10-20',
                init: 100,
                model: 'claude-opus-5-5',
                seat: 'cclio',
                sid: 's1',
                version: '2.1.309',
            },
        ]);
    });

    it('leaves a transcript older than the first-run window unread', async () => {
        const f = fixture();
        f.put('-Users-dima-frame', 's1', [user('hi'), assistant('s1')]);
        const old = new Date(Date.now() - 30 * DAY);
        utimesSync(
            path.join(f.projects, '-Users-dima-frame', 's1.jsonl'),
            old,
            old,
        );
        await scan(f.file, f.projects);
        expect(readTrace(f.file)).toEqual([]);
    });

    it('adds nothing on a second run', async () => {
        const f = fixture();
        f.put('-Users-dima-frame', 's1', [user('hi'), assistant('s1')]);
        await scan(f.file, f.projects);
        await scan(f.file, f.projects);
        expect(readTrace(f.file).map((r) => r.sid)).toEqual(['s1']);
    });

    it('skips a fork, whose first entries carry another session id', async () => {
        const f = fixture();
        f.put('-Users-dima-frame', 'fork1', [user('hi'), assistant('parent')]);
        await scan(f.file, f.projects);
        expect(readTrace(f.file)).toEqual([]);
    });

    it('skips a sidechain entry and a synthetic model for the next main entry', async () => {
        const f = fixture();
        f.put('-Users-dima-frame', 's1', [
            user('hi'),
            assistant('s1', { isSidechain: true }),
            assistant('s1', { message: { model: '<synthetic>', usage: {} } }),
            assistant(
                's1',
                {},
                {
                    cache_creation_input_tokens: 0,
                    cache_read_input_tokens: 0,
                    input_tokens: 7,
                },
            ),
        ]);
        await scan(f.file, f.projects);
        expect(readTrace(f.file).map((r) => r.init)).toEqual([7]);
    });

    it('keeps the length of the first message, which rides in the number', async () => {
        const f = fixture();
        f.put('-Users-dima-frame', 's1', [
            user('x'.repeat(800)),
            assistant('s1'),
        ]);
        await scan(f.file, f.projects);
        expect(readTrace(f.file)[0]?.chars).toBe(800);
    });
});

describe('a session names its seat', () => {
    it.each([
        ['-Users-dima-frame-cclio', 'hi', 'cclio'],
        ['-Users-dima--local-state-ccrow-plans-2026', 'hi', 'ccrow'],
        ['-Users-dima--local-state-composer', 'hi', 'composer'],
        ['-Users-dima-frame', 'hi', 'cc'],
        ['-Users-dima-frame', 'use the crew-coder skill', 'coder'],
        ['-Users-dima-bytes', '/x:crew-verifier FRM-1', 'verifier'],
        ['-Users-dima-bytes', 'hi', 'other'],
    ])('%s with «%s» is %s', (dir, first, seat) => {
        expect(seatOf(dir, first)).toBe(seat);
    });
});

const NOW = Date.parse('2026-10-29T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const row = (
    daysAgo: number,
    init: number,
    chars = 0,
    now = NOW,
): TraceRow => ({
    at: new Date(now - daysAgo * DAY).toISOString(),
    chars,
    date: new Date(now - daysAgo * DAY).toISOString().slice(0, 10),
    init,
    model: 'claude-opus-5-5',
    seat: 'cclio',
    sid: `s${Math.random()}`,
    version: '2.1.309',
});

// three sessions at `init` in each of the last week (days 1-3) and the week before (days 8-10)
const weeks = (before: number, last: number, chars = 0, charsBefore = 0) => [
    ...[8, 9, 10].map((d) => row(d, before, charsBefore)),
    ...[1, 2, 3].map((d) => row(d, last, chars)),
];

const kinds = (rows: TraceRow[], baseline: Baseline = {}, now = NOW) =>
    alarmsOf(rows, baseline, now).map((a) => a.kind);

describe('the growth alarm', () => {
    it('fires on 12 % over the week before, with both medians', () => {
        expect(alarmsOf(weeks(100_000, 112_000), {}, NOW)).toEqual([
            {
                kind: 'week',
                model: 'claude-opus-5-5',
                now: 112_000,
                ref: 100_000,
                seat: 'cclio',
            },
        ]);
    });

    it('stays quiet at 8 %', () => {
        expect(kinds(weeks(100_000, 108_000))).toEqual([]);
    });

    it('stays quiet when the week before holds under three sessions', () => {
        const rows = [
            row(8, 100_000),
            row(9, 100_000),
            ...[1, 2, 3].map((d) => row(d, 130_000)),
        ];
        expect(kinds(rows)).toEqual([]);
    });

    it('fires over the ceiling with no growth', () => {
        const baseline = {
            'cclio|claude-opus-5-5': { ceiling: 115_000, median: 100_000 },
        };
        expect(kinds(weeks(118_000, 118_000), baseline)).toEqual(['ceiling']);
    });

    it('stays quiet when only the first message doubled', () => {
        const rows = weeks(100_000, 112_000, 56_000, 8_000);
        expect(kinds(rows, baselineOf(rows))).toEqual([]);
    });

    it('never alarms a session no seat claimed', () => {
        const rows = weeks(100_000, 150_000).map((r) => ({
            ...r,
            seat: 'other' as const,
        }));
        expect(kinds(rows, baselineOf(rows))).toEqual([]);
    });
});

describe('the slow creep check', () => {
    // a seat growing 4 % a week: the week-to-week check never fires, the baseline from the first run does by week 5
    const level = (w: number) => Math.round(100_000 * 1.04 ** w);
    const T0 = NOW;
    const rowsUpTo = (w: number) =>
        Array.from({ length: w + 2 }, (_, i) => i - 1).flatMap((k) =>
            [1, 2, 3].map((d) => row(d, level(k), 0, T0 + k * 7 * DAY)),
        );
    const baseline = baselineOf(rowsUpTo(0));
    const at = (w: number) => T0 + w * 7 * DAY;

    it('stays quiet in week 3', () => {
        expect(kinds(rowsUpTo(3), baseline, at(3))).not.toContain('creep');
    });

    it('fires by week 5', () => {
        expect(kinds(rowsUpTo(5), baseline, at(5))).toContain('creep');
    });

    it('never fires the week-to-week check on it', () => {
        expect(kinds(rowsUpTo(5), baseline, at(5))).not.toContain('week');
    });
});

describe('the alarm line names its cause and one proposal per file', () => {
    const alarm = alarmsOf(weeks(100_000, 112_000), {}, NOW)[0] as Alarm;
    const files = [
        {
            budget: 8_000,
            bytes: 9_000,
            file: 'home/.claude/rules/fleet-flow.md',
            lines: 40,
        },
        { bytes: 5_000, file: 'cclio/memory/craft-pm.md', lines: 22 },
        { budget: 4_000, bytes: 3_700, file: 'cclio/AGENTS.md', lines: 9 },
        { bytes: 1_000, file: 'AGENTS.md', lines: 2 },
    ];

    it('names the grown files, three at most, with a verb each', () => {
        expect(
            lineOf(alarm, causeOf(alarm, weeks(100_000, 112_000), NOW, files)),
        ).toBe(
            '⚠ cclio (claude-opus-5-5): starting ctx 112k, 12 % over 100k the week before — grew most: home/.claude/rules/fleet-flow.md (+40 lines) → trim it; cclio/memory/craft-pm.md (+22 lines) → trim it; cclio/AGENTS.md (+9 lines) → raise its budget',
        );
    });

    it('names the cc version instead when one changed in the window', () => {
        const rows = weeks(100_000, 112_000).map((r) =>
            NOW - Date.parse(r.at) < 7 * DAY ? { ...r, version: '2.1.312' } : r,
        );
        expect(lineOf(alarm, causeOf(alarm, rows, NOW, files))).toBe(
            '⚠ cclio (claude-opus-5-5): starting ctx 112k, 12 % over 100k the week before — cc 2.1.309 → 2.1.312 landed in that window: nothing to trim, re-baseline?',
        );
    });

    it('names no version for one that already ran in the week before', () => {
        const rows = weeks(100_000, 112_000).map((r) => {
            const age = (NOW - Date.parse(r.at)) / DAY;
            return age < 7 || age > 9.5 ? { ...r, version: '2.1.312' } : r;
        });
        expect(causeOf(alarm, rows, NOW, files).kind).toBe('files');
    });

    it('reads only growing files out of the numstat, biggest first', () => {
        expect(
            growthOf(
                '10\t2\ta.md\n3\t0\tb.md\n1\t9\tc.md\n-\t-\timg.png\n2\t0\ta.md\n',
            ),
        ).toEqual([
            { file: 'a.md', lines: 10 },
            { file: 'b.md', lines: 3 },
        ]);
    });

    it.each([
        ['cclio/memory/x.md', 9_000, 8_000, 'trim it'],
        ['cclio/memory/x.md', 7_500, 8_000, 'raise its budget'],
        [
            'home/.claude/rules/x.md',
            100,
            undefined,
            'move it to an on-demand skill',
        ],
        ['cclio/memory/x.md', 100, undefined, 'trim it'],
    ])('%s at %i of %s: %s', (file, bytes, budget, verb) => {
        expect(verbFor(file, bytes, budget)).toBe(verb);
    });
});

describe('the boot digest', () => {
    const none = () => [];

    it('prints each seat and model with its starting number, in seat order', () => {
        const rows = [
            ...[1, 2, 3].map((d) => ({
                ...row(d, 100_000),
                seat: 'coder' as const,
            })),
            ...[1, 2, 3].map((d) => row(d, 129_000)),
        ];
        expect(digestOf(rows, {}, NOW, none)).toEqual([
            'starting ctx (net, newest 5 sessions): cclio 129k opus-5-5 · coder 100k opus-5-5 · ccrow no session in 14 days · composer no session in 14 days · verifier no session in 14 days · cc no session in 14 days',
        ]);
    });

    it('adds the alarm line under it when a seat grew', () => {
        const rows = weeks(100_000, 112_000);
        expect(digestOf(rows, {}, NOW, none)).toEqual([
            'starting ctx (net, newest 5 sessions): cclio 112k opus-5-5 · ccrow no session in 14 days · composer no session in 14 days · coder no session in 14 days · verifier no session in 14 days · cc no session in 14 days',
            expect.stringMatching(
                /^⚠ cclio \(claude-opus-5-5\): starting ctx 112k, 12 % over 100k/,
            ),
        ]);
    });

    const grownFiles = () => [
        { bytes: 900, file: 'cclio/memory/craft-pm.md', lines: 30 },
    ];

    it('names the grown memory file in the alarm line', () => {
        const lines = digestOf(weeks(100_000, 112_000), {}, NOW, grownFiles);
        expect(lines[1]).toContain(
            'cclio/memory/craft-pm.md (+30 lines) → trim it',
        );
    });

    it('reads git only when an alarm fires', () => {
        const grown = vi.fn(grownFiles);
        digestOf(weeks(100_000, 108_000), {}, NOW, grown);
        expect(grown).not.toHaveBeenCalled();
    });

    it('says so when no session was traced lately', () => {
        expect(digestOf([], {}, NOW, none)).toEqual([
            'starting ctx: no sessions traced in the last 14 days',
        ]);
    });
});

describe('the cclio boot digest line', () => {
    const hook = readFileSync(
        path.join(
            import.meta.dirname,
            '../cclio/.claude/hooks/boot-prefetch.sh',
        ),
        'utf8',
    );
    const fn = hook.slice(
        hook.indexOf('init_ctx_digest() {'),
        hook.indexOf('echo "-- init ctx'),
    );

    // the function alone, with `fail` recording a red, run against a stub of the trace script
    const run = (stub: string) => {
        const dir = mkdtempSync(path.join(tmpdir(), 'ctx-boot-'));
        const script = path.join(dir, 'stub.ts');
        writeFileSync(script, stub);
        return execFileSync(
            'bash',
            [
                '-c',
                `fail() { echo "RED $1"; }\n${fn}\nINIT_CTX_SCRIPT=${script} init_ctx_digest`,
            ],
            { encoding: 'utf8' },
        ).trim();
    };

    it('prints the digest the script prints', () => {
        expect(run("console.log('starting ctx: cclio 129k');")).toBe(
            'starting ctx: cclio 129k',
        );
    });

    it('turns a script that dies into a note, never a red', () => {
        expect(run("throw new Error('no trace');")).toMatch(
            /^🟡 init-ctx trace could not run \(or took over 3 s\): .*no trace/,
        );
    });

    it('calls the digest outside every day-opener block, so compact mode prints it', () => {
        const lines = hook.split('\n');
        const call = lines.indexOf('init_ctx_digest');
        const opener = 'if [ -z "$' + '{COMPACT:-}" ]; then';
        const blocks = lines
            .map((l, i) => (l === opener ? i : -1))
            .filter((i) => i >= 0)
            .map((from) => [from, lines.indexOf('fi', from)]);
        expect(
            blocks.filter(([from = 0, to = 0]) => call > from && call < to),
        ).toEqual([]);
    });
});
