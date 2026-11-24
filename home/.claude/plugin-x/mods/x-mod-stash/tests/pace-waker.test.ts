import {
    HOUR,
    LEFT,
    MEMBER,
    MIN,
    NOW,
    POLL,
    SID,
    WATCH,
    band,
    rungs,
    seat,
    settings,
    start,
    world,
} from './pace-world.ts';
import { expect, test } from './shared-boot.ts';

/* the waker door */

const wakerOn = (w: ReturnType<typeof world>) =>
    (w.store.get('waker') as { on?: boolean } | undefined)?.on === true;

test("a shift's end restores the waker its start found", async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    const during = wakerOn(w);
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(POLL);
    expect([during, wakerOn(w)]).toEqual([true, false]);
});

test('a waker found on stays on at the end', async ($, on) => {
    const w = world(on, { waker: { on: true } });
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(POLL);
    expect(wakerOn(w)).toBe(true);
});

test('start, start, end leaves a waker found off, off', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set(`pace:${SID}`, { since: NOW + 1 });
    await w.clock.advance(POLL);
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(POLL);
    expect(wakerOn(w)).toBe(false);
});

test("dima's change during the shift is kept at the end", async ($, on) => {
    const w = world(on, { waker: { on: true } });
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set('waker', { on: false });
    await w.clock.advance(POLL);
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(POLL);
    expect(wakerOn(w)).toBe(false);
});

test('a second start turns ⏰ back on after dima switched it off', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set('waker', { on: false });
    await w.clock.advance(POLL);
    const off = wakerOn(w);
    w.store.set(`pace:${SID}`, { since: NOW + 1 });
    await w.clock.advance(POLL);
    expect([off, wakerOn(w)]).toEqual([false, true]);
});

test('the end restores the state the first start found, past a second start', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set('waker', { on: false });
    w.store.set(`pace:${SID}`, { since: NOW + 1 });
    await w.clock.advance(POLL);
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(POLL);
    expect(wakerOn(w)).toBe(false);
});

test('found on, off by dima, a second start: the end leaves ⏰ on', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    w.store.set('waker', { on: true });
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set('waker', { on: false });
    w.store.set(`pace:${SID}`, { since: NOW + 1 });
    await w.clock.advance(POLL);
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(POLL);
    expect(wakerOn(w)).toBe(true);
});

test("dima's off after a second start stays off", async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set(`pace:${SID}`, { since: NOW + 1 });
    await w.clock.advance(POLL);
    w.store.set('waker', { on: false });
    await w.clock.advance(POLL);
    expect(wakerOn(w)).toBe(false);
});

test("a second start during afk changes afk's kept copy, so afk's end keeps ⏰ on", async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set('afk', { on: true, wakerBefore: false });
    w.store.set('waker', { on: false });
    w.store.set(`pace:${SID}`, { since: NOW + 1 });
    await w.clock.advance(POLL);
    expect(w.store.get('afk')).toEqual({ on: true, wakerBefore: true });
});

test('a start with no end expires when its window resets', async ($, on) => {
    const w = world(on);
    w.meter(30, 20 * MIN);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    const during = wakerOn(w);
    await w.skip(21 * MIN);
    expect([during, w.store.get(`pace:${SID}`), wakerOn(w)]).toEqual([
        true,
        { on: true },
        false,
    ]);
});

test("at the reset ⏰ stays on past the waker's own resume", async ($, on) => {
    const w = world(on);
    w.meter(30, 20 * MIN);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    await w.clock.set(NOW + 20 * MIN + 6_000);
    expect(wakerOn(w)).toBe(true);
});

test('an old meter at the start never ends the shift it just began', async ($, on) => {
    const w = world(on);
    w.meter(30, -HOUR, 2 * HOUR);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(MIN);
    expect(w.store.get(`pace:${SID}`)).toBeDefined();
});

test('a start with no meter takes its expiry from a later poll', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.meter(30, 30 * MIN, 0, w.clock.now());
    await w.skip(35 * MIN);
    expect(w.store.get(`pace:${SID}`)).toEqual({ on: true });
});

test('a member’s start with no end leaves no key when its window resets', async ($, on) => {
    const w = world(on);
    seat(w, MEMBER);
    w.meter(30, 20 * MIN);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    await w.skip(21 * MIN);
    expect(w.store.get(`pace:${SID}`)).toBeUndefined();
});

test('a shift ending during afk changes what afk off puts back', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set('afk', { at: NOW, on: true, wakerBefore: true });
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(POLL);
    expect([
        wakerOn(w),
        (w.store.get('afk') as { wakerBefore?: boolean }).wakerBefore,
    ]).toEqual([true, false]);
});

test('the part switched off mid-shift restores the waker', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set('shown', { 'stash.pace-watch': false });
    await w.clock.advance(POLL);
    expect(wakerOn(w)).toBe(false);
});

