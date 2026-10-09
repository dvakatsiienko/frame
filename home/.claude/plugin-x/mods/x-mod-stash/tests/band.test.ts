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
            plugin: 'x-mod-stash',
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
        plugin: 'x-mod-stash',
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

test("a peer's message leaves the asks open", async ($, on) => {
    mock.clock(on);
    mock.store(on);
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('prompt.submit', (_$, e) => ({ text: e.text }));
    on('classic.Stop', () => ({}));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    await $.classic.Stop({
        last_assistant_message: block,
        stop_hook_active: false,
    });
    await $.prompt.submit({
        origin: { kind: 'peer-send-message' },
        text: 'a note from a peer',
        wait: false,
    });
    await $.classic.Stop({
        last_assistant_message: 'noted',
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
        surface: 'desktop',
    });
    expect((await ui.find({ text: /open/ }))?.text).toContain('2 open');
});

test('every control in the row carries a hover card that names it', async ($, on) => {
    mock.clock(on);
    mock.store(on);
    on('classic.Stop', () => ({}));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    await $.classic.Stop({
        last_assistant_message: block,
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
    // the harness keeps `hover` out of props, so a card is a hidden Box with words
    const cards = (await ui.findAll({ type: 'Box' }))
        .filter((n) => n.props.display === 'none')
        .map((n) => n.text);
    expect(cards).toEqual([
        "copy this thread's asks",
        "keep this session's cache hot: ping every 50 min",
        'wake every session stopped on the 5h cap',
        'afk: tell fleet that dima is away',
        'unfold fleet board',
        'fold',
    ]);
});

test('the keys ride the hover cards, never the icons', async ($, on) => {
    mock.clock(on);
    mock.store(on);
    on('classic.Stop', () => ({}));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    await $.classic.Stop({
        last_assistant_message: block,
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
        surface: 'desktop',
    });
    const keyed = (await ui.findAll({ type: 'Button' }))
        .filter((n) => n.props.hotkey)
        .map((n) => `${n.key?.split(':')[1]} ${n.props.hotkey}`);
    expect(keyed).toEqual(['copy c', 'board b', 'asks-toggle f']);
});

test("a toggle's hover card names what the next press does", async ($, on) => {
    mock.clock(on);
    mock.store(on);
    on('classic.Stop', () => ({}));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    await $.classic.Stop({
        last_assistant_message: block,
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
    await ui.press({ key: 'asks-toggle' });
    await ui.press({ key: 'afk' });
    const cards = (await ui.findAll({ type: 'Box' }))
        .filter((n) => n.props.display === 'none')
        .map((n) => n.text);
    expect(cards.slice(-3)).toEqual([
        'back: tell fleet that dima is here',
        'unfold fleet board',
        'unfold',
    ]);
});
