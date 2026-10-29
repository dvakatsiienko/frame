import type { FsEntry, On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { PALETTE, ctxBar, huesOf } from '../hooks/register.tsx';

const NOW = 10_000_000;
const MIN = 60 * 1000;
const HERE = 'h1h1h1h1-here';
const PEER = 'p2p2p2p2-peer';
const GONE = 'g3g3g3g3-gone';
const PING =
    'x-mod-stash keep-hot ping: answer with one character, nothing else.';
const REGISTRY: Record<string, Record<string, unknown>> = {
    '/home/.claude/sessions/1.json': {
        hostSessionId: 'local_abc-1',
        name: '🦉 clio',
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
        isBoardOpen = true,
        files = undefined as string[] | undefined,
        reads = {} as Record<string, string>,
        dirs = {} as Record<string, FsEntry[]>,
        isOwner = false,
        sends = {} as Record<string, string[]>,
        // a transcript's birth, epoch seconds by path, as `stat -f %B` prints it
        born = {} as Record<string, number>,
    } = {},
) {
    const runs: string[][] = [];
    if (files) on('fs.exists', (_$, e) => ({ value: files.includes(e.path) }));
    const clock = mock.clock(on, { now: NOW });
    // a store in memory the test reads back: what the ledger wrote is the contract now that no card draws it
    const kept = new Map<string, unknown>(Object.entries(store));
    on('store.get', (_$, e) => ({ value: kept.get(e.key) }));
    on('store.set', (_$, e) => {
        kept.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...kept.keys()] }));
    on('store.delete', (_$, e) => {
        kept.delete(e.key);
        return { value: undefined };
    });
    on('session.id', () => ({ value: HERE }));
    on('env.get', () => ({ value: '/home' }));
    on('prompt.submit', (_$, e) => ({ text: e.text }));
    on('classic.Stop', () => ({}));
    on('session.measure', (_$, e) => ({ changed: e.changed }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('ui.log', () => ({ value: undefined }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    if (isBoardOpen) panes(on, true);
    on('fs.list', (_$, e) => ({
        value:
            dirs[e.path] ??
            ['1.json', '2.json', '3.json', 'x.key'].map((name) => ({
                isLink: false,
                kind: 'file' as const,
                mtimeMs: 0,
                name,
                size: 1,
            })),
    }));
    on('fs.read', (_$, e) => {
        const extra = reads[e.path];
        if (extra !== undefined) return { value: extra };
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
                // `sh` is the board's own pid lookup: pid 1, the registry's clio, when the board is hers
                stdout:
                    e.argv[0] === 'stat'
                        ? `${born[e.argv.at(-1) ?? ''] ?? ''}\n`
                        : e.argv[0] === 'ps'
                          ? alive.map((p) => `    ${p}\n`).join('')
                          : e.argv[0] !== 'sh'
                            ? ''
                            : e.argv[2]?.includes('PPID')
                              ? isOwner
                                  ? '1\nMon Oct 12 15:00:00 2026\n'
                                  : ''
                              : (sends[e.argv[5] ?? ''] ?? []).join('\n'),
            },
        };
    });
    return { clock, runs, store: kept };
}

// the board as the poll leaves it: a session start reads the registry into the view, then the pane draws it
async function board($: Engine) {
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    return $.ui.mount({
        component: 'Pane',
        plugin: 'x-mod-stash',
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

test('every name is bold text, and a row holds no control', async ($, on) => {
    fleet(on);
    const ui = await board($);
    const [name, doors] = await Promise.all([
        ui.find({ text: '🦉 clio (here)', type: 'Text' }),
        ui.findAll({ type: 'Button' }),
    ]);
    expect([
        name?.props.bold,
        doors.filter((d) => d.key?.startsWith('door:')).length,
    ]).toEqual([true, 0]);
});

test('the sessions head reads its count and a bold busy on the right', async ($, on) => {
    fleet(on);
    const ui = await board($);
    const busy = await ui.find({ text: /^\d+ busy$/, type: 'Text' });
    expect([
        (await ui.find({ text: /on this mac · \d+ busy$/, type: 'Text' }))
            ?.text,
        busy?.props.bold,
    ]).toEqual([expect.stringMatching(/^\d+ on this mac · \d+ busy$/), true]);
});

test('the coordinator is pinned to the top of the board', async ($, on) => {
    fleet(on);
    const ui = await board($);
    const order = (await ui.findAll({ type: 'Box' }))
        .filter((n) => n.key?.startsWith('m:'))
        .map((n) => n.key);
    expect(order).toEqual([`m:${HERE}`, `m:${PEER}`]);
});

test("the coordinator's adviser is pinned second, above a coder whose name only mentions it", async ($, on) => {
    fleet(
        on,
        {},
        {
            alive: [1, 2, 3],
            patch: {
                2: { name: '☕️ 🔧 FRM-1 code: head + crow at decisions' },
                3: { name: '🐦 ⬛ crow' },
            },
        },
    );
    expect(Object.keys(await rowsBySid($))).toEqual([HERE, GONE, PEER]);
});

test("the coordinator's adviser's name is bold, like the coordinator's", async ($, on) => {
    fleet(on, {}, { alive: [1, 2, 3], patch: { 3: { name: '🐦 ⬛ crow' } } });
    const ui = await board($);
    const name = (await ui.findAll({ type: 'Text' })).find((t) =>
        (t.text ?? '').endsWith(' crow'),
    );
    expect(name?.props.bold).toBe(true);
});

test('a headless run named t-<hex> gets no row', async ($, on) => {
    fleet(on, {}, { alive: [1, 2, 3], patch: { 3: { name: 't-70' } } });
    expect(Object.keys(await rowsBySid($))).toEqual([HERE, PEER]);
});

test('a session started under a minute ago gets no row', async ($, on) => {
    fleet(on, {}, { patch: { 2: { startedAt: NOW - 59_000 } } });
    expect(Object.keys(await rowsBySid($))).toEqual([HERE]);
});

// a reboot relaunches every session under a new pid: one resumed has a transcript older than its process, a new one
// does not (dima's ✨ wisp, 10-13 16:26: the card showed clio alone)
test('a session resumed under a minute ago keeps its row', async ($, on) => {
    fleet(
        on,
        {},
        {
            born: { [`${PROJECT}/${PEER}.jsonl`]: (NOW - 2 * MIN) / 1000 },
            patch: { 2: { cwd: '/home/frame', startedAt: NOW - 20_000 } },
        },
    );
    expect(Object.keys(await rowsBySid($))).toEqual([HERE, PEER]);
});

test('a new session under a minute old, its transcript as young, still gets no row', async ($, on) => {
    fleet(
        on,
        {},
        {
            born: { [`${PROJECT}/${PEER}.jsonl`]: (NOW - 15_000) / 1000 },
            patch: { 2: { cwd: '/home/frame', startedAt: NOW - 20_000 } },
        },
    );
    expect(Object.keys(await rowsBySid($))).toEqual([HERE]);
});

test('a session that has lived a minute gets its row', async ($, on) => {
    fleet(on, {}, { patch: { 2: { startedAt: NOW - MIN } } });
    expect(Object.keys(await rowsBySid($))).toEqual([HERE, PEER]);
});

const PROJECT = '/home/.claude/projects/-home-frame';
const inFrame = { patch: { 2: { cwd: '/home/frame' } } };

test('a session with no transcript yet gets no row', async ($, on) => {
    fleet(on, {}, { ...inFrame, files: [PROJECT] });
    expect(await row($, PEER)).toBe('no row');
});

test('a session with its transcript gets its row', async ($, on) => {
    fleet(on, {}, { ...inFrame, files: [PROJECT, `${PROJECT}/${PEER}.jsonl`] });
    expect(await row($, PEER)).toContain('FRM-1');
});

test('a session whose project folder is missing keeps its row', async ($, on) => {
    fleet(on, {}, { ...inFrame, files: [] });
    expect(await row($, PEER)).toContain('FRM-1');
});

test('every row draws the same fact columns, empty ones included', async ($, on) => {
    fleet(on, { [`context:${HERE}`]: 43 });
    const ui = await board($);
    const widths = (await ui.findAll({ type: 'Box' }))
        .map((n) => n.props.width)
        .filter((w) => w !== undefined);
    // ticket, ctx, state (as wide as «12m»), asks
    expect(widths).toEqual([9, 7, 7, 4, 9, 7, 7, 4]);
});

test('a session inside a long shell command reads 🐚 with its time', async ($, on) => {
    fleet(on, {}, { patch: { 2: { status: 'shell' } } });
    expect(await row($, PEER)).toMatch(/🐚\s*12m/);
});

test('an idle session reads 💤 with its time, no word', async ($, on) => {
    fleet(on);
    const text = await row($, PEER);
    expect([/💤\s*12m/.test(text ?? ''), /idle|busy/.test(text ?? '')]).toEqual(
        [true, false],
    );
});

test('a member that starts a turn changes its row within a few seconds', async ($, on) => {
    const patch: Record<number, Record<string, unknown>> = {};
    const { clock } = fleet(on, {}, { patch });
    const ui = await board($);
    const rowText = async () =>
        (await ui.findAll({ type: 'Box' })).find((n) => n.key === `m:${PEER}`)
            ?.text;
    const before = await rowText();
    patch[2] = { status: 'busy' };
    await clock.advance(4_000);
    expect([before?.includes('🐆'), (await rowText())?.includes('🐆')]).toEqual(
        [false, true],
    );
});

for (const [status, emoji] of [
    ['busy', '🐆'],
    ['waiting', '⏳'],
    ['blocked', '🚧'],
    ['needs_input', '🙋'],
] as const)
    test(`a ${status} session reads ${emoji}`, async ($, on) => {
        fleet(on, {}, { patch: { 2: { status } } });
        expect(await row($, PEER)).toContain(emoji);
    });

test("an open board's span moves when its minute turns", async ($, on) => {
    const f = fleet(on);
    const ui = await board($);
    await f.clock.advance(60_000);
    const peer = (await ui.findAll({ type: 'Box' })).find(
        (n) => n.key === `m:${PEER}`,
    );
    expect(peer?.text).toMatch(/💤\s*13m/);
});

// the state cell's look, found by the start of its words
async function stateLook($: Engine, start: string) {
    const cell = (await colourTexts($)).find((t) => t.text?.startsWith(start));
    return cell ? { color: cell.color, dim: cell.dim } : 'no cell';
}

test("a busy session's time reads green with colour off", async ($, on) => {
    fleet(on);
    expect(await stateLook($, '3m')).toEqual({
        color: '#47915a',
        dim: false,
    });
});

test("an idle session's time under 30 minutes reads gray", async ($, on) => {
    fleet(on, {}, { patch: { 2: { statusUpdatedAt: NOW - 29 * MIN } } });
    expect(await stateLook($, '29m')).toEqual({ color: undefined, dim: true });
});

test('an idle row counts from its last reply, not a later registry restamp', async ($, on) => {
    fleet(
        on,
        { [`reply:${PEER}`]: { at: NOW - 2 * 60 * MIN } },
        { patch: { 2: { statusUpdatedAt: NOW - 3 * MIN } } },
    );
    expect(await row($, PEER)).toMatch(/💤\s*2h 0m/);
});

test('a keep-hot ping after the reply restarts the idle clock', async ($, on) => {
    fleet(on, {
        [`reply:${PEER}`]: { at: NOW - 2 * 60 * MIN, pingedAt: NOW - 5 * MIN },
    });
    expect(await row($, PEER)).toMatch(/💤\s*5m/);
});

test('a busy row keeps the registry stamp whatever its last reply', async ($, on) => {
    fleet(on, { [`reply:${HERE}`]: { at: NOW - 2 * 60 * MIN } });
    expect(await row($, HERE)).toMatch(/🐆\s*3m/);
});

test("a keep-hot ping's reply restarts its own session's idle clock", async ($, on) => {
    const f = fleet(on, {}, { patch: { 1: { status: 'idle' } } });
    await stop($, 'done.');
    await f.clock.advance(40 * MIN);
    await $.prompt.submit({
        origin: { kind: 'plugin', name: 'x-mod-stash' },
        text: PING,
        wait: false,
    });
    await stop($, '.');
    await f.clock.advance(2 * MIN);
    expect(await row($, HERE)).toMatch(/💤\s*2m/);
});

test("an idle session's time reads amber from 30 minutes", async ($, on) => {
    fleet(on, {}, { patch: { 2: { statusUpdatedAt: NOW - 30 * MIN } } });
    expect(await stateLook($, '30m')).toEqual({ color: '#d9661a', dim: false });
});

test("an idle session's time reads red from 45 minutes, and stays red", async ($, on) => {
    fleet(on, {}, { patch: { 2: { statusUpdatedAt: NOW - 75 * MIN } } });
    expect(await stateLook($, '1h 15m')).toEqual({
        color: '#e5484d',
        dim: false,
    });
});

test("a waiting session's time has no idle threshold", async ($, on) => {
    fleet(
        on,
        {},
        {
            patch: {
                2: { status: 'waiting', statusUpdatedAt: NOW - 50 * MIN },
            },
        },
    );
    expect(await stateLook($, '50m')).not.toEqual({
        color: '#e5484d',
        dim: false,
    });
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

test('with several waits the board row names every one by its own description', async ($, on) => {
    fleet(on);
    const task = (id: string, description: string) => ({
        description,
        id,
        status: 'running',
        type: 'shell',
    });
    await $.classic.Stop({
        background_tasks: [
            task('t1', 'Run the stash suite'),
            task('t2', 'Build sline'),
            task('t3', 'Probe the guard live'),
        ],
        last_assistant_message: 'three things running.',
        session_id: HERE,
        stop_hook_active: false,
    });
    expect(await row($, HERE)).toContain(
        '🔭 waiting on Run the stash suite; Build sline; Probe the guard live',
    );
});

test("a keep-hot ping's reply keeps what the session waits on", async ($, on) => {
    fleet(on);
    await stop($, 'done.\n\n🔭 waiting on ci — a ping');
    await $.prompt.submit({
        origin: { kind: 'plugin', name: 'x-mod-stash' },
        text: PING,
        wait: false,
    });
    await stop($, '.');
    expect(await row($, HERE)).toContain('🔭 waiting on ci — a ping');
});

test("the wait sits on a second line under the name, never on the name's line", async ($, on) => {
    fleet(on);
    await stop($, 'done.\n\n🔭 waiting on ci — a ping');
    const ui = await board($);
    const nameSide = (await ui.findAll({ type: 'Box' })).find(
        (b) =>
            b.props.overflow === 'hidden' && b.text?.includes('🦉 clio (here)'),
    );
    const second = (await ui.findAll({ type: 'Box' })).find(
        (b) => b.props.paddingLeft === 2 && b.text?.startsWith('🔭'),
    );
    expect([nameSide?.text?.includes('🔭'), second?.text]).toEqual([
        false,
        '🔭 waiting on ci — a ping',
    ]);
});

test("crow's tip line carries speak's buttons, reading the tip", async ($, on) => {
    fleet(
        on,
        {},
        {
            alive: [1, 2, 3],
            patch: { 3: { name: '🐦 ⬛ crow', sessionId: 'c3c3c3c3-crow' } },
            reads: {
                '/home/.local/state/crow/notes.jsonl': JSON.stringify({
                    at: new Date(NOW - MIN).toISOString(),
                    note: '- 👀 **for you:** read me aloud',
                }),
            },
        },
    );
    const ui = await board($);
    const keys = (await ui.findAll({ type: 'Button' })).map((b) => b.key);
    expect(
        ['read', 'pause', 'stop'].every((w) =>
            keys.includes(`orbit:${w}:crow:c3c3c3c3-crow`),
        ),
    ).toBe(true);
});

test("crow's line leads with read and pause, and stop closes it (dima, 18:29)", async ($, on) => {
    fleet(
        on,
        {},
        {
            alive: [1, 2, 3],
            patch: { 3: { name: '🐦 ⬛ crow', sessionId: 'c3c3c3c3-crow' } },
            reads: {
                '/home/.local/state/crow/notes.jsonl': JSON.stringify({
                    at: new Date(NOW - MIN).toISOString(),
                    note: '- 👀 **for you:** read me aloud',
                }),
            },
        },
    );
    const ui = await board($);
    const row =
        (await ui.find({ key: 'm:c3c3c3c3-crow', type: 'Box' }))?.text ?? '';
    const at = (s: string) => row.indexOf(s);
    expect([
        at('🔊') < at('👀'),
        at('▶️') < at('👀'),
        at('⏹️') < at('👀'),
    ]).toEqual([true, true, true]);
});

const held = (from: string, text: string, ago: number) => ({
    at: NOW - ago * MIN,
    from,
    text,
});

test('a row shows 🤫 n while its session holds n member pings, nothing at 0', async ($, on) => {
    fleet(on, {
        [`quiet-held:${HERE}`]: [held('a', 'x', 1), held('b', 'y', 2)],
        [`quiet-held:${PEER}`]: [],
    });
    const rows = await rowsBySid($);
    expect([rows[HERE]?.includes('🤫 2'), rows[PEER]?.includes('🤫')]).toEqual([
        true,
        false,
    ]);
});

test('🤫 n opens the held pings: sender, age, first line', async ($, on) => {
    fleet(on, {
        [`quiet-held:${HERE}`]: [held('🔎 verifier', 'round 2 clean', 3)],
    });
    const ui = await board($);
    const closed = (await ui.findAll({ type: 'Text' })).some((t) =>
        t.text?.includes('round 2 clean'),
    );
    await ui.press({ key: `fold:quiet:${HERE}` });
    const line = (await ui.findAll({ type: 'Text' })).find((t) =>
        t.text?.includes('round 2 clean'),
    )?.text;
    expect([closed, line]).toEqual([
        false,
        '🤫 🔎 verifier · 3m ago: round 2 clean',
    ]);
});

test('asks over a day old are not counted on the board', async ($, on) => {
    fleet(on, {
        [`asks:${PEER}`]: { asks: ['a'], at: NOW - 25 * 60 * MIN, label: 'x' },
    });
    expect(await row($, PEER)).toContain('🪐 0');
});

test("a row counts its session's open asks", async ($, on) => {
    fleet(on, {
        [`asks:${PEER}`]: { asks: ['a', 'b'], at: NOW, label: 'frame' },
    });
    expect(await row($, PEER)).toContain('🪐 2');
});

test("a row's 🪐 n reads bold amber while it holds asks, dim at 0", async ($, on) => {
    fleet(on, {
        [`asks:${PEER}`]: { asks: ['a', 'b'], at: NOW, label: 'frame' },
    });
    const ui = await board($);
    const count = async (text: string) => {
        const t = await ui.find({ text, type: 'Text' });
        return [t?.props.bold, t?.props.color, t?.props.dimColor];
    };
    expect([await count('🪐 2'), await count('🪐 0')]).toEqual([
        [true, '#d9661a', false],
        [false, undefined, true],
    ]);
});

test("a row shows its session's context fill", async ($, on) => {
    fleet(on);
    await $.session.measure({
        changed: ['context'],
        context: { percent: 43, tokens: 430_000, window: 1_000_000 },
        rateLimits: [],
    });
    const ui = await board($);
    const pill = (await ui.findAll({ type: 'Svg' })).find(
        (n) => n.props.alt === 'ctx 43%',
    );
    expect([
        pill?.type,
        pill?.props.alt,
        String(pill?.props.source).includes('>43%<'),
    ]).toEqual(['Svg', 'ctx 43%', true]);
});

// the 9-cell fact columns on the whole board: each row's state, plus its ticket column when one is drawn
// the ticket column is the one 9 cells wide, now the state column sizes to its times
async function nineCellColumns($: Engine) {
    const ui = await board($);
    return (await ui.findAll({ type: 'Box' })).filter(
        (b) => b.props.width === 9,
    ).length;
}

test('with no ticket on any row, no row draws the ticket column', async ($, on) => {
    fleet(on, {}, { patch: { 2: { name: '☕️ 🔧 code: x' } } });
    expect(await nineCellColumns($)).toBe(0);
});

test('with a ticket on one row, every row keeps the ticket column', async ($, on) => {
    fleet(on);
    expect(await nineCellColumns($)).toBe(2);
});

test("a row's wait sits in one clipped row, never wrapping to a second", async ($, on) => {
    fleet(on);
    await stop(
        $,
        'done.\n\n🔭 waiting on a very long description of what this session waits on',
    );
    const ui = await board($);
    const wait = (await ui.findAll({ type: 'Box' })).find(
        (b) => b.props.height === 1 && b.text?.startsWith('🔭'),
    );
    expect(wait?.props.overflow).toBe('hidden');
});

test("a row links the ticket in its session's name", async ($, on) => {
    fleet(on);
    const ui = await board($);
    const link = await ui.find({ type: 'Link' });
    expect(link?.props.href).toBe('https://linear.app/x-com/issue/FRM-1');
});

// crow's notes file as her wakes write it: one json line per note, the 👀 «for you» line inside the note's text
const crowNotes = (notes: { at: number; note: string }[]) => ({
    '/home/.local/state/crow/notes.jsonl': notes
        .map((n) =>
            JSON.stringify({ at: new Date(n.at).toISOString(), note: n.note }),
        )
        .join('\n'),
});

const CROW_SID = 'c3c3c3c3-crow';
const asCrow = { 3: { name: '🐦 ⬛ crow', sessionId: CROW_SID } };

test("crow's row shows her newest 👀 for-you tip in the wait slot", async ($, on) => {
    fleet(
        on,
        {},
        {
            alive: [1, 2, 3],
            patch: asCrow,
            reads: crowNotes([
                {
                    at: NOW - 30 * MIN,
                    note: '🐦‍⬛ **15:00** wake\n- 👀 **for you:** an older tip',
                },
                {
                    at: NOW - 5 * MIN,
                    note: '🐦‍⬛ **15:27** wake\n🟡 held\n- 👀 **for you:** ask her whether **l8** still fits one window',
                },
                {
                    at: NOW - 2 * MIN,
                    note: '🐦‍⬛ **15:30** wake\n🔴 sent: no tip this time',
                },
            ]),
        },
    );
    expect(await row($, CROW_SID)).toContain(
        '👀 ask her whether l8 still fits one window',
    );
});

test('a tip over a day old leaves her row', async ($, on) => {
    fleet(
        on,
        {},
        {
            alive: [1, 2, 3],
            patch: asCrow,
            reads: crowNotes([
                {
                    at: NOW - 25 * 60 * MIN,
                    note: '- 👀 **for you:** stale advice',
                },
            ]),
        },
    );
    expect(await row($, CROW_SID)).not.toContain('👀');
});

// NOW reads 1970-01-01 early morning in any zone from UTC-2 to UTC+14, so 6 h back is the day before, under 24 h old
test('a tip from yesterday never draws, even under a day old', async ($, on) => {
    fleet(
        on,
        {},
        {
            alive: [1, 2, 3],
            patch: asCrow,
            reads: crowNotes([
                {
                    at: NOW - 6 * 60 * MIN,
                    note: "- 👀 **for you:** yesterday's advice",
                },
                { at: NOW - 5 * MIN, note: '🐦‍⬛ **15:30** wake\n🔴 no tip' },
            ]),
        },
    );
    expect(await row($, CROW_SID)).not.toContain('👀');
});

test('a tip line with no leading bullet draws, as her notes print it now', async ($, on) => {
    fleet(
        on,
        {},
        {
            alive: [1, 2, 3],
            patch: asCrow,
            reads: crowNotes([
                {
                    at: NOW - 5 * MIN,
                    note: '🐦‍⬛ **15:27** wake\n\n👀 **for you:** the rule was the right size',
                },
            ]),
        },
    );
    expect(await row($, CROW_SID)).toContain('👀 the rule was the right size');
});

test("no other session's row carries her tip", async ($, on) => {
    fleet(
        on,
        {},
        {
            alive: [1, 2, 3],
            patch: asCrow,
            reads: crowNotes([
                { at: NOW - 5 * MIN, note: '- 👀 **for you:** only hers' },
            ]),
        },
    );
    const rows = await rowsBySid($);
    expect([rows[PEER], rows[HERE]].join('\n')).not.toContain('👀');
});

// cc's registry keeps «🐦‍⬛ crow» with its zero-width joiner turned into a space
test("crow's black bird keeps its joiner on the board", async ($, on) => {
    fleet(on, {}, { patch: { 2: { name: '\u{1F426} \u{2B1B} crow' } } });
    expect(await row($, PEER)).toContain('\u{1F426}\u{200D}\u{2B1B} crow');
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
                      plugin: 'x-mod-stash',
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
    fleet(on, {}, { isBoardOpen: false });
    const calls = panes(on, false);
    const ui = await band($);
    await ui.press({ key: 'board' });
    expect(calls).toEqual(['open fleet-board']);
});

test('🚦 in the row closes an open board', async ($, on) => {
    fleet(on, {}, { isBoardOpen: false });
    const calls = panes(on, true);
    const ui = await band($);
    await ui.press({ key: 'board' });
    expect(calls).toEqual(['close fleet-board']);
});

// the model answers every request with nothing; `step` sends one of this session's main loop, or of a subagent's when `agentId` is given
function steps($: Engine, on: On) {
    // biome-ignore lint/correctness/useYield: the model's empty answer streams no chunk, only its result
    on('turn.step', async function* (_$, e) {
        return {
            answer: '',
            index: e.index,
            stopReason: null,
            toolUses: [],
            turnId: e.turnId,
            usage: null,
        };
    });
    // the stream runs only as it is read, so the request is read to its end
    return async (model: string, effort?: string, agentId?: string) => {
        const stream = $.turn.step({
            agentId,
            // an effort off cc's words too, so the row's fallback is reachable
            effort: effort as never,
            index: 0,
            messageCount: 1,
            model,
            turnId: 't1',
        });
        for await (const _ of stream);
        return stream.result;
    };
}

test("a row shows its session's model on the name's line, its effort as lit cells", async ($, on) => {
    fleet(on);
    await steps($, on)('claude-opus-5-5', 'medium');
    const ui = await board($);
    const nameSide = (await ui.findAll({ type: 'Box' })).find(
        (b) =>
            b.props.overflow === 'hidden' && b.text?.includes('🦉 clio (here)'),
    );
    const cells = (await ui.findAll({ type: 'Svg' })).find((n) =>
        String(n.props.alt).startsWith('effort'),
    );
    expect([
        nameSide?.text?.includes('opus 5.5'),
        cells?.props.alt,
        String(cells?.props.source).match(/class="e\d"/g)?.length,
        String(cells?.props.source).match(/class="off"/g)?.length,
    ]).toEqual([true, 'effort medium', 2, 3]);
});

test('max effort lights all five cells', async ($, on) => {
    fleet(on);
    await steps($, on)('claude-opus-5-5', 'max');
    const ui = await board($);
    const cells = (await ui.findAll({ type: 'Svg' })).find((n) =>
        String(n.props.alt).startsWith('effort'),
    );
    expect(String(cells?.props.source).match(/class="e\d"/g)?.length).toBe(5);
});

test('an effort cc names off the five words reads as its word', async ($, on) => {
    fleet(on);
    await steps($, on)('claude-opus-5-5', 'ultra');
    expect(await row($, HERE)).toContain('ultra');
});

test("with the rows' meta switched off, a row shows no model", async ($, on) => {
    fleet(on, { shown: { 'stash.rowmeta': false } });
    await steps($, on)('claude-opus-5-5', 'medium');
    expect(await row($, HERE)).not.toContain('opus 5.5');
});

test('a dated model id with no effort shows family and version alone', async ($, on) => {
    fleet(on);
    await steps($, on)('claude-haiku-4-5-20251001');
    expect(await row($, HERE)).toMatch(/haiku 4\.5(?! ·)/);
});

test("a subagent's model never replaces its session's", async ($, on) => {
    fleet(on);
    const step = steps($, on);
    await step('claude-opus-5-5', 'medium');
    await step('claude-haiku-4-5', 'high', 'sub-1');
    expect(await row($, HERE)).toContain('opus 5.5');
});

// the colour of the state dot that leads the coordinator's row, the board's first
async function dotColour($: Engine) {
    const ui = await board($);
    const dots = await ui.findAll({ text: '●', type: 'Text' });
    const dot = dots[0];
    if (!dot) return 'no dot';
    return typeof dot.props.color === 'string' ? dot.props.color : 'none';
}

test('the board draws its state dots without colour by default', async ($, on) => {
    fleet(on);
    expect(await dotColour($)).toBe('none');
});

test('/board colour turns the board colour on', async ($, on) => {
    fleet(on);
    on('command.run', () => ({ text: '' }));
    await $.command.run({
        args: 'colour',
        command: 'board',
        origin: { kind: 'composer' },
        presentation: { columns: 80, isFullscreen: false },
    });
    expect(await dotColour($)).toMatch(/^#/);
});

test('the 🎛️ colour switch reaches the open board at once, never at the next poll', async ($, on) => {
    fleet(on);
    const view = await board($);
    const dot = async () =>
        (await view.findAll({ text: '●', type: 'Text' }))[0]?.props.color ??
        'none';
    const before = await dot();
    const settings = await $.ui.mount({
        component: 'Pane',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 80,
            isFocused: false,
            placement: 'dock',
            scroll: { bodyRows: 40, offset: 0 },
            title: '🎛️ settings',
            view: {},
        },
        requestId: 'stash-settings',
        surface: 'terminal',
    });
    await settings.press({ key: 'knob:board-colour' });
    expect([before, await dot()]).toEqual([
        'none',
        expect.stringMatching(/^#/),
    ]);
});

// every Text the board draws with colour on, by its text, with its colour and dim
async function colourTexts($: Engine) {
    const ui = await board($);
    const texts = await ui.findAll({ type: 'Text' });
    return texts.map((t) => ({
        color: t.props.color,
        dim: t.props.dimColor === true,
        text: t.text,
    }));
}

test("with colour on, each member's dot wears its own hue", async ($, on) => {
    fleet(on, { 'board-colour': true });
    const dots = (await colourTexts($)).filter((t) => t.text === '●');
    const hues = dots.map((d) => d.color);
    expect([
        hues.length,
        new Set(hues).size,
        hues.every((h) => /^#/.test(String(h))),
    ]).toEqual([2, 2, true]);
});

test('two members whose names hash alike still get two hues', () => {
    const hues = huesOf(['☕️ 🔧 twin', '☕️ 🔧 twin']);
    expect(new Set(hues).size).toBe(2);
});

test("with colour on, an idle member's dot is dimmed and a busy one's is not", async ($, on) => {
    fleet(on, { 'board-colour': true });
    const dots = (await colourTexts($)).filter((t) => t.text === '●');
    // clio is pinned first and busy, the coder second and idle
    expect(dots.map((d) => d.dim)).toEqual([false, true]);
});

test("every row's ctx meter on the board is one width and prints its own %", async ($, on) => {
    fleet(on, { [`context:${HERE}`]: 3, [`context:${PEER}`]: 100 });
    const ui = await board($);
    const meters = (await ui.findAll({ type: 'Svg' })).filter((n) =>
        /^ctx /.test(String(n.props.alt)),
    );
    expect(
        meters.map((n) => {
            const svg = String(n.props.source);
            return [
                svg.match(/<svg[^>]* width="(\d+)"/)?.[1],
                svg.match(/>(\d+%)</)?.[1],
            ];
        }),
    ).toEqual([
        ['50', '3%'],
        ['50', '100%'],
    ]);
});

test('the sessions head leads with 🌌, since the tab holds 🚦', async ($, on) => {
    fleet(on);
    const ui = await board($);
    expect((await ui.find({ text: /sessions$/, type: 'Text' }))?.text).toBe(
        '🌌 sessions',
    );
});

test('📁 folds the sessions card to its head row', async ($, on) => {
    fleet(on);
    const ui = await board($);
    const rows = async () =>
        (await ui.findAll({ type: 'Box' })).filter((n) =>
            n.key?.startsWith('m:'),
        ).length;
    const open = await rows();
    await ui.press({ key: 'fold:sessions' });
    expect([open > 0, await rows()]).toEqual([true, 0]);
});

test("an idle state's time reads bold, as a busy one does", async ($, on) => {
    fleet(on);
    const ui = await board($);
    const idle = (await ui.findAll({ type: 'Text' })).find(
        (t) => t.text === '12m',
    );
    expect(idle?.props.bold).toBe(true);
});

test("a row's 🔭 line prints only the who bold", async ($, on) => {
    fleet(on);
    await stop($, 'done.\n\n🔭 waiting on ci — a ping');
    const ui = await board($);
    const bold = (await ui.findAll({ type: 'Text' }))
        .filter((t) => t.props.bold === true)
        .map((t) => t.text);
    expect([
        bold.includes('ci'),
        bold.some((t) => t?.includes('a ping')),
    ]).toEqual([true, false]);
});

test("a row's 🔭 line with several waits is one plain run, so it cuts instead of wrapping", async ($, on) => {
    fleet(on);
    await stop(
        $,
        'done.\n\n🔭 waiting on prompt-audit slice A: the root files; prompt-audit slice B: rules and agents',
    );
    const ui = await board($);
    const texts = await ui.findAll({ type: 'Text' });
    const line = texts.find((t) => t.text?.startsWith('🔭 waiting on'));
    expect([
        line?.text,
        texts.some((t) => t.props.bold === true && t.text?.includes('slice')),
    ]).toEqual([
        '🔭 waiting on prompt-audit slice A: the root files; prompt-audit slice B: rules and agents',
        false,
    ]);
});

// a probe mod left in ~/.claude/dev-mods past its probe (pk-93's qc-view swallowed a brief after its proof)
const DEV = '/home/.claude/dev-mods';
const dir = (name: string, mtimeMs = 0): FsEntry => ({
    isLink: false,
    kind: 'dir',
    mtimeMs,
    name,
    size: 0,
});
const probes = (sid: string, mods: FsEntry[]) => ({
    [DEV]: [dir(sid)],
    [`${DEV}/${sid}`]: mods,
});
const probeRow = async ($: Engine) =>
    (await (await board($)).find({ text: /^🧪/, type: 'Text' }))?.text;

test("a probe whose session is gone warns on clio's board", async ($, on) => {
    fleet(
        on,
        {},
        { dirs: probes(GONE, [dir('qc-view', NOW - MIN)]), isOwner: true },
    );
    expect(await probeRow($)).toBe(
        '🧪 stale probe mods in ~/.claude/dev-mods, unload them: qc-view (g3g3g3g3)',
    );
});

test('a probe older than a day warns while its session still runs', async ($, on) => {
    fleet(
        on,
        {},
        {
            dirs: probes(PEER, [dir('qc-view', NOW - 25 * 60 * MIN)]),
            isOwner: true,
        },
    );
    expect(await probeRow($)).toContain('qc-view (p2p2p2p2)');
});

test("a live session's fresh probe draws no warning", async ($, on) => {
    fleet(
        on,
        {},
        { dirs: probes(PEER, [dir('qc-view', NOW - MIN)]), isOwner: true },
    );
    expect(await probeRow($)).toBeUndefined();
});

test('a dev-mods folder holding only a file draws no warning', async ($, on) => {
    fleet(
        on,
        {},
        {
            dirs: probes(GONE, [
                { ...dir('notes.md', NOW - MIN), kind: 'file' },
            ]),
            isOwner: true,
        },
    );
    expect(await probeRow($)).toBeUndefined();
});

test("a stale probe stays off any board but clio's", async ($, on) => {
    fleet(on, {}, { dirs: probes(GONE, [dir('qc-view', NOW - MIN)]) });
    expect(await probeRow($)).toBeUndefined();
});

// the quiet ledger (brief 6): a member's transcript sends to clio against her quiet log, on her board only
const DAY = new Date(NOW).toISOString().slice(0, 10);
const at = (ms: number) => new Date(ms).toISOString();
const logged = (from: string, ms: number, verdict = 'held') => ({
    arm: 'on',
    at: ms,
    from,
    startedTurn: false,
    tag: 'progress',
    verdict,
});
const PEER_NAME = '☕️ 🔧 FRM-1 code: x';
const gapRow = async (
    $: Engine,
    clock: { advance: (ms: number) => Promise<void> },
    store: Map<string, unknown>,
) => {
    await board($);
    await clock.advance(9000);
    const gaps = (
        store.get('quiet-gap') as { gaps?: QuietGapLine[] } | undefined
    )?.gaps;
    return gaps?.length
        ? gaps
              .map(
                  (g) =>
                      `${g.from} · a progress ping skipped the quiet hold (sent ${g.sent}, logged ${g.logged})`,
              )
              .join('\n')
        : undefined;
};
type QuietGapLine = { from: string; logged: number; sent: number };

test('a member that sent clio more pings than her log holds is a gap in the ledger, never a 🚨 row', async ($, on) => {
    const { clock, store } = fleet(
        on,
        { [`quiet-log:${DAY}`]: [logged(PEER_NAME, NOW - 30 * MIN)] },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] },
        },
    );
    const ui = await board($);
    await clock.advance(9000);
    expect([
        (store.get('quiet-gap') as { gaps: unknown[] } | undefined)?.gaps,
        await ui.find({ text: /^🚨/, type: 'Text' }),
    ]).toEqual([[{ from: PEER_NAME, logged: 1, sent: 2 }], undefined]);
});

const RENAMED = 'FRM-426 code: band and board read true';

test('a member renamed mid-day keeps its logged pings, so the old name leaves no gap', async ($, on) => {
    const { clock, store } = fleet(
        on,
        {
            [`quiet-log:${DAY}`]: [
                logged(`☕️ 🔧 ${RENAMED}`, NOW - 30 * MIN),
                logged(`☕️ 🔧 ${RENAMED}`, NOW - 20 * MIN),
            ],
        },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] },
        },
    );
    expect(await gapRow($, clock, store)).toBeUndefined();
});

test('a renamed member that sent more than its old-name lines hold still shows its gap', async ($, on) => {
    const { clock, store } = fleet(
        on,
        { [`quiet-log:${DAY}`]: [logged(`☕️ 🔧 ${RENAMED}`, NOW - 30 * MIN)] },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] },
        },
    );
    expect(await gapRow($, clock, store)).toContain('(sent 2, logged 1)');
});

