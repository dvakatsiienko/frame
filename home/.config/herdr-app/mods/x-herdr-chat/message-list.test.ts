import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type Handler = (...args: never[]) => unknown;
/** an element as the list builds it: its id, its children, its handlers and its opacity */
type El = {
    children: El[];
    handlers: Map<string, Handler>;
    id: string | null;
    isClipped: boolean;
    opacity: number;
    top: number;
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
        zoom: 1,
    };
    const make = () => {
        const el = {
            children: [] as unknown[],
            handlers: new Map<string, unknown>(),
            id: null as string | null,
            isClipped: false,
            opacity: 1,
            top: 0,
        };
        const self: unknown = new Proxy(el, {
            get(target, name) {
                if (name === 'raw') return target;
                return (...args: unknown[]) => {
                    if (name === 'overflow_hidden') target.isClipped = true;
                    else if (name === 'id') target.id = args[0] as string;
                    else if (name === 'top') target.top = args[0] as number;
                    else if (name === 'opacity')
                        target.opacity = args[0] as number;
                    else if (name === 'child') target.children.push(args[0]);
                    else if (name === 'children')
                        target.children.push(...(args[0] as unknown[]));
                    else if (name === 'when') {
                        if (args[0]) (args[1] as Handler)(self as never);
                    } else if (String(name).startsWith('on_'))
                        target.handlers.set(
                            name === 'on_mouse_down'
                                ? `${name}_${args[0]}`
                                : String(name),
                            args.at(-1),
                        );
                    return self;
                };
            },
        });
        return self;
    };
    /** each `open`, and the folders there are */
    const opened: string[][] = [];
    const folders = ['/Users/me/frame'];
    const exec = async (program: string, args: string[]) => {
        if (program === 'open') opened.push(args);
        if (program === '/bin/realpath')
            return args[0] === '/tmp/gone.md'
                ? { code: 1, stdout: '' }
                : { code: 0, stdout: `${args[0]}\n` };
        return { code: folders.includes(args[1] ?? '') ? 0 : 1, stdout: '' };
    };
    return { exec, make, opened, seen };
});

