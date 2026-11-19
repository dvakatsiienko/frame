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
    placesOf,
    publishOrder,
    shownOf,
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
const context = (over: Partial<DropContext>): DropContext => ({
    order: [],
    pins: [],
    setOrder: () => {},
    setPins: () => {},
    shownMine: [],
    shownPins: [],
    shownSpaces: [],
    shownTabs: {},
    spaceIndex: () => -1,
    tabIndex: () => -1,
    ...over,
});
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
        const cx = () =>
            context({
                order,
                setOrder: (next) => {
                    writes.push(next);
                    order = next;
                },
                shownMine: ['t1', 't2', 't3', 't4'],
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
        d.press('t1', { address: 't1', kind: 'mine' }, 0, at(0));
        d.pointer(at(70));
        d.over(
            targetOf(
                { address: 't1', kind: 'mine' },
                agent({ isYours: true, mineAt: 2 }),
            ),
        );
        d.release();

        expect(writes).toEqual([['t2', 't3', 't1', 't4']]);
        publishOrder(
            inOrder(rows, order).map((r) => r.address),
            (a) => pids[a],
        );
        expect(kept.get(ORDER_KEY)).toEqual([12, 13, 11, 14]);
    });

    test('a place counts shown rows only: a gone thread between them never shifts the drop', () => {
        const writes: string[][] = [];
        const d = list(() =>
            context({
                order: ['t1', 'gone', 't2', 't3'],
                setOrder: (next) => writes.push(next),
                shownMine: ['t1', 't2', 't3'],
            }),
        );
        d.press('t1', { address: 't1', kind: 'mine' }, 0, at(0));
        d.pointer(at(70));
        d.over(2);
        d.release();
        expect(writes).toEqual([['gone', 't2', 't3', 't1']]);
    });

    test('a status redraw mid-drag keeps the drag and its target, and the drop reads the list as it is then', () => {
        let shownMine = ['t1', 't2', 't3'];
        const writes: string[][] = [];
        const d = list(() =>
            context({
                order: ['t1', 't2', 't3'],
                setOrder: (next) => writes.push(next),
                shownMine,
            }),
        );
        d.press('t1', { address: 't1', kind: 'mine' }, 0, at(0));
        d.pointer(at(70));
        d.over(2);
        // a redraw: the render builds new rows and a new context; the drag lives on the view, not in the render
        shownMine = [...shownMine];
        expect(d.state()).toMatchObject({ name: 'dragging', to: 2 });
        d.release();
        expect(writes).toEqual([['t2', 't3', 't1']]);
    });
});

describe('each kind drags to its own move', () => {
    test('a pin moves among the shown pins, the hidden ones keep their place at the end', () => {
        const pinsWritten: string[][] = [];
        const d = list(() =>
            context({
                pins: ['p1', 'gone', 'p2', 'p3'],
                setPins: (p) => pinsWritten.push(p),
                shownPins: ['p1', 'p2', 'p3'],
            }),
        );
        d.press('p3', { address: 'p3', kind: 'pin' }, 2, at(60));
        d.pointer(at(0));
        d.over(
            targetOf(
                { address: 'p3', kind: 'pin' },
                agent({ isPinned: true, pinAt: 0 }),
            ),
        );
        d.release();
        expect(pinsWritten).toEqual([['p3', 'p1', 'p2', 'gone']]);
    });

    test('a tab row moves its tab onto the shown tab it landed on, 1-based in its space', () => {
        const item: Dragged = { kind: 'tab', space: 's1', tab: 'tab1' };
        const spaceTabs = ['tab1', 'tab2', 'tab3'];
        const d = list(() =>
            context({
                shownTabs: { s1: ['tab1', 'tab3'] },
                tabIndex: (_space, tab) => spaceTabs.indexOf(tab),
            }),
        );
        d.press('t1', item, 0, at(0));
        d.pointer(at(70));
        d.over(targetOf(item, agent({ tab: 'tab3', tabAt: 1 })));
        d.release();
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith('tab.move', { id: 'tab1', index: 3 });
    });

    test('a space header moves the space onto the shown space it landed on, 1-based', () => {
        const item: Dragged = { id: 's3', kind: 'space', machine: null };
        const all = ['s1', 's2', 's3'];
        const d = list(() =>
            context({
                shownSpaces: ['s2', 's3'],
                spaceIndex: (space) => all.indexOf(space),
            }),
        );
        d.press('sp-s3', item, 1, at(40));
        d.pointer(at(0));
        d.over(targetOf(item, { kind: 'header', machine: null, spaceAt: 0 }));
        d.release();
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith('space.move', { id: 's3', index: 2 });
    });
});

