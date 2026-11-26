import { describe, expect, test } from 'vitest';

import { asksOf, cardKind, cardText, originOf, tint } from './orbit.js';

// FRM-620 slice 3b (W21–W28): a look card reads as a look at a glance, 👀 first, a 🧪 card with 🧪, never «pinned»
describe('a card opens with its kind', () => {
    test('a look card opens with 👀', () => {
        expect(cardText('look: the dock')).toBe('👀 look: the dock');
    });

    test('a test card opens with 🧪', () => {
        expect(cardText('  test: the quill')).toBe('🧪 test: the quill');
    });

    // crow 15:24 (FRM-673 rider): the kind is read from «look:» and «test:» alone, an emoji a thread led with skipped
    test('a card a thread already led with its emoji keeps its kind and one emoji', () => {
        expect(cardText('🧪 test: the quill')).toBe('🧪 test: the quill');
        expect(cardText('👀 look: the tints')).toBe('👀 look: the tints');
    });

    test('a plain ask opening «try» or «look» without the colon stays plain', () => {
        expect(
            ['try a) or b)?', 'look at it', '🧪 try the quill'].map(cardKind),
        ).toEqual([null, null, null]);
    });

    test('a plain ask, «trying» and «lookup» keep their text', () => {
        expect(cardText('push FRM-1')).toBe('push FRM-1');
        expect(cardText('trying the dock')).toBe('trying the dock');
        expect(cardText('lookup the cap')).toBe('lookup the cap');
    });

    test('the kind names look, test or none', () => {
        expect(['Look: it', 'Test: it', 'merge #9'].map(cardKind)).toEqual([
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

// FRM-620 step 164 (FRM-670:W5–W8): under an ask, who asks and why
describe('an ask’s origin line', () => {
    // dima, 26 Nov 18:22: only a relayed ask says who started it, its area and ticket; never the why
    test('a relayed ask names its starter, area and ticket; a session’s own ask none, its why never', () => {
        const origin = (from: unknown) =>
            asksOf({ asks: [{ from, id: 'o1', text: 'x', why: 'a why' }] })[0]
                ?.origin;
        expect([
            origin({ line: '🐦‍⬛ crow', who: 'crow' }),
            origin({
                lane: 'herdr',
                line: '🔧 herdr | FRM-569',
                ticket: 'FRM-569',
                who: 'codie',
            }),
            origin(null),
            origin({ line: '  ' }),
        ]).toEqual(['🐦‍⬛ crow', '🔧 herdr | FRM-569', null, null]);
    });

    test('an ask updated in place takes its new starter', () => {
        expect(
            ['🐬 wishkeeper', '🐦‍⬛ crow'].map((line) => originOf({ line })),
        ).toEqual(['🐬 wishkeeper', '🐦‍⬛ crow']);
    });
});
