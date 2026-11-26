import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// FRM-620:W79, dima 2026-11-25 16:27: a file dropped anywhere on the chat joins the quill. herdr gives a drop to one
// handler, the innermost under the pointer (0.1.18 vendor/gpui-pre div.rs takes the drag), so each pane has one
type Handler = (...args: unknown[]) => unknown;
const at = vi.hoisted(() => ({
    agents: [] as object[],
    box: new Map<string, Handler>(),
    layout: null as object | null,
    made: [] as { handlers: Map<string, Handler>; kids: unknown[] }[],
    props: {} as Record<string, unknown>,
    shared: new Map<string, unknown>(),
    timers: [] as ((() => void) & { ms: number })[],
    typed: '',
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
                on: (event: string, run: Handler) => at.box.set(event, run),
                selected_range: () => ({ end: 0, start: 0 }),
                value: () => at.typed,
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
    layout: () => at.layout,
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
const { NAMES_KEY } = await import('./thread-keys.js');
const { default: ChatHeader } = await import('../x-herdr-chat-header/main.js');

const cx = {
    notify: vi.fn(),
    timer: {
        after: (ms: number, run: (c: unknown) => void) =>
            at.timers.push(Object.assign(() => run(cx), { ms })),
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
        quillMini: unknown;
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
        annotateAsk: null,
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
        notePopup: quiet({ take: () => null }),
        pickers: quiet({
            confirmView: () => null,
            isOpen: () => false,
            note: () => null,
        }),
        pictures: quiet({ isOpen: () => false }),
        quill: quiet({ addFiles, box: () => ({}) }),
        quillMini: quiet({ isOpen: () => false }),
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
        [
            'with the note box open',
            { quillMini: quiet({ isOpen: () => true }) },
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
            'closes the viewer, the note box and find left as they are',
            { find: true, mini: true, viewer: true },
            ['viewer'],
        ],
        [
            'closes the note box, find left as it is',
            { find: true, mini: true },
            ['mini'],
        ],
        ['closes the viewer alone', { viewer: true }, ['viewer']],
        ['closes find with nothing over it', { find: true }, ['find']],
        ['else hands the keyboard to the chat', {}, ['chat']],
    ])('%s', (_how, isOpen: Record<string, boolean>, closed) => {
        const done: string[] = [];
        const view = loaded();
        view.chatKeys = { focus: () => done.push('chat') };
        view.findBar = {
            close: () => done.push('find'),
            find: { state: { isOpen: Boolean(isOpen.find) } },
        };
        view.pictures = {
            isOpen: () => Boolean(isOpen.viewer),
            step: () => done.push('viewer'),
        };
        view.quillMini = {
            close: () => done.push('mini'),
            isOpen: () => Boolean(isOpen.mini),
        };
        at.made.length = 0;
        (view.quill as never as { view: Handler }).view({});
        at.made
            .find((el) => el.handlers.has('x_herdr_chat_quill_escape'))
            ?.handlers.get('x_herdr_chat_quill_escape')?.({}, cx);
        expect(done).toEqual(closed);
    });
});

// FRM-585 A4, A5: the note box in the chat
describe('the note box', () => {
    /** the chat drawn with F6 asked for at its time, and what that did */
    const asked = (over: Record<string, unknown> = {}, time = Date.now()) => {
        const opened: unknown[] = [];
        const stops: unknown[] = [];
        at.shared.set('chat.annotate', null);
        const view = chat({
            list: quiet({ selectedAt: (pressed: number) => `at ${pressed}` }),
            quillMini: quiet({
                focus: () => opened.push('focus'),
                isOpen: () => false,
                toggle: (selected: () => unknown, pressed: number) =>
                    opened.push(selected(), pressed),
            }),
            tab: quiet({
                draw: (drawn: unknown) => {
                    stops.push(drawn);
                    return null;
                },
            }),
            ...over,
        });
        const draw = () => {
            view.render(cx);
            for (const run of at.timers.splice(0)) run();
        };
        draw();
        at.shared.set('chat.annotate', time);
        draw();
        draw();
        return { opened, stops: stops[0] };
    };

    test('a press on «tell» opens the box in a draw of the chat’s own, once (FRM-585 C1)', () => {
        const shown: unknown[] = [];
        const held = ['the words'];
        const view = chat({
            notePopup: quiet({ take: () => held.shift() ?? null }),
            quillMini: quiet({
                isOpen: () => false,
                show: (selected: unknown) => shown.push(selected),
            }),
        });
        const draw = () => {
            view.render(cx);
            for (const run of at.timers.splice(0)) run();
        };
        draw();
        at.shared.set('chat.tell', Date.now());
        draw();
        draw();
        expect(shown).toEqual(['the words']);
    });

    test('a click on a note’s words opens that note in a draw of the chat’s own (FRM-585 B5)', () => {
        const opened: unknown[] = [];
        const view = chat({
            notePopup: quiet({ take: () => null }),
            quillMini: quiet({
                isOpen: () => false,
                openNote: (id: unknown, at: unknown) => opened.push(id, at),
            }),
        }) as never as { noteAsk: string | null; render: (c: unknown) => void };
        const draw = () => {
            view.render(cx);
            for (const run of at.timers.splice(0)) run();
        };
        draw();
        view.noteAsk = 'n1';
        at.shared.set('chat.tell', Date.now());
        draw();
        draw();
        expect(opened).toEqual(['n1', null]);
    });

    test('F6 takes the words that stood at its press, once', () => {
        const time = Date.now() - 20;
        expect(asked({}, time).opened).toEqual([`at ${time}`, time]);
    });

    test.each([
        ['3 s old', {}, 3000],
        [
            'with the viewer open',
            { pictures: quiet({ isOpen: () => true }) },
            0,
        ],
    ])('F6 %s does nothing', (_how, over, age) => {
        expect(asked(over, Date.now() - age).opened).toEqual([]);
    });

    test('F6 over an open find bar works', () => {
        const findBar = quiet({ find: { state: { isOpen: true } } });
        expect(asked({ findBar }).opened).toHaveLength(2);
    });

    test('F6 with the chat not on screen does nothing', () => {
        at.props = { self: 'chat', stack: 'main' };
        at.layout = {
            children: [{ active: 'terminal', children: [], id: 'main' }],
        };
        expect(asked().opened).toEqual([]);
        at.layout = null;
    });

    test('its stop is in the Tab loop only while it is open', () => {
        expect(asked().stops).toEqual(['quill']);
        const quillMini = quiet({ isOpen: () => true });
        expect(asked({ quillMini }).stops).toEqual(['quill', 'quill-mini']);
    });

    test('the loop’s turn gives it the keyboard', () => {
        const tab = quiet({ draw: () => 'quill-mini' });
        expect(asked({ tab }, 0).opened).toContain('focus');
    });

    test('the quill under a ⌘Enter that sent the note sends nothing of its own till ⌘ is let go', () => {
        const pressed = vi.fn();
        const view = loaded();
        Object.assign(view.sendPath as object, {
            press: pressed,
            push: pressed,
        });
        const quill = view.quill as never as {
            focus: (isSending: boolean) => void;
            view: Handler;
        };
        at.typed = 'the quill’s own';
        quill.focus(true);
        at.made.length = 0;
        quill.view({});
        const on = (name: string) =>
            at.made.find((el) => el.handlers.has(name))?.handlers.get(name);
        at.box.get('submit')?.({ secondary: true }, cx);
        expect(pressed).not.toHaveBeenCalled();
        on('on_modifiers_changed')?.({ modifiers: { platform: false } }, cx);
        at.box.get('submit')?.({ secondary: true }, cx);
        expect(pressed).toHaveBeenCalledTimes(1);
    });

    test('a message’s replies are counted under the row an older page joined it to', () => {
        const view = chat({
            model: {
                indexOf: () => 1,
                rows: [
                    { id: 'line', kind: 'mine' },
                    { id: 'page-row', kind: 'reply' },
                    { id: 'b', kind: 'reply' },
                ],
            },
        }) as never as { repliesUnder: (id: string) => number };
        expect(view.repliesUnder('line')).toBe(1);
    });

    test('the thread is named as the fleet names it, else by its title', () => {
        const view = chat() as never as { threadName: () => string };
        expect(view.threadName()).toBe('');
        at.agents.push(
            { address: 't9', title: 'x' },
            { address: 't1', title: 'a title' },
        );
        expect(view.threadName()).toBe('a title');
        at.shared.set(NAMES_KEY, { t1: '🦉 clio', t9: 'other' });
        expect(view.threadName()).toBe('🦉 clio');
        at.agents.splice(0);
    });

    test.each([
        ['an older page joined', 0, 'page-row'],
        ['not loaded', -1, 'line'],
    ])('a message whose row is %s', (_how, index, row) => {
        const view = chat({
            model: { indexOf: () => index, rows: [{ id: 'page-row' }] },
        }) as never as { rowOf: (id: string) => string };
        expect(view.rowOf('line')).toBe(row);
    });

    test('a thread switched from shuts it and its popup', () => {
        const reset = vi.fn();
        const hide = vi.fn();
        const view = chat({
            heights: quiet(),
            model: { clear: () => {}, rows: [] },
            notePopup: quiet({ hide }),
            quillMini: quiet({ reset }),
            sendPath: quiet(),
        }) as never as { clearShown: (cx: unknown) => void };
        view.clearShown({});
        expect([reset.mock.calls.length, hide.mock.calls.length]).toEqual([
            1, 1,
        ]);
    });

    test.each([
        ['stays with it', true, []],
        ['goes to the chat without it', false, ['chat']],
    ])(
        'a press from the quill into it: the keyboard %s',
        (_how, isOpen, focused) => {
            const done: string[] = [];
            const view = chat({
                chatKeys: { focus: () => done.push('chat') },
                quillMini: quiet({ isOpen: () => isOpen }),
            }) as never as { leaveQuill: (c: unknown) => void };
            view.leaveQuill(cx);
            expect(done).toEqual(focused);
        },
    );
});

// FRM-620:W84: the quill is not drawn while the thread opens, so a focus given at the switch was lost with it
describe('a thread he switches to', () => {
    type Over = {
        file?: string;
        hasPicker?: boolean;
        hasViewer?: boolean;
        held?: string;
        isHere?: boolean;
        isLoaded?: boolean;
        stops?: string[];
    };
    const open = (over: Over = {}) => {
        const focused: string[] = [];
        const state = {
            file: over.file ?? null,
            isFresh: true,
            isOpening: true,
            isPickerOpen: Boolean(over.hasPicker),
            isViewerOpen: Boolean(over.hasViewer),
        };
        at.shared.set('tab.held', over.held ?? null);
        at.shared.set('tab.stops.x-herdr-deck', over.stops ?? []);
        const view = chat({
            chatKeys: {
                focus: () => focused.push('chat'),
                is_focused: () => over.isHere ?? true,
            },
            feed: quiet({
                address: () => 't1',
                error: () => null,
                file: () => state.file,
                follow: () => {
                    const was = state.isFresh;
                    state.isFresh = false;
                    return was;
                },
                isOpening: () => state.isOpening,
                isRead: () => Boolean(state.file),
                isStart: () => false,
                shownAddress: () => 't1',
            }),
            isLoaded: over.isLoaded ?? true,
            keys: 'none',
            openedCount: 0,
            pickers: quiet({
                clear: () => {
                    state.isPickerOpen = false;
                },
                isOpen: () => state.isPickerOpen,
            }),
            pictures: quiet({
                close: () => {
                    state.isViewerOpen = false;
                },
                isOpen: () => state.isViewerOpen,
                keepKeys: () => {},
            }),
            quill: quiet({
                box: () => ({}),
                focus: () => focused.push('quill'),
                isFocused: () => false,
            }),
            wasShown: over.isLoaded ?? true,
        });
        const timers = () => {
            for (const run of at.timers.splice(0)) run();
        };
        return {
            /** Terminal view was shown since */
            comeBack() {
                Object.assign(view, { wasShown: false });
            },
            draw() {
                view.render(cx);
                timers();
            },
            focused,
            render: () => view.render(cx),
            state,
            /** its Claude is found, its quill drawn */
            there() {
                state.isOpening = false;
                state.file = '/t.jsonl';
            },
            timers,
        };
    };
    const layout = { root: { mod: 'x-herdr-deck' } };
    beforeEach(() => {
        at.agents.push({ address: 't1', app: 'claude-code', tab: 'tab' });
        at.layout = layout;
    });
    afterEach(() => {
        at.agents.splice(0);
        at.layout = null;
    });

    test('has the cursor in its quill once it is drawn', () => {
        const w = open();
        w.draw();
        w.draw();
        w.there();
        w.draw();
        w.draw();
        expect(w.focused).toEqual(['chat', 'quill']);
    });

    test('whose Claude has no session file yet, once it has one', () => {
        const w = open();
        w.draw();
        w.state.isOpening = false;
        w.draw();
        expect(w.focused).toEqual(['chat']);
        w.there();
        w.draw();
        expect(w.focused).toEqual(['chat', 'quill']);
    });

    test('with the one he left still under it: its quill, about to go, gets nothing', () => {
        const w = open({ file: '/left.jsonl' });
        w.draw();
        w.draw();
        expect(w.focused).toEqual(['chat']);
        w.there();
        w.draw();
        expect(w.focused).toEqual(['chat', 'quill']);
    });

    test.each([
        ['viewer', { hasViewer: true }],
        ['picker', { hasPicker: true }],
    ])('from one with the %s open: it goes with it', (_what, over) => {
        const w = open(over);
        w.draw();
        w.there();
        w.draw();
        expect(w.focused).toEqual(['chat', 'quill']);
    });

    test('asks for a draw once herdr’s focus is past: no other may come', () => {
        const w = open();
        w.state.isFresh = false;
        w.comeBack();
        w.render();
        w.there();
        cx.notify.mockClear();
        w.timers();
        expect(cx.notify).toHaveBeenCalled();
    });

    test.each([
        ['viewer', { hasViewer: true }, 'isViewerOpen' as const],
        ['picker', { hasPicker: true }, 'isPickerOpen' as const],
    ])(
        'the chat on screen again with its %s open leaves the keyboard to it',
        (_what, over, isOpen) => {
            const w = open(over);
            w.state.isFresh = false;
            w.there();
            w.comeBack();
            w.draw();
            expect(w.focused).toEqual([]);
            expect(w.state[isOpen]).toBe(true);
        },
    );

    test('a steer box he typed in before a switch keeps nothing', () => {
        const w = open({
            held: 'steer-a:o1',
            isLoaded: false,
            stops: ['steer-a:o1'],
        });
        w.draw();
        w.there();
        w.state.isFresh = true;
        w.draw();
        expect(w.focused).toEqual(['quill']);
    });

    test('and from there to a third at once: the first one’s landing is not its', () => {
        const w = open();
        w.render();
        w.state.isFresh = true;
        w.render();
        const landings = at.timers.filter((run) => run.ms === 50);
        expect(landings).toHaveLength(2);
        landings[0]?.();
        expect(w.focused).toEqual([]);
        w.timers();
        expect(w.focused).toEqual(['chat']);
    });

    test('and ⌘K while it opens: no keyboard to the quill that goes', () => {
        const w = open();
        w.draw();
        at.shared.set('chat.quill', Date.now());
        w.draw();
        expect(w.focused).toEqual(['chat', 'chat']);
        w.there();
        w.draw();
        expect(w.focused.at(-1)).toBe('quill');
    });

    test('left for a tab with no Claude before it landed, takes nothing', () => {
        const w = open();
        w.render();
        at.agents.splice(0);
        w.render();
        w.timers();
        w.there();
        w.draw();
        expect(w.focused).toEqual([]);
    });

    test('a box he clicked meanwhile keeps the cursor', () => {
        const w = open({ isHere: false });
        w.draw();
        w.there();
        w.draw();
        w.draw();
        expect(w.focused).toEqual(['chat']);
    });

    test.each([
        ['a steer box drawn in the deck keeps the cursor', ['steer-a:o1'], []],
        ['a steer box gone since does not', [], ['chat', 'quill']],
        [
            'the note box, shut by it, does not',
            ['quill', 'quill-mini'],
            ['chat', 'quill'],
            'quill-mini',
        ],
    ])(
        'a reload of the chat: %s',
        (_what, stops, focused, held = 'steer-a:o1') => {
            const w = open({ held, isLoaded: false, stops });
            w.draw();
            w.there();
            w.draw();
            expect(w.focused).toEqual(focused);
        },
    );
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
