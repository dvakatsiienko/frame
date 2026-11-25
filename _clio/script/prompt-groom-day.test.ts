import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { unnumberedAsks } from './prompt-groom.ts';
import { day, steer } from './prompt-groom-world.ts';

describe('unnumberedAsks', () => {
    const day = '2026-11-01';
    const dir = mkdtempSync(join(tmpdir(), 'asks-'));
    writeFileSync(
        join(dir, `${day}-1419.groomed.md`),
        `W1 (${day} 14:19, dima): a wish\n❓ ask (${day} 14:19, dima): what is it?\nW2 (${day} 14:19, dima): a numbered one ❓\n`,
    );
    writeFileSync(
        join(dir, `${day}-inbox.groomed.md`),
        '❓ asks:\n  1. the inbox prep keeps its own shape ❓ ask\n',
    );
    test('a prompt groom’s ask with no W-id is named', () => {
        expect(unnumberedAsks(day, dir)).toEqual([
            [
                `${day}-1419.groomed.md`,
                `❓ ask (${day} 14:19, dima): what is it?`,
            ],
        ]);
    });
});

describe('--day', () => {
    const dayFile = '## 10:00\n\nship the thing\n\n';

    function run(opts: {
        grooms?: Record<string, string>;
        isLinearDown?: boolean;
        linear?: string;
        now?: string | null;
        pocket?: Record<string, string>;
        prompts?: string;
        threadTranscripts?: Record<string, string[]>;
        sessionId?: string;
        steers?: string[] | null;
    }) {
        const root = mkdtempSync(join(tmpdir(), 'prompt-groom-'));
        try {
            // linear is stubbed: x prints one ticket body, or fails when it is down
            mkdirSync(join(root, 'bin'));
            writeFileSync(
                join(root, 'bin', 'x'),
                opts.isLinearDown
                    ? '#!/bin/sh\nexit 1\n'
                    : `#!/bin/sh\necho '${JSON.stringify({ data: { issues: { nodes: [{ description: opts.linear ?? '', identifier: 'FRM-1' }] } } })}'\n`,
                { mode: 0o755 },
            );
            const transcript = join(root, 't.jsonl');
            writeFileSync(transcript, (opts.steers ?? []).join('\n'));
            for (const [file, rows] of Object.entries(
                opts.threadTranscripts ?? {},
            )) {
                const at = join(root, '.claude/projects', file);
                mkdirSync(join(at, '..'), { recursive: true });
                writeFileSync(at, rows.join('\n'));
            }
            for (const [dir, files] of [
                ['grooms', opts.grooms],
                ['pocket', opts.pocket],
            ] as const) {
                mkdirSync(join(root, dir));
                for (const [name, text] of Object.entries(files ?? {})) {
                    mkdirSync(join(root, dir, name, '..'), { recursive: true });
                    writeFileSync(join(root, dir, name), text);
                }
            }
            mkdirSync(join(root, 'prompts'));
            writeFileSync(
                join(root, 'prompts', `${day}.md`),
                opts.prompts ?? dayFile,
            );
            return spawnSync(
                process.execPath,
                [
                    join(import.meta.dirname, 'prompt-groom.ts'),
                    '--day',
                    day,
                    ...(opts.now === null
                        ? []
                        : ['--now', opts.now ?? '10:30']),
                    ...(opts.steers === null
                        ? []
                        : ['--transcript', transcript]),
                ],
                {
                    encoding: 'utf8',
                    env: {
                        ...process.env,
                        CLAUDE_CODE_SESSION_ID: opts.sessionId ?? '',
                        CLIO_THREAD: '',
                        HOME: root,
                        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
                        POCKET_DIR: join(root, 'pocket'),
                        PROMPT_GROOM_DIR: join(root, 'grooms'),
                        PROMPT_RAW_DIR: join(root, 'prompts'),
                        TZ: 'UTC',
                    },
                    timeout: 10_000,
                },
            );
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    }

    const groomed = (id = 'W1') => ({
        [`${day}-1000.groomed.md`]: `${id} (${day} 10:00, dima): ship it\n`,
    });

    test('a lifted W-line keeps the home it had before the lift', () => {
        const out = run({
            grooms: {
                [`${day}-1000.groomed.md`]: `W1 (${day} 10:00, dima): ship it #lifted\n`,
            },
            pocket: { 'pk-1.md': `W1 (${day} 10:00, dima): ship it\n` },
        });
        expect(out.status).toBe(0);
    });

    test('an old ungroomed prompt reds with the fix', () => {
        const out = run({});
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('10:00 — no groom: ship the thing');
        expect(out.stdout).toContain('prompt-groom.ts 10:00');
    });

    test('a groomed prompt passes', () => {
        expect(
            run({ grooms: groomed(), pocket: { 'a.md': 'W1 ship it' } }).status,
        ).toBe(0);
    });

    test('a no-wish line passes the prompt', () => {
        expect(
            run({
                grooms: { [`${day}.no-wish.md`]: '10:00 — just a thanks\n' },
            }).status,
        ).toBe(0);
    });

    test('a prompt under 10 minutes old passes', () => {
        expect(run({ now: '10:10' }).status).toBe(0);
    });

    test('a prompt of a slash command alone passes', () => {
        expect(
            run({ prompts: '## 10:00\n\n/x:mobile-mode 10min\n\n' }).status,
        ).toBe(0);
    });

    test('a prep note opening with a W-id is no W-line', () => {
        const out = run({
            grooms: {
                ...groomed(),
                [`${day}-inbox.groomed.md`]:
                    '- W1 has no bold title in his file\n',
            },
            pocket: { 'a.md': 'W1 ship it' },
        });
        expect(out.status).toBe(0);
    });

    test('a W-line whose only home is a flyway notes archive has one', () => {
        const out = run({
            grooms: groomed(),
            pocket: {
                'archive/notes/pk-1.md': `W1 (${day} 10:00, dima): ship it\n`,
            },
        });
        expect(out.status).toBe(0);
    });

    test('a groomed W-id with no home reds', () => {
        const out = run({ grooms: groomed('W7'), pocket: { 'a.md': 'W8' } });
        expect(out.status).toBe(1);
        expect(out.stdout).toContain(`W7 (${day}-1000.groomed.md) — no home`);
    });

    test('a groomed W-line whose id and text share a line of a recent linear body passes', () => {
        expect(
            run({ grooms: groomed('W7'), linear: '* W7 folded: ship it here' })
                .status,
        ).toBe(0);
    });

    test('a W-line text found without its id does not home it', () => {
        const out = run({
            grooms: groomed('W7'),
            linear: 'folded ship it here',
        });
        expect(out.status).toBe(1);
        expect(out.stdout).toContain(`W7 (${day}-1000.groomed.md) — no home`);
    });

    test('a W-id alone does not home a W-line, ids repeat across items', () => {
        const out = run({
            grooms: groomed('W7'),
            pocket: { 'a.md': 'W7 (2026-10-01 08:00, dima): another thing' },
        });
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('W7');
    });

    test('a sibling line sharing the stamp does not home a W-line', () => {
        const out = run({
            grooms: groomed('W7'),
            pocket: { 'a.md': `W2 (${day} 10:00, dima): another line` },
        });
        expect(out.status).toBe(1);
        expect(out.stdout).toContain(`W7 (${day}-1000.groomed.md) — no home`);
    });

    test('an ungroomed steer of the day reds in the prompt shape', () => {
        const out = run({
            prompts: '',
            steers: [steer('o69', 'ship it now')],
        });
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('o69 — no groom: ship it now');
        expect(out.stdout).toContain('prompt-groom.ts o69');
    });

    test('a groomed steer and a no-wish steer pass', () => {
        expect(
            run({
                grooms: {
                    [`${day}-o68.groomed.md`]: `W1 (${day} 09:15, dima, o68 steer): other wish\n`,
                    [`${day}.no-wish.md`]: 'o69 — just a thanks\n',
                },
                pocket: { 'a.md': 'W1 other wish' },
                prompts: '',
                steers: [steer('o68', 'other'), steer('o69', 'thanks')],
            }).status,
        ).toBe(0);
    });

    const otherThread = {
        '-Users-dima-frame--clio/other-thread.jsonl': [
            steer('o4', 'another board steer'),
        ],
    };

    test('with no transcript and no session id, another thread’s steer is owed nothing', () => {
        const out = run({
            prompts: '',
            steers: null,
            threadTranscripts: otherThread,
        });
        // a word match: the random temp dir in the green line can spell «o4»
        expect(out.stdout).not.toMatch(/\bo4\b/);
        expect(out.status).toBe(0);
    });

    test('with no transcript, the session id names this thread’s own', () => {
        const out = run({
            prompts: '',
            sessionId: 'abc',
            steers: null,
            threadTranscripts: {
                ...otherThread,
                '-Users-dima-frame--claude-worktrees-clio-wing-1--clio/abc.jsonl':
                    [steer('o5', 'this board steer')],
            },
        });
        expect(out.stdout).toContain('o5 — no groom: this board steer');
        // the fixture's random temp dir can hold «o4», so the check reads the steer ids, never the whole line
        expect(out.stdout).not.toMatch(/🔴 o4\b/);
    });

    test('a steer of another day is not checked', () => {
        expect(
            run({
                prompts: '',
                steers: [steer('o69', 'x').replace('10-26', '10-25')],
            }).status,
        ).toBe(0);
    });

    test('a past day counts every prompt as old without --now', () => {
        const out = run({ now: null, prompts: '## 23:45\n\nlate wish\n\n' });
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('23:45 — no groom: late wish');
    });

    test('linear down: one 🟡 line, the prompt reds still print, exit 1', () => {
        const out = run({ isLinearDown: true });
        expect(out.status).toBe(1);
        expect(out.stderr).toContain('🟡 linear not read');
        expect(out.stdout).toContain('10:00 — no groom: ship the thing');
    });

    test('a prompt of a harness event alone passes', () => {
        expect(
            run({
                prompts:
                    '## 10:00\n\n<side-sessions-event>no session works\nnow</side-sessions-event>\n\n',
            }).status,
        ).toBe(0);
    });

    test('a harness event beside dima’s own text still reds', () => {
        expect(
            run({
                prompts:
                    '## 10:00\n\n<task-notification>done</task-notification>\nship the thing\n\n',
            }).status,
        ).toBe(1);
    });

    test('a groomed W-id in a pocket file passes', () => {
        expect(
            run({
                grooms: groomed('W7'),
                pocket: { 'a.md': 'W7 see ship it here' },
            }).status,
        ).toBe(0);
    });
});
