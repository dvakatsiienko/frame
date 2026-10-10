import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const PEER = 'c3c3c3c3-0000';
const TOOL = 'mcp__x-mod-stash__orbit';

// a session whose orbit holds an ask, beside a peer whose stash mirrored one; `/clear` and `/resume` hand the process
// a new conversation id
async function session($: Engine, on: On) {
    mock.clock(on);
    // a store in memory the test reads back
    const store = new Map<string, unknown>([
        [`asks:${PEER}`, { asks: ['a peer ask'], at: 0, label: 'frame' }],
    ]);
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
    let sid = 'a1a1a1a1-0000';
    on('session.id', () => ({ value: sid }));
    on('session.repo', () => ({ value: null }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
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
    await $.tool.call({
        asks: [{ pick: 'yes', text: 'ship it' }],
        op: 'add',
        tool: TOOL,
    } as never);
    const ui = await $.ui.mount({
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
    return {
        chips: async () => (await ui.find({ text: /^🪐/, type: 'Text' }))?.text,
        store,
    };
}

const run = ($: Engine, command: 'clear' | 'resume') =>
    $.command.run({
        args: '',
        command,
        origin: { kind: 'composer' },
        presentation: { columns: 80, isFullscreen: false },
    });

for (const command of ['clear', 'resume'] as const)
    test(`/${command} empties orbit in the same turn`, async ($, on) => {
        const s = await session($, on);
        await run($, command);
        expect(await s.chips()).toBe('🪐 0');
    });

test("/clear leaves another session's asks in the store", async ($, on) => {
    const s = await session($, on);
    await run($, 'clear');
    expect(s.store.get(`asks:${PEER}`)).toEqual({
        asks: ['a peer ask'],
        at: 0,
        label: 'frame',
    });
});
