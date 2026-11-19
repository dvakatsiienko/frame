import { describe, expect, test } from 'vitest';

import { createDrag } from './drag.js';

// FRM-664: one drag for the top tabs and the agents list, the research's recipe (docs/research/herdr-drag-and-drop.md)
function drag() {
    const moves: [string, number, number][] = [];
    const clicks: string[] = [];
    const d = createDrag({
        onClick: (key) => clicks.push(key),
        onMove: (key, from, to) => moves.push([key, from, to]),
    });
    return { clicks, d, moves };
}

const at = (x: number, y = 0) => ({ x, y });

describe('a press lifts, a short move stays a click', () => {
    test('a press moves idle → pressed', () => {
        const { d } = drag();
        expect(d.state().name).toBe('idle');
        d.press('a', 0, at(10));
        expect(d.state()).toMatchObject({ from: 0, key: 'a', name: 'pressed' });
    });

    test('a move under 4 px stays pressed, and its release is a click', () => {
        const { clicks, d, moves } = drag();
        d.press('a', 0, at(10));
        d.pointer(at(13, 2));
        expect(d.state().name).toBe('pressed');
        d.release();
        expect(clicks).toEqual(['a']);
        expect(moves).toEqual([]);
        expect(d.state().name).toBe('idle');
    });

    test('a move past 4 px enters dragging, with its own index as the target', () => {
        const { d } = drag();
        d.press('a', 1, at(10));
        d.pointer(at(15));
        expect(d.state()).toMatchObject({ from: 1, name: 'dragging', to: 1 });
    });

    test('a row under the pointer while dragging is the target', () => {
        const { d } = drag();
        d.press('a', 0, at(0));
        d.pointer(at(0, 20));
        expect(d.over(3)).toBe(true);
        expect(d.state()).toMatchObject({ name: 'dragging', to: 3 });
        expect(d.over(3)).toBe(false);
    });

    test('the ghost follows the pointer while dragging', () => {
        const { d } = drag();
        d.press('a', 0, at(0));
        d.pointer(at(0, 20));
        d.pointer(at(3, 50));
        expect(d.state()).toMatchObject({ pointer: at(3, 50) });
    });

    test('a row hovered before the drag starts is no target', () => {
        const { d } = drag();
        d.press('a', 0, at(0));
        expect(d.over(2)).toBe(false);
        expect(d.state().name).toBe('pressed');
    });
});

describe('a drop runs the move once', () => {
    test('a release in dragging runs the move once, then settles', () => {
        const { clicks, d, moves } = drag();
        d.press('a', 0, at(0));
        d.pointer(at(0, 40));
        d.over(2);
        d.release();
        expect(moves).toEqual([['a', 0, 2]]);
        expect(clicks).toEqual([]);
        expect(d.state()).toMatchObject({ from: 0, name: 'settling', to: 2 });
        d.release();
        expect(moves).toHaveLength(1);
    });

    test('a drop back on its own index runs no move', () => {
        const { clicks, d, moves } = drag();
        d.press('a', 2, at(0));
        d.pointer(at(0, 40));
        d.over(0);
        d.over(2);
        d.release();
        expect(moves).toEqual([]);
        expect(clicks).toEqual([]);
    });

    test('the settle ends in idle on its own token, a stale one does nothing', () => {
        const { d } = drag();
        d.press('a', 0, at(0));
        d.pointer(at(0, 40));
        d.over(1);
        d.release();
        const settling = d.state();
        if (settling.name !== 'settling') throw new Error('not settling');
        d.settled(settling.token + 1);
        expect(d.state().name).toBe('settling');
        d.settled(settling.token);
        expect(d.state().name).toBe('idle');
    });

    test('the last drop’s settle timer never ends the next drop’s settle', () => {
        const { d } = drag();
        const drop = () => {
            d.press('a', 0, at(0));
            d.pointer(at(0, 40));
            d.over(1);
            d.release();
            const s = d.state();
            if (s.name !== 'settling') throw new Error('not settling');
            return s.token;
        };
        const first = drop();
        d.cancel();
        drop();
        d.settled(first);
        expect(d.state().name).toBe('settling');
    });

    test('Escape during settling ends in idle, the move run once', () => {
        const { d, moves } = drag();
        d.press('a', 0, at(0));
        d.pointer(at(0, 40));
        d.over(1);
        d.release();
        d.cancel();
        expect(d.state().name).toBe('idle');
        expect(moves).toHaveLength(1);
    });

    test('a new press during settling ends in idle, the move run once', () => {
        const { clicks, d, moves } = drag();
        d.press('a', 0, at(0));
        d.pointer(at(0, 40));
        d.over(1);
        d.release();
        d.press('b', 1, at(0));
        expect(d.state().name).toBe('idle');
        d.release();
        expect(moves).toHaveLength(1);
        expect(clicks).toEqual([]);
    });
});

describe('Escape or leaving the list cancels with no move', () => {
    test('from pressed: idle, no move, no click', () => {
        const { clicks, d, moves } = drag();
        d.press('a', 0, at(0));
        d.cancel();
        expect(d.state().name).toBe('idle');
        d.release();
        expect(clicks).toEqual([]);
        expect(moves).toEqual([]);
    });

    test('from dragging: the ghost springs home, then idle, no move', () => {
        const { d, moves } = drag();
        d.press('a', 0, at(0));
        d.pointer(at(0, 40));
        d.over(2);
        d.cancel();
        const home = d.state();
        expect(home).toMatchObject({ from: 0, name: 'settling', to: 0 });
        if (home.name !== 'settling') throw new Error('not settling');
        d.settled(home.token);
        expect(d.state().name).toBe('idle');
        d.release();
        expect(moves).toEqual([]);
    });

    test('a pointer moving inside the list never cancels', () => {
        const { d } = drag();
        d.press('a', 0, at(0));
        for (const y of [10, -30, 200, 3, 90]) d.pointer(at(7, y));
        expect(d.state().name).toBe('dragging');
    });
});
