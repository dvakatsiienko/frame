import { describe, expect, test } from 'vitest';

import { KEY_PAIR_MS, KEY_REPEAT_MS, createKeyPress } from './keypress.js';

// herdr's order, read off his Enter (FRM-628 step 87, 12:30): the submit first, its key-down in the same ms, key-up 65 ms on
describe('one press of Enter acts once, a held one too (FRM-628)', () => {
    test('a tap acts', () => {
        const key = createKeyPress();
        key.down(1_000, false);
        expect(key.submitted(1_000)).toBe('act');
    });

    test('a held key’s repeats do nothing: its key-down says held', () => {
        const key = createKeyPress();
        key.down(1_000, false);
        key.submitted(1_000);
        key.down(1_150, true);
        expect(key.submitted(1_150)).toBe('repeat');
    });

    test('two taps close together each act: the key went up between', () => {
        const key = createKeyPress();
        key.down(1_000, false);
        key.submitted(1_000);
        key.up();
        key.down(1_120, false);
        expect(key.submitted(1_120)).toBe('act');
    });

    test('⌘ let go ends a ⌘Enter, whose key-up macOS never sends', () => {
        const key = createKeyPress();
        key.submitted(1_000);
        key.modifiersUp();
        expect(key.submitted(1_100)).toBe('act');
    });

    describe('no key-down seen for the submit', () => {
        test('another submit soon after, the key still down, is its repeat', () => {
            const key = createKeyPress();
            key.submitted(1_000);
            expect(key.submitted(1_000 + KEY_REPEAT_MS - 1)).toBe('repeat');
        });

        test('a key-up between makes the next submit a new press, however soon', () => {
            const key = createKeyPress();
            key.submitted(1_000);
            key.up();
            expect(key.submitted(1_050)).toBe('act');
        });

        test('one after the repeat window acts', () => {
            const key = createKeyPress();
            key.submitted(1_000);
            expect(key.submitted(1_000 + KEY_REPEAT_MS + 1)).toBe('act');
        });

        test('a key-down from an older press is not this one’s', () => {
            const key = createKeyPress();
            key.down(1_000, true);
            expect(key.submitted(1_000 + KEY_PAIR_MS + 1)).toBe('act');
        });
    });

    test('a repeat never ends the press: the next held repeat still does nothing', () => {
        const key = createKeyPress();
        key.submitted(1_000);
        key.submitted(1_100);
        expect(key.submitted(1_200)).toBe('repeat');
    });
});
