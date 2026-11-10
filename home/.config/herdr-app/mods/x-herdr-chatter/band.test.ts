import { describe, expect, test } from 'vitest';

import type { FleetState, ThreadState } from './band.js';
import {
    STALE_MS,
    bandButtons,
    bandOf,
    overrideOf,
    pressLine,
    withPress,
} from './band.js';

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
    const off = { isDeckShown: true, override: { isOn: false } };
    const keys = (state: Parameters<typeof bandButtons>[0]) =>
        bandButtons(state).map((b) => [b.key, b.isOn, b.isLive]);
    const thread: ThreadState = { hot: null, wind: null };
    const fleet: FleetState = {
        afk: { at: null, on: false },
        waker: { at: null, on: false },
    };

    test('with no state file yet the four thread buttons stay greyed', () => {
        expect(keys(off)).toEqual([
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
        const hot = bandButtons(off).find((b) => b.key === 'hot');
        expect(hot?.tip).toContain('waits on');
    });

    test("with the thread's state file and fleet.json, wind, hot, waker and AFK are live", () => {
        expect(keys({ ...off, fleet, thread }).slice(0, 4)).toEqual([
            ['wind', false, true],
            ['hot', false, true],
            ['waker', false, true],
            ['afk', false, true],
        ]);
    });

    test('each reads on from the state the stash wrote, never from a press', () => {
        const on = bandButtons({
            ...off,
            fleet: {
                afk: { at: 5, on: true },
                waker: { at: 5, on: true },
            },
            thread: { hot: { since: 5 }, wind: 'writing' },
        });
        expect(on.slice(0, 4).map((b) => b.isOn)).toEqual([
            true,
            true,
            true,
            true,
        ]);
    });

    test('a wind the stash cancelled or refused reads off', () => {
        for (const wind of ['cancelled', 'refused'])
            expect(
                bandButtons({ ...off, fleet, thread: { hot: null, wind } })[0]
                    .isOn,
            ).toBe(false);
    });

    test('a tooltip says the state in words first', () => {
        const [, hot, waker] = bandButtons({
            ...off,
            fleet: { ...fleet, waker: { at: null, on: true } },
            thread,
        });
        expect(hot.tip).toMatch(/^keep hot: off\./);
        expect(waker.tip).toMatch(/^the waker: on\./);
    });

    test('the board tooltip says whether the deck shows', () => {
        expect(bandButtons(off)[6].tip).toMatch(/^board: shown\./);
        expect(bandButtons({ ...off, isDeckShown: false })[6].tip).toMatch(
            /^board: hidden\./,
        );
    });

    test('a press waiting on the stash shows its new state until the stash answers', () => {
        const pending = { hot: { at: 1, on: true } };
        expect(
            bandButtons({ ...off, fleet, pending, thread })[1],
        ).toMatchObject({ isOn: true, isPending: true });
    });

    test('the board reads off while the deck is hidden', () => {
        expect(keys({ ...off, isDeckShown: false })[6]).toEqual([
            'board',
            false,
            true,
        ]);
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

describe('a press is one line of the band press file', () => {
    const now = Date.parse('2026-11-10T22:00:00Z');
    const day = 24 * 60 * 60 * 1000;

    test('wind and hot name their thread, waker and AFK do not', () => {
        expect(pressLine('hot', true, 'abc', now)).toEqual({
            at: now,
            button: 'hot',
            on: true,
            sid: 'abc',
        });
        expect(pressLine('afk', false, 'abc', now)).toEqual({
            at: now,
            button: 'afk',
            on: false,
        });
    });

    test('a press is appended after the lines already there', () => {
        const old = `${JSON.stringify({ at: now - 5, button: 'waker', on: true })}\n`;
        const line = pressLine('afk', true, null, now);
        expect(withPress(old, line, now)).toBe(
            `${old}${JSON.stringify(line)}\n`,
        );
    });

    test('lines older than a day are trimmed, a broken line too', () => {
        const stale = JSON.stringify({
            at: now - day - 1,
            button: 'afk',
            on: true,
        });
        const line = pressLine('waker', true, null, now);
        expect(withPress(`${stale}\n{"half\n`, line, now)).toBe(
            `${JSON.stringify(line)}\n`,
        );
    });

    test('a missing file starts with the press', () => {
        const line = pressLine('hot', false, 'abc', now);
        expect(withPress(null, line, now)).toBe(`${JSON.stringify(line)}\n`);
    });
});
