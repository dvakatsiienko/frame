import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { THREADS_FILE, recordOf, threadsFile } from './threads.ts';

// 🐦‍🔥 second wind, the asked session's side (todo 16): the note rides its next turn, a cancel takes it back, and the
// op it calls with its handoff compacts and ingests at that turn's end

const SID = 'w1w1w1w1-wind';
const PID = 4646;
const TOOL = 'mcp__x-mod-stash__orbit';
const NOW = new Date(2026, 9, 13, 17, 40).getTime();
const SLUG = 'mods-l14-2';

// what lands while the engine compacts: one `on` per event, so a test sets this flag before its first `$` call
let inCompact: (() => Promise<unknown>) | undefined;
// a session started with no plugin x skills (crow's pane, FRM-505) lists no ingest command
let hasIngestCommand = true;
// the engine refuses the compact, as it refuses an unknown command
let compactRefusal: string | undefined;

// the live peers a test's messages come from, as cc's registry names them and x's records give their roles
const SENSE_NAMES = [
    '⚡ 🔎 sixth sense: mods',
    '⚡ 🔎 sixth sense: mods lane 6 | main',
];
const PEERS = [
    { name: '🦉 clio', pid: 1, record: recordOf('🦉 clio') },
    {
        name: '🦉🪽 clio: wing 1',
        pid: 2,
        record: recordOf('🦉🪽 clio: wing 1'),
    },
    ...SENSE_NAMES.map((name, i) => ({
        name,
        pid: 3 + i,
        record: { display: name, role: 'sixth-sense' },
    })),
    // the 01:28 fork: clio's name, no record
    { name: '🦉 clio', pid: 90, record: {} },
];
// `name` is the session's registry name; `handoffs` the slugs `x handoff peek` finds
// `during` runs inside the compact, as a turn end that lands while it works would
// `role` is the role x's thread record gives the session, `null` for none
function world(
    on: On,
    name = '☕️ 🔧 codie: mods',
    handoffs = [SLUG],
    during?: () => Promise<unknown>,
    role: string | null = 'codie',
) {
    inCompact = undefined;
    hasIngestCommand = true;
    compactRefusal = undefined;
    const prompts: string[] = [];
    const lines: string[] = [];
    const commands: string[] = [];
    const clock = mock.clock(on, { now: NOW });
    const store = new Map<string, unknown>();
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
    on('session.id', () => ({ value: SID }));
    on('env.get', () => ({ value: '/home' }));
    on('process.run', (_$, e) => {
        const isPeek = e.argv[1] === 'handoff' && e.argv[2] === 'peek';
        return {
            value: {
                exitCode: isPeek && !handoffs.includes(e.argv[3] ?? '') ? 1 : 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: isPeek
                    ? ''
                    : e.argv[0] === 'ps'
                      ? [PID, ...PEERS.map((p) => p.pid)].join('\n')
                      : `${PID}\nMon Oct 13 17:00:00 2026\n`,
            },
        };
    });
    const files: Record<string, string> = {
        [`/home/.claude/sessions/${PID}.json`]: JSON.stringify({
            name,
            pid: PID,
        }),
        [THREADS_FILE]: threadsFile([
            {
                pid: PID,
                sessionId: SID,
                ...(role ? { display: name, role } : recordOf(name)),
            },
            ...PEERS.map((p) => ({
                pid: p.pid,
                sessionId: `peer-${p.pid}`,
                ...p.record,
            })),
        ]),
    };
    for (const p of PEERS)
        files[`/home/.claude/sessions/${p.pid}.json`] = JSON.stringify({
            name: p.name,
            pid: p.pid,
            sessionId: `peer-${p.pid}`,
        });
    on('fs.read', (_$, e) =>
        e.path in files
            ? { value: files[e.path] ?? '' }
            : { deny: 'no such file' },
    );
    on('fs.list', (_$, e) => ({
        value:
            e.path === '/home/.claude/sessions'
                ? PEERS.map((p) => ({
                      isLink: false,
                      kind: 'file' as const,
                      mtimeMs: 0,
                      name: `${p.pid}.json`,
                      size: 1,
                  }))
                : [],
    }));
    on('ui.log', () => ({ value: undefined }));
    on('ui.toast', () => ({ value: undefined }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('prompt.submit', (_$, e) => {
        lines.push(...(e.context ?? []));
        if (e.origin?.kind === 'plugin') prompts.push(e.text);
        return { text: e.text };
    });
    on('command.list', () => ({
        value: [
            { description: '', name: 'compact', source: 'builtin' as const },
            ...(hasIngestCommand
                ? [
                      {
                          description: '',
                          name: 'x:handoff-ingest',
                          source: 'plugin' as const,
                      },
                  ]
                : []),
        ],
    }));
    on('command.run', async (_$, e) => {
        if (e.command === 'compact' && compactRefusal)
            throw new Error(compactRefusal);
        commands.push(`/${e.command} ${e.args}`);
        if (e.command === 'compact') await during?.();
        return { text: '' };
    });
    on('turn.complete', () => ({ text: '' }));
    on('session.compact', async (_$, e) => {
        await inCompact?.();
        return e.messages[0]?.text === 'veto'
            ? ({ skip: 'vetoed' } as never)
            : { messages: e.messages };
    });
    on('classic.Stop', () => ({}));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    return { clock, commands, lines, prompts, store };
}

const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });

