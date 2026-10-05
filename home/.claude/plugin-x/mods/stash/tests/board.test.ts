import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const NOW = 10_000_000;
const MIN = 60 * 1000;
const HERE = 'h1h1h1h1-here';
const PEER = 'p2p2p2p2-peer';
const GONE = 'g3g3g3g3-gone';
const PING = 'stash keep-hot ping: answer with one character, nothing else.';
const REGISTRY: Record<string, Record<string, unknown>> = {
    '/home/.claude/sessions/1.json': {
        hostSessionId: 'local_abc-1',
        name: '🦉 cclio',
        pid: 1,
        sessionId: HERE,
        status: 'busy',
        statusUpdatedAt: NOW - 3 * MIN,
    },
    '/home/.claude/sessions/2.json': {
        jobId: 'fef31d31',
        name: '☕️ 🔧 FRM-1 code: x',
        pid: 2,
        sessionId: PEER,
        status: 'idle',
        statusUpdatedAt: NOW - 12 * MIN,
    },
    '/home/.claude/sessions/3.json': { name: 'gone', pid: 3, sessionId: GONE },
};

// three registry files, the `alive` pids running (1 and 2 by default), `bg` of them background sessions, `patch` merged into an entry by pid
function fleet(
    on: On,
    store: Record<string, unknown> = {},
    {
        alive = [1, 2],
        bg = [] as number[],
        patch = {} as Record<number, Record<string, unknown>>,
    } = {},
) {
    const runs: string[][] = [];
    const copied: string[] = [];
    mock.clock(on, { now: NOW });
    mock.store(on, store);
    on('session.id', () => ({ value: HERE }));
    on('env.get', () => ({ value: '/home' }));
    on('prompt.submit', (_$, e) => ({ text: e.text }));
    on('session.send', () => ({ isDelivered: true as const }));
    on('classic.Stop', () => ({}));
    on('session.measure', (_$, e) => ({ changed: e.changed }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('ui.log', () => ({ value: undefined }));
    on('ui.copy', (_$, e) => {
        copied.push(e.text);
        return { value: { isCopied: true as const } };
    });
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
        if (!entry) return { deny: 'no such file' };
        const pid = entry.pid as number;
        return {
            value: JSON.stringify({
                ...entry,
                kind: bg.includes(pid) ? 'bg' : 'interactive',
                ...patch[pid],
            }),
        };
    });
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        return {
            value: {
                exitCode: e.argv[0] === 'ps' ? 1 : 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout:
                    e.argv[0] === 'ps'
                        ? alive.map((p) => `    ${p}\n`).join('')
                        : '',
            },
        };
    });
    return { copied, runs };
}

function board($: Engine) {
    return $.ui.mount({
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
        surface: 'desktop',
    });
}

// each member's whole row as one string, from one mount
async function rowsBySid($: Engine) {
    const ui = await board($);
    const rows: Record<string, string> = {};
    for (const n of await ui.findAll({ type: 'Box' }))
        if (n.key?.startsWith('m:')) rows[n.key.slice(2)] = n.text ?? '';
    return rows;
}

const row = async ($: Engine, sid: string) =>
    (await rowsBySid($))[sid] ?? 'no row';

const stop = ($: Engine, reply: string) =>
    $.classic.Stop({
        last_assistant_message: reply,
        session_id: HERE,
        stop_hook_active: false,
    });

// the control right of a session's name
const pressName = async ($: Engine, sid: string) =>
    (await board($)).press({ key: `door:${sid}` });

test('a session with a door is pressed by its whole name', async ($, on) => {
    fleet(
        on,
        {},
        { bg: [2], patch: { 2: { bridgeSessionId: 'session_01YZ' } } },
    );
    const ui = await board($);
    const name = await ui.find({ key: `door:${PEER}` });
    expect(name?.text).toBe('☕️ 🔧 FRM-1 code: x ↗');
});

test("the coordinator's name is bold text beside its own ↗", async ($, on) => {
    fleet(on);
    const ui = await board($);
    const [name, door] = await Promise.all([
        ui.find({ text: '🦉 cclio (here)', type: 'Text' }),
        ui.find({ key: `door:${HERE}` }),
    ]);
    expect([name?.props.bold, door?.text]).toEqual([true, '↗']);
});

test('the coordinator is pinned to the top of the board', async ($, on) => {
    fleet(on);
    const ui = await board($);
    const order = (await ui.findAll({ type: 'Box' }))
        .filter((n) => n.key?.startsWith('m:'))
        .map((n) => n.key);
    expect(order).toEqual([`m:${HERE}`, `m:${PEER}`]);
});

test('every row draws the same fact columns, empty ones included', async ($, on) => {
    fleet(on, { [`context:${HERE}`]: 43 });
    const ui = await board($);
    const widths = (await ui.findAll({ type: 'Box' }))
        .map((n) => n.props.width)
        .filter((w) => w !== undefined);
    expect(widths).toEqual([4, 8, 8, 16, 12, 4, 8, 8, 16, 12]);
});

test('a session inside a long shell command reads busy', async ($, on) => {
    fleet(on, {}, { patch: { 2: { status: 'shell' } } });
    expect(await row($, PEER)).toContain('busy 12m');
});

test('an idle session reads idle with its time in that state', async ($, on) => {
    fleet(on);
    expect(await row($, PEER)).toContain('idle 12m');
});

test("a reply's 🔭 line shows on its session's row", async ($, on) => {
    fleet(on);
    await stop(
        $,
        'shipped.\n\n➡️ next\n\n🔭 waiting on [🧪 #70](https://github.com/x/y/pull/70) — the pr watcher wakes me',
    );
    const ui = await board($);
    expect((await ui.find({ text: /^🔭/, type: 'Text' }))?.text).toBe(
        '🔭 waiting on 🧪 #70 — the pr watcher wakes me',
    );
});

