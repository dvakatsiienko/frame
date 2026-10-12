import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const SID = 'o1o1o1o1-orbit';
const TOOL = 'mcp__x-mod-stash__orbit';

// one session: `contexts` holds each prompt's model-only context, `appended` each hidden mid-turn message
function world(on: On) {
    const contexts: string[][] = [];
    const appended: string[] = [];
    mock.clock(on, { now: new Date(2026, 9, 10, 19, 0).getTime() });
    // a store in memory the test reads back: the shared store other sessions' boards count from
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
    on('ui.log', () => ({ value: undefined }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('fs.list', () => ({ value: [] }));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('prompt.submit', (_$, e) => {
        contexts.push([...(e.context ?? [])]);
        return { text: e.text };
    });
    on('session.append', (_$, e, next) => {
        for (const b of e.message.content)
            if (b.type === 'text') appended.push(String(b.text));
        return next(e);
    });
    on('turn.complete', () => ({ text: '' }));
    on('classic.Stop', () => ({}));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    on('skill.prompt', (_$, e) => ({ text: e.text }));
    return { appended, contexts, store };
}

const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });

const orbit = ($: Engine, input: Record<string, unknown>) =>
    $.tool.call({ tool: TOOL, ...input } as never);

const add = ($: Engine, ...asks: [string, string][]) =>
    orbit($, {
        asks: asks.map(([text, pick]) => ({
            hiddenNote: `came from ${text}`,
            pick,
            text,
        })),
        op: 'add',
    });

const say = ($: Engine, text: string, kind = 'composer' as const) =>
    $.prompt.submit({ origin: { kind }, text, wait: false });

const endTurn = ($: Engine) =>
    $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });

const board = ($: Engine) =>
    $.ui.mount({
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

type Board = Awaited<ReturnType<typeof board>>;

// orbit's ask ids as the mounted board shows them, in order
async function asksShown(ui: Board) {
    return (await ui.findAll({ type: 'Box' }))
        .filter((n) => n.key?.startsWith('orbit:ask:'))
        .map((n) => n.key?.slice('orbit:ask:'.length));
}

const joined = (contexts: string[][]) =>
    (contexts.at(-1) ?? []).filter((c) => c.startsWith('orbit: dima marked'));

test('asks the tool adds list in orbit oldest first, each by its id', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the old probe', 'yes']);
    await add($, ['rename the band', 'later']);
    expect(await asksShown(ui)).toEqual(['o1', 'o2', 'o3']);
});

test("an ask's row reads its text and cclio's pick", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push the branch to main', 'yes, now']);
    expect(
        (await ui.find({ key: 'orbit:ask:o1', type: 'Box' }))?.text,
    ).toContain('push the branch to main➡️ yes, now');
});

test('a ticked ask joins the next prompt as model-only context', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await ui.press({ key: 'orbit:accepted:o2' });
    await say($, 'go on');
    expect(joined(w.contexts).join('\n')).toMatch(
        /o2 🛎️ accepted: trash the probe \(your pick: yes\)/,
    );
});

test('an unmarked ask joins no prompt', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await ui.press({ key: 'orbit:accepted:o2' });
    await say($, 'go on');
    expect(joined(w.contexts).join('\n')).not.toContain('o1');
});

test("a rejected ask joins with dima's note and cclio's hidden note", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:rejected:o1' });
    await ui.input({ key: 'orbit:note:o1', text: 'wait for ci' });
    await say($, 'next');
    expect(joined(w.contexts).join('\n')).toMatch(
        /o1 ↩️ rejected: push FRM-1 \(your pick: yes\) · his note: «wait for ci» · your note: «came from push FRM-1»/,
    );
});

test('check all accepts every open ask', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['a one', 'x'], ['a two', 'y']);
    await ui.press({ key: 'orbit:all' });
    await say($, 'go');
    expect(
        joined(w.contexts)
            .join('\n')
            .match(/o\d 🛎️/g),
    ).toEqual(['o1 🛎️', 'o2 🛎️']);
});

