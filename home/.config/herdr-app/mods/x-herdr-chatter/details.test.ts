import { beforeAll, describe, expect, test } from 'vitest';

import { messageDetails } from './details.js';
import { queuedAfterRow } from './queued.js';

// the clock reads in his zone; pinned, so the rows hold on any machine
beforeAll(() => {
    process.env.TZ = 'Europe/Kyiv';
});

const now = Date.parse('2026-11-13T13:20:00Z');

describe('a message reads its send time and received state (FRM-594)', () => {
    test('his message whose row reached the transcript: its time and «received»', () => {
        expect(
            messageDetails(
                { at: '2026-11-13T12:03:00Z', isMine: true, isQueued: false },
                now,
            ),
        ).toBe('14:03 · received');
    });

    test('a message from an earlier day carries its date', () => {
        expect(
            messageDetails(
                { at: '2026-11-12T21:52:00Z', isMine: true, isQueued: false },
                now,
            ),
        ).toBe('Nov 12, 23:52 · received');
    });

    test('a queued message reads «queued» with its send time, «received» once its row clears it', () => {
        const sentAt = Date.parse('2026-11-13T13:10:00Z');
        const queued = [{ at: sentAt, text: 'ship it' }];
        expect(
            messageDetails({ at: sentAt, isMine: true, isQueued: true }, now),
        ).toBe('15:10 · queued');
        const row = { at: '2026-11-13T13:10:02Z', text: 'ship it' };
        const left = queuedAfterRow(queued, row.text, Date.parse(row.at));
        expect(left).toEqual([]);
        expect(
            messageDetails(
                { at: row.at, isMine: true, isQueued: left.length > 0 },
                now,
            ),
        ).toBe('15:10 · received');
    });

    test('a reply of the thread shows its time and no received state', () => {
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
