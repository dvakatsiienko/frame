import { describe, expect, test } from 'vitest';

import { applyChips, codeSpans } from './chips.js';

describe('inline code in the box becomes a chip', () => {
    test('the closing backtick makes one span', () => {
        expect(codeSpans('use `ls` here', [])).toEqual([{ end: 8, start: 4 }]);
    });

    test('an open backtick makes none yet', () => {
        expect(codeSpans('use `ls here', [])).toEqual([]);
    });

    test('a span already a chip is left alone', () => {
        expect(codeSpans('use `ls` here', [{ end: 8, start: 4 }])).toEqual([]);
    });

    test('three backticks then a word make no chip', () => {
        expect(codeSpans('```bash', [])).toEqual([]);
        expect(codeSpans('```\n`bash`', [])).toEqual([]);
    });

    test('a span after a closed fence still chips', () => {
        expect(codeSpans('```\nx\n```\nrun `ls`', [])).toEqual([
            { end: 18, start: 14 },
        ]);
    });
});

describe('a paste holding inline code keeps the caret at its end', () => {
    // a box that moves its caret to the end of each token it puts in, as herdr's Textarea does
    const fakeBox = (text: string) => {
        const box = {
            caret: text.length,
            replace_range_with_token(range: { start: number; end: number }) {
                box.tokens.push({ range });
                box.caret = range.end;
            },
            set_selected_range(range: { start: number; end: number }) {
                box.caret = range.end;
            },
            tokens: [] as { range: { start: number; end: number } }[],
        };
        return box;
    };

    test('after a paste of «type `ls` in the box», the caret sits after «box»', () => {
        const text = 'type `ls` in the box';
        const box = fakeBox(text);
        applyChips(box, text, codeSpans(text, []), text.length);
        expect(box.caret).toBe(text.length);
    });
});
