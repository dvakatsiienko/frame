import { describe, expect, test } from 'vitest';

import { QUEUED_IDLE_MS, queuedAfterIdle, queuedAfterRow } from './queued.js';

const SENT = Date.parse('2026-11-11T15:01:50.84Z');
// dima's 17:01:54 paste to wing 1, as cc wrote it once the turn took it: a queued_command whose stamp is 0.3 s before
// the enqueue, its text inside a pasted_content wrapper
const JOINED = {
    at: Date.parse('2026-11-11T15:01:50.55Z'),
    text: '<pasted_content id="36e3">\n⚡ 🔧 codie: tests-cheaper ← who does cli lane? your test-cheaper lane was supposed to solve perf problems, boring ci and rest of perf-related tails.\nwhat i wanted from you: two lanes:\n1. tails, boring ci, perf leftovers\n2. cli lane\nis it what i wanted or you re-routed tests-cheaper lane to cli?\n\norbit w1-o17 — propose top7\n</pasted_content>',
};
const HIS = {
    at: SENT,
    text: '⚡ 🔧 codie: tests-cheaper ← who does cli lane? your test-cheaper lane was supposed to solve perf problems, boring ci and rest of perf-related tails.\nwhat i wanted from you: two lanes:\n1. tails, boring ci, perf leftovers\n2. cli lane\nis it what i wanted or you re-routed tests-cheaper lane to cli?\n\norbit w1-o17 — propose top7',
};

describe('a message sent mid-turn shows as queued until the turn takes it', () => {
    test('his 17:01:54 paste leaves the queue when its row joins the transcript', () => {
        expect(queuedAfterRow([HIS], JOINED.text, JOINED.at)).toEqual([]);
    });

    test('a row with other words keeps it queued', () => {
        expect(queuedAfterRow([HIS], 'a tool result', JOINED.at)).toEqual([
            HIS,
        ]);
    });

    test('an older row with the same words, replayed from the file, keeps it queued', () => {
        const yes = { at: SENT, text: 'yes' };
        expect(queuedAfterRow([yes], 'yes', SENT - 60_000)).toEqual([yes]);
    });

    test('two queued messages leave one at a time', () => {
        const next = { at: SENT + 1000, text: 'and one more' };
        expect(queuedAfterRow([HIS, next], JOINED.text, JOINED.at)).toEqual([
            next,
        ]);
    });

    test('a seat idle past the grace with the message never joined drops it', () => {
        const idleSince = SENT + 2000;
        expect(
            queuedAfterIdle([HIS], idleSince, idleSince + QUEUED_IDLE_MS),
        ).toEqual([]);
    });

    test('a seat just gone idle keeps it, the queued prompt starts the next turn', () => {
        const idleSince = SENT + 2000;
        expect(queuedAfterIdle([HIS], idleSince, idleSince + 1000)).toEqual([
            HIS,
        ]);
    });

    test('a working seat keeps it, however long the turn runs', () => {
        expect(queuedAfterIdle([HIS], null, SENT + 30 * 60_000)).toEqual([HIS]);
    });
});
