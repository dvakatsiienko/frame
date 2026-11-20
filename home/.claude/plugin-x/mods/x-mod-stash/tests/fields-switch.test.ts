import type { On } from 'claude-code';
import { type Engine, expect, test } from 'claude-code/testing';

import {
    assume,
    boxValue,
    glide,
    herdrPress,
    keptState,
    reload,
} from './orbit-helpers.ts';
import {
    type Board,
    add,
    board,
    endTurn,
    gates,
    joined,
    orbit,
    say,
    start,
    world,
} from './orbit-world.ts';

const CLIENT = { clientId: 'desktop-2', surface: 'desktop' } as const;

const FIELD_SAVE = 1500;

type Clocked = { clock: { advance: (ms: number) => Promise<unknown> } };

async function switchThread($: Engine, w: Clocked, ui: Board, awayMs = 0) {
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    if (awayMs) await w.clock.advance(awayMs);
    await $.session.attach(CLIENT);
    return board($);
}

// each row its own ask or lane id: module memory survives between tests
let switchRow = 2000;

// a row's own ask ids: module memory outlives a test, so its ask takes an id no other row used, through the fleet counter
// (FRM-649) when the row's store is passed
const orbitSeed = (store?: Map<string, unknown>) => {
    const seed = { asks: [], next: ++switchRow, turns: 1 };
    store?.set('ask-counter', { next: seed.next });
    store?.set('asks:another-thread', { asks: ['its ask'], items: [] });
    return seed;
};

async function askBoxOnBoard($: Engine, on: On) {
    const w = world(on);
    const seed = orbitSeed(w.store);
    const state = keptState(on, { orbit: seed });
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.redraw();
    const id = `o${seed.next}`;
    return { id, key: `orbit:steer:${id}`, state, ui, w };
}

const SWITCH_KINDS = {
    ask: askBoxOnBoard,
    assumption: async ($: Engine, on: On) => {
        const w = world(on);
        const state = keptState(on, { orbit: orbitSeed() });
        await start($);
        const ui = await board($);
        await assume($, 'kept the port');
        await ui.redraw();
        const id = (state.orbit as { assumed: { id: string }[] }).assumed[0]
            ?.id;
        return { key: `orbit:asteer:${id}`, ui, w };
    },
    glide: async ($: Engine, on: On) => {
        const lane = `l${++switchRow}`;
        const w = world(on, glide({}, lane));
        keptState(on);
        await start($);
        const ui = await board($);
        await ui.redraw();
        return { key: `lane:${lane}:steer`, ui, w };
    },
} as const;

const SWITCH_TIMINGS = [
    ['0 ms', 0, 0],
    ['1 ms', 0, 1],
    ['just under the save delay', 0, FIELD_SAVE - 1],
    ['past the save delay while away', 0, FIELD_SAVE + 3500],
    ['a landed save before he left', FIELD_SAVE + 3500, 0],
] as const;

const SWITCH_TEXTS = [
    ['one line', 'a heron'],
    ['several lines', 'a heron\nand a stork'],
    ['non-latin', 'чапля 鷺 🐦‍🔥'],
] as const;

for (const [kind, setUp] of Object.entries(SWITCH_KINDS))
    for (const [timing, beforeMs, awayMs] of SWITCH_TIMINGS)
        for (const [name, text] of SWITCH_TEXTS)
            test(`a switch keeps every typed character: ${kind} box, ${timing}, ${name}`, async ($, on) => {
                const { key, ui, w } = await setUp($, on);
                await ui.input({ key, kind: 'change', text });
                if (beforeMs) await w.clock.advance(beforeMs);
                const back = await switchThread($, w, ui, awayMs);
                expect(await boxValue(back, key)).toBe(text);
            });

