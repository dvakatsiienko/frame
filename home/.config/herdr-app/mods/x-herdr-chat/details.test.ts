import { beforeAll, describe, expect, test } from 'vitest';

import { messageDetails } from './details.js';

// the clock reads in his zone; pinned, so the rows hold on any machine
beforeAll(() => {
    process.env.TZ = 'Europe/Kyiv';
});

const now = Date.parse('2026-11-13T13:20:00Z');

describe('a message reads one state and its own time (FRM-594)', () => {
    test('his message Claude Code took mid-turn reads «read» at the remove that took it', () => {
        expect(
            messageDetails(
                {
                    at: '2026-11-13T12:45:04Z',
                    isMine: true,
                    isWaiting: false,
                    readAt: '2026-11-13T12:46:19Z',
                },
                now,
            ),
        ).toBe('read 14:46');
    });

    test('his message with no queue record, an idle send above all, reads «read» at its own stamp', () => {
        expect(
            messageDetails(
                { at: '2026-11-13T12:18:15Z', isMine: true, isWaiting: false },
                now,
            ),
        ).toBe('read 14:18');
    });

    test('a message Claude Code still holds reads «sent» at its send time', () => {
        expect(
            messageDetails(
                { at: '2026-11-13T13:10:00Z', isMine: true, isWaiting: true },
                now,
            ),
        ).toBe('sent 15:10');
    });

    test('a prompt a tool round took reads «sent» until the remove that took it lands', () => {
        expect(
            messageDetails(
                {
                    at: '2026-11-13T12:45:04Z',
                    command: 'c1',
                    isMine: true,
                    isWaiting: false,
                    readAt: null,
                },
                now,
            ),
        ).toBe('sent 14:45');
    });

    test('a message from an earlier day carries its date', () => {
        expect(
            messageDetails(
                {
                    at: '2026-11-12T21:52:00Z',
                    isMine: true,
                    isWaiting: false,
                    readAt: '2026-11-12T21:53:00Z',
                },
                now,
            ),
        ).toBe('read Nov 12, 23:53');
    });

    test('today is his date, not UTC’s: past his midnight a message is today’s', () => {
        expect(
            messageDetails(
                { at: '2026-11-12T22:30:00Z', isMine: false, isWaiting: false },
                now,
            ),
        ).toBe('00:30');
    });

    test('a reply shows its time alone', () => {
        expect(
            messageDetails(
                { at: '2026-11-13T12:04:30Z', isMine: false, isWaiting: false },
                now,
            ),
        ).toBe('14:04');
    });

    test('a row with no stamp, or one that does not parse, shows nothing', () => {
        expect(
            messageDetails({ at: null, isMine: true, isWaiting: false }, now),
        ).toBeNull();
        expect(
            messageDetails(
                { at: 'soon', isMine: false, isWaiting: false },
                now,
            ),
        ).toBeNull();
    });

    test('a read stamp that does not parse falls back to the row’s own', () => {
        expect(
            messageDetails(
                {
                    at: '2026-11-13T12:18:15Z',
                    isMine: true,
                    isWaiting: false,
                    readAt: 'soon',
                },
                now,
            ),
        ).toBe('read 14:18');
    });
});
