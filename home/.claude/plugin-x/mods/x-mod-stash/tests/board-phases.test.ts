import { expect, test } from 'claude-code/testing';

import { hrefs } from './orbit-helpers.ts';
import { type Board, board, orbit, start, world } from './orbit-world.ts';

test('the phases show in the board, a moon each, at most seven', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, {
        lines: ['now: a', 'next: b', 'then: c', 'd', 'e', 'f', 'g', 'h'],
        op: 'plan',
    });
    expect(
        (await ui.findAll({ type: 'Text' }))
            .map((t) => t.text)
            .filter((t) => /^[🌕🌔🌓🌒🌑] (?!phases)/u.test(t ?? '')),
    ).toEqual([
        '🌕 now: a',
        '🌔 next: b',
        '🌓 then: c',
        '🌒 d',
        '🌑 e',
        '🌑 f',
        '🌑 g',
    ]);
});

test('the phases stick to the bottom of a docked board', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    const boxes = await ui.findAll({ type: 'Box' });
    const gap = boxes.findIndex((b) => b.key === 'phases:gap');
    expect([
        boxes[0]?.props.minHeight,
        boxes[gap]?.props.flexGrow,
        boxes[gap + 1]?.key,
    ]).toEqual([40, 1, 'phases']);
});

test('a phase fades with its distance from now', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b', 'then: c'], op: 'plan' });
    expect(
        (await ui.findAll({ type: 'Text' }))
            .filter((t) => /^[🌕🌔🌓] (?!phases)/u.test(t.text ?? ''))
            .map((t) => [Boolean(t.props.bold), Boolean(t.props.dimColor)]),
    ).toEqual([
        [false, false],
        [false, false],
        [false, true],
    ]);
});

test('only the now lead word reads green', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    expect(
        (await ui.findAll({ type: 'Text' }))
            .filter((t) => t.text === 'now:' || t.text === 'next:')
            .map((t) => [t.text, Boolean(t.props.color)]),
    ).toEqual([
        ['now:', true],
        ['next:', false],
    ]);
});

test("a plan line's lead word prints bold", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, {
        lines: ['now: the slim row', 'no lead here'],
        op: 'plan',
    });
    const bold = (await ui.findAll({ type: 'Text' }))
        .filter((n) => n.props.bold)
        .map((n) => n.text);
    expect([bold.includes('now:'), bold.includes('no lead here')]).toEqual([
        true,
        false,
    ]);
});

test('a ticket id in a phase line opens its linear page', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: build BYT-12'], op: 'plan' });
    expect(await hrefs(ui)).toContain('https://linear.app/x-com/issue/BYT-12');
});

test('a phases tick is ready at once', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    await ui.press({ key: 'plan:tick' });
    expect((await ui.find({ key: 'plan:tick' }))?.text).toBe('✅ tick');
});

const phaseLines = async (ui: Board) =>
    (await ui.findAll({ type: 'Text' }))
        .map((t) => t.text ?? '')
        .filter((t) => /^[🌕🌔🌓🌒🌑] (?!phases)/u.test(t));

test('a ↑ on a phase moves it up on the board at once', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b', 'then: c'], op: 'plan' });
    await ui.press({ key: 'plan:1:up' });
    expect((await phaseLines(ui)).map((t) => t.slice(-1))).toEqual([
        'b',
        'a',
        'c',
    ]);
});

test("every phase line keeps the same two arrow buttons; an end's dead one does nothing", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b', 'then: c'], op: 'plan' });
    // the same two buttons on every line; a press on an end's dead one changes nothing (dima, 21:23)
    const has = async (k: string) => (await ui.find({ key: k }))?.type ?? '-';
    const before = await phaseLines(ui);
    await ui.press({ key: 'plan:0:up' });
    await ui.press({ key: 'plan:2:down' });
    expect([
        await Promise.all(
            [0, 1, 2]
                .flatMap((i) => [`plan:${i}:up`, `plan:${i}:down`])
                .map(has),
        ),
        await phaseLines(ui),
    ]).toEqual([Array(6).fill('Button'), before]);
});

test("the phases tick and steer sit in the card's head row, centered, before 📂 (dima, 21:26)", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    const head = await ui.find({ key: 'phases:head' });
    const act = await ui.find({ key: 'plan:act' });
    expect([
        head?.props.alignItems,
        (head?.children ?? []).map((c) => (c as { type?: string }).type),
        act?.props.alignItems,
        Boolean(await ui.find({ key: 'plan:tick' })),
    ]).toEqual(['center', ['Box', 'Box', 'Button'], 'center', true]);
});

test('a «siesta:» phase draws 🌤️ in place of its moon', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, {
        lines: ['now: a', 'siesta: wishkeeper', 'then: b'],
        op: 'plan',
    });
    const leads = (await ui.findAll({ type: 'Text' }))
        .map((t) => t.text ?? '')
        .filter((t) => /(now|siesta|then): /.test(t) && !/phases/.test(t))
        .map((t) => [...t][0]);
    expect(leads).toEqual(['🌕', '🌤', '🌓']);
});