test("a mobile client coming and going leaves the desktop's box as drawn", async ($, on) => {
    const { key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(5_000);
    const phone = { clientId: 'phone', surface: 'mobile' } as const;
    await $.session.attach(phone);
    await $.session.detach({ ...phone, reason: 'detach' });
    await ui.redraw();
    expect(await boxValue(ui, key)).toBe('');
});

for (const [when, beforeMs] of [
    ['at the flush', 0],
    ['at its timed save', FIELD_SAVE + 3500],
] as const) {
    test(`a glide save the store refused ${when} draws on across two switches, and lands at the next chance`, async ($, on) => {
        const lane = `l${++switchRow}`;
        const w = world(on, glide({}, lane));
        keptState(on);
        let isDown = true;
        w.taps.set = (key) =>
            isDown && key === `lane-steer:${lane}` ? 'store down' : undefined;
        await start($);
        const ui = await board($);
        await ui.redraw();
        const key = `lane:${lane}:steer`;
        await ui.input({ key, kind: 'change', text: 'cards first' });
        if (beforeMs) await w.clock.advance(beforeMs);
        const back = await switchThread($, w, ui);
        const first = await boxValue(back, key);
        const again = await switchThread($, w, back);
        const second = await boxValue(again, key);
        isDown = false;
        await say($, 'go');
        expect([
            first,
            second,
            (w.store.get(`lane-steer:${lane}`) as { steer?: string })?.steer,
        ]).toEqual(['cards first', 'cards first', 'cards first']);
    });

    test(`an ask's save $.state refused ${when} draws on across two switches, and lands at the next chance`, async ($, on) => {
        const w = world(on);
        const seed = orbitSeed(w.store);
        const state: Record<string, unknown> = { orbit: seed };
        let version = 0;
        let isDown = false;
        on('state.get', (_$, e) => ({
            value: {
                value: state[e.key],
                version: e.key in state ? ++version : 0,
            },
        }));
        on('state.set', (_$, e) => {
            if (isDown && e.key === 'orbit') return { deny: 'state down' };
            state[e.key] = e.value;
            return { value: { isSet: true, version: ++version } };
        });
        await start($);
        const ui = await board($);
        await add($, ['name a bird', 'pelican']);
        await ui.redraw();
        const key = `orbit:steer:o${seed.next}`;
        isDown = true;
        await ui.input({ key, kind: 'change', text: 'a heron' });
        if (beforeMs) await w.clock.advance(beforeMs);
        const back = await switchThread($, w, ui);
        const first = await boxValue(back, key);
        const again = await switchThread($, w, back);
        const second = await boxValue(again, key);
        isDown = false;
        await say($, 'go');
        await again.redraw();
        expect([
            first,
            second,
            (state.orbit as { asks: { steer?: string }[] }).asks[0]?.steer,
            await boxValue(again, key),
        ]).toEqual(['a heron', 'a heron', 'a heron', 'a heron']);
    });
}

const steerBoxOf = async (ui: Board, id: string) =>
    (await ui.findAll({ type: 'Input' })).find((n) =>
        n.key?.startsWith(`orbit:steer:${id}`),
    );

for (const [when, awayMs] of [
    ['inside the save delay', 0],
    ['past it', FIELD_SAVE + 3500],
] as const) {
    test(`more words after a return ${when} replace the kept text, and a send lands them once`, async ($, on) => {
        const { id, key, state, ui, w } = await askBoxOnBoard($, on);
        await ui.input({ key, kind: 'change', text: 'a heron' });
        const back = await switchThread($, w, ui, awayMs);
        await back.input({ key, kind: 'change', text: 'a heron in the reeds' });
        await w.clock.advance(FIELD_SAVE + 3500);
        await back.redraw();
        const shown = await boxValue(back, key);
        await back.press({ key: `orbit:accepted:${id}` });
        await say($, 'go');
        const sent = joined(w.contexts).join('\n');
        await endTurn($);
        await w.clock.advance(5_000);
        await back.redraw();
        const left = await steerBoxOf(back, id);
        await say($, 'and on');
        expect([
            shown,
            sent.split('a heron in the reeds').length - 1,
            left?.props.value,
            (state.orbit as { asks: { steer?: string }[] }).asks[0]?.steer,
            joined(w.contexts),
        ]).toEqual(['a heron', 1, '', undefined, []]);
    });

    test(`a send right after a return ${when} carries what the box shows, once`, async ($, on) => {
        const { id, key, ui, w } = await askBoxOnBoard($, on);
        await ui.input({ key, kind: 'change', text: 'a heron' });
        const back = await switchThread($, w, ui, awayMs);
        const shown = await boxValue(back, key);
        await back.press({ key: `orbit:accepted:${id}` });
        await say($, 'go');
        const sent = joined(w.contexts).join('\n');
        await endTurn($);
        await w.clock.advance(5_000);
        await back.redraw();
        expect([
            shown,
            sent.split('a heron').length - 1,
            (await steerBoxOf(back, id))?.props.value,
        ]).toEqual(['a heron', 1, '']);
    });

    test(`a box he emptied ${when} stays empty after a switch`, async ($, on) => {
        const { key, state, ui, w } = await askBoxOnBoard($, on);
        await ui.input({ key, kind: 'change', text: 'a heron' });
        await w.clock.advance(FIELD_SAVE + 3500);
        await ui.input({ key, kind: 'change', text: '' });
        if (awayMs) await w.clock.advance(awayMs);
        const back = await switchThread($, w, ui);
        expect([
            await boxValue(back, key),
            (state.orbit as { asks: { steer?: string }[] }).asks[0]?.steer,
            await back.find({ key: `kept:${key}`, type: 'Button' }),
        ]).toEqual(['', undefined, undefined]);
    });
}

test("a turn's clear while he was away empties the box, with nothing offered back", async ($, on) => {
    const { id, key, ui } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await ui.press({ key: `orbit:accepted:${id}` });
    await say($, 'go');
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    await endTurn($);
    await $.session.attach(CLIENT);
    const back = await board($);
    expect([
        (await steerBoxOf(back, id))?.props.value,
        await back.find({ key: `kept:${key}`, type: 'Button' }),
    ]).toEqual(['', undefined]);
});

test('a follow while he was away empties the box, with nothing offered back', async ($, on) => {
    const { id, key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(5_000);
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    await orbit($, {
        id,
        op: 'follow',
        pick: 'after ci',
        text: 'once ci is green',
    });
    await $.session.attach(CLIENT);
    const back = await board($);
    expect([
        (await steerBoxOf(back, id))?.props.value,
        await back.find({ key: `kept:${key}`, type: 'Button' }),
    ]).toEqual(['', undefined]);
});

for (const [when, beforeMs] of [
    ['inside the save delay', 0],
    ['past it', FIELD_SAVE + 3500],
] as const) {
    test(`another board's steer while he was away wins an ask's box, his text typed ${when} offered as kept`, async ($, on) => {
        const { id, key, ui, w } = await askBoxOnBoard($, on);
        await ui.input({ key, kind: 'change', text: 'a heron' });
        if (beforeMs) await w.clock.advance(beforeMs);
        await $.session.detach({ ...CLIENT, reason: 'detach' });
        await ui.unmount();
        herdrPress(w, id, {
            at: (w.clock as unknown as { now: () => number }).now(),
            steer: 'a swan',
            verdict: 'tick',
        });
        await w.clock.advance(5_000);
        await $.session.attach(CLIENT);
        const back = await board($);
        expect([
            await boxValue(back, key),
            (await back.find({ key: `kept:${key}`, type: 'Button' }))?.text,
        ]).toEqual(['a swan', expect.stringContaining('a heron')]);
    });

    test(`another board's steer while he was away wins a glide box, his text typed ${when} offered as kept`, async ($, on) => {
        const lane = `l${++switchRow}`;
        const w = world(on, glide({}, lane));
        keptState(on);
        await start($);
        const ui = await board($);
        await ui.redraw();
        const key = `lane:${lane}:steer`;
        await ui.input({ key, kind: 'change', text: 'cards first' });
        if (beforeMs) await w.clock.advance(beforeMs);
        await $.session.detach({ ...CLIENT, reason: 'detach' });
        await ui.unmount();
        w.store.set(`lane-steer:${lane}`, { steer: 'bars first' });
        await w.clock.advance(5_000);
        await $.session.attach(CLIENT);
        const back = await board($);
        expect([
            await boxValue(back, key),
            (await back.find({ key: `kept:${key}`, type: 'Button' }))?.text,
        ]).toEqual(['bars first', expect.stringContaining('cards first')]);
    });
}

test('a steer another board wrote while he was here offers nothing at his next return', async ($, on) => {
    const { id, key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(FIELD_SAVE + 3500);
    // a fold forgets the typing stamp, which reads the real clock and so never ages here
    await ui.press({ key: 'fold:orbit' });
    await ui.press({ key: 'fold:orbit' });
    herdrPress(w, id, {
        at: (w.clock as unknown as { now: () => number }).now(),
        steer: 'a swan',
        verdict: 'tick',
    });
    await w.clock.advance(5_000);
    const back = await switchThread($, w, ui);
    expect([
        await boxValue(back, key),
        await back.find({ key: `kept:${key}`, type: 'Button' }),
    ]).toEqual(['a swan', undefined]);
});

test('a steer he emptied never comes back as an offer when another board writes while he is away', async ($, on) => {
    const { id, key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(FIELD_SAVE + 3500);
    await ui.input({ key, kind: 'change', text: '' });
    await w.clock.advance(FIELD_SAVE + 3500);
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    herdrPress(w, id, {
        at: (w.clock as unknown as { now: () => number }).now(),
        steer: 'a swan',
        verdict: 'tick',
    });
    await w.clock.advance(5_000);
    await $.session.attach(CLIENT);
    const back = await board($);
    expect([
        await boxValue(back, key),
        await back.find({ key: `kept:${key}`, type: 'Button' }),
    ]).toEqual(['a swan', undefined]);
});

test('a text a remount held over never draws again once the store took it and the box was cleared', async ($, on) => {
    const lane = `l${++switchRow}`;
    const w = world(on, glide({}, lane));
    keptState(on);
    let isDown = true;
    w.taps.set = (key) =>
        isDown && key === `lane-steer:${lane}` ? 'store down' : undefined;
    await start($);
    const ui = await board($);
    await ui.redraw();
    const key = `lane:${lane}:steer`;
    await ui.input({ key, kind: 'change', text: 'cards first' });
    const back = await switchThread($, w, ui);
    isDown = false;
    await say($, 'go');
    w.store.delete(`lane-steer:${lane}`);
    await w.clock.advance(5_000);
    await back.redraw();
    await back.input({ key, kind: 'change', text: 'x' });
    await back.redraw();
    const boxes = (await back.findAll({ type: 'Input' })).filter((n) =>
        n.key?.startsWith(key),
    );
    expect(boxes.map((n) => n.props.value)).toEqual(['']);
});

function refusingOrbit(on: On, store: Map<string, unknown>) {
    const down = { isDown: false };
    const state: Record<string, unknown> = { orbit: orbitSeed(store) };
    let version = 0;
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? ++version : 0 },
    }));
    on('state.set', (_$, e) => {
        if (down.isDown && e.key === 'orbit') return { deny: 'state down' };
        state[e.key] = e.value;
        return { value: { isSet: true, version: ++version } };
    });
    return { down, state };
}

