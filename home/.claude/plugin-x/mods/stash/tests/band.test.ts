import { expect, mock, test } from 'claude-code/testing';

const block =
    '⏳ waiting on your word:\n\n```\nlane\n1. ship it ➡️ yes\n2. rename ➡️ no\n```';

for (const surface of ['terminal', 'desktop'] as const) {
    test(`a reply's open asks show in the band on ${surface}`, async ($, on) => {
        mock.clock(on);
        mock.store(on);
        on('classic.SessionStart', () => ({}));
        on('classic.Stop', () => ({}));
        on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
        await $.classic.SessionStart({ source: 'startup' });
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
