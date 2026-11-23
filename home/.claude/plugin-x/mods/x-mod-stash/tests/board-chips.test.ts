import { HERE, NOW, PEER, band, board, fleet } from './board-world.ts';
import { type Engine, expect, test } from './shared-boot.ts';

// dima keeps both takes (10-13 17:00): the 🎛️ switch picks the ring (C) or the % with a bar under it (B), every board
test('the 🎛️ ctx switch draws the bar instead of the ring, in a narrower column', async ($, on) => {
    fleet(on, { [`context:${HERE}`]: 43, 'ctx-ring': false });
    const ui = await board($);
    const meter = (await ui.findAll({ type: 'Svg' })).find(
        (n) => n.props.alt === 'ctx 43%',
    );
    const cell = (await ui.findAll({ type: 'Box' })).find(
        (b) => b.props.justifyContent === 'flex-end' && b.props.width === 5,
    );
    expect([
        String(meter?.props.source).includes('<circle'),
        cell !== undefined,
    ]).toEqual([false, true]);
});

test('the ring is the default ctx meter', async ($, on) => {
    fleet(on, { [`context:${HERE}`]: 43 });
    const ui = await board($);
    const meter = (await ui.findAll({ type: 'Svg' })).find(
        (n) => n.props.alt === 'ctx 43%',
    );
    expect(String(meter?.props.source).includes('<circle')).toBe(true);
});

test("the 🎛️ ctx switch, pressed in settings, turns the open board's ring into the bar at once", async ($, on) => {
    fleet(on, { [`context:${HERE}`]: 43 });
    const view = await board($);
    const isRing = async () =>
        String(
            (await view.findAll({ type: 'Svg' })).find(
                (n) => n.props.alt === 'ctx 43%',
            )?.props.source,
        ).includes('<circle');
    const before = await isRing();
    const settings = await $.ui.mount({
        component: 'Pane',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 80,
            isFocused: false,
            placement: 'dock',
            scroll: { bodyRows: 40, offset: 0 },
            title: '🎛️ settings',
            view: {},
        },
        requestId: 'stash-settings',
        surface: 'terminal',
    });
    await settings.press({ key: 'knob:ctx-bar' });
    expect([before, await isRing()]).toEqual([true, false]);
});

/* 🔥 keep-hot chip (FRM-499): every row, a --bg member's included, writes or deletes that session's `hot:<id>` */

const hotChip = async (
    view: Awaited<ReturnType<typeof board>>,
    sid: string,
) => {
    const chip = await view.find({ key: `hot:${sid}`, type: 'Button' });
    return chip && (chip.props.variant === 'secondary' ? 'on' : 'off');
};

// dima's 20:41 shots: on and off read alike as a faint dim; the chip now draws as the band's own 🔥 toggle
test("a row's 🔥 chip draws as the band's toggle: filled when on, plain when off", async ($, on) => {
    fleet(on, {}, { bg: [2] });
    const view = await board($);
    const look = async () => {
        const chip = await view.find({ key: `hot:${PEER}`, type: 'Button' });
        return {
            dimColor: chip?.props.dimColor,
            plain: chip?.props.plain,
            variant: chip?.props.variant,
        };
    };
    const off = await look();
    await view.press({ key: `hot:${PEER}` });
    expect([off, await look()]).toEqual([
        { dimColor: undefined, plain: true, variant: undefined },
        { dimColor: undefined, plain: undefined, variant: 'secondary' },
    ]);
});

test("a row's 🔥 chip carries no hover card: in a pane it wraps over its neighbours", async ($, on) => {
    fleet(on, {}, { bg: [2] });
    const view = await board($);
    expect(
        await view.find({ key: `tip:hot:${PEER}`, type: 'Box' }),
    ).toBeUndefined();
});

test("a --bg member's 🔥 chip writes its key and draws on", async ($, on) => {
    const f = fleet(on, {}, { bg: [2] });
    const view = await board($);
    const before = await hotChip(view, PEER);
    await view.press({ key: `hot:${PEER}` });
    expect([
        before,
        f.store.has(`hot:${PEER}`),
        await hotChip(view, PEER),
    ]).toEqual(['off', true, 'on']);
});

test('a second press on the 🔥 chip writes off and draws off', async ($, on) => {
    const f = fleet(on, {}, { bg: [2] });
    const view = await board($);
    await view.press({ key: `hot:${PEER}` });
    await view.press({ key: `hot:${PEER}` });
    expect([f.store.get(`hot:${PEER}`), await hotChip(view, PEER)]).toEqual([
        { off: true },
        'off',
    ]);
});

test("a session's own row chip and its band's 🔥 show one state, whichever is flipped", async ($, on) => {
    fleet(on, {}, { threads: [{ sessionId: HERE }] });
    const view = await board($);
    const strip = await band($);
    const bandHot = async () =>
        (await strip.findAll({ type: 'Button' })).find((n) => n.key === 'hot')
            ?.props.variant === 'secondary'
            ? 'on'
            : 'off';
    await view.press({ key: `hot:${HERE}` });
    const byChip = [await hotChip(view, HERE), await bandHot()];
    await strip.press({ key: 'hot' });
    expect([byChip, [await hotChip(view, HERE), await bandHot()]]).toEqual([
        ['on', 'on'],
        ['off', 'off'],
    ]);
});