test('orbit is a card headed «🪐 orbit» with no count, and its check-all is a bare ✅', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['a one', 'x'], ['a two', 'y']);
    const card = await ui.find({ key: 'orbit', type: 'Box' });
    expect([
        card?.props.borderStyle,
        (await ui.find({ text: /^🪐 orbit/, type: 'Text' }))?.text,
        (await ui.find({ key: 'orbit:all', type: 'Button' }))?.text,
    ]).toEqual(['round', '🪐 orbit', '✅']);
});

test('each ask is a card of its own', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['a one', 'x']);
    expect(
        (await ui.find({ key: 'orbit:ask:o1', type: 'Box' }))?.props
            .borderStyle,
    ).toBe('round');
});

test("a peer's prompt carries no mark, but its turn takes the tick at its next tool call", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await $.prompt.submit({
        origin: { kind: 'peer-send-message' } as never,
        text: 'status?',
        wait: false,
    });
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect([joined(w.contexts), (r.context ?? []).join('\n')]).toEqual([
        [],
        expect.stringMatching(/o1 🛎️ accepted/),
    ]);
});

test('a keep-hot ping turn never takes a tick', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await $.prompt.submit({
        origin: { kind: 'plugin' } as never,
        text: 'x-mod-stash keep-hot ping: answer with one character, nothing else.',
        wait: false,
    });
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).join('\n')).not.toMatch(/accepted/);
});

test('a ping turn a reload kept in state still takes no tick', async ($, on) => {
    world(on);
    // a fresh module after a mid-turn reload: its own flag is the default, the ping turn lives on in $.state
    let keptTurn: unknown;
    on('state.get', (_$, e, next) =>
        e.key === 'turn' && keptTurn
            ? { value: { value: keptTurn, version: 1 } }
            : next(e),
    );
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    keptTurn = { afk: false, isBusy: true, isPinged: true, isUserTurn: false };
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).join('\n')).not.toMatch(/accepted/);
});

test('a joined ask keeps its buttons but no note field while the turn runs', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await ui.input({ key: 'orbit:note:o1', text: 'after ci' });
    await say($, 'go');
    const keys = (await ui.findAll({})).map((n) => n.key ?? '');
    expect([
        keys.filter((k) => /^orbit:(accepted|rejected|note|read):o1$/.test(k)),
        (await ui.find({ key: 'orbit:ask:o1', type: 'Box' }))?.text,
    ]).toEqual([
        ['orbit:accepted:o1', 'orbit:rejected:o1', 'orbit:read:o1'],
        expect.stringContaining('💬 «after ci»'),
    ]);
});

test("a joined ask's held button reads 🔓, and a press changes nothing", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    const take = async () =>
        (await ui.find({ key: 'orbit:accepted:o1', type: 'Button' }))?.text;
    const held = await take();
    await ui.press({ key: 'orbit:accepted:o1' });
    expect([held, await take()]).toEqual(['🔓 take', '🔓 take']);
});

test('an ask the turn left unanswered gets its controls back when the turn ends', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    await endTurn($);
    expect(await ui.find({ key: 'orbit:accepted:o1' })).toBeTruthy();
});

test('a held mark swaps its emoji for ✅, and only one of the two holds it', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    const look = async () =>
        Promise.all(
            ['accepted', 'rejected'].map(async (m) => {
                const b = await ui.find({ key: `orbit:${m}:o1` });
                return `${b?.text}|${b?.props.variant ?? '-'}`;
            }),
        );
    const idle = await look();
    await ui.press({ key: 'orbit:accepted:o1' });
    const taken = await look();
    await ui.press({ key: 'orbit:rejected:o1' });
    expect([idle, taken, await look()]).toEqual([
        ['🛎️ take|primary', '🔁 replay|-'],
        ['✅ take|primary', '🔁 replay|-'],
        ['🛎️ take|primary', '✅ replay|-'],
    ]);
});

