import { describe, expect, test } from 'vitest';

import {
    type Ask,
    SEATS_BEAT_MS,
    asksOf,
    byName,
    currentSid,
    literalAngles,
    nextSeats,
    pendingPresses,
    phasesOf,
    runningPids,
    savePress,
    seatFacts,
    unbold,
    waitOf,
    withPress,
    withoutPress,
} from './orbit.js';

const SID = 's1';
const ask: Ask = {
    id: 'o1',
    isGated: false,
    isLocked: false,
    mark: null,
    pick: 'yes',
    text: 'push FRM-1',
};

describe('the panel reads what the stash stores', () => {
    test('an open ask shows with its id, text and pick', () => {
        const store = {
            [`asks:${SID}`]: {
                asks: ['push FRM-1'],
                items: [{ id: 'o1', pick: 'yes', text: 'push FRM-1' }],
            },
        };
        expect(asksOf(store, SID)).toEqual([ask]);
    });

    test('an ask the stash marked gated carries its mark, a plain one none', () => {
        const store = {
            [`asks:${SID}`]: {
                items: [
                    { id: 'o1', isGated: true, text: '⚠️ merge #9' },
                    { id: 'o2', text: 'push FRM-1' },
                ],
            },
        };
        expect(asksOf(store, SID).map((a) => a.isGated)).toEqual([true, false]);
    });

    test('an entry from before items carried ids shows its text with no id to press', () => {
        expect(
            asksOf({ [`asks:${SID}`]: { asks: ['push FRM-1'] } }, SID),
        ).toEqual([
            {
                id: null,
                isGated: false,
                isLocked: false,
                mark: null,
                pick: null,
                text: 'push FRM-1',
            },
        ]);
    });

    test('the phases come from the orbit the stash kept', () => {
        const store = {
            [`kept:${SID}`]: {
                orbit: {
                    asks: [] as string[],
                    plan: { lines: ['now: a', 'next: b'] },
                },
            },
        };
        expect(phasesOf(store, SID)).toEqual(['now: a', 'next: b']);
    });
});

describe('a card sits on a live session id', () => {
    test('a cleared session follows its succ chain to the id it went on as', () => {
        const store = { 'succ:a': { sid: 'b' }, 'succ:b': { sid: 'c' } };
        expect(currentSid(store, 'a')).toBe('c');
    });

    test('a succ loop stops at the last new id', () => {
        expect(
            currentSid({ 'succ:a': { sid: 'b' }, 'succ:b': { sid: 'a' } }, 'a'),
        ).toBe('b');
    });

    test('only the pids ps printed count as running', () => {
        expect([...runningPids(' 3308\n  412\n\n')]).toEqual([3308, 412]);
    });
});

describe('a press lands as one line of the ticks file', () => {
    test('a steer with quotes and a newline stays one valid line', () => {
        const text = withPress(
            null,
            { at: 1, id: 'o1', steer: 'say "hi"\nthen go', verdict: 'replay' },
            0,
        );
        expect(
            text
                .trimEnd()
                .split('\n')
                .map((l) => JSON.parse(l)),
        ).toEqual([
            { at: 1, id: 'o1', steer: 'say "hi"\nthen go', verdict: 'replay' },
        ]);
    });

    test('a line the stash already took is pruned, an untaken one kept', () => {
        const both =
            '{"at":1,"id":"o1","verdict":"tick"}\n{"at":2,"id":"o2","verdict":"tick"}\n';
        expect(withPress(both, { at: 3, id: 'o3', verdict: 'tick' }, 1)).toBe(
            '{"at":2,"id":"o2","verdict":"tick"}\n{"at":3,"id":"o3","verdict":"tick"}\n',
        );
    });

    test("a press stamped at or below the file's newest line lands above it, so the stash still reads it", () => {
        const before = '{"at":160,"id":"o2","verdict":"tick"}\n';
        const text = withPress(
            before,
            { at: 150, id: 'o1', verdict: 'tick' },
            0,
        );
        expect(JSON.parse(text.trimEnd().split('\n')[1] ?? '').at).toBe(161);
    });

    // herdr's writeTextFile refuses a write whose expected text is stale; this io holds that rule
    function staleIo(file: { text: string | null }, peerWrites: string[]) {
        return {
            read: async (): Promise<string | null> => file.text,
            write: async (
                _path: string,
                text: string,
                expected: string | null,
            ): Promise<null> => {
                const peer = peerWrites.shift();
                if (peer !== undefined) file.text = peer;
                if (expected !== file.text) throw new Error('stale snapshot');
                file.text = text;
                return null;
            },
        };
    }

    test('a stale write is refused, then written over the fresh text, never merged over it', async () => {
        const fresh = '{"at":5,"id":"o2","verdict":"tick"}\n';
        const file: { text: string | null } = { text: null };
        await savePress(
            staleIo(file, [fresh]),
            'f',
            { at: 6, id: 'o1', verdict: 'tick' },
            0,
        );
        expect(file.text).toBe(`${fresh}{"at":6,"id":"o1","verdict":"tick"}\n`);
    });

    test('a second stale write is thrown, the file left as the peer wrote it', async () => {
        const file: { text: string | null } = { text: null };
        const press = savePress(
            staleIo(file, ['a\n', 'b\n']),
            'f',
            { at: 6, id: 'o1', verdict: 'tick' },
            0,
        );
        await expect(press).rejects.toThrow('stale snapshot');
        expect(file.text).toBe('b\n');
    });
});

