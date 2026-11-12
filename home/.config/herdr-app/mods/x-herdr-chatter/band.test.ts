import { describe, expect, test } from 'vitest';

import type { FleetState, ThreadState } from './band.js';
import {
    STALE_MS,
    bandButtons,
    bandOf,
    meterCells,
    meterTip,
    overrideOf,
    pendingOf,
    pressLine,
    stateLine,
    withPress,
} from './band.js';

const deck = {
    at: 1000,
    threads: { '7': { context: 40, wait: 'waiting on 🦉 clio', week: 57 } },
};

describe('the band reads its own thread from the deck', () => {
    test("the chat's thread gets its three facts, fresh", () => {
        expect(bandOf(deck, 7, 1000)).toEqual({
            context: 40,
            isStale: false,
            wait: 'waiting on 🦉 clio',
            week: 57,
        });
    });

    test('another thread in the deck never shows here', () => {
        expect(bandOf(deck, 8, 1000).wait).toBeNull();
    });

    test('nothing published yet, or no thread pid known, draws empty rows', () => {
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
            bandOf({ at: 'x', threads: { '7': { context: 'big' } } }, 7, 1000)
                .context,
        ).toBeNull();
        expect(
            bandOf({ at: 1000, threads: { '7': { context: 'big' } } }, 7, 1000)
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
            ['override', false, true],
            ['settings', false, true],
            ['board', true, true],
        ]);
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

    test('a tooltip names the button, with no press explanation (dima, 23:08)', () => {
        const since = new Date(2026, 10, 10, 22, 20).getTime();
        const tips = (state: Parameters<typeof bandButtons>[0]) =>
            bandButtons(state).map((b) => b.tip);
        expect(tips(off)).toEqual([
            'second wind',
            'keep hot',
            'waker',
            'afk',
            'operator override',
            'settings',
            'deck',
        ]);
        expect(
            tips({
                ...off,
                fleet: { afk: { at: 5, on: true }, waker: { at: 5, on: true } },
                override: { isOn: true, since: 'x' },
                pending: { waker: { at: 1, on: false } },
                thread: { hot: { since }, wind: null },
            }).slice(1, 5),
        ).toEqual([
            'keep hot: on since 22:20',
            'waker',
            'afk',
            'operator override',
        ]);
    });

    test("the wind button draws the cc band's lifecycle emoji for the thread's wind", () => {
        const emoji = (wind: string | null) =>
            bandButtons({ ...off, fleet, thread: { hot: null, wind } })[0]
                .emoji;
        expect(
            [
                null,
                'asked',
                'writing',
                'refreshing',
                'cancelled',
                'refused',
            ].map(emoji),
        ).toEqual(['🐦‍🔥', '🥚', '✍️', '🌀', '↩️', '🛑']);
    });

    test('a wind press waiting on the stash draws the state it asked for', () => {
        const wind = (on: boolean, was: string | null) =>
            bandButtons({
                ...off,
                fleet,
                pending: { wind: { at: 1, on } },
                thread: { hot: null, wind: was },
            })[0].emoji;
        expect(wind(true, null)).toBe('🥚');
        expect(wind(false, 'asked')).toBe('🐦‍🔥');
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

describe('the 🔓 is his to press (o95)', () => {
    const off = { isDeckShown: true, override: { isOn: false } };
    const lock = (state: Parameters<typeof bandButtons>[0]) =>
        bandButtons(state).find((b) => b.key === 'override');

    test('it is live with no state file, since the store is read directly', () => {
        expect(lock(off)?.isLive).toBe(true);
    });

    test('a press the store has not answered shows the state it asked for, pending', () => {
        expect(
            lock({ ...off, pending: { override: { at: 1, on: true } } }),
        ).toMatchObject({ isOn: true, isPending: true });
    });

    test('with no press waiting it reads the store', () => {
        expect(
            lock({ ...off, override: { isOn: true, since: 'x' } }),
        ).toMatchObject({ isOn: true, isPending: false });
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

    test('the override is fleet-wide: its line names no thread', () => {
        expect(pressLine('override', true, 'abc', now)).toEqual({
            at: now,
            button: 'override',
            on: true,
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

describe('the band follows a press made on the deck (dima, 23:42)', () => {
    const now = 1_000_000;
    const file = [
        { at: now - 30_000, button: 'hot', on: true, sid: 'me' },
        { at: now - 3000, button: 'hot', on: false, sid: 'me' },
        { at: now - 2000, button: 'hot', on: true, sid: 'other' },
        { at: now - 1000, button: 'afk', on: true },
    ]
        .map((l) => `${JSON.stringify(l)}\n`)
        .join('');

    test("the press file's newest press per button is pending, its thread's only", () => {
        expect(pendingOf(file, 'me', now)).toEqual({
            afk: { at: now - 1000, on: true },
            hot: { at: now - 3000, on: false },
        });
    });

    test('a press past the wait is no longer pending', () => {
        expect(pendingOf(file, 'me', now + 60_000)).toEqual({});
    });

    test('a deck press draws on the band before the state file reads it', () => {
        const hot = bandButtons({
            fleet: {
                afk: { at: null, on: false },
                waker: { at: null, on: false },
            },
            isDeckShown: true,
            override: { isOn: false },
            pending: pendingOf(file, 'me', now),
            thread: { hot: { since: 5 }, wind: null },
        })[1];
        expect(hot).toMatchObject({ isOn: false, isPending: true });
    });
});

describe('the state card over the box (PK-384)', () => {
    test('a working thread reads what it does, else «Working…»', () => {
        expect(stateLine({ isWorking: true, msg: 'Adding the line' })).toBe(
            'Adding the line',
        );
        expect(stateLine({ isWorking: true, msg: null })).toBe('Working…');
    });

    test('an idle thread reads its wait line, the old wait row folded in', () => {
        expect(
            stateLine({ isWorking: false, wait: 'waiting on 🦉 clio' }),
        ).toBe('waiting on 🦉 clio');
        expect(stateLine({ isWorking: false, wait: null })).toBe('Idle');
    });

    test('a thread asking him says so, never «Idle»', () => {
        expect(
            stateLine({ isBlocked: true, isWorking: false, wait: null }),
        ).toBe('Waiting on you');
    });

    test('a stuck turn says why Stop does nothing', () => {
        expect(stateLine({ isStuck: true, isWorking: true })).toMatch(
            /background task/,
        );
    });
});

describe('the meters: no words, the numbers in a tooltip (PK-384)', () => {
    test('a meter fills its cells to the percent, rounded and clamped', () => {
        expect(meterCells(28, 40)).toBe(11);
        expect(meterCells(0, 40)).toBe(0);
        expect(meterCells(100, 40)).toBe(40);
        expect(meterCells(140, 40)).toBe(40);
        expect(meterCells(-5, 40)).toBe(0);
        expect(meterCells(null, 40)).toBe(0);
    });

    test('a little use still lights one cell', () => {
        expect(meterCells(1, 40)).toBe(1);
    });

    test('the tooltip names the meter and its percent', () => {
        expect(meterTip('ctx', 28.4)).toBe('context');
        expect(meterTip('week', null)).toBe('weekly: not read yet');
    });
});