test('a note is kept as it is typed, with no Enter', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:rejected:o1' });
    await ui.input({
        key: 'orbit:note:o1',
        kind: 'change',
        text: 'wait for ci',
    });
    await say($, 'next');
    expect(joined(w.contexts).join('\n')).toContain('his note: «wait for ci»');
});

test('a resolved ask leaves orbit when the turn ends', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    await orbit($, { ids: ['o1'], op: 'resolve' });
    await endTurn($);
    expect(await asksShown(ui)).toEqual(['o2']);
});

test("a follow-up clears dima's note on the old question", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.input({ key: 'orbit:note:o1', text: 'tastaet' });
    await say($, 'go');
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'after ci',
        text: 'push the branch once ci is green',
    });
    await endTurn($);
    expect((await ui.find({ key: 'orbit:note:o1' }))?.props.value).toBe('');
});

test('a follow-up keeps its id and place with new text, led by 🆕', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await say($, 'go');
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'after ci',
        text: 'push the branch once ci is green',
    });
    await endTurn($);
    expect([
        await asksShown(ui),
        (await ui.find({ key: 'orbit:ask:o1', type: 'Box' }))?.text,
    ]).toEqual([
        ['o1', 'o2'],
        expect.stringMatching(
            /^🆕 o1: push the branch once ci is green➡️ after ci🛎️ take/u,
        ),
    ]);
});

test('a tick while the turn runs reaches that turn, and its resolve takes it out at turn end', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:accepted:o1' });
    const r = await $.tool.call({ command: 'sleep 20', tool: 'Bash' });
    await orbit($, { ids: ['o1'], op: 'resolve' });
    await endTurn($);
    expect([(r.context ?? []).join('\n'), await asksShown(ui)]).toEqual([
        expect.stringMatching(
            /o1 🛎️ accepted: name a bird \(your pick: pelican\)/,
        ),
        [],
    ]);
});

test('a tick the running turn never reads starts no turn of its own', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await say($, 'answer in one line');
    await ui.press({ key: 'orbit:accepted:o1' });
    await endTurn($);
    expect([w.appended, w.contexts.length]).toEqual([[], 1]);
});

test('a tick the turn never answered stays marked and joins the next prompt', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:accepted:o1' });
    await endTurn($);
    await say($, 'next');
    expect(joined(w.contexts).join('\n')).toContain('o1 🛎️ accepted');
});

test('every prompt reminds the session of its open asks and the tool', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await $.prompt.submit({
        origin: { kind: 'peer-send-message' } as never,
        text: 'status?',
        wait: false,
    });
    expect((w.contexts.at(-1) ?? []).join('\n')).toMatch(
        /orbit holds 1 open ask \(o1\).*mcp__x-mod-stash__orbit/,
    );
});

test('an empty orbit adds no reminder after the first turn', async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'hi');
    await endTurn($);
    await say($, 'again');
    expect((w.contexts.at(-1) ?? []).join('\n')).not.toContain('orbit');
});

test("a session's first prompt says phases are its live plan", async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'hi');
    expect((w.contexts.at(-1) ?? []).join('\n')).toMatch(
        /phases are your live plan/,
    );
});

test('after a /clear the first prompt says phases are its live plan again', async ($, on) => {
    const w = world(on);
    on('command.run', () => ({ text: '' }));
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
    await start($);
    await say($, 'hi');
    await endTurn($);
    await $.command.run({
        args: '',
        command: 'clear',
        origin: { kind: 'composer' },
        presentation: { columns: 80, isFullscreen: false },
    });
    await $.session.end({
        reason: 'clear',
        resume: { id: SID },
        sessionId: SID,
    });
    await say($, 'fresh start');
    expect((w.contexts.at(-1) ?? []).join('\n')).toMatch(
        /phases are your live plan/,
    );
});

const tools = async ($: Engine, n: number) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++)
        out.push(
            (
                (await $.tool.call({ command: 'ls', tool: 'Bash' })).context ??
                []
            ).join('\n'),
        );
    return out;
};