test('a held text that lands keeps drawing, and more words typed over it never reset the box', async ($, on) => {
    const w = world(on);
    const { down, state } = refusingOrbit(on, w.store);
    const id = `o${(state.orbit as { next: number }).next}`;
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.redraw();
    const key = `orbit:steer:${id}`;
    down.isDown = true;
    await ui.input({ key, kind: 'change', text: 'a heron' });
    const back = await switchThread($, w, ui);
    down.isDown = false;
    await back.input({ key, kind: 'change', text: 'a heron in the reeds' });
    await w.clock.advance(FIELD_SAVE + 3500);
    await back.redraw();
    expect([
        await boxValue(back, key),
        (state.orbit as { asks: { steer?: string }[] }).asks[0]?.steer,
    ]).toEqual(['a heron', 'a heron in the reeds']);
});

test('a held text the store refused three times leaves the box for the offer, and never draws over new words', async ($, on) => {
    const w = world(on);
    const { down, state } = refusingOrbit(on, w.store);
    const id = `o${(state.orbit as { next: number }).next}`;
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.redraw();
    const key = `orbit:steer:${id}`;
    down.isDown = true;
    await ui.input({ key, kind: 'change', text: 'a heron' });
    const back = await switchThread($, w, ui);
    for (const text of ['one', 'two', 'three']) await say($, text);
    down.isDown = false;
    await back.input({ key, kind: 'change', text: 'x' });
    await back.redraw();
    expect(await boxValue(back, key)).toBe('');
});

