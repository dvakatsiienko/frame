import { beforeEach, describe, expect, test, vi } from 'vitest';

type Handler = (...args: unknown[]) => unknown;
type El = { id: string | null; kids: unknown[]; on: Map<string, Handler> };
const { make } = vi.hoisted(() => ({
    make: (): unknown => {
        const el: El = { id: null, kids: [], on: new Map() };
        const self: unknown = new Proxy(el, {
            get(target, name) {
                if (name === 'raw') return target;
                return (...args: unknown[]) => {
                    if (name === 'id') target.id = String(args[0]);
                    else if (name === 'child') target.kids.push(args[0]);
                    else if (name === 'children')
                        target.kids.push(...(args[0] as unknown[]));
                    else if (name === 'when' && args[0])
                        (args[1] as (el: unknown) => void)(self);
                    else if (typeof name === 'string' && name.startsWith('on_'))
                        target.on.set(name, args.at(-1) as Handler);
                    return self;
                };
            },
        });
        return self;
    },
}));
const at = vi.hoisted(() => ({
    lanes: [] as unknown[],
    opened: [] as string[][],
}));
vi.mock('gpui-kit', () => ({ div: make }));
vi.mock('gpui-base', () => ({ h_flex: make, v_flex: make }));
vi.mock('herdr', () => ({
    exec: async (program: string, args: string[]) => {
        if (program === 'open') at.opened.push(args);
        return { code: 0, stdout: '' };
    },
    focused: () => null,
    home: () => '/Users/me',
    readTextFile: async () => JSON.stringify({ lanes: at.lanes }),
    run: vi.fn(),
    theme: () => ({}),
    watchFolder: () => new Promise(() => {}),
}));
const { createGlide } = await import('./glide-view.js');

const all = (el: unknown): El[] => {
    const own =
        el && typeof el === 'object' ? (el as { raw?: El }).raw : undefined;
    return own ? [own, ...own.kids.flatMap(all)] : [];
};
const lane = (id: string, plan?: string) => ({
    current: 0,
    id,
    items: [
        { isDone: false, text: `${id} one`, ticket: 'FRM-639' },
        { isDone: false, text: `${id} two` },
    ],
    title: `herdr — ${id}`,
    ...(plan ? { plan } : {}),
});
const memory = () => {
    const kept = new Map<string, string>();
    return {
        getItem: (key: string) => kept.get(key) ?? null,
        setItem: (key: string, value: string) => void kept.set(key, value),
    };
};
const cx = () => ({
    focus_handle: () => ({ focus: vi.fn() }),
    notify: vi.fn(),
    spawn: (run: (cx: unknown) => unknown) => void run(cx()),
    stop_propagation: vi.fn(),
    // a drop's settle ends at once: his next press is a fresh one
    timer: { after: (_ms: number, fire: (cx: unknown) => void) => fire(cx()) },
});
/** a glide copy started over the store, its first read drawn */
const started = async (store = memory()) => {
    const glide = createGlide('glide', store);
    glide.init(cx() as never);
    await new Promise((done) => setTimeout(done, 0));
    return { glide, store };
};
const drawn = (glide: { render: () => unknown }) => all(glide.render());
const byId = (glide: { render: () => unknown }, id: string) => {
    const hit = drawn(glide).find((e) => e.id === id);
    if (!hit) throw new Error(`${id} is not drawn`);
    return hit;
};
const order = (glide: { render: () => unknown }) =>
    drawn(glide)
        .map((e) => e.id)
        .filter((id) => id?.startsWith('lane-l'))
        .map((id) => id?.slice('lane-'.length));
const steps = (glide: { render: () => unknown }, id: string) =>
    new Set(
        byId(glide, `lane-${id}`)
            .kids.flatMap(all)
            .flatMap((e) => e.kids)
            .filter((k) => typeof k === 'string' && k.startsWith(`${id} `)),
    ).size;

// each card 40 px tall, 8 apart: one slot is 48 px
const press = (glide: { render: () => unknown }, id: string, y: number) =>
    byId(glide, `lane-${id}`).on.get('on_mouse_down')?.(
        {
            bounds: { height: 40, width: 200 },
            local_position: { x: 10, y: 10 },
            position: { x: 10, y },
        },
        cx(),
    );
