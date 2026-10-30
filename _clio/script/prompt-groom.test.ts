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
import { describe, expect, test } from 'vitest';

import {
    dayBefore,
    newUnstamped,
    rawPromptAt,
    strayRaws,
    ungroomedStamps,
} from './prompt-groom.ts';

const day = '2026-10-26';

const steer = (id: string, text: string) =>
    JSON.stringify({
        attachment: { content: [`- ${id} · his steer: «${text}»`] },
        timestamp: '2026-10-26T09:15:00Z',
        type: 'attachment',
    });

describe('ungroomedStamps', () => {
    const text = [
        'W301 (2026-10-26 09:12, dima): fold this',
        '* W302 (2026-10-26 09:12, dima, on Q2): and this',
        'W303 (2026-10-26 10:40, dima): a second prompt',
        'W305 an unstamped line',
    ].join('\n');

    test('names each prompt time born that day with no groom, once', () => {
        expect(ungroomedStamps(text, day, () => false)).toEqual([
            '09:12',
            '10:40',
        ]);
    });

    test('an inbox stamp reds until that day inbox is groomed', () => {
        const inbox = 'W306 (2026-10-26 inbox, dima): from the vault';
        expect(ungroomedStamps(inbox, day, () => false)).toEqual(['inbox']);
        expect(ungroomedStamps(inbox, '2026-10-27', () => false)).toEqual([
            'inbox --date 2026-10-26',
        ]);
        expect(
            ungroomedStamps(
                inbox,
                day,
                (d, hhmm) => d === day && hhmm === 'inbox',
            ),
        ).toEqual([]);
        expect(newUnstamped(`${inbox}\n`, '')).toEqual([]);
    });

    test('helga’s W<n> · text (stamp) shape reads like the stamp-first one', () => {
        const drift = 'W7 · fold this one (2026-10-26 09:12, dima)';
        expect(ungroomedStamps(drift, day, () => false)).toEqual(['09:12']);
        expect(newUnstamped(`${drift}\n`, '')).toEqual([]);
    });

    test('a groomed prompt time stays quiet', () => {
        expect(
            ungroomedStamps(text, day, (_, hhmm) => hhmm === '09:12'),
        ).toEqual(['10:40']);
    });

    test('an earlier day since the rules start is checked and names its date', () => {
        const earlier = 'W304 (2026-10-25 22:00, dima): before midnight';
        expect(ungroomedStamps(earlier, day, () => false)).toEqual([
            '22:00 --date 2026-10-25',
        ]);
        expect(
            ungroomedStamps(earlier, day, (d) => d === '2026-10-25'),
        ).toEqual([]);
    });

    test('a stamp dated after today is not checked', () => {
        expect(
            ungroomedStamps('W1 (2026-10-27 09:00, dima): x', day, () => false),
        ).toEqual([]);
    });

    test('a stamp before the rule start is never checked', () => {
        expect(
            ungroomedStamps(
                'W1 (2026-10-21 14:00, dima): old',
                '2026-10-25',
                () => false,
            ),
        ).toEqual([]);
    });

    test('on the rule day, only a prompt from 14:50 on is checked', () => {
        const both =
            'W1 (2026-10-25 14:40, dima): before\nW2 (2026-10-25 15:00, dima): after';
        expect(ungroomedStamps(both, '2026-10-25', () => false)).toEqual([
            '15:00',
        ]);
    });
});

describe('strayRaws', () => {
    const now = new Date('2026-10-26T12:00:00');

    test('a raw older than 10 minutes with no groomed twin is named', () => {
        expect(strayRaws(['2026-10-26-1100.raw.md'], now)).toEqual([
            '2026-10-26-1100.raw.md',
        ]);
    });

    test('a groomed twin clears it', () => {
        expect(
            strayRaws(
                ['2026-10-26-1100.raw.md', '2026-10-26-1100.groomed.md'],
                now,
            ),
        ).toEqual([]);
    });

    test('a raw younger than 10 minutes waits', () => {
        expect(strayRaws(['2026-10-26-1155.raw.md'], now)).toEqual([]);
    });

    test('a raw from before the rules start is never named', () => {
        expect(strayRaws(['2026-10-25-1440.raw.md'], now)).toEqual([]);
    });
});

