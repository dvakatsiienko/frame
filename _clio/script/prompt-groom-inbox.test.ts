import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { groomedIn, newUnstamped, ungroomedStamps } from './prompt-groom.ts';
import { day } from './prompt-groom-world.ts';

describe('ungroomedStamps', () => {
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

    test('an inbox W-line a «retires» note names needs no text in the prep', () => {
        const dir = mkdtempSync(join(tmpdir(), 'retired-'));
        writeFileSync(
            join(dir, '2026-10-26-inbox.groomed.md'),
            'kept words from the vault\n',
        );
        const item = [
            'PK-1:W1 (2026-10-26 inbox, dima): kept words from the vault',
            'PK-1:W2 (2026-10-26 inbox, dima): a first fold, later redone',
            'retires PK-1:W2, refolded into PK-1:W3',
        ].join('\n');
        expect(groomedIn(dir, '2026-10-26', 'inbox', item)).toBe(true);
        expect(
            groomedIn(
                dir,
                '2026-10-26',
                'inbox',
                item.replace(/\nretires.*/, ''),
            ),
        ).toBe(false);
    });

    test('an inbox fold traces to the prep by its words, never by invented ones', () => {
        const dir = mkdtempSync(join(tmpdir(), 'traced-'));
        writeFileSync(
            join(dir, '2026-10-26-inbox.groomed.md'),
            '- goal 0: stabilize ourselves in herder. i am happy with ui and ux.\n- you are happy with performance.\n',
        );
        const fold =
            'PK-1:W1 (2026-10-26 inbox, dima) goal 0: stabilize us in herder, i am happy with ui and ux, you with performance (restored: crow 14:27) (was PK-9:W3)';
        expect(groomedIn(dir, '2026-10-26', 'inbox', fold)).toBe(true);
        expect(
            groomedIn(
                dir,
                '2026-10-26',
                'inbox',
                'PK-1:W1 (2026-10-26 inbox, dima): rewrite the billing exporter in rust tonight',
            ),
        ).toBe(false);
    });
});

describe('--check on an inbox stamp', () => {
    const body = [
        'W9 (2026-10-26 inbox, dima): finish the round',
        'raw drop (2026-10-26 inbox, dima): 1. finish the round, if not finished',
    ].join('\n');

    function check(prep: string | undefined, text = body) {
        const root = mkdtempSync(join(tmpdir(), 'prompt-groom-'));
        try {
            if (prep !== undefined)
                writeFileSync(join(root, '2026-10-26-inbox.groomed.md'), prep);
            writeFileSync(join(root, 'body.md'), text);
            return spawnSync(
                process.execPath,
                [
                    join(import.meta.dirname, 'prompt-groom.ts'),
                    '--check',
                    join(root, 'body.md'),
                ],
                {
                    encoding: 'utf8',
                    env: {
                        ...process.env,
                        CLIO_THREAD: '',
                        PROMPT_GROOM_DIR: root,
                    },
                    timeout: 10_000,
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

    const ticket =
        '* FRM-1:W1 (2026-10-26 inbox, dima, PK-9:W4): finish the round\n';

    test('a ticket with no raw drop passes when the prep holds its moved W-line', () => {
        expect(
            check(
                'PK-9:W4 (2026-10-26 inbox, dima): finish the round\n',
                ticket,
            ).status,
        ).toBe(0);
    });

    test('a moved W-line the fold marked ❓ passes against its unmarked prep line', () => {
        expect(
            check(
                'PK-9:W4 (2026-10-26 inbox, dima): finish the round\n',
                `${ticket.trimEnd()} ❓\n`,
            ).status,
        ).toBe(0);
    });

    test('a moved W-line linear stored with a markdown escape passes against its prep line', () => {
        expect(
            check(
                'PK-9:W4 (2026-10-26 inbox, dima): joins after ~10s\n',
                '* FRM-1:W1 (2026-10-26 inbox, dima, PK-9:W4): joins after \\~10s\n',
            ).status,
        ).toBe(0);
    });

    test('a ticket with no raw drop reds when the prep lacks its W-line', () => {
        expect(
            check('PK-9:W4 (2026-10-26 inbox, dima): some other ask\n', ticket)
                .status,
        ).toBe(1);
    });
});

describe('prompt-groom inbox', () => {
    test('the verb refuses an inbox with the copy step', () => {
        const out = spawnSync(
            process.execPath,
            [join(import.meta.dirname, 'prompt-groom.ts'), 'inbox'],
            { encoding: 'utf8', timeout: 10_000 },
        );
        expect(out.status).toBe(1);
        expect(out.stderr).toContain('inbox-helga.md');
    });
});
