import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    flawlogCounts,
    guardDay,
    medianMinutes,
    transcriptCounts,
} from './flow-report.ts';

const START = new Date('2026-10-01T00:00:00');
const AT = '2026-10-05T10:00:00.000Z';

// one session transcript in a fresh `<projects>/<project>/` dir
const countsFor = (...lines: object[]) => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-transcripts-'));
    mkdirSync(join(dir, '-Users-dima-frame'));
    writeFileSync(
        join(dir, '-Users-dima-frame', 'session.jsonl'),
        lines.map((l) => JSON.stringify(l)).join('\n'),
    );
    return transcriptCounts(dir, START, ['authoring-skill.md', 'models.md']);
};
const said = (text: string) => ({
    message: { content: text },
    timestamp: AT,
    type: 'user',
});
const called = (name: string, input: object, timestamp = AT) => ({
    message: { content: [{ input, name, type: 'tool_use' }] },
    timestamp,
    type: 'assistant',
});
const bash = (command: string) => called('Bash', { command });
const crewLoad = called('Skill', { skill: 'x:crew-coder' });

const countOf = (dir: string, since: string, tag: string) =>
    flawlogCounts(dir, since).find((c) => c.tag === tag)?.count;

describe('flawlogCounts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-report-'));
    writeFileSync(
        join(dir, '2026-10-05-day.md'),
        [
            '# flawlog — 2026-10-05',
            '- the brief named a banned path #brief',
            '  - the exit lines lived in the coder brief only (`#brief`) #dima-caught',
            '- a #briefing word is not the tag',
            '- an untagged line',
        ].join('\n'),
    );
    writeFileSync(
        join(dir, '2026-09-01-old.md'),
        '- outside the window #brief\n',
    );

    it('counts #brief lines inside the window', () => {
        expect(countOf(dir, '2026-09-22', '#brief')).toBe(2);
    });

    it('counts files from the window start on', () => {
        expect(countOf(dir, '2026-09-01', '#brief')).toBe(3);
    });
});

describe('medianMinutes', () => {
    const pr = (mins: number) => ({
        createdAt: '2026-10-01T10:00:00Z',
        mergedAt: new Date(
            Date.parse('2026-10-01T10:00:00Z') + mins * 60_000,
        ).toISOString(),
    });

    it('averages the two middle prs on an even count', () => {
        expect(medianMinutes([pr(40), pr(10), pr(20), pr(100)])).toBe(30);
    });

    it('takes the middle pr on an odd count', () => {
        expect(medianMinutes([pr(40), pr(10), pr(100)])).toBe(40);
    });

    it('answers undefined for no prs', () => {
        expect(medianMinutes([])).toBeUndefined();
    });
});

describe('transcriptCounts', () => {
    it('counts a bare cc run', () => {
        const probe = "claude -p --model haiku --safe-mode 'hi'";
        expect(countsFor(bash(probe)).bareRuns).toBe(1);
    });

    it('counts no bare run once the flag is gone', () => {
        expect(countsFor(bash("claude -p --model haiku 'hi'")).bareRuns).toBe(
            0,
        );
    });

    it('counts a search for the flag as no bare run', () => {
        expect(countsFor(bash('rg -- --safe-mode docs')).bareRuns).toBe(0);
    });

    it('skips a bare run from before the window', () => {
        const old = called(
            'Bash',
            { command: 'claude -p --safe-mode x' },
            '2026-09-20T10:00:00.000Z',
        );
        expect(countsFor(old).bareRuns).toBe(0);
    });

    it('marks a crew load brief-led when an earlier message names the skill', () => {
        expect(
            countsFor(said('load `x:crew-coder` first'), crewLoad),
        ).toMatchObject({ briefLed: 1, falseFires: 0 });
    });

    it('marks a crew load with no naming message a false fire', () => {
        expect(countsFor(said('fix the typo'), crewLoad)).toMatchObject({
            briefLed: 0,
            falseFires: 1,
        });
    });

    it('counts a Read of a docs/knowledge file', () => {
        const read = called('Read', {
            file_path: '/Users/dima/frame/docs/knowledge/models.md',
        });
        expect(countsFor(read).knowledgeReads).toEqual([
            { count: 1, file: 'models.md' },
            { count: 0, file: 'authoring-skill.md' },
        ]);
    });
});

describe('guardDay', () => {
    it("sums the day's keys of x-mod-guard's store files, the old guard name included", () => {
        const dir = mkdtempSync(join(tmpdir(), 'flow-guard-'));
        const day = (refused: number, escaped: number) => ({
            escaped,
            refused,
        });
        writeFileSync(
            join(dir, 'x-mod-guard_inline-abc.json'),
            JSON.stringify({
                'day:2026-10-05:a1': day(9, 9),
                'day:2026-10-06:a1': day(2, 1),
                'day:2026-10-06:b2': day(1, 0),
                'event:1:a1': { kind: 'refused' },
            }),
        );
        writeFileSync(
            join(dir, 'guard_inline-0ld.json'),
            JSON.stringify({ 'day:2026-10-06:c3': day(1, 0) }),
        );
        writeFileSync(
            join(dir, 'x-mod-stash_inline-def.json'),
            JSON.stringify({ 'day:2026-10-06:d4': day(5, 5) }),
        );
        expect(guardDay(dir, '2026-10-06')).toEqual({
            escaped: 1,
            refused: 4,
            sessions: 3,
        });
    });
});
