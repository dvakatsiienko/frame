import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { flawlogCounts, medianMinutes } from './flow-report.ts';

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