test("a log line carrying the sender's session id counts for it whatever name it was logged under", async ($, on) => {
    const { clock, store } = fleet(
        on,
        {
            [`quiet-log:${DAY}`]: [
                {
                    ...logged('☕️ 🧪 an unrelated name', NOW - 30 * MIN),
                    sid: PEER,
                },
            ],
        },
        { isOwner: true, sends: { [PEER]: [at(NOW - 30 * MIN)] } },
    );
    expect(await gapRow($, clock, store)).toBeUndefined();
});

test('a send inside the 2 min grace is not a gap yet', async ($, on) => {
    const { clock, store } = fleet(
        on,
        { [`quiet-log:${DAY}`]: [logged(PEER_NAME, NOW - 30 * MIN)] },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - MIN)] },
        },
    );
    expect(await gapRow($, clock, store)).toBeUndefined();
});

test("a send before the day's first log line is not counted", async ($, on) => {
    const { clock, store } = fleet(
        on,
        { [`quiet-log:${DAY}`]: [logged(PEER_NAME, NOW - 30 * MIN)] },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 40 * MIN), at(NOW - 30 * MIN)] },
        },
    );
    expect(await gapRow($, clock, store)).toBeUndefined();
});

test('a flushed line does not count as a logged delivery', async ($, on) => {
    const { clock, store } = fleet(
        on,
        {
            [`quiet-log:${DAY}`]: [
                logged(PEER_NAME, NOW - 30 * MIN),
                logged(PEER_NAME, NOW - 25 * MIN, 'flushed'),
            ],
        },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] },
        },
    );
    expect(await gapRow($, clock, store)).toContain('(sent 2, logged 1)');
});

