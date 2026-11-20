import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { THREADS_FILE, threadsFile } from './threads.ts';

// 🐦‍🔥 a wind its turn end named survives a hot reload: an `after` ends with the old copy, so the store is the wind's
// one keep and a start reads it back (flyway f62: the herdr codie's wind, lost to a mods push at 17:20)

const SID = 'r1r1r1r1-wind';
const PID = 4747;
const NOW = new Date(2026, 10, 20, 17, 20).getTime();
const SLUG = 'herdr-lane-3-13';
const NAME = '⚡ 🔧 herdr | FRM-620';

function world(on: On) {
    const clock = mock.clock(on, { now: NOW });
    const store = new Map<string, unknown>();
    const commands: string[] = [];
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
    const files: Record<string, string> = {
        [`/home/.claude/sessions/${PID}.json`]: JSON.stringify({
            name: NAME,
            pid: PID,
        }),
        [THREADS_FILE]: threadsFile([
            { display: NAME, pid: PID, role: 'codie', sessionId: SID },
        ]),
    };
    on('process.run', (_$, e) => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: e.argv[0] === 'ps' ? `${PID}\n` : '',
        },
    }));
    on('fs.read', (_$, e) =>
        e.path in files
            ? { value: files[e.path] ?? '' }
            : { deny: 'no such file' },
    );
    on('fs.write', (_$, e) => {
        files[e.path] = e.text;
        return { value: undefined };
    });
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
    on('prompt.submit', (_$, e) => ({ text: e.text }));
    on('command.list', () => ({
        value: [
            { description: '', name: 'compact', source: 'builtin' as const },
            {
                description: '',
                name: 'x:handoff-ingest',
                source: 'plugin' as const,
            },
        ],
    }));
    on('command.run', (_$, e) => {
        commands.push(
            e.command === 'compact' ? '/compact' : `/${e.command} ${e.args}`,
        );
        return { text: '' };
    });
    on('session.compact', (_$, e) => ({ messages: e.messages }));
    return { clock, commands, store };
}

// a reload is a fresh copy of the module started on the store the old one left
const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });

test('a wind its turn end named, its timer lost to a reload, compacts and ingests once the reloaded copy starts', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    await start($);
    await w.clock.advance(2_000);
    expect([w.commands, w.store.has(`wind:${SID}`)]).toEqual([
        ['/compact', `/x:handoff-ingest ${SLUG}`],
        false,
    ]);
});

test('a reload after the wind ran fires nothing again', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    await start($);
    await w.clock.advance(2_000);
    await start($);
    await w.clock.advance(2_000);
    expect(w.commands).toEqual(['/compact', `/x:handoff-ingest ${SLUG}`]);
});

test('a wind blocked by work it started stays refused across a reload, never run', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, {
        at: NOW,
        blocked: 'an agent',
        slug: SLUG,
        state: 'refreshing',
    });
    await start($);
    await w.clock.advance(2_000);
    expect([
        w.commands,
        (w.store.get(`wind:${SID}`) as { state?: string }).state,
    ]).toEqual([[], 'refused']);
});

test('two starts inside the beat run the wind once', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    await start($);
    await start($);
    await w.clock.advance(2_000);
    expect(w.commands).toEqual(['/compact', `/x:handoff-ingest ${SLUG}`]);
});

// spec 2b: a 🌀 row a lost run left holds the thread's messages no longer than a compact's longest run (10 min)
const fromPeer = ($: Engine, body: string) =>
    $.session.receive({
        origin: { kind: 'peer' },
        text: `<cross-session-message from="uds:/tmp/cc-socks/9.sock" from-name="⚡ 🔎 herdr" from-mode="bypass">\n${body}\n</cross-session-message>`,
    }) as Promise<{ consumed?: string; text?: string }>;
for (const [age, isHeld] of [
    [9 * 60_000, true],
    [11 * 60_000, false],
] as const)
    test(`a peer's message into a wind row ${age / 60_000} min old is ${isHeld ? 'held' : 'passed'}`, async ($, on) => {
        const w = world(on);
        on('session.receive', (_$, e) => ({ text: e.text }));
        on('session.send', () => ({ isDelivered: true }));
        // a run's own row, its slug spent: a reload in its compact lost the run
        w.store.set(`wind:${SID}`, { at: NOW - age, state: 'refreshing' });
        await start($);
        const r = await fromPeer($, 'round 4 on abc1234');
        expect(r.consumed !== undefined).toBe(isHeld);
    });
