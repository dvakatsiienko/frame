import { describe, expect, test } from 'vitest';

import {
    QUEUED_IDLE_MS,
    claudeQueueAfter,
    clearKeys,
    isHisQueued,
    isVimNormal,
    queuedAfterIdle,
    queuedAfterRow,
    queuedWords,
    readTime,
    readsAfter,
    sendArgs,
    waitingRows,
} from './queued.js';

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

    test('a slash command he queued leaves when its command row joins (his 18:37 wisp)', () => {
        const command = {
            at: Date.parse('2026-11-12T16:32:50Z'),
            text: "/clio:lowtide-lanes-checkup let's see how it looks now",
        };
        const row =
            "<command-message>clio:lowtide-lanes-checkup</command-message>\n<command-name>/clio:lowtide-lanes-checkup</command-name>\n<command-args>let's see how it looks now</command-args>";
        expect(
            queuedAfterRow(
                [command],
                row,
                Date.parse('2026-11-12T16:33:41.349Z'),
            ),
        ).toEqual([]);
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

    test('a thread idle past the grace with the message never joined drops it', () => {
        const idleSince = SENT + 2000;
        expect(
            queuedAfterIdle([HIS], idleSince, idleSince + QUEUED_IDLE_MS),
        ).toEqual([]);
    });

    test('a thread just gone idle keeps it, the queued prompt starts the next turn', () => {
        const idleSince = SENT + 2000;
        expect(queuedAfterIdle([HIS], idleSince, idleSince + 1000)).toEqual([
            HIS,
        ]);
    });

    test('a working thread keeps it, however long the turn runs', () => {
        expect(queuedAfterIdle([HIS], null, SENT + 30 * 60_000)).toEqual([HIS]);
    });
});

// the records cc writes for its queue, as the probe thread wrote them (2026-11-12 00:58) and wing 1's transcript shows
const op = (operation: string, content?: string) => ({
    content,
    operation,
    timestamp: '2026-11-12T22:58:05.000Z',
    type: 'queue-operation',
});
const replay = (...ops: ReturnType<typeof op>[]) =>
    ops.reduce(claudeQueueAfter, [] as { at: number; text: string }[]);

describe("Claude Code's queue, read from its transcript", () => {
    test('a message he sent mid-turn waits in it', () => {
        expect(replay(op('enqueue', 'banana')).map((q) => q.text)).toEqual([
            'banana',
        ]);
    });
    test('one the turn took at a tool round leaves it by its text', () => {
        expect(
            replay(
                op('enqueue', 'a'),
                op('enqueue', 'b'),
                op('remove', 'b'),
            ).map((q) => q.text),
        ).toEqual(['a']);
    });
    test('a dequeue at the turn end takes his message before a task notice', () => {
        const notice = '<task-notification>done</task-notification>';
        expect(
            replay(
                op('enqueue', notice),
                op('enqueue', 'kiwi'),
                op('dequeue'),
            ).map((q) => q.text),
        ).toEqual([notice]);
    });
    test('↑ in the empty prompt pulls his messages out, one record each', () => {
        const notice = '<task-notification>done</task-notification>';
        expect(
            replay(
                op('enqueue', 'a'),
                op('enqueue', notice),
                op('enqueue', 'b'),
                op('popAll', 'a'),
                op('popAll', 'b'),
            ).map((q) => q.text),
        ).toEqual([notice]);
    });
    test('a dequeue or remove on an empty queue changes nothing', () => {
        expect(replay(op('dequeue'), op('remove', 'x'))).toEqual([]);
    });
    test('an enqueue with no text still holds its place', () => {
        expect(
            replay(op('enqueue'), op('enqueue', 'a'), op('dequeue')),
        ).toEqual([{ at: Date.parse('2026-11-12T22:58:05.000Z'), text: '' }]);
    });
});

describe('which queued messages are his', () => {
    test.each([
        ['plain words', 'fix the crow emoji', true],
        ['a paste', '<pasted_content id="1">x</pasted_content>', true],
        ['a ! command', '<bash-input>ls</bash-input>', true],
        ['a task notice', '<task-notification>x</task-notification>', false],
        ['another thread', '<cross-session-message from="a">x', false],
        ['a wake', '<wake>x</wake>', false],
        ['nothing', '', false],
    ])('%s', (_name, text, isHis) => {
        expect(isHisQueued(text)).toBe(isHis);
    });
});

describe('the words of a queued message', () => {
    test('a paste shows its text, not its wrapper', () => {
        expect(
            queuedWords(
                '<pasted_content id="36e3">\nhi there\n</pasted_content>',
            ),
        ).toBe('hi there');
    });
    test('plain words stay as they are', () => {
        expect(queuedWords('fix the crow emoji')).toBe('fix the crow emoji');
    });
});

