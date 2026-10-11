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
    return { appended, clock, store };
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

test('🎛️ folds out a switch per part, grouped under its mod', async ($, on) => {
    world(on);
    const ui = await band($);
    await ui.press({ key: 'settings' });
    expect([
        (await ui.find({ text: 'stash · band', type: 'Text' }))?.text,
        (await ui.find({ key: 'part:stash.enhancer', type: 'Button' }))?.text,
    ]).toEqual(['stash · band', '☑ 🪄 ⏪ ⏩ enhancer']);
});

test('a second 🎛️ press folds the view away and leaves no transcript rows', async ($, on) => {
    const { appended } = world(on);
    const ui = await band($);
    const before = appended.length;
    await ui.press({ key: 'settings' });
    await ui.press({ key: 'settings' });
    expect([
        await ui.find({ text: 'stash · band', type: 'Text' }),
        appended.length - before,
    ]).toEqual([undefined, 0]);
});

test('hiding the enhancer takes its buttons off the band and saves the switch', async ($, on) => {
    const { store } = world(on);
    const ui = await band($);
    await ui.press({ key: 'settings' });
    await ui.press({ key: 'part:stash.enhancer' });
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
    await ui.press({ key: 'settings' });
    await ui.press({ key: 'part:stash.enhancer' });
    expect(await hasEnhancer(ui)).toBe(true);
});
