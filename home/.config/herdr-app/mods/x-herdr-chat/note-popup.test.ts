import { expect, test, vi } from 'vitest';

type El = {
    handlers: Map<string, (e: unknown, cx: unknown) => void>;
    kids: unknown[];
    left?: number;
    top?: number;
};
vi.mock('gpui-kit', () => {
    const div = () => {
        const el: El = { handlers: new Map(), kids: [] };
        const self: unknown = new Proxy(el, {
            get(target, name) {
                if (name === 'raw') return target;
                return (...args: unknown[]) => {
                    if (name === 'left' || name === 'top')
                        target[name] = Number(args[0]);
                    else if (name === 'child') target.kids.push(args[0]);
                    else if (name === 'on_mouse_down')
                        target.handlers.set(
                            `mouse_down_${args[0]}`,
                            args[1] as never,
                        );
                    return self;
                };
            },
        });
        return self;
    };
    return { View: class {}, div };
});
const { createNotePopup, popupPlace } = await import('./note-popup.js');

const T = { border: 'b', foreground: 'f', hover: 'h', popover: 'p' };
const words = (y = 200) => ({
    at: { x: 40, y },
    passage: { parts: [], row: { at: null, id: 'r1', kind: 'reply' } },
});

function world(isOn = true) {
    const opened: unknown[] = [];
    const notified: unknown[] = [];
    let drawn: () => unknown = () => null;
    const timers: (() => void)[] = [];
    const entity = { name: 'the popup' };
    const cx = {
        new: (_c: unknown, props: { draw: () => unknown }) => {
            drawn = props.draw;
            return entity;
        },
        notify: (...args: unknown[]) => notified.push(args[0] ?? 'the chat'),
        stop_propagation: () => {},
        timer: {
            after: (_ms: number, run: (c: unknown) => void) => {
                const at = timers.push(() => run(cx)) - 1;
                return {
                    cancel: () => {
                        timers[at] = () => {};
                    },
                };
            },
        },
    };
    const popup = createNotePopup({
        isOn: () => isOn,
        open: (selected) => opened.push(selected),
        room: () => ({ height: 600, width: 800 }),
        threadName: () => 'clio',
    });
    popup.start(cx as never);
    popup.element(T as never);
    const raw = () => (drawn() as { raw: El }).raw;
    return {
        cx: cx as never,
        notified,
        opened,
        popup,
        press: () => raw().handlers.get('mouse_down_left')?.({}, cx),
        raw,
        runTimers: () => {
            for (const run of timers.splice(0)) run();
        },
    };
}

test('a settled selection shows «tell <thread>» over its end, redrawing only itself', () => {
    const w = world();
    w.popup.reported(words() as never, w.cx);
    expect(w.raw().kids).toEqual(['tell clio']);
    expect([w.raw().left, w.raw().top]).toEqual([40, 168]);
    expect(w.notified).toEqual([{ name: 'the popup' }]);
});

test('a press opens the box on the words it showed, the selection already cleared by it', () => {
    const w = world();
    const selected = words();
    w.popup.reported(selected as never, w.cx);
    w.popup.reported(null, w.cx);
    w.press();
    w.runTimers();
    expect(w.opened).toEqual([selected]);
    expect(w.popup.isShown()).toBe(false);
});

test('cleared with no press, it goes a moment later', () => {
    const w = world();
    w.popup.reported(words() as never, w.cx);
    w.popup.reported(null, w.cx);
    expect(w.popup.isShown()).toBe(true);
    w.runTimers();
    expect(w.popup.isShown()).toBe(false);
});

test('switched off, nothing shows', () => {
    const w = world(false);
    w.popup.reported(words() as never, w.cx);
    expect(w.popup.isShown()).toBe(false);
});

test.each([
    ['over the words', { x: 40, y: 200 }, { x: 40, y: 168 }],
    ['under them at the list’s top', { x: 40, y: 10 }, { x: 40, y: 16 }],
    [
        'inside the list at its right edge',
        { x: 790, y: 200 },
        { x: 640, y: 168 },
    ],
])('it sits %s', (_where, end, place) => {
    expect(popupPlace(end, { h: 600, w: 800 })).toEqual(place);
});
