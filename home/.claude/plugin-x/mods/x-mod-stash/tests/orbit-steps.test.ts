import { expect, test } from 'claude-code/testing';

import { isFresh, lockJoined, orbitOp, turnEnded } from '../hooks/orbit.ts';
import type { OrbitAsk, StashOrbit } from '../types/stash.d.ts';

const ask = (id: string, more: Partial<OrbitAsk> = {}): OrbitAsk => ({
    id,
    pick: 'p',
    text: `ask ${id}`,
    ...more,
});
const orbitOf = (more: Partial<StashOrbit> = {}): StashOrbit => ({
    asks: [],
    next: 1,
    turns: 0,
    ...more,
});

test('only a marked ask no turn took is fresh', () => {
    expect(
        [
            ask('o1', { mark: 'accepted' }),
            ask('o2'),
            ask('o3', { isLocked: true, mark: 'accepted' }),
            ask('o4', { isResolved: true, mark: 'rejected' }),
        ]
            .filter(isFresh)
            .map((a) => a.id),
    ).toEqual(['o1']);
});

test('a joined ask is locked and its wake time spent, the others stay as they were', () => {
    const taken = ask('o1', { mark: 'accepted', markedAt: 5 });
    const left = ask('o2', { mark: 'rejected', markedAt: 6 });
    const joined = lockJoined(orbitOf({ asks: [taken, left] }), [taken]);
    expect(joined.asks).toEqual([
        { ...taken, isLocked: true, markedAt: undefined },
        left,
    ]);
});

test('a turn end drops the answered asks and unlocks the rest', () => {
    const ended = turnEnded(
        orbitOf({
            asks: [
                ask('o1', { isResolved: true }),
                ask('o2', { isLocked: true, mark: 'accepted' }),
            ],
            turns: 4,
        }),
    );
    expect(ended.asks.map((a) => [a.id, a.isLocked])).toEqual([['o2', false]]);
    expect(ended.turns).toBe(5);
});

test('an unmarked assumption leaves at its third turn end, one sent back stays', () => {
    const at = (turns: number) =>
        turnEnded(
            orbitOf({
                assumed: [
                    { at: 1, id: 'a1', text: 'x' },
                    { at: 1, id: 'a2', isWrong: true, text: 'y' },
                ],
                turns,
            }),
        ).assumed?.map((x) => x.id);
    // made mid-turn at turns 0, so born at 1: the end of its own turn and the next keep it, the third drops it
    expect(at(0)).toEqual(['a1', 'a2']);
    expect(at(1)).toEqual(['a1', 'a2']);
    expect(at(2)).toEqual(['a2']);
});

test('an unknown op is told every op the tool takes', () => {
    expect(orbitOp(orbitOf(), { op: 'nope' }, false)).toEqual({
        deny: 'orbit: op is add, assume, resolve, follow, plan or glide, got «nope»',
    });
});