test("a keep-hot ping's reply keeps what the session waits on", async ($, on) => {
    fleet(on);
    await stop($, 'done.\n\n🔭 waiting on ci — a ping');
    await $.prompt.submit({
        origin: { kind: 'plugin', name: 'stash' },
        text: PING,
        wait: false,
    });
    await stop($, '.');
    expect(await row($, HERE)).toContain('🔭 waiting on ci — a ping');
});

test("pressing a desktop session's name opens it in the desktop", async ($, on) => {
    const { runs } = fleet(on);
    await pressName($, HERE);
    expect(runs.filter(([cmd]) => cmd === 'open')).toEqual([
        ['open', 'claude://code/continue?session=local_abc-1'],
    ]);
});

test("pressing a bridged background session's name opens its claude.ai session", async ($, on) => {
    const { runs } = fleet(
        on,
        {},
        { bg: [2], patch: { 2: { bridgeSessionId: 'session_01YZ' } } },
    );
    await pressName($, PEER);
    expect(runs.filter(([cmd]) => cmd === 'open')).toEqual([
        ['open', 'claude://code/session_01YZ'],
    ]);
});

test("pressing an unbridged background session's name copies its attach command", async ($, on) => {
    const { copied } = fleet(on, {}, { bg: [2] });
    await pressName($, PEER);
    expect(copied).toEqual(['claude attach fef31d31']);
});

test('a terminal session with no door has nothing to press', async ($, on) => {
    fleet(on);
    const ui = await board($);
    const doors = (await ui.findAll({ type: 'Button' })).map((n) => n.key);
    expect(doors).toEqual([`door:${HERE}`]);
});

test('asks over a day old are not counted on the board', async ($, on) => {
    fleet(on, {
        [`asks:${PEER}`]: { asks: ['a'], at: NOW - 25 * 60 * MIN, label: 'x' },
    });
    expect(await row($, PEER)).not.toContain('⏳');
});

test("a row counts its session's open asks", async ($, on) => {
    fleet(on, {
        [`asks:${PEER}`]: { asks: ['a', 'b'], at: NOW, label: 'frame' },
    });
    expect(await row($, PEER)).toContain('⏳ 2');
});

test("a row shows its session's context fill", async ($, on) => {
    fleet(on);
    await $.session.measure({
        changed: ['context'],
        context: { percent: 43, tokens: 430_000, window: 1_000_000 },
        rateLimits: [],
    });
    expect(await row($, HERE)).toContain('ctx 43%');
});

test("a row links the ticket in its session's name", async ($, on) => {
    fleet(on);
    const ui = await board($);
    const link = await ui.find({ type: 'Link' });
    expect(link?.props.href).toBe('https://linear.app/x-com/issue/FRM-1');
});

test("a session's message out shows on the board", async ($, on) => {
    fleet(on);
    await $.session.send({ origin: { kind: 'model' }, text: 'hi', to: 'peer' });
    expect(await row($, HERE)).toContain('sent just now');
});

test('the board marks a background session named off the fleet pattern', async ($, on) => {
    fleet(on, {}, { alive: [1, 2, 3], bg: [2, 3] });
    const rows = await rowsBySid($);
    expect([rows[GONE]?.includes('⚠'), rows[PEER]?.includes('⚠')]).toEqual([
        true,
        false,
    ]);
});

function band($: Engine) {
    return $.ui.mount({
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
}

function panes(on: On, isOpen: boolean) {
    const calls: string[] = [];
    on('ui.panes', () => ({
        value: isOpen
            ? [
                  {
                      id: 'fleet-board',
                      isFocused: false,
                      isPlaced: true,
                      isShown: true,
                      plugin: 'stash',
                      title: 'fleet board',
                  },
              ]
            : [],
    }));
    on('ui.open', (_$, e) => {
        calls.push(`open ${e.id}`);
        return { value: { isPlaced: true as const } };
    });
    on('ui.close', (_$, e) => {
        calls.push(`close ${e.id}`);
        return { value: undefined };
    });
    return calls;
}

test('🚦 in the row opens a closed board', async ($, on) => {
    fleet(on);
    const calls = panes(on, false);
    const ui = await band($);
    await ui.press({ key: 'board' });
    expect(calls).toEqual(['open fleet-board']);
});

test('🚦 in the row closes an open board', async ($, on) => {
    fleet(on);
    const calls = panes(on, true);
    const ui = await band($);
    await ui.press({ key: 'board' });
    expect(calls).toEqual(['close fleet-board']);
});

test('a spawn that breaks a fleet rule shows a toast and goes ahead', async ($, on) => {
    mock.clock(on);
    mock.store(on);
    const toasts: string[] = [];
    on('ui.toast', (_$, e) => {
        toasts.push(e.text);
        return { value: undefined };
    });
    on('ui.log', () => ({ value: undefined }));
    on('agent.spawn', () => ({ model: 'claude-opus-5-5' }));
    const r = await $.agent.spawn({
        background: false,
        description: 'bulk rename',
        fork: false,
        parentModel: 'claude-opus-5-5',
        prompt: 'x'.repeat(500),
        provider: { plugin: 'engine', tier: 'core' },
        subagentType: 'Explore',
        tool_use_id: 'tu1',
    });
    expect([toasts, r.deny]).toEqual([
        [
            'spawn hint: a mechanical job belongs on chore-helper («bulk rename»)',
        ],
        undefined,
    ]);
});
