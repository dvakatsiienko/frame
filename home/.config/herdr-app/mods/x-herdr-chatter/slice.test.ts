import { describe, expect, test } from 'vitest';

import { wholeLines } from './slice.js';

describe('a slice keeps its whole lines and counts their bytes', () => {
    test('a line cut by the slice waits for the next read', () => {
        expect(wholeLines('{"a":1}\n{"b":', 100)).toEqual({
            end: 108,
            text: '{"a":1}\n',
        });
    });

    test('bytes, not characters: an emoji line moves the end by its bytes', () => {
        expect(wholeLines('{"t":"🦉"}\n', 0).end).toBe(13);
    });

    test('no whole line yet reads nothing and stays put', () => {
        expect(wholeLines('{"half', 40)).toEqual({ end: 40, text: '' });
    });
});