test('the third tool call of a turn with no phases set carries the nudge, once', async ($, on) => {
    world(on);
    await start($);
    await say($, 'go');
    const seen = await tools($, 4);
    expect(seen.map((c) => /no phases yet/.test(c))).toEqual([
        false,
        false,
        true,
        false,
    ]);
});

test('a turn that set its phases gets no nudge', async ($, on) => {
    world(on);
    await start($);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    const seen = await tools($, 3);
    expect(seen.some((c) => /phases/.test(c))).toBe(false);
});

test('the phases show in the board, a moon each, at most seven', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, {
        lines: ['now: a', 'next: b', 'then: c', 'd', 'e', 'f', 'g', 'h'],
        op: 'plan',
    });
    expect(
        (await ui.findAll({ type: 'Text' }))
            .map((t) => t.text)
            .filter((t) => /^[🌕🌔🌓🌒🌑] (?!phases)/u.test(t ?? '')),
    ).toEqual([
        '🌕 now: a',
        '🌔 next: b',
        '🌓 then: c',
        '🌒 d',
        '🌑 e',
        '🌑 f',
        '🌑 g',
    ]);
});

test('the phases stick to the bottom of a docked board', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    const boxes = await ui.findAll({ type: 'Box' });
    const gap = boxes.findIndex((b) => b.key === 'phases:gap');
    expect([
        boxes[0]?.props.minHeight,
        boxes[gap]?.props.flexGrow,
        boxes[gap + 1]?.key,
    ]).toEqual([40, 1, 'phases']);
});

test('a phase fades with its distance from now', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b', 'then: c'], op: 'plan' });
    expect(
        (await ui.findAll({ type: 'Text' }))
            .filter((t) => /^[🌕🌔🌓] (?!phases)/u.test(t.text ?? ''))
            .map((t) => [Boolean(t.props.bold), Boolean(t.props.dimColor)]),
    ).toEqual([
        [false, false],
        [false, false],
        [false, true],
    ]);
});

test('only the now lead word reads green', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    expect(
        (await ui.findAll({ type: 'Text' }))
            .filter((t) => t.text === 'now:' || t.text === 'next:')
            .map((t) => [t.text, Boolean(t.props.color)]),
    ).toEqual([
        ['now:', true],
        ['next:', false],
    ]);
});

test('a prompt that lands mid-turn reads a plan set this turn as 0 turns old', async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    await say($, 'a note mid-turn');
    expect((w.contexts.at(-1) ?? []).join('\n')).toMatch(
        /plan set 0 turns ago/,
    );
});

test('a plan untouched for three turns reads stale', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    for (let i = 0; i < 4; i++) {
        await endTurn($);
        await say($, 'more');
    }
    expect([
        (await ui.find({ text: /^🌔 phases/, type: 'Text' }))?.text,
        (w.contexts.at(-1) ?? []).join('\n'),
    ]).toEqual([
        expect.stringContaining('stale'),
        expect.stringMatching(/plan set 3 turns ago, stale/),
    ]);
});

test("orbit's open asks reach the shared store the board counts from", async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'go');
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await orbit($, { ids: ['o1'], op: 'resolve' });
    expect((w.store.get(`asks:${SID}`) as { asks: string[] }).asks).toEqual([
        'trash the probe',
    ]);
});

test("🔊 sends the ask's text to speak's control socket", async ($, on) => {
    world(on);
    const runs: string[][] = [];
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: '{"ok":true}',
            },
        };
    });
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.press({ key: 'orbit:read:o1' });
    const sent = runs.find((argv) =>
        argv.includes('/home/.local/share/x-speak/control.sock'),
    );
    expect(JSON.parse(sent?.[4] ?? '{}')).toEqual({
        op: 'read',
        text: 'name a bird. pelican',
    });
});

