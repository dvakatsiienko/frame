import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// the 🎛️ settings view (FRM-391 slice 05): a show/hide switch per part, saved to the store every session reads
const SID = 's1s1s1s1-set';

function world(on: On) {
    const clock = mock.clock(on);
    const store = new Map<string, unknown>();
    const appended: unknown[] = [];
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        store.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...store.keys()] }));
    on('store.delete', (_$, e) => {
        store.delete(e.key);
        return { value: undefined };
    });
    on('session.id', () => ({ value: SID }));
    on('env.get', () => ({ value: '/home' }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({ value: null }));
    on('session.append', (_$, e, next) => {
        appended.push(e);
        return next(e);
    });
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    const opened: string[] = [];
    const closed: string[] = [];
    on('ui.open', (_$, e) => {
        opened.push(e.id);
        return { value: { isPlaced: true } };
    });
    on('ui.close', (_$, e) => {
        closed.push(e.id);
        return { value: undefined };
    });
    return { appended, clock, closed, opened, store };
}

async function band($: Engine) {
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'terminal',
    });
    return $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 140,
            hasSurvey: false,
            isCollapsed: false,
            isWorking: false,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface: 'terminal',
    });
}

const hasWaker = async (ui: Awaited<ReturnType<typeof band>>) =>
    (await ui.find({ key: 'waker', type: 'Button' })) !== undefined;

// the 🎛️ pane, mounted once per test (a second mount of the same requestId throws)
const pane = ($: Engine) =>
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

test('🎛️ opens the settings pane: a switch per part, grouped under its mod', async ($, on) => {
    const { opened } = world(on);
    const ui = await band($);
    await ui.press({ key: 'settings' });
    const view = await pane($);
    expect([
        opened.includes('stash-settings'),
        (await view.find({ text: 'stash · band', type: 'Text' }))?.text,
        (await view.find({ key: 'part:stash.waker', type: 'Button' }))?.text,
    ]).toEqual([true, 'stash · band', '⏰ waker']);
});

test('the band draws no settings of its own', async ($, on) => {
    world(on);
    const ui = await band($);
    await ui.press({ key: 'settings' });
    expect([
        await ui.find({ key: 'part:stash.waker' }),
        await ui.find({ key: 'compact-at' }),
    ]).toEqual([undefined, undefined]);
});

test('a shown part is an accent button, a hidden one dim, with no shown or hidden words', async ($, on) => {
    world(on);
    await band($);
    const view = await pane($);
    const look = async () => {
        const b = await view.find({
            key: 'part:stash.waker',
            type: 'Button',
        });
        const row = await view.find({
            key: 'settings:row:stash.waker',
            type: 'Box',
        });
        return [b?.props.variant, b?.props.dimColor, row?.text];
    };
    const before = await look();
    await view.press({ key: 'part:stash.waker' });
    expect([before, await look()]).toEqual([
        ['primary', undefined, '⏰ waker'],
        [undefined, true, '⏰ waker'],
    ]);
});

test('the 📦 auto-compact field is the last section of 🎛️', async ($, on) => {
    world(on);
    await band($);
    const view = await pane($);
    const text = (await view.find({ key: 'settings:view', type: 'Box' }))?.text;
    expect(
        /📦 auto-compact at.*% of the context window$/su.test(text ?? ''),
    ).toBe(true);
});

test('a second 🎛️ press closes the pane and leaves no transcript rows', async ($, on) => {
    const { appended, closed } = world(on);
    const ui = await band($);
    const before = appended.length;
    await ui.press({ key: 'settings' });
    await ui.press({ key: 'settings' });
    expect([
        closed.includes('stash-settings'),
        appended.length - before,
    ]).toEqual([true, 0]);
});

test('hiding the ⏰ waker takes its button off the band and saves the switch', async ($, on) => {
    const { store } = world(on);
    const ui = await band($);
    const view = await pane($);
    await view.press({ key: 'part:stash.waker' });
    expect([await hasWaker(ui), store.get('shown')]).toEqual([
        false,
        { 'stash.waker': false },
    ]);
});

test('a switch another session saved shows here after one poll', async ($, on) => {
    const { clock, store } = world(on);
    const ui = await band($);
    store.set('shown', { 'stash.waker': false });
    await clock.advance(4000);
    expect(await hasWaker(ui)).toBe(false);
});