const say = ($: Engine, text = 'go', kind = 'composer') =>
    $.prompt.submit({ origin: { kind } as never, text, wait: false });

const endTurn = ($: Engine) =>
    $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });

// the op names what is still pending; «none» is the only word that lets it compact
const ready = ($: Engine, slug?: string, pending: string | null = 'none') =>
    $.tool.call({
        op: 'second-wind',
        tool: TOOL,
        ...(slug === undefined ? {} : { slug }),
        ...(pending === null ? {} : { pending }),
    } as never) as Promise<{ deny?: string; result?: unknown }>;

const DIMAS_WORDS =
    'a second wind is a graceful context refresh, a request, never urgent — the session and its coders resolve every subagent and park everything before the compact, so nothing is lost.';

const notes = (lines: string[]) => lines.filter((l) => l.includes('🐦‍🔥'));

test('an asked session reads the second wind note once, at its next turn', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await start($);
    await say($);
    await say($, 'again');
    expect([
        notes(w.lines),
        (w.store.get(`wind:${SID}`) as { state?: string }).state,
    ]).toEqual([
        [expect.stringMatching(/^🐦‍🔥 second wind: dima asked/)],
        'writing',
    ]);
});

test("a peer's ping carries the note too: any turn takes it", async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await start($);
    await say($, 'a ping from clio', 'peer');
    expect(notes(w.lines)).toHaveLength(1);
});

test("clio's note names her good stop", async ($, on) => {
    const w = world(on, '🦉 clio', undefined, undefined, null);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await start($);
    await say($);
    expect(notes(w.lines)[0]).toMatch(
        /finish that topic whole first.*never split.*clio:checkpoint/,
    );
});

const INIT_LIST =
    /first first-act is your role's init list.*x:crew-codie, x:crew-dna read whole.*plugin-authoring.*clio: her boot/;

for (const [who, name, role] of [
    ['a codie', undefined, 'codie'],
    ['clio', '🦉 clio', null],
] as const)
    test(`${who}'s note makes the handoff open with the role's init list`, async ($, on) => {
        const w = world(on, name, undefined, undefined, role);
        w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
        await start($);
        await say($);
        expect(notes(w.lines).map((n) => INIT_LIST.test(n))).toEqual([true]);
    });

const WIND_HEAD = '🐦‍🔥 second wind: dima asked you';