test('🔊 on an assumption reads its text aloud', async ($, on) => {
    world(on);
    const runs: string[][] = [];
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: '{"ok":true}',
            },
        };
    });
    await start($);
    const ui = await board($);
    await orbit($, { op: 'assume', texts: ['moons repeat past five'] });
    await ui.press({ key: 'orbit:read:a1' });
    const sent = runs.find((argv) =>
        argv.includes('/home/.local/share/x-speak/control.sock'),
    );
    expect(JSON.parse(sent?.[4] ?? '{}')).toEqual({
        op: 'read',
        text: 'moons repeat past five',
    });
});

test("orbit's asks survive a reload", async ($, on) => {
    const w = world(on);
    const kept = {
        asks: [{ id: 'o3', pick: 'yes', text: 'kept across a reload' }],
        next: 4,
        turns: 2,
    };
    // a reload: the engine keeps $.state, and session.start runs again in a fresh module
    const state: Record<string, unknown> = { orbit: kept };
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    await start($);
    await say($, 'hi');
    expect((w.contexts.at(-1) ?? []).join('\n')).toContain('(o3)');
});

test("a turn that ends before a reloaded module's start keeps orbit", async ($, on) => {
    world(on);
    const kept = {
        asks: [{ id: 'o3', pick: 'yes', text: 'kept across a reload' }],
        next: 4,
        turns: 2,
    };
    const state: Record<string, unknown> = { orbit: kept };
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    // the reload lands at the turn's end: turn.complete reaches the fresh module before its session.start
    await endTurn($);
    expect(
        (state.orbit as { asks: { id: string }[] }).asks.map((a) => a.id),
    ).toEqual(['o3']);
});

test("a tool call before a mid-turn reload's start still stamps the running turn", async ($, on) => {
    world(on);
    const state: Record<string, unknown> = {
        orbit: {
            asks: [],
            assumed: ['a1', 'a2', 'a3'].map((id) => ({ at: 2, id, text: id })),
            next: 1,
            turns: 2,
        },
        turn: { isBusy: true, isPinged: false, isUserTurn: true },
    };
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    const r = await orbit($, { op: 'assume', texts: ['one more'] });
    expect((r as { deny?: string }).deny).toBeUndefined();
});

test("an ask's pick is drawn bold", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes, after ci']);
    // the pick is its own nested Text; ui.find would return the line around it first
    expect(
        (await ui.findAll({ type: 'Text' })).find(
            (n) => n.text === 'yes, after ci',
        )?.props.bold,
    ).toBe(true);
});

test('an ask answered this turn leads its line with 👀 until the turn ends', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'go');
    await orbit($, { ids: ['o1'], op: 'resolve' });
    const row = await ui.find({ key: 'orbit:ask:o1', type: 'Box' });
    expect(row?.text?.startsWith('👀 o1:')).toBe(true);
});

test("a plan line's lead word prints bold", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, {
        lines: ['now: the slim row', 'no lead here'],
        op: 'plan',
    });
    const bold = (await ui.findAll({ type: 'Text' }))
        .filter((n) => n.props.bold)
        .map((n) => n.text);
    expect([bold.includes('now:'), bold.includes('no lead here')]).toEqual([
        true,
        false,
    ]);
});

const mobile = ($: Engine, args = '') =>
    $.skill.prompt({
        skill: 'x:mobile-mode',
        text: `# mobile-mode${args ? `\n\nARGUMENTS: ${args}` : ''}`,
    });

const lastContext = (contexts: string[][]) =>
    (contexts.at(-1) ?? []).join('\n');

test('after /mobile-mode the next prompt asks for the asks fence with the ids', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await say($, 'hi');
    expect(lastContext(w.contexts)).toMatch(/asks fence.*\(o1\)/s);
});

test('/mobile-mode off brings the orbit reminder back', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await mobile($, 'off');
    await say($, 'hi');
    expect(lastContext(w.contexts)).not.toContain('asks fence');
});

test('«back at the mac» ends mobile mode', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await say($, 'ok, back at the mac');
    await endTurn($);
    await say($, 'hi');
    expect(lastContext(w.contexts)).not.toContain('asks fence');
});

