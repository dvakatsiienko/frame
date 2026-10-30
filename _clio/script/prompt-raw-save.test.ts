import { describe, expect, test } from 'vitest';

import { dimasText, groomNudge } from './prompt-raw-save.ts';

const notice =
    '<system-reminder>\nThe user\'s fork "🦉 clio (fork)" finished a turn.\n</system-reminder>\n';

describe('groomNudge', () => {
    const day = '2026-10-30';
    const dayText =
        '## 18:00\n\nship the thing\n\n## 18:55\n\nand a newer one\n\n';
    test('a prompt past 10 minutes with no groom is named', () => {
        expect(groomNudge(dayText, day, '19:00', '')).toContain(
            '1 prompt(s) ungroomed past 10 min: 18:00',
        );
    });
    test('a no-wish line clears it', () => {
        expect(
            groomNudge(dayText, day, '19:00', '18:00 — a go, no wish\n'),
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