test('a press on a busy session joins its next tool step once', async ($, on) => {
    const w = world(on);
    await start($);
    await say($);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    const first = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    const second = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    expect([
        notes([...(first.context ?? [])]).map((n) => n.startsWith(WIND_HEAD)),
        notes([...(second.context ?? [])]),
        (w.store.get(`wind:${SID}`) as { state?: string }).state,
    ]).toEqual([[true], [], 'writing']);
});

test('a press on an idle session wakes nothing: the ask waits for its next turn', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await start($);
    await w.clock.advance(60_000);
    expect([
        notes(w.lines),
        (w.store.get(`wind:${SID}`) as { state?: string }).state,
    ]).toEqual([[], 'asked']);
});

test('a session nobody asked reads no second wind line', async ($, on) => {
    const w = world(on);
    await start($);
    await say($);
    expect(notes(w.lines)).toEqual([]);
});

test('a cancel reaches the session once, and the ask is gone', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'cancelled' });
    await start($);
    await say($);
    await say($, 'again');
    expect([notes(w.lines), w.store.has(`wind:${SID}`)]).toEqual([
        [expect.stringMatching(/^🐦‍🔥 second wind cancelled/)],
        false,
    ]);
});

test('a named handoff compacts, then ingests, at the turn end', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'writing' });
    await start($);
    await say($);
    const r = await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect([
        r.deny,
        w.commands.map((c) => c.split(' ')[0]),
        w.commands[1],
        w.store.has(`wind:${SID}`),
    ]).toEqual([
        undefined,
        ['/compact', '/x:handoff-ingest'],
        `/x:handoff-ingest ${SLUG}`,
        false,
    ]);
});

test('the compact runs once, never again at the next turn end', async ($, on) => {
    const w = world(on);
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands).toHaveLength(2);
});

test('nothing compacts before the turn that named the handoff ends', async ($, on) => {
    const w = world(on);
    await start($);
    await ready($, SLUG);
    await w.clock.advance(5_000);
    expect(w.commands).toEqual([]);
});

test('the op refuses in one line with no slug, and nothing compacts', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await ready($);
    await endTurn($);
    await w.clock.advance(2_000);
    expect([r.deny?.includes('\n'), r.deny, w.commands]).toEqual([
        false,
        expect.stringContaining('slug: "<lane or topic>-<n>"'),
        [],
    ]);
});

test('the op refuses a slug the handoff store lacks, and nothing compacts', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await ready($, 'no-such-9');
    await endTurn($);
    await w.clock.advance(2_000);
    expect([r.deny, w.commands]).toEqual([
        expect.stringContaining('no handoff «no-such-9»'),
        [],
    ]);
});

test('🐦‍🔥 second wind switched off never compacts, even with a handoff named', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    w.store.set('shown', { 'stash.second-wind': false });
    await start($);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands).toEqual([]);
});

test('the ingest is queued while the compact still runs, so no prompt slips between', async ($, on) => {
    let queued: string[] = [];
    const w = world(on, undefined, undefined, async () => {
        for (let i = 0; i < 50; i++) await Promise.resolve();
        queued = [...w.commands];
    });
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(queued.map((c) => c.split(' ')[0])).toEqual([
        '/compact',
        '/x:handoff-ingest',
    ]);
});

test('a session with no ingest command ingests its handoff through a plain prompt', async ($, on) => {
    const w = world(on);
    hasIngestCommand = false;
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect([
        w.commands.map((c) => c.split(' ')[0]),
        w.prompts.filter((p) => p.includes(`x handoff ingest ${SLUG} --for`))
            .length,
        w.store.has(`wind:${SID}`),
    ]).toEqual([['/compact'], 1, false]);
});

// the compact refused: the toast reaches no one in a pane nobody watches
function refusedWind(on: On) {
    compactRefusal = 'no compact here';
    const sent: { text: string; to: unknown }[] = [];
    on('session.send', (_$, e) => {
        sent.push({ text: e.text, to: e.to });
        return { isDelivered: true };
    });
    return sent;
}