test(
    'a refused line leaves keep-hot armed',
    { timeoutMs: 60_000 },
    async ($, on) => {
        const w = world(on, { ...WATCH, [`hot:${SID}`]: { since: NOW } });
        w.meter(46, LEFT);
        w.state.isRefused = true;
        await start($);
        await w.clock.advance(POLL);
        w.state.isRefused = false;
        w.store.delete(`pace:${SID}`);
        await w.skip(51 * MIN);
        expect(w.turns.some((t) => t.includes('keep-hot'))).toBe(true);
    },
);

test('the 🎛️ row flips this session’s key', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    const ui = await settings($);
    await ui.press({ key: 'knob:pace-watch' });
    const onAfter = (w.store.get(`pace:${SID}`) as { off?: boolean }).off;
    await ui.press({ key: 'knob:pace-watch' });
    expect([onAfter, w.store.get(`pace:${SID}`)]).toEqual([true, { on: true }]);
});

test('the part off draws no row', async ($, on) => {
    const w = world(on, { shown: { 'stash.pace-watch': false } });
    w.meter(30, LEFT);
    await start($);
    const ui = await settings($);
    expect(
        await ui.find({ key: 'knob:pace-watch', type: 'Button' }),
    ).toBeUndefined();
});

/* 🔋 on the coordinator's seat */

test('a new 🦉 clio session starts on, with no ⏰, and hears the crossing', async ($, on) => {
    const w = world(on);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    expect([
        w.store.get(`pace:${SID}`),
        rungs(w),
        w.store.get('waker'),
    ]).toEqual([{ on: true }, ['park'], undefined]);
});

test('with the part off a new 🦉 clio session writes no pace key', async ($, on) => {
    const w = world(on, { shown: { 'stash.pace-watch': false } });
    await start($);
    expect(w.store.get(`pace:${SID}`)).toBeUndefined();
});

test('a seat skipped with the part off arms itself once the part is back', async ($, on) => {
    const w = world(on, { shown: { 'stash.pace-watch': false } });
    w.meter(46, LEFT);
    await start($);
    w.store.set('shown', {});
    await w.clock.advance(POLL);
    await w.clock.advance(POLL);
    expect([w.store.get(`pace:${SID}`), rungs(w)]).toEqual([
        { on: true },
        ['park'],
    ]);
});

test('the two 🔋 rows in the pane say which scope each flips', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    const ui = await settings($);
    expect([
        (await ui.find({ key: 'part:stash.pace-watch', type: 'Button' }))?.text,
        (await ui.find({ key: 'knob:pace-watch', type: 'Button' }))?.text,
    ]).toEqual(['🔋 pace watch: all sessions', '🔋 pace watch: this session']);
});

test('click off, restart with the same id, cross +5: no line', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    const ui = await band($);
    await ui.press({ key: 'pace-watch' });
    await start($);
    w.meter(46, LEFT);
    await w.skip(5 * MIN);
    expect([w.store.get(`pace:${SID}`), w.turns]).toEqual([{ off: true }, []]);
});

test('🔋 sits between 🔥 and ⏰ and one click flips the key', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await band($);
    const words = async () =>
        (await ui.find({ key: 'tip:pace-watch', type: 'Box' }))?.text;
    const keys = (await ui.findAll({ type: 'Button' })).map((b) => b.key);
    const from = keys.indexOf('hot');
    const before = await words();
    await ui.press({ key: 'pace-watch' });
    expect([
        keys.slice(from, from + 3),
        before,
        w.store.get(`pace:${SID}`),
        await words(),
    ]).toEqual([
        ['hot', 'pace-watch', 'waker'],
        '🔋pace watch: this session',
        { off: true },
        '🔋pace watch: this session',
    ]);
});

test('any other seat draws no 🔋 and writes no key', async ($, on) => {
    const w = world(on);
    seat(w, MEMBER);
    await start($);
    const ui = await band($);
    expect([
        await ui.find({ key: 'pace-watch', type: 'Button' }),
        w.store.get(`pace:${SID}`),
    ]).toEqual([undefined, undefined]);
});

test('🔋 off during a shift ends the shift: ⏰ goes back', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(30, LEFT);
    await start($);
    await w.clock.advance(POLL);
    const during = wakerOn(w);
    const ui = await band($);
    await ui.press({ key: 'pace-watch' });
    await w.clock.advance(POLL);
    expect([during, wakerOn(w)]).toEqual([true, false]);
});

test('the door’s off holds across a restart like a click', async ($, on) => {
    const w = world(on, { [`pace:${SID}`]: { off: true } });
    w.meter(46, LEFT);
    await start($);
    await w.skip(5 * MIN);
    expect([w.store.get(`pace:${SID}`), w.turns]).toEqual([{ off: true }, []]);
});

test('/clear on the coordinator seat arms a key never written', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.delete(`pace:${SID}`);
    await $.command.run({
        args: '',
        command: 'clear',
        origin: { kind: 'composer' },
        presentation: { columns: 80, isFullscreen: false },
    });
    expect(w.store.get(`pace:${SID}`)).toEqual({ on: true });
});
