import { expect, test, vi } from 'vitest';

type El = { id: string | null; kids: unknown[] };
const { make } = vi.hoisted(() => ({
    make: (): unknown => {
        const el: El = { id: null, kids: [] };
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
                    return self;
                };
            },
        });
        return self;
    },
}));
vi.mock('gpui-kit', () => ({ div: make }));
vi.mock('gpui-base', () => ({ h_flex: make, v_flex: make }));
vi.mock('herdr', () => ({
    exec: vi.fn(),
    home: () => '/Users/me',
    readTextFile: async () =>
        JSON.stringify({
            lanes: [
                {
                    current: 1,
                    id: 'l121',
                    items: [
                        { isDone: true, text: 'a', ticket: 'FRM-689' },
                        { isDone: false, text: 'b', ticket: 'FRM-639' },
                    ],
                    title: 'mods — a card named by hand',
                },
            ],
        }),
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

test("a card named by hand has its step's ticket as its pill (FRM-527:W137)", async () => {
    const cx = {
        notify: vi.fn(),
        spawn: (run: (cx: unknown) => unknown) => void run(cx),
        timer: { after: vi.fn() },
    };
    const glide = createGlide('glide');
    glide.init(cx as never);
    await new Promise((done) => setTimeout(done, 0));
    const pill = all(glide.render()).find((e) => e.id === 'lane-ticket-l121');
    expect(pill?.kids).toEqual(['FRM-639']);
});