describe('--check against a groom file on disk', () => {
    const folded = 'W1 (2026-10-25 15:00, dima): ship the exact words\n';

    function check(groomed: string) {
        const root = mkdtempSync(join(tmpdir(), 'prompt-groom-'));
        try {
            writeFileSync(join(root, '2026-10-25-1500.groomed.md'), groomed);
            writeFileSync(join(root, 'body.md'), folded);
            return spawnSync(
                process.execPath,
                [
                    join(import.meta.dirname, 'prompt-groom.ts'),
                    '--check',
                    join(root, 'body.md'),
                ],
                {
                    encoding: 'utf8',
                    env: { ...process.env, PROMPT_GROOM_DIR: root },
                },
            ).status;
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    }

    test('a placeholder groom file reds', () => {
        expect(check('todo\n')).toBe(1);
    });

    test('a groom with a W-line of the same stamp passes though the fold’s words differ', () => {
        expect(
            check('W1 (2026-10-25 15:00, dima): composed other words\n'),
        ).toBe(0);
    });

    test('a groom stamped for another minute reds', () => {
        expect(
            check('W1 (2026-10-25 15:01, dima): ship the exact words\n'),
        ).toBe(1);
    });
});

describe('--check on an inbox stamp', () => {
    const body = [
        'W9 (2026-10-26 inbox, dima): finish the round',
        'raw drop (2026-10-26 inbox, dima): 1. finish the round, if not finished',
    ].join('\n');

    function check(prep: string | undefined) {
        const root = mkdtempSync(join(tmpdir(), 'prompt-groom-'));
        try {
            if (prep !== undefined)
                writeFileSync(join(root, '2026-10-26-inbox.groomed.md'), prep);
            writeFileSync(join(root, 'body.md'), body);
            return spawnSync(
                process.execPath,
                [
                    join(import.meta.dirname, 'prompt-groom.ts'),
                    '--check',
                    join(root, 'body.md'),
                ],
                {
                    encoding: 'utf8',
                    env: { ...process.env, PROMPT_GROOM_DIR: root },
                },
            );
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    }

    test('with no prep copy the red names the copy step, not a command that cannot work', () => {
        const out = check(undefined);
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('inbox-helga.md');
        expect(out.stdout).not.toContain('node script/prompt-groom.ts inbox');
    });

    test('a prep copy that quotes the item’s raw drop passes', () => {
        expect(check('> 1. finish the round, if not finished\n').status).toBe(
            0,
        );
    });

    test('a prep copy without the item’s raw drop reds, though the file exists', () => {
        expect(check('> 1. some other ask\n').status).toBe(1);
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
        steers?: string[];
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
            for (const [dir, files] of [
                ['grooms', opts.grooms],
                ['pocket', opts.pocket],
            ] as const) {
                mkdirSync(join(root, dir));
                for (const [name, text] of Object.entries(files ?? {}))
                    writeFileSync(join(root, dir, name), text);
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
                    '--transcript',
                    transcript,
                ],
                {
                    encoding: 'utf8',
                    env: {
                        ...process.env,
                        HOME: root,
                        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
                        POCKET_DIR: join(root, 'pocket'),
                        PROMPT_GROOM_DIR: join(root, 'grooms'),
                        PROMPT_RAW_DIR: join(root, 'prompts'),
                        TZ: 'UTC',
                    },
                },
            );
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    }

    const groomed = (id = 'W1') => ({
        [`${day}-1000.groomed.md`]: `${id} (${day} 10:00, dima): ship it\n`,
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

    test('a groomed W-id with no home reds', () => {
        const out = run({ grooms: groomed('W7'), pocket: { 'a.md': 'W8' } });
        expect(out.status).toBe(1);
        expect(out.stdout).toContain(`W7 (${day}-1000.groomed.md) — no home`);
    });

    test('a groomed W-line whose text is in a recent linear body passes', () => {
        expect(
            run({ grooms: groomed('W7'), linear: 'folded ship it here' })
                .status,
        ).toBe(0);
    });

    test('a W-id alone does not home a W-line, ids repeat across items', () => {
        const out = run({
            grooms: groomed('W7'),
            pocket: { 'a.md': 'W7 (2026-10-01 08:00, dima): another thing' },
        });
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('W7');
    });

    test('a W-line homed by its stamp alone passes', () => {
        expect(
            run({
                grooms: groomed('W7'),
                pocket: { 'a.md': `W2 (${day} 10:00, dima): reworded` },
            }).status,
        ).toBe(0);
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
                pocket: { 'a.md': 'other wish' },
                prompts: '',
                steers: [steer('o68', 'other'), steer('o69', 'thanks')],
            }).status,
        ).toBe(0);
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
                pocket: { 'a.md': 'see ship it here' },
            }).status,
        ).toBe(0);
    });
});

