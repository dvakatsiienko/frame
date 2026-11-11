import { describe, expect, test } from 'vitest';

import { codeSpans } from './chips.js';

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