test("the ledger's gap stays off any board but clio's", async ($, on) => {
    const { clock, store } = fleet(
        on,
        { [`quiet-log:${DAY}`]: [logged(PEER_NAME, NOW - 30 * MIN)] },
        { sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] } },
    );
    expect(await gapRow($, clock, store)).toBeUndefined();
});

// the stuck alarm: a held ping past the idle wait (10 min) + 2 min turns clio's 🤫 n red
const heldFor = (ms: number) => ({
    [`quiet-held:${HERE}`]: [{ at: NOW - ms, from: PEER_NAME, text: 'step 2' }],
});

test('a held ping past the wait + 2 min turns the 🤫 n red', async ($, on) => {
    fleet(on, heldFor(13 * MIN));
    const badge = await (await board($)).find({ text: '🤫 1', type: 'Text' });
    expect(badge?.props.color).toBe('error');
});

test('a held ping inside the wait + 2 min keeps the 🤫 n plain', async ($, on) => {
    fleet(on, heldFor(11 * MIN));
    const badge = await (await board($)).find({ text: '🤫 1', type: 'Text' });
    expect(badge?.props.color).toBeUndefined();
});

test("crow's lines count for her though the log keeps the registry's split «🐦 ⬛» and the board the joined «🐦‍⬛»", async ($, on) => {
    const { clock, store } = fleet(
        on,
        {
            [`quiet-log:${DAY}`]: [
                logged('🐦 ⬛ crow', NOW - 30 * MIN),
                logged('🐦 ⬛ crow', NOW - 20 * MIN),
            ],
        },
        {
            isOwner: true,
            patch: { 2: { name: '🐦 ⬛ crow' } },
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] },
        },
    );
    expect(await gapRow($, clock, store)).toBeUndefined();
});

