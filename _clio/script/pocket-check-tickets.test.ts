import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from '../../script/lib/git-fixture.ts';
import { checkPocket } from './pocket-check.ts';
import { config, task, today } from './pocket-check-world.ts';

describe('checkPocket', () => {
    test('an open task carrying a ticket line goes red', () => {
        const pointing = task({}, 'body\nticket: FRM-371 (the guard rule)');
        expect(checkPocket(config, [pointing], today)).toEqual([
            'PK-1: carries ticket FRM-371 yet is open: the item dies the turn its ticket is born, set it done',
        ]);
    });

    test('a ticket mentioned mid-line is no ticket line', () => {
        const prose = task({}, 'related: an old ticket: FRM-371');
        expect(checkPocket(config, [prose], today)).toEqual([]);
    });

    test('a bulleted ticket line goes red', () => {
        const bullet = task({}, 'body\n  - ticket: FRM-371');
        expect(checkPocket(config, [bullet], today)).toEqual([
            'PK-1: carries ticket FRM-371 yet is open: the item dies the turn its ticket is born, set it done',
        ]);
    });

    describe('a held line', () => {
        const carries = (held: string) => task({}, `ticket: FRM-72\n\n${held}`);
        const red =
            'PK-1: carries ticket FRM-72 yet is open: the item dies the turn its ticket is born, set it done';

        test('a fresh one naming the item’s own ticket passes', () => {
            const held = carries('held: 2026-10-08 — FRM-72 step 4 is next');
            expect(checkPocket(config, [held], today)).toEqual([]);
        });

        test('an old-dated one goes red', () => {
            const held = carries('held: 2026-10-05 — FRM-72 step 4 is next');
            expect(checkPocket(config, [held], today)).toEqual([red]);
        });

        test('one naming another ticket goes red', () => {
            const held = carries('held: 2026-10-08 — FRM-419 step 4 is next');
            expect(checkPocket(config, [held], today)).toEqual([red]);
        });

        test('a kept line no longer holds a ticket', () => {
            const kept = carries('kept: 2026-10-08 — FRM-72 step 4 is next');
            expect(checkPocket(config, [kept], today)).toEqual([red]);
        });

        test('a closed ticket goes red even with a fresh held line', () => {
            const held = carries('held: 2026-10-08 — FRM-72 step 4 is next');
            expect(
                checkPocket(
                    config,
                    [held],
                    today,
                    '',
                    () => true,
                    new Set(['FRM-72']),
                ),
            ).toEqual([
                'PK-1: its ticket FRM-72 is closed in linear: flip it to done',
            ]);
        });
    });

    test('a done task carrying a ticket line passes', () => {
        expect(
            checkPocket(
                config,
                [task({ status: 'done' }, 'ticket: FRM-371')],
                today,
            ),
        ).toEqual([]);
    });
});

describe('the closed-ticket net, with linear unreachable', () => {
    test('a failing x skips the net with a yellow line and never crashes', () => {
        const root = mkdtempSync(join(tmpdir(), 'pocket-linear-'));
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
                copyFileSync(
                    join(import.meta.dirname, file),
                    join(root, 'script', file),
                );
            mkdirSync(join(root, 'pocket', 'tasks'), { recursive: true });
            mkdirSync(join(root, 'bin'));
            writeFileSync(join(root, 'bin', 'x'), '#!/bin/sh\nexit 1\n', {
                mode: 0o755,
            });
            writeFileSync(join(root, 'backlog.config.yml'), config);
            writeFileSync(
                join(root, 'pocket', 'tasks', 'pk-1.md'),
                task({}, 'ticket: FRM-72').text,
            );
            const result = spawnSync(
                process.execPath,
                [join(root, 'script', 'pocket-check.ts')],
                {
                    encoding: 'utf8',
                    env: {
                        ...gitEnv(),
                        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
                    },
                    timeout: 10_000,
                },
            );
            expect(result.stderr).toContain('linear not read');
            expect(result.stderr).not.toContain('Error');
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    });
});
