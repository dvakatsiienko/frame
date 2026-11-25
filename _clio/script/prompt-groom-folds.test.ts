import { describe, expect, test } from 'vitest';

import { newUnstamped } from './prompt-groom.ts';

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

describe('full wish ids in the groom checks', () => {
    const head = 'W1 an old unstamped line\n';

    test.each([
        ['stamp-first', 'PK-3:W2 (2026-11-06 10:00, dima): words'],
        ['bulleted', '* FRM-9:W2 (2026-11-06 10:00, dima): words'],
        ['inbox', 'PK-3:W2 (2026-11-06 inbox, dima): words'],
        ['drift', 'PK-3:W2 · words (2026-11-06 10:00, dima)'],
    ])('a %s full-id stamped line passes', (_name, line) => {
        expect(newUnstamped(`${head}${line}\n`, head)).toEqual([]);
    });

    test('an old unstamped line that only gained a prefix is not new', () => {
        expect(
            newUnstamped('PK-3:W1 an old unstamped line\n', head, 'PK-3'),
        ).toEqual([]);
    });

    test('an old unstamped line that swapped to another home is new', () => {
        expect(
            newUnstamped('PK-4:W1 an old unstamped line\n', head, 'PK-3'),
        ).toEqual(['PK-4:W1 an old unstamped line']);
    });

    test('a new bare line reds, an old one and a full one pass', async () => {
        const { newBare } = await import('./prompt-groom.ts');
        const old = 'W1 (2026-11-05 10:00, dima): old\n';
        expect(
            newBare(`${old}W2 (2026-11-06 10:00, dima): new\n`, old, 'PK-3'),
        ).toEqual(['W2 (2026-11-06 10:00, dima): new']);
        expect(
            newBare(
                `${old}PK-3:W2 (2026-11-06 10:00, dima): new\n`,
                old,
                'PK-3',
            ),
        ).toEqual([]);
        expect(
            newBare('PK-3:W1 (2026-11-05 10:00, dima): old\n', old, 'PK-3'),
        ).toEqual([]);
    });

    test('a blank line above an old bare line never makes it new', async () => {
        const { newBare } = await import('./prompt-groom.ts');
        const old = 'a note\nW1 (2026-11-05 10:00, dima): old\n';
        expect(
            newBare(
                'a note\n\nW1 (2026-11-05 10:00, dima): old\n',
                old,
                'PK-3',
            ),
        ).toEqual([]);
    });

    test('a brand new unstamped full line is new', () => {
        expect(newUnstamped(`${head}PK-3:W2 a fresh fold\n`, head)).toEqual([
            'PK-3:W2 a fresh fold',
        ]);
    });
});
