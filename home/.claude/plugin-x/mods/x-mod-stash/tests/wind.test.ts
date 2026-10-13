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
    name = '☕️ 🔧 coder: mods',
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

const ready = ($: Engine, slug?: string) =>
    $.tool.call({
        op: 'second-wind',
        tool: TOOL,
        ...(slug === undefined ? {} : { slug }),
    } as never) as Promise<{ deny?: string; result?: unknown }>;

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
    await say($, 'a ping from cclio', 'peer');
    expect(notes(w.lines)).toHaveLength(1);
});

test("cclio's note names her good stop", async ($, on) => {
    const w = world(on, '🦉 cclio');
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await start($);
    await say($);
    expect(notes(w.lines)[0]).toMatch(/take no new todos.*cclio:checkpoint/);
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
