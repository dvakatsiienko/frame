import { describe, expect, test } from 'vitest';

import { rowDetails } from '../x-herdr-antenna/details.js';
import { bandOf, stateLine } from '../x-herdr-chat/band.js';
import { threadFacts } from '../x-herdr-deck/orbit.js';
import { focusedLine } from '../x-herdr-tab-pills/focused-line.js';

// FRM-618 slice D exit 3: one wait, from one state file, reads the same in the band, antenna and the top bar, its
// fleet name bold with its badge (W39–W42)
const wait = 'waiting on **🐬 wishkeeper**';
const now = 1_000_000;
const deck = {
    at: now,
    threads: threadFacts(
        [
            {
                activity: { since: now - 60_000, state: 'waiting' },
                context: 40,
                hot: null,
                model: null,
                pid: 7,
                sid: 's7',
                status: 'idle',
                wait,
            },
        ],
        null,
    ),
};

describe('one wait line on every surface', () => {
    test("the band's line is the wait, bold name and badge kept", () => {
        expect(
            stateLine({ isWorking: false, wait: bandOf(deck, 7, now).wait }),
        ).toBe(wait);
    });

    test("antenna's second line is the same text", () => {
        expect(
            rowDetails(
                { 'antenna.details.wait': true },
                {
                    context: null,
                    model: null,
                    time: null,
                    wait: deck.threads['7']?.wait ?? null,
                },
            ).wait,
        ).toBe(wait);
    });

    test('the top bar with tabs hidden shows it too', () => {
        expect(
            focusedLine('t1', { t1: '🐬 wishkeeper' }, { t1: 7 }, deck)?.wait,
        ).toBe(wait);
    });
});