test('a steer another board wrote, still a mark at his return inside the poll, wins with his text offered', async ($, on) => {
    const { id, key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(FIELD_SAVE + 100);
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    herdrPress(w, id, {
        at: (w.clock as unknown as { now: () => number }).now(),
        steer: 'a swan',
        verdict: 'tick',
    });
    await $.session.attach(CLIENT);
    const back = await board($);
    expect([
        await boxValue(back, key),
        (await back.find({ key: `kept:${key}`, type: 'Button' }))?.text,
    ]).toEqual(['a swan', expect.stringContaining('a heron')]);
});

test('a refused text that yields to a newer steer draws the steer, with his text offered once', async ($, on) => {
    const lane = `l${++switchRow}`;
    const w = world(on, glide({}, lane));
    keptState(on);
    let isDown = true;
    w.taps.set = (key) =>
        isDown && key === `lane-steer:${lane}` ? 'store down' : undefined;
    await start($);
    const ui = await board($);
    await ui.redraw();
    const key = `lane:${lane}:steer`;
    await ui.input({ key, kind: 'change', text: 'cards first' });
    const back = await switchThread($, w, ui);
    isDown = false;
    w.store.set(`lane-steer:${lane}`, { steer: 'bars first' });
    await say($, 'go');
    await w.clock.advance(5_000);
    const again = await switchThread($, w, back);
    const offer = await again.find({ key: `kept:${key}`, type: 'Button' });
    expect([await boxValue(again, key), offer?.text]).toEqual([
        'bars first',
        expect.stringMatching(/^↩️ kept «cards first»$/u),
    ]);
});

test('a refused text meets no offer of the steer it was typed over', async ($, on) => {
    const lane = `l${++switchRow}`;
    const w = world(on, glide({}, lane));
    w.store.set(`lane-steer:${lane}`, { steer: 'from another board' });
    keptState(on);
    let isDown = false;
    w.taps.set = (key) =>
        isDown && key === `lane-steer:${lane}` ? 'store down' : undefined;
    await start($);
    const ui = await board($);
    await ui.redraw();
    const key = `lane:${lane}:steer`;
    isDown = true;
    await ui.input({ key, kind: 'change', text: 'from another board, no' });
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    w.store.set(`lane-steer:${lane}`, { steer: 'a third' });
    await w.clock.advance(5_000);
    await $.session.attach(CLIENT);
    const back = await board($);
    const offer = await back.find({ key: `kept:${key}`, type: 'Button' });
    expect(offer?.text ?? '').not.toContain('from another board»');
});

test('what the store held as he left is kept in $.state, so a reload while away still offers it', async ($, on) => {
    const { key, state, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(FIELD_SAVE + 3500);
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    await w.clock.advance(0);
    expect((state.fields as Record<string, { left?: string }>)[key]?.left).toBe(
        'a heron',
    );
});

test('a reloaded module takes back what he left, and his return offers it over a newer steer', async ($, on) => {
    const id = `o${++switchRow}`;
    const key = `orbit:steer:${id}`;
    world(on);
    keptState(on, {
        fields: { [key]: { left: 'a heron' } },
        orbit: {
            asks: [
                { id, pick: 'pelican', steer: 'a swan', text: 'name a bird' },
            ],
            next: switchRow + 1,
            turns: 1,
        },
    });
    await start($);
    await $.session.attach(CLIENT);
    const back = await board($);
    expect(
        (await back.find({ key: `kept:${key}`, type: 'Button' }))?.text,
    ).toEqual(expect.stringContaining('a heron'));
});

/* FRM-531 sixth sense, round 1 */
test('a second steer refused after a sent one cleared keeps drawing, and lands at the next chance', async ($, on) => {
    const w = world(on);
    const { down, state } = refusingOrbit(on, w.store);
    const id = `o${(state.orbit as { next: number }).next}`;
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.redraw();
    const key = `orbit:steer:${id}`;
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(FIELD_SAVE + 3500);
    await ui.press({ key: `orbit:accepted:${id}` });
    await say($, 'go');
    await endTurn($);
    await w.clock.advance(5_000);
    await ui.redraw();
    const live = (await steerBoxOf(ui, id))?.key ?? key;
    down.isDown = true;
    await ui.input({ key: live, kind: 'change', text: 'a stork' });
    const back = await switchThread($, w, ui);
    const first = (await steerBoxOf(back, id))?.props.value;
    const again = await switchThread($, w, back);
    const second = (await steerBoxOf(again, id))?.props.value;
    down.isDown = false;
    await say($, 'next');
    await again.redraw();
    expect([
        first,
        second,
        (state.orbit as { asks: { steer?: string }[] }).asks[0]?.steer,
        (await steerBoxOf(again, id))?.props.value,
        await again.find({ key: `kept:${key}`, type: 'Button' }),
    ]).toEqual(['a stork', 'a stork', 'a stork', 'a stork', undefined]);
});

test('a text sent before he left is not offered back over a newer steer', async ($, on) => {
    const { id, key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await ui.press({ key: `orbit:accepted:${id}` });
    await say($, 'go');
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    await endTurn($);
    herdrPress(w, id, {
        at: (w.clock as unknown as { now: () => number }).now(),
        steer: 'a swan',
        verdict: 'tick',
    });
    await $.session.attach(CLIENT);
    const back = await board($);
    expect(await back.find({ key: `kept:${key}`, type: 'Button' })).toBe(
        undefined,
    );
});

test('a text Enter saved, its timer dropped by a reload, is not offered beside itself', async ($, on) => {
    const { store } = world(on);
    const seed = orbitSeed(store);
    const state = keptState(on, { orbit: seed });
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.redraw();
    const key = `orbit:steer:o${seed.next}`;
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await ui.input({ key, kind: 'submit', text: 'a heron' });
    await reload($, ui, state, 'orbit');
    await say($, 'go');
    await ui.redraw();
    expect(await ui.find({ key: `kept:${key}`, type: 'Button' })).toBe(
        undefined,
    );
});

for (const [kind, setUp] of Object.entries(SWITCH_KINDS))
    test(`a draw ahead of a slow attach reads every word: ${kind} box`, async ($, on) => {
        const { key, ui } = await setUp($, on);
        await ui.input({ key, kind: 'change', text: 'a heron' });
        await $.session.detach({ ...CLIENT, reason: 'detach' });
        await ui.unmount();
        let open = () => {};
        gates.storeKeys = new Promise<void>((resolve) => {
            open = resolve;
        });
        const attaching = $.session.attach(CLIENT);
        const back = await board($);
        const first = await boxValue(back, key);
        open();
        gates.storeKeys = undefined;
        await attaching;
        expect(first).toBe('a heron');
    });

test("a return's first draw ahead of a slow save at the detach reads every word", async ($, on) => {
    const { store } = world(on);
    const seed = orbitSeed(store);
    const state: Record<string, unknown> = { orbit: seed };
    let version = 0;
    let isHeld = false;
    let open = () => {};
    const gate = new Promise<void>((resolve) => {
        open = resolve;
    });
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? ++version : 0 },
    }));
    on('state.set', async (_$, e) => {
        if (isHeld && e.key === 'orbit') await gate;
        state[e.key] = e.value;
        return { value: { isSet: true, version: ++version } };
    });
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.redraw();
    const key = `orbit:steer:o${seed.next}`;
    await ui.input({ key, kind: 'change', text: 'a heron' });
    isHeld = true;
    const leaving = $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    const back = await board($);
    const first = await boxValue(back, key);
    isHeld = false;
    open();
    await leaving;
    await $.session.attach(CLIENT);
    await back.redraw();
    expect([first, await boxValue(back, key)]).toEqual(['a heron', 'a heron']);
});

