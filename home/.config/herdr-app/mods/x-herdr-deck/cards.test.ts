import { describe, expect, test } from 'vitest';

import { cardKind, cardText, tint } from './orbit.js';

// FRM-620 slice 3b (W21–W28): a look card reads as a look at a glance, 👀 first, a 🧪 card with 🧪, never «pinned»
describe('a card opens with its kind', () => {
    test('a look card opens with 👀', () => {
        expect(cardText('look: the dock')).toBe('👀 look: the dock');
    });

    test('a test card opens with 🧪, «try» and «test:» alike', () => {
        expect(cardText('try a drag')).toBe('🧪 try a drag');
        expect(cardText('  test: the quill')).toBe('🧪 test: the quill');
    });

    test('a plain ask, «trying» and «lookup» keep their text', () => {
        expect(cardText('push FRM-1')).toBe('push FRM-1');
        expect(cardText('trying the dock')).toBe('trying the dock');
        expect(cardText('lookup the cap')).toBe('lookup the cap');
    });

    test('the kind names look, test or none', () => {
        expect(['Look at it', 'Try it', 'merge #9'].map(cardKind)).toEqual([
            'look',
            'test',
            null,
        ]);
    });
});

describe('a tint of a theme colour', () => {
    test('a six-digit colour takes the alpha', () => {
        expect(tint('#3b82f6', 0.2)).toBe('#3b82f633');
    });

    test('a colour already carrying alpha, or another form, stays as it is', () => {
        expect(tint('#3b82f680', 0.2)).toBe('#3b82f680');
        expect(tint('#fff', 0.2)).toBe('#fff');
    });
});