/* 🐦‍🔥 second wind (todo 16): a button beside every row's ctx meter asks that session to refresh at a good stop */

const windButton = async (
    view: Awaited<ReturnType<typeof board>>,
    sid: string,
) => (await view.find({ key: `wind:${sid}`, type: 'Button' }))?.text;

test('every row draws the 🐦‍🔥 button, its own included', async ($, on) => {
    fleet(on);
    const view = await board($);
    expect([
        await windButton(view, HERE),
        await windButton(view, PEER),
    ]).toEqual(['🐦‍🔥', '🐦‍🔥']);
});

test('a press asks that session: the button and the line under its row say so', async ($, on) => {
    fleet(on);
    const view = await board($);
    await view.press({ key: `wind:${PEER}` });
    expect([
        await windButton(view, PEER),
        (
            await view.find({
                text: /second wind: asked, waits for its next turn/,
                type: 'Text',
            })
        )?.text,
    ]).toEqual(['🥚', expect.stringContaining('second wind')]);
});

test('a second press before the note went out takes the ask back, unseen', async ($, on) => {
    fleet(on);
    const view = await board($);
    await view.press({ key: `wind:${PEER}` });
    await view.press({ key: `wind:${PEER}` });
    expect([
        await windButton(view, PEER),
        await view.find({ text: /second wind:/, type: 'Text' }),
    ]).toEqual(['🐦‍🔥', undefined]);
});

test('a press after the note went out cancels, and a third asks again', async ($, on) => {
    const store: Record<string, unknown> = {
        [`wind:${PEER}`]: { at: NOW, state: 'writing' },
    };
    fleet(on, store);
    const view = await board($);
    const said = async () =>
        (await view.find({ text: /second wind:/, type: 'Text' }))?.text;
    await view.press({ key: `wind:${PEER}` });
    const cancelled = await said();
    const cancelButton = await windButton(view, PEER);
    await view.press({ key: `wind:${PEER}` });
    expect([cancelButton, cancelled, await said()]).toEqual([
        '↩️',
        expect.stringContaining('cancelled, tells it at its next turn'),
        expect.stringContaining('finishing its step, then its handoff'),
    ]);
});

test('a wind stopped on a handoff that left the store says so, never «still in the store»', async ($, on) => {
    const store: Record<string, unknown> = {
        [`wind:${PEER}`]: {
            at: NOW,
            isGone: true,
            slug: 'x-1',
            state: 'stopped',
        },
    };
    fleet(on, store);
    const view = await board($);
    expect(
        (await view.find({ text: /second wind:/, type: 'Text' }))?.text,
    ).toEqual(expect.stringContaining('stopped, its handoff left the store'));
});

test('a press while the session compacts changes nothing', async ($, on) => {
    const store: Record<string, unknown> = {
        [`wind:${PEER}`]: { at: NOW, slug: 'x-1', state: 'refreshing' },
    };
    fleet(on, store);
    const view = await board($);
    await view.press({ key: `wind:${PEER}` });
    expect(await windButton(view, PEER)).toBe('🌀');
});

test('🐦‍🔥 second wind switched off draws no button and no line', async ($, on) => {
    fleet(on, {
        shown: { 'stash.second-wind': false },
        [`wind:${PEER}`]: { at: NOW, state: 'asked' },
    });
    const view = await board($);
    expect([
        await windButton(view, PEER),
        await view.find({ text: /second wind:/, type: 'Text' }),
    ]).toEqual([undefined, undefined]);
});

test("the state column is as wide as the board's longest time, never a fixed 9", async ($, on) => {
    fleet(on);
    const view = await board($);
    const widths = (await view.findAll({ type: 'Box' }))
        .filter((n) => n.key?.startsWith('state:'))
        .map((n) => n.props.width);
    // 🦉 busy 3m, codie idle 12m: «12m», its emoji, its gap and a cell of air
    expect(widths).toEqual([7, 7]);
});

const settingsPane = ($: Engine) =>
    $.ui.mount({
        component: 'Pane',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 80,
            isFocused: false,
            placement: 'dock',
            scroll: { bodyRows: 40, offset: 0 },
            title: '🎛️ settings',
            view: {},
        },
        requestId: 'stash-settings',
        surface: 'terminal',
    });

test('the ctx meter type is two buttons, one lit; pressing the lit one changes nothing', async ($, on) => {
    fleet(on);
    await board($);
    const settings = await settingsPane($);
    const lit = async () =>
        (await settings.findAll({ type: 'Button' }))
            .filter(
                (b) =>
                    b.key?.startsWith('knob:ctx-') &&
                    b.props.variant === 'primary',
            )
            .map((b) => b.key);
    const before = await lit();
    await settings.press({ key: 'knob:ctx-ring' });
    const still = await lit();
    await settings.press({ key: 'knob:ctx-bar' });
    expect([before, still, await lit()]).toEqual([
        ['knob:ctx-ring'],
        ['knob:ctx-ring'],
        ['knob:ctx-bar'],
    ]);
});

test('the state column keeps a cell of air after the ctx meter on the desktop', async ($, on) => {
    fleet(on);
    const view = await board($);
    const margins = (await view.findAll({ type: 'Box' }))
        .filter((n) => n.key?.startsWith('state:'))
        .map((n) => n.props.marginLeft);
    expect(margins).toEqual([1, 1]);
});
