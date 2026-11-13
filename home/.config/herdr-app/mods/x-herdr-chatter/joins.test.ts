import { describe, expect, test } from 'vitest';

import {
    HOLD_DELAY_MS,
    HOLD_PUSH_MS,
    JOIN_LOCK_STALE_MS,
    JOIN_TAKE_MS,
    appendJoin,
    backTexts,
    dropJoin,
    holdSend,
    joinStatus,
    joinedTexts,
    pushReason,
    retextJoin,
    takeBackJoin,
} from './joins.js';

// a join file and its lock dir in memory, on a fake clock
function fakeIo({
    isLockHeld = false,
    isWriteRefused = false,
    lockAgeMs = 0,
} = {}) {
    const files = new Map<string, string>();
    const locks = new Set<string>(isLockHeld ? ['/j/s1.jsonl.lock'] : []);
    let clock = 0;
    return {
        files,
        io: {
            lock: async (path: string) => {
                if (locks.has(path)) return false;
                locks.add(path);
                return true;
            },
            lockAge: async (path: string) =>
                locks.has(path) ? lockAgeMs : null,
            now: () => clock,
            read: async (path: string) => files.get(path) ?? null,
            sleep: async (ms: number) => {
                clock += ms;
            },
            unlock: async (path: string) => {
                locks.delete(path);
            },
            // herdr's writeTextFile: written only over the text it was read as, null for a new file
            write: async (
                path: string,
                text: string,
                expected: string | null,
            ) => {
                if (isWriteRefused) throw new Error('refused');
                if ((files.get(path) ?? null) !== expected)
                    throw new Error('stale');
                files.set(path, text);
            },
        },
        locks,
    };
}

describe('a click joins: one row in the thread’s join file, under its lock (FRM-564)', () => {
    test('writes one row with its id and text', async () => {
        const { files, io, locks } = fakeIo();
        expect(await appendJoin(io, '/j/s1.jsonl', 'a1', 'ship it')).toBe(true);
        expect(files.get('/j/s1.jsonl')).toBe('{"id":"a1","text":"ship it"}\n');
        expect(locks.size).toBe(0);
    });
    test('two clicks before one turn: both rows, in order', async () => {
        const { files, io } = fakeIo();
        await appendJoin(io, '/j/s1.jsonl', 'a1', 'one');
        await appendJoin(io, '/j/s1.jsonl', 'a2', 'two');
        expect(files.get('/j/s1.jsonl')).toBe(
            '{"id":"a1","text":"one"}\n{"id":"a2","text":"two"}\n',
        );
    });
    test('the lock held elsewhere: retried about 2 s, then refused, nothing written', async () => {
        const { files, io } = fakeIo({ isLockHeld: true });
        expect(await appendJoin(io, '/j/s1.jsonl', 'a1', 'x')).toBe(false);
        expect(io.now()).toBeGreaterThanOrEqual(2000);
        expect(io.now()).toBeLessThan(2500);
        expect(files.size).toBe(0);
    });
    test('a lock a crash left, older than the age both sides agree on, is broken and the row written', async () => {
        const { files, io, locks } = fakeIo({
            isLockHeld: true,
            lockAgeMs: JOIN_LOCK_STALE_MS,
        });
        expect(await appendJoin(io, '/j/s1.jsonl', 'a1', 'x')).toBe(true);
        expect(files.get('/j/s1.jsonl')).toBe('{"id":"a1","text":"x"}\n');
        expect(locks.size).toBe(0);
    });
    test('a lock younger than that age is waited on, never broken', async () => {
        const { files, io } = fakeIo({
            isLockHeld: true,
            lockAgeMs: JOIN_LOCK_STALE_MS - 1,
        });
        expect(await appendJoin(io, '/j/s1.jsonl', 'a1', 'x')).toBe(false);
        expect(files.size).toBe(0);
    });
    test('a refused write answers false and lets the lock go', async () => {
        const { io, locks } = fakeIo({ isWriteRefused: true });
        expect(await appendJoin(io, '/j/s1.jsonl', 'a1', 'x')).toBe(false);
        expect(locks.size).toBe(0);
    });
});

