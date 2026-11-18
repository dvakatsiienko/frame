import { describe, expect, test } from 'vitest';

import { createCmdEnter, createKeyPress } from './keypress.js';

// FRM-648: a press is told by events, never by a clock. herdr hands the chat's quill and the deck's steer boxes Enter
// and ⌘Enter as their own actions (step 111's probe, 14:47), each repeat of a held key one more action
describe('one press of Enter acts once, a held one too', () => {
    test('a tap acts', () => {
        const key = createKeyPress();
        expect(key.pressed()).toBe('act');
    });

    test('a held key’s repeats do nothing', () => {
        const key = createKeyPress();
        key.pressed();
        expect([key.pressed(), key.pressed(), key.pressed()]).toEqual([
            'repeat',
            'repeat',
            'repeat',
        ]);
    });

    // the old 60 ms pairing and 180 ms repeat window: two taps however close each act once the key went up between
    test('two taps close together each act: the key went up between', () => {
        const key = createKeyPress();
        key.pressed();
        key.released();
        expect(key.pressed()).toBe('act');
    });

    // FRM-628 round 2: a held key's last repeat, read after the key-up, unmarked his words; with no clock there is no
    // late read, and a repeat before the key-up is a repeat
    test('a held key’s repeats then its let-go leave one act', () => {
        const key = createKeyPress();
        const acts = [key.pressed(), key.pressed(), key.pressed()];
        key.released();
        expect(acts.filter((a) => a === 'act')).toHaveLength(1);
    });

    test('⌘ let go ends a ⌘Enter, whose Enter key-up macOS never sends', () => {
        const key = createKeyPress();
        key.pressed();
        key.modifiersReleased();
        expect(key.pressed()).toBe('act');
    });

    test('a box that lost focus ends the press, so a key-up it never heard does not stick', () => {
        const key = createKeyPress();
        key.pressed();
        key.blurred();
        expect(key.pressed()).toBe('act');
    });

    test('a let-go with no press before it changes nothing', () => {
        const key = createKeyPress();
        key.released();
        expect(key.pressed()).toBe('act');
        expect(key.pressed()).toBe('repeat');
    });
});

// FRM-648 round 2 (dima's o6): under a held ⌘ every ⌘Enter tap acts, though no key-up ever comes between them
describe('⌘Enter with ⌘ held', () => {
    test('every tap acts', () => {
        const key = createCmdEnter();
        expect([0, 300, 600].map((at) => key.pressed(at))).toEqual([
            'act',
            'act',
            'act',
        ]);
    });

    test('a held ⌘Enter acts on its press and its first repeat only', () => {
        const key = createCmdEnter();
        expect([0, 150, 165, 180, 195].map((at) => key.pressed(at))).toEqual([
            'act',
            'act',
            'repeat',
            'repeat',
            'repeat',
        ]);
    });
});
