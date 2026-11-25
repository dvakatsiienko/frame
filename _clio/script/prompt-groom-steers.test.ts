import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { day, steer } from './prompt-groom-world.ts';

describe('prompt-groom oN (FRM-451)', () => {
    function groom(id: string) {
        const root = mkdtempSync(join(tmpdir(), 'prompt-groom-'));
        try {
            const grooms = join(root, 'grooms');
            mkdirSync(join(root, 'bin'));
            // helga is stubbed up by her record, so nothing is spawned
            writeFileSync(
                join(root, 'bin', 'x'),
                `#!/bin/sh\necho '{"data":{"threads":[{"role":"copyist"}]}}'\n`,
                { mode: 0o755 },
            );
            const transcript = join(root, 't.jsonl');
            writeFileSync(
                transcript,
                [
                    steer('o68', 'first word'),
                    steer('o69', 'ship it'),
                    steer('o68', 'second word'),
                    steer('o68', 'second word'),
                ].join('\n'),
            );
            const out = spawnSync(
                process.execPath,
                [
                    join(import.meta.dirname, 'prompt-groom.ts'),
                    id,
                    '--date',
                    day,
                    '--transcript',
                    transcript,
                ],
                {
                    encoding: 'utf8',
                    env: {
                        ...process.env,
                        CLIO_THREAD: '',
                        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
                        PROMPT_GROOM_DIR: grooms,
                    },
                    timeout: 10_000,
                },
            );
            const rawFile = join(grooms, `${day}-${id}.raw.md`);
            return {
                out,
                raw: existsSync(rawFile) && readFileSync(rawFile, 'utf8'),
            };
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    }

    test('cuts the steer into grooms/<day>-oN.raw.md and prints the chore', () => {
        const { out, raw } = groom('o69');
        expect(out.status).toBe(0);
        expect(raw).toBe('ship it\n');
        expect(out.stdout).toContain(`${day}-o69.groomed.md`);
    });

    test('an id with two steers cuts both, a redelivered one once', () => {
        expect(groom('o68').raw).toBe('first word\nsecond word\n');
    });

    test('an id the transcript lacks refuses', () => {
        const { out } = groom('o70');
        expect(out.status).toBe(1);
        expect(out.stderr).toContain('o70');
    });
});

describe('ungroomedSteersToday', () => {
    test('with no transcript named, no steer is owed', async () => {
        const home = mkdtempSync(join(tmpdir(), 'steer-home-'));
        const dir = join(home, '.claude/projects/-Users-dima-frame--clio');
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            join(dir, 'other-thread.jsonl'),
            `${steer('o4', 'another thread steer')}\n`,
        );
        vi.stubEnv('HOME', home);
        vi.resetModules();
        const groom = await import('./prompt-groom.ts');
        vi.unstubAllEnvs();
        expect(groom.ungroomedSteersToday('2026-10-26', '')).toEqual([]);
    });
});