describe('a send waiting for the turn shows in the chat as his message', () => {
    const at = Date.parse('2026-11-13T21:20:00Z');
    test('each waiting send is his row, its words out of the paste wrapper, marked waiting', () => {
        expect(
            waitingRows([
                { at, isRecorded: true, text: 'fix the crow emoji' },
                {
                    at: at + 1,
                    isRecorded: false,
                    text: '<pasted_content id="36e3">\nhi there\n</pasted_content>',
                },
            ]).map((r) => [
                r.kind,
                r.mine,
                r.item.kind,
                r.item.text,
                r.item.isWaiting,
            ]),
        ).toEqual([
            ['item', true, 'user', 'fix the crow emoji', true],
            ['item', true, 'user', 'hi there', true],
        ]);
    });
    test('two sends of one text stay two rows', () => {
        const once = { at, isRecorded: false, text: 'ok' };
        const keys = waitingRows([once, { ...once }]).map((r) => r.key);
        expect(new Set(keys).size).toBe(2);
    });
    test('its key holds while it waits: an earlier one taken, or its own record landing, never re-keys it', () => {
        const first = { at, isRecorded: true, text: 'first' };
        const second = { at: at + 5, isRecorded: false, text: 'second' };
        const [, kept] = waitingRows([first, second]).map((r) => r.key);
        expect(waitingRows([second]).map((r) => r.key)).toEqual([kept]);
        expect(
            waitingRows([{ ...second, at: at + 9, isRecorded: true }]).map(
                (r) => r.key,
            ),
        ).toEqual([kept]);
    });
    test('nothing waiting draws no row', () => {
        expect(waitingRows([])).toEqual([]);
    });
});

// the foot of Claude Code's screen, read off a throwaway thread (2026-11-12): vim's insert mode names itself, its normal
// mode shows nothing, the same as vim off
const INSERT_FOOT =
    '❯\n────\n  🦉 haiku 5.5\n  -- INSERT -- ⏵⏵ bypass permissions on (shift+tab to cycle)';
const NORMAL_FOOT =
    '❯\n────\n  🦉 haiku 5.5\n  ⏵⏵ bypass permissions on (shift+tab to cycle)';

describe("emptying Claude Code's prompt", () => {
    test('vim with no insert marker is normal mode', () => {
        expect(isVimNormal(NORMAL_FOOT, 'vim')).toBe(true);
    });

    test('vim inserting is not', () => {
        expect(isVimNormal(INSERT_FOOT, 'vim')).toBe(false);
    });

    test('vim off is never normal mode', () => {
        expect(isVimNormal(NORMAL_FOOT, 'normal')).toBe(false);
        expect(isVimNormal(NORMAL_FOOT, undefined)).toBe(false);
    });

    test('inserting: ctrl+u twice for each line the text can take', () => {
        expect(clearKeys(['plum'], false)).toEqual(Array(8).fill('ctrl+u'));
        expect(clearKeys(['test', 'test'], false)).toHaveLength(16);
        expect(clearKeys(['a\nb'], false)).toHaveLength(10);
    });

    test('normal mode: its cursor sits on the last character, so the whole text goes at once, then back to insert', () => {
        expect(clearKeys(['plum'], true)).toEqual([
            'g',
            'g',
            'd',
            'shift+g',
            'i',
        ]);
    });
});

describe('sendArgs', () => {
    test('a message that opens with a dash still reaches hc as its text, not a flag', () => {
        expect(sendArgs('t1', '- a list item')).toEqual([
            'send',
            't1',
            '--',
            '- a list item',
        ]);
    });

    test('flags go before the address, the text stays last', () => {
        expect(sendArgs('t1', '--help', ['--force'])).toEqual([
            'send',
            '--force',
            't1',
            '--',
            '--help',
        ]);
    });
});

describe('when Claude Code read a message of his', () => {
    const at = (s: string) => Date.parse(`2026-11-13T12:${s}Z`);
    const enq = (text: string, t: string) => ({
        content: text,
        operation: 'enqueue',
        timestamp: `2026-11-13T12:${t}Z`,
    });
    const pick = (operation: string, t: string, content?: string) => ({
        content,
        operation,
        timestamp: `2026-11-13T12:${t}Z`,
    });
    test('a tool round takes it by its text: read at that remove', () => {
        const queue = [enq('click to open', '45:04.965')].reduce(
            claudeQueueAfter,
            [],
        );
        expect(
            readsAfter([], queue, pick('remove', '45:19.332', 'click to open')),
        ).toEqual([
            {
                at: at('45:04.965'),
                readAt: at('45:19.332'),
                text: 'click to open',
            },
        ]);
    });
    test('a turn end takes his before a task notice: read at that dequeue', () => {
        const notice = '<task-notification>x</task-notification>';
        const queue = [enq(notice, '46:00'), enq('ok', '46:01')].reduce(
            claudeQueueAfter,
            [],
        );
        expect(readsAfter([], queue, pick('dequeue', '46:35'))).toEqual([
            { at: at('46:01'), readAt: at('46:35'), text: 'ok' },
        ]);
    });
    test('↑ pulling it back out is no read', () => {
        const queue = [enq('ok', '46:01')].reduce(claudeQueueAfter, []);
        expect(readsAfter([], queue, pick('popAll', '46:05', 'ok'))).toEqual(
            [],
        );
    });
    test('his row finds its read by its words and send time', () => {
        const reads = [
            {
                at: at('45:04.965'),
                readAt: at('45:19.332'),
                text: '<pasted_content id="a">\nclick  to open\n</pasted_content>',
            },
        ];
        expect(readTime(reads, 'click to open', at('45:04.700'))).toBe(
            at('45:19.332'),
        );
        expect(readTime(reads, 'click to open', at('49:00'))).toBe(at('49:00'));
        expect(readTime(reads, 'something else', at('45:04.700'))).toBe(
            at('45:04.700'),
        );
    });
    test('a message sent while the thread was idle has no queue record: its own row is the read', () => {
        expect(readTime([], 'proceed', at('18:15'))).toBe(at('18:15'));
    });
    test('a row with no time has no read time', () => {
        expect(readTime([], 'ok', 0)).toBeNull();
    });
});
