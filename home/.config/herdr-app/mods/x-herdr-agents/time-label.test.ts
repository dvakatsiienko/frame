import { describe, expect, test } from 'vitest';

import { timeLabel } from './time-label.js';

const now = Date.parse('2026-11-19T20:00:00Z');
const ago = (min: number) => now - min * 60000;

// FRM-618 W22: the time beside a thread says how long it has sat idle, and nothing while it works
describe('the time beside a thread in the agents list', () => {
    test('an idle thread reads how long it has been idle', () => {
        expect(timeLabel('idle', ago(54), now)).toBe('idle 54m');
    });

    test('a thread whose turn finished reads idle too', () => {
        expect([
            timeLabel('done', ago(3), now),
            timeLabel('unread', ago(90), now),
        ]).toEqual(['idle 3m', 'idle 1h']);
    });

    test('a working or blocked thread shows no time', () => {
        expect([
            timeLabel('working', ago(5), now),
            timeLabel('blocked', ago(5), now),
        ]).toEqual([null, null]);
    });

    test('a thread with no change seen shows no time', () => {
        expect(timeLabel('idle', 0, now)).toBeNull();
    });

    test('under a minute and past a day keep their short forms', () => {
        expect([
            timeLabel('idle', now - 20000, now),
            timeLabel('idle', ago(60 * 50), now),
        ]).toEqual(['idle <1m', 'idle 2d']);
    });
});
