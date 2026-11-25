import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// FRM-620:W79, dima 2026-11-25 16:27: a file dropped anywhere on the chat joins the quill. herdr gives a drop to one
// handler, the innermost under the pointer (0.1.18 vendor/gpui-pre div.rs takes the drag), so each pane has one
type Handler = (...args: unknown[]) => unknown;
const at = vi.hoisted(() => ({
    agents: [] as object[],
    made: [] as { handlers: Map<string, Handler>; kids: unknown[] }[],
    props: {} as Record<string, unknown>,
    shared: new Map<string, unknown>(),
    timers: [] as (() => void)[],
}));
const { element } = vi.hoisted(() => ({
    element: (): unknown => {
        const el = {
            handlers: new Map<string, Handler>(),
            kids: [] as unknown[],
        };
        at.made.push(el);
        const self: unknown = new Proxy(el, {
            get(target, name) {
                if (name === 'handlers') return target.handlers;
                if (name === 'kids') return target.kids;
                return (...args: unknown[]) => {
                    if (name === 'child') target.kids.push(args[0]);
                    if (name === 'when' && args[0]) (args[1] as Handler)(self);
                    if (String(name).startsWith('on_'))
                        target.handlers.set(
                            name === 'on_action'
                                ? String(args[0])
                                : String(name),
                            args.at(-1) as Handler,
                        );
                    return self;
                };
            },
        });
        return self;
    },
}));
// a part of the chat this test says nothing about: any call answers another
const quiet = (over: Record<string, unknown> = {}): unknown =>
    new Proxy(() => undefined, {
        apply: () => quiet(),
        get: (_t, name) => (name in over ? over[String(name)] : quiet()),
    });

vi.mock('gpui-kit', () => ({
    View: class {},
    div: element,
    image: element,
    svg: element,
}));
vi.mock('gpui-base', () => ({
    Button: { new: element },
    InputState: { new: () => quiet() },
    Popover: { new: element },
    Switch: { new: element },
    TextView: { markdown: element },
    Textarea: { new: element },
    TextareaState: {
        new: () =>
            quiet({
                focus: vi.fn(),
                selected_range: () => ({ end: 0, start: 0 }),
                value: () => '',
            }),
    },
    VirtualListScrollHandle: { new: () => quiet() },
    h_flex: element,
    v_flex: element,
    v_virtual_list: element,
}));
vi.mock('fs/promises', () => ({}));
vi.mock('herdr', () => ({
    agents: () => at.agents,
    appHome: () => '/app',
    exec: vi.fn(),
    focused: () =>
        at.agents.length ? { agent: 't1', tab: 'tab', terminal: 't1' } : null,
    home: () => '/Users/me',
    layout: () => null,
    panes: () => [{ pane: 'p1', tab: 'tab', terminal: 't1' }],
    props: () => at.props,
    readTextFile: vi.fn(),
    run: vi.fn(),
    setShared: (key: string, value: unknown) => at.shared.set(key, value),
    settings: () => ({}),
    shared: (key: string) => at.shared.get(key),
    theme: () => ({}),
    watchFolder: vi.fn(),
    writeTextFile: vi.fn(),
}));
vi.stubGlobal('localStorage', {
    getItem: () => null,
    key: () => null,
    length: 0,
    removeItem: () => {},
    setItem: () => {},
});

const { default: Chat } = await import('./main.js');
const { default: ChatHeader } = await import('../x-herdr-chat-header/main.js');

const cx = {
    notify: vi.fn(),
    timer: {
        after: (_ms: number, run: (c: unknown) => void) =>
            at.timers.push(() => run(cx)),
    },
};
const addFiles = vi.fn();
/** the chat as it loads, its own quill and pickers started */
const loaded = () => {
    const view = new Chat() as never as {
        chatKeys: unknown;
        dropAsk: number | null;
        findBar: unknown;
        pickers: { start: Handler };
        pictures: unknown;
        quill: { start: Handler };
    };
    const starting = {
        ...cx,
        bind_keys: vi.fn(),
        focus_handle: () => quiet(),
        spawn: vi.fn(),
    };
    view.quill.start(starting);
    view.pickers.start(starting);
    return view;
};
/** the chat as it draws a thread, its parts quiet but the quill */
const chat = (over: Record<string, unknown> = {}) => {
    const view = Object.assign(Object.create(Chat.prototype), {
        band: quiet(),
        blocked: quiet(),
        chatKeys: null,
        dropAsk: null,
        effortAsk: null,
        feed: quiet({
            address: () => 't1',
            error: () => null,
            file: () => '/t.jsonl',
            follow: () => false,
            isRead: () => true,
            isStart: () => false,
        }),
        findBar: quiet({ find: { state: { isOpen: false } } }),
        list: quiet(),
        model: { rows: [] },
        note: null,
        pickers: quiet({
            confirmView: () => null,
            isOpen: () => false,
            note: () => null,
        }),
        pictures: quiet({ isOpen: () => false }),
        quill: quiet({ addFiles, box: () => ({}) }),
        rows: quiet({ shown: () => [] }),
        settingsWindow: null,
        tab: quiet({ draw: () => null }),
        viewAsk: null,
        ...over,
    });
    return view as {
        render: (c: unknown) => { handlers: Map<string, Handler> };
    };
};
/** every element drawn that takes a drop */
const takers = (draw: () => unknown) => {
    at.made.length = 0;
    draw();
    return at.made.filter((el) => el.handlers.has('on_drop'));
};