test('the terminal draws ctx as a fixed 10-wide bar', () => {
    expect(['0', '43', '100'].map((p) => ctxBar(Number(p)))).toEqual([
        '▯▯▯▯▯   0%',
        '▮▮▯▯▯  43%',
        '▮▮▮▮▮ 100%',
    ]);
});

test('no member dot equals a state tint: ok, warn, hot, calm or accent', () => {
    const tints: string[] = [
        PALETTE.ok,
        PALETTE.warn,
        PALETTE.hot,
        PALETTE.calm,
        PALETTE.accent,
    ];
    expect(PALETTE.dots.filter((d) => tints.includes(d))).toEqual([]);
});

test('every dot comes from the palette, the same name keeping the same hue', () => {
    const names = ['🦉 clio', '☕️ 🔧 coder', '🐦 ⬛ crow'];
    const hues = huesOf(names);
    expect([
        hues.every(
            (h) =>
                h !== undefined &&
                (PALETTE.dots as readonly string[]).includes(h),
        ),
        huesOf(names),
    ]).toEqual([true, hues]);
});

test("a row's state emoji sits against its time, both packed left, so every row's emoji lines up (dima, 10-13 16:59)", async ($, on) => {
    fleet(on);
    const ui = await board($);
    const cell = (await ui.findAll({ type: 'Box' })).find(
        (b) => b.key?.startsWith('state:') && (b.children ?? []).length === 2,
    );
    expect([
        cell?.props.justifyContent,
        (cell?.children ?? []).map((c) => (c as { type?: string }).type),
    ]).toEqual(['flex-start', ['Text', 'Text']]);
});

