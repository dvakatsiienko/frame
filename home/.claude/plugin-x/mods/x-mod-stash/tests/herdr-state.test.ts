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
    const mtimes = new Map<string, number>();
    const alive = new Set([100]);
    const midway: string[] = [];
    const dirs = new Set<string>();
    // destinations a rename fails on, as a full or read-only shelf would
    const failMv = new Set<string>();
    // each prompt's model-only context, and each tool result's
    const contexts: string[][] = [];
    const state = new Map<string, unknown>();
    on('prompt.submit', (_$, e) => {
        contexts.push([...(e.context ?? [])]);
        return { text: e.text };
    });
    on('tool.call', () => ({ result: {}, text: 'done' }));
    on('turn.complete', () => ({ text: '' }));
    on('classic.Stop', () => ({}));
    on('skill.prompt', (_$, e) => ({ text: e.text }));
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
        mtimes.set(e.path, clock.now());
        return { value: undefined };
    });
    on('fs.stat', (_$, e) =>
        files.has(e.path)
            ? {
                  value: {
                      isLink: false,
                      kind: 'file' as const,
                      mtimeMs: mtimes.get(e.path) ?? 0,
                      size: 1,
                  },
              }
            : { deny: 'ENOENT' },
    );
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
        if (cmd === 'id')
            return out('dima:*:501:20::0:0:Dima:/home:/bin/zsh\n');
        if (cmd === 'mv') {
            const [from, to] = args.slice(1);
            const text = files.get(String(from));
            if (text === undefined || !to || failMv.has(to)) return out('', 1);
            files.delete(String(from));
            files.set(to, text);
            return out('');
        }
        if (cmd === 'rm') {
            files.delete(String(args.at(-1)));
            return out('');
        }
        // a lock dir: a plain mkdir fails on one that exists, as herdr's held lock would
        if (cmd === 'mkdir') {
            const dir = String(args.at(-1));
            if (args[0] !== '-p' && dirs.has(dir)) return out('', 1);
            dirs.add(dir);
            return out('');
        }
        if (cmd === 'rmdir') {
            dirs.delete(String(args.at(-1)));
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
        contexts,
        dirs,
        failMv,
        files,
        midway,
        mtimes,
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

// o95: herdr's 🔓 press flips the merge override fleet-wide; «on» is the state asked, held until he presses off (o103)
const OVERRIDE = '/home/.local/state/x/operator-override.json';
async function overridePressed(
    $: Engine,
    on: On,
    lines: (now: number) => Record<string, unknown>[],
    store?: { mtime: number; text: string },
    settings?: string,
) {
    const s = await pressed($, on, () => []);
    const now = s.clock.now();
    if (settings) s.files.set(BAND_SETTINGS, settings);
    if (store) {
        s.files.set(OVERRIDE, store.text);
        s.mtimes.set(OVERRIDE, now + store.mtime);
    }
    s.files.set(
        PRESSES,
        lines(now)
            .map((l) => JSON.stringify(l))
            .join('\n'),
    );
    await s.clock.advance(4_000);
    return s;
}

test('an override on press turns the prs grant on by band, with no end', async ($, on) => {
    const s = await overridePressed($, on, (now) => [
        { at: now - 1_000, button: 'override', on: true },
    ]);
    expect(JSON.parse(s.files.get(OVERRIDE) ?? '{}')).toEqual({
        prs: { at: expect.any(String), by: 'band' },
    });
});

// dima 23:10 on o111: on until off by default, a 2 h window if his band setting asks for one
const BAND_SETTINGS = '/home/.claude/shelf/band-settings.json';
for (const [window, until] of [
    ['off', undefined],
    ['2h', 2 * 60 * 60 * 1000],
] as const)
    test(`an override on press with the window ${window} ${until ? 'ends 2 h after the press' : 'holds until he presses off'}`, async ($, on) => {
        let at = 0;
        const s = await overridePressed(
            $,
            on,
            (now) => {
                at = now - 1_000;
                return [{ at, button: 'override', on: true }];
            },
            undefined,
            JSON.stringify({ overrideWindow: window }),
        );
        expect(JSON.parse(s.files.get(OVERRIDE) ?? '{}').prs).toEqual({
            at: new Date(at).toISOString(),
            by: 'band',
            ...(until ? { until: new Date(at + until).toISOString() } : {}),
        });
    });

test('an override off press clears every grant', async ($, on) => {
    const s = await overridePressed(
        $,
        on,
        (now) => [{ at: now - 1_000, button: 'override', on: false }],
        {
            mtime: -9_000,
            text: JSON.stringify({ prs: { at: 'x', by: 'word' } }),
        },
    );
    expect(s.files.get(OVERRIDE)).toBe('{}');
});

test('an override on then off in one poll ends off', async ($, on) => {
    const s = await overridePressed(
        $,
        on,
        (now) => [
            { at: now - 2_000, button: 'override', on: true },
            { at: now - 1_000, button: 'override', on: false },
        ],
        {
            mtime: -9_000,
            text: JSON.stringify({ prs: { at: 'x', by: 'word' } }),
        },
    );
    expect(s.files.get(OVERRIDE)).toBe('{}');
});

test("an override press older than the store's last write is not taken", async ($, on) => {
    const s = await overridePressed(
        $,
        on,
        (now) => [{ at: now - 1_000, button: 'override', on: true }],
        { mtime: -500, text: '{}' },
    );
    expect(s.files.get(OVERRIDE)).toBe('{}');
});

test('an override press dated ahead of now is never taken', async ($, on) => {
    const s = await overridePressed($, on, (now) => [
        { at: now + 30_000, button: 'override', on: true },
    ]);
    for (let i = 0; i < 15; i++) await s.clock.advance(4_000);
    expect(s.files.get(OVERRIDE)).toBeUndefined();
});

// FRM-584: herdr's chatter appends the messages dima joins to a thread, one row a line; the thread hands them into its
// next turn and herdr reads `joined` only once that turn completed
const JOINS = `/home/.claude/shelf/herdr-joins/${A}.jsonl`;
const BACK = `/home/.claude/shelf/herdr-joins/back/${A}.jsonl`;
const row = (id: string, text: string) => `${JSON.stringify({ id, text })}\n`;
const say = ($: Engine, text = 'go') =>
    $.prompt.submit({ origin: { kind: 'composer' }, text, wait: false });
const step = async ($: Engine) =>
    ((await $.tool.call({ command: 'ls', tool: 'Bash' })).context ?? []).join(
        '\n',
    );
const endTurn = ($: Engine, isAborted = false) =>
    $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted,
        reason: isAborted ? 'aborted' : 'answer',
        turnId: 't',
    });