test('a 🛎️ press in orbit ends mobile mode', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'hi');
    expect(lastContext(w.contexts)).not.toContain('asks fence');
});

test('a speak press keeps mobile mode on', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await ui.press({ key: 'orbit:stop:o1' });
    await say($, 'hi');
    expect(lastContext(w.contexts)).toContain('asks fence');
});

test('a typed note keeps mobile mode on', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await ui.input({ key: 'orbit:note:o1', text: 'after ci' });
    await say($, 'hi');
    expect(lastContext(w.contexts)).toContain('asks fence');
});

test('mobile mode survives a reload', async ($, on) => {
    const w = world(on);
    const state: Record<string, unknown> = {
        mobile: true,
        orbit: {
            asks: [{ id: 'o3', pick: 'yes', text: 'kept' }],
            next: 4,
            turns: 2,
        },
    };
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    await start($);
    await say($, 'hi');
    expect(lastContext(w.contexts)).toMatch(/asks fence.*\(o3\)/s);
});

const long = 'x'.repeat(91);

test('an ask text over 90 chars is refused with its length', async ($, on) => {
    world(on);
    await start($);
    const r = await add($, [long, 'yes']);
    expect((r as { deny?: string }).deny).toMatch(/91 chars; keep it ≤90/);
});

test('a follow text over 90 chars is refused', async ($, on) => {
    world(on);
    await start($);
    await add($, ['short', 'yes']);
    const r = await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'yes',
        text: long,
    });
    expect((r as { deny?: string }).deny).toMatch(/orbit follow: .*91 chars/);
});

test('a phase line over 90 chars is refused', async ($, on) => {
    world(on);
    await start($);
    const r = await orbit($, { lines: ['now: short', long], op: 'plan' });
    expect((r as { deny?: string }).deny).toMatch(/orbit plan: .*91 chars/);
});

test('an ask text of exactly 90 chars is taken', async ($, on) => {
    world(on);
    await start($);
    const r = await add($, ['x'.repeat(90), 'yes']);
    expect((r as { deny?: string }).deny).toBe(undefined);
});

const hrefs = async (ui: {
    findAll: (q: {
        type: string;
    }) => Promise<{ props: Record<string, unknown> }[]>;
}) => (await ui.findAll({ type: 'Link' })).map((n) => n.props.href);

test('a ticket id in an ask opens its linear page', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['close FRM-381 after the verifier', 'yes']);
    expect(await hrefs(ui)).toContain('https://linear.app/x-com/issue/FRM-381');
});

test('a ticket id in a phase line opens its linear page', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: build BYT-12'], op: 'plan' });
    expect(await hrefs(ui)).toContain('https://linear.app/x-com/issue/BYT-12');
});

// x answers ticket reads for FRM-381; down, it fails
const linear = (on: On, isDown = false) => {
    const runs: string[][] = [];
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        return {
            value: {
                exitCode: isDown ? 1 : 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: JSON.stringify({
                    data: {
                        tickets: [
                            {
                                id: 'FRM-381',
                                state: 'Done',
                                title: 'stash: orbit',
                                url: 'https://linear.app/x-com/issue/FRM-381/stash-orbit',
                            },
                        ],
                    },
                }),
            },
        };
    });
    return runs;
};

test('a prompt naming a ticket hands the session its title, state and link', async ($, on) => {
    const w = world(on);
    linear(on);
    await start($);
    await say($, 'look at FRM-381 again');
    expect((w.contexts.at(-1) ?? []).join('\n')).toContain(
        'FRM-381: stash: orbit · Done · https://linear.app/x-com/issue/FRM-381/stash-orbit',
    );
});

test('a peer prompt naming a ticket looks nothing up', async ($, on) => {
    world(on);
    const runs = linear(on);
    await start($);
    await say($, 'status of FRM-381?', 'peer-send-message' as never);
    expect(runs.filter((r) => r.includes('linear'))).toEqual([]);
});

