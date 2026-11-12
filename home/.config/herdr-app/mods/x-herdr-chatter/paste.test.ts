import { describe, expect, test } from 'vitest';

import { plainPaste, withPlainPaste } from './paste.js';

describe('a paste from the chat reads plain in the box (his 17:54 and 18:09 shots)', () => {
    test('bold, italic and strike read as their words', () => {
        expect(plainPaste('4. **lanes-status** and _this_ and ~~that~~')).toBe(
            '4. lanes-status and this and that',
        );
    });

    test('a bullet marker is no emphasis', () => {
        expect(plainPaste('* one\n* two')).toBe('* one\n* two');
    });

    test('a link reads as its label', () => {
        expect(
            plainPaste(
                '1. [FRM-572](https://linear.app/x-com/issue/FRM-572) — ten fixes',
            ),
        ).toBe('1. FRM-572 — ten fixes');
    });

    test('a link whose url holds parentheses reads as its label', () => {
        expect(plainPaste('see [wiki](https://w.org/a_(b)) now')).toBe(
            'see wiki now',
        );
    });

    test('inline code reads as its words', () => {
        expect(plainPaste('the `x stats` board and `x`')).toBe(
            'the x stats board and x',
        );
    });

    test('list markers stay', () => {
        const lists = '- one\n* two\n1. three\n2) four\n- [ ] five';
        expect(plainPaste(lists)).toBe(lists);
    });

    test('a fence stays whole, its backticks and links inside included', () => {
        const fence = '```\nrun `x` at [a](b)\n```';
        expect(plainPaste(`before \`c\`\n${fence}`)).toBe(`before c\n${fence}`);
    });

    test('text he typed before the paste keeps its backticks', () => {
        expect(withPlainPaste('my `x` ', 'my `x` see `y` and')).toBe(
            'my `x` see y and',
        );
    });

    test('a paste in the middle leaves both sides as typed', () => {
        expect(withPlainPaste('a `b` | c', 'a `b` [l](u) | c')).toBe(
            'a `b` l | c',
        );
    });
});