describe('where a join stands, read off the thread’s herdr state', () => {
    const joins = { joined: ['a1'], push: [] as string[], waiting: ['a2'] };
    test('joined once the turn that took it completed', () => {
        expect(joinStatus(joins, 'a1', 0, 1000)).toBe('joined');
    });
    test('still waiting while the thread lists it', () => {
        expect(joinStatus(joins, 'a2', 0, JOIN_TAKE_MS + 1)).toBe('waiting');
    });
    test('pending until the state lists it', () => {
        expect(joinStatus(joins, 'a3', 0, 1000)).toBe('pending');
    });
    test('listed nowhere 60 s after the write: not taken', () => {
        expect(joinStatus(joins, 'a3', 0, JOIN_TAKE_MS)).toBe('not taken');
        expect(joinStatus(undefined, 'a3', 0, JOIN_TAKE_MS)).toBe('not taken');
    });
});

describe('a hold on send: a bar fills over 1 s and pushes; a release before joins; a cut hold does nothing', () => {
    const pressed = holdSend(null, 'press', 1000);
    test('held to 1 s, it pushes once, the bar full', () => {
        const half = holdSend(
            pressed.hold,
            'tick',
            1000 + HOLD_DELAY_MS + HOLD_PUSH_MS / 2,
        );
        expect(half).toEqual({ act: null, fill: 0.5, hold: pressed.hold });
        const full = holdSend(
            half.hold,
            'tick',
            1000 + HOLD_DELAY_MS + HOLD_PUSH_MS,
        );
        expect(full.act).toBe('push');
        expect(full.hold).toBeNull();
        expect(
            holdSend(
                full.hold,
                'release',
                1000 + HOLD_DELAY_MS + HOLD_PUSH_MS + 50,
            ).act,
        ).toBeNull();
    });
    test('a tap shows no fill: the disc waits out a short delay first', () => {
        expect(holdSend(pressed.hold, 'tick', 1000 + HOLD_DELAY_MS).fill).toBe(
            0,
        );
    });
    test('a tap, let go before the disc starts, joins', () => {
        expect(
            holdSend(pressed.hold, 'release', 1000 + HOLD_DELAY_MS - 1),
        ).toEqual({ act: 'join', fill: 0, hold: null });
    });
    test('let go once the disc started filling, before it is full: nothing is sent, nothing marked', () => {
        expect(
            holdSend(pressed.hold, 'release', 1000 + HOLD_DELAY_MS + 1),
        ).toEqual({ act: null, fill: 0, hold: null });
    });
    test('cut by focus loss, a blur or a cancelled press: nothing written, the bar resets', () => {
        expect(
            holdSend(pressed.hold, 'cancel', 1000 + HOLD_PUSH_MS - 1),
        ).toEqual({
            act: null,
            fill: 0,
            hold: null,
        });
    });
});

describe('a send that cannot join pushes, and the button says why', () => {
    const joins = {
        joined: [] as string[],
        push: [] as string[],
        waiting: [] as string[],
    };
    test('a slash command pushes', () => {
        expect(pushReason('/compact', joins)).toBe(
            'Sent: a slash command starts a turn',
        );
    });
    test('the join queue switched off pushes', () => {
        expect(pushReason('ship it', null)).toBe(
            'Sent: joins are off for this thread',
        );
    });
    test('plain words with the queue on join, nothing said', () => {
        expect(pushReason('ship it', joins)).toBeNull();
    });
});

describe('an ended thread hands its unjoined rows back: each comes to the quill once, in send order', () => {
    const back =
        '{"id":"b1","text":"first"}\n{"id":"b2","text":"second"}\n{"id":"b1","text":"a copy"}\n{"id":"b3","text":" "}\nnot json\n';
    test('the rows not yet taken, in the order he sent them', () => {
        expect(backTexts(back, [])).toEqual({
            ids: ['b1', 'b2'],
            texts: ['first', 'second'],
        });
    });
    test('a row already brought back never comes again', () => {
        expect(backTexts(back, ['b1'])).toEqual({
            ids: ['b2'],
            texts: ['second'],
        });
        expect(backTexts(back, ['b1', 'b2'])).toEqual({ ids: [], texts: [] });
    });
});

