import { describe, expect, test } from 'vitest';

import { rawPromptAt, ungroomedStamps } from './prompt-groom.ts';

const day = '2026-10-26';

describe('ungroomedStamps', () => {
    const text = [
        'W301 (2026-10-26 09:12, dima): fold this',
        '* W302 (2026-10-26 09:12, dima, on Q2): and this',
        'W303 (2026-10-26 10:40, dima): a second prompt',
        'W304 (2026-10-25 22:00, dima): yesterday',
        'W305 an unstamped line',
    ].join('\n');

    test('names each prompt time born that day with no groom, once', () => {
        expect(ungroomedStamps(text, day, () => false)).toEqual([
            '09:12',
            '10:40',
        ]);
    });

    test('a groomed prompt time stays quiet', () => {
        expect(
            ungroomedStamps(text, day, (_, hhmm) => hhmm === '09:12'),
        ).toEqual(['10:40']);
    });

    test('a stamp before the rule start is never checked', () => {
        expect(
            ungroomedStamps(
                'W1 (2026-10-25 14:00, dima): old',
                '2026-10-25',
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

    test('a time with no head returns undefined', () => {
        expect(rawPromptAt(file, '11:00')).toBeUndefined();
    });
});
