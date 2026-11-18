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

describe('a row prints one state and its own time (FRM-594)', () => {
    test('his message read prints «read» at the time it was read', () => {
        expect(messageDetails(mine('read', '2026-11-13T12:46:19Z'), now)).toBe(
            'read 14:46',
        );
    });

    test('his message Claude Code still holds prints «sent» at its time', () => {
        expect(messageDetails(mine('sent', '2026-11-13T13:10:00Z'), now)).toBe(
            'sent 15:10',
        );
    });

    test('a time from an earlier day carries its date', () => {
        expect(messageDetails(mine('read', '2026-11-12T21:53:00Z'), now)).toBe(
            'read Nov 12, 23:53',
        );
    });

    test('today is his date, not UTC’s: past his midnight a time is today’s', () => {
        expect(
            messageDetails({ at: '2026-11-12T22:30:00Z', delivery: null }, now),
        ).toBe('00:30');
    });

    test('a reply prints its time alone', () => {
        expect(
            messageDetails({ at: '2026-11-13T12:04:30Z', delivery: null }, now),
        ).toBe('14:04');
    });

    test('a row with no stamp, or one that does not parse, prints nothing', () => {
        expect(messageDetails({ at: null, delivery: null }, now)).toBeNull();
        expect(messageDetails({ at: 'soon', delivery: null }, now)).toBeNull();
        expect(messageDetails(mine('read', 'soon'), now)).toBeNull();
    });
});
