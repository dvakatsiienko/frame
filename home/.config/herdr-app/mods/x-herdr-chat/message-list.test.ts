import { afterEach, beforeEach, expect, test, vi } from 'vitest';

type Handler = (...args: never[]) => unknown;
/** an element as the list builds it: its id, its children, its handlers and its opacity */
type El = {
    children: El[];
    handlers: Map<string, Handler>;
    id: string | null;
    isClipped: boolean;
    opacity: number;
};

const gpui = vi.hoisted(() => {
    const seen = {
        asks: [] as string[],
        list: null as null | {
            draw: (range: { end: number; start: number }) => unknown;
            el: unknown;
            sizes: number[];
        },
        seekAt: -1,
    };
    const make = () => {
        const el = {
            children: [] as unknown[],
            handlers: new Map<string, unknown>(),
            id: null as string | null,
            isClipped: false,
            opacity: 1,
        };
        const self: unknown = new Proxy(el, {
            get(target, name) {
                if (name === 'raw') return target;
                return (...args: unknown[]) => {
                    if (name === 'overflow_hidden') target.isClipped = true;
                    else if (name === 'id') target.id = args[0] as string;
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

vi.mock('herdr', () => ({
    exec: vi.fn(),
    settings: () => ({ zoom: 1 }),
}));
vi.mock('gpui-kit', () => ({ View: class {}, div: gpui.make }));
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
        const el = gpui.make();
        gpui.seen.list = { draw, el, sizes };
        return el;
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
        kind: i === 3 ? 'mine' : 'reply',
        text: 'x',
        version: 1,
    }));
    /** each row of the last frame, and whether its own view drew its words */
    const frame = new Map<string, boolean>();
    const bodies = {
        live: 0,
        /** what every row's text views draw from */
        look: 'first',
        /** a body told to draw again */
        notified: new Set<unknown>(),
        /** a drawn body's selection handler, by row */
        reports: new Map<string, Handler>(),
    };
    const written: string[] = [];
    const list = createMessageList({
        audioApp: () => null,
        file: () => null,
        heights: createHeights(),
        loadEarlier: () => {},
        pictures: {},
        reader: () => null,
        rows: {
            booked: (r: unknown) => r,
            hasTexts: () => true,
            markTurn: () => {},
            row: (
                row: { id: string },
                _t: unknown,
                _pre: string,
                isShown: boolean,
                body: unknown,
            ) => {
                if (isShown) frame.set(row.id, body !== null);
                return gpui.make();
            },
            stampOf: (row: { id: string }, pre: string) => `${pre}${row.id}`,
            texts: (
                row: { id: string },
                _t: unknown,
                _pre: string,
                _isShown: boolean,
                reporting: (view: unknown, block: number) => unknown,
            ) =>
                reporting(
                    {
                        on_selection_change: (report: Handler) =>
                            bodies.reports.set(row.id, report),
                    },
                    0,
                ),
            textsCount: () => 1,
            textsLook: (_row: unknown, _t: unknown, pre: string) =>
                `${pre}${bodies.look}`,
        },
        unsend: () => {},
    } as never);
    let isDirty = true;
    const timers: { at: number; run: () => void }[] = [];
    const cx = {
        new: (View: new () => unknown, props: unknown) => {
            bodies.live += 1;
            const view = new View() as {
                init: Handler;
                render: () => unknown;
            };
            view.init(props as never);
            view.render();
            return {
                release: () => (bodies.live -= 1),
                render: () => view.render(),
            };
        },
        notify: (entity?: { render: () => unknown }) => {
            if (!entity) {
                isDirty = true;
                return;
            }
            bodies.notified.add(entity);
            entity.render();
        },
        timer: {
            after: (ms: number, run: (cx: unknown) => void) =>
                timers.push({ at: Date.now() + ms, run: () => run(cx) }),
        },
        write_to_clipboard: (text: string) => written.push(text),
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
    let root = raw(gpui.make());
    /** the boxes herdr drew last */
    let boxes: El[] = [];
    /** the list draws the rows on screen: each frame, and each scrolled px with no other redraw */
    function drawRows() {
        const list = gpui.seen.list as NonNullable<typeof gpui.seen.list>;
        frame.clear();
        boxes = (list.draw(ranged(list.sizes)) as unknown[]).map(raw);
    }
    function draw() {
        isDirty = false;
        gpui.seen.asks = [];
        list.take(rows as never, {} as never);
        root = raw(list.view(rows as never, {} as never, cx as never));
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
        drawRows();
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
    const fire = (el: El, name: string, ...args: unknown[]) =>
        (el.handlers.get(name) as Handler)(...(args as never[]));
    /** every element under one, with its words */
    const under = (el: El): (El | string)[] => [
        el,
        ...el.children.flatMap((child) =>
            typeof child === 'string'
                ? [child]
                : raw(child)
                  ? under(raw(child))
                  : [],
        ),
    ];
    return {
        /** the px of a row above the view */
        above: (row: number) =>
            scrollTop -
            (gpui.seen.list?.sizes ?? [])
                .slice(0, row)
                .reduce((sum, px) => sum + px, 0),
        bodies,
        /** the rows drawn anew now, whatever asked: whether each is clipped */
        clipped() {
            draw();
            return boxes
                .filter((box) => box.children.length)
                .map((box) => box.isClipped);
        },
        frame,
        /** somewhere else in the list at once, in one redraw */
        jump(px: number) {
            scrollTop = px;
            isDirty = true;
        },
        land: (id: string, offset: number) => list.land(id, offset),
        reset: () => list.reset(),
        /** his right press on a message, then the menu's one item */
        rightPress(id: string) {
            const position = { x: 1, y: 2 };
            const at = raw(gpui.seen.list?.el);
            fire(at, 'on_item_secondary_click', id, { position }, cx);
            fire(root, 'on_mouse_down', { position }, cx);
            draw();
            const item = under(root).find(
                (el): el is El =>
                    typeof el !== 'string' &&
                    el.id === 'chat-message-menu-copy',
            ) as El;
            fire(item, 'on_click', {}, cx);
            return {
                label: item.children[0] as unknown,
                written: written.at(-1),
            };
        },
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
        /** his wheel over many rows: herdr scrolls the list and draws its rows, the chat is asked for nothing */
        scroll(dy: number) {
            fire(root, 'on_scroll_wheel', { delta: { y: -dy } }, cx);
            scrollTop += dy;
            drawRows();
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

// FRM-699: a row with no view of its own cannot report his selection
test('at rest each message on screen has the view that reports his selection, and few far off keep theirs', () => {
    const w = createWindow(Array(200).fill(60), (px) => px);
    w.land('r100', 10);
    w.run(1_500);
    expect([...w.frame.values()]).toEqual(
        Array.from(w.frame.values(), () => true),
    );
    expect(w.bodies.live).toBeLessThan(w.frame.size + 25);
});

test.each([
    [
        'a long scroll',
        (w: ReturnType<typeof createWindow>) => {
            for (let i = 0; i < 12; i++) {
                w.scroll(-300);
                w.run(40);
            }
        },
    ],
    [
        'a jump',
        (w: ReturnType<typeof createWindow>) => {
            w.scroll(-300);
            w.run(40);
            w.jump(1_000);
        },
    ],
])('after %s each message on screen has its view again', (_how, move) => {
    const w = createWindow(Array(200).fill(60), (px) => px);
    w.run(1_000);
    move(w);
    w.run(40);
    expect(w.frame.size).toBeGreaterThan(5);
    expect([...w.frame.values()]).not.toContain(false);
});

test('a thread switch lets every one go', () => {
    const w = createWindow(Array(20).fill(60), (px) => px);
    w.run(500);
    expect(w.bodies.live).toBeGreaterThan(0);
    w.reset();
    expect(w.bodies.live).toBe(0);
});

test('a message whose look changed draws its words again', () => {
    const w = createWindow(Array(20).fill(60), (px) => px);
    w.run(500);
    w.bodies.notified.clear();
    w.bodies.look = 'find open';
    // its older text stays in its own box for the frame it takes
    expect(w.clipped()).not.toContain(false);
    w.run(100);
    expect(w.bodies.notified.size).toBe(w.bodies.live);
    expect(w.clipped()).not.toContain(true);
});

test.each([
    ['a reply', 'r1'],
    ['his own message', 'r3'],
])(
    'a right press on %s copies the words he selected there, else the whole message',
    (_what, id) => {
        const w = createWindow(Array(5).fill(60), (px) => px);
        w.run(500);
        (w.bodies.reports.get(id) as Handler)({ text: 'two words' } as never);
        expect(w.rightPress(id)).toEqual({
            label: 'Copy text',
            written: 'two words',
        });
        expect(w.rightPress('r2')).toEqual({
            label: 'Copy message',
            written: 'x',
        });
        (w.bodies.reports.get(id) as Handler)(null as never);
        expect(w.rightPress(id).label).toBe('Copy message');
    },
);