test('with x down a prompt carries no ticket line', async ($, on) => {
    const w = world(on);
    linear(on, true);
    await start($);
    await say($, 'look at FRM-381 again');
    expect((w.contexts.at(-1) ?? []).join('\n')).not.toContain(
        'read from linear',
    );
});

const assume = ($: Engine, ...texts: string[]) =>
    orbit($, { op: 'assume', texts });

test('an assumption shows under «assumed» below the asks', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await assume($, 'kept the old port, 7373');
    expect([
        (await ui.find({ text: 'assumed', type: 'Text' }))?.text,
        (await ui.find({ key: 'orbit:assumption:a1', type: 'Box' }))?.text,
    ]).toEqual([
        'assumed',
        expect.stringContaining('a1: kept the old port, 7373'),
    ]);
});

test('a fourth assumption in one turn is refused', async ($, on) => {
    world(on);
    await start($);
    await say($, 'go');
    await assume($, 'one', 'two', 'three');
    const r = await assume($, 'four');
    expect((r as { deny?: string }).deny).toMatch(
        /at most 3 a turn, 3 already/,
    );
});

test('🛎️ clears an assumption', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await assume($, 'kept the old port');
    await ui.press({ key: 'orbit:right:a1' });
    expect(await ui.find({ key: 'orbit:assumption:a1', type: 'Box' })).toBe(
        undefined,
    );
});

test('↩️ with a note joins the next prompt as a wrong assumption', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await assume($, 'kept the old port');
    await ui.press({ key: 'orbit:wrong:a1' });
    await ui.input({ key: 'orbit:anote:a1', kind: 'change', text: 'use 7374' });
    await say($, 'next');
    expect((w.contexts.at(-1) ?? []).join('\n')).toContain(
        '- a1 wrong assumption: kept the old port · his note: «use 7374»',
    );
});

test('an unmarked assumption leaves after three turns', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await say($, 'go');
    await assume($, 'kept the old port');
    for (let i = 0; i < 3; i++) {
        await endTurn($);
        await say($, 'more');
    }
    expect(await ui.find({ key: 'orbit:assumption:a1', type: 'Box' })).toBe(
        undefined,
    );
});

test('an assumption still shows two turns on', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await say($, 'go');
    await assume($, 'kept the old port');
    for (let i = 0; i < 2; i++) {
        await endTurn($);
        await say($, 'more');
    }
    expect(await ui.find({ key: 'orbit:assumption:a1', type: 'Box' })).not.toBe(
        undefined,
    );
});

test('a plan of fewer than 7 lines is set with a nudge to fill it', async ($, on) => {
    world(on);
    await start($);
    const r = await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    expect((r as { result?: unknown }).result).toBe(
        'plan set, 2 lines — plan has 2 of 7, fill to 7',
    );
});

test('a full plan of 7 lines is set with no nudge', async ($, on) => {
    world(on);
    await start($);
    const r = await orbit($, {
        lines: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        op: 'plan',
    });
    expect((r as { result?: unknown }).result).toBe('plan set, 7 lines');
});

// the 🎛️ board parts (FRM-391 batch 3): each drawn by default, gone when its switch is off
const BOARD_PARTS: [string, (ui: Board) => Promise<boolean>][] = [
    [
        'stash.orbit',
        async (ui) =>
            (await ui.find({ key: 'orbit', type: 'Box' })) !== undefined,
    ],
    [
        'stash.assumed',
        async (ui) =>
            (await ui.find({ key: 'orbit:assumed', type: 'Box' })) !==
            undefined,
    ],
    [
        'stash.phases',
        async (ui) =>
            (await ui.find({ key: 'phases', type: 'Box' })) !== undefined,
    ],
    [
        'stash.speak',
        async (ui) =>
            (await ui.find({ key: 'orbit:read:o1', type: 'Button' })) !==
            undefined,
    ],
];
for (const [part, drawn] of BOARD_PARTS)
    test(`the ${part} switch hides its part of the board`, async ($, on) => {
        world(on).store.set('shown', { [part]: false });
        await start($);
        const ui = await board($);
        await add($, ['push FRM-1', 'yes']);
        await orbit($, { op: 'assume', texts: ['moons repeat'] });
        await orbit($, { lines: ['now: a'], op: 'plan' });
        expect(await drawn(ui)).toBe(false);
    });
