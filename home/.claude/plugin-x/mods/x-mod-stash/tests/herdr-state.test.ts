import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// FRM-568: what herdr draws for each session, written to the shelf, since herdr reads no private store
const TOOL = 'mcp__x-mod-stash__orbit';
const DIR = '/home/.claude/shelf/herdr-state';
const A = 'a1a1a1a1-0000';
const B = 'b2b2b2b2-0000';
const START = 'Sun Oct  4 21:00:00 2026';

// one session, pid 100, with a disk the test reads back: `write` lands in two halves, as a big write can, and a reader
// looks at A's file between them, so it meets half a file unless the writer renames a whole one into place
async function session($: Engine, on: On) {
    const clock = mock.clock(on);
    const store = new Map<string, unknown>();
    const files = new Map<string, string>();
    const alive = new Set([100]);
    const midway: string[] = [];
    const state = new Map<string, unknown>();
    on('state.get', (_$, e) => ({
        value: { value: state.get(e.key), version: state.has(e.key) ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state.set(e.key, e.value);
        return { value: { isSet: true, version: 2 } };
    });
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
    on('env.get', () => ({ value: '/home' }));
    on('fs.write', async (_$, e) => {
        files.set(e.path, e.text.slice(0, e.text.length >> 1));
        const seen = files.get(`${DIR}/${A}.json`);
        if (seen !== undefined) midway.push(seen);
        files.set(e.path, e.text);
        return { value: undefined };
    });
    on('fs.read', (_$, e) =>
        files.has(e.path)
            ? { value: files.get(e.path) ?? '' }
            : { deny: 'no such file' },
    );
    on('fs.list', (_$, e) => ({
        value: [...files.keys()]
            .filter((f) => f.startsWith(`${e.path}/`))
            .map((f) => ({
                isLink: false,
                kind: 'file' as const,
                mtimeMs: 0,
                name: f.slice(e.path.length + 1),
                size: 1,
            })),
    }));
    on('process.run', (_$, e) => {
        const [cmd, ...args] = e.argv;
        const out = (stdout: string, exitCode = 0) => ({
            value: {
                exitCode,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout,
            },
        });
        if (cmd === 'sh') return out(`100\n${START}\n`);
        if (cmd === 'mv') {
            const [from, to] = args.slice(1);
            const text = files.get(String(from));
            if (text === undefined || !to) return out('', 1);
            files.delete(String(from));
            files.set(to, text);
            return out('');
        }
        if (cmd === 'rm') {
            files.delete(String(args.at(-1)));
            return out('');
        }
        if (cmd === 'ps')
            return out('', alive.has(Number(args.at(-1))) ? 0 : 1);
        return out('', 1);
    });
    let sid = A;
    on('session.id', () => ({ value: sid }));
    on('session.repo', () => ({ value: null }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('ui.log', () => ({ value: undefined }));
    on('session.end', (_$, e) => e);
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'terminal',
    });
    return {
        alive,
        clock,
        files,
        midway,
        read: (id: string) => {
            const text = files.get(`${DIR}/${id}.json`);
            return text === undefined ? undefined : JSON.parse(text);
        },
        setSid: (next: string) => {
            sid = next;
        },
        store,
    };
}

const orbit = ($: Engine, input: Record<string, unknown>) =>
    $.tool.call({ tool: TOOL, ...input } as never);

test("a session's state file holds its asks, plan, wait, taken, ctx and model", async ($, on) => {
    const s = await session($, on);
    s.store.set(`reply:${A}`, { at: 1, wait: 'waiting on **🦉 clio**' });
    s.store.set(`herdr-read:${A}`, 42);
    s.store.set(`context:${A}`, 54);
    s.store.set(`model:${A}`, 'opus 5.5 · medium');
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    await orbit($, { asks: [{ pick: 'yes', text: 'ship it' }], op: 'add' });
    expect(s.read(A)).toMatchObject({
        asks: [{ id: 'o1', pick: 'yes', text: 'ship it' }],
        ctx: 54,
        model: 'opus 5.5 · medium',
        pid: 100,
        plan: { lines: ['now: a', 'next: b'] },
        sid: A,
        taken: 42,
        v: 1,
        wait: 'waiting on **🦉 clio**',
    });
});

// cc measures only at a turn's end, and a wind's ingest runs as one long turn: the fill from before the compact
// stayed on the row for 17 min (2026-11-11)
for (const trigger of ['manual', 'auto'] as const)
    test(`a ${trigger} compact drops the stored ctx, so no row shows the fill from before it`, async ($, on) => {
        on('session.compact', (_$, e) => ({ messages: e.messages }));
        const s = await session($, on);
        s.store.set(`context:${A}`, 63);
        await orbit($, { lines: ['now: a'], op: 'plan' });
        await $.session.compact({
            messages: [{ role: 'user', text: 'hi', toolUses: [] }],
            trigger,
        } as never);
        expect([s.store.has(`context:${A}`), s.read(A)?.ctx]).toEqual([
            false,
            null,
        ]);
    });

test('a precompute compact keeps the stored ctx', async ($, on) => {
    on('session.compact', (_$, e) => ({ messages: e.messages }));
    const s = await session($, on);
    s.store.set(`context:${A}`, 63);
    await $.session.compact({
        messages: [{ role: 'user', text: 'hi', toolUses: [] }],
        trigger: 'precompute',
    } as never);
    expect(s.store.get(`context:${A}`)).toBe(63);
});

test('a reader beside a tight write loop never meets half a file', async ($, on) => {
    const s = await session($, on);
    await orbit($, { asks: [{ pick: 'yes', text: 'ship it' }], op: 'add' });
    let errors = 0;
    for (let i = 0; i < 40; i++) {
        s.store.set(`context:${A}`, i);
        await s.clock.advance(4_000);
    }
    const reads = [...s.midway];
    while (reads.length < 200)
        reads.push(s.files.get(`${DIR}/${A}.json`) ?? '');
    for (const text of reads)
        try {
            JSON.parse(text);
        } catch {
            errors++;
        }
    expect([s.midway.length >= 10, errors]).toEqual([true, 0]);
});

test("a /clear drops the old id's file and the new id's names it as its succ", async ($, on) => {
    const s = await session($, on);
    await orbit($, { asks: [{ pick: 'yes', text: 'ship it' }], op: 'add' });
    s.setSid(B);
    await $.session.end({ reason: 'clear', sessionId: A } as never);
    await orbit($, { asks: [{ pick: 'yes', text: 'next' }], op: 'add' });
    expect([s.read(A), s.read(B)?.succ]).toEqual([undefined, A]);
});

test("a state file whose pid is dead is pruned at the next poll's sweep", async ($, on) => {
    const s = await session($, on);
    s.files.set(`${DIR}/dead-0000.json`, JSON.stringify({ pid: 200, v: 1 }));
    s.files.set(`${DIR}/live-0000.json`, JSON.stringify({ pid: 100, v: 1 }));
    await s.clock.advance(4_000);
    expect([
        s.files.has(`${DIR}/dead-0000.json`),
        s.files.has(`${DIR}/live-0000.json`),
    ]).toEqual([false, true]);
});

test('the fleet file holds afk and the waker, each with its time', async ($, on) => {
    const s = await session($, on);
    s.store.set('afk', { at: 5, on: true, wakerBefore: false });
    s.store.set('waker', { at: 6, on: true });
    await s.clock.advance(4_000);
    expect(JSON.parse(s.files.get(`${DIR}/fleet.json`) ?? '{}')).toEqual({
        afk: { at: 5, on: true },
        v: 1,
        waker: { at: 6, on: true },
    });
});

// FRM-568 slice 5: herdr's band appends his presses; each thread takes what is its own, once, from its start on
const PRESSES = '/home/.claude/shelf/band-presses/band.jsonl';
async function pressed(
    $: Engine,
    on: On,
    lines: (now: number) => Record<string, unknown>[],
    startedAt = -60_000,
) {
    const s = await session($, on);
    s.files.set(
        '/home/.claude/sessions/100.json',
        JSON.stringify({ pid: 100, sessionId: A, startedAt }),
    );
    const now = s.clock.now();
    s.files.set(
        PRESSES,
        lines(now)
            .map((l) => JSON.stringify(l))
            .join('\n'),
    );
    await s.clock.advance(4_000);
    return s;
}

test('a fresh thread replays no press older than its start', async ($, on) => {
    const s = await pressed(
        $,
        on,
        (now) => [
            { at: now - 9_000, button: 'wind', on: true, sid: A },
            { at: now - 8_000, button: 'hot', on: true, sid: A },
            { at: now - 7_000, button: 'hot', on: false, sid: A },
        ],
        -500,
    );
    const hotBefore = s.store.get(`hot:${A}`);
    await s.clock.advance(4_000);
    expect([s.store.get(`wind:${A}`), s.store.get(`hot:${A}`)]).toEqual([
        undefined,
        hotBefore,
    ]);
});

test('a wind press naming this thread asks for its wind, once', async ($, on) => {
    const s = await pressed($, on, (now) => [
        { at: now - 1_000, button: 'wind', on: true, sid: A },
    ]);
    const first = (s.store.get(`wind:${A}`) as { state?: string })?.state;
    s.store.set(`wind:${A}`, { at: 1, state: 'writing' });
    await s.clock.advance(4_000);
    expect([
        first,
        (s.store.get(`wind:${A}`) as { state?: string })?.state,
    ]).toEqual(['asked', 'writing']);
});

test('a wind press naming another thread is not taken here', async ($, on) => {
    const s = await pressed($, on, (now) => [
        { at: now - 1_000, button: 'wind', on: true, sid: B },
    ]);
    expect(s.store.get(`wind:${A}`)).toBeUndefined();
});

test('a press dated ahead of now is never taken', async ($, on) => {
    const s = await pressed($, on, (now) => [
        { at: now + 60_000, button: 'wind', on: true, sid: A },
    ]);
    expect(s.store.get(`wind:${A}`)).toBeUndefined();
});

test('a herdr AFK press turns afk on and ⏰ on, as the cc button does', async ($, on) => {
    const s = await pressed($, on, (now) => [
        { at: now - 1_000, button: 'afk', on: true },
    ]);
    expect([
        (s.store.get('afk') as { on?: boolean })?.on,
        (s.store.get('waker') as { on?: boolean })?.on,
    ]).toEqual([true, true]);
});

test('a cc AFK press after a herdr one wins over a thread that reads the herdr line late', async ($, on) => {
    const s = await pressed($, on, () => []);
    const now = s.clock.now();
    s.files.set(
        PRESSES,
        JSON.stringify({ at: now - 2_000, button: 'afk', on: true }),
    );
    s.store.set('afk', { at: now - 1_000, on: false });
    await s.clock.advance(4_000);
    expect((s.store.get('afk') as { on?: boolean })?.on).toBe(false);
});

test('a hot press naming this thread sets its hot', async ($, on) => {
    const s = await pressed($, on, (now) => [
        { at: now - 1_000, button: 'hot', on: true, sid: A },
    ]);
    expect(s.store.get(`hot:${A}`)).toMatchObject({
        since: expect.any(Number),
    });
});

test('a press taken once is never taken again over a later change', async ($, on) => {
    const s = await pressed($, on, (now) => [
        { at: now - 1_000, button: 'hot', on: false, sid: A },
    ]);
    s.store.set(`hot:${A}`, { since: 1 });
    await s.clock.advance(4_000);
    expect(s.store.get(`hot:${A}`)).toEqual({ since: 1 });
});

// sixth sense round 1 on 9efae626: the latest of two fleet presses in one poll wins; a line dated ahead stays refused
for (const button of ['afk', 'waker'] as const)
    test(`two ${button} presses in one poll end as the newer one says`, async ($, on) => {
        const s = await pressed($, on, (now) => [
            { at: now - 2_000, button, on: true },
            { at: now - 1_000, button, on: false },
        ]);
        expect((s.store.get(button) as { on?: boolean })?.on).toBe(false);
    });

test('a line dated ahead of now is never taken once its time passes', async ($, on) => {
    const s = await pressed($, on, (now) => [
        { at: now + 30_000, button: 'wind', on: true, sid: A },
    ]);
    for (let i = 0; i < 15; i++) await s.clock.advance(4_000);
    expect(s.store.get(`wind:${A}`)).toBeUndefined();
});