const move = (glide: { render: () => unknown }, y: number) =>
    byId(glide, 'x-herdr-glide-zone').on.get('on_mouse_move')?.(
        { local_position: { x: 10, y }, position: { x: 10, y } },
        cx(),
    );
const release = (glide: { render: () => unknown }) =>
    byId(glide, 'x-herdr-glide-zone').on.get('on_mouse_up')?.({}, cx());
/** he drags a card by `slots` places, up when negative */
const dragBy = (
    glide: { render: () => unknown },
    id: string,
    slots: number,
) => {
    press(glide, id, 200);
    move(glide, 200 + slots * 24);
    move(glide, 200 + slots * 48);
    release(glide);
};

beforeEach(() => {
    at.lanes = [lane('l1'), lane('l2'), lane('l3')];
    at.opened.length = 0;
});

test("a card named by hand has its step's ticket as its pill (FRM-527:W137)", async () => {
    at.lanes = [
        {
            current: 1,
            id: 'l121',
            items: [
                { isDone: true, text: 'a', ticket: 'FRM-689' },
                { isDone: false, text: 'b', ticket: 'FRM-639' },
            ],
            title: 'mods — a card named by hand',
        },
    ];
    const { glide } = await started();
    expect(byId(glide, 'lane-ticket-l121').kids).toEqual(['FRM-639']);
});

// FRM-527 step 161, exits 1–4
describe('he drags a card to change the order', () => {
    test('the third dragged above the first holds through a reload, and a fourth card lands last', async () => {
        const { glide, store } = await started();
        dragBy(glide, 'l3', -2);
        expect(order(glide)).toEqual(['l3', 'l1', 'l2']);
        at.lanes = [...at.lanes, lane('l4')];
        const again = await started(store);
        expect(order(again.glide)).toEqual(['l3', 'l1', 'l2', 'l4']);
    });

    test('a lane that ends leaves, the others keep their places', async () => {
        const { glide, store } = await started();
        dragBy(glide, 'l3', -2);
        at.lanes = [lane('l2'), lane('l3')];
        expect(order((await started(store)).glide)).toEqual(['l3', 'l2']);
    });

    test('a lane that comes back as a new card of its plan keeps its place', async () => {
        at.lanes = [
            lane('l1', '~/.local/state/x/lanes/a/lane-plan.md'),
            lane('l2'),
            lane('l3'),
        ];
        const { glide, store } = await started();
        dragBy(glide, 'l3', -2);
        expect(order(glide)).toEqual(['l3', 'l1', 'l2']);
        at.lanes = [
            lane('l2'),
            lane('l3'),
            lane('l9', '/Users/me/.local/state/x/lanes/a/lane-plan.md'),
        ];
        expect(order((await started(store)).glide)).toEqual(['l3', 'l9', 'l2']);
    });

    test('a click opens a card to every step and folds it again; a drag does neither', async () => {
        const { glide } = await started();
        expect(steps(glide, 'l1')).toBe(1);
        press(glide, 'l1', 200);
        release(glide);
        expect(steps(glide, 'l1')).toBe(2);
        dragBy(glide, 'l1', 1);
        expect(steps(glide, 'l1')).toBe(2);
        press(glide, 'l1', 200);
        release(glide);
        expect(steps(glide, 'l1')).toBe(1);
    });

    test('a press on the ticket pill lifts no card, and its click opens the ticket', async () => {
        const { glide } = await started();
        const c = cx();
        byId(glide, 'lane-ticket-l1').on.get('on_mouse_down')?.({}, c);
        expect(c.stop_propagation).toHaveBeenCalled();
        byId(glide, 'lane-ticket-l1').on.get('on_click')?.({}, cx());
        await new Promise((done) => setTimeout(done, 0));
        expect(at.opened).toEqual([['https://linear.app/x-com/issue/FRM-639']]);
    });

    test('a drag past the glide’s edge springs home and moves nothing', async () => {
        const { glide, store } = await started();
        press(glide, 'l3', 200);
        move(glide, 104);
        byId(glide, 'x-herdr-glide-zone').on.get('on_hover')?.(false, cx());
        release(glide);
        expect(order(glide)).toEqual(['l1', 'l2', 'l3']);
        expect(order((await started(store)).glide)).toEqual(['l1', 'l2', 'l3']);
    });
});