const said = (s: { contexts: string[][] }) =>
    s.contexts.flat().filter((l) => l.startsWith('💨 dima wrote'));

test('exit 1: two joins written before a turn land in it in order, once, and read joined only after it completes', async ($, on) => {
    const s = await session($, on);
    s.files.set(JOINS, row('j1', 'first') + row('j2', 'second'));
    await say($);
    await step($);
    await s.clock.advance(12_000);
    const during = s.read(A)?.joins;
    await endTurn($);
    await say($);
    expect([said(s), during, s.read(A)?.joins]).toEqual([
        [
            '💨 dima wrote these 2, in order, in herdr while you worked; it joins this turn as his own words:\n«first»\n«second»',
        ],
        { joined: [], push: [], waiting: ['j1', 'j2'] },
        { joined: ['j1', 'j2'], push: [], waiting: [] },
    ]);
});

test('exit 1 twin: a join written mid-turn lands at the next tool step, once', async ($, on) => {
    const s = await session($, on);
    await say($);
    s.files.set(JOINS, row('j1', 'late'));
    const first = await step($);
    const second = await step($);
    expect([first.includes('«late»'), second.includes('«late»')]).toEqual([
        true,
        false,
    ]);
});

test('exit 1 twins: a broken line, a row with no id and an id written twice each land once or not at all', async ($, on) => {
    const s = await session($, on);
    s.files.set(
        JOINS,
        `${row('j1', 'one')}{"id":"j2","text":"half${'\n'}${JSON.stringify({ text: 'no id' })}\n${row('j1', 'again')}${row('j3', 'three')}`,
    );
    await say($);
    await endTurn($);
    expect([said(s), s.read(A)?.joins]).toEqual([
        [
            '💨 dima wrote these 2, in order, in herdr while you worked; it joins this turn as his own words:\n«one»\n«three»',
        ],
        { joined: ['j1', 'j3'], push: [], waiting: [] },
    ]);
});

