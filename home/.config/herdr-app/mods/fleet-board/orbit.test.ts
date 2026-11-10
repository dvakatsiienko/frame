import { describe, expect, test } from 'vitest';

import {
    type Ask,
    SEATS_BEAT_MS,
    asksOf,
    byName,
    hotOf,
    hotPressLine,
    hotPresses,
    inListOrder,
    literalAngles,
    nextSeats,
    pendingPresses,
    phasesOf,
    runningPids,
    savePress,
    seatFacts,
    sentSteer,
    stateOfPid,
    tickState,
    unbold,
    untickDoor,
    waitOf,
    withBandPress,
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

describe('the panel reads the state file the stash writes', () => {
    test('an open ask shows with its id, text and pick', () => {
        const state = { asks: [{ id: 'o1', pick: 'yes', text: 'push FRM-1' }] };
        expect(asksOf(state)).toEqual([ask]);
    });

    test('an ask the stash marked gated carries its mark, a plain one none', () => {
        const state = {
            asks: [
                { id: 'o1', isGated: true, text: '⚠️ merge #9' },
                { id: 'o2', text: 'push FRM-1' },
            ],
        };
        expect(asksOf(state).map((a) => a.isGated)).toEqual([true, false]);
    });

    test('a session with no state file yet has no asks and no phases', () => {
        expect(asksOf(null)).toEqual([]);
        expect(phasesOf(null)).toEqual([]);
    });

    test('the phases come from the plan the stash wrote', () => {
        expect(phasesOf({ plan: { lines: ['now: a', 'next: b'] } })).toEqual([
            'now: a',
            'next: b',
        ]);
        expect(phasesOf({ plan: null })).toEqual([]);
    });
});

describe('a card finds its state file by pid', () => {
    test('after a /clear the newest file of that pid wins', () => {
        const old = { at: 1, pid: 7, sid: 'a' };
        const now = { at: 2, pid: 7, sid: 'b' };
        const other = { at: 3, pid: 8, sid: 'c' };
        expect(stateOfPid([now, other, old], 7)).toBe(now);
        expect(stateOfPid([old, now], 7)).toBe(now);
    });

    test('a pid with no state file has none', () => {
        expect(stateOfPid([{ at: 1, pid: 8, sid: 'c' }], 7)).toBeNull();
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

describe('the deck follows the agents list order', () => {
    const row = (pid: number, name: string) => ({ name, pid });

    test('rows take the order the agents list shows', () => {
        const rows = [row(1, 'a'), row(2, 'b'), row(3, 'c')];
        expect(inListOrder(rows, [3, 1, 2]).map((r) => r.pid)).toEqual([
            3, 1, 2,
        ]);
    });

    test('a row the list does not hold goes last, in the order it came', () => {
        const rows = [row(1, 'a'), row(9, 'z'), row(2, 'b'), row(8, 'y')];
        expect(inListOrder(rows, [2, 1]).map((r) => r.pid)).toEqual([
            2, 1, 9, 8,
        ]);
    });

    test('no published order keeps the rows as they came', () => {
        const rows = [row(2, 'b'), row(1, 'a')];
        expect(inListOrder(rows, null).map((r) => r.pid)).toEqual([2, 1]);
    });
});

describe('a tick locks only when a turn takes it', () => {
    test('an untaken press is ticked and can be taken back', () => {
        expect(tickState(ask, 'tick')).toBe('ticked');
    });

    test('a press the stash has read stays ticked, and can still be taken back', () => {
        expect(tickState({ ...ask, mark: 'accepted' }, null)).toBe('ticked');
    });

    test('an untick on its way to the stash reads as unticking', () => {
        expect(tickState({ ...ask, mark: 'accepted' }, 'untick')).toBe(
            'unticking',
        );
    });

    test('a locked ask is locked', () => {
        expect(
            tickState({ ...ask, isLocked: true, mark: 'accepted' }, null),
        ).toBe('locked');
    });

    test('a gated press can be taken back too', () => {
        expect(tickState({ ...ask, isGated: true }, 'tick')).toBe('ticked');
    });

    test('a locked ask ignores an untick still in the file', () => {
        expect(
            tickState({ ...ask, isLocked: true, mark: 'accepted' }, 'untick'),
        ).toBe('locked');
    });

    test('no press is open', () => {
        expect(tickState(ask, null)).toBe('open');
    });

    test('a replay reads as replayed', () => {
        expect(tickState(ask, 'replay')).toBe('replayed');
    });
});

describe('his second click writes the door that still reaches the seat', () => {
    test('a press the stash has not read leaves the file', () => {
        expect(untickDoor('tick')).toBe('drop');
    });

    test('a press the stash has read gets an untick line', () => {
        expect(untickDoor(null)).toBe('untick');
    });
});

describe('his steer stays in sight until the turn takes it', () => {
    test('a tick or a replay sent with a steer keeps the steer shown', () => {
        expect(sentSteer('ticked', 'only the docs')).toBe('only the docs');
        expect(sentSteer('replayed', 'try b')).toBe('try b');
    });

    test('the turn took it: the steer leaves with the lock', () => {
        expect(sentSteer('locked', 'only the docs')).toBeNull();
    });

    test('an open ask has its box instead, and no steer is no line', () => {
        expect(sentSteer('open', 'typing')).toBeNull();
        expect(sentSteer('ticked', '  ')).toBeNull();
    });
});

describe('a keep-hot button on each deck row (dima, 23:16)', () => {
    const now = new Date(2026, 10, 10, 23, 0).getTime();
    const since = new Date(2026, 10, 10, 22, 20).getTime();

    test('a press names its thread, the line the stash reads for that sid', () => {
        expect(hotPressLine('abc', true, now)).toEqual({
            at: now,
            button: 'hot',
            on: true,
            sid: 'abc',
        });
    });

    test('the press joins the band file after its lines, a day-old or broken line trimmed', () => {
        const day = 24 * 60 * 60 * 1000;
        const kept = JSON.stringify({ at: now - 5, button: 'afk', on: true });
        const old = JSON.stringify({
            at: now - day - 1,
            button: 'afk',
            on: true,
        });
        const line = hotPressLine('abc', false, now);
        expect(withBandPress(`${old}\n{broken\n${kept}\n`, line, now)).toBe(
            `${kept}\n${JSON.stringify(line)}\n`,
        );
    });

    test('a row reads hot from its state file, its tooltip the time it went on', () => {
        expect(hotOf({ since }, undefined, now)).toEqual({
            isOn: true,
            isPending: false,
            tip: 'keep hot: on since 22:20',
        });
        expect(hotOf(null, undefined, now)).toEqual({
            isOn: false,
            isPending: false,
            tip: 'keep hot',
        });
    });

    test('a press not answered yet draws the state it asked for, until 20 s pass', () => {
        expect(hotOf(null, { at: now - 1000, on: true }, now)).toMatchObject({
            isOn: true,
            isPending: true,
        });
        expect(hotOf(null, { at: now - 21000, on: true }, now).isOn).toBe(
            false,
        );
        expect(
            hotOf({ since }, { at: now - 1000, on: true }, now).isPending,
        ).toBe(false);
    });
});

describe('the deck follows a press made on the band (dima, 23:42)', () => {
    const now = 1_000_000;
    const file = [
        { at: now - 5000, button: 'hot', on: true, sid: 'a' },
        { at: now - 3000, button: 'hot', on: false, sid: 'a' },
        { at: now - 2000, button: 'wind', on: true, sid: 'a' },
        { at: now - 1000, button: 'hot', on: true, sid: 'b' },
    ]
        .map((l) => `${JSON.stringify(l)}\n`)
        .join('');

    test("each thread's newest hot press, from whichever band wrote it", () => {
        expect(hotPresses(file)).toEqual(
            new Map([
                ['a', { at: now - 3000, on: false }],
                ['b', { at: now - 1000, on: true }],
            ]),
        );
    });

    test('a press waits for the stash past its slow shelf write (about 16 s)', () => {
        expect(
            hotOf({ since: 1 }, { at: now - 17_000, on: false }, now).isOn,
        ).toBe(false);
    });
});
