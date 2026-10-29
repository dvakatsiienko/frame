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

    test('composer’s W<n> · text (stamp) shape reads like the stamp-first one', () => {
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
        expect(out.stdout).toContain('inbox-composer.md');
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

describe('prompt-groom inbox', () => {
    test('the verb refuses an inbox with the copy step', () => {
        const out = spawnSync(
            process.execPath,
            [join(import.meta.dirname, 'prompt-groom.ts'), 'inbox'],
            { encoding: 'utf8' },
        );
        expect(out.status).toBe(1);
        expect(out.stderr).toContain('inbox-composer.md');
    });
});

describe('prompt-groom oN (FRM-451)', () => {
    const steer = (id: string, text: string) =>
        JSON.stringify({
            attachment: { content: [`- ${id} · his steer: «${text}»`] },
            timestamp: '2026-10-26T09:15:00Z',
            type: 'attachment',
        });

    function groom(id: string) {
        const root = mkdtempSync(join(tmpdir(), 'prompt-groom-'));
        try {
            const grooms = join(root, 'grooms');
            mkdirSync(join(root, 'bin'));
            // composer is stubbed up, so nothing is spawned
            writeFileSync(
                join(root, 'bin', 'claude'),
                `#!/bin/sh\necho '[{"name":"composer","status":"idle"}]'\n`,
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