describe('a spot takes only its own kind', () => {
    test('a pin never lands on an unpinned row', () => {
        expect(
            targetOf(
                { address: 'p3', kind: 'pin' },
                agent({ isYours: true, mineAt: 1 }),
            ),
        ).toBeNull();
    });

    test('his order never lands on a pinned row', () => {
        expect(
            targetOf(
                { address: 't1', kind: 'mine' },
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

describe('a drop moves what was pressed, whatever changed since', () => {
    test('a thread gone mid-drag shifts the places, never which row moves', () => {
        let shownMine = ['t1', 't2', 't3', 't4'];
        const writes: string[][] = [];
        const d = list(() =>
            context({
                order: ['t1', 't2', 't3', 't4'],
                setOrder: (next) => writes.push(next),
                shownMine,
            }),
        );
        d.press('t3', { address: 't3', kind: 'mine' }, 2, at(60));
        d.pointer(at(0));
        d.over(0);
        shownMine = ['t1', 't3', 't4'];
        d.release();
        expect(writes).toEqual([['t3', 't1', 't2', 't4']]);
    });
});

describe('a pin moves by what was pressed too', () => {
    test('a pin unpinned mid-drag shifts the places, never which pin moves', () => {
        let shownPins = ['p1', 'p2', 'p3'];
        const written: string[][] = [];
        const d = list(() =>
            context({
                pins: ['p1', 'p2', 'p3'],
                setPins: (p) => written.push(p),
                shownPins,
            }),
        );
        d.press('p3', { address: 'p3', kind: 'pin' }, 2, at(60));
        d.pointer(at(0));
        d.over(0);
        shownPins = ['p1', 'p3'];
        d.release();
        expect(written[0]?.[0]).toBe('p3');
    });
});

describe('the places count only the rows drawn', () => {
    const groups = [
        {
            id: 'pinned',
            members: [{ address: 'p1', space: 's1', tab: 'tp' }],
        },
        {
            id: 'sp-s1',
            members: [
                { address: 'a1', space: 's1', tab: 'ta' },
                { address: 'a2', space: 's1', tab: 'ta' },
                { address: 'a3', space: 's1', tab: 'tb' },
            ],
            space: 's1',
        },
        {
            id: 'sp-s2',
            members: [{ address: 'b1', space: 's2', tab: 'tc' }],
            space: 's2',
        },
    ];
    const view = {
        folded: new Set<string>(),
        isNarrow: false,
        isYours: false,
        pins: ['p1'],
    };

    test('a tab with two agent rows is one place, a pin is no tab place', () => {
        const shown = shownOf(groups, view);
        expect(shown.shownTabs).toEqual({ s1: ['ta', 'tb'], s2: ['tc'] });
        expect(shown.shownPins).toEqual(['p1']);
        expect(shown.shownSpaces).toEqual(['s1', 's2']);
        expect(placesOf({ kind: 'tab', space: 's1', tab: 'ta' }, shown)).toBe(
            2,
        );
    });

    test('a folded group draws no rows, so its rows are no places', () => {
        const shown = shownOf(groups, {
            ...view,
            folded: new Set(['sp-s1', 'pinned']),
        });
        expect(shown.shownTabs).toEqual({ s2: ['tc'] });
        expect(shown.shownPins).toEqual([]);
        expect(shown.shownSpaces).toEqual(['s1', 's2']);
    });

    test('the narrow rail draws every row and no header', () => {
        const shown = shownOf(groups, {
            ...view,
            folded: new Set(['sp-s1']),
            isNarrow: true,
        });
        expect(shown.shownTabs.s1).toEqual(['ta', 'tb']);
        expect(shown.shownSpaces).toEqual([]);
    });

    test('in his order every unpinned row is a place, and no tab is', () => {
        const shown = shownOf(groups, { ...view, isYours: true });
        expect(shown.shownMine).toEqual(['a1', 'a2', 'a3', 'b1']);
        expect(shown.shownTabs).toEqual({});
        expect(placesOf({ address: 'a1', kind: 'mine' }, shown)).toBe(4);
    });
});