// dima keeps both takes (10-13 17:00): the 🎛️ switch picks the ring (C) or the % with a bar under it (B), every board
test('the 🎛️ ctx switch draws the bar instead of the ring, in a narrower column', async ($, on) => {
    fleet(on, { [`context:${HERE}`]: 43, 'ctx-ring': false });
    const ui = await board($);
    const meter = (await ui.findAll({ type: 'Svg' })).find(
        (n) => n.props.alt === 'ctx 43%',
    );
    const cell = (await ui.findAll({ type: 'Box' })).find(
        (b) => b.props.justifyContent === 'flex-end' && b.props.width === 5,
    );
    expect([
        String(meter?.props.source).includes('<circle'),
        cell !== undefined,
    ]).toEqual([false, true]);
});

test('the ring is the default ctx meter', async ($, on) => {
    fleet(on, { [`context:${HERE}`]: 43 });
    const ui = await board($);
    const meter = (await ui.findAll({ type: 'Svg' })).find(
        (n) => n.props.alt === 'ctx 43%',
    );
    expect(String(meter?.props.source).includes('<circle')).toBe(true);
});

test("the 🎛️ ctx switch, pressed in settings, turns the open board's ring into the bar at once", async ($, on) => {
    fleet(on, { [`context:${HERE}`]: 43 });
    const view = await board($);
    const isRing = async () =>
        String(
            (await view.findAll({ type: 'Svg' })).find(
                (n) => n.props.alt === 'ctx 43%',
            )?.props.source,
        ).includes('<circle');
    const before = await isRing();
    const settings = await $.ui.mount({
        component: 'Pane',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 80,
            isFocused: false,
            placement: 'dock',
            scroll: { bodyRows: 40, offset: 0 },
            title: '🎛️ settings',
            view: {},
        },
        requestId: 'stash-settings',
        surface: 'terminal',
    });
    await settings.press({ key: 'knob:ctx-bar' });
    expect([before, await isRing()]).toEqual([true, false]);
});

