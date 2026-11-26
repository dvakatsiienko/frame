import { describe, expect, test } from 'vitest';

import { askMarkdown, askPick, askTitle, titleMarkdown } from './ask-card.js';
import { askRounds, asksOf, pressOf } from './orbit.js';

// the stash's own row, 2026-11-25 15:41, its body cut
const parted = {
    area: 'herdr',
    areaEmoji: '🐑',
    body: 'a click **opens it**',
    from: { lane: 'herdr', line: '🔧 herdr | FRM-620', who: 'codie' },
    id: 'o1',
    kind: 'look',
    pick: 'both work',
    text: 'look: path links\n\na click **opens it**',
    title: 'path links',
    why: 'reviewed clean',
};

describe('an ask sent in three parts (FRM-620 slice 7)', () => {
    test('reaches the deck with its title and body beside its text', () => {
        expect(asksOf({ asks: [parted] })[0]).toMatchObject({
            body: 'a click **opens it**',
            text: 'look: path links\n\na click **opens it**',
            title: 'path links',
        });
    });

    test('its kind still pins it', () => {
        const asks = asksOf({ asks: [{ id: 'o0', text: 'push' }, parted] });
        expect(asks.map((a) => a.id)).toEqual(['o1', 'o0']);
    });

    test('a new body under its id is a new round', () => {
        const rows = (body: string) => [
            {
                asks: asksOf({
                    asks: [
                        {
                            ...parted,
                            body,
                            text: `look: path links\n\n${body}`,
                        },
                    ],
                }),
                sid: 's1',
            },
        ];
        const { seen } = askRounds({}, rows('one'));
        expect(askRounds(seen, rows('two')).updated).toEqual(['s1:o1']);
    });

    test('its press sends the text whole', () => {
        const sent = asksOf({ asks: [parted] }).map((a) =>
            pressOf({ ...a, id: 'o1' }, 'tick', 1),
        );
        expect(sent[0]?.text).toBe(parted.text);
    });

    test('a title or body that is no string is none', () => {
        expect(
            asksOf({ asks: [{ ...parted, body: 7, title: ' ' }] })[0],
        ).toMatchObject({
            body: null,
            title: null,
        });
    });
});

// FRM-620 slice 7 (W65–W68): checked once against a real GFM parser on 60,000 random texts, 2026-11-25
describe('a body as small markdown', () => {
    test.each([
        [
            'bold and backticks stay',
            '**🔧 codie** runs `x *lane*`',
            '**🔧 codie** runs `x *lane*`',
        ],
        [
            'bold in «quotes», beside a dash',
            '«**🐬 wishkeeper**» **a!**—b',
            '«**🐬 wishkeeper**» **a\\!**—b',
        ],
        ['a bullet list', '- one\n- **two**', '- one\n- **two**'],
        ['a numbered list, from its own number', '3. a\n4. b', '3. a\n4. b'],
        ['a line per line', 'one\ntwo', 'one\\\ntwo'],
        [
            'a list that jumps keeps its numbers',
            '1. a\n3. b\n4. c',
            '1. a\n\n3) b\n4) c',
        ],
        [
            'one that starts again too',
            '2. a\n\n1. b\n\n2. c',
            '2. a\n\n1) b\n\n2) c',
        ],
        [
            'a number after words is its own',
            '1. a\nb\n2. c',
            '1. a\n\nb\n\n2. c',
        ],
        [
            'words, a list and words after it, three blocks',
            'a\n- b\nc',
            'a\n\n- b\n\nc',
        ],
        ['a blank line, a new block', 'a\n\n\nb', 'a\n\nb'],
        ['an indent is no code block', 'a\n\n    b', 'a\n\nb'],
    ])('%s', (_what, text, markdown) =>
        expect(askMarkdown(text)).toBe(markdown),
    );

    test.each([
        ['a heading', '# x', '\\# x'],
        ['a link', '[a](b)', '\\[a\\]\\(b\\)'],
        ['an image', '![a](b)', '\\!\\[a\\]\\(b\\)'],
        ['an unclosed bold', 'a **b', 'a \\*\\*b'],
        ['a bold with nothing in it', '****', '\\*\\*\\*\\*'],
        ['a bold no word opens', 'a** b**', 'a\\*\\* b\\*\\*'],
        [
            'a bold markdown would not open',
            'a**(b)** c',
            'a\\*\\*\\(b\\)\\*\\* c',
        ],
        [
            'a bold markdown would not close',
            'a **(b)**c',
            'a \\*\\*\\(b\\)\\*\\*c',
        ],
        ['a number no list draws', '007. a', '007\\. a'],
        ['a lone backtick', 'a ` b', 'a \\` b'],
        ['a fence', '```\nx\n```', '\\`\\`\\`\\\nx\\\n\\`\\`\\`'],
        ['a table', '| a |\n|---|', '\\| a \\|\\\n\\|\\-\\-\\-\\|'],
        ['a quote', '> a', '\\> a'],
        ['a rule', '---', '\\-\\-\\-'],
        ['other lists', '* a\n+ b\n1) c', '\\* a\\\n\\+ b\\\n1\\) c'],
        ['a bare url', 'https://a.b', 'https\\:\\/\\/a\\.b'],
        ['html', '<b>a</b>', '\\<b\\>a\\<\\/b\\>'],
        ['a backslash at the end', 'a\\\nb', 'a\\\\\\\nb'],
    ])('%s reads as typed', (_what, text, markdown) =>
        expect(askMarkdown(text)).toBe(markdown),
    );
});

describe('a title', () => {
    test('a look and a test lead with 👀 and 🧪, once', () => {
        expect(askTitle({ text: 'look: 🐑 x', title: '🐑 x' })).toBe('👀 🐑 x');
        expect(askTitle({ text: 'test: x', title: '🧪 x' })).toBe('🧪 x');
        expect(askTitle({ text: 'look: 👀', title: '👀' })).toBe('👀');
    });

    test('any other keeps its own emoji, on one line', () => {
        expect(askTitle({ text: '🐑 a\nb', title: '🐑 a\nb' })).toBe('🐑 a b');
    });

    test('is bold, its own signs as typed', () => {
        expect(titleMarkdown('a *b* `c`')).toBe('**a \\*b\\* \\`c\\`**');
    });
});

test('the pick leads with one ➡️', () => {
    expect(askPick('both work')).toBe('➡️ both work');
    expect(askPick('➡️ both work')).toBe('➡️ both work');
});
