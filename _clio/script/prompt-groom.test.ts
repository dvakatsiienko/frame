import { describe, expect, test } from 'vitest';

import { rawPromptAt, ungroomedPrompts } from './prompt-groom.ts';

describe('a no-wish line on a minute with two prompts', () => {
    const day = '## 10:00\n\nfirst wish\n\n## 10:00\n\nsecond wish\n';
    const reds = (noWish: string) =>
        ungroomedPrompts(day, '2026-11-06', '11:00', noWish, () => false)
            .length;

    test('a plain line hides nothing', () => {
        expect(reds('10:00 — about the first\n')).toBe(1);
    });

    test('a line naming both clears the minute', () => {
        expect(reds('10:00 ×2 — both answered\n')).toBe(0);
    });

    test('a red prompt names the ×N key its no-wish line needs', () => {
        expect(
            ungroomedPrompts(day, '2026-11-06', '11:00', '', () => false)[0]
                ?.key,
        ).toBe('10:00 ×2');
    });

    test('a side note beside one prompt counts as one', () => {
        const noted =
            '## 10:00\n\na wish\n\n## 10:00\n\n<side-sessions-event>x</side-sessions-event>\n';
        expect(
            ungroomedPrompts(
                noted,
                '2026-11-06',
                '11:00',
                '10:00 — it\n',
                () => false,
            ),
        ).toEqual([]);
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
