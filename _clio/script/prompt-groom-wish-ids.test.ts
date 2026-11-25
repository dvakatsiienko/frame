import { describe, expect, test } from 'vitest';

describe('full wish ids in the groom checks', () => {
    test("a move refuses another home's id and a home numbering twice, and skips a quoted line", async () => {
        const { moveWishes } = await import('./prompt-groom.ts');
        const ticket = '* FRM-9:W6 (x): six\n';
        expect(() =>
            moveWishes('PK-3:W1 (x): a\n', ticket, 'PK-3', 'FRM-9', [
                'PK-4:W1',
            ]),
        ).toThrow(/PK-4:W1/);
        expect(() =>
            moveWishes('W1 (x): a\nPK-3:W1 (y): b\n', ticket, 'PK-3', 'FRM-9', [
                'W1',
            ]),
        ).toThrow(/twice/);
        expect(
            moveWishes(
                'PK-3:W1 (y): mine\nPK-4:W1 (x): quote\n',
                ticket,
                'PK-3',
                'FRM-9',
                ['W1'],
            ).lines,
        ).toEqual(['* FRM-9:W7 (y): mine']);
    });
});

describe('the next wish id of a home (PK-312)', () => {
    test('a home with W-lines numbers on from its own highest', async () => {
        const { nextWishId } = await import('./prompt-groom.ts');
        expect(
            nextWishId('W1 a\n* W12 b\nprose W40 cited, not a line', 'pk-3'),
        ).toBe('PK-3:W13');
    });

    test('a groom not yet appended to its home counts', async () => {
        const { nextWishId } = await import('./prompt-groom.ts');
        expect(
            nextWishId('PK-3:W12 a\n', 'PK-3', [
                'PK-3:W18 (2026-11-11 19:21, dima): b\nPK-4:W40 (x): c\n',
            ]),
        ).toBe('PK-3:W19');
    });

    test('a home with no W-lines starts at one', async () => {
        const { nextWishId } = await import('./prompt-groom.ts');
        expect(nextWishId('## notes\nnothing yet', 'PK-3')).toBe('PK-3:W1');
    });

    test.each([
        ['full', 'PK-3:W4 a\n* PK-3:W12 b\n'],
        ['mixed', 'W4 a\n* PK-3:W12 b\n'],
        ['autolinked', '* [FRM-9](https://linear.app/x/FRM-9):W12 b\n'],
    ])('a %s home numbers on from its highest', async (_name, text) => {
        const { nextWishId } = await import('./prompt-groom.ts');
        expect(nextWishId(text, 'PK-3')).toBe('PK-3:W13');
    });
});

describe('a pocket wish moving to a ticket is renumbered into its series (PK-312, o98)', () => {
    const pocket =
        'W1912 (2026-11-03 19:16, dima): and sharpen shift even more.\nW1975 (2026-11-03 20:26, dima) [re: Q8]: no spam, by nature. ❓\n';
    const ticket =
        '## wish\n\n* W1 (2026-11-03 16:39, dima): good idea.\n* W6 (2026-11-03 16:35, dima): six.\n';

    test('the moved lines take the ticket next ids, text and stamp kept whole', async () => {
        const { moveWishes } = await import('./prompt-groom.ts');
        const { lines } = moveWishes(pocket, ticket, 'PK-3', 'FRM-9', [
            'W1975',
            'W1912',
        ]);
        expect(lines).toEqual([
            '* FRM-9:W7 (2026-11-03 20:26, dima) [re: Q8]: no spam, by nature. ❓',
            '* FRM-9:W8 (2026-11-03 19:16, dima): and sharpen shift even more.',
        ]);
    });

    test('the pocket keeps a moved line naming each old and new id', async () => {
        const { moveWishes } = await import('./prompt-groom.ts');
        const { note } = moveWishes(pocket, ticket, 'PK-3', 'FRM-9', [
            'W1975',
            'W1912',
        ]);
        expect(note).toBe(
            'moved: PK-3:W1975 → FRM-9:W7, PK-3:W1912 → FRM-9:W8',
        );
    });

    test.each([
        ['a bare id', 'W1'],
        ['a full id', 'PK-3:W1'],
    ])('a full-id pocket line moves when asked by %s', async (_name, id) => {
        const { moveWishes } = await import('./prompt-groom.ts');
        const { lines } = moveWishes(
            'PK-3:W1 (2026-11-06 10:00, dima): words\n',
            'FRM-9:W6 (2026-11-03 16:35, dima): six.\n',
            'PK-3',
            'FRM-9',
            [id],
        );
        expect(lines).toEqual(['* FRM-9:W7 (2026-11-06 10:00, dima): words']);
    });

    test('an id the pocket item does not hold is refused, nothing moved', async () => {
        const { moveWishes } = await import('./prompt-groom.ts');
        expect(() =>
            moveWishes(pocket, ticket, 'PK-3', 'FRM-9', ['W1912', 'W5']),
        ).toThrow(/W5/);
    });
});
