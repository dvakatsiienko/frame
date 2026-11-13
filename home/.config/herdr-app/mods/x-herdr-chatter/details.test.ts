import { beforeAll, describe, expect, test } from 'vitest';

import { messageDetails } from './details.js';

// the clock reads in his zone; pinned, so the rows hold on any machine
beforeAll(() => {
    process.env.TZ = 'Europe/Kyiv';
});

const now = Date.parse('2026-11-13T13:20:00Z');

describe('a message reads when it was sent and when Claude read it (FRM-594)', () => {
    test('his message Claude Code took: «sent» and «read» on his clock', () => {
        expect(
            messageDetails(
                {
                    at: '2026-11-13T12:45:04Z',
                    isMine: true,
                    isQueued: false,
                    readAt: Date.parse('2026-11-13T12:45:19Z'),
                },
                now,
            ),
        ).toBe('sent 14:45 · read 14:45');
    });

    test('a message from an earlier day carries its date', () => {
        expect(
            messageDetails(
                {
                    at: '2026-11-12T21:52:00Z',
                    isMine: true,
                    isQueued: false,
                    readAt: Date.parse('2026-11-12T21:53:00Z'),
                },
                now,
            ),
        ).toBe('sent Nov 12, 23:52 · read 23:53');
    });

    test('a message Claude Code still holds reads «queued»', () => {
        expect(
            messageDetails(
                { at: '2026-11-13T13:10:00Z', isMine: true, isQueued: true },
                now,
            ),
        ).toBe('sent 15:10 · queued');
    });

    test('a message whose pick-up was never read shows its send time alone', () => {
        expect(
            messageDetails(
                { at: '2026-11-13T12:03:00Z', isMine: true, isQueued: false },
                now,
            ),
        ).toBe('sent 14:03');
    });

    test('a reply of the thread shows its time alone', () => {
        expect(
            messageDetails(
                { at: '2026-11-13T12:04:30Z', isMine: false, isQueued: false },
                now,
            ),
        ).toBe('14:04');
    });

    test('a row with no stamp shows nothing', () => {
        expect(
            messageDetails({ at: null, isMine: true, isQueued: false }, now),
        ).toBeNull();
    });
});
