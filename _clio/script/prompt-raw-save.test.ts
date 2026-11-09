import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { dimasText, groomNudge, wingNudge } from './prompt-raw-save.ts';
import { seatOf } from './session-registry.ts';

const notice =
    '<system-reminder>\nThe user\'s fork "🦉 clio (fork)" finished a turn.\n</system-reminder>\n';

describe('groomNudge', () => {
    const day = '2026-10-30';
    const dayText =
        '## 18:00\n\nship the thing\n\n## 18:55\n\nand a newer one\n\n';
    test('a prompt past 10 minutes with no groom is named', () => {
        expect(groomNudge(dayText, day, '19:00', '')).toContain(
            '1 prompt(s) or steer(s) ungroomed: 18:00',
        );
    });
    test('a no-wish line clears it', () => {
        expect(
            groomNudge(dayText, day, '19:00', '18:00 — a go, no wish\n'),
        ).toBeUndefined();
    });
    test('an ungroomed steer is named beside the prompts', () => {
        expect(
            groomNudge(dayText, day, '19:00', '18:00 — a go\n', ['o1']),
        ).toContain('1 prompt(s) or steer(s) ungroomed: o1');
    });
});

describe('dimasText', () => {
    test('a prompt behind an app notice keeps his words, without the notice', () => {
        expect(dimasText(`${notice}${notice}proceed with slice b`)).toBe(
            'proceed with slice b',
        );
    });

    test('a notice alone is not his', () => {
        expect(dimasText(notice)).toBe(undefined);
    });

    test('a peer message is not his', () => {
        expect(
            dimasText(
                '<cross-session-message from="x">hi</cross-session-message>',
            ),
        ).toBe(undefined);
    });
});

describe('wingNudge', () => {
    const fixture = (pid: number | undefined) => {
        const home = mkdtempSync(join(tmpdir(), 'side-'));
        const dir = join(home, '.claude/sessions');
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            join(dir, `${process.pid}.json`),
            JSON.stringify({ name: '🦉 clio', sessionId: 's-clio' }),
        );
        if (pid)
            writeFileSync(
                join(dir, `${pid}.json`),
                JSON.stringify({ name: '⚡ 🔧 codie: clio-lean | FRM-494' }),
            );
        return home;
    };

    test.each([
        'my rockstar account is stuck on an old email, can you look',
        'what should i buy now, the $200 plan?',
        'turn off the auto-renew before friday',
    ])('a personal chore while a lane runs is offered a wing: «%s»', (text) => {
        const line = wingNudge(text, fixture(process.ppid));
        expect(line).toContain('a wing?');
        expect(line?.split('\n')).toHaveLength(1);
    });

    test.each([
        'codie: the Sonnet grade card is in ← Tell mods lane coder to do a full tech review',
        'You may rearrange the execution order because fixes may be important',
        'they are gated behind a subscription. Let’s have Excalidraw as a main blueprinting tool',
    ])('a fleet prompt from the log prints none: «%s»', (text) => {
        expect(wingNudge(text, fixture(process.ppid))).toBeUndefined();
    });

    test('a half-written registry file never crashes it', () => {
        const home = fixture(process.ppid);
        writeFileSync(join(home, '.claude/sessions/12.json'), '{"na');
        expect(wingNudge('what should i buy now', home)).toContain('a wing?');
    });

    test.each([
        'what is the plan for the cli lane after this',
        'the billing page of the speak app needs a pass',
    ])('a fleet prompt with plan or billing prints none: «%s»', (text) => {
        expect(wingNudge(text, fixture(process.ppid))).toBeUndefined();
    });

    test('the hook prints the side line for his prompt', () => {
        const home = fixture(process.ppid);
        const out = spawnSync(
            'node',
            [join(import.meta.dirname, 'prompt-raw-save.ts')],
            {
                encoding: 'utf8',
                env: {
                    ...process.env,
                    CLIO_SEAT: '',
                    HOME: home,
                    PROMPT_GROOM_DIR: join(home, 'grooms'),
                    PROMPT_RAW_DIR: join(home, 'prompts'),
                },
                input: JSON.stringify({ prompt: 'what should i buy now' }),
            },
        );
        expect(out.status).toBe(0);
        expect(out.stdout).toContain('a wing?');
    });

    test('with no live lane, a personal chore prints none', () => {
        expect(
            wingNudge('what should i buy now', fixture(999_999)),
        ).toBeUndefined();
        expect(
            wingNudge('what should i buy now', fixture(undefined)),
        ).toBeUndefined();
    });
});

describe('seatOf', () => {
    function seatHome(mainPid: number, sessions: Record<number, string>) {
        const home = mkdtempSync(join(tmpdir(), 'seat-'));
        mkdirSync(join(home, '.local/state/clio'), { recursive: true });
        mkdirSync(join(home, '.claude/sessions'), { recursive: true });
        writeFileSync(
            join(home, '.local/state/clio/main-session'),
            `pid=${mainPid}\nsession=abc\n`,
        );
        for (const [pid, name] of Object.entries(sessions))
            writeFileSync(
                join(home, '.claude/sessions', `${pid}.json`),
                JSON.stringify({ name, pid: Number(pid) }),
            );
        return home;
    }

    test('the main seat writes at the root', () => {
        expect(seatOf(seatHome(10, { 10: '🦉 clio' }), 10)).toBe('');
    });

    test('a wing writes in its own folder', () => {
        expect(seatOf(seatHome(10, { 11: '🦉🪽 clio: wing 3' }), 11)).toBe(
            'wing-3',
        );
    });

    test.each([
        ['a plain fork', '🦉 clio (fork)'],
        ['a lane member', '🌗 🔧 codie: cli lane | FRM-383'],
    ])('%s keeps no log', (_kind, name) => {
        expect(seatOf(seatHome(10, { 12: name }), 12)).toBeUndefined();
    });
});

describe('the hook in a wing', () => {
    test('a wing prompt lands in the wing folder, never in main log', () => {
        const home = mkdtempSync(join(tmpdir(), 'seat-hook-'));
        const out = spawnSync(
            'node',
            [join(import.meta.dirname, 'prompt-raw-save.ts')],
            {
                encoding: 'utf8',
                env: {
                    ...process.env,
                    CLIO_SEAT: 'wing-3',
                    HOME: home,
                    PROMPT_GROOM_DIR: join(home, 'grooms'),
                    PROMPT_RAW_DIR: join(home, 'prompts'),
                },
                input: JSON.stringify({ prompt: 'lets do #9' }),
            },
        );
        expect(out.status).toBe(0);
        const day = new Date().toLocaleDateString('sv');
        expect(
            readFileSync(join(home, 'prompts/wing-3', `${day}.md`), 'utf8'),
        ).toContain('lets do #9');
        expect(existsSync(join(home, 'prompts', `${day}.md`))).toBe(false);
    });
});
