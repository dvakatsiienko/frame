import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { createKeyPress } from './keypress.js';
import {
    type Ask,
    SENT_MS,
    THREADS_BEAT_MS,
    askLabel,
    asksOf,
    byName,
    canTakeBack,
    createPresses,
    createSerial,
    createTurns,
    hotOf,
    hotPressLine,
    hotPresses,
    inListOrder,
    isPressSettled,
    linkOf,
    literalAngles,
    nextThreads,
    pendingPresses,
    phasesOf,
    pressLabel,
    psStartArgs,
    runningThreads,
    savePress,
    stateOfPid,
    steerKeyAct,
    steerKeyNote,
    steerKeyPress,
    threadFacts,
    tickAll,
    tickAllTakes,
    tickAllThread,
    tickState,
    unbold,
    untickDoor,
    waitOf,
    withBandPress,
    withPending,
    withPress,
    withoutPress,
} from './orbit.js';

const SID = 's1';
const ask: Ask = {
    id: 'o1',
    isGated: false,
    isLocked: false,
    link: null,
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

    test('an ask’s link comes with it: the linked look card he opens', () => {
        const state = {
            asks: [
                {
                    id: 'o2',
                    link: '/Users/dima/.local/state/looks/FRM-638/look.md',
                    text: 'look: the new chat',
                },
            ],
        };
        expect(asksOf(state)[0]?.link).toBe(
            '/Users/dima/.local/state/looks/FRM-638/look.md',
        );
    });

    test('a link that is no string is none', () => {
        const state = { asks: [{ id: 'o3', link: 7, text: 'x' }] };
        expect(asksOf(state)[0]?.link).toBeNull();
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

    test('the pressed button reads 🍕, the other keeps its emoji', () => {
        expect(pressLabel('open')).toEqual({ replay: '🔁', tick: '🛎️' });
        expect(pressLabel('ticked')).toEqual({ replay: '🔁', tick: '🍕' });
        expect(pressLabel('replayed')).toEqual({ replay: '🍕', tick: '🛎️' });
    });

    test('once delivered, the pressed button reads 😋 and both stay (dima, 21:03)', () => {
        expect(pressLabel('locked', 'accepted')).toEqual({
            replay: '🔁',
            tick: '😋',
        });
        expect(pressLabel('locked', 'rejected')).toEqual({
            replay: '😋',
            tick: '🛎️',
        });
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

describe('Enter in a steer box ticks, cmd-enter replays, each a second time takes it back (dima, 20:34)', () => {
    test('Enter ticks an open or replayed ask, and takes a tick back', () => {
        expect(steerKeyPress('open', false, false)).toBe('tick');
        expect(steerKeyPress('replayed', false, false)).toBe('tick');
        expect(steerKeyPress('ticked', false, false)).toBe('untick');
    });
    test('cmd-enter replays an open or ticked ask, and takes a replay back', () => {
        expect(steerKeyPress('open', true, false)).toBe('replay');
        expect(steerKeyPress('ticked', true, false)).toBe('replay');
        expect(steerKeyPress('replayed', true, false)).toBe('untick');
    });
    test('a key never ticks a guarded ask: that word is his click alone', () => {
        expect(steerKeyPress('open', false, true)).toBeNull();
        expect(steerKeyPress('ticked', false, true)).toBe('untick');
        expect(steerKeyPress('open', true, true)).toBe('replay');
    });
    test('a locked ask takes no key', () => {
        expect(steerKeyPress('locked', false, false)).toBeNull();
        expect(steerKeyPress('locked', true, false)).toBeNull();
    });
});

describe('a key that does nothing says why under the steer box', () => {
    test('Enter on a guarded ask: it ticks by click only', () => {
        expect(steerKeyNote('open', false, true)).toBe('Ticks by click only');
        expect(steerKeyNote('replayed', false, true)).toBe(
            'Ticks by click only',
        );
    });
    test('a key that acts says nothing', () => {
        expect(steerKeyNote('open', false, false)).toBeNull();
        expect(steerKeyNote('ticked', false, true)).toBeNull();
        expect(steerKeyNote('open', true, true)).toBeNull();
    });
    test('a locked ask stays quiet, its lock already shown', () => {
        expect(steerKeyNote('locked', false, true)).toBeNull();
    });
});

describe('a press draws as sent until the shelf agrees with it, so a fast run of presses never flips back (dima, 20:48)', () => {
    const open: Ask = { ...ask, isLocked: false, mark: null };
    test('an untick the stash has not answered yet stays drawn open', () => {
        expect(
            isPressSettled({ ...open, mark: 'accepted' }, 'tick', 'untick'),
        ).toBe(false);
    });
    test('a take-back whose file read still holds the press stays drawn open', () => {
        expect(isPressSettled(open, 'tick', 'untick')).toBe(false);
    });
    test('a tick is settled once the file or the mark shows it', () => {
        expect(isPressSettled(open, undefined, 'tick')).toBe(false);
        expect(isPressSettled(open, 'tick', 'tick')).toBe(true);
        expect(
            isPressSettled({ ...open, mark: 'accepted' }, undefined, 'tick'),
        ).toBe(true);
    });
    test('an untick is settled once nothing holds the press', () => {
        expect(isPressSettled(open, undefined, 'untick')).toBe(true);
    });
    test('a locked ask settles every press', () => {
        expect(
            isPressSettled({ ...open, isLocked: true }, undefined, 'untick'),
        ).toBe(true);
    });
});

describe('one record of his press per ask: every reader asks it, only events move it (FRM-628)', () => {
    const open: Ask = { ...ask, isLocked: false, mark: null };
    const KEY = `${SID}:o1`;
    const lookup =
        (found: Ask | undefined, pending?: 'tick' | 'replay' | 'untick') =>
        () => ({ ask: found, pending });

    test('nothing pressed: the ask shows the ticks file’s press', () => {
        expect(createPresses().of(KEY, 'tick')).toBe('tick');
    });

    test('a press he just made shows over the ticks file’s', () => {
        const presses = createPresses();
        presses.pressed(KEY, 'untick', 1_000);
        expect(presses.of(KEY, 'tick')).toBe('untick');
    });

    test('a write that failed gives the press back', () => {
        const presses = createPresses();
        presses.pressed(KEY, 'tick', 1_000);
        presses.failed(KEY, 1_000);
        expect(presses.of(KEY, undefined)).toBeUndefined();
    });

    test('a failed write never takes back a newer press', () => {
        const presses = createPresses();
        presses.pressed(KEY, 'tick', 1_000);
        presses.pressed(KEY, 'untick', 2_000);
        presses.failed(KEY, 1_000);
        expect(presses.of(KEY, undefined)).toBe('untick');
    });

    test('a press stays until the shelf draws the ask the same without it', () => {
        const presses = createPresses();
        presses.pressed(KEY, 'tick', 1_000);
        presses.settle(lookup(open, undefined), 2_000);
        expect(presses.of(KEY, undefined)).toBe('tick');
        presses.settle(lookup(open, 'tick'), 3_000);
        expect(presses.of(KEY, 'untick')).toBe('untick');
    });

    test('a press on an ask that left is dropped', () => {
        const presses = createPresses();
        presses.pressed(KEY, 'tick', 1_000);
        presses.settle(lookup(undefined), 2_000);
        expect(presses.of(KEY, undefined)).toBeUndefined();
    });

    test('a press the session never took gives the buttons back after a while', () => {
        const presses = createPresses();
        presses.pressed(KEY, 'tick', 1_000);
        presses.settle(lookup(open, undefined), 1_000 + SENT_MS - 1);
        expect(presses.of(KEY, undefined)).toBe('tick');
        presses.settle(lookup(open, undefined), 1_000 + SENT_MS + 1);
        expect(presses.of(KEY, undefined)).toBeUndefined();
    });

    test('a press given up by time is named, so the box can say so', () => {
        const presses = createPresses();
        presses.pressed(KEY, 'tick', 1_000);
        expect(
            presses.settle(lookup(open, undefined), 1_000 + SENT_MS + 1),
        ).toEqual([KEY]);
    });

    test('a press the shelf settled is never named given up', () => {
        const presses = createPresses();
        presses.pressed(KEY, 'tick', 1_000);
        expect(
            presses.settle(lookup(open, 'tick'), 1_000 + SENT_MS + 1),
        ).toEqual([]);
    });

    test('the deck merges his press with the ticks file’s only through the record', () => {
        const main = readFileSync(
            new URL('./main.js', import.meta.url),
            'utf8',
        );
        expect(main.match(/\.verdict\s*\?\?/g)).toBeNull();
    });
});

describe("a press switches over the stash's mark at once: a read tick takes cmd-enter's replay (dima, 20:59)", () => {
    test('a replay sent over an accepted mark draws replayed', () => {
        expect(
            tickState({ ...ask, isLocked: false, mark: 'accepted' }, 'replay'),
        ).toBe('replayed');
    });
    test('a tick sent over a replay mark draws ticked', () => {
        expect(
            tickState({ ...ask, isLocked: false, mark: 'rejected' }, 'tick'),
        ).toBe('ticked');
    });
    test('cmd-enter on a read tick replays', () => {
        expect(
            steerKeyPress(
                tickState(
                    { ...ask, isLocked: false, mark: 'accepted' },
                    undefined,
                ),
                true,
                false,
            ),
        ).toBe('replay');
    });
});

describe('⌘⇧K picks the asker it ticks', () => {
    const sids = ['clio', 'codie'];
    test('the asker under the pointer wins (dima, 21:42)', () => {
        expect(
            tickAllThread(sids, {
                hovered: 'codie',
                picked: 'clio',
                shown: 'clio',
            }),
        ).toBe('codie');
    });
    test('no hover: the asker he last clicked', () => {
        expect(
            tickAllThread(sids, {
                hovered: null,
                picked: 'codie',
                shown: 'clio',
            }),
        ).toBe('codie');
    });
    test('neither: the thread the chat shows', () => {
        expect(
            tickAllThread(sids, { hovered: null, picked: null, shown: 'clio' }),
        ).toBe('clio');
    });
    test('an asker whose asks left is skipped for the next', () => {
        expect(
            tickAllThread(['clio'], {
                hovered: 'gone',
                picked: null,
                shown: 'clio',
            }),
        ).toBe('clio');
        expect(
            tickAllThread([], { hovered: null, picked: null, shown: 'clio' }),
        ).toBe(null);
    });
});

describe('an ask’s link, as the card draws it', () => {
    test.each([
        ['https://github.com/a/b/pull/9', { kind: 'web', label: 'github.com' }],
        [
            '/Users/dima/.local/state/looks/FRM-638/look.md',
            { kind: 'file', label: 'look.md' },
        ],
        ['/Users/dima/look card.md', { kind: 'file', label: 'look card.md' }],
        ['obsidian://open?vault=x&file=y', { kind: 'web', label: 'obsidian' }],
        ['~/notes/a.md', { kind: 'file', label: 'a.md' }],
    ])('%s', (link, shown) => {
        expect(linkOf(link)).toEqual(shown);
    });

    test.each(['', '   ', 'just words', null])('«%s» draws no link', (link) => {
        expect(linkOf(link)).toBeNull();
    });
});

describe('a reload lands whole and alone: a ticked ask never flips back (FRM-628)', () => {
    const row = (sid: string, asks: Ask[]) => ({
        asks,
        pending: new Map(),
        sid,
        taken: 0,
    });

    test('each row comes back with its presses read before anything draws it', async () => {
        const tick = JSON.stringify({ at: 1, id: 'o1', verdict: 'tick' });
        const rows = await withPending([row(SID, [ask])], async () => tick);
        expect(rows[0]?.pending.get('o1')).toBe('tick');
    });

    test('a row with no asks reads no ticks file', async () => {
        const read: string[] = [];
        await withPending([row(SID, [])], async (sid) => {
            read.push(sid);
            return null;
        });
        expect(read).toEqual([]);
    });

    test('a reload asked for while one runs waits for it: two never overlap', async () => {
        const serial = createSerial();
        const log: string[] = [];
        let release = () => {};
        const first = serial(
            () =>
                new Promise<void>((resolve) => {
                    log.push('first starts');
                    release = () => {
                        log.push('first ends');
                        resolve();
                    };
                }),
        );
        // the first is under way, as a reload waiting on its `ps` is
        await Promise.resolve();
        const second = serial(async () => {
            log.push('second runs');
        });
        // the second has had its chance to start while the first still runs
        await new Promise((resolve) => setTimeout(resolve, 0));
        release();
        await Promise.all([first, second]);
        expect(log).toEqual(['first starts', 'first ends', 'second runs']);
    });

    test('of the reloads asked for meanwhile, only the newest runs', async () => {
        const serial = createSerial();
        const ran: string[] = [];
        let release = () => {};
        const first = serial(
            () => new Promise<void>((resolve) => (release = resolve)),
        );
        await Promise.resolve();
        const later = ['b', 'c', 'd'].map((name) =>
            serial(async () => {
                ran.push(name);
            }),
        );
        release();
        await Promise.all([first, ...later]);
        expect(ran).toEqual(['d']);
    });

    test('a reload that fails never stops the next', async () => {
        const serial = createSerial();
        const failed = serial(async () => {
            throw new Error('ps timed out');
        });
        await expect(failed).rejects.toThrow('ps timed out');
        let isRun = false;
        await serial(async () => {
            isRun = true;
        });
        expect(isRun).toBe(true);
    });
});

// FRM-628's first done test (W1): with an ask's steer box focused, Enter then ⌘Enter: Replay ticked and «ready to send»
// unticked at once, every time
describe('Enter then ⌘Enter in a steer box: the replay takes over from the tick at once (FRM-628)', () => {
    const rows = [
        {
            asks: [{ ...ask, isLocked: false, mark: null }],
            pending: new Map(),
            sid: SID,
            taken: 0,
        },
    ];
    const KEY = `${SID}:o1`;

    test('each key acts on the press the one before it made, with no shelf read between', () => {
        const presses = createPresses();
        const keys = createKeyPress();
        const pressOf = (s: (typeof rows)[number], id: string | null) =>
            presses.of(`${s.sid}:${id}`, s.pending.get(id ?? ''));
        const states: string[] = [];
        for (const [at, isCmd] of [
            [1_000, false],
            [1_090, true],
            [1_300, true],
        ] as const) {
            keys.up();
            keys.down(at, false);
            if (keys.submitted(at) === 'repeat') continue;
            const step = steerKeyAct(rows, KEY, isCmd, pressOf);
            if (step?.act) presses.pressed(KEY, step.act, at);
            states.push(tickState(rows[0]!.asks[0]!, pressOf(rows[0]!, 'o1')));
        }
        // the third: ⌘Enter again takes the replay back
        expect(states).toEqual(['ticked', 'replayed', 'open']);
    });

    test('a key in a box whose ask left does nothing', () => {
        expect(
            steerKeyAct(rows, `${SID}:gone`, false, () => undefined),
        ).toBeNull();
    });

    test('Enter on a gated ask says it ticks by click', () => {
        const gated = [
            { ...rows[0]!, asks: [{ ...rows[0]!.asks[0]!, isGated: true }] },
        ];
        expect(steerKeyAct(gated, KEY, false, () => undefined)).toMatchObject({
            act: null,
            note: 'Ticks by click only',
        });
    });
});

describe('the ticks files are written one at a time (FRM-628)', () => {
    test('a write waits for the one before it', async () => {
        const turns = createTurns();
        const log: string[] = [];
        let release = () => {};
        const first = turns(
            () =>
                new Promise<void>((resolve) => {
                    release = () => {
                        log.push('first');
                        resolve();
                    };
                }),
        );
        const second = turns(async () => {
            log.push('second');
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        release();
        await Promise.all([first, second]);
        expect(log).toEqual(['first', 'second']);
    });

    test('a write the stash slipped in front of is tried once more', async () => {
        const turns = createTurns();
        let tries = 0;
        await turns(async () => {
            tries += 1;
            if (tries === 1) throw new Error('text changed since read');
        });
        expect(tries).toBe(2);
    });

    test('a write that fails twice says so, and the next still runs', async () => {
        const turns = createTurns();
        const failed = turns(async () => {
            throw new Error('refused');
        });
        await expect(failed).rejects.toThrow('refused');
        let isRun = false;
        await turns(async () => {
            isRun = true;
        });
        expect(isRun).toBe(true);
    });
});
