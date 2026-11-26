import { expect, test } from 'vitest';

import { MINI_MOTION_MS, createMiniMotion } from './mini-motion.js';

/** a clock by hand: each timer waits for `pass` */
function world(isReduced = false) {
    let now = 0;
    let timers: { at: number; run: () => void; isLive: boolean }[] = [];
    const cx = {
        notify: () => {},
        timer: {
            after: (ms: number, run: (c: unknown) => void) => {
                const timer = {
                    at: now + ms,
                    isLive: true,
                    run: () => run(cx),
                };
                timers.push(timer);
                return {
                    cancel: () => {
                        timer.isLive = false;
                    },
                };
            },
        },
    };
    const motion = createMiniMotion<string>(() => isReduced);
    return {
        cx: cx as never,
        live: () => timers.filter((t) => t.isLive).length,
        motion,
        pass(ms: number) {
            now += ms;
            const due = timers.filter((t) => t.isLive && t.at <= now);
            timers = timers.filter((t) => !due.includes(t));
            for (const t of due) t.run();
        },
    };
}

test('F6 F6 inside 120 ms leaves no box and no timer', () => {
    const w = world();
    w.motion.opened(w.cx);
    w.pass(10);
    w.motion.closed('the box', w.cx);
    expect([w.motion.ghost(), w.live()]).toEqual([null, 0]);
    w.pass(MINI_MOTION_MS);
    expect(w.motion.ghost()).toBeNull();
});

test('shut once shown, it is drawn going for 120 ms, then gone', () => {
    const w = world();
    w.motion.opened(w.cx);
    w.pass(20);
    expect(w.motion.look()).toEqual({ lift: 0, opacity: 1 });
    w.motion.closed('the box', w.cx);
    expect([w.motion.ghost(), w.motion.look().opacity]).toEqual(['the box', 0]);
    w.pass(MINI_MOTION_MS - 1);
    expect(w.motion.ghost()).toBe('the box');
    w.pass(1);
    expect([w.motion.ghost(), w.live()]).toEqual([null, 0]);
});

test('opened again while it goes: shown, the going one gone', () => {
    const w = world();
    w.motion.opened(w.cx);
    w.pass(20);
    w.motion.closed('the box', w.cx);
    w.motion.opened(w.cx);
    w.pass(20);
    expect([w.motion.ghost(), w.motion.look().opacity, w.live()]).toEqual([
        null,
        1,
        0,
    ]);
});

test('with reduce motion on, it is there at once and gone at once', () => {
    const w = world(true);
    w.motion.opened(w.cx);
    expect(w.motion.look().opacity).toBe(1);
    w.motion.closed('the box', w.cx);
    expect([w.motion.ghost(), w.live()]).toEqual([null, 0]);
});