describe('a second click unticks a plain ask the session has not taken', () => {
    test('a press the stash has not taken reads as pressed, a taken one does not', () => {
        const text =
            '{"at":5,"id":"o2","verdict":"tick"}\n{"at":9,"id":"o1","verdict":"replay"}\nnot json\n';
        expect([...pendingPresses(text, 5)]).toEqual([['o1', 'replay']]);
    });

    test("the ask's untaken press leaves, another ask's stays", () => {
        const text =
            '{"at":5,"id":"o1","verdict":"tick"}\n{"at":6,"id":"o2","verdict":"tick"}\n';
        expect(withoutPress(text, 'o1', 0)).toBe(
            '{"at":6,"id":"o2","verdict":"tick"}\n',
        );
    });

    test('lines the stash already took are pruned with it', () => {
        const text =
            '{"at":5,"id":"o2","verdict":"tick"}\n{"at":9,"id":"o1","verdict":"tick"}\n';
        expect(withoutPress(text, 'o1', 5)).toBe('');
    });

    test('no file yet is an empty file', () => {
        expect(withoutPress(null, 'o1', 0)).toBe('');
    });
});

describe('ask text draws as typed', () => {
    test('angle brackets outside code survive markdown', () => {
        expect(literalAngles('prefills «ok <target>»')).toBe(
            'prefills «ok \\<target>»',
        );
    });

    test('angle brackets inside a code span stay as written', () => {
        expect(literalAngles('run `x lane commit <msg>` now')).toBe(
            'run `x lane commit <msg>` now',
        );
    });
});

describe('a plain one-line label', () => {
    test('a bold name shows without its stars', () => {
        expect(unbold('waiting on **🙋 dima**, **🔧 codie** (mods)')).toBe(
            'waiting on 🙋 dima, 🔧 codie (mods)',
        );
    });
});

describe('seats sort by the words of their name', () => {
    test('a leading badge never decides the order', () => {
        const names = [
            '🎀 helga',
            '🐦 ⬛ crow',
            '🦉 clio',
            '🦉🪽 clio: wing 1',
            '⚡ 🔧 codie: mods lane | PK-363',
        ];
        expect(names.sort(byName)).toEqual([
            '🦉 clio',
            '🦉🪽 clio: wing 1',
            '⚡ 🔧 codie: mods lane | PK-363',
            '🐦 ⬛ crow',
            '🎀 helga',
        ]);
    });

    test('a name with no badge sorts among them', () => {
        expect(['🦉 clio', 'bob'].sort(byName)).toEqual(['bob', '🦉 clio']);
    });
});

describe('the deck publishes each seat its three facts', () => {
    const row = (pid: number, status: string, wait: string | null) => ({
        context: 40,
        pid,
        status,
        wait,
    });

    test('an idle seat keeps its waiting-on line', () => {
        expect(waitOf('idle', 'waiting on 🦉 clio')).toBe('waiting on 🦉 clio');
    });

    test('each live seat gets its context, its waiting-on line and the week, keyed by pid', () => {
        expect(seatFacts([row(7, 'idle', 'waiting on 🦉 clio')], 57)).toEqual({
            '7': { context: 40, wait: 'waiting on 🦉 clio', week: 57 },
        });
    });

    test('a bold name in the waiting-on line arrives plain', () => {
        expect(
            seatFacts([row(7, 'idle', 'waiting on **🦉 clio**')], 57)['7']
                ?.wait,
        ).toBe('waiting on 🦉 clio');
    });

    test('a seat blocked on a prompt or in an unknown state shows no waiting-on line', () => {
        expect(waitOf('blocked', 'waiting on 🦉 clio')).toBeNull();
        expect(waitOf('shell', 'waiting on 🦉 clio')).toBeNull();
    });

    test('a seat mid-turn shows no waiting-on line, its last one is old', () => {
        expect(waitOf('busy', 'waiting on 🦉 clio')).toBeNull();
    });

    test('a seat with no context read yet carries none, never a guess', () => {
        expect(
            seatFacts([{ ...row(7, 'idle', null), context: null }], null)['7'],
        ).toEqual({
            context: null,
            wait: null,
            week: null,
        });
    });

    test('unchanged facts are not written again before the beat', () => {
        const seats = seatFacts([row(7, 'idle', null)], 57);
        expect(
            nextSeats({ at: 1000, seats }, seats, 1000 + SEATS_BEAT_MS - 1),
        ).toBeNull();
    });

    test('unchanged facts are written again at the beat, with a new time', () => {
        const seats = seatFacts([row(7, 'idle', null)], 57);
        expect(
            nextSeats({ at: 1000, seats }, seats, 1000 + SEATS_BEAT_MS),
        ).toEqual({
            at: 1000 + SEATS_BEAT_MS,
            seats,
        });
    });

    test('a changed fact is written at once', () => {
        const before = seatFacts([row(7, 'idle', null)], 57);
        const after = seatFacts([row(7, 'idle', 'waiting on 🙋‍♂️ dima')], 57);
        expect(nextSeats({ at: 1000, seats: before }, after, 1001)).toEqual({
            at: 1001,
            seats: after,
        });
    });

    test('the first read is always written', () => {
        expect(nextSeats(null, {}, 5)).toEqual({ at: 5, seats: {} });
    });
});
