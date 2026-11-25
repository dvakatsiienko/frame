import { beforeEach, describe, expect, test, vi } from 'vitest';

type Handler = (...args: unknown[]) => unknown;
const gpui = vi.hoisted(() => {
    const painted: { color: string; id: string; range: number[] }[] = [];
    const make = (id = ''): unknown => {
        const self: unknown = new Proxy(
            {},
            {
                get:
                    (_target, name) =>
                    (...args: unknown[]) => {
                        if (name === 'highlight_range')
                            painted.push({
                                color: String(args[2]),
                                id,
                                range: args.slice(0, 2) as number[],
                            });
                        if (name === 'when' && args[0])
                            (args[1] as Handler)(self);
                        return self;
                    },
            },
        );
        return self;
    };
    return { make, painted };
});
vi.mock('herdr', () => ({ home: () => '/Users/me' }));
vi.mock('gpui-kit', () => ({
    div: () => gpui.make(),
    image: () => gpui.make(),
}));
vi.mock('gpui-base', () => ({
    TextView: { markdown: (id: string) => gpui.make(id) },
    h_flex: () => gpui.make(),
    v_flex: () => gpui.make(),
}));

const { createFind } = await import('./find.js');
const { createHeights } = await import('./heights.js');
const { createMessageRows } = await import('./message-row.js');

const t = new Proxy({}, { get: () => '#336699' }) as never;
const reply = (id: string, text: string) => ({
    files: [],
    id,
    kind: 'reply',
    pictures: [],
    text,
    version: 1,
});
const LONG = reply(
    'long',
    Array.from({ length: 80 }, (_, i) => `line ${i} **viewer**`).join('\n\n'),
);
const rows = [
    reply('old', 'the viewer, `viewer`'),
    LONG,
    reply('new', 'one viewer'),
] as never[];

function createRows() {
    const find = createFind();
    return {
        find,
        view: createMessageRows({
            column: () => 700,
            find: () => find,
            isShowMore: () => true,
            look: () => ({ space: 'normal' }),
            room: () => 700,
            sent: { pathOf: () => null, relOf: () => null },
        } as never),
    };
}

beforeEach(() => {
    gpui.painted.length = 0;
});

// FRM-699 exit 2: the old stepped row was a second drawing with its own height, so each step swapped two rows
describe('find moves no row (FRM-699:W3)', () => {
    test('a folded reply unfolds once when it becomes a hit, and no step changes a height again', () => {
        const { find, view } = createRows();
        const heights = createHeights();
        const sizes = () => heights.sizes(view.booked(rows), () => 1);
        view.markTurn([]);
        for (const row of view.booked(rows)) heights.record(row, 100);
        const looks = () =>
            view.booked(rows).map((r) => (r as { look?: string }).look);
        expect(looks()).toEqual([undefined, 'fold', undefined]);

        find.open();
        find.search(rows, 'viewer');
        expect(looks()).toEqual([undefined, undefined, undefined]);
        for (const row of view.booked(rows))
            heights.record(row, row.id === 'long' ? 900 : 100);
        expect(sizes()).toEqual([100, 900, 100]);
        // the newest row, then the long one, then the oldest: every row was stepped to, none was measured again
        for (let i = 0; i < find.state.hits.length; i++) {
            find.step('older');
            expect(looks()).toEqual([undefined, undefined, undefined]);
            expect(heights.toMeasure(view.booked(rows), null)).toEqual([]);
            expect(sizes()).toEqual([100, 900, 100]);
        }

        find.close();
        expect(looks()).toEqual([undefined, 'fold', undefined]);
    });
});

describe('each match painted in the drawn message (FRM-699:W3)', () => {
    const draw = (i: number, isShown = true) => {
        gpui.painted.length = 0;
        return (view: ReturnType<typeof createRows>['view']) => {
            view.row(rows[i] as never, t, 'p', isShown);
            return gpui.painted.map((m) => [m.id, ...m.range, m.color]);
        };
    };

    test('every match, the stepped one last and stronger', () => {
        const { find, view } = createRows();
        find.open();
        find.search(rows, 'viewer');
        expect(draw(2)(view)).toEqual([['pnew@1-0', 4, 10, '#336699b3']]);
        expect(draw(0)(view)).toEqual([
            ['pold@1-0', 4, 10, '#3366994d'],
            ['pold@1-0', 13, 19, '#3366994d'],
        ]);
        find.step('newer');
        // wrapped to the oldest row's last match, then to its first
        expect(draw(0)(view)).toEqual([
            ['pold@1-0', 4, 10, '#3366994d'],
            ['pold@1-0', 13, 19, '#336699b3'],
        ]);
        find.step('newer');
        expect(draw(0)(view)).toEqual([
            ['pold@1-0', 13, 19, '#3366994d'],
            ['pold@1-0', 4, 10, '#336699b3'],
        ]);
    });

    test('each block paints its own', () => {
        const { find, view } = createRows();
        const mixed = reply('mix', 'a viewer\n```\nviewer\n```') as never;
        find.open();
        find.search([mixed], 'viewer');
        gpui.painted.length = 0;
        view.row(mixed, t, 'p');
        expect(gpui.painted.map((m) => [m.id, ...m.range])).toEqual([
            ['pmix@1-0', 2, 8],
            ['pmix@1-1', 4, 10],
        ]);
    });

    test('none in the hidden measured copy', () => {
        const { find, view } = createRows();
        find.open();
        find.search(rows, 'viewer');
        expect(draw(2, false)(view)).toEqual([]);
    });

    test('none in a row the count left out, though its words match', () => {
        const { find, view } = createRows();
        find.open();
        find.search(rows.slice(0, 2), 'viewer');
        expect(draw(2)(view)).toEqual([]);
        expect(draw(0)(view)).toHaveLength(2);
    });
});