vi.mock('herdr', () => ({
    exec: gpui.exec,
    home: () => '/Users/me',
    settings: () => ({ zoom: gpui.seen.zoom }),
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

const kept = new Map<string, string>();
vi.stubGlobal('localStorage', {
    getItem: (key: string) => kept.get(key) ?? null,
    removeItem: (key: string) => kept.delete(key),
    setItem: (key: string, value: string) => kept.set(key, value),
});

const { createHeights } = await import('./heights.js');
const { createMessageList } = await import('./message-list.js');

const raw = (el: unknown) => (el as { raw: El }).raw;
const VIEW = 600;
const FRAME_MS = 16;

/**
 * the real list in a window: a frame draws it, herdr's list scrolls as it was probed to, and each newly mounted
 * measuring row reports `first` px in its first `shortFrames` frames and `real` px from the next one, as rich text does
 */
function createWindow(
    real: number[],
    first: (px: number) => number,
    shortFrames = 1,
    frameMs = FRAME_MS,
) {
    let rows = real.map((_, i) => ({
        id: `r${i}`,
        kind: i === 3 ? 'mine' : 'reply',
        links: [
            '~/frame',
            '~/a.md',
            '/tmp/x.command',
            '/tmp/a.png',
            '/tmp/gone.md',
        ],
        text: 'x',
        version: 1,
    }));
    /** each row of the last frame, and whether its own view drew its words */
    const frame = new Map<string, boolean>();
    const bodies = {
        /** a text view's linked markdown back to the written one */
        back: (range: { start: number; end: number }) => range,
        isViewerOpen: false,
        /** a drawn body's link click, by row */
        links: new Map<string, Handler>(),
        live: 0,
        /** what every row's text views draw from */
        look: 'first',
        /** notes whose words he clicked */
        noted: [] as string[],
        /** a body told to draw again */
        notified: new Set<unknown>(),
        /** the square each click on a row opens */
        opened: [] as (string | null)[],
        /** a drawn body's selection handler, by row */
        reports: new Map<string, Handler>(),
        /** selections told to the popup */
        settled: 0,
        /** a drawn square's press, by row */
        squares: new Map<string, Handler>(),
        /** how many text views each message draws */
        texts: 1,
    };
    const written: string[] = [];
    const earlier: number[] = [];
    const annotated: unknown[] = [];
    const list = createMessageList({
        annotate: (selected: unknown) => annotated.push(selected),
        audioApp: () => null,
        file: () => '/t.jsonl',
        heights: createHeights(),
        loadEarlier: () => earlier.push(1),
        noteBox: () => null,
        noteClicked: (id: string) => bodies.noted.push(id),
        notePopup: () => null,
        openNote: (id: string, at: unknown) => annotated.push([id, at]),
        pictures: {
            isOpen: () => bodies.isViewerOpen,
            show: (files: string[]) => bodies.opened.push(files.join()),
        },
        reader: () => null,
        rows: {
            bodyLook: (_row: unknown, _t: unknown, pre: string) =>
                `${pre}${bodies.look}`,
            booked: (r: unknown) => r,
            drawBody: (
                row: { id: string },
                _t: unknown,
                _pre: string,
                { pressing, reporting }: Record<string, Handler>,
            ) => {
                (pressing as Handler)(
                    {
                        on_mouse_down: (_button: string, press: Handler) =>
                            bodies.squares.set(row.id, press),
                    } as never,
                    `${row.id}-second` as never,
                );
                return (reporting as Handler)(
                    {
                        on_link_click(follow: Handler) {
                            bodies.links.set(row.id, follow);
                            return this;
                        },
                        on_selection_change: (report: Handler) =>
                            bodies.reports.set(row.id, report),
                    } as never,
                    0 as never,
                    'the written source' as never,
                    ((range: { start: number; end: number }) =>
                        bodies.back(range)) as never,
                );
            },
            hasBody: () => true,
            markTurn: () => {},
            press: (_rows: unknown, key: string, picture: string | null) => {
                bodies.opened.push(picture);
                if (key === 'r4') return { id: 'n1', kind: 'note' };
                return key === 'r2'
                    ? { kind: 'file', path: '/tmp/x.command' }
                    : null;
            },
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
            textsCount: () => bodies.texts,
        },
        say: (note: string) => gpui.opened.push([note]),
        scrolled: () => {},
        selected: () => {
            bodies.settled += 1;
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
        open_url: (url: string) => gpui.opened.push([url]),
        spawn: (task: (c: unknown) => unknown) => task(cx),
        stop_propagation: () => {},
        timer: {
            after: (ms: number, run: (cx: unknown) => void) =>
                timers.push({ at: Date.now() + ms, run: () => run(cx) }),
        },
        write_to_clipboard: (text: string) => written.push(text),
    };
    /** the frames each mounted measuring row has been drawn in */
    const ages = new Map<string, number>();
    /** each mounted measuring row and the height it last reported */
    let mounted = new Map<string, number>();
    /** each mounted measuring row's own size handler */
    const sizeOf = new Map<string, Handler>();
    let scrollTop = 0;
    let viewH = VIEW;
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
            end: Math.min(past(scrollTop + viewH) + 2, sizes.length),
            start,
        };
    };
    let root = raw(gpui.make());
    /** the boxes herdr drew last */
    let boxes: El[] = [];
    /** the list draws the rows on screen: each frame, and each scrolled px with no other redraw */
    function drawRows() {
        const list = gpui.seen.list as NonNullable<typeof gpui.seen.list>;
        const total = list.sizes.reduce((sum, px) => sum + px, 0);
        scrollTop = Math.min(
            Math.max(0, total - viewH),
            Math.max(0, scrollTop),
        );
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
        const max = Math.max(0, total - viewH);
        for (const ask of gpui.seen.asks) {
            if (ask === 'bottom') scrollTop = max;
            else {
                const top = drawn.sizes
                    .slice(0, gpui.seen.seekAt)
                    .reduce((sum, px) => sum + px, 0);
                const bottom = top + (drawn.sizes[gpui.seen.seekAt] ?? 0);
                if (top < scrollTop) scrollTop = top;
                else if (bottom > scrollTop + viewH) scrollTop = bottom - viewH;
            }
        }
        scrollTop = Math.min(max, Math.max(0, scrollTop));
        drawn.draw({ end: 1, start: 0 });
        drawRows();
        if (opacities.length === 1)
            (root.handlers.get('on_size_change') as Handler)(
                { height: viewH, width: 900 } as never,
                cx as never,
            );
        const measurer = raw(raw(root.children[1]).children[0]);
        const next = new Map<string, number>();
        for (const child of measurer.children.map(raw)) {
            const index = Number(/r(\d+)@/.exec(child.id ?? '')?.[1]);
            const px = real[index] ?? 1;
            const id = child.id ?? '';
            const age = mounted.has(id) ? (ages.get(id) ?? 0) + 1 : 0;
            ages.set(id, age);
            const now = age >= shortFrames ? px : first(px);
            next.set(id, now);
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
            const age = (ages.get(id) ?? 0) + 1;
            ages.set(id, age);
            if (age < shortFrames) continue;
            mounted.set(id, now);
            (sizeOf.get(id) as Handler)(
                { height: now, width: 900 } as never,
                cx as never,
            );
        }
    }
    const fire = (el: El, name: string, ...args: unknown[]) =>
        (el.handlers.get(name) as Handler)(...(args as never[]));
    /** what the disk's answers opened */
    const answered = async () => {
        for (let i = 0; i < 30; i++) await Promise.resolve();
        return gpui.opened;
    };
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
        annotated,
        bodies,
        /** his left press and release on a row, on its second square or beside the squares */
        click(id: string, isOnSquare: boolean) {
            if (isOnSquare) (bodies.squares.get(id) as Handler)();
            fire(root, 'on_mouse_down_left', { position: { x: 1, y: 2 } }, cx);
            gpui.opened.length = 0;
            fire(raw(gpui.seen.list?.el), 'on_item_click', id, cx);
            return answered();
        },
        /** the rows drawn anew now, whatever asked: whether each is clipped */
        clipped() {
            draw();
            return boxes
                .filter((box) => box.children.length)
                .map((box) => box.isClipped);
        },
        cx,
        earlier,
        /** his click on a link in a message */
        async follow(id: string, url: string) {
            gpui.opened.length = 0;
            (bodies.links.get(id) as Handler)(url as never, cx as never);
            return answered();
        },
        frame,
        /** the list moved on with no wheel step: a flick's glide */
        glide(px: number) {
            scrollTop += px;
            drawRows();
        },
        isDirty: () => isDirty,
        /** the ↓ that brings him to the newest is on screen */
        isNewestShown: () =>
            under(root).some(
                (el) => typeof el !== 'string' && el.id === 'chat-newest',
            ),
        /** the release of his left press on a row */
        itemClick: (id: string) =>
            fire(raw(gpui.seen.list?.el), 'on_item_click', id, cx),
        /** somewhere else in the list at once, in one redraw */
        jump(px: number) {
            scrollTop = px;
            isDirty = true;
        },
        land(id: string, offset: number) {
            list.land(id, offset);
            isDirty = true;
        },
        /** his left press at a place in the window, the list's corner at (453, 82) */
        leftDown(x: number, y: number) {
            fire(
                root,
                'on_mouse_down_left',
                {
                    local_position: { x: x - 453, y: y - 82 },
                    position: { x, y },
                },
                cx,
            );
        },
        /** the right-click menu's items after his right press on a message, and a press on one */
        menu(id: string, y = id.length + Number(id.slice(1))) {
            const position = { x: 1, y };
            const press = {
                local_position: { x: 1 - 453, y: y - 82 },
                position,
            };
            const at = raw(gpui.seen.list?.el);
            fire(at, 'on_item_secondary_click', id, { position }, cx);
            fire(root, 'on_mouse_down_right', press, cx);
            draw();
            const items = under(root).filter(
                (el): el is El =>
                    typeof el !== 'string' &&
                    Boolean(el.id?.startsWith('chat-message-menu-')),
            );
            return {
                items: items.map((el) => el.children[0] as unknown),
                press: (label: string) =>
                    fire(
                        items.find(
                            (el) => (el.children[0] as unknown) === label,
                        ) as El,
                        'on_click',
                        {},
                        cx,
                    ),
                top: under(root).find(
                    (el): el is El =>
                        typeof el !== 'string' && el.id === 'chat-message-menu',
                )?.top,
            };
        },
        /** a note row of 28 px comes after a row, or goes */
        noteAfter(row: number | null) {
            rows = rows.filter((r) => r.kind !== 'note');
            if (row !== null) {
                real[90] = 28;
                rows.splice(row + 1, 0, {
                    ...(rows[0] as (typeof rows)[number]),
                    id: 'r90',
                    kind: 'note',
                });
            }
            isDirty = true;
        },
        reset: () => list.reset(),
        /** his right press on a message, the menu left open */
        rightDown(id: string) {
            const position = { x: 1, y: 2 };
            const at = raw(gpui.seen.list?.el);
            fire(at, 'on_item_secondary_click', id, { position }, cx);
            fire(root, 'on_mouse_down_right', { position }, cx);
        },
        /** his right press on a message, then the menu's one item */
        rightPress(id: string) {
            const position = { x: 1, y: 2 };
            const at = raw(gpui.seen.list?.el);
            fire(at, 'on_item_secondary_click', id, { position }, cx);
            fire(root, 'on_mouse_down_right', { position }, cx);
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
                vi.setSystemTime(Date.now() + frameMs);
            }
            return { drawn: opacities.length, opacities };
        },
        /** his wheel over many rows: herdr scrolls the list and draws its rows, the chat is asked for nothing */
        scroll(dy: number, isDrawnBetween = false) {
            fire(root, 'on_scroll_wheel', { delta: { y: -dy } }, cx);
            if (isDrawnBetween) list.take([...rows] as never, {} as never);
            scrollTop += dy;
            drawRows();
        },
        selectedAt: (time: number) => list.selectedAt(time),
        /** the list's own height grows by `px`: the cards under it shrank */
        tall(px: number) {
            viewH += px;
            fire(root, 'on_size_change', { height: viewH, width: 900 }, cx);
        },
        /** herdr tells the list its size: at a change, and once it is back on the screen */
        told: (height: number) =>
            fire(root, 'on_size_change', { height, width: 900 }, cx),
        /** the list's width changes: every row is laid out anew */
        wide: (width: number) =>
            fire(root, 'on_size_change', { height: viewH, width }, cx),
    };
}

beforeEach(() => {
    kept.clear();
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

test('a settled selection tells the popup and asks the chat for no draw (FRM-585 C1)', () => {
    const w = createWindow(Array(5).fill(60), (px) => px);
    w.run(500);
    (w.bodies.reports.get('r1') as Handler)(
        { text: 'two words' } as never,
        w.cx as never,
    );
    expect([w.bodies.settled, w.isDirty()]).toEqual([1, false]);
});

test('a click opens the square he pressed, and the first when he pressed beside them', () => {
    const w = createWindow(Array(5).fill(60), (px) => px);
    w.run(500);
    w.click('r1', true);
    w.click('r1', false);
    expect(w.bodies.opened).toEqual(['r1-second', null]);
});

// dima's o6, 24 Nov: a path in a reply did nothing on a click
test.each([
    ['a folder opens in Finder', 'path:0', [['/Users/me/frame']]],
    ['a file opens in its app', 'path:1', [['/Users/me/a.md']]],
    ['a file that would run is revealed', 'path:2', [['-R', '/tmp/x.command']]],
    ['a web link opens in his browser', 'https://x.dev', [['https://x.dev']]],
    ['any other address opens nothing', 'javascript:x', []],
    ['one gone since says so', 'path:4', [['gone.md is no longer in /tmp']]],
])('a click on a link in a reply: %s', async (_what, url, opened) => {
    const w = createWindow(Array(5).fill(60), (px) => px);
    w.run(500);
    expect(await w.follow('r1', url)).toEqual(opened);
});

// FRM-585 B5
test('a click on a note’s words opens that note, and nothing else', async () => {
    const w = createWindow(Array(5).fill(60), (px) => px);
    w.run(500);
    expect(await w.follow('r1', 'note:n1')).toEqual([]);
    expect(w.bodies.noted).toEqual(['n1']);
});

test('words selected over a note’s link stand in the markdown as written', () => {
    const w = createWindow(Array(5).fill(60), (px) => px);
    w.run(500);
    w.bodies.back = ({ end, start }) => ({ end: end - 10, start: start - 1 });
    (w.bodies.reports.get('r1') as Handler)(
        { range: { end: 22, start: 5 }, text: 'two words' } as never,
        w.cx as never,
    );
    const part = w.selectedAt(Date.now())?.passage.parts[0];
    expect([part?.source, part?.range]).toEqual([
        'the written source',
        { end: 12, start: 4 },
    ]);
});

test('a click on a picture’s path opens it in the viewer', async () => {
    const w = createWindow(Array(5).fill(60), (px) => px);
    w.run(500);
    expect(await w.follow('r1', 'path:3')).toEqual([]);
    expect(w.bodies.opened).toEqual(['/tmp/a.png']);
});

test.each([
    [
        'its message left the screen',
        (w: ReturnType<typeof createWindow>) => {
            w.scroll(-900);
            w.run(40);
            w.scroll(900);
            w.run(40);
        },
    ],
    [
        'the chat came back on the screen',
        (w: ReturnType<typeof createWindow>) => w.told(600),
    ],
    [
        'the thread was read anew',
        (w: ReturnType<typeof createWindow>) => {
            w.reset();
            w.run(200);
        },
    ],
])('nothing selected is copied once %s', (_why, leave) => {
    const w = createWindow(Array(200).fill(60), (px) => px);
    w.run(1_000);
    const id = [...w.frame.keys()].at(2) ?? '';
    (w.bodies.reports.get(id) as Handler)({ text: 'two words' } as never);
    expect(w.rightPress(id).label).toBe('Copy text');
    leave(w);
    expect(w.rightPress(id).label).toBe('Copy message');
});

test('what he selected stays when the list grows or shrinks', () => {
    const w = createWindow(Array(5).fill(60), (px) => px);
    w.run(500);
    (w.bodies.reports.get('r1') as Handler)({ text: 'two words' } as never);
    w.told(VIEW - 40);
    w.run(100);
    expect(w.rightPress('r1').label).toBe('Copy text');
});

test('a click on a file row goes through the same door: one that would run is revealed', async () => {
    const w = createWindow(Array(5).fill(60), (px) => px);
    w.run(500);
    expect(await w.click('r2', false)).toEqual([['-R', '/tmp/x.command']]);
});

// herdr follows a link on any button's mouse-up, through an open menu and the viewer too
test('a link under the right-click menu or the viewer opens nothing', async () => {
    const w = createWindow(Array(5).fill(60), (px) => px);
    w.run(500);
    w.bodies.isViewerOpen = true;
    expect(await w.follow('r1', 'path:1')).toEqual([]);
    w.bodies.isViewerOpen = false;
    w.rightDown('r1');
    expect(await w.follow('r1', 'path:1')).toEqual([]);
});

// dima, 2026-11-25 16:26: «when scrolled to the very bottom via scroll, it does not disappear»
describe('the ↓ is there only off the very bottom', () => {
    const read = () => {
        const w = createWindow([...thread], (px) => px);
        w.run(1_000);
        w.scroll(-500);
        w.run(1_000);
        expect(w.isNewestShown()).toBe(true);
        return w;
    };

    test.each([
        ['one big step', [500]],
        ['a step past the end', [4_000]],
        ['many small ones', Array.from({ length: 50 }, () => 10)],
        ['momentum that dies at the end', [300, 120, 50, 20, 8, 2, 1, 1]],
    ])(
        '%s to the bottom takes it away, with no further step',
        (_how, steps) => {
            const w = read();
            for (const step of steps) {
                w.scroll(step);
                w.run(16);
            }
            w.run(1_000);
            expect(w.isNewestShown()).toBe(false);
        },
    );

    test('a glide that reaches the bottom after his last step takes it away', () => {
        const w = read();
        w.scroll(40);
        for (let i = 0; i < 20; i++) {
            w.run(16);
            w.glide(23);
        }
        w.run(1_000);
        expect(w.isNewestShown()).toBe(false);
    });

    test('one px up brings it back, and it stays', () => {
        const w = read();
        w.scroll(500);
        w.run(1_000);
        w.scroll(-1);
        w.run(1_000);
        expect(w.isNewestShown()).toBe(true);
    });

    test('the cards under the list shrink until its end is in view: it goes', () => {
        const w = createWindow([...thread], (px) => px);
        w.run(1_000);
        w.scroll(-100);
        w.run(1_000);
        expect(w.isNewestShown()).toBe(true);
        w.run(1_000);
        expect(kept.size).toBe(1);
        w.tall(150);
        w.run(1_000);
        expect(w.isNewestShown()).toBe(false);
        // the thread opens at the newest again
        expect(kept.size).toBe(0);
    });

    test('a thread that fits the view never shows it', () => {
        const w = createWindow([100, 100], (px) => px);
        w.run(1_000);
        w.scroll(-50);
        w.run(1_000);
        expect(w.isNewestShown()).toBe(false);
        // and its older page is asked for
        expect(w.earlier).toHaveLength(1);
    });

    // the 🔎's round 1: at a new width the list's end came under him while the rows were still laid out short
    test.each(
        [1, 4, 8, 20].flatMap((frames) =>
            [
                [300, 300, 300, 28, 2400, 300, 300, 28, 700, 1200],
                [300, 300, 300, 28, 700, 400, 900],
            ].map((heights) => ({ frames, heights })),
        ),
    )(
        'a new width keeps his place and the ↓, its rows short for $frames frames',
        ({ frames, heights }) => {
            const w = createWindow(heights, (px) => Math.min(px, 60), frames);
            w.run(2_500);
            for (let i = 0; i < 10; i++) {
                w.scroll(-40);
                w.run(16);
            }
            w.run(2_500);
            const at = heights.length - 2;
            const before = w.above(at);
            const saved = [...kept.values()];
            w.wide(700);
            w.run(2_500);
            // the list's end marks, 2 px, are not in his place
            expect(Math.abs(w.above(at) - before)).toBeLessThanOrEqual(2);
            expect(w.isNewestShown()).toBe(true);
            expect([...kept.values()]).toEqual(saved);
        },
    );

    test.each([
        ['a thread that fits the view', [100, 200], 'r1', 10],
        ['the last screen, come from the newest', thread, 'r9', 40],
    ] as const)(
        'a find hit in %s rests with none',
        (_where, heights, id, px) => {
            const w = createWindow([...heights], (h) => h);
            w.run(1_000);
            w.land(id, px);
            const early = w.run(2_000).drawn;
            expect(w.isNewestShown()).toBe(false);
            // at rest, not redrawn for good
            expect(w.run(1_000).drawn).toBe(early);
        },
    );

    test.each([16, 60, 120])(
        'a pixel up, then the cards under the list shrink, frames of %i ms: it goes',
        (ms) => {
            const w = createWindow([...thread], (px) => px, 1, ms);
            w.run(1_000);
            w.scroll(-1);
            w.run(1_000);
            w.tall(150);
            w.run(1_000);
            expect(w.isNewestShown()).toBe(false);
        },
    );

    test('a step that stops short of the bottom keeps it', () => {
        const w = read();
        w.scroll(490);
        w.run(1_000);
        expect(w.isNewestShown()).toBe(true);
    });
});

// FRM-585 A4
describe('the words a note is written on', () => {
    const words = (text: string, over: object = {}) => ({
        position: { x: 653, y: 282 },
        range: { end: text.length, start: 0 },
        text,
        ...over,
    });
    const rested = () => {
        const w = createWindow(Array(200).fill(60), (px) => px);
        w.run(1_000);
        const [first = '', second = ''] = [...w.frame.keys()].slice(2);
        return {
            first,
            second,
            select: (id: string, selection: object | null) =>
                (w.bodies.reports.get(id) as Handler)(selection as never),
            w,
        };
    };
    const passage = (id: string, text: string) => ({
        parts: [
            {
                block: 0,
                range: { end: text.length, start: 0 },
                source: 'the written source',
                words: text,
            },
        ],
        row: { at: undefined, id, kind: 'reply' },
    });

    test('stood selected at a press, with the place they end at in the list', () => {
        const { first, select, w } = rested();
        w.leftDown(600, 200);
        select(first, words('two words'));
        expect(w.selectedAt(Date.now())).toEqual({
            at: { x: 200, y: 200 },
            passage: passage(first, 'two words'),
        });
    });

    test('zoomed, the place is in the list’s own px', () => {
        const { first, select, w } = rested();
        gpui.seen.zoom = 2;
        w.leftDown(600, 200);
        select(first, words('two words'));
        expect(w.selectedAt(Date.now())?.at).toEqual({ x: 100, y: 100 });
        gpui.seen.zoom = 1;
    });

    test('a right press alone gives the place', () => {
        const { first, select, w } = rested();
        select(first, words('two words'));
        w.menu(first);
        expect(w.selectedAt(Date.now())?.at).toEqual({ x: 200, y: 200 });
    });

    test('a right press near the bottom: the menu stands whole above it', () => {
        const { first, second, select, w } = rested();
        select(first, words('two words'));
        expect(w.menu(second, VIEW - 10 + 82).top).toBe(VIEW - 10 - 34);
        expect(w.menu(first, VIEW - 11 + 82).top).toBe(VIEW - 11 - 34 - 26);
    });

    test('with no press in the list yet, or a select-all, no place', () => {
        const { first, select, w } = rested();
        select(first, words('two words'));
        expect(w.selectedAt(Date.now())?.at).toBeNull();
        w.leftDown(600, 200);
        select(first, words('two words', { position: undefined }));
        expect(w.selectedAt(Date.now())?.at).toBeNull();
    });

    test('let go by a press after F6 was pressed, they are still its', () => {
        const { first, select, w } = rested();
        select(first, words('two words'));
        const pressed = Date.now();
        w.run(16);
        select(first, null);
        expect(w.selectedAt(pressed)?.passage.parts[0]?.words).toBe(
            'two words',
        );
        expect(w.selectedAt(Date.now())).toBeNull();
    });

    test('gone with the row he scrolled away', () => {
        const { first, select, w } = rested();
        select(first, words('two words'));
        w.scroll(-900);
        w.run(40);
        expect(w.selectedAt(Date.now())).toBeNull();
    });

    test('in a text view its message’s fold left out, none', () => {
        const { first, select, w } = rested();
        select(first, words('two words'));
        w.bodies.texts = 0;
        expect(w.selectedAt(Date.now())).toBeNull();
    });

    test('in a message drawn anew since, none', () => {
        const { first, select, w } = rested();
        select(first, words('two words'));
        w.wide(700);
        w.run(40);
        expect(w.selectedAt(Date.now())).toBeNull();
    });

    test('the menu offers Annotate on the message that holds them alone, and opens the box on them', () => {
        const { first, second, select, w } = rested();
        w.leftDown(600, 200);
        select(first, words('two words'));
        expect(w.menu(second).items).toEqual(['Copy message']);
        const menu = w.menu(first);
        expect(menu.items).toEqual(['Copy text', 'Annotate']);
        menu.press('Annotate');
        expect(w.annotated).toEqual([
            { at: { x: 200, y: 200 }, passage: passage(first, 'two words') },
        ]);
    });
});

// FRM-585 B3: a note row is written while he reads further down, or taken away
test.each([
    ['lands above him', 1, true],
    ['lands under him', 6, false],
])(
    'a note row that %s, and goes again, moves nothing he reads, in no frame he sees',
    (_how, after, isHeld) => {
        const w = createWindow([...thread], (px) => px);
        w.run(1_000);
        w.land('r4', 60);
        w.run(2_000);
        w.scroll(5);
        w.run(2_000);
        const was = w.above(4);
        const seen = new Set<number>();
        let isUnseen = false;
        for (const [row, at] of [
            [after, after < 4 ? 5 : 4],
            [null, 4],
        ] as const) {
            w.noteAfter(row);
            for (let i = 0; i < 100; i++) {
                const { opacities } = w.run(16);
                if (opacities.at(-1) !== 0) seen.add(w.above(at));
                else isUnseen = true;
            }
        }
        expect([...seen]).toEqual([was]);
        expect(isUnseen).toBe(isHeld);
    },
);

test('a note row that was his first on screen, gone: the next one comes in its place', () => {
    const w = createWindow([...thread], (px) => px);
    w.run(1_000);
    w.noteAfter(3);
    w.run(1_000);
    w.land('r90', 10);
    w.run(2_000);
    w.noteAfter(null);
    w.run(2_000);
    expect(w.above(4)).toBe(0);
});

test('a draw between his wheel step and the list’s own keeps the place the step left', () => {
    const w = createWindow([...thread], (px) => px);
    w.run(1_000);
    w.land('r4', 60);
    w.run(2_000);
    w.scroll(-100, true);
    w.run(2_000);
    const was = w.above(2);
    w.noteAfter(0);
    w.run(2_000);
    expect(w.above(3)).toBe(was);
});

test('a press on a note’s row opens it where he pressed', () => {
    const w = createWindow([...thread], (px) => px);
    w.run(1_000);
    w.leftDown(600, 200);
    w.itemClick('r4');
    expect(w.annotated).toEqual([['n1', { x: 147, y: 118 }]]);
});
