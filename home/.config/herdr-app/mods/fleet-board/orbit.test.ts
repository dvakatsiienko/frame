import { describe, expect, test } from 'vitest';

import { type Ask, asksOf, phasesOf, savePress, withPress } from './orbit.js';

const SID = 's1';
const ask: Ask = {
    id: 'o1',
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

    test('a resolved ask, gone from the store, leaves the panel', () => {
        expect(asksOf({}, SID)).toEqual([]);
    });

    test('an entry from before items carried ids shows its text with no id to press', () => {
        expect(
            asksOf({ [`asks:${SID}`]: { asks: ['push FRM-1'] } }, SID),
        ).toEqual([
            {
                id: null,
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

describe('a press lands as one line of the ticks file', () => {
    test('a steer with quotes and a newline stays one valid line', () => {
        const text = withPress(
            null,
            { at: 1, id: 'o1', steer: 'say "hi"\nthen go', verdict: 'replay' },
            ['o1'],
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

    test("a gone ask's lines are pruned, an open one's kept", () => {
        const before = withPress(null, { at: 1, id: 'o1', verdict: 'tick' }, [
            'o1',
        ]);
        const both = withPress(before, { at: 2, id: 'o2', verdict: 'tick' }, [
            'o1',
            'o2',
        ]);
        expect(
            withPress(both, { at: 3, id: 'o3', verdict: 'tick' }, ['o2', 'o3']),
        ).toBe(
            '{"at":2,"id":"o2","verdict":"tick"}\n{"at":3,"id":"o3","verdict":"tick"}\n',
        );
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
            ['o1', 'o2'],
        );
        expect(file.text).toBe(`${fresh}{"at":6,"id":"o1","verdict":"tick"}\n`);
    });

    test('a second stale write is thrown, the file left as the peer wrote it', async () => {
        const file: { text: string | null } = { text: null };
        const press = savePress(
            staleIo(file, ['a\n', 'b\n']),
            'f',
            { at: 6, id: 'o1', verdict: 'tick' },
            ['o1'],
        );
        await expect(press).rejects.toThrow('stale snapshot');
        expect(file.text).toBe('b\n');
    });
});
