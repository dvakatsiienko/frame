import { expect, mock, test } from 'claude-code/testing';

const props = {
    bodyColumns: 100,
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    scroll: { bodyRows: 40, offset: 0 },
    view: {},
};

for (const surface of ['terminal', 'desktop'] as const) {
    test(`the button flips afk on ${surface}`, async ($, on) => {
        mock.clock(on);
        mock.store(on);
        on('session.start', (_$, e) => ({ cwd: e.cwd }));
        on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
        await $.session.start({ cwd: '/tmp', isInteractive: true, surface });
        const ui = await $.ui.mount({
            component: 'AbovePrompt',
            plugin: 'x-mod-stash',
            props,
            surface,
        });
        // one icon either way; the secondary chip is the state
        const before = (await ui.find({ key: 'afk' }))?.props.variant;
        await ui.press({ key: 'afk' });
        const after = (await ui.find({ key: 'afk' }))?.props.variant;
        expect([before, after]).toEqual([undefined, 'secondary']);
    });
}

test('every prompt carries the local clock', async ($, on) => {
    mock.clock(on, { now: new Date(2026, 9, 7, 14, 5).getTime() });
    mock.store(on);
    const seen: (readonly string[] | undefined)[] = [];
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('prompt.submit', (_$, e) => {
        seen.push(e.context);
        return { text: e.text };
    });
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'terminal',
    });
    await $.prompt.submit({ text: 'hi' });
    expect(seen[0]).toContainEqual('now 14:05');
});

test('a prompt carries the away note only while afk is on', async ($, on) => {
    mock.clock(on);
    mock.store(on);
    const seen: (readonly string[] | undefined)[] = [];
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('prompt.submit', (_$, e) => {
        seen.push(e.context);
        return { text: e.text };
    });
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'terminal',
    });
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props,
        surface: 'terminal',
    });
    await $.prompt.submit({ text: 'hi' });
    await ui.press({ key: 'afk' });
    await $.prompt.submit({ text: 'hi again' });
    expect(seen[0] ?? []).not.toContainEqual(expect.stringContaining('afk'));
    expect(seen[1]).toContainEqual(expect.stringContaining('dima is afk'));
});