test('a stopped wind tells the coordinator in one line, naming the handoff kept in the store', async ($, on) => {
    const w = world(on);
    const sent = refusedWind(on);
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(sent).toEqual([
        {
            text: expect.stringMatching(
                new RegExp(
                    `second wind stopped.*${SLUG} is still in the store`,
                ),
            ),
            to: 'peer-1',
        },
    ]);
});

test('a stopped wind keeps the session from reading idle on the board', async ($, on) => {
    const w = world(on);
    refusedWind(on);
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect((w.store.get(`wind:${SID}`) as { state?: string }).state).toBe(
        'stopped',
    );
});

test('a stopped wind tells the session once, at its next turn, how to ingest by hand', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'stopped' });
    await start($);
    await say($);
    await say($, 'again');
    expect([
        notes(w.lines).map((l) => l.includes(`x handoff ingest ${SLUG} --for`)),
        w.store.has(`wind:${SID}`),
    ]).toEqual([[true], false]);
});

test('the op tells the session to end its turn with no waiting line', async ($, on) => {
    world(on);
    await start($);
    expect((await ready($, SLUG)).result).toMatch(
        /end your turn now, with no «waiting on» line/,
    );
});

test('a turn end that lands during the compact starts no second one', async ($, on) => {
    const w = world(on, undefined, undefined, async () => {
        await endTurn($);
        await w.clock.advance(2_000);
    });
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands.filter((c) => c.startsWith('/compact'))).toHaveLength(1);
});

const compact = (
    $: Engine,
    trigger: 'auto' | 'manual' | 'plugin' | 'precompute',
) =>
    $.session.compact({
        messages: [{ role: 'user', text: 'hi', toolUses: [] }],
        trigger,
    } as never);

for (const state of ['asked', 'writing'] as const)
    test(`a threshold compact clears a wind left ${state}, so the board stops waiting`, async ($, on) => {
        const w = world(on);
        w.store.set(`wind:${SID}`, { at: NOW, state });
        await start($);
        await compact($, 'auto');
        expect(w.store.has(`wind:${SID}`)).toBe(false);
    });

test('a compact another hook skipped keeps the wind', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await start($);
    await $.session.compact({
        messages: [{ role: 'user', text: 'veto', toolUses: [] }],
        trigger: 'auto',
    } as never);
    expect(w.store.has(`wind:${SID}`)).toBe(true);
});

test('the compact a wind started clears its row, its ingest still queued', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'refreshing' });
    await start($);
    await compact($, 'plugin');
    expect(w.store.has(`wind:${SID}`)).toBe(false);
});

test('a refreshing row past 30 min clears at the next turn end', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW - 31 * 60_000, state: 'refreshing' });
    await start($);
    await endTurn($);
    expect(w.store.has(`wind:${SID}`)).toBe(false);
});

test('a compact keeps a wind that is refreshing, and a precompute keeps a writing one', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    await start($);
    await compact($, 'plugin');
    const kept = w.store.has(`wind:${SID}`);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'writing' });
    await compact($, 'precompute');
    expect([kept, w.store.has(`wind:${SID}`)]).toEqual([true, true]);
});

test('the op refuses with no pending field, and nothing compacts', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await ready($, SLUG, null);
    await endTurn($);
    await w.clock.advance(2_000);
    expect([r.deny?.includes('\n'), r.deny, w.commands]).toEqual([
        false,
        expect.stringContaining('pending is required'),
        [],
    ]);
});

test('the op refuses a pending that names work, saying what is pending, and nothing compacts', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await ready($, SLUG, 'two subagents still running');
    await endTurn($);
    await w.clock.advance(2_000);
    expect([r.deny, w.commands]).toEqual([
        expect.stringContaining('two subagents still running'),
        [],
    ]);
});

