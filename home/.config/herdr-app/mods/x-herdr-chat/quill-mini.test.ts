import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { SelectedAt } from './selection.js';

type Handler = (...args: never[]) => unknown;
type El = {
    handlers: Map<string, Handler>;
    id: string | null;
    kids: unknown[];
    tooltip: string | null;
};
const at = vi.hoisted(() => ({
    box: {
        focused: 0,
        on: new Map<string, (event: unknown, cx: unknown) => void>(),
        text: '',
    },
    keys: [] as { action: string; context: string; keystroke: string }[],
    timers: [] as { ms: number; run: () => void }[],
}));
const { make } = vi.hoisted(() => ({
    make: (): unknown => {
        const el: El = {
            handlers: new Map(),
            id: null,
            kids: [],
            tooltip: null,
        };
        const self: unknown = new Proxy(el, {
            get(target, name) {
                if (name === 'raw') return target;
                return (...args: unknown[]) => {
                    if (name === 'id') target.id = String(args[0]);
                    else if (name === 'tooltip')
                        target.tooltip = String(args[0]);
                    else if (name === 'child') target.kids.push(args[0]);
                    else if (name === 'when') {
                        if (args[0]) (args[1] as (el: unknown) => void)(self);
                    } else if (String(name).startsWith('on_'))
                        target.handlers.set(
                            name === 'on_action'
                                ? String(args[0])
                                : name === 'on_mouse_down'
                                  ? `${name}_${args[0]}`
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
vi.mock('herdr', () => ({ exec: vi.fn() }));
vi.mock('gpui-kit', () => ({ div: make }));
vi.mock('gpui-base', () => ({
    Textarea: { new: () => 'the box' },
    TextareaState: {
        new: () => ({
            focus: () => {
                at.box.focused += 1;
            },
            on: (event: string, run: (e: unknown, cx: unknown) => void) =>
                at.box.on.set(event, run),
            set_auto_grow: () => {},
            set_selected_range: () => {},
            set_value: (text: string) => {
                at.box.text = text;
            },
            value: () => at.box.text,
        }),
    },
    h_flex: make,
    v_flex: make,
}));
const { createQuillMini, miniPlace } = await import('./quill-mini.js');
const { createNotes } = await import('./notes.js');

const raw = (el: unknown) =>
    el && typeof el === 'object' ? ((el as { raw?: El }).raw ?? null) : null;
const all = (el: unknown): El[] => {
    const own = raw(el);
    return own ? [own, ...own.kids.flatMap(all)] : [];
};
const ON = { joined: [], taken: [] };
const selected = (words: string, id = 'r1'): SelectedAt => ({
    at: { x: 40, y: 100 },
    passage: {
        parts: [
            {
                block: 0,
                range: { end: words.length, start: 0 },
                source: words,
                words,
            },
        ],
        row: { at: null, id, kind: 'reply' },
    },
});
const settle = async () => {
    for (let i = 0; i < 60; i++) await Promise.resolve();
};

function world() {
    const files = new Map<string, string>();
    const writes: string[] = [];
    const said = {
        escapes: 0,
        quill: 0,
        sent: [] as string[],
        sentAnswer: null as string | null,
        tabs: [] as [string, boolean][],
    };
    const now = {
        joins: ON as { joined: string[]; taken: string[] } | null,
        thread: '/t/a.jsonl' as string | null,
    };
    const kept = new Map<string, string>();
    let ids = 0;
    const notes = createNotes({
        dir: '/joins',
        io: {
            lock: async () => true,
            lockAge: async () => 0,
            now: () => 0,
            read: async (path) => files.get(path) ?? null,
            sleep: async () => {},
            unlock: async () => {},
            write: async (path, text) => {
                writes.push(text);
                files.set(path, text);
            },
        },
        linesWith: async () => [],
        logTrial: () => {},
        newId: () => `id-${++ids}`,
        store: {
            getItem: (key) => kept.get(key) ?? null,
            removeItem: (key) => kept.delete(key),
            setItem: (key, text) => kept.set(key, text),
        },
    });
    const cx = {
        bind_keys: (keys: typeof at.keys) => at.keys.push(...keys),
        notify: () => {},
        spawn: (job: (c: unknown) => unknown) => job(cx),
        stop_propagation: () => {},
        timer: {
            after: (ms: number, run: (c: unknown) => void) =>
                at.timers.push({ ms, run: () => run(cx) }),
        },
    };
    const mini = createQuillMini({
        back: () => 2,
        focusQuill: () => {
            said.quill += 1;
        },
        joins: () => now.joins,
        notes,
        pressEscape: () => {
            said.escapes += 1;
        },
        room: () => ({ height: 600, width: 800 }),
        sendNote: async (id: string) => {
            said.sent.push(id);
            const out = await notes.release('/t/a.jsonl', id, now.joins, 2);
            if ('reason' in out) return out.reason;
            if (said.sentAnswer)
                notes.returned('/t/a.jsonl', id, said.sentAnswer);
            return said.sentAnswer;
        },
        tab: {
            ask: (from: string, isBack: boolean) =>
                said.tabs.push([from, isBack]),
            held: () => {},
            left: () => {},
        },
        thread: () => now.thread,
        threadName: () => 'clio',
    } as never);
    mini.start(cx as never);
    const el = () => mini.view({} as never);
    const words = () =>
        all(el()).flatMap((e) =>
            e.kids.filter((kid): kid is string => typeof kid === 'string'),
        );
    const byId = (id: string) => all(el()).find((e) => e.id === id);
    const act = (action: string) =>
        raw(el())?.handlers.get(action)?.({} as never, cx as never);
    return {
        act,
        button: (id: string) =>
            byId(id)?.handlers.get('on_click')?.({} as never, cx as never),
        byId,
        cx,
        f6: (on: SelectedAt | null = selected('some words')) =>
            mini.toggle(() => on, cx as never),
        mini,
        note: (thread = '/t/a.jsonl') => notes.of(thread)[0] ?? null,
        notes,
        now,
        press: (action: string) => {
            act(action);
            raw(el())?.handlers.get('on_key_up')?.(
                { key: 'enter' } as never,
                cx as never,
            );
        },
        root: () => raw(el()),
        rows: () => files.get('/joins/a.jsonl') ?? '',
        run: () => {
            for (const { run } of at.timers.splice(0)) run();
        },
        said,
        type: (text: string) => {
            at.box.text = text;
            at.box.on.get('change')?.({}, cx);
        },
        words,
        writes,
    };
}
const ENTER = 'x_herdr_chat_mini_enter';
const CMD_ENTER = 'x_herdr_chat_mini_cmd_enter';

beforeEach(() => {
    at.box.focused = 0;
    at.box.text = '';
    at.keys.length = 0;
    at.timers.length = 0;
});

describe('F6 (FRM-585 A4)', () => {
    test('with words selected, the box opens on them with the cursor in it', () => {
        const w = world();
        w.f6();
        expect(w.mini.isOpen()).toBe(true);
        expect(w.words()).toEqual(
            expect.arrayContaining(['"some words"', 'clio', 'the box']),
        );
        w.run();
        expect(at.box.focused).toBe(1);
    });

    test('with none, nothing', () => {
        const w = world();
        w.f6(null);
        expect([w.mini.isOpen(), w.root(), w.note()]).toEqual([
            false,
            null,
            null,
        ]);
    });

    test('with the box open it shuts, the keyboard to the quill, the draft kept and back at the next', () => {
        const w = world();
        w.f6();
        w.type('mine');
        w.f6(selected('other words', 'r2'));
        expect([w.mini.isOpen(), w.said.quill, w.note()?.text]).toEqual([
            false,
            1,
            'mine',
        ]);
        w.f6();
        expect(at.box.text).toBe('mine');
    });

    test('shut before the cursor came, it takes no keyboard', () => {
        const w = world();
        w.f6();
        w.f6();
        w.run();
        expect(at.box.focused).toBe(0);
    });

    test('an emptied draft leaves no record', () => {
        const w = world();
        w.f6();
        w.type('mine');
        w.type('');
        w.f6();
        expect(w.note()).toBeNull();
    });

    test('a thread not yet read opens none', () => {
        const w = world();
        w.now.thread = null;
        w.f6();
        expect(w.mini.isOpen()).toBe(false);
    });
});

test('a switch of thread shuts it and keeps the draft under its own thread, the keyboard left alone', () => {
    const w = world();
    w.f6();
    w.type('mine');
    w.now.thread = '/t/b.jsonl';
    w.mini.reset();
    expect([w.mini.isOpen(), w.said.quill]).toEqual([false, 0]);
    expect([w.note()?.text, w.note('/t/b.jsonl')]).toEqual(['mine', null]);
});

test('a press outside shuts it, one on it stays on it', () => {
    const w = world();
    w.f6();
    w.type('mine');
    const stopped = vi.fn();
    w.root()?.handlers.get('on_mouse_down_left')?.(
        {} as never,
        { stop_propagation: stopped } as never,
    );
    expect([stopped.mock.calls.length, w.mini.isOpen()]).toEqual([1, true]);
    w.act('on_mouse_down_out');
    expect([w.mini.isOpen(), w.note()?.text]).toEqual([false, 'mine']);
});

describe('its keys (A5)', () => {
    test('each is bound on the box itself, before the box’s own; Shift+Enter is the box’s', () => {
        world();
        expect(at.keys.map((k) => k.keystroke).sort()).toEqual([
            'cmd-enter',
            'enter',
            'escape',
            'shift-tab',
            'tab',
        ]);
        expect(new Set(at.keys.map((k) => k.context))).toEqual(
            new Set(['XChatQuillMini > Input']),
        );
    });

    test('Esc asks the chat what is on top; Tab and Shift-Tab walk the loop from its stop', () => {
        const w = world();
        w.f6();
        w.act('x_herdr_chat_mini_escape');
        w.act('x_herdr_chat_mini_tab');
        w.act('x_herdr_chat_mini_back');
        expect([w.said.escapes, w.said.tabs]).toEqual([
            1,
            [
                ['quill-mini', false],
                ['quill-mini', true],
            ],
        ]);
    });

    test('Enter joins, again takes it back', async () => {
        const w = world();
        w.f6();
        w.type('mine');
        w.press(ENTER);
        await settle();
        expect(w.note()?.state).toBe('waiting');
        expect(w.rows()).toContain('2 back): mine');
        expect(w.words()).toEqual(
            expect.arrayContaining(['waiting', 'take back']),
        );
        w.press(ENTER);
        await settle();
        expect([w.note()?.state, w.rows().trim()]).toEqual(['draft', '']);
        expect(w.words()).toContain('join');
    });

    test('a held Enter acts once', async () => {
        const w = world();
        w.f6();
        w.type('mine');
        w.act(ENTER);
        w.act(ENTER);
        await settle();
        expect(w.note()?.state).toBe('waiting');
    });

    test('an empty note neither joins nor goes', async () => {
        const w = world();
        w.f6();
        w.type('  ');
        w.press(ENTER);
        w.act(CMD_ENTER);
        await settle();
        expect([w.note()?.state, w.said.sent, w.rows()]).toEqual([
            'draft',
            [],
            '',
        ]);
        expect(w.byId('chat-mini-join')?.handlers.has('on_click')).toBe(false);
    });

    test('with joins off Enter says so and sends nothing', async () => {
        const w = world();
        w.now.joins = null;
        w.f6();
        w.type('mine');
        w.press(ENTER);
        await settle();
        expect(w.words()).toContain(
            'Joins are off for this thread: ⌘Enter sends it now',
        );
        expect([w.said.sent, w.rows()]).toEqual([[], '']);
    });

    test('⌘Enter sends it and the box goes', async () => {
        const w = world();
        w.f6();
        w.type('mine');
        w.act(CMD_ENTER);
        await settle();
        expect([w.said.sent.length, w.note()?.state]).toEqual([1, 'sent']);
        expect([w.mini.isOpen(), w.said.quill]).toEqual([false, 1]);
    });

    test('a send that did not go says why, his words still his', async () => {
        const w = world();
        w.said.sentAnswer = 'Not sent: herdr refused it';
        w.f6();
        w.type('mine');
        w.act(CMD_ENTER);
        // a held key's repeat, the send under way
        w.act(CMD_ENTER);
        expect(w.said.sent).toHaveLength(1);
        await settle();
        expect([w.mini.isOpen(), w.note()?.state, w.note()?.text]).toEqual([
            true,
            'draft',
            'mine',
        ]);
        expect(w.words()).toContain('Not sent: herdr refused it');
        // and his next key lets the line go
        w.type('mine too');
        expect(w.words()).not.toContain('Not sent: herdr refused it');
    });

    test('the buttons are the keys', async () => {
        const w = world();
        w.f6();
        w.type('mine');
        expect(w.byId('chat-mini-join')?.tooltip).toContain('(Enter)');
        expect(w.byId('chat-mini-send')?.tooltip).toContain('(⌘Enter)');
        w.button('chat-mini-join');
        await settle();
        expect(w.note()?.state).toBe('waiting');
        w.button('chat-mini-send');
        await settle();
        expect(w.note()?.state).toBe('sent');
    });
});

describe('a waiting note typed on (A2)', () => {
    test('its row carries the words once his keys rest, the last of them alone', async () => {
        const w = world();
        w.f6();
        w.type('mine');
        w.press(ENTER);
        await settle();
        at.timers.length = 0;
        w.type('mine t');
        w.type('mine too');
        expect(at.timers.map((t) => t.ms)).toEqual([400, 400]);
        w.run();
        await settle();
        expect(w.rows()).toContain('): mine too');
        expect(w.writes.some((text) => text.includes('): mine t"'))).toBe(
            false,
        );
        expect(w.note()?.text).toBe('mine too');
    });

    test('a turn that took it locks the box, its word still waiting', async () => {
        const w = world();
        w.f6();
        w.type('mine');
        w.press(ENTER);
        await settle();
        w.now.joins = { joined: [], taken: [w.note()?.joinId ?? ''] };
        await w.notes.settle('/t/a.jsonl', w.now.joins);
        expect(w.words()).toEqual(expect.arrayContaining(['mine', 'waiting']));
        expect(w.words()).not.toContain('the box');
        w.press(ENTER);
        w.act(CMD_ENTER);
        await settle();
        expect([w.note()?.state, w.said.sent]).toEqual(['taken', []]);
    });
});

describe('where it sits', () => {
    const view = { h: 600, w: 800 };
    const size = { h: 130, w: 420 };
    test.each([
        ['under the words’ end', { x: 40, y: 100 }, { x: 40, y: 112 }],
        ['over it near the bottom', { x: 40, y: 560 }, { x: 40, y: 418 }],
        ['left of the right edge', { x: 790, y: 100 }, { x: 368, y: 112 }],
        ['inside on the left', { x: -30, y: 100 }, { x: 0, y: 112 }],
        ['inside at the top', { x: 40, y: -90 }, { x: 40, y: 0 }],
        ['at the bottom middle with no place', null, { x: 190, y: 458 }],
    ])('%s', (_where, end, place) => {
        expect(miniPlace(end, view, size)).toEqual(place);
    });

    test('in a list too small for it, at its corner', () => {
        expect(miniPlace({ x: 10, y: 10 }, { h: 100, w: 300 }, size)).toEqual({
            x: 0,
            y: 0,
        });
    });
});
