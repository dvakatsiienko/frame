import { describe, expect, test } from 'vitest';

import { typedMarkdown } from './typed.js';

describe('his message is shown as he typed it', () => {
    test('markdown punctuation is escaped, so nothing turns bold or into a list', () => {
        expect(typedMarkdown('*not bold* - item #1')).toBe(
            '\\*not bold\\* \\- item \\#1',
        );
    });

    test('a single line break is kept as a break', () => {
        expect(typedMarkdown('one\ntwo')).toBe('one\\\ntwo');
    });

    test('an empty line stays a paragraph gap, whatever spaces it holds', () => {
        expect(typedMarkdown('one\n  \ntwo\r\n\r\nthree')).toBe(
            'one\n\ntwo\n\nthree',
        );
    });
});
