import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const READ = join(import.meta.dirname, 'read.ts');
const OLD_ROW =
    '2026-11-24T10:00:00+02:00\t25.00\tmods-lane-9 135.5s\t11 120.0s vitest @ mods-lane-9';
const NEW_ROW =
    '2026-11-24T13:00:00+02:00\t31.00\tspeak-hunt 90.0s\t21 80.0s go test @ speak-hunt';
const SINCE = '2026-11-24T12:00:00+02:00';

// a fixture X_STATE: the roast log with a row before and a row after the stamp, the last-poll stamp as asked
function state(lastPollAgeMinutes: number | null, rows = [OLD_ROW, NEW_ROW]) {
    const dir = mkdtempSync(join(tmpdir(), 'roast-read-'));
    writeFileSync(
        join(dir, 'x-cpu-roast-culprit-log.log'),
        `${rows.join('\n')}\n`,
    );
    if (lastPollAgeMinutes !== null)
        writeFileSync(
            join(dir, 'x-cpu-roast-culprit-log.last-poll'),
            String(Date.now() - lastPollAgeMinutes * 60_000),
        );
    return dir;
}

const read = (dir: string, since: string) =>
    spawnSync(process.execPath, [READ, '--since', since], {
        encoding: 'utf8',
        env: { ...process.env, X_STATE: dir },
        timeout: 10_000,
    });

describe('read.ts, the one reader of the roast log', () => {
    it('prints the one row after the stamp and exits 1', () => {
        const got = read(state(1), SINCE);

        expect(got.stdout.trim()).toBe(NEW_ROW);
        expect(got.status).toBe(1);
    });

    it('exits 0 and prints no row when none is after the stamp and the job ran a minute ago', () => {
        const got = read(state(1, [OLD_ROW]), SINCE);

        expect(got.stdout).not.toContain('mods-lane-9');
        expect(got.stderr).toBe('');
        expect(got.status).toBe(0);
    });

    it.each([
        { age: 11, name: 'older than 10 minutes' },
        { age: null, name: 'missing' },
    ])(
        'exits 1 and says the job is not running when the last-poll stamp is $name',
        ({ age }) => {
            const got = read(state(age, [OLD_ROW]), SINCE);

            expect(got.stdout).toContain('the job is not running');
            expect(got.status).toBe(1);
        },
    );

    it('reads an HH:MM stamp as today', () => {
        const row = `${new Date().toISOString()}\t22.00\tmods-lane-9 10.0s\t11 10.0s vitest @ mods-lane-9`;

        // a row from years ago is before today's midnight whatever day this runs
        const old = OLD_ROW.replace('2026-11-24', '2020-01-01');

        const got = read(state(1, [old, row]), '00:00');

        expect(got.stdout.trim()).toBe(row);
        expect(got.status).toBe(1);
    });
});
