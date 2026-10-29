import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    type Baseline,
    type TraceRow,
    alarmsOf,
    baselineOf,
    readTrace,
    scan,
    seatOf,
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
    it('writes one row per session with its seat, model and init number', async () => {
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

    it('skips a sidechain entry and a synthetic model, and takes the next main entry', async () => {
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

    it('stays quiet when only the first message doubled and memory stayed flat', () => {
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