beforeEach(() => {
    addFiles.mockClear();
    at.shared.clear();
    at.timers.length = 0;
    at.props = {};
});

describe('a file dropped on the chat', () => {
    test.each([
        ['as it reads', {}],
        [
            'with find open',
            { findBar: quiet({ find: { state: { isOpen: true } } }) },
        ],
        [
            'with the viewer over it',
            { pictures: quiet({ isOpen: () => true }) },
        ],
    ])('joins the quill, %s, by the pane’s one handler', (_how, over) => {
        const view = chat(over);
        const [pane, ...more] = takers(() => view.render(cx));
        expect(more).toEqual([]);
        // over everything the chat draws: a link or the viewer under the pointer takes a drop's mouse-up
        const root = view.render(cx) as unknown as {
            kids: { handlers?: Map<string, Handler> }[];
        };
        expect(root.kids.at(-1)?.handlers?.has('on_drop')).toBe(true);
        expect([...(pane?.handlers.keys() ?? [])]).toEqual(['on_drop']);
        pane?.handlers.get('on_drop')?.({ paths: ['/a.png', '/b.md'] }, cx);
        expect(addFiles.mock.calls).toEqual([[['/a.png', '/b.md'], cx]]);
    });
});

test('with the real quill and pickers drawn, two take a drop: the open picker over the pane, and the pane', () => {
    const { pickers, quill } = loaded();
    const made = takers(() => chat({ pickers, quill }).render(cx));
    expect(made.map((el) => [...el.handlers.keys()])).toEqual([
        [
            'on_drop',
            'x_herdr_chat_effort_left',
            'x_herdr_chat_effort_right',
            'x_herdr_chat_effort_apply',
            'x_herdr_chat_effort_close',
        ],
        ['on_drop'],
    ]);
});

describe('a file dropped on the chat’s header', () => {
    const header = (view: string) => {
        at.props = { pane: 'p1', view };
        at.shared.set('chat.shown', { address: 't1', isFindOpen: false });
        return takers(() => Object.create(ChatHeader.prototype).render());
    };

    test('reaches the quill of the thread it was dropped over, once', () => {
        const [row] = header('chat');
        row?.handlers.get('on_drop')?.({ paths: ['/a.png'] }, cx);
        at.props = {};
        const view = chat();
        for (const _draw of [1, 2]) view.render(cx);
        for (const run of at.timers) run();
        expect(addFiles.mock.calls).toEqual([[['/a.png'], cx]]);
    });

    test('is not taken again by a chat loaded after it', () => {
        const [row] = header('chat');
        row?.handlers.get('on_drop')?.({ paths: ['/a.png'] }, cx);
        at.props = {};
        chat({ dropAsk: loaded().dropAsk }).render(cx);
        for (const run of at.timers) run();
        expect(addFiles).not.toHaveBeenCalled();
    });

    test('over the Terminal view it takes none, as before', () => {
        expect(header('terminal')).toEqual([]);
    });
});