test('one flip back brings the ⏰ button again', async ($, on) => {
    const { store } = world(on);
    store.set('shown', { 'stash.waker': false });
    const ui = await band($);
    const view = await pane($);
    await view.press({ key: 'part:stash.waker' });
    expect(await hasWaker(ui)).toBe(true);
});

// each band part: drawn by default, gone one poll after another session hides it
const BAND_PARTS: [string, { key?: string; text?: RegExp }][] = [
    ['stash.wait', { text: /^🔭 / }],
    ['stash.hot', { key: 'hot' }],
    ['stash.waker', { key: 'waker' }],
    ['stash.afk', { key: 'afk' }],
    ['stash.board', { key: 'board' }],
];
for (const [part, query] of BAND_PARTS)
    test(`the ${part} switch hides its part in every band`, async ($, on) => {
        const { clock, store } = world(on);
        const ui = await band($);
        const drawn = async () =>
            (await ui.find(
                query.key
                    ? { key: query.key, type: 'Button' }
                    : { text: query.text, type: 'Text' },
            )) !== undefined;
        const before = await drawn();
        store.set('shown', { [part]: false });
        await clock.advance(4000);
        expect([before, await drawn()]).toEqual([true, false]);
    });

test('a switch saved before the session starts holds from its first draw', async ($, on) => {
    const { store } = world(on);
    store.set('shown', { 'stash.waker': false });
    expect(await hasWaker(await band($))).toBe(false);
});

test("a flip keeps another session's switch it has not polled yet", async ($, on) => {
    const { store } = world(on);
    await band($);
    const view = await pane($);
    store.set('shown', { 'stash.pace': false });
    await view.press({ key: 'part:stash.waker' });
    expect(store.get('shown')).toEqual({
        'stash.pace': false,
        'stash.waker': false,
    });
});

test('the pane holds no cut row', async ($, on) => {
    world(on);
    await band($);
    const view = await pane($);
    expect([
        await view.find({ key: 'part:stash.chips' }),
        await view.find({ text: /undo/ }),
    ]).toEqual([undefined, undefined]);
});

// the 🎛️ knobs (FRM-391 slice 06): a switch saves on its press, a number on each keystroke that makes a valid value
for (const [key, before, after] of [
    ['breathe', undefined, false],
    ['breath-preview', undefined, true],
    ['board-colour', undefined, true],
    ['speak-assumed', undefined, false],
    ['guard-silent', undefined, true],
    ['quiet-ask', undefined, false],
    ['quiet-done', undefined, false],
    ['quiet-escalate', undefined, false],
] as const)
    test(`the ${key} knob saves its flip at once`, async ($, on) => {
        const { store } = world(on);
        await band($);
        const view = await pane($);
        const was = store.get(key);
        await view.press({ key: `knob:${key}` });
        expect([was, store.get(key)]).toEqual([before, after]);
    });

test('a number knob saves each valid keystroke and never applies an invalid one', async ($, on) => {
    const { store } = world(on);
    await band($);
    const view = await pane($);
    const seen: unknown[] = [];
    for (const text of ['0', '0.', '0.7', '0.75', '9'])
        await view
            .input({ key: 'knob:breath-speed', kind: 'change', text })
            .then(() => seen.push(store.get('breath-speed')));
    expect(seen).toEqual([undefined, undefined, 0.7, 0.75, 0.75]);
});

test('the phase lines knob takes 5 to 7 only', async ($, on) => {
    const { store } = world(on);
    await band($);
    const view = await pane($);
    const seen: unknown[] = [];
    for (const text of ['8', '4', '6'])
        await view
            .input({ key: 'knob:phase-lines', kind: 'change', text })
            .then(() => seen.push(store.get('phase-lines')));
    expect(seen).toEqual([undefined, undefined, 6]);
});

