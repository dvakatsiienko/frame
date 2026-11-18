import { describe, expect, test } from 'vitest';

import { KEY_PAIR_MS, KEY_REPEAT_MS, createKeyPress } from './keypress.js';

// herdr's order, read off his Enter (FRM-628 step 87, 12:30): the submit first, its key-down in the same ms, key-up 65 ms on
describe('one press of Enter acts once, a held one too (FRM-628)', () => {
    test('a tap acts', () => {
        const key = createKeyPress();
        key.down(1_000, false);
        expect(key.submitted(1_000)).toBe('act');
    });

    // FRM-628's done test: a slow Enter (~150 ms) sends exactly once, his first key repeat landing as he lets go
    test('a slow Enter (~150 ms) acts once', () => {
        const key = createKeyPress();
        key.down(1_000, false);
        const acts = [key.submitted(1_000)];
        key.down(1_150, true);
        acts.push(key.submitted(1_150));
        key.up(1_215);
        expect(acts).toEqual(['act', 'repeat']);
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
        key.up(1_065);
        key.down(1_120, false);
        expect(key.submitted(1_120)).toBe('act');
    });

    test('⌘ let go ends a ⌘Enter, whose key-up macOS never sends', () => {
        const key = createKeyPress();
        key.submitted(1_000);
        key.modifiersUp(1_060);
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
            key.up(1_040);
            expect(key.submitted(1_050)).toBe('act');
        });

        // FRM-628 round 2 (dima, 13:14): a held Enter in the quill unmarked his words as he let go: its last repeat,
        // read a beat after its submit, came after the key-up
        test('a held key’s last repeat, read after the key-up, is still its repeat', () => {
            const key = createKeyPress();
            expect(key.submitted(1_000)).toBe('act');
            const acts = [];
            for (let at = 1_150; at <= 1_300; at += 15)
                acts.push(key.submitted(at));
            key.up(1_310);
            acts.push(key.submitted(1_305));
            expect(acts.every((act) => act === 'repeat')).toBe(true);
            expect(key.submitted(1_400)).toBe('act');
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

    // 8469d9d2: one press flipped 🍕 and 🛎️ back and forth, seen twice
    test('one press seen as two submits acts once: its key-down acted already', () => {
        const key = createKeyPress();
        key.down(1_000, false);
        key.submitted(1_000);
        expect(key.submitted(1_002)).toBe('repeat');
    });

    test('a repeat never ends the press: the next held repeat still does nothing', () => {
        const key = createKeyPress();
        key.submitted(1_000);
        key.submitted(1_100);
        expect(key.submitted(1_200)).toBe('repeat');
    });
});