for (const [part, drawn] of BOARD_PARTS)
    test(`the ${part} part draws while its switch is on`, async ($, on) => {
        world(on);
        await start($);
        const ui = await board($);
        await add($, ['push FRM-1', 'yes']);
        await orbit($, { op: 'assume', texts: ['moons repeat'] });
        await orbit($, { lines: ['now: a'], op: 'plan' });
        expect(await drawn(ui)).toBe(true);
    });

// 📁 folds a card to its head row and back (dima's o5)
for (const [card, body] of [
    ['orbit', { key: 'orbit:ask:o1' }],
    ['phases', { text: '🌕 now: a', type: 'Text' as const }],
] as const)
    test(`📁 folds the ${card} card to its head and a second press opens it`, async ($, on) => {
        world(on);
        await start($);
        const ui = await board($);
        await add($, ['push FRM-1', 'yes']);
        await orbit($, { lines: ['now: a'], op: 'plan' });
        const drawn = async () => (await ui.find(body)) !== undefined;
        const open = await drawn();
        await ui.press({ key: `fold:${card}` });
        const folded = await drawn();
        await ui.press({ key: `fold:${card}` });
        expect([open, folded, await drawn()]).toEqual([true, false, true]);
    });

test("orbit's head ends ✅ then 📁, at the far right", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    const head = (await ui.findAll({ type: 'Button' }))
        .map((b) => b.key)
        .filter((k) => k === 'orbit:all' || k === 'fold:orbit');
    expect(head).toEqual(['orbit:all', 'fold:orbit']);
});

test('the fold button reads 📂 while its card is open and 📁 while folded', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    const glyph = async () => (await ui.find({ key: 'fold:orbit' }))?.text;
    const open = await glyph();
    await ui.press({ key: 'fold:orbit' });
    expect([open, await glyph()]).toEqual(['📂', '📁']);
});

test('the phase lines knob caps a plan and its nudge', async ($, on) => {
    const w = world(on);
    w.store.set('phase-lines', 5);
    await start($);
    const ui = await board($);
    const result = await orbit($, {
        lines: ['now: a', 'next: b', 'then: c', 'd', 'e', 'f', 'g'],
        op: 'plan',
    });
    const lines = (await ui.findAll({ type: 'Text' }))
        .map((t) => t.text)
        .filter((t) => /^[🌕🌔🌓🌒🌑] (?!phases)/u.test(t ?? ''));
    expect([
        JSON.stringify(result).includes('plan set, 5 lines'),
        lines.length,
    ]).toEqual([true, 5]);
});

test('with read-aloud on assumptions off, an assumption draws no 🔊', async ($, on) => {
    const w = world(on);
    w.store.set('speak-assumed', false);
    await start($);
    const ui = await board($);
    await orbit($, { op: 'assume', texts: ['moons repeat'] });
    expect(await ui.find({ key: 'orbit:read:a1' })).toBe(undefined);
});

// o112: the board's phases are gone on mobile, so the reminder asks for the plan's next 3 moves under the fence
test('on mobile the reminder asks for «🌔 next:» and the next 3 moves', async ($, on) => {
    const w = world(on);
    await start($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    await mobile($);
    await say($, 'hi');
    expect(lastContext(w.contexts)).toMatch(/🌔 next:.*next 3 moves/s);
});

test('on mobile a stale plan is still named', async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    for (let i = 0; i < 4; i++) {
        await endTurn($);
        await say($, 'more');
    }
    await mobile($);
    await say($, 'hi');
    expect(lastContext(w.contexts)).toMatch(/plan is stale/);
});