test('🎛️ lays its cards in two columns, the bars, quiet comms and the context under the knobs', async ($, on) => {
    world(on);
    await band($);
    const view = await pane($);
    const cards = (await view.findAll({ type: 'Box' }))
        .filter((n) => n.props.borderStyle === 'round')
        .map((n) => n.key);
    const row = async (key: string) =>
        (await view.find({ key, type: 'Box' }))?.props.flexDirection;
    const note = (await view.findAll({ type: 'Box' })).find(
        (n) => n.props.display === 'none' && n.text?.includes('(1–60)'),
    );
    expect(note?.text).toBe('min (1–60)');
    expect([await row('settings:columns'), cards]).toEqual([
        'row',
        [
            'settings:stash · band',
            'settings:stash · board',
            'settings:stash · replies',
            'settings:knobs',
            'settings:bars',
            'settings:quiet',
            'settings:compact',
        ],
    ]);
});

for (const [key, label, cost] of [
    [
        'quiet-ask',
        "🤫 [ask] starts clio's turn",
        "off: a member's question waits for clio's next turn",
    ],
    [
        'quiet-done',
        "🤫 [done] starts clio's turn",
        "off: a finished chunk waits for clio's next turn, and a held [done] is not counted toward her due siesta",
    ],
    [
        'quiet-escalate',
        "🤫 [escalate] starts clio's turn",
        "off: an [escalate] waits for clio's next turn, a stuck member's too",
    ],
] as const) {
    test(`the ${key} row shows what off costs on hover alone`, async ($, on) => {
        world(on);
        await band($);
        const view = await pane($);
        const row = await view.find({ key: `knob:${key}`, type: 'Box' });
        const hidden = (row?.children ?? []).filter(
            (c) =>
                (c as { props?: { display?: string } }).props?.display ===
                'none',
        );
        expect(JSON.stringify(hidden)).toContain(cost);
    });

    test(`the ${key} row keeps its hover with the master switch off`, async ($, on) => {
        const { store } = world(on);
        store.set('quiet-comms', false);
        await band($);
        const view = await pane($);
        const row = await view.find({
            key: `quiet-kind:${key.replace('quiet-', '')}`,
            type: 'Box',
        });
        const hidden = (row?.children ?? []).filter(
            (c) =>
                (c as { props?: { display?: string } }).props?.display ===
                'none',
        );
        expect(JSON.stringify(hidden)).toContain(cost);
    });

    test(`the master switch off leaves ${key} no control, its state kept`, async ($, on) => {
        const { store } = world(on);
        store.set(key, false);
        store.set('quiet-comms', false);
        await band($);
        const view = await pane($);
        expect([
            await view.find({ key: `knob:${key}`, type: 'Button' }),
            (await view.find({ text: label, type: 'Text' }))?.props.dimColor,
            store.get(key),
        ]).toEqual([undefined, true, false]);
    });
}

// FRM-583 rider W37: a wind number the notice-below-wind rule refuses says why where it was typed, never nothing
const REASON = 'the notice line (70) must sit below the wind line (65)';
const shows = async (view: Awaited<ReturnType<typeof pane>>, text: string) =>
    (await view.findAll({ type: 'Text' })).some((t) =>
        (t.text ?? '').includes(text),
    );
for (const kind of ['change', 'submit'] as const)
    test(`a wind number the rule refuses, on ${kind}, shows the rule's reason under its field, the stored value kept`, async ($, on) => {
        const { store } = world(on);
        store.set('wind-notice', 55);
        await band($);
        const view = await pane($);
        await view.input({ key: 'knob:wind-notice', kind, text: '70' });
        expect([store.get('wind-notice'), await shows(view, REASON)]).toEqual([
            55,
            true,
        ]);
    });

test("a wind line raised past a refused notice clears the notice's stale reason", async ($, on) => {
    const { store } = world(on);
    await band($);
    const view = await pane($);
    await view.input({ key: 'knob:wind-notice', kind: 'change', text: '70' });
    await view.input({ key: 'knob:wind-at', kind: 'change', text: '80' });
    expect([store.get('wind-at'), await shows(view, 'must sit below')]).toEqual(
        [80, false],
    );
});

test('a wind number the rule allows saves as before and clears the reason', async ($, on) => {
    const { store } = world(on);
    await band($);
    const view = await pane($);
    await view.input({ key: 'knob:wind-notice', kind: 'change', text: '70' });
    await view.input({ key: 'knob:wind-notice', kind: 'change', text: '50' });
    expect([
        store.get('wind-notice'),
        await shows(view, 'must sit below'),
    ]).toEqual([50, false]);
});