describe('a held Enter or cmd-enter: key repeat after the push neither joins nor pushes again', () => {
    test('a tick or a release after the push does nothing', () => {
        const pressed = holdSend(null, 'press', 0);
        const pushed = holdSend(
            pressed.hold,
            'tick',
            HOLD_DELAY_MS + HOLD_PUSH_MS,
        );
        expect([
            pushed.act,
            holdSend(pushed.hold, 'tick', HOLD_DELAY_MS + HOLD_PUSH_MS + 15)
                .act,
            holdSend(pushed.hold, 'release', HOLD_DELAY_MS + HOLD_PUSH_MS + 90)
                .act,
        ]).toEqual(['push', null, null]);
    });
});

describe('a waiting join taken back: its row leaves the file, the others stay as written', () => {
    test('only that id goes', () => {
        expect(
            dropJoin(
                '{"id":"a1","text":"one"}\n{"id":"a2","text":"two"}\nnot json\n',
                'a1',
            ),
        ).toBe('{"id":"a2","text":"two"}\nnot json\n');
    });
    test('an id not in the file changes nothing', () => {
        expect(dropJoin('{"id":"a2","text":"two"}\n', 'a1')).toBe(
            '{"id":"a2","text":"two"}\n',
        );
    });
});

describe('the × on a waiting join takes it back under the lock', () => {
    test('its row leaves the join file, the lock let go', async () => {
        const { files, io, locks } = fakeIo();
        await appendJoin(io, '/j/s1.jsonl', 'a1', 'one');
        await appendJoin(io, '/j/s1.jsonl', 'a2', 'two');
        expect(await takeBackJoin(io, '/j/s1.jsonl', 'a1')).toBe(true);
        expect([files.get('/j/s1.jsonl'), locks.size]).toEqual([
            '{"id":"a2","text":"two"}\n',
            0,
        ]);
    });
});

describe('a join the thread took shows in the chat as his own message, read off its transcript', () => {
    const entry = (lines: string[]) => ({
        attachment: {
            content: ['now 19:23 UTC+2', ...lines],
            hookEvent: 'PostToolUse',
            type: 'hook_additional_context',
        },
        type: 'attachment',
    });
    test('one join, its lines kept', () => {
        expect(
            joinedTexts(
                entry([
                    '💨 dima wrote this in herdr while you worked; it joins this turn as his own words:\n«buttn run away fyi:\n/Users/dima/shot.png»',
                ]),
            ),
        ).toEqual(['buttn run away fyi:\n/Users/dima/shot.png']);
    });
    test('several joins in one turn, in order', () => {
        expect(
            joinedTexts(
                entry([
                    '💨 dima wrote these 2, in order, in herdr while you worked; it joins this turn as his own words:\n«say the word alpha»\n«then say the word beta»',
                ]),
            ),
        ).toEqual(['say the word alpha', 'then say the word beta']);
    });
    test('any other context line or record is none', () => {
        expect(joinedTexts(entry(['orbit holds no open ask']))).toEqual([]);
        expect(joinedTexts({ type: 'user' })).toEqual([]);
    });
});

describe('words typed after the click ride the same join until a turn takes it', () => {
    test('the row keeps its id and place, its text replaced', async () => {
        const { files, io, locks } = fakeIo();
        await appendJoin(io, '/j/s1.jsonl', 'a1', 'one');
        await appendJoin(io, '/j/s1.jsonl', 'a2', 'two');
        expect(await retextJoin(io, '/j/s1.jsonl', 'a1', 'one, and more')).toBe(
            true,
        );
        expect([files.get('/j/s1.jsonl'), locks.size]).toEqual([
            '{"id":"a1","text":"one, and more"}\n{"id":"a2","text":"two"}\n',
            0,
        ]);
    });
});
