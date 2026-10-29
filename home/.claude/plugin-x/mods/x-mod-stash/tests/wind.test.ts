import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// 🐦‍🔥 second wind, the asked session's side (todo 16): the note rides its next turn, a cancel takes it back, and the
// op it calls with its handoff compacts and ingests at that turn's end

const SID = 'w1w1w1w1-wind';
const PID = 4646;
const TOOL = 'mcp__x-mod-stash__orbit';
const NOW = new Date(2026, 9, 13, 17, 40).getTime();
const SLUG = 'mods-l14-2';

// `name` is the session's registry name; `handoffs` the slugs `x handoff peek` finds
// `during` runs inside the compact, as a turn end that lands while it works would
function world(
    on: On,
    name = '☕️ 🔧 codie: mods',
    handoffs = [SLUG],
    during?: () => Promise<unknown>,
) {
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
                stdout: isPeek ? '' : `${PID}\nMon Oct 13 17:00:00 2026\n`,
            },
        };
    });
    on('fs.read', (_$, e) =>
        e.path === `/home/.claude/sessions/${PID}.json`
            ? { value: JSON.stringify({ name, pid: PID }) }
            : { deny: 'no such file' },
    );
    on('fs.list', () => ({ value: [] }));
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
        return { text: e.text };
    });
    on('command.run', async (_$, e) => {
        commands.push(`/${e.command} ${e.args}`);
        if (e.command === 'compact') await during?.();
        return { text: '' };
    });
    on('turn.complete', () => ({ text: '' }));
    on('session.compact', (_$, e) => ({ messages: e.messages }));
    on('classic.Stop', () => ({}));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    return { clock, commands, lines, store };
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
    'a second wind is a graceful context refresh, a request, never urgent — the session and its codies resolve every subagent and park everything before the compact, so nothing is lost.';

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
    const w = world(on, '🦉 clio');
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await start($);
    await say($);
    expect(notes(w.lines)[0]).toMatch(
        /finish that topic whole first.*never split.*clio:checkpoint/,
    );
});

const INIT_LIST =
    /first first-act is your role's init list.*x:crew-codie, x:crew-dna read whole.*plugin-authoring.*clio: her boot/;

for (const [who, name] of [
    ['a codie', undefined],
    ['clio', '🦉 clio'],
] as const)
    test(`${who}'s note makes the handoff open with the role's init list`, async ($, on) => {
        const w = world(on, name);
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
        const w = world(on, isOwner ? '🦉 clio' : '☕️ 🔧 codie: mods');
        w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
        await start($);
        await say($);
        expect(notes(w.lines).join('\n')).toContain(DIMAS_WORDS);
    });

test("a compact that ran, the wind's or a threshold one, is followed by one /reload-skills", async ($, on) => {
    const w = world(on);
    await start($);
    await compact($, 'auto');
    await w.clock.advance(2_000);
    expect(
        w.commands.filter((c) => c.startsWith('/reload-skills')),
    ).toHaveLength(1);
});

test('a precompute or a subagent compact reloads no skills', async ($, on) => {
    const w = world(on);
    await start($);
    await compact($, 'precompute');
    await $.session.compact({
        agentId: 'sub-1',
        messages: [{ role: 'user', text: 'hi', toolUses: [] }],
        trigger: 'auto',
    } as never);
    await w.clock.advance(2_000);
    expect(w.commands.filter((c) => c.startsWith('/reload-skills'))).toEqual(
        [],
    );
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
