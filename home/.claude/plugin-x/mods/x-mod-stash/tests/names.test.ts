import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const NOW = 1_000_000;
const HERE = 'h1h1h1h1-here';
const PEER = 'p2p2p2p2-peer';
const block =
    '⏳ waiting on your word:\n\n```\nlane\n1. ship it ➡️ yes\n2. rename ➡️ no\n```';
const props = {
    bodyColumns: 100,
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    scroll: { bodyRows: 40, offset: 0 },
    view: {},
};

// a session whose registry file names it `name`, with the store already holding `store`
async function session(
    $: Engine,
    on: On,
    name: string,
    store: Record<string, unknown> = {},
) {
    mock.clock(on, { now: NOW });
    mock.store(on, store);
    on('session.id', () => ({ value: HERE }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/frame' },
    }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('prompt.submit', (_$, e) => ({ text: e.text }));
    on('classic.Stop', () => ({}));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('env.get', () => ({ value: '/home' }));
    on('fs.read', (_$, e) =>
        e.path === '/home/.claude/sessions/4242.json'
            ? { value: JSON.stringify({ name, pid: 4242 }) }
            : { deny: 'no such file' },
    );
    on('process.run', (_$, e) => ({
        value: {
            exitCode: e.argv[0] === 'sh' ? 0 : 1,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout:
                e.argv[0] === 'sh' ? '4242\nMon Oct  5 12:00:00 2026\n' : '',
        },
    }));
    await $.session.start({
        cwd: '/frame',
        isInteractive: true,
        surface: 'terminal',
    });
}

const mount = ($: Engine) =>
    $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props,
        surface: 'terminal',
    });

const entry = (name: string) => ({
    asks: ['an ask ➡️ yes'],
    at: NOW,
    label: 'frame',
    name,
});

const titles = async ($: Engine) =>
    (await (await mount($)).findAll({ type: 'Text' }))
        .filter((n) => n.props.bold === true && !n.text.startsWith('⏳'))
        .map((n) => n.text);

test("a reply's asks carry the session's registry name", async ($, on) => {
    await session($, on, '🦉 cclio', { [`asks:${PEER}`]: entry('☕️ coder') });
    await $.classic.Stop({
        last_assistant_message: block,
        session_id: HERE,
        stop_hook_active: false,
    });
    expect(await titles($)).toContain('🦉 cclio (here)');
});

test('two sessions sharing a name add the repo', async ($, on) => {
    await session($, on, 'twin', {
        [`asks:${HERE}`]: entry('twin'),
        [`asks:${PEER}`]: { ...entry('twin'), label: 'bytes' },
    });
    expect((await titles($)).sort()).toEqual([
        'twin · bytes',
        'twin · frame (here)',
    ]);
});

test("dima's answer typed into a background session clears its asks", async ($, on) => {
    await session($, on, 'bg');
    await $.classic.Stop({
        last_assistant_message: block,
        session_id: HERE,
        stop_hook_active: false,
    });
    await $.prompt.submit({
        origin: { kind: 'sdk' },
        text: '1. yes 2. no',
        wait: false,
    });
    await $.classic.Stop({
        last_assistant_message: 'done',
        session_id: HERE,
        stop_hook_active: false,
    });
    expect((await (await mount($)).find({ text: /open/ }))?.text).toContain(
        'no open asks',
    );
});

test('the head counts here and parallel, the names wait in its hover card', async ($, on) => {
    await session($, on, '🦉 cclio', {
        [`asks:${HERE}`]: entry('🦉 cclio'),
        [`asks:${PEER}`]: entry('☕️ coder'),
    });
    const ui = await mount($);
    const head = await ui.find({ text: /^here /, type: 'Text' });
    const card = (await ui.findAll({ type: 'Box' })).find(
        (n) => n.props.display === 'none' && n.text.includes('☕️ coder'),
    );
    expect([head?.text, card?.text]).toEqual([
        'here 1, parallel 1',
        '🦉 cclio (here) 1, ☕️ coder 1',
    ]);
});