for (const [who, isOwner] of [
    ['a codie', false],
    ['clio', true],
] as const)
    test(`${who}'s second wind note carries dima's words whole`, async ($, on) => {
        const w = world(
            on,
            isOwner ? '🦉 clio' : '☕️ 🔧 codie: mods',
            undefined,
            undefined,
            isOwner ? null : 'codie',
        );
        w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
        await start($);
        await say($);
        expect(notes(w.lines).join('\n')).toContain(DIMAS_WORDS);
    });

for (const [what, call] of [
    ['an agent', { tool: 'Agent' }],
    [
        'a background command',
        { command: 'sleep 90', run_in_background: true, tool: 'Bash' },
    ],
    [
        'a background session with its flag last',
        { command: "claude -p 'work' --bg", tool: 'Bash' },
    ],
] as const)
    test(`${what} started after pending: none makes the wind refuse, and the next prompt says why`, async ($, on) => {
        const w = world(on);
        await start($);
        await ready($, SLUG);
        await $.tool.call(call as never);
        await endTurn($);
        await w.clock.advance(2_000);
        await say($);
        expect([
            w.commands.filter((c) => c.startsWith('/compact')),
            notes(w.lines).join('\n').includes('second wind refused'),
            w.store.has(`wind:${SID}`),
        ]).toEqual([[], true, false]);
    });

test('an agent started before pending: none does not block the wind', async ($, on) => {
    const w = world(on);
    await start($);
    await $.tool.call({ tool: 'Agent' } as never);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands.filter((c) => c.startsWith('/compact'))).toHaveLength(1);
});

test('a foreground command started after pending: none does not block the wind', async ($, on) => {
    const w = world(on);
    await start($);
    await ready($, SLUG);
    await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands.filter((c) => c.startsWith('/compact'))).toHaveLength(1);
});

// r5 (dima's o23): a coordinator's message to a codie past 55 % context waits for the codie's second wind
const CLIO = '🦉 clio';
// the held list's key: the codie's registry name, bare
const HELD = 'steer-held:☕️🔧codie:mods';
const receiveWorld = (on: On, name?: string, role = 'codie') => {
    const w = world(on, name, undefined, undefined, role);
    const queued: string[] = [];
    on('session.receive', (_$, e) => {
        queued.push(e.text);
        return { text: e.text };
    });
    return { ...w, queued };
};
// the socket is the sender's own, as cc writes it; the name is only what it signs with
const fromPeer = (
    $: Engine,
    body: string,
    from = CLIO,
    pid = PEERS.find((p) => p.name === from)?.pid ?? 1,
) =>
    $.session.receive({
        origin: { kind: 'peer' },
        text: `<cross-session-message from="uds:/tmp/cc-socks/${pid}.sock" from-name="${from}" from-mode="bypass">\n${body}\n</cross-session-message>`,
    }) as Promise<{ consumed?: string; text?: string }>;
const delivered = (lines: string[]) =>
    lines.filter((l) => l.startsWith('🐦‍🔥 held for your second wind'));

// FRM-579 exit 6, sixth sense round 3: a record-less fork that signs as «🦉 clio» holds no wind note, its socket names it
test('a fork named «🦉 clio» with no record gets no wind note held', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    const r = await fromPeer($, 'next: r6', CLIO, 90);
    expect(r.text?.includes('held for your second wind')).toBe(false);
});

test("clio's message to a codie past 55 % becomes the wind note, and joins the first turn after the compact", async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    const r = await fromPeer($, 'next: r6, then 12b');
    await say($, 'the rewritten ping', 'peer');
    const before = delivered(w.lines);
    await compact($, 'plugin');
    await say($, 'the ingest', 'skill');
    await say($, 'later');
    expect([
        r.text?.includes(
            "🦉 clio's message is held for your second wind: your context reads 62 %",
        ),
        r.text?.includes('next: r6'),
        (w.store.get(`wind:${SID}`) as { state?: string } | undefined)?.state,
        before,
        delivered(w.lines),
    ]).toEqual([
        true,
        false,
        undefined,
        [],
        [
            '🐦‍🔥 held for your second wind, delivered now — 🦉 clio: next: r6, then 12b',
        ],
    ]);
});

