import { describe, expect, it } from 'vitest';

import { canonicalQuery, pressedChord } from './chord.ts';

describe('pressedChord', () => {
    it('picks the chord over the bare modifier released in the same tick', () => {
        const previous = { ctrl: 40, 'ctrl+shift+cmd+4': 2 };
        const counts = { ctrl: 41, 'ctrl+shift+cmd+4': 3 };

        expect(pressedChord(previous, counts)).toBe('ctrl+shift+cmd+4');
    });

    it('still reports a bare modifier pressed alone', () => {
        expect(pressedChord({ cmd: 1 }, { cmd: 2 })).toBe('cmd');
    });
});

describe('canonicalQuery', () => {
    it('sorts typed modifiers into the order chordOf spells them in', () => {
        expect(canonicalQuery('cmd+shift+l')).toBe('shift+cmd+l');
    });

    it('sorts a modifier run with no key on it', () => {
        expect(canonicalQuery('cmd+shift')).toBe('shift+cmd');
    });

    it('leaves prose alone, so the same needle can match a note', () => {
        expect(canonicalQuery('linear')).toBe('linear');
    });
});