test('a slash row is never joined: it waits for herdr to push it', async ($, on) => {
    const s = await session($, on);
    s.files.set(JOINS, row('j1', '/compact'));
    await say($);
    await endTurn($);
    expect([said(s), s.read(A)?.joins]).toEqual([
        [],
        { joined: [], push: ['j1'], waiting: [] },
    ]);
});

test('exit 2: an Esc after the hand-in stamps nothing, and the rows land again at the next turn, once', async ($, on) => {
    const s = await session($, on);
    s.files.set(JOINS, row('j1', 'first') + row('j2', 'second'));
    await say($);
    await endTurn($, true);
    const after = s.read(A)?.joins;
    await say($);
    await endTurn($);
    await say($);
    expect([said(s).length, after, s.read(A)?.joins]).toEqual([
        2,
        { joined: [], push: [], waiting: ['j1', 'j2'] },
        { joined: ['j1', 'j2'], push: [], waiting: [] },
    ]);
});

test('exit 3: a join into an idle thread reads waiting and starts no turn, then lands at its next turn', async ($, on) => {
    const s = await session($, on);
    s.files.set(JOINS, row('j1', 'hi'));
    await s.clock.advance(60_000);
    const idle = [s.contexts.length, s.read(A)?.joins];
    await say($);
    expect([idle, said(s).length]).toEqual([
        [0, { joined: [], push: [], waiting: ['j1'] }],
        1,
    ]);
});

test('exit 4: a thread that ends hands its waiting joins back as herdr wrote them, the joined ones not', async ($, on) => {
    const s = await session($, on);
    s.files.set(JOINS, row('j1', 'took'));
    await say($);
    await endTurn($);
    s.files.set(JOINS, row('j1', 'took') + row('j2', 'waits'));
    await $.session.end({ reason: 'other', sessionId: A } as never);
    expect([
        s.files.get(BACK),
        s.files.has(JOINS),
        said(s).length,
        s.store.has(`join-done:${A}`),
    ]).toEqual([row('j2', 'waits'), false, 1, false]);
});

test('exit 4: a killed thread hands its joins back at the sweep, and while herdr holds the lock it waits for the next', async ($, on) => {
    const s = await session($, on);
    const dead = 'dead-0000';
    s.files.set(`${DIR}/${dead}.json`, JSON.stringify({ pid: 200, v: 1 }));
    s.files.set(
        `/home/.claude/shelf/herdr-joins/${dead}.jsonl`,
        row('j1', 'hi'),
    );
    s.dirs.add(`/home/.claude/shelf/herdr-joins/${dead}.jsonl.lock`);
    await s.clock.advance(4_000);
    const held = s.files.has(`${DIR}/${dead}.json`);
    s.dirs.clear();
    // the sweep runs every 5th shelf pass, a shelf pass every 3rd poll
    for (let i = 0; i < 15; i++) await s.clock.advance(4_000);
    expect([
        held,
        s.files.has(`${DIR}/${dead}.json`),
        s.files.get(`/home/.claude/shelf/herdr-joins/back/${dead}.jsonl`),
        s.files.has(`/home/.claude/shelf/herdr-joins/${dead}.jsonl`),
    ]).toEqual([true, false, row('j1', 'hi'), false]);
});