test('the held message marks the wind as writing, so the board reads ✍️', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 70);
    await start($);
    await fromPeer($, 'next: r6');
    expect((w.store.get(`wind:${SID}`) as { state?: string }).state).toBe(
        'writing',
    );
});

test('a second message while one is held waits unseen, and both join after the compact', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'one');
    const r = await fromPeer($, 'two');
    await compact($, 'plugin');
    await say($, 'the ingest', 'skill');
    expect([
        r.consumed !== undefined,
        w.queued.length,
        delivered(w.lines),
    ]).toEqual([
        true,
        1,
        [
            '🐦‍🔥 held for your second wind, delivered now — 🦉 clio: one',
            '🐦‍🔥 held for your second wind, delivered now — 🦉 clio: two',
        ],
    ]);
});

test('a codie under 55 % reads the message as sent', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 54);
    await start($);
    const r = await fromPeer($, 'next: r6');
    expect([r.text?.includes('next: r6'), w.store.has(HELD)]).toEqual([
        true,
        false,
    ]);
});

test("a full sixth sense reads clio's message as sent", async ($, on) => {
    const w = receiveWorld(
        on,
        '⚡ 🔎 sixth sense: mods lane 6 | main',
        'sixth-sense',
    );
    w.store.set(`context:${SID}`, 80);
    await start($);
    const toSixth = await fromPeer($, 'next: round 2');
    expect(toSixth.text?.includes('next: round 2')).toBe(true);
});

test('a sixth sense or a pause reaching a full codie passes as sent', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 80);
    await start($);
    const fromSixth = await fromPeer(
        $,
        'round 1: clean',
        '⚡ 🔎 sixth sense: mods lane 6 | main',
    );
    const pause = await fromPeer(
        $,
        'pause — hold every message until «resume»',
    );
    const fromWing = await fromPeer($, 'next: r6', '🦉🪽 clio: wing 1');
    expect([
        fromSixth.text?.includes('round 1: clean'),
        pause.text?.includes('pause'),
        fromWing.text?.includes("🦉🪽 clio: wing 1's message is held"),
    ]).toEqual([true, true, true]);
});

test('a wind dima takes back hands the held message over at the next turn', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    w.store.set(`wind:${SID}`, { at: NOW, state: 'cancelled' });
    await say($, 'his prompt');
    expect(delivered(w.lines)).toEqual([
        '🐦‍🔥 held for your second wind, delivered now — 🦉 clio: next: r6',
    ]);
});

test('🐦‍🔥 second wind switched off holds nothing', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 90);
    w.store.set('shown', { 'stash.second-wind': false });
    await start($);
    const r = await fromPeer($, 'next: r6');
    expect([r.text?.includes('next: r6'), w.store.has(HELD)]).toEqual([
        true,
        false,
    ]);
});

test('a /clear while a message is held keeps it for the next conversation', async ($, on) => {
    const w = receiveWorld(on);
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    await $.session.end({ reason: 'clear', sessionId: SID } as never);
    expect(w.store.has(HELD)).toBe(true);
});

test('a wind dima took back stays taken back: a message at 62 % passes as sent', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'cancelled' });
    await start($);
    const r = await fromPeer($, 'next: r6');
    expect([
        r.text?.includes('next: r6'),
        (w.store.get(`wind:${SID}`) as { state?: string }).state,
        w.store.has(HELD),
    ]).toEqual([true, 'cancelled', false]);
});

test('once dima takes the wind back, the next message is no longer swallowed', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'one');
    w.store.set(`wind:${SID}`, { at: NOW, state: 'cancelled' });
    const r = await fromPeer($, 'two');
    expect(r.text?.includes('two')).toBe(true);
});

