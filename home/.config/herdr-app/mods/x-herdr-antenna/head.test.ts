import { beforeEach, describe, expect, test, vi } from 'vitest';

/** an element as antenna builds it: its id, its tooltip, what it holds */
type El = { id: string | null; kids: unknown[]; tooltip: string | null };
const at = vi.hoisted(() => ({
    agents: [] as object[],
    shared: new Map<string, unknown>(),
}));
const { make } = vi.hoisted(() => ({
    make: (): unknown => {
        const el: El = { id: null, kids: [], tooltip: null };
        const self: unknown = new Proxy(el, {
            get(target, name) {
                if (name === 'raw') return target;
                return (...args: unknown[]) => {
                    if (name === 'id') target.id = String(args[0]);
                    else if (name === 'tooltip')
                        target.tooltip = String(args[0]);
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
vi.mock('gpui-kit', () => ({ View: class {}, div: make, svg: make }));
vi.mock('gpui-base', () => ({ h_flex: make, v_flex: make }));
vi.mock('fs/promises', () => ({ readdir: async () => [] }));
vi.mock('herdr', () => ({
    agents: () => at.agents,
    closeOverlay: vi.fn(),
    exec: vi.fn(),
    hc: vi.fn(),
    home: () => '/Users/me',
    layout: () => ({}),
    nextCommand: () => new Promise(() => {}),
    openOverlay: vi.fn(),
    props: () => null,
    readTextFile: async () => null,
    run: vi.fn(),
    setAgentOrder: vi.fn(),
    setShared: (key: string, value: unknown) => at.shared.set(key, value),
    shared: (key: string) => at.shared.get(key) ?? null,
    terminals: () => [],
    theme: () => ({}),
    window: () => null,
    writeTextFile: vi.fn(),
}));
const kept = new Map<string, string>();
vi.stubGlobal('localStorage', {
    getItem: (key: string) => kept.get(key) ?? null,
    removeItem: (key: string) => kept.delete(key),
    setItem: (key: string, value: string) => kept.set(key, value),
});
const { default: Antenna } = await import('./main.js');
const { NAMES } = await import('./thread-names.js');

const cx = {
    bind_keys: vi.fn(),
    focus_handle: () => ({ focus: vi.fn(), is_focused: () => false }),
    notify: vi.fn(),
    spawn: vi.fn(),
    timer: { after: vi.fn(), every: vi.fn() },
};
const raw = (el: unknown) =>
    el && typeof el === 'object' ? ((el as { raw?: El }).raw ?? null) : null;
/** every element drawn under one */
const all = (el: unknown): El[] => {
    const own = raw(el);
    return own ? [own, ...own.kids.flatMap(all)] : [];
};
const wordsIn = (el: unknown) =>
    all(el).flatMap((e) =>
        e.kids.filter((kid): kid is string => typeof kid === 'string'),
    );

/** ten threads over two spaces, `working` of them at work, as the deck publishes their state files */
function drawn(working: string[], knobs = {}, pins: string[] = []) {
    at.agents = Array.from({ length: 10 }, (_, i) => ({
        address: `t${i + 1}`,
        focused: false,
        pane: `p${i + 1}`,
        space: i < 5 ? 'sA' : 'sB',
        space_name: i < 5 ? 'frame' : 'bytes',
        status: 'done',
        title: `thread ${i + 1}`,
    }));
    for (let i = 1; i <= 10; i++)
        NAMES.set(`t${i}`, { at: 0, isRead: true, name: `n${i}`, pid: i });
    at.shared.set('antenna.settings', knobs);
    at.shared.set('x-herdr-deck.threads', {
        threads: Object.fromEntries(
            Array.from({ length: 10 }, (_, i) => [
                String(i + 1),
                {
                    since: 0,
                    state: working.includes(`t${i + 1}`) ? 'working' : 'idle',
                },
            ]),
        ),
    });
    kept.set('pins', JSON.stringify(pins));
    kept.set('order', JSON.stringify(at.agents.map((_, i) => `t${i + 1}`)));
    kept.set('seeded', 'true');
    const view = new Antenna();
    view.init(null, cx as never);
    const root = view.render(cx as never);
    const byId = (id: string) => all(root).find((e) => e.id === id);
    return {
        pill: byId('an-busy'),
        space: (space: string) =>
            wordsIn({ raw: byId(`sp-${space}`) ?? { kids: [] } }),
    };
}

describe("antenna's head and its spaces as drawn (FRM-620:W86, W87)", () => {
    const GROUPED = { 'antenna.groupBySpace': true };
    beforeEach(() => {
        at.shared.clear();
        kept.clear();
    });

    test('four of ten, its words on a hover', () => {
        const { pill } = drawn(['t1', 't2', 't6', 't7']);
        expect(pill?.kids).toEqual(['4/10']);
        expect(pill?.tooltip).toBe('4 working of 10 threads');
    });

    test('each space by its name, a pinned thread in its own', () => {
        const { pill, space } = drawn(['t1', 't2', 't6'], GROUPED, ['t1']);
        expect(pill?.kids).toEqual(['3/10']);
        expect(space('sA')).toEqual(['frame', '2/5']);
        expect(space('sB')).toEqual(['bytes', '1/5']);
    });

    test('ungrouped, the total alone', () => {
        const { pill, space } = drawn([]);
        expect(pill?.kids).toEqual(['0/10']);
        expect(space('sA')).toEqual([]);
    });
});