describe('prompt-groom inbox', () => {
    test('the verb refuses an inbox with the copy step', () => {
        const out = spawnSync(
            process.execPath,
            [join(import.meta.dirname, 'prompt-groom.ts'), 'inbox'],
            { encoding: 'utf8' },
        );
        expect(out.status).toBe(1);
        expect(out.stderr).toContain('inbox-helga.md');
    });
});

describe('prompt-groom oN (FRM-451)', () => {
    function groom(id: string) {
        const root = mkdtempSync(join(tmpdir(), 'prompt-groom-'));
        try {
            const grooms = join(root, 'grooms');
            mkdirSync(join(root, 'bin'));
            // helga is stubbed up, so nothing is spawned
            writeFileSync(
                join(root, 'bin', 'claude'),
                `#!/bin/sh\necho '[{"name":"helga","status":"idle"}]'\n`,
                { mode: 0o755 },
            );
            const transcript = join(root, 't.jsonl');
            writeFileSync(
                transcript,
                `${steer('o68', 'other')}\n${steer('o69', 'ship it')}\n`,
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
                        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
                        PROMPT_GROOM_DIR: grooms,
                    },
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

    test('an id the transcript lacks refuses', () => {
        const { out } = groom('o70');
        expect(out.status).toBe(1);
        expect(out.stderr).toContain('o70');
    });
});

describe('--linear, with a stubbed x', () => {
    test('a stray raw prompt reds under the halt’s door too', () => {
        const root = mkdtempSync(join(tmpdir(), 'prompt-groom-'));
        try {
            const grooms = join(root, 'grooms');
            mkdirSync(grooms);
            writeFileSync(join(grooms, '2026-10-25-1450.raw.md'), 'raw');
            mkdirSync(join(root, 'bin'));
            writeFileSync(
                join(root, 'bin', 'x'),
                `#!/bin/sh\necho '{"data":{"issues":{"nodes":[]}}}'\n`,
                { mode: 0o755 },
            );
            const result = spawnSync(
                process.execPath,
                [join(import.meta.dirname, 'prompt-groom.ts'), '--linear'],
                {
                    encoding: 'utf8',
                    env: {
                        ...process.env,
                        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
                        PROMPT_GROOM_DIR: grooms,
                        // UTC+14 keeps the fixture's 2026-10-25 14:50 in the past on any CI clock
                        TZ: 'Pacific/Kiritimati',
                    },
                },
            );
            expect(result.status).toBe(1);
            expect(result.stdout).toContain('2026-10-25-1450.raw.md');
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    });
});

describe('dayBefore', () => {
    test('steps back one day across a month edge', () => {
        expect(dayBefore('2026-11-01')).toBe('2026-10-31');
    });
});

describe('rawPromptAt', () => {
    const file =
        '## 09:12\n\nfirst prompt\nsecond line\n\n## 10:40\n\nanother\n\n';

    test('cuts the block under its time head', () => {
        expect(rawPromptAt(file, '09:12')).toBe('first prompt\nsecond line');
    });

    test('every prompt of one minute comes back, the second wish included', () => {
        const twice =
            '## 14:01\n\nproceed\n\n## 14:01\n\nalso look at tldraw\n\n';
        expect(rawPromptAt(twice, '14:01')).toBe(
            'proceed\n\n---\n\nalso look at tldraw',
        );
    });

    test('a time with no head returns undefined', () => {
        expect(rawPromptAt(file, '11:00')).toBeUndefined();
    });
});

describe('newUnstamped', () => {
    const head = 'W1 an old unstamped line\n';

    test('a W-line added since HEAD with no stamp is named', () => {
        expect(newUnstamped(`${head}W2 a fresh fold\n`, head)).toEqual([
            'W2 a fresh fold',
        ]);
    });

    test('a stamped new line and an old unstamped one pass', () => {
        expect(
            newUnstamped(`${head}W2 (2026-10-26 09:12, dima): stamped\n`, head),
        ).toEqual([]);
    });
});
