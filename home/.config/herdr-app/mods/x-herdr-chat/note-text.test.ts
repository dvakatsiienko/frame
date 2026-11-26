import { describe, expect, test } from 'vitest';

import {
    HEAD_BACK,
    LINE_QUOTE_CUT,
    QUOTE_CUT,
    SENTENCE_CUT,
    headOf,
    noteLine,
    quoteOf,
    repliesBelow,
    sentenceOf,
} from './note-text.js';

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

    test('a 400-character passage over two blocks: at most 160 characters, ending at a word, and no word outside it', () => {
        const parts = ['alpha beta '.repeat(5), 'gamma delta '.repeat(30)];
        const [, quote = ''] = /^dima on "(.*)" \(/.exec(line({ parts })) ?? [];
        expect(quote.endsWith('…')).toBe(true);
        expect(quote.length).toBeGreaterThan(QUOTE_CUT);
        expect(quote.length).toBeLessThanOrEqual(LINE_QUOTE_CUT + 1);
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

// FRM-585:W72, dima 26 Nov: the line carries the sentence around the words, and a far message's first words
describe('what stands around the words', () => {
    const at = (source: string, words: string) => {
        const start = source.indexOf(words);
        return { range: { end: start + words.length, start }, source, words };
    };

    test.each([
        [
            'its sentence, from the stop before to the stop after',
            at('One thing. The retry is cheap here. Next one.', 'retry'),
            'The ⟦retry⟧ is cheap here.',
        ],
        [
            'a line break ends it, its list marker gone (clio, 16:26)',
            at('- the retry is cheap\n- the next item', 'retry'),
            'the ⟦retry⟧ is cheap',
        ],
        [
            'none when the words are the whole sentence',
            at('One. Two.', 'Two.'),
            null,
        ],
        // the 🔎's round 1 on 574c7f3c: what he reads, never the markdown
        [
            'a link reads as its words, code and bold without their marks',
            {
                ...at(
                    'We read [`/a/b.ts`](path:0) before the **big** merge.',
                    'before',
                ),
            },
            'We read /a/b.ts ⟦before⟧ the big merge.',
        ],
        [
            'none for a whole bold sentence he selected',
            {
                range: { end: 10, start: 0 },
                source: '**Do it.**',
                words: 'Do it.',
            },
            null,
        ],
        [
            'a stop before bold ends one',
            at('Intro. **Do it now.** Then rest.', 'it now'),
            'Do ⟦it now⟧.',
        ],
        [
            'an abbreviation ends no sentence',
            at('Use a tool, e.g. the retry, here.', 'retry'),
            'Use a tool, e.g. the ⟦retry⟧, here.',
        ],
        [
            'a selection whose edge is a space keeps it (clio, 16:26: «Aburst»)',
            {
                range: { end: 13, start: 1 },
                source: 'A burst of quick presses.',
                words: 'burst of qu',
            },
            'A ⟦burst of qu⟧ick presses.',
        ],
        [
            'none with no range',
            { range: null, source: 'a b', words: 'a' },
            null,
        ],
        [
            'a long one cut around the words, each cut side at a word',
            at(
                `${'left '.repeat(60)}the retry ${'right '.repeat(60)}.`,
                'the retry',
            ),
            expect.stringMatching(/^…left .*⟦the retry⟧ right .*right…$/),
        ],
    ])('%s', (_what, part, sentence) => {
        expect(sentenceOf(part)).toEqual(sentence);
    });

    test('words as long as the cut: none, the quote is cut already', () => {
        const words = 'word '.repeat(40).trim();
        expect(sentenceOf(at(`Before ${words} after.`, words))).toBeNull();
    });

    test('a long sentence stays near the cut', () => {
        const part = at(`${'word '.repeat(200)}x.`, 'word word');
        expect((sentenceOf(part) ?? '').length).toBeLessThanOrEqual(
            SENTENCE_CUT + 2,
        );
    });

    test('the line says the sentence, his words marked in it once; a fresh note stays one short line', () => {
        expect(line({ sentence: 'So ⟦the retry is cheap⟧.' })).toBe(
            'dima on "So ⟦the retry is cheap⟧." (reply 1a2b3c4d 18:24, 3 back): why here?',
        );
        expect(
            line({ row: { ...reply, head: 'One two three' } }),
        ).not.toContain('One two');
    });

    test(`a message ${HEAD_BACK} or more back is named by its first words too`, () => {
        expect(
            line({
                back: HEAD_BACK,
                row: { ...reply, head: 'One two three…' },
            }),
        ).toContain(`, ${HEAD_BACK} back, «One two three…»): `);
        expect(headOf('a  b\nc d e f g h i j')).toBe('a b c d e f g h…');
        expect(
            headOf('**Verdict:** the `x lane` door [works](https://a.b)'),
        ).toBe('Verdict: the x lane door works');
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