/* 🐦‍🔥 second wind (todo 16): a button beside every row's ctx meter asks that session to refresh at a good stop */

const windButton = async (
    view: Awaited<ReturnType<typeof board>>,
    sid: string,
) => (await view.find({ key: `wind:${sid}`, type: 'Button' }))?.text;

test('every row draws the 🐦‍🔥 button, its own included', async ($, on) => {
    fleet(on);
    const view = await board($);
    expect([
        await windButton(view, HERE),
        await windButton(view, PEER),
    ]).toEqual(['🐦‍🔥', '🐦‍🔥']);
});

test('a press asks that session: the button and the line under its row say so', async ($, on) => {
    fleet(on);
    const view = await board($);
    await view.press({ key: `wind:${PEER}` });
    expect([
        await windButton(view, PEER),
        (
            await view.find({
                text: /second wind: asked, waits for its next turn/,
                type: 'Text',
            })
        )?.text,
    ]).toEqual(['🥚', expect.stringContaining('second wind')]);
});

test('a second press before the note went out takes the ask back, unseen', async ($, on) => {
    fleet(on);
    const view = await board($);
    await view.press({ key: `wind:${PEER}` });
    await view.press({ key: `wind:${PEER}` });
    expect([
        await windButton(view, PEER),
        await view.find({ text: /second wind:/, type: 'Text' }),
    ]).toEqual(['🐦‍🔥', undefined]);
});

