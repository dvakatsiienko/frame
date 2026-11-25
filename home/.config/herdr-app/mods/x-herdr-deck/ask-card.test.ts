import { describe, expect, test } from 'vitest';

import {
    CARD_PAD,
    PILL,
    askMarkdown,
    askPick,
    askTitle,
    titleFits,
    titleInset,
    titleMarkdown,
} from './ask-card.js';
import { askRounds, asksOf, pressOf } from './orbit.js';

// the stash's own row, 2026-11-25 15:41, its body cut
const parted = {
    area: 'herdr',
    areaEmoji: '🐑',
    body: 'a click **opens it**',
    from: { lane: 'herdr', line: '🔧 herdr | FRM-620', who: 'codie' },
    id: 'o1',
    isGated: true,
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
            asksOf({ asks: [{ ...parted, body: 7, title: {} }] })[0],
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
        ['a bullet list', '- one\n- **two**', '- one\n- **two**'],
        ['a numbered list, from its own number', '3. a\n4. b', '3. a\n4. b'],
        ['a line per line', 'one\ntwo', 'one\\\ntwo'],
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

// exit 3: his own pane's card widths, a 45-char title, a three-digit id, with its thread's name and 🆕 or without
describe.each([240, 320, 420, 504, 640])('in a card %i wide', (card) => {
    test.each([40, 62, 96])('the title ends before a pill of %i', (pill) => {
        const inner = card - 2 * CARD_PAD;
        const titleEnd = CARD_PAD + inner - titleInset(pill);
        const pillStart = card - PILL.right - pill;
        expect(pillStart - titleEnd).toBeGreaterThanOrEqual(PILL.gap);
    });
});

test('a title surely on one line is whole, one that may pass the edge is cut', () => {
    const title = `🐑 ${'m'.repeat(43)}`;
    expect(titleFits(title, 600, 15)).toBe(true);
    expect(titleFits(title, 380, 15)).toBe(false);
    expect(titleFits('🐑 a', 0, 15)).toBe(false);
});