/* FRM-531 sixth sense, round 2 */
test('a text a turn carried while he was away is not offered back over a newer steer', async ($, on) => {
    const { id, key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await ui.press({ key: `orbit:accepted:${id}` });
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    await say($, 'go');
    await endTurn($);
    herdrPress(w, id, {
        at: (w.clock as unknown as { now: () => number }).now(),
        steer: 'a swan',
        verdict: 'tick',
    });
    await $.session.attach(CLIENT);
    const back = await board($);
    expect(await back.find({ key: `kept:${key}`, type: 'Button' })).toBe(
        undefined,
    );
});

test('a phases steer a turn carried while he was away is forgotten as his text left', async ($, on) => {
    const w = world(on);
    const state = keptState(on, { orbit: orbitSeed() });
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a'], op: 'plan' });
    await ui.redraw();
    await ui.input({ key: 'plan:steer', kind: 'change', text: 'a first' });
    await w.clock.advance(FIELD_SAVE + 3500);
    await ui.press({ key: 'plan:tick' });
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    const left = (state.fields as Record<string, { left?: string }>)[
        'plan:steer'
    ]?.left;
    await say($, 'go');
    await w.clock.advance(0);
    expect([
        left,
        (state.fields as Record<string, { left?: string }>)['plan:steer']?.left,
    ]).toEqual(['a first', undefined]);
});

test("a phone attaching while he is away leaves the desktop's offer for his return", async ($, on) => {
    const { id, key, ui, w } = await askBoxOnBoard($, on);
    await ui.input({ key, kind: 'change', text: 'a heron' });
    await w.clock.advance(FIELD_SAVE + 3500);
    await $.session.detach({ ...CLIENT, reason: 'detach' });
    await ui.unmount();
    await $.session.attach({ clientId: 'phone', surface: 'mobile' });
    herdrPress(w, id, {
        at: (w.clock as unknown as { now: () => number }).now(),
        steer: 'a swan',
        verdict: 'tick',
    });
    await $.session.attach(CLIENT);
    const back = await board($);
    expect(
        (await back.find({ key: `kept:${key}`, type: 'Button' }))?.text,
    ).toEqual(expect.stringContaining('a heron'));
});