test('second wind switched off mid-hold hands the held message over at the next turn', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    w.store.set('shown', { 'stash.second-wind': false });
    await say($, 'his prompt');
    expect(delivered(w.lines)).toEqual([
        '🐦‍🔥 held for your second wind, delivered now — 🦉 clio: next: r6',
    ]);
});

test('a refused wind keeps the message held until the compact', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    w.store.set(`wind:${SID}`, {
        at: NOW,
        blocked: 'an agent',
        state: 'refused',
    });
    await say($, 'the refusal turn');
    const before = delivered(w.lines);
    await compact($, 'plugin');
    await say($, 'the ingest', 'skill');
    expect([before, delivered(w.lines)]).toEqual([
        [],
        ['🐦‍🔥 held for your second wind, delivered now — 🦉 clio: next: r6'],
    ]);
});

// r10 (dima's o62): a message held 10 min for a codie that has not wound tells its sender once; the hold stays
const sentWorld = (on: On) => {
    const w = receiveWorld(on);
    const sent: { to: unknown; text: string }[] = [];
    on('session.send', (_$, e) => {
        sent.push({ text: e.text, to: e.to });
        return { isDelivered: true };
    });
    return { ...w, sent };
};
const HELD_LINE =
    'your message to ☕️ 🔧 codie: mods is held: it is at 62 % and has not wound';

// dima's o141 (00:20, widened 00:24): a compact holds every message sent into the thread, from any sender, then hands
// them over whole and in order at its next turn
const SIXTH = '⚡ 🔎 sixth sense: mods';
const compactHeld = (lines: string[]) =>
    lines.filter((l) => l.startsWith('🌀 held while this thread compacted'));
for (const trigger of ['manual', 'auto'] as const)
    test(`a ${trigger} compact holds a message sent while it runs, and hands it over at the next turn`, async ($, on) => {
        const w = sentWorld(on);
        let r: { consumed?: string; text?: string } = {};
        inCompact = async () => {
            r = await fromPeer($, 'round 9 on abc1234', SIXTH);
        };
        await start($);
        await compact($, trigger);
        await say($, 'next');
        expect([
            r.consumed !== undefined,
            w.sent.map((s) => s.text),
            compactHeld(w.lines),
        ]).toEqual([
            true,
            [
                'held: ☕️ 🔧 codie: mods is compacting; your message joins its next turn',
            ],
            [
                `🌀 held while this thread compacted, delivered now — ${SIXTH}: round 9 on abc1234`,
            ],
        ]);
    });

test("a coordinator's push to a codie under 55 % mid-compact is held too", async ($, on) => {
    const w = sentWorld(on);
    let r: { consumed?: string; text?: string } = {};
    inCompact = async () => {
        r = await fromPeer($, '[done] the gate is green');
    };
    w.store.set(`context:${SID}`, 30);
    await start($);
    await compact($, 'auto');
    await say($, 'next');
    expect([r.consumed !== undefined, compactHeld(w.lines)]).toEqual([
        true,
        [
            `🌀 held while this thread compacted, delivered now — ${CLIO}: [done] the gate is green`,
        ],
    ]);
});

test('a session at 🌀 holds every message until the compact, in the order sent', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    await start($);
    const a = await fromPeer($, '[ask] a or b?', SIXTH);
    const b = await fromPeer($, 'for dima: look at #9');
    await say($, 'before the compact');
    const held = (lines: string[]) =>
        lines.filter((l) => /^(🌀|🐦‍🔥) held /u.test(l));
    const before = held(w.lines);
    await compact($, 'plugin');
    await say($, 'the ingest', 'skill');
    // clio's message meets r5 first, which holds it for the codie's wind; the sixth sense's, which r5 never takes, the compact
    expect([
        a.consumed !== undefined,
        b.consumed !== undefined,
        before,
        held(w.lines),
    ]).toEqual([
        true,
        true,
        [],
        [
            `🌀 held while this thread compacted, delivered now — ${SIXTH}: [ask] a or b?`,
            `🐦‍🔥 held for your second wind, delivered now — ${CLIO}: for dima: look at #9`,
        ],
    ]);
});

