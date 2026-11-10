import { describe, expect, test } from 'vitest';

import {
    type Ask,
    asksOf,
    currentSid,
    draftOf,
    isBoardOpen,
    isGuardGated,
    literalAngles,
    phasesOf,
    runningPids,
    savePress,
    withPress,
} from './orbit.js';

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

describe('an ask the guard reads takes its tick on the desktop', () => {
    test.each([
        '✍️ sign FRM-552: orbit works in herdr',
        '⚠️ push the backup mirror',
        'merge #150 now that ci is green',
        'land https://github.com/x/y/pull/9',
        'run `git push --mirror origin`',
    ])('%s is gated', (text) => {
        expect(isGuardGated(text)).toBe(true);
    });

    test.each([
        'FRM-505: drop its 524/529 links',
        'sign-in page: keep the old copy?',
        'emerge the two lists into one',
        'review https://github.com/o/n/pull/9?',
    ])('%s takes a herdr tick', (text) => {
        expect(isGuardGated(text)).toBe(false);
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

describe("a seat's /board is typed only into an empty prompt box", () => {
    test('an empty prompt box holds no draft', () => {
        const screen = [
            '⏺ done.',
            '',
            '─'.repeat(20),
            '❯ ',
            '─'.repeat(20),
            '  -- INSERT --',
        ].join('\n');
        expect(draftOf(screen)).toBe('');
    });

    test('a draft spanning two lines is read whole', () => {
        const screen = [
            '─'.repeat(20),
            '❯ fix the',
            '  band too',
            '─'.repeat(20),
        ].join('\n');
        expect(draftOf(screen)).toBe('fix the band too');
    });

    test('a quoted ❯ in the transcript above is not the prompt box', () => {
        const screen = [
            '❯ my last prompt',
            '⏺ reply',
            '─'.repeat(20),
            '❯ ',
            '─'.repeat(20),
        ].join('\n');
        expect(draftOf(screen)).toBe('');
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

describe("a seat's board reads open from its band", () => {
    test('a bracketed 🚦 reads open', () => {
        expect(
            isBoardOpen(' 🔭 not waiting   🐦‍🔥 🔥 [ ⏰ ] [ 💨 ] 🎛️ [ 🚦 ] [-]'),
        ).toBe(true);
    });

    test('a bare 🚦 reads closed', () => {
        expect(
            isBoardOpen(' 🔭 not waiting   🐦‍🔥 [ 🔥 ] [ ⏰ ] [ 💨 ] 🎛️ 🚦 [-]'),
        ).toBe(false);
    });
});