test('a press after the note went out cancels, and a third asks again', async ($, on) => {
    const store: Record<string, unknown> = {
        [`wind:${PEER}`]: { at: NOW, state: 'writing' },
    };
    fleet(on, store);
    const view = await board($);
    const said = async () =>
        (await view.find({ text: /second wind:/, type: 'Text' }))?.text;
    await view.press({ key: `wind:${PEER}` });
    const cancelled = await said();
    const cancelButton = await windButton(view, PEER);
    await view.press({ key: `wind:${PEER}` });
    expect([cancelButton, cancelled, await said()]).toEqual([
        '↩️',
        expect.stringContaining('cancelled, tells it at its next turn'),
        expect.stringContaining('finishing its step, then its handoff'),
    ]);
});

test('a press while the session compacts changes nothing', async ($, on) => {
    const store: Record<string, unknown> = {
        [`wind:${PEER}`]: { at: NOW, slug: 'x-1', state: 'refreshing' },
    };
    fleet(on, store);
    const view = await board($);
    await view.press({ key: `wind:${PEER}` });
    expect(await windButton(view, PEER)).toBe('🌀');
});

test('🐦‍🔥 second wind switched off draws no button and no line', async ($, on) => {
    fleet(on, {
        shown: { 'stash.second-wind': false },
        [`wind:${PEER}`]: { at: NOW, state: 'asked' },
    });
    const view = await board($);
    expect([
        await windButton(view, PEER),
        await view.find({ text: /second wind:/, type: 'Text' }),
    ]).toEqual([undefined, undefined]);
});