test("clio's own thread at 🌀 holds a member's [done]", async ($, on) => {
    const w = receiveWorld(on, CLIO, 'coordinator');
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    await start($);
    const r = await fromPeer($, '[done] final on abc1234', SIXTH);
    await compact($, 'plugin');
    await say($, 'the ingest', 'skill');
    expect([r.consumed !== undefined, compactHeld(w.lines)]).toEqual([
        true,
        [
            `🌀 held while this thread compacted, delivered now — ${SIXTH}: [done] final on abc1234`,
        ],
    ]);
});

// sixth sense round 9 on 59feb7c8: a compact whose process died never cleared its key; past COMPACT_MAX_MS it holds nothing
test('a compact key left by a dead process holds nothing past its bound', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`compacting:${SID}`, NOW - 20 * 60_000);
    await start($);
    const r = await fromPeer($, 'round 9 on abc1234', SIXTH);
    expect([r.consumed, r.text?.includes('round 9 on abc1234')]).toEqual([
        undefined,
        true,
    ]);
});

test('a refused wind holds nothing: nothing compacts', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refused' });
    await start($);
    const r = await fromPeer($, 'round 9 on abc1234', SIXTH);
    expect([r.consumed, r.text?.includes('round 9 on abc1234')]).toEqual([
        undefined,
        true,
    ]);
});

test('a message held 10 min for a codie that has not wound tells its sender once, and the hold stays', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    await w.clock.advance(9 * 60_000);
    const early = w.sent.length;
    await w.clock.advance(60_000);
    await w.clock.advance(20 * 60_000);
    expect([
        early,
        w.sent,
        (w.store.get(HELD) as { steers?: unknown[] }).steers?.length,
    ]).toEqual([0, [{ text: HELD_LINE, to: 'uds:/tmp/cc-socks/1.sock' }], 1]);
});

test('a codie that wound inside the 10 min tells no sender', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    await compact($, 'plugin');
    await w.clock.advance(11 * 60_000);
    expect(w.sent).toEqual([]);
});

test('a hold kept across a reload still tells its sender at 10 min', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    w.store.set(HELD, {
        steers: [
            {
                at: NOW - 9 * 60_000,
                from: CLIO,
                reply: 'uds:/tmp/cc-socks/1.sock',
                text: 'next: r6',
            },
        ],
    });
    w.store.set(`wind:${SID}`, { at: NOW - 9 * 60_000, state: 'writing' });
    await start($);
    await w.clock.advance(60_000);
    expect(w.sent).toEqual([
        { text: HELD_LINE, to: 'uds:/tmp/cc-socks/1.sock' },
    ]);
});

test('each held message tells its own sender at its own 10 min', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'one');
    await w.clock.advance(5 * 60_000);
    await $.session.receive({
        origin: { kind: 'peer' },
        text: '<cross-session-message from="uds:/tmp/cc-socks/2.sock" from-name="🦉🪽 clio: wing 1" from-mode="bypass">\ntwo\n</cross-session-message>',
    });
    await w.clock.advance(5 * 60_000);
    const first = w.sent.map((s) => s.to);
    await w.clock.advance(5 * 60_000);
    expect([first, w.sent.map((s) => s.to)]).toEqual([
        ['uds:/tmp/cc-socks/1.sock'],
        ['uds:/tmp/cc-socks/1.sock', 'uds:/tmp/cc-socks/2.sock'],
    ]);
});

// wisphunter on 990334f5: the tell wrote back its first read after the sends, so a delivery meanwhile came back
test('a hold delivered while its sender is told stays delivered', async ($, on) => {
    const w = receiveWorld(on);
    on('session.send', () => {
        w.store.delete(HELD);
        return { isDelivered: true };
    });
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    await w.clock.advance(10 * 60_000);
    expect(w.store.has(HELD)).toBe(false);
});