// wisphunter on aa2c7d89: five review fixes, each row red on that commit
test('a thread past 500 joins never hands an old one in again', async ($, on) => {
    const s = await session($, on);
    const many = Array.from({ length: 500 }, (_, i) => `x${i}`);
    s.store.set(`join-done:${A}`, ['j0', ...many]);
    s.files.set(JOINS, row('j0', 'old') + row('j1', 'new'));
    await say($);
    await endTurn($);
    await say($);
    expect(said(s).map((l) => l.includes('«old»'))).toEqual([false]);
});

test('a hand-back the lock refused at /clear goes back at a later sweep', async ($, on) => {
    const s = await session($, on);
    s.files.set(JOINS, row('j1', 'waits'));
    s.dirs.add(`${JOINS}.lock`);
    await $.session.end({ reason: 'clear', sessionId: A } as never);
    const held = s.files.has(BACK);
    s.dirs.clear();
    for (let i = 0; i < 15; i++) await s.clock.advance(4_000);
    expect([held, s.files.get(BACK), s.files.has(JOINS)]).toEqual([
        false,
        row('j1', 'waits'),
        false,
    ]);
});

test('one dead thread whose hand-back throws leaves the sweep going for the rest', async ($, on) => {
    const s = await session($, on);
    for (const dead of ['dead-a000', 'dead-b000']) {
        s.files.set(`${DIR}/${dead}.json`, JSON.stringify({ pid: 200, v: 1 }));
        s.files.set(
            `/home/.claude/shelf/herdr-joins/${dead}.jsonl`,
            row('j1', dead),
        );
    }
    s.failMv.add('/home/.claude/shelf/herdr-joins/back/dead-a000.jsonl');
    await s.clock.advance(4_000);
    expect([
        s.files.has(`${DIR}/dead-a000.json`),
        s.files.has(`${DIR}/dead-b000.json`),
    ]).toEqual([true, false]);
});

test('with 💨 herdr joins off, the state file draws no joins', async ($, on) => {
    const s = await session($, on);
    s.store.set('shown', { 'stash.joins': false });
    s.files.set(JOINS, row('j1', 'hi'));
    await s.clock.advance(12_000);
    expect(s.read(A)?.joins).toBeNull();
});

// sixth sense round 1 on 853e3898: prompt.submit fires when a prompt is queued, before its turn runs (engine.md)
test('a prompt queued behind a running turn carries no joins: that turn ends with them waiting', async ($, on) => {
    const s = await session($, on);
    await say($, 'turn A');
    s.files.set(JOINS, row('j1', 'first') + row('j2', 'second'));
    await say($, 'queued B');
    await endTurn($);
    expect([said(s), s.read(A)?.joins]).toEqual([
        [],
        { joined: [], push: [], waiting: ['j1', 'j2'] },
    ]);
});

test('an Esc on a turn with a prompt queued behind it hands the joins in once, at the next tool step', async ($, on) => {
    const s = await session($, on);
    await say($, 'turn A');
    s.files.set(JOINS, row('j1', 'first') + row('j2', 'second'));
    await say($, 'queued B');
    await endTurn($, true);
    const first = await step($);
    const again = await step($);
    await endTurn($);
    expect([
        said(s).length,
        first.includes('«first»\n«second»'),
        again.includes('«first»'),
        s.read(A)?.joins,
    ]).toEqual([
        0,
        true,
        false,
        { joined: ['j1', 'j2'], push: [], waiting: [] },
    ]);
});

test('a hand-back keeps a line this side could not read, as herdr wrote it', async ($, on) => {
    const s = await session($, on);
    s.files.set(JOINS, `${row('j1', 'ok')}{"id":"j2","text":"half\n`);
    await $.session.end({ reason: 'other', sessionId: A } as never);
    expect(s.files.get(BACK)).toBe(
        `${row('j1', 'ok')}{"id":"j2","text":"half\n`,
    );
});
