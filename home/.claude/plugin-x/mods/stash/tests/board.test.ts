import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const NOW = 10_000_000;
const MIN = 60 * 1000;
const HERE = 'h1h1h1h1-here';
const PEER = 'p2p2p2p2-peer';
const GONE = 'g3g3g3g3-gone';
const REGISTRY: Record<
    string,
    { pid: number; sessionId: string; name: string }
> = {
    '/home/.claude/sessions/1.json': {
        name: '🦉 cclio',
        pid: 1,
        sessionId: HERE,
    },
    '/home/.claude/sessions/2.json': {
        name: '☕️ 🔧 FRM-1 code: x',
        pid: 2,
        sessionId: PEER,
    },
    '/home/.claude/sessions/3.json': { name: 'gone', pid: 3, sessionId: GONE },
};

// three registry files, pids 1 and 2 alive, the store already holding `store`
function fleet(on: On, store: Record<string, unknown> = {}) {
    mock.clock(on, { now: NOW });
    mock.store(on, store);
    on('session.id', () => ({ value: HERE }));
    on('env.get', () => ({ value: '/home' }));
    on('prompt.submit', (_$, e) => ({ text: e.text }));
    on('session.send', () => ({ isDelivered: true as const }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('fs.list', () => ({
        value: ['1.json', '2.json', '3.json', 'x.key'].map((name) => ({
            isLink: false,
            kind: 'file' as const,
            mtimeMs: 0,
            name,
            size: 1,
        })),
    }));
    on('fs.read', (_$, e) => {
        const entry = REGISTRY[e.path];
        return entry
            ? { value: JSON.stringify(entry) }
            : { deny: 'no such file' };
    });
    on('process.run', () => ({
        value: {
            exitCode: 1,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: '    1\n    2\n',
        },
    }));
}

async function rows($: Engine) {
    const ui = await $.ui.mount({
        component: 'Pane',
        plugin: 'stash',
        props: {
            bodyColumns: 100,
            isFocused: true,
            placement: 'dock',
            scroll: { bodyRows: 40, offset: 0 },
            title: 'fleet board',
            view: {},
        },
        requestId: 'fleet-board',
        surface: 'terminal',
    });
    return (await ui.findAll({ type: 'Box' }))
        .filter((n) => n.key?.startsWith('m:'))
        .map((n) =>
            (n.children as { text?: string; children?: unknown[] }[])
                .map((c) => (c.children ?? []).join(''))
                .join(' | '),
        );
}

test('the board lists every live session with its state and last message', async ($, on) => {
    fleet(on, {
        [`sent:${HERE}`]: NOW - 5 * MIN,
        [`state:${HERE}`]: { at: NOW, busy: true },
        [`state:${PEER}`]: { at: NOW, busy: false },
    });
    expect(await rows($)).toEqual([
        '☕️ 🔧 FRM-1 code: x | idle | no message yet',
        '🦉 cclio (here) | busy | sent 5m ago',
    ]);
});

test("a session's turn start shows it busy on the board", async ($, on) => {
    fleet(on);
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: 'go',
        wait: false,
    });
    expect((await rows($))[1]).toBe('🦉 cclio (here) | busy | no message yet');
});

test("a session's message out shows on the board", async ($, on) => {
    fleet(on);
    await $.session.send({ origin: { kind: 'model' }, text: 'hi', to: 'peer' });
    expect((await rows($))[1]).toBe('🦉 cclio (here) | ? | sent just now');
});
