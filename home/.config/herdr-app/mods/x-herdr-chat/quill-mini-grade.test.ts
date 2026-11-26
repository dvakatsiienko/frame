import { beforeEach, describe, expect, test, vi } from 'vitest';

const { at, make } = await vi.hoisted(() => import('./quill-mini-fakes.ts'));

vi.mock('herdr', () => ({
    // reduce motion is off: macOS has no key for it
    exec: vi.fn(async () => ({ code: 1, stdout: '' })),
    settings: () => ({ zoom: at.zoom }),
}));
vi.mock('gpui-kit', () => ({ div: make }));
vi.mock('gpui-base', () => ({
    Button: { new: make },
    Checkbox: { new: make },
    Textarea: { new: () => 'the box' },
    TextareaState: {
        new: () => ({
            focus: () => {
                at.box.focused += 1;
            },
            on: (event: string, run: (e: unknown, cx: unknown) => void) =>
                at.box.on.set(event, run),
            selected_range: () => at.box.range,
            set_auto_grow: () => {},
            set_selected_range: (range: typeof at.box.range) => {
                at.box.range = range;
            },
            set_value: (text: string) => {
                at.box.text = text;
            },
            value: () => at.box.text,
        }),
    },
    h_flex: make,
    v_flex: make,
}));
const { ENTER, settle, world } = await import('./quill-mini-world.ts');

beforeEach(() => {
    at.box.text = '';
    at.handles.length = 0;
    at.held = null;
    at.keys.length = 0;
    at.timers.length = 0;
});

const TAB = 'x_herdr_chat_mini_tab';
const PART_TAB = 'x_herdr_chat_mini_part_tab';
const PART_BACK = 'x_herdr_chat_mini_part_back';
const PART_PRESS = 'x_herdr_chat_mini_part_press';

const { thumbVariant } = await import('./quill-mini-grade.js');

// FRM-630 exit 2
test('the lit thumb is filled, the other plain', () => {
    expect([
        thumbVariant({ grade: 'bad' }, 'bad'),
        thumbVariant({ grade: 'bad' }, 'good'),
        thumbVariant({}, 'good'),
    ]).toEqual(['primary', 'outline', 'outline']);
});

// FRM-630 exit 5
describe('the grade row', () => {
    test('Tab walks text, 👍🏼, 👎🏼, whole message, join, send, then the loop', () => {
        const w = world();
        w.f6();
        w.type('why');
        const order: number[] = [];
        w.act(TAB);
        for (let i = 0; i < 5; i++) {
            order.push(at.handles.indexOf(at.held as never));
            w.act(PART_TAB);
        }
        expect(order).toEqual([0, 1, 2, 3, 4]);
        expect(w.said.tabs).toEqual([['quill-mini', false]]);
    });

    test('shift-Tab from the first part gives the text the keyboard', () => {
        const w = world();
        w.f6();
        w.act(TAB);
        const before = at.box.focused;
        w.act(PART_BACK);
        expect(at.box.focused).toBe(before + 1);
        expect(w.said.tabs).toEqual([]);
    });

    test('a thumb pressed lights it, never sends, and leaves the keyboard in the text', async () => {
        const w = world();
        w.f6();
        w.type('why');
        const before = at.box.focused;
        w.button('chat-mini-bad');
        await settle();
        expect(w.note()).toMatchObject({ grade: 'bad', state: 'draft' });
        expect([w.said.sent, w.rows()]).toEqual([[], '']);
        expect(at.box.focused).toBe(before + 1);
    });

    test('Enter on a part presses it: the thumb, then «whole message»', () => {
        const w = world();
        w.f6();
        w.act(TAB);
        w.act(PART_PRESS);
        expect(w.note()?.grade).toBe('good');
        w.act(PART_TAB);
        w.act(PART_TAB);
        w.act(PART_PRESS);
        expect(w.note()?.isWhole).toBe(true);
    });

    test('a held Enter on a part presses it once', () => {
        const w = world();
        w.f6();
        w.act(TAB);
        w.act(PART_PRESS);
        w.act(PART_PRESS);
        expect(w.note()?.grade).toBe('good');
    });

    test('shift-Tab into the box lands on send, the row’s last part', () => {
        const w = world();
        w.f6();
        w.mini.focus(true);
        expect(at.held).toBe(at.handles.at(-1));
        const before = at.box.focused;
        w.mini.focus(false);
        expect(at.box.focused).toBe(before + 1);
    });

    test('a thumb alone joins, as «no why»', async () => {
        const w = world();
        w.f6();
        w.button('chat-mini-good');
        w.press(ENTER);
        await settle();
        expect(w.rows()).toContain('): no why (a case for the comms log');
    });

    test('once the thread has it, no part of the row changes it, and Tab from the text walks the loop', async () => {
        const w = world();
        w.f6();
        w.type('why');
        w.press(ENTER);
        await settle();
        w.now.joins = { joined: [w.note()?.joinId ?? ''], taken: [] };
        await w.notes.settle('/t/a.jsonl');
        expect(w.byId('chat-mini-good')?.handlers.has('on_click')).toBe(false);
        w.act(TAB);
        expect(w.said.tabs).toEqual([['quill-mini', false]]);
    });
});
