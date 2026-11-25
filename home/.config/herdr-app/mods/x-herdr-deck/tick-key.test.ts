import { beforeEach, describe, expect, test, vi } from 'vitest';

type Handler = (...args: unknown[]) => unknown;
/** an element as the deck builds it: its id, its children and its hover handler */
type El = { children: unknown[]; hover: Handler | null; id: string | null };

// the whole deck drawn on stub elements, its ⌘⇧K sent the way herdr sends it: the wiring between the pure picks (FRM-620)
const gpui = vi.hoisted(() => {
    const make = (id: unknown = null): unknown => {
        const el = {
            children: [] as unknown[],
            hover: null as unknown,
            id,
        };
        const self: unknown = new Proxy(el, {
            get(target, name) {
                if (name === 'raw') return target;
                return (...args: unknown[]) => {
                    if (name === 'id') target.id = args[0];
                    else if (name === 'child') target.children.push(args[0]);
                    else if (name === 'children')
                        target.children.push(...(args[0] as unknown[]));
                    else if (name === 'on_hover') target.hover = args[0];
                    else if (name === 'when' && args[0])
                        (args[1] as Handler)(self);
                    return self;
                };
            },
        });
        return self;
    };
    return { make };
});
const herdr = vi.hoisted(() => ({
    command: null as null | ((name: string) => void),
    focused: null as string | null,
    shared: new Map<string, unknown>(),
    view: 'chat',
}));

vi.mock('herdr', () => ({
    agents: () =>
        herdr.focused ? [{ address: herdr.focused, focused: true }] : [],
    appHome: () => '/app',
    exec: async () => ({ code: 1, stderr: '', stdout: '' }),
    home: () => '/Users/me',
    layout: () => ({
        root: {
            children: [
                {
                    active: herdr.view,
                    children: [
                        { content: { mod: 'x-herdr-chat' }, id: 'chat' },
                        { content: { tab: 'active' }, id: 'main' },
                    ],
                    id: 'views',
                    type: 'stack',
                },
                { content: { mod: 'x-herdr-deck' }, id: 'orbit' },
            ],
            id: 'root',
            type: 'row',
        },
    }),
    nextCommand: () =>
        new Promise<string>((done) => {
            herdr.command = done;
        }),
    notify: vi.fn(),
    props: () => null,
    readTextFile: async () => null,
    run: vi.fn(),
    setShared: vi.fn(),
    shared: (key: string) => herdr.shared.get(key) ?? null,
    theme: () => new Proxy({}, { get: () => '#101010' }),
    watchFolder: () => new Promise(() => {}),
    writeTextFile: vi.fn(),
}));
vi.mock('fs/promises', () => ({ readdir: async () => [], unlink: vi.fn() }));
vi.mock('gpui-kit', () => ({
    View: class {},
    div: () => gpui.make(),
    image: () => gpui.make(),
    svg: () => gpui.make(),
}));
vi.mock('gpui-base', () => ({
    Button: { new: gpui.make },
    Input: { new: gpui.make },
    InputState: { new: () => ({ on: vi.fn(), value: () => '' }) },
    TextView: { markdown: () => gpui.make() },
    h_flex: () => gpui.make(),
    v_flex: () => gpui.make(),
}));
vi.stubGlobal('localStorage', {
    getItem: () => null,
    key: () => null,
    length: 0,
    removeItem: () => {},
    setItem: () => {},
});

const { CHAT_SHOWN, DECK_TOGGLED } = await import('../_shared/chat-asks.js');
const { PIDS_KEY } = await import('./orbit.js');
const { default: Deck } = await import('./main.js');

const cx: Record<string, unknown> = {
    bind_keys: () => {},
    notify: () => {},
    on_action: () => {},
    spawn: (run: (c: unknown) => Promise<void>) => void run(cx),
    timer: {
        after: () => ({ cancel() {} }),
        every: () => ({ cancel() {} }),
    },
};

