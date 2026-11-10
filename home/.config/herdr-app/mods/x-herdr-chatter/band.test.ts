import { describe, expect, test } from 'vitest';

import { STALE_MS, bandOf } from './band.js';

const deck = {
    at: 1000,
    seats: { '7': { context: 40, wait: 'waiting on 🦉 clio', week: 57 } },
};

describe('the band reads its own seat from the deck', () => {
    test("the chat's seat gets its three facts, fresh", () => {
        expect(bandOf(deck, 7, 1000)).toEqual({
            context: 40,
            isStale: false,
            wait: 'waiting on 🦉 clio',
            week: 57,
        });
    });

    test('another seat in the deck never shows here', () => {
        expect(bandOf(deck, 8, 1000).wait).toBeNull();
    });

    test('nothing published yet, or no seat pid known, draws empty rows', () => {
        const empty = { context: null, isStale: false, wait: null, week: null };
        expect(bandOf(undefined, 7, 1000)).toEqual(empty);
        expect(bandOf(deck, null, 1000)).toEqual(empty);
    });

    test('facts the deck stopped publishing past two beats read stale', () => {
        expect(bandOf(deck, 7, 1000 + STALE_MS).isStale).toBe(false);
        expect(bandOf(deck, 7, 1001 + STALE_MS).isStale).toBe(true);
    });

    test('a malformed value draws empty, never a guess', () => {
        expect(
            bandOf({ at: 'x', seats: { '7': { context: 'big' } } }, 7, 1000)
                .context,
        ).toBeNull();
        expect(
            bandOf({ at: 1000, seats: { '7': { context: 'big' } } }, 7, 1000)
                .context,
        ).toBeNull();
    });
});
