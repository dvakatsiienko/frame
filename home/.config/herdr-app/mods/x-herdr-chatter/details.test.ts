import { beforeAll, describe, expect, test } from 'vitest';

import { messageDetails } from './details.js';
import { claudeQueueAfter, readTime, readsAfter } from './queued.js';

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

describe('his line over a fixture transcript (FRM-594 re-sign)', () => {
    // after clio's transcript, 2026-11-13: a mid-turn message taken at a tool round (its remove moved a minute on, so
    // the read shows apart from the send), then an idle send with no queue record
    const records = [
        {
            content: 'Click to open an image',
            operation: 'enqueue',
            timestamp: '2026-11-13T12:45:04.965Z',
        },
        {
            content: 'Click to open an image',
            operation: 'remove',
            timestamp: '2026-11-13T12:46:19.332Z',
        },
    ];
    const replay = () => {
        let queue: { at: number; text: string }[] = [];
        let reads: ReturnType<typeof readsAfter> = [];
        for (const op of records) {
            reads = readsAfter(reads, queue, op);
            queue = claudeQueueAfter(queue, op);
        }
        return reads;
    };
    const line = (text: string, at: string) =>
        messageDetails(
            {
                at,
                isMine: true,
                isQueued: false,
                readAt: readTime(replay(), text, Date.parse(at)),
            },
            now,
        );
    test('a message taken mid-turn reads the remove that took it', () => {
        expect(line('Click to open an image', '2026-11-13T12:45:01.682Z')).toBe(
            'sent 14:45 · read 14:46',
        );
    });
    test('an idle send reads its own row', () => {
        expect(line('proceed', '2026-11-13T12:18:15Z')).toBe(
            'sent 14:18 · read 14:18',
        );
    });
});
