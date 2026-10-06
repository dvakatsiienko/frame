import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const block =
    '⏳ waiting on your word:\n\n```\nlane\n1. ship it ➡️ yes\n2. rename ➡️ no\n```';

// a session with open asks on its band; `/clear` and `/resume` hand the process a new conversation id
async function session($: Engine, on: On, peer?: string) {
    mock.clock(on);
    const store = mock.store(on);
    let sid = 'a1a1a1a1-0000';
    on('session.id', () => ({ value: sid }));
    on('session.repo', () => ({ value: null }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('classic.Stop', () => ({}));
    on('command.run', (_$, e) => {
        if (e.command === 'clear' || e.command === 'resume')
            sid = `${e.command}-0000`;
        return { text: '' };
    });
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'terminal',
    });
    await $.classic.Stop({
        last_assistant_message: block,
        session_id: sid,
        stop_hook_active: false,
    });
    if (peer)
        await $.classic.Stop({
            last_assistant_message: block,
            session_id: peer,
            stop_hook_active: false,
        });
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 100,
            hasSurvey: false,
            isWorking: false,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface: 'terminal',
    });
    const asks = async () =>
        (await ui.findAll({ text: /open asks?|ship it/, type: 'Text' })).map(
            (n) => n.text,
        );
    return { asks, store };
}

for (const command of ['clear', 'resume'] as const)
    test(`/${command} empties the band in the same turn`, async ($, on) => {
        const s = await session($, on);
        await $.command.run({ args: '', command });
        expect(await s.asks()).toEqual(['no open asks']);
    });

test("/clear leaves another conversation's asks on the band", async ($, on) => {
    const s = await session($, on, 'c3c3c3c3-0000');
    await $.command.run({ args: '', command: 'clear' });
    expect(await s.asks()).toContain('1. ship it ➡️ yes');
});
