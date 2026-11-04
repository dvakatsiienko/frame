import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { housekeep, retentionDays } from './housekeep.ts';

const NOW = new Date('2026-11-04T12:00:00Z');

function dirWith(...names: string[]) {
    const dir = mkdtempSync(join(tmpdir(), 'otel-housekeep-'));
    for (const name of names)
        writeFileSync(join(dir, name), `{"day":"${name}"}\n`);
    return dir;
}

describe('housekeep', () => {
    it('zips a finished day and keeps its content', () => {
        const dir = dirWith('2026-11-03.jsonl');
        housekeep(dir, NOW, 90);
        expect(existsSync(join(dir, '2026-11-03.jsonl'))).toBe(false);
        expect(
            gunzipSync(
                readFileSync(join(dir, '2026-11-03.jsonl.gz')),
            ).toString(),
        ).toBe('{"day":"2026-11-03.jsonl"}\n');
    });

    it('leaves today plain, since the tap is still writing it', () => {
        const dir = dirWith('2026-11-04.jsonl');
        housekeep(dir, NOW, 90);
        expect(existsSync(join(dir, '2026-11-04.jsonl'))).toBe(true);
    });

    it('deletes a day past the retention, plain or zipped, and keeps the edge day', () => {
        const dir = dirWith(
            '2026-08-05.jsonl.gz',
            '2026-08-05.jsonl',
            '2026-08-06.jsonl.gz',
        );
        const report = housekeep(dir, NOW, 90);
        expect(report.deleted.sort()).toEqual([
            '2026-08-05.jsonl',
            '2026-08-05.jsonl.gz',
        ]);
        expect(existsSync(join(dir, '2026-08-06.jsonl.gz'))).toBe(true);
    });

    it('touches a file that is not a day file', () => {
        const dir = dirWith('daemon.log', 'daemon__2026-01-01_00-00-00.log');
        const report = housekeep(dir, NOW, 90);
        expect(report).toEqual({ deleted: [], zipped: [] });
        expect(existsSync(join(dir, 'daemon.log'))).toBe(true);
    });

    it('deletes nothing when the retention is unreadable', () => {
        const dir = dirWith('2020-01-01.jsonl');
        const report = housekeep(dir, NOW, undefined);
        expect(report.deleted).toEqual([]);
        expect(report.zipped).toEqual(['2020-01-01.jsonl']);
    });
});

describe('retentionDays', () => {
    it('reads the transcripts setting', () => {
        const path = join(mkdtempSync(join(tmpdir(), 'otel-set-')), 's.json');
        writeFileSync(path, '{"cleanupPeriodDays":45}');
        expect(retentionDays(path)).toBe(45);
    });

    it('takes cc default when the setting is absent', () => {
        const path = join(mkdtempSync(join(tmpdir(), 'otel-set-')), 's.json');
        writeFileSync(path, '{}');
        expect(retentionDays(path)).toBe(30);
    });

    it('answers nothing when the settings cannot be read', () => {
        expect(retentionDays('/nonexistent/settings.json')).toBeUndefined();
    });
});