test("the state column is as wide as the board's longest time, never a fixed 9", async ($, on) => {
    fleet(on);
    const view = await board($);
    const widths = (await view.findAll({ type: 'Box' }))
        .filter((n) => n.key?.startsWith('state:'))
        .map((n) => n.props.width);
    // 🦉 busy 3m, the coder idle 12m: «12m», its emoji, its gap and a cell of air
    expect(widths).toEqual([7, 7]);
});

const settingsPane = ($: Engine) =>
    $.ui.mount({
        component: 'Pane',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 80,
            isFocused: false,
            placement: 'dock',
            scroll: { bodyRows: 40, offset: 0 },
            title: '🎛️ settings',
            view: {},
        },
        requestId: 'stash-settings',
        surface: 'terminal',
    });

test('the ctx meter type is two buttons, one lit; pressing the lit one changes nothing', async ($, on) => {
    fleet(on);
    await board($);
    const settings = await settingsPane($);
    const lit = async () =>
        (await settings.findAll({ type: 'Button' }))
            .filter(
                (b) =>
                    b.key?.startsWith('knob:ctx-') &&
                    b.props.variant === 'primary',
            )
            .map((b) => b.key);
    const before = await lit();
    await settings.press({ key: 'knob:ctx-ring' });
    const still = await lit();
    await settings.press({ key: 'knob:ctx-bar' });
    expect([before, still, await lit()]).toEqual([
        ['knob:ctx-ring'],
        ['knob:ctx-ring'],
        ['knob:ctx-bar'],
    ]);
});

const undoInputs = async (settings: Awaited<ReturnType<typeof settingsPane>>) =>
    (await settings.findAll({ type: 'Input' }))
        .filter((n) => n.key?.includes('undo'))
        .map((n) => n.props.value);

test('the undo delay field holds 5 by default', async ($, on) => {
    fleet(on);
    await board($);
    expect(await undoInputs(await settingsPane($))).toEqual(['5']);
});

test('with the undo switch off the delay field is not drawn', async ($, on) => {
    fleet(on, { 'undo-window': false });
    await board($);
    expect(await undoInputs(await settingsPane($))).toEqual([]);
});

test('the undo delay field sits on the 📨 undo tick line, no label of its own', async ($, on) => {
    fleet(on);
    await board($);
    const settings = await settingsPane($);
    const line = await settings.find({ key: 'knob:undo-row', type: 'Box' });
    expect([
        line?.text?.includes('📨 undo tick'),
        line?.text?.includes('s (1–30)'),
        (await settings.find({ text: /undo delay/, type: 'Text' }))?.text,
    ]).toEqual([true, true, undefined]);
});

test('the state column keeps a cell of air after the ctx meter on the desktop', async ($, on) => {
    fleet(on);
    const view = await board($);
    const margins = (await view.findAll({ type: 'Box' }))
        .filter((n) => n.key?.startsWith('state:'))
        .map((n) => n.props.marginLeft);
    expect(margins).toEqual([1, 1]);
});

// FRM-426 (W5): an idle row past the prompt cache's hour reads ❄️; a fault keeps ⚠
const COLD = { [`reply:${PEER}`]: { at: NOW - 61 * MIN } };

test('an idle row past the cache hour shows ❄️', async ($, on) => {
    fleet(on, COLD);
    expect(await row($, PEER)).toContain('❄️');
});

test('an idle row inside the cache hour shows no mark', async ($, on) => {
    fleet(on, { [`reply:${PEER}`]: { at: NOW - 59 * MIN } });
    const text = await row($, PEER);
    expect([text.includes('❄️'), text.includes('⚠')]).toEqual([false, false]);
});

test('a busy row never shows ❄️ however old its last reply', async ($, on) => {
    fleet(on, { [`reply:${HERE}`]: { at: NOW - 5 * 60 * MIN } });
    expect(await row($, HERE)).not.toContain('❄️');
});

test('a cold row off the fleet pattern keeps ⚠, never ❄️', async ($, on) => {
    fleet(
        on,
        { [`reply:${GONE}`]: { at: NOW - 90 * MIN } },
        {
            alive: [1, 2, 3],
            bg: [3],
            patch: { 3: { status: 'idle' } },
        },
    );
    const text = await row($, GONE);
    expect([text.includes('⚠'), text.includes('❄️')]).toEqual([true, false]);
});

test("the cold helga sidecar shows ❄️, not ⚠ (dima's 10-15 screenshot)", async ($, on) => {
    fleet(on, COLD, { bg: [2], patch: { 2: { name: '🎀 helga' } } });
    const text = await row($, PEER);
    expect([text.includes('❄️'), text.includes('⚠')]).toEqual([true, false]);
});

// FRM-429 exit 2 (dima's o56): no quiet-comms card draws on any board; held pings and ledger gaps stay in the store
test('no quiet-comms card draws on clio’s board, with pings held and a gap open', async ($, on) => {
    const { clock, store } = fleet(
        on,
        {
            [`quiet-held:${HERE}`]: [
                { at: NOW - MIN, from: PEER_NAME, text: 'step 2' },
            ],
            [`quiet-log:${DAY}`]: [logged(PEER_NAME, NOW - 30 * MIN)],
        },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] },
        },
    );
    const ui = await board($);
    await clock.advance(9000);
    expect([
        await ui.find({ key: 'quiet:card', type: 'Box' }),
        await ui.find({ text: /quiet comms/, type: 'Text' }),
        (store.get('quiet-gap') as { gaps: unknown[] } | undefined)?.gaps
            .length,
    ]).toEqual([undefined, undefined, 1]);
});

// FRM-412 exit 3: the cause of «holds 0» — a member renamed from ☕️ to 🌗 logged under both names, and the ledger
// matched the log's name to the registry's exactly (10-22: 4 lines as ☕️, 9 as 🌗 for one coder)
test('a member whose mode emoji changed keeps its logged pings counted: no gap', async ($, on) => {
    const { clock, store } = fleet(
        on,
        {
            [`quiet-log:${DAY}`]: [
                logged('🌗 🔧 FRM-1 code: x', NOW - 30 * MIN),
                logged('🌗 🔧 FRM-1 code: x', NOW - 25 * MIN),
            ],
        },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 25 * MIN)] },
        },
    );
    const ui = await board($);
    await clock.advance(9000);
    expect([
        (store.get('quiet-gap') as { gaps: unknown[] } | undefined)?.gaps,
        await ui.find({ text: /^🚨/, type: 'Text' }),
    ]).toEqual([[], undefined]);
});