// dima, 2026-11-25 16:31: Esc left the viewer open and herdr said «x_herdr_chat_find_close failed»; a mod's key no
// handler claims is an error in herdr (0.1.18 window.rs run_action)
describe('Esc over the chat', () => {
    const press = (over: Record<string, unknown>) => {
        const step = vi.fn();
        const close = vi.fn();
        const propagate = vi.fn();
        const view = chat({
            findBar: quiet({
                close,
                find: { state: { isOpen: over.isFindOpen } },
            }),
            pictures: quiet({ isOpen: () => over.isViewerOpen, step }),
        });
        at.made.length = 0;
        view.render(cx);
        const root = at.made.find((el) =>
            el.handlers.has('x_herdr_chat_find_close'),
        );
        root?.handlers.get('x_herdr_chat_find_close')?.(
            {},
            { ...cx, propagate },
        );
        return {
            find: close.mock.calls.length,
            passedOn: propagate.mock.calls.length,
            viewer: step.mock.calls.map(([to]) => to),
        };
    };

    test('closes the viewer, find under it left as it is', () => {
        expect(press({ isFindOpen: true, isViewerOpen: true })).toEqual({
            find: 0,
            passedOn: 0,
            viewer: ['close'],
        });
    });

    test('closes find with no viewer open', () => {
        expect(press({ isFindOpen: true, isViewerOpen: false })).toEqual({
            find: 1,
            passedOn: 0,
            viewer: [],
        });
    });

    test('with neither open is taken in silence', () => {
        expect(press({ isFindOpen: false, isViewerOpen: false })).toEqual({
            find: 0,
            passedOn: 0,
            viewer: [],
        });
    });
});

describe('Esc in the quill', () => {
    test.each([
        [
            'closes the viewer, find under it left as it is',
            true,
            true,
            ['viewer'],
        ],
        ['closes the viewer alone', true, false, ['viewer']],
        ['closes find with no viewer open', false, true, ['find']],
        ['else hands the keyboard to the chat', false, false, ['chat']],
    ])('%s', (_how, isViewerOpen, isFindOpen, closed) => {
        const done: string[] = [];
        const view = loaded();
        view.chatKeys = { focus: () => done.push('chat') };
        view.findBar = {
            close: () => done.push('find'),
            find: { state: { isOpen: isFindOpen } },
        };
        view.pictures = {
            isOpen: () => isViewerOpen,
            step: () => done.push('viewer'),
        };
        at.made.length = 0;
        (view.quill as never as { view: Handler }).view({});
        at.made
            .find((el) => el.handlers.has('x_herdr_chat_quill_escape'))
            ?.handlers.get('x_herdr_chat_quill_escape')?.({}, cx);
        expect(done).toEqual(closed);
    });
});

// FRM-620:W84: the quill is not drawn while the thread opens, so a focus given at the switch was lost with it
describe('a thread he switches to', () => {
    const drawnSwitch = (isHere: boolean, isGone = false) => {
        const focused: string[] = [];
        let isOpening = true;
        const isFresh = [true];
        const view = chat({
            chatKeys: {
                focus: () => focused.push('chat'),
                is_focused: () => isHere,
            },
            feed: quiet({
                address: () => 't1',
                error: () => null,
                file: () => (isOpening ? null : '/t.jsonl'),
                follow: () => isFresh.pop() ?? false,
                isOpening: () => isOpening,
                isRead: () => !isOpening,
                isStart: () => false,
                shownAddress: () => 't1',
            }),
            isLoaded: true,
            keys: 'none',
            quill: quiet({
                box: () => ({}),
                focus: () => focused.push('quill'),
                isFocused: () => false,
            }),
            wasShown: true,
        });
        const draw = () => {
            view.render(cx);
            for (const run of at.timers.splice(0)) run();
        };
        if (isGone) {
            view.render(cx);
            at.agents.splice(0);
        }
        draw();
        draw();
        isOpening = false;
        draw();
        draw();
        return focused;
    };
    beforeEach(() =>
        at.agents.push({ address: 't1', app: 'claude-code', tab: 'tab' }),
    );
    afterEach(() => at.agents.splice(0));

    test('has the cursor in its quill once it is drawn', () => {
        expect(drawnSwitch(true)).toEqual(['chat', 'quill']);
    });

    test('left for a tab with no Claude before it landed, takes nothing', () => {
        expect(drawnSwitch(true, true)).toEqual([]);
    });

    test('a box he clicked meanwhile keeps the cursor', () => {
        expect(drawnSwitch(false)).toEqual(['chat']);
    });
});

test('⌘F with the viewer open opens no find under it', () => {
    const open = vi.fn();
    const find = { state: { isOpen: false } };
    for (const isOpen of [true, false]) {
        const view = chat({
            findBar: quiet({ find, open }),
            pictures: quiet({ isOpen: () => isOpen }),
        });
        at.made.length = 0;
        view.render(cx);
        at.made
            .find((el) => el.handlers.has('x_herdr_chat_find'))
            ?.handlers.get('x_herdr_chat_find')?.({}, cx);
    }
    expect(open).toHaveBeenCalledTimes(1);
});
