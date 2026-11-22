/// <reference types="node" />
import { beforeAll, describe, expect, test } from 'vitest';

import { messageDetails } from './details.js';

// the clock reads in his zone; pinned, so the rows hold on any machine
beforeAll(() => {
    process.env.TZ = 'Europe/Kyiv';
});

const now = Date.parse('2026-11-13T13:20:00Z');
const mine = (state: 'sent' | 'read', at: string) => ({
    at: '2026-11-13T12:00:00Z',
    delivery: { at, state },
});

describe('a row prints one state and its own time (FRM-594, ✓ and ✓✓ by FRM-563:W13)', () => {
    test('his message read prints ✓✓ at the time it was read, the word gone', () => {
        expect(
            messageDetails(mine('read', '2026-11-13T12:46:19Z'), now),
        ).toEqual({
            mark: '✓✓',
            when: '14:46',
        });
    });

    test('his message Claude Code still holds prints ✓ at its time, the word gone', () => {
        expect(
            messageDetails(mine('sent', '2026-11-13T13:10:00Z'), now),
        ).toEqual({
            mark: '✓',
            when: '15:10',
        });
    });

    // dima, 19 Nov 17:28: «can you remove this?»
    test('a / command prints its state and time like any message', () => {
        const slash = (state: 'sent' | 'read') => ({
            ...mine(state, '2026-11-13T13:10:00Z'),
            text: '/clio:halt wire+',
        });
        expect([
            messageDetails(slash('sent'), now),
            messageDetails(slash('read'), now),
        ]).toEqual([
            { mark: '✓', when: '15:10' },
            { mark: '✓✓', when: '15:10' },
        ]);
    });

    test('a time from an earlier day carries its date', () => {
        expect(
            messageDetails(mine('read', '2026-11-12T21:53:00Z'), now),
        ).toEqual({
            mark: '✓✓',
            when: 'Nov 12, 23:53',
        });
    });

    test('today is his date, not UTC’s: past his midnight a time is today’s', () => {
        expect(
            messageDetails({ at: '2026-11-12T22:30:00Z', delivery: null }, now),
        ).toEqual({ mark: null, when: '00:30' });
    });

    test('a reply prints its time alone', () => {
        expect(
            messageDetails({ at: '2026-11-13T12:04:30Z', delivery: null }, now),
        ).toEqual({ mark: null, when: '14:04' });
    });

    test('a row with no stamp, or one that does not parse, prints nothing', () => {
        expect(messageDetails({ at: null, delivery: null }, now)).toBeNull();
        expect(messageDetails({ at: 'soon', delivery: null }, now)).toBeNull();
        expect(messageDetails(mine('read', 'soon'), now)).toBeNull();
    });
});
