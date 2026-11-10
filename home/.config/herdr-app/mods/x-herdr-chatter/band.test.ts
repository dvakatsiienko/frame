import { describe, expect, test } from 'vitest';

import { STALE_MS, bandButtons, bandOf, overrideOf } from './band.js';

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

describe("the band's buttons, as his crop showed them (FRM-565 slice 2)", () => {
    const now = Date.parse('2026-11-10T21:00:00Z');
    const keys = (shown: boolean, override: ReturnType<typeof overrideOf>) =>
        bandButtons({ isDeckShown: shown, override }).map((b) => [
            b.key,
            b.isOn,
            b.isLive,
        ]);

    test('seven buttons in his order, board and override live, the rest greyed', () => {
        expect(keys(true, { isOn: false })).toEqual([
            ['wind', false, false],
            ['hot', false, false],
            ['waker', false, false],
            ['afk', false, false],
            ['override', false, false],
            ['settings', false, false],
            ['board', true, true],
        ]);
    });

    test('a greyed button names what it waits on', () => {
        const hot = bandButtons({
            isDeckShown: true,
            override: { isOn: false },
        }).find((b) => b.key === 'hot');
        expect(hot?.tip).toContain('waits on');
    });

    test('the board reads off while the deck is hidden', () => {
        expect(keys(false, { isOn: false })[6]).toEqual(['board', false, true]);
    });

    test('an override granted and not yet past its until reads on, since its time', () => {
        const store = { prs: { at: '2026-11-10T14:37:38Z', by: 'word' } };
        expect(overrideOf(store, now)).toEqual({
            isOn: true,
            since: '2026-11-10T14:37:38Z',
        });
    });

    test('an override past its until, or with no one behind it, reads off', () => {
        expect(
            overrideOf(
                { prs: { at: 'x', by: 'word', until: '2026-11-10T20:00:00Z' } },
                now,
            ).isOn,
        ).toBe(false);
        expect(overrideOf({ prs: { at: 'x', by: '' } }, now).isOn).toBe(false);
        expect(overrideOf(null, now).isOn).toBe(false);
    });
});
