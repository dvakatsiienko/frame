import { describe, expect, test } from 'vitest';

import { QUOTE_CUT, noteLine, quoteOf, repliesBelow } from './note-text.js';

const ID = '1a2b3c4d-0000-4000-8000-000000000000';
const at = new Date(2026, 10, 25, 18, 24).toISOString();
const reply = { at, id: ID, kind: 'reply' as const };
const line = (over: Partial<Parameters<typeof noteLine>[0]> = {}) =>
    noteLine({
        back: 3,
        parts: ['the retry is cheap'],
        row: reply,
        text: 'why here?',
        ...over,
    });

// FRM-585 A1
describe('the line a thread gets', () => {
    test('a reply: its quote, its id, its time, how many replies back, the note', () => {
        expect(line()).toBe(
            'dima on "the retry is cheap" (reply 1a2b3c4d 18:24, 3 back): why here?',
        );
    });

    test('his own message says so, a joined one by its record alone', () => {
        expect(
            line({ back: 0, row: { ...reply, id: `${ID}#2`, kind: 'mine' } }),
        ).toBe(
            'dima on "the retry is cheap" (message 1a2b3c4d 18:24): why here?',
        );
    });

    test('a message with no time names none', () => {
        expect(line({ row: { ...reply, at: null } })).toContain(
            '(reply 1a2b3c4d, 3 back)',
        );
    });

    test('a 300-character passage over two blocks: at most 80 characters, ending at a word, and no word outside it', () => {
        const parts = ['alpha beta '.repeat(5), 'gamma delta '.repeat(20)];
        const [, quote = ''] = /^dima on "(.*)" \(/.exec(line({ parts })) ?? [];
        expect(quote.endsWith('…')).toBe(true);
        expect(quote.length).toBeLessThanOrEqual(QUOTE_CUT + 1);
        expect(quote).toContain('beta … gamma');
        expect(new Set(quote.match(/\w+/g))).toEqual(
            new Set(['alpha', 'beta', 'gamma', 'delta']),
        );
    });

    test('the note is never cut, its lines kept, its edges trimmed', () => {
        const text = `${'long '.repeat(100)}\nsecond`;
        expect(line({ text: `\n${text}  ` })).toContain(`): ${text}`);
    });
});

describe('the quote', () => {
    test.each([
        ['80 characters whole', `${'a'.repeat(39)} ${'b'.repeat(40)}`, null],
        [
            '81 cut at the word',
            `${'a'.repeat(39)} ${'b'.repeat(41)}`,
            `${'a'.repeat(39)}…`,
        ],
        ['one long word', 'x'.repeat(200), `${'x'.repeat(80)}…`],
        [
            'one long word, an emoji at the cut',
            `${'x'.repeat(79)}🐑${'x'.repeat(40)}`,
            `${'x'.repeat(79)}…`,
        ],
        ['its breaks and runs of spaces', ' a\n\n  b\tc ', 'a b c'],
        ['his own quote marks', 'say "yes" «no»', null],
    ])('%s', (_what, words, quote) => {
        expect(quoteOf([words])).toBe(quote ?? words);
    });

    test('a cut between two parts leaves no mark of the second', () => {
        const first = 'a'.repeat(78);
        expect(quoteOf([first, 'b'.repeat(30)])).toBe(`${first}…`);
    });
});

test('back counts the replies below alone', () => {
    const rows = [
        { id: 'a', kind: 'reply' as const },
        { id: 't', kind: 'tool' as const },
        { id: 'b', kind: 'reply' as const },
        { id: 'm', kind: 'mine' as const },
        { id: 'c', kind: 'reply' as const },
    ];
    expect(['a', 'm', 'c', 'gone'].map((id) => repliesBelow(rows, id))).toEqual(
        [2, 1, 0, 0],
    );
});
