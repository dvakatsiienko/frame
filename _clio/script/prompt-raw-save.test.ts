import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { dimasText, groomNudge, sideChannelNudge } from './prompt-raw-save.ts';

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

describe('sideChannelNudge', () => {
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
    ])(
        'a personal chore while a lane runs is offered the side channel: «%s»',
        (text) => {
            const line = sideChannelNudge(text, fixture(process.ppid));
            expect(line).toContain('side channel?');
            expect(line?.split('\n')).toHaveLength(1);
        },
    );

    test.each([
        'codie: the Sonnet grade card is in ← Tell mods lane coder to do a full tech review',
        'You may rearrange the execution order because fixes may be important',
        'they are gated behind a subscription. Let’s have Excalidraw as a main blueprinting tool',
    ])('a fleet prompt from the log prints none: «%s»', (text) => {
        expect(sideChannelNudge(text, fixture(process.ppid))).toBeUndefined();
    });

    test('a half-written registry file never crashes it', () => {
        const home = fixture(process.ppid);
        writeFileSync(join(home, '.claude/sessions/12.json'), '{"na');
        expect(sideChannelNudge('what should i buy now', home)).toContain(
            'side channel?',
        );
    });

    test('with no live lane, a personal chore prints none', () => {
        expect(
            sideChannelNudge('what should i buy now', fixture(999_999)),
        ).toBeUndefined();
        expect(
            sideChannelNudge('what should i buy now', fixture(undefined)),
        ).toBeUndefined();
    });
});
