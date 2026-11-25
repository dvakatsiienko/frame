import { expect, test, vi } from 'vitest';

// herdr's one JavaScript runtime, by its source (0.1.18 vendor/gpui-kit/crates/shell engine/quickjs scheduler.rs, scope.rs):
// `localStorage` is the store of the copy whose call is on the stack; a native call keeps the copy it was made under and
// its answer runs there; but what `init` left queued runs inside the next call, whichever mod's
const at = vi.hoisted(() => ({
    files: new Map<string, string>(),
    scope: 'deck',
    stores: { deck: {}, other: {} } as Record<string, Record<string, string>>,
}));
const native = <T>(answer: () => T) => {
    const made = at.scope;
    return new Promise<T>((done) =>
        setTimeout(() => {
            at.scope = made;
            done(answer());
        }, 0),
    );
};
type Handler = (e: unknown, cx: unknown) => void;
const boxes: { on: Map<string, Handler>; value: () => string }[] = [];

vi.mock('herdr', () => ({
    agents: () => [],
    appHome: () => '/app',
    exec: () =>
        native(() => ({
            code: 0,
            stderr: '',
            stdout: '7 Wed Nov 25 10:00:00 2026',
        })),
    home: () => '/Users/me',
    layout: () => null,
    nextCommand: () => new Promise(() => {}),
    notify: vi.fn(),
    props: () => null,
    readTextFile: (path: string) => native(() => at.files.get(path) ?? null),
    run: vi.fn(),
    setShared: vi.fn(),
    shared: () => null,
    theme: () => ({}),
    watchFolder: () => new Promise(() => {}),
    writeTextFile: vi.fn(),
}));
vi.mock('fs/promises', () => ({
    readdir: () => native(() => ['a.json']),
    unlink: async () => {},
}));
vi.mock('gpui-kit', () => ({ View: class {}, div: vi.fn() }));
vi.mock('gpui-base', () => ({
    InputState: {
        new: ({ value }: { value: string }) => {
            const made = at.scope;
            let text = value;
            const on = new Map<string, Handler>();
            const box = {
                on: (name: string, handler: Handler) =>
                    on.set(name, (e, cx) => {
                        at.scope = made;
                        handler(e, cx);
                    }),
                set_value: (next: string) => {
                    text = next;
                },
                value: () => text,
            };
            boxes.push({ on, value: () => text });
            return box;
        },
    },
}));
vi.stubGlobal('localStorage', {
    getItem: (key: string) => at.stores[at.scope]?.[key] ?? null,
    key: (i: number) => Object.keys(at.stores[at.scope] ?? {})[i] ?? null,
    get length() {
        return Object.keys(at.stores[at.scope] ?? {}).length;
    },
    removeItem: (key: string) => delete at.stores[at.scope]?.[key],
    setItem: (key: string, value: string) => {
        at.stores[at.scope] = { ...at.stores[at.scope], [key]: value };
    },
});

const { default: Deck } = await import('./main.js');

const cx: Record<string, unknown> = {
    bind_keys: () => {},
    notify: () => {},
    on_action: () => {},
    spawn: (run: (c: unknown) => Promise<void>) => void run(cx),
    timer: {
        after: (ms: number, run: (c: unknown) => void) => {
            const made = at.scope;
            const id = setTimeout(() => {
                at.scope = made;
                run(cx);
            }, ms);
            return { cancel: () => clearTimeout(id) };
        },
        every: () => ({ cancel() {} }),
    },
};

// dima's board, 2026-11-25: after a deck landing a steer drew empty (13:44) and a 🆕 was gone (14:08), both still kept
test('a deck landed again draws the steer and the 🆕 it kept, and keeps what he types next', async () => {
    const shelf = '/Users/me/.claude/shelf';
    at.files.set(
        `${shelf}/threads.json`,
        JSON.stringify({
            threads: [{ name: 'clio', pid: 7, sessionId: 'a' }],
        }),
    );
    at.files.set(
        `${shelf}/herdr-state/a.json`,
        JSON.stringify({
            asks: [{ id: 'o1', pick: 'yes', text: 'look: the card' }],
            at: 1,
            pid: 7,
            sid: 'a',
        }),
    );
    at.stores.deck = {
        seen: JSON.stringify({ 'a:o1': 'look: the card\nyes' }),
        'steer:a:o1': 'my unsent words',
        updated: JSON.stringify(['a:o1']),
    };
    const deck = new Deck() as unknown as {
        init: (props: unknown, cx: unknown) => void;
        steers: Map<string, { value: () => string }>;
        updated: Set<string> | null;
    };
    deck.init({}, cx);
    // init's own call is over: the next one to run is another mod's
    at.scope = 'other';
    await new Promise((done) => setTimeout(done, 100));

    expect(deck.steers.get('a:o1')?.value()).toBe('my unsent words');
    expect([...(deck.updated ?? [])]).toEqual(['a:o1']);
    expect(at.stores.other).toEqual({});

    const box = boxes.at(-1);
    at.stores.deck['steer:a:o1'] = '';
    box?.on.get('change')?.({}, cx);
    expect(at.stores.deck['steer:a:o1']).toBe('my unsent words');
});
