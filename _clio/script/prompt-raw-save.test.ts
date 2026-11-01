import { describe, expect, test } from 'vitest';

import { dimasText, groomNudge, siestaNudge } from './prompt-raw-save.ts';

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

describe('siestaNudge', () => {
    const log = (...commits: [string, ...string[]][]) =>
        commits.map((c) => `\0${c.join('\n')}\n`).join('');
    test('three files across clio’s commits make a siesta due', () => {
        expect(
            siestaNudge(
                log(['🐞 a', 'x/a.ts', 'x/b.ts'], ['🔧 c', 'x/c.ts']),
                '14:00',
            ),
        ).toContain('3 file(s)');
    });
    test('one skill file alone makes a siesta due', () => {
        expect(
            siestaNudge(
                log(['📜 a', '_clio/plugin-clio/skills/boot/SKILL.md']),
                '14:00',
            ),
        ).toContain('memory, rule or skill');
    });
    test('the pocket’s auto commits do not count', () => {
        expect(
            siestaNudge(
                log(
                    ['🐞 a', 'x/a.ts'],
                    ['📜 pocket: pk-1 (auto)', 'p/1.md', 'p/2.md'],
                ),
                '14:00',
            ),
        ).toBeUndefined();
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
