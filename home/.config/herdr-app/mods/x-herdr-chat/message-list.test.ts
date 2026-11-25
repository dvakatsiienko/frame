import { afterEach, beforeEach, expect, test, vi } from 'vitest';

type Handler = (...args: never[]) => unknown;
/** an element as the list builds it: its id, its children, its handlers and its opacity */
type El = {
    children: El[];
    handlers: Map<string, Handler>;
    id: string | null;
    opacity: number;
};

const gpui = vi.hoisted(() => {
    const seen = {
        asks: [] as string[],
        list: null as null | {
            draw: (range: { end: number; start: number }) => unknown;
            sizes: number[];
        },
        seekAt: -1,
    };
    const make = () => {
        const el = {
            children: [] as unknown[],
            handlers: new Map<string, unknown>(),
            id: null as string | null,
            opacity: 1,
        };
        const self: unknown = new Proxy(el, {
            get(target, name) {
                if (name === 'raw') return target;
                return (...args: unknown[]) => {
                    if (name === 'id') target.id = args[0] as string;
                    else if (name === 'opacity')
                        target.opacity = args[0] as number;
                    else if (name === 'child') target.children.push(args[0]);
                    else if (name === 'children')
                        target.children.push(...(args[0] as unknown[]));
                    else if (name === 'when') {
                        if (args[0]) (args[1] as Handler)(self as never);
                    } else if (String(name).startsWith('on_'))
                        target.handlers.set(String(name), args.at(-1));
                    return self;
                };
            },
        });
        return self;
    };
    return { make, seen };
});

vi.mock('herdr', () => ({ exec: vi.fn(), settings: () => ({ zoom: 1 }) }));
vi.mock('gpui-kit', () => ({ div: gpui.make }));
vi.mock('gpui-base', () => ({
    VirtualListScrollHandle: {
        new: () => ({
            scroll_to_bottom: () => gpui.seen.asks.push('bottom'),
            scroll_to_item: (item: number) => {
                gpui.seen.asks.push('item');
                gpui.seen.seekAt = item;
            },
        }),
    },
    h_flex: gpui.make,
    v_flex: gpui.make,
    v_virtual_list: (
        _id: string,
        _n: number,
        sizes: number[],
        _key: Handler,
        draw: (range: { end: number; start: number }) => unknown,
    ) => {
        gpui.seen.list = { draw, sizes };
        return gpui.make();
    },
}));

const { createHeights } = await import('./heights.js');
const { createMessageList } = await import('./message-list.js');

const raw = (el: unknown) => (el as { raw: El }).raw;
const VIEW = 600;
const FRAME_MS = 16;

/**
 * the real list in a window: a frame draws it, herdr's list scrolls as it was probed to, and each newly mounted
 * measuring row reports `first` px in its first frame and `real` px from the next one, as rich text does
 */
