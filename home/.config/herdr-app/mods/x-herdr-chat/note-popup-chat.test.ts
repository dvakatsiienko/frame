import { expect, test, vi } from 'vitest';

// FRM-585 C1, the 🔎's round 1 on 152+153: the chat's own wiring of «tell», the list's reports in, its setting row
type Handler = (...args: unknown[]) => unknown;
const at = vi.hoisted(() => ({
    list: null as Record<string, Handler> | null,
    selected: null as unknown,
}));
// a part of the chat this test says nothing about: any call answers another
const { quiet } = vi.hoisted(() => {
    const quiet = (over: Record<string, unknown> = {}): unknown =>
        new Proxy(() => undefined, {
            apply: () => quiet(),
            get: (_t, name) => (name in over ? over[String(name)] : quiet()),
        });
    return { quiet };
});

vi.mock('gpui-kit', () => ({
    View: class {},
    div: () => quiet(),
    image: () => quiet(),
    svg: () => quiet(),
}));
vi.mock('gpui-base', () => ({
    Button: { new: () => quiet() },
    InputState: { new: () => quiet() },
    Popover: { new: () => quiet() },
    Switch: { new: () => quiet() },
    TextView: { markdown: () => quiet() },
    Textarea: { new: () => quiet() },
    TextareaState: { new: () => quiet() },
    VirtualListScrollHandle: { new: () => quiet() },
    h_flex: () => quiet(),
    v_flex: () => quiet(),
    v_virtual_list: () => quiet(),
}));
vi.mock('fs/promises', () => ({}));
vi.mock('herdr', () => ({
    agents: () => [],
    appHome: () => '/app',
    exec: vi.fn(),
    focused: () => null,
    home: () => '/Users/me',
    layout: () => null,
    panes: () => [],
    props: () => ({}),
    readTextFile: vi.fn(),
    run: vi.fn(),
    setShared: () => {},
    settings: () => ({}),
    shared: () => undefined,
    theme: () => ({}),
    watchFolder: vi.fn(),
    writeTextFile: vi.fn(),
}));
vi.mock('./message-list.js', () => ({
    createMessageList: (deps: Record<string, Handler>) => {
        at.list = deps;
        return quiet({ selectedAt: () => at.selected });
    },
}));
vi.stubGlobal('localStorage', {
    getItem: () => null,
    key: () => null,
    length: 0,
    removeItem: () => {},
    setItem: () => {},
});

const { default: Chat } = await import('./main.js');

const words = {
    at: { x: 40, y: 200 },
    passage: { parts: [], row: { at: null, id: 'r1', kind: 'reply' } },
};

/** the chat as made, its «tell» started, the list's reports in reach */
function chat() {
    const view = new Chat() as never as {
        applySettings: (values: Record<string, unknown>) => void;
        notePopup: { isShown: () => boolean; start: Handler };
    };
    const notified: unknown[] = [];
    const cx = {
        new: () => ({ name: 'the popup' }),
        notify: (...args: unknown[]) => notified.push(args[0] ?? 'the chat'),
        timer: { after: () => ({ cancel: () => {} }) },
    };
    view.notePopup.start(cx);
    const list = at.list as Record<string, Handler>;
    return { cx, list, notified, view };
}

test('words he selected redraw only «tell», never the chat, whose redraw drops the selection', () => {
    const { cx, list, notified, view } = chat();
    at.selected = words;
    list.selected?.(cx);
    expect(view.notePopup.isShown()).toBe(true);
    expect(notified).toEqual([{ name: 'the popup' }]);
});

test('a scroll of the list hides it', () => {
    const { cx, list, view } = chat();
    at.selected = words;
    list.selected?.(cx);
    list.scrolled?.(cx);
    expect(view.notePopup.isShown()).toBe(false);
});

test('its settings row switched off, no selection shows it; on again, one does', () => {
    const { cx, list, view } = chat();
    at.selected = words;
    view.applySettings({ 'chatter.annotate.popup': false });
    list.selected?.(cx);
    expect(view.notePopup.isShown()).toBe(false);
    view.applySettings({ 'chatter.annotate.popup': true });
    list.selected?.(cx);
    expect(view.notePopup.isShown()).toBe(true);
});
