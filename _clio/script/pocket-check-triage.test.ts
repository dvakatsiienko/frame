import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from '../../script/lib/git-fixture.ts';
import { checkPocket, unkeptStale } from './pocket-check.ts';
import { config, task, today } from './pocket-check-world.ts';

describe('checkPocket', () => {
    test('the 3-day triage names items untouched for 2+ days', () => {
        const old = task({ updated_date: '2026-10-07 09:00' });
        expect(checkPocket(config, [old], today, '2026-10-06')).toEqual([
            '3-day triage due (last 2026-10-06): PK-1 untouched 2+ days — revalidate each by hand: a stayer gets «kept: <date> — <why>», the rest move to linear; then `node script/pocket-check.ts --triaged`',
        ]);
        expect(checkPocket(config, [old], today, '2026-10-08')).toEqual([]);
    });

    test('a triage with nothing stale stays quiet', () => {
        expect(
            checkPocket(
                config,
                [task({ updated_date: '2026-10-08 09:00' })],
                today,
                '',
            ),
        ).toEqual([]);
    });

    test('a fresh task with no updated date reads its created date', () => {
        expect(
            checkPocket(
                config,
                [task({ created_date: '2026-10-09 09:00', updated_date: '' })],
                today,
            ),
        ).toEqual([]);
    });
});

describe('the triage stamp (--triaged)', () => {
    const stale = task({ id: 'PK-3', updated_date: '2026-10-05 09:00' });

    test('a stale item without a kept line dated today is named', () => {
        expect(unkeptStale([stale], today)).toEqual(['PK-3']);
        expect(
            unkeptStale(
                [
                    task(
                        { id: 'PK-3', updated_date: '2026-10-05 09:00' },
                        'kept: 2026-10-08 — still needed',
                    ),
                ],
                today,
            ),
        ).toEqual(['PK-3']);
    });

    test('a kept line dated today, or a fresh item, is quiet', () => {
        const kept = task(
            { id: 'PK-3', updated_date: '2026-10-05 09:00' },
            `kept: ${today} — still needed`,
        );
        expect(unkeptStale([kept, task({})], today)).toEqual([]);
    });

    describe('the cli, on a copy', () => {
        const here = import.meta.dirname;
        const run = (description: string) => {
            const root = mkdtempSync(join(tmpdir(), 'pocket-triaged-'));
            try {
                mkdirSync(join(root, 'script'));
                for (const file of [
                    'chat-lines.ts',
                    'flyway-done.ts',
                    'pocket-check.ts',
                    'prompt-groom.ts',
                    'session-registry.ts',
                    'wish-cover.ts',
                ])
                    copyFileSync(join(here, file), join(root, 'script', file));
                mkdirSync(join(root, 'pocket', 'tasks'), { recursive: true });
                writeFileSync(join(root, 'backlog.config.yml'), config);
                const day = new Date().toLocaleDateString('sv');
                const old = task(
                    { updated_date: '2000-01-01 09:00' },
                    description.replace('TODAY', day),
                );
                writeFileSync(
                    join(root, 'pocket', 'tasks', 'pk-1.md'),
                    old.text,
                );
                const result = spawnSync(
                    process.execPath,
                    [join(root, 'script', 'pocket-check.ts'), '--triaged'],
                    { encoding: 'utf8', env: gitEnv(), timeout: 10_000 },
                );
                return {
                    result,
                    stamped: existsSync(
                        join(root, 'pocket', 'last-triage.txt'),
                    ),
                };
            } finally {
                rmSync(root, { force: true, recursive: true });
            }
        };

        test('refuses with exit 1 and no stamp while a stale item lacks a kept line', () => {
            const { result, stamped } = run('body');
            expect(result.status).toBe(1);
            expect(result.stdout).toContain('--triaged refused: PK-1');
            expect(stamped).toBe(false);
        });

        test('stamps once the stale item carries a kept line dated today', () => {
            const { stamped } = run('kept: TODAY — still needed');
            expect(stamped).toBe(true);
        });
    });
});
