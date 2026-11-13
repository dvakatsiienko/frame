import { describe, expect, test } from 'vitest';

import {
    type Ask,
    THREADS_BEAT_MS,
    askLabel,
    asksOf,
    byName,
    canTakeBack,
    hasSteerBox,
    hotOf,
    hotPressLine,
    hotPresses,
    inListOrder,
    literalAngles,
    nextThreads,
    pendingPresses,
    phasesOf,
    pressLabel,
    psStartArgs,
    runningThreads,
    savePress,
    stateOfPid,
    threadFacts,
    tickAll,
    tickAllTakes,
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

describe('threads sort by the words of their name', () => {
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

describe('the deck publishes each thread its three facts', () => {
    const row = (pid: number, status: string, wait: string | null) => ({
        context: 40,
        pid,
        status,
        wait,
    });

    test('an idle thread keeps its waiting-on line', () => {
        expect(waitOf('idle', 'waiting on 🦉 clio')).toBe('waiting on 🦉 clio');
    });

    test('each live thread gets its context, its waiting-on line and the week, keyed by pid', () => {
        expect(threadFacts([row(7, 'idle', 'waiting on 🦉 clio')], 57)).toEqual(
            {
                '7': { context: 40, wait: 'waiting on 🦉 clio', week: 57 },
            },
        );
    });

    test('a bold name in the waiting-on line arrives plain', () => {
        expect(
            threadFacts([row(7, 'idle', 'waiting on **🦉 clio**')], 57)['7']
                ?.wait,
        ).toBe('waiting on 🦉 clio');
    });

    test('a thread blocked on a prompt or in an unknown state shows no waiting-on line', () => {
        expect(waitOf('blocked', 'waiting on 🦉 clio')).toBeNull();
        expect(waitOf('shell', 'waiting on 🦉 clio')).toBeNull();
    });

    test('a thread mid-turn shows no waiting-on line, its last one is old', () => {
        expect(waitOf('busy', 'waiting on 🦉 clio')).toBeNull();
    });

    test('a thread with no context read yet carries none, never a guess', () => {
        expect(
            threadFacts([{ ...row(7, 'idle', null), context: null }], null)[
                '7'
            ],
        ).toEqual({
            context: null,
            wait: null,
            week: null,
        });
    });

    test('unchanged facts are not written again before the beat', () => {
        const threads = threadFacts([row(7, 'idle', null)], 57);
        expect(
            nextThreads(
                { at: 1000, threads },
                threads,
                1000 + THREADS_BEAT_MS - 1,
            ),
        ).toBeNull();
    });

    test('unchanged facts are written again at the beat, with a new time', () => {
        const threads = threadFacts([row(7, 'idle', null)], 57);
        expect(
            nextThreads({ at: 1000, threads }, threads, 1000 + THREADS_BEAT_MS),
        ).toEqual({
            at: 1000 + THREADS_BEAT_MS,
            threads,
        });
    });

    test('a changed fact is written at once', () => {
        const before = threadFacts([row(7, 'idle', null)], 57);
        const after = threadFacts([row(7, 'idle', 'waiting on 🙋‍♂️ dima')], 57);
        expect(nextThreads({ at: 1000, threads: before }, after, 1001)).toEqual(
            {
                at: 1001,
                threads: after,
            },
        );
    });

    test('the first read is always written', () => {
        expect(nextThreads(null, {}, 5)).toEqual({ at: 5, threads: {} });
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

    test('an untick on its way to the stash draws open, with its tick button', () => {
        expect(tickState({ ...ask, mark: 'accepted' }, 'untick')).toBe('open');
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

describe('his second click writes the door that still reaches the thread', () => {
    test('a press the stash has not read leaves the file', () => {
        expect(untickDoor('tick')).toBe('drop');
    });

    test('a press the stash has read gets an untick line', () => {
        expect(untickDoor(null)).toBe('untick');
    });

    test('a press still in the file but marked by the stash gets an untick line', () => {
        expect(untickDoor('tick', 'accepted')).toBe('untick');
    });
});

describe('a tick after an untick (dima, 14:51: «the very next tick lands»)', () => {
    test('an unticked ask draws its steer box though the stash still holds the tick mark', () => {
        expect(hasSteerBox({ ...ask, mark: 'accepted' }, 'untick')).toBe(true);
    });

    test('a ticked ask has no steer box', () => {
        expect(hasSteerBox({ ...ask, mark: 'accepted' }, null)).toBe(false);
    });

    test('a tick pressed after an untick is a new press line, never a drop of the old ones', () => {
        const text = [
            JSON.stringify({ at: 2, id: 'o5', verdict: 'tick' }),
            JSON.stringify({ at: 3, id: 'o5', verdict: 'untick' }),
        ].join('\n');
        const next = withPress(
            text,
            { at: 4, id: 'o5', text: 'x', verdict: 'tick' },
            1,
        );
        expect(pendingPresses(next, 1).get('o5')).toBe('tick');
    });
});

describe('an ask id names its thread (crow, 15:03: o8 lived in main and in wing 1)', () => {
    test('main clio keeps the bare id', () => {
        expect(askLabel('🦉 clio', 'o8')).toBe('o8');
    });

    test('a wing prefixes its number', () => {
        expect(askLabel('🦉🪽 clio: wing 1', 'o8')).toBe('w1·o8');
    });

    test('any other thread prefixes its name', () => {
        expect(askLabel('⚡ 🔧 codie: herdr lane | FRM-573', 'o1')).toBe(
            'codie·o1',
        );
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

// FRM-570: a crashed bg session leaves the deck at the next refresh, not when some session rewrites the store
describe('runningThreads: a row stays only while its own process runs (FRM-601)', () => {
    const at = 'Fri Nov 13 12:56:27 2026';
    const threads = [
        { pid: 101, procStart: at },
        { pid: 202, procStart: at },
        { pid: 303 },
    ];
    const pids = (out: string | null) =>
        runningThreads(threads, out)?.map((t) => t.pid) ?? null;

    test('a live idle thread stays, its start time matching', () => {
        expect(pids(`  101 ${at}\n  303 ${at}\n`)).toEqual([101, 303]);
    });

    test('a thread whose process ended leaves', () => {
        expect(pids(`  303 ${at}\n`)).toEqual([303]);
        expect(pids('')).toEqual([]);
    });

    test('a pid reused by another process leaves', () => {
        expect(pids(`  101 Fri Nov 13 14:59:01 2026\n  202 ${at}\n`)).toEqual([
            202,
        ]);
    });

    test('ps padding a one-digit day still matches', () => {
        const rows = [{ pid: 7, procStart: 'Mon Nov 3 09:00:00 2026' }];
        expect(
            runningThreads(rows, '    7 Mon Nov  3 09:00:00 2026\n')?.length,
        ).toBe(1);
    });

    test("ps reads start times in utc and the c locale, the store's own form", () => {
        expect(psStartArgs([101, 202])).toEqual([
            'LC_ALL=C',
            'TZ=UTC',
            'ps',
            '-o',
            'pid=,lstart=',
            '-p',
            '101,202',
        ]);
    });

    test('no answer from ps lists nothing new: the deck keeps its last rows', () => {
        expect(pids(null)).toBeNull();
    });
});

describe('a replay can be taken back until a turn takes it (PK-386, dima 14:54)', () => {
    test('a replay, sent or read by the stash, takes the second click', () => {
        expect(canTakeBack(tickState(ask, 'replay'))).toBe(true);
        expect(canTakeBack(tickState({ ...ask, mark: 'rejected' }, null))).toBe(
            true,
        );
    });

    test('a tick still does, an open or a locked ask does not', () => {
        expect(canTakeBack('ticked')).toBe(true);
        expect(canTakeBack('open')).toBe(false);
        expect(canTakeBack('locked')).toBe(false);
    });

    test('a replay the stash has not read leaves the file', () => {
        expect(untickDoor('replay')).toBe('drop');
        expect(untickDoor('replay', 'rejected')).toBe('untick');
    });

    test('an untick on a read replay draws open', () => {
        expect(tickState({ ...ask, mark: 'rejected' }, 'untick')).toBe('open');
    });

    test('the pressed button reads 📥, the other keeps its emoji', () => {
        expect(pressLabel('open')).toEqual({ replay: '🔁', tick: '🛎️' });
        expect(pressLabel('ticked')).toEqual({ replay: '🔁', tick: '📥' });
        expect(pressLabel('replayed')).toEqual({ replay: '📥', tick: '🛎️' });
    });
});

describe("«tick all» ticks one thread's open asks (FRM-589)", () => {
    const open = (id: string, isGated = false): Ask => ({
        ...ask,
        id,
        isGated,
        text: `ask ${id}`,
    });
    function shelf(files: Record<string, string | null>) {
        return {
            read: async (path: string) => files[path] ?? null,
            write: async (path: string, text: string) => {
                files[path] = text;
                return null;
            },
        };
    }
    const none = () => undefined;
    const lines = (text: string | null | undefined) =>
        (text ?? '')
            .trimEnd()
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l));

    test("a press on A writes three tick lines in A's file, B's file unchanged", async () => {
        const files: Record<string, string | null> = { 't/B.jsonl': 'b\n' };
        const rows = [
            { asks: [open('o1'), open('o2')], sid: 'B', taken: 0 },
            { asks: [open('o1'), open('o2'), open('o3')], sid: 'A', taken: 0 },
        ];
        await tickAll(shelf(files), 't', rows, 'A', none, none, 7);
        expect(lines(files['t/A.jsonl'])).toEqual(
            ['o1', 'o2', 'o3'].map((id, i) => ({
                at: 7 + i,
                id,
                text: `ask ${id}`,
                verdict: 'tick',
            })),
        );
        expect(files['t/B.jsonl']).toBe('b\n');
    });

    test('a gated ask stays open: only the two others are ticked', async () => {
        const files: Record<string, string | null> = {};
        const rows = [
            {
                asks: [open('o1'), open('o2', true), open('o3')],
                sid: 'A',
                taken: 0,
            },
        ];
        const ticked = await tickAll(
            shelf(files),
            't',
            rows,
            'A',
            none,
            none,
            1,
        );
        expect(ticked.map((a) => a.id)).toEqual(['o1', 'o3']);
        expect(lines(files['t/A.jsonl']).map((p) => p.id)).toEqual([
            'o1',
            'o3',
        ]);
    });

    test('an ask already ticked or replayed is left as it is', () => {
        const sent = new Map([
            ['o1', 'tick' as const],
            ['o2', 'replay' as const],
        ]);
        const asks = [open('o1'), open('o2'), open('o3')];
        expect(
            tickAllTakes(asks, (id) => sent.get(id)).map((a) => a.id),
        ).toEqual(['o3']);
    });

    test("a steer typed in an ask's box rides its tick", async () => {
        const files: Record<string, string | null> = {};
        const rows = [{ asks: [open('o1')], sid: 'A', taken: 0 }];
        await tickAll(shelf(files), 't', rows, 'A', none, () => ' go b ', 1);
        expect(lines(files['t/A.jsonl'])[0].steer).toBe('go b');
    });

    test('a thread with no open ask writes nothing', async () => {
        const files: Record<string, string | null> = {};
        const rows = [{ asks: [open('o1', true)], sid: 'A', taken: 0 }];
        expect(
            await tickAll(shelf(files), 't', rows, 'A', none, none, 1),
        ).toEqual([]);
        expect(
            await tickAll(shelf(files), 't', rows, 'Z', none, none, 1),
        ).toEqual([]);
        expect(files).toEqual({});
    });
});
