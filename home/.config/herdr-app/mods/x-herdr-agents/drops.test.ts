import { beforeEach, describe, expect, test, vi } from 'vitest';

const kept = vi.hoisted(() => new Map<string, unknown>());
vi.mock('herdr', () => ({
    run: vi.fn(),
    setShared: vi.fn((key: string, value: unknown) => kept.set(key, value)),
    shared: (key: string) => kept.get(key),
}));

import { run, setShared } from 'herdr';

import { createDrag } from '../_shared/drag.js';
import {
    type Dragged,
    type DropContext,
    ORDER_KEY,
    type Spot,
    drop,
    publishOrder,
    targetOf,
} from './drops.js';
import { inOrder } from './order.js';

// FRM-664: the agents list's four drags run through the shared drag, each to its own move
function list(cx: () => DropContext) {
    return createDrag<Dragged>({
        onClick: () => {},
        onMove: (item, from, to) => drop(item, from, to, cx()),
    });
}

const at = (y: number) => ({ x: 0, y });
const agent = (over: Partial<Spot & { kind: 'agent' }>): Spot => ({
    isPinned: false,
    isYours: false,
    kind: 'agent',
    machine: null,
    mineAt: -1,
    pinAt: -1,
    space: 's1',
    spaceAt: 0,
    tab: 'tab1',
    tabAt: -1,
    ...over,
});

beforeEach(() => {
    kept.clear();
    vi.mocked(run).mockClear();
    vi.mocked(setShared).mockClear();
});

describe('his own order: a drag of row 1 past row 3', () => {
    test('writes the order store once, in the new order, and the order the deck reads follows', () => {
        let order = ['t1', 't2', 't3', 't4'];
        const writes: string[][] = [];
        const cx = (): DropContext => ({
            order,
            pinned: [],
            pins: [],
            setOrder: (next) => {
                writes.push(next);
                order = next;
            },
            setPins: () => {},
        });
        const pids: Record<string, number> = { t1: 11, t2: 12, t3: 13, t4: 14 };
        const rows = [
            { address: 't1' },
            { address: 't2' },
            { address: 't3' },
            { address: 't4' },
        ];
        publishOrder(
            inOrder(rows, order).map((r) => r.address),
            (a) => pids[a],
        );
        expect(kept.get(ORDER_KEY)).toEqual([11, 12, 13, 14]);

        const d = list(cx);
        d.press('t1', { kind: 'mine' }, 0, at(0));
        d.pointer(at(70));
        d.over(targetOf({ kind: 'mine' }, agent({ isYours: true, mineAt: 2 })));
        d.release();

        expect(writes).toEqual([['t2', 't3', 't1', 't4']]);
        publishOrder(
            inOrder(rows, order).map((r) => r.address),
            (a) => pids[a],
        );
        expect(kept.get(ORDER_KEY)).toEqual([12, 13, 11, 14]);
    });

    test('a status redraw mid-drag keeps the drag and its target, and the drop reads the list as it is then', () => {
        let order = ['t1', 't2', 't3'];
        const writes: string[][] = [];
        const cx = (): DropContext => ({
            order,
            pinned: [],
            pins: [],
            setOrder: (next) => writes.push(next),
            setPins: () => {},
        });
        const d = list(cx);
        d.press('t1', { kind: 'mine' }, 0, at(0));
        d.pointer(at(70));
        d.over(2);
        // a redraw: the render builds new rows and a new context; the drag lives on the view, not in the render
        order = [...order];
        expect(d.state()).toMatchObject({ name: 'dragging', to: 2 });
        d.release();
        expect(writes).toEqual([['t2', 't3', 't1']]);
    });
});

describe('each kind drags to its own move', () => {
    test('a pin moves among the shown pins, the hidden ones keep their place at the end', () => {
        const pinsWritten: string[][] = [];
        const cx = (): DropContext => ({
            order: [],
            pinned: ['p1', 'p2', 'p3'],
            pins: ['p1', 'gone', 'p2', 'p3'],
            setOrder: () => {},
            setPins: (p) => pinsWritten.push(p),
        });
        const d = list(cx);
        d.press('p3', { kind: 'pin' }, 2, at(60));
        d.pointer(at(0));
        d.over(targetOf({ kind: 'pin' }, agent({ isPinned: true, pinAt: 0 })));
        d.release();
        expect(pinsWritten).toEqual([['p3', 'p1', 'p2', 'gone']]);
    });

    test('a tab row moves its tab within its space, 1-based', () => {
        const item: Dragged = { kind: 'tab', space: 's1', tab: 'tab1' };
        const d = list(() => ({
            order: [],
            pinned: [],
            pins: [],
            setOrder: () => {},
            setPins: () => {},
        }));
        d.press('t1', item, 0, at(0));
        d.pointer(at(70));
        d.over(targetOf(item, agent({ tab: 'tab3', tabAt: 2 })));
        d.release();
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith('tab.move', { id: 'tab1', index: 3 });
    });

    test('a space header moves the space within its machine, 1-based', () => {
        const item: Dragged = { id: 's2', kind: 'space', machine: null };
        const d = list(() => ({
            order: [],
            pinned: [],
            pins: [],
            setOrder: () => {},
            setPins: () => {},
        }));
        d.press('sp-s2', item, 1, at(40));
        d.pointer(at(0));
        d.over(targetOf(item, { kind: 'header', machine: null, spaceAt: 0 }));
        d.release();
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith('space.move', { id: 's2', index: 1 });
    });
});

describe('a spot takes only its own kind', () => {
    test('a pin never lands on an unpinned row', () => {
        expect(
            targetOf({ kind: 'pin' }, agent({ isYours: true, mineAt: 1 })),
        ).toBeNull();
    });

    test('his order never lands on a pinned row', () => {
        expect(
            targetOf(
                { kind: 'mine' },
                agent({ isPinned: true, isYours: true, mineAt: 0, pinAt: 0 }),
            ),
        ).toBeNull();
    });

    test('a tab never lands in another space', () => {
        expect(
            targetOf(
                { kind: 'tab', space: 's1', tab: 'tab1' },
                agent({ space: 's2', tab: 'tab9', tabAt: 0 }),
            ),
        ).toBeNull();
    });

    test('a space never lands on another machine', () => {
        expect(
            targetOf(
                { id: 's1', kind: 'space', machine: 'm1' },
                { kind: 'header', machine: null, spaceAt: 0 },
            ),
        ).toBeNull();
    });
});