const ask = (text: string) => ({
    id: 'o1',
    isGated: false,
    isLocked: false,
    link: null,
    mark: null,
    pick: 'yes',
    text,
});
const row = (sid: string, pid: number, ...texts: string[]) => ({
    asks: texts.map(ask),
    name: `thread ${sid}`,
    pending: new Map(),
    phases: [],
    pid,
    sid,
    status: 'idle',
    taken: 0,
});

/** a deck in its window: drawn rows, the pointer over a group, the key */
function createDeck() {
    const deck = new Deck() as unknown as {
        init: (props: unknown, cx: unknown) => void;
        pressAll: (cx: unknown, row: { sid: string }) => void;
        render: (cx: unknown) => { raw: El };
        rows: unknown[];
    };
    const ticked: string[] = [];
    deck.pressAll = (_cx, s) => ticked.push(s.sid);
    deck.init({}, cx);
    let drawn: El | null = null;
    const all = (el: El | null): El[] =>
        el
            ? [
                  el,
                  ...el.children.flatMap((c) =>
                      all((c as { raw?: El } | null)?.raw ?? null),
                  ),
              ]
            : [];
    return {
        draw(...rows: unknown[]) {
            deck.rows = rows;
            drawn = deck.render(cx).raw;
        },
        hover(sid: string, isOn = true) {
            all(drawn)
                .find((el) => el.id === `asker-${sid}`)
                ?.hover?.(isOn);
        },
        async press() {
            herdr.command?.('tickall');
            await new Promise((done) => setTimeout(done, 0));
            return ticked.splice(0);
        },
        words: () =>
            all(drawn).flatMap((el) =>
                el.children.filter((c) => typeof c === 'string'),
            ),
    };
}

const clio = row('clio', 1, 'plain ask');
const wing = row('wing', 2, 'plain ask');

beforeEach(() => {
    herdr.focused = 't1';
    herdr.view = 'chat';
    herdr.shared.clear();
    herdr.shared.set(PIDS_KEY, { t1: 1, t2: 2 });
});

describe('⌘⇧K, from the key to the thread it ticks', () => {
    test('the group under the pointer, then the open thread once the pointer left', async () => {
        const deck = createDeck();
        deck.draw(clio, wing);
        deck.hover('wing');
        expect(await deck.press()).toEqual(['wing']);
        deck.hover('wing', false);
        expect(await deck.press()).toEqual(['clio']);
    });

    test('a hover from before ⌘E is none', async () => {
        const deck = createDeck();
        deck.draw(clio, wing);
        deck.hover('wing');
        herdr.shared.set(DECK_TOGGLED, Date.now() + 1);
        expect(await deck.press()).toEqual(['clio']);
    });

    test('a group that left while hovered is no hover when its asks come back', async () => {
        const deck = createDeck();
        deck.draw(clio, wing);
        deck.hover('wing');
        deck.draw(clio, row('wing', 2));
        deck.draw(clio, wing);
        expect(await deck.press()).toEqual(['clio']);
    });

    test('a thread antenna has not read yet ticks nobody, whatever the chat says', async () => {
        const deck = createDeck();
        deck.draw(clio, wing);
        herdr.focused = 't9';
        herdr.shared.set(CHAT_SHOWN, { address: 't9' });
        expect(await deck.press()).toEqual([]);
    });

    test('with no thread focused: the one the chat on screen shows, nobody in Terminal view', async () => {
        const deck = createDeck();
        deck.draw(clio, wing);
        herdr.focused = null;
        herdr.shared.set(CHAT_SHOWN, { address: 't2' });
        expect(await deck.press()).toEqual(['wing']);
        herdr.view = 'main';
        expect(await deck.press()).toEqual([]);
    });
});

// FRM-620:W63 (dima, 14:15): «if one sender sends multiple look/test cards, only one sender section header is drawn»
test('look and test cards of one sender draw under its one heading', () => {
    const deck = createDeck();
    deck.draw(row('clio', 1, '👀 look: one', '🧪 test: two'));
    expect(deck.words().filter((w) => w === 'thread clio')).toEqual([
        'thread clio',
    ]);
});
