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
            isWorking: false,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface: 'terminal',
    });
}

const hasEnhancer = async (ui: Awaited<ReturnType<typeof band>>) =>
    (await ui.find({ key: 'enh:enhance', type: 'Button' })) !== undefined;

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
        (await view.find({ key: 'part:stash.enhancer', type: 'Button' }))?.text,
    ]).toEqual([true, 'stash · band', '🪄 ⏪ ⏩ enhancer']);
});

test('the band draws no settings of its own', async ($, on) => {
    world(on);
    const ui = await band($);
    await ui.press({ key: 'settings' });
    expect([
        await ui.find({ key: 'part:stash.enhancer' }),
        await ui.find({ key: 'compact-at' }),
    ]).toEqual([undefined, undefined]);
});

test('a shown part is an accent button, a hidden one dim, with no shown or hidden words', async ($, on) => {
    world(on);
    await band($);
    const view = await pane($);
    const look = async () => {
        const b = await view.find({
            key: 'part:stash.enhancer',
            type: 'Button',
        });
        const row = await view.find({
            key: 'settings:row:stash.enhancer',
            type: 'Box',
        });
        return [b?.props.variant, b?.props.dimColor, row?.text];
    };
    const before = await look();
    await view.press({ key: 'part:stash.enhancer' });
    expect([before, await look()]).toEqual([
        ['primary', undefined, '🪄 ⏪ ⏩ enhancer'],
        [undefined, true, '🪄 ⏪ ⏩ enhancer'],
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

test('hiding the enhancer takes its buttons off the band and saves the switch', async ($, on) => {
    const { store } = world(on);
    const ui = await band($);
    const view = await pane($);
    await view.press({ key: 'part:stash.enhancer' });
    expect([await hasEnhancer(ui), store.get('shown')]).toEqual([
        false,
        { 'stash.enhancer': false },
    ]);
});

test('a switch another session saved shows here after one poll', async ($, on) => {
    const { clock, store } = world(on);
    const ui = await band($);
    store.set('shown', { 'stash.enhancer': false });
    await clock.advance(4000);
    expect(await hasEnhancer(ui)).toBe(false);
});

test('one flip back brings the enhancer buttons again', async ($, on) => {
    const { store } = world(on);
    store.set('shown', { 'stash.enhancer': false });
    const ui = await band($);
    const view = await pane($);
    await view.press({ key: 'part:stash.enhancer' });
    expect(await hasEnhancer(ui)).toBe(true);
});

// each band part: drawn by default, gone one poll after another session hides it
const BAND_PARTS: [string, { key?: string; text?: RegExp }][] = [
    ['stash.chips', { text: /^🪐 \d+$/ }],
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
    store.set('shown', { 'stash.enhancer': false });
    expect(await hasEnhancer(await band($))).toBe(false);
});

test("a flip keeps another session's switch it has not polled yet", async ($, on) => {
    const { store } = world(on);
    await band($);
    const view = await pane($);
    store.set('shown', { 'stash.chips': false });
    await view.press({ key: 'part:stash.enhancer' });
    expect(store.get('shown')).toEqual({
        'stash.chips': false,
        'stash.enhancer': false,
    });
});