function createWindow(real: number[], first: (px: number) => number) {
    const rows = real.map((_, i) => ({
        id: `r${i}`,
        kind: 'reply',
        text: 'x',
        version: 1,
    }));
    const list = createMessageList({
        audioApp: () => null,
        file: () => null,
        flash: () => {},
        heights: createHeights(),
        loadEarlier: () => {},
        pictures: {},
        reader: () => null,
        rows: {
            booked: (r: unknown) => r,
            markTurn: () => {},
            row: () => gpui.make(),
        },
        unsend: () => {},
    } as never);
    let isDirty = true;
    const timers: { at: number; run: () => void }[] = [];
    const cx = {
        notify: () => {
            isDirty = true;
        },
        timer: {
            after: (ms: number, run: (cx: unknown) => void) =>
                timers.push({ at: Date.now() + ms, run: () => run(cx) }),
        },
    };
    /** each mounted measuring row and the height it last reported */
    let mounted = new Map<string, number>();
    /** each mounted measuring row's own size handler */
    const sizeOf = new Map<string, Handler>();
    let scrollTop = 0;
    /** the opacity of each frame drawn */
    const opacities: number[] = [];

    const ranged = (sizes: number[]) => {
        const past = (edge: number) => {
            let bottom = 0;
            for (const [i, size] of sizes.entries()) {
                bottom += size;
                if (bottom > edge) return i;
            }
            return sizes.length;
        };
        const start = past(scrollTop);
        return {
            end: Math.min(past(scrollTop + VIEW) + 2, sizes.length),
            start,
        };
    };
    function draw() {
        isDirty = false;
        gpui.seen.asks = [];
        list.take(rows as never, {} as never);
        const root = raw(list.view(rows as never, {} as never, cx as never));
        opacities.push(root.opacity);
        const drawn = gpui.seen.list as NonNullable<typeof gpui.seen.list>;
        const total = drawn.sizes.reduce((sum, px) => sum + px, 0);
        const max = Math.max(0, total - VIEW);
        for (const ask of gpui.seen.asks) {
            if (ask === 'bottom') scrollTop = max;
            else {
                const top = drawn.sizes
                    .slice(0, gpui.seen.seekAt)
                    .reduce((sum, px) => sum + px, 0);
                const bottom = top + (drawn.sizes[gpui.seen.seekAt] ?? 0);
                if (top < scrollTop) scrollTop = top;
                else if (bottom > scrollTop + VIEW) scrollTop = bottom - VIEW;
            }
        }
        scrollTop = Math.min(max, Math.max(0, scrollTop));
        drawn.draw({ end: 1, start: 0 });
        drawn.draw(ranged(drawn.sizes));
        if (opacities.length === 1)
            (root.handlers.get('on_size_change') as Handler)(
                { height: VIEW, width: 900 } as never,
                cx as never,
            );
        const measurer = raw(raw(root.children[1]).children[0]);
        const next = new Map<string, number>();
        for (const child of measurer.children.map(raw)) {
            const index = Number(/r(\d+)@/.exec(child.id ?? '')?.[1]);
            const px = real[index] ?? 1;
            const now = mounted.has(child.id ?? '') ? px : first(px);
            next.set(child.id ?? '', now);
            sizeOf.set(
                child.id ?? '',
                child.handlers.get('on_size_change') as Handler,
            );
            if (mounted.get(child.id ?? '') !== now)
                (child.handlers.get('on_size_change') as Handler)(
                    { height: now, width: 900 } as never,
                    cx as never,
                );
        }
        mounted = next;
    }
    /** rich text lays out a frame after it mounts: its size arrives then, and the list itself redraws nothing for it */
    function settleText() {
        for (const [id, px] of mounted) {
            const now = real[Number(/r(\d+)@/.exec(id)?.[1])] ?? 1;
            if (px === now) continue;
            mounted.set(id, now);
            (sizeOf.get(id) as Handler)(
                { height: now, width: 900 } as never,
                cx as never,
            );
        }
    }
    return {
        /** the px of a row above the view */
        above: (row: number) =>
            scrollTop -
            (gpui.seen.list?.sizes ?? [])
                .slice(0, row)
                .reduce((sum, px) => sum + px, 0),
        land: (id: string, offset: number) => list.land(id, offset),
        /** frames until `ms` pass; whether the list still redraws at the end */
        run(ms: number) {
            const until = Date.now() + ms;
            while (Date.now() < until) {
                for (const t of timers.splice(0))
                    if (t.at <= Date.now()) t.run();
                    else timers.push(t);
                if (isDirty) draw();
                else settleText();
                vi.setSystemTime(Date.now() + FRAME_MS);
            }
            return { drawn: opacities.length, opacities };
        },
    };
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

const thread = [300, 300, 300, 28, 2400, 300, 300, 28, 700, 400];

// dima, 2026-11-25 13:15: the wing's tab, reopened mid-thread, showed its list for one frame in ten, for good
test.each([
    ['as it will draw', (px: number) => px],
    ['shorter', (px: number) => Math.round(px * 0.6)],
    ['taller', (px: number) => px + 40],
])(
    'a restored place comes to rest, each row first laid out %s',
    (_how, first) => {
        const w = createWindow(thread, first);
        w.land('r4', 188);
        const early = w.run(1_500).drawn;
        const late = w.run(1_500);
        expect({
            isLast: late.opacities.at(-1),
            more: late.drawn - early,
        }).toEqual({
            isLast: 1,
            more: 0,
        });
        expect(w.above(4)).toBe(188);
    },
);

// the rows under the held one come on screen with it: measured with it, or each lands a frame late and moves the place
test('a place among many short rows comes to rest', () => {
    const w = createWindow(Array(60).fill(28), () => 1);
    w.land('r20', 10);
    const early = w.run(1_500).drawn;
    const late = w.run(1_500);
    expect({
        isLast: late.opacities.at(-1),
        more: late.drawn - early,
    }).toEqual({ isLast: 1, more: 0 });
    expect(w.above(20)).toBe(10);
});
