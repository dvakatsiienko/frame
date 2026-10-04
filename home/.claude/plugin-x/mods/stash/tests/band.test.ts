import { expect, mock, test } from 'claude-code/testing';

const block =
    '⏳ waiting on your word:\n\n```\nlane\n1. ship it ➡️ yes\n2. rename ➡️ no\n```';

for (const surface of ['terminal', 'desktop'] as const) {
    test(`a reply's open asks show in the band on ${surface}`, async ($, on) => {
        mock.clock(on);
        mock.store(on);
        on('session.start', (_$, e) => ({ cwd: e.cwd }));
        on('classic.Stop', () => ({}));
        on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
        await $.session.start({ cwd: '/tmp', isInteractive: true, surface });
        await $.classic.Stop({
            last_assistant_message: block,
            stop_hook_active: false,
        });
        const ui = await $.ui.mount({
            component: 'AbovePrompt',
            plugin: 'stash',
            props: {
                bodyColumns: 100,
                hasSurvey: false,
                isWorking: false,
                maxRows: 12,
                scroll: { bodyRows: 40, offset: 0 },
                view: {},
            },
            surface,
        });
        expect((await ui.find({ text: /2 open/ }))?.text).toContain('2 open');
    });
}

test("the head's copy all copies this thread's asks as a lane block", async ($, on) => {
    mock.clock(on);
    mock.store(on);
    const copied: string[] = [];
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('classic.Stop', () => ({}));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('ui.copy', (_$, e) => {
        copied.push(e.text);
        return { value: { isCopied: true as const } };
    });
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    await $.classic.Stop({
        last_assistant_message: block,
        stop_hook_active: false,
    });
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'stash',
        props: {
            bodyColumns: 100,
            hasSurvey: false,
            isWorking: false,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface: 'desktop',
    });
    const copy = (await ui.findAll({ type: 'Button' })).find((n) =>
        n.key?.startsWith('copy:'),
    );
    await ui.press({ key: copy?.key ?? 'missing' });
    expect(copied).toEqual(['lane\n1. ship it ➡️ yes\n2. rename ➡️ no']);
});
