import { describe, expect, test } from 'vitest';

import { newUnstamped, rawPromptAt, ungroomedStamps } from './prompt-groom.ts';

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
