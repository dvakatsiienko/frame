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
    await add($, ['push FRM-1 to main', 'yes, now']);
    expect(
        (await ui.find({ key: 'orbit:ask:o1', type: 'Box' }))?.text,
    ).toContain('push FRM-1 to main ➡️ yes, now');
});

test('a ticked ask joins the next prompt as model-only context', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await ui.press({ key: 'orbit:accepted:o2' });
    await say($, 'go on');
    expect(joined(w.contexts).join('\n')).toMatch(
        /o2 🤩 accepted: trash the probe \(your pick: yes\)/,
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
        /o1 👎🏼 rejected: push FRM-1 \(your pick: yes\) · his note: «wait for ci» · your note: «came from push FRM-1»/,
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
            .match(/o\d 🤩/g),
    ).toEqual(['o1 🤩', 'o2 🤩']);
});

test("a peer's prompt carries no marked ask", async ($, on) => {
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
    expect(joined(w.contexts)).toEqual([]);
});

test('a joined ask draws no control while the turn runs', async ($, on) => {
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
    ]).toEqual([['orbit:read:o1'], expect.stringContaining('«after ci»')]);
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

test('a pressed 🤩 is lit and a second press puts it out', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    const lit = (await ui.find({ key: 'orbit:accepted:o1' }))?.props.variant;
    await ui.press({ key: 'orbit:accepted:o1' });
    const out = (await ui.find({ key: 'orbit:accepted:o1' }))?.props.variant;
    expect([lit, out]).toEqual(['secondary', undefined]);
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

test('a follow-up keeps its id and place with new text and a changed mark', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await say($, 'go');
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'after ci',
        text: 'push FRM-1 once ci is green',
    });
    await endTurn($);
    expect([
        await asksShown(ui),
        (await ui.find({ key: 'orbit:ask:o1', type: 'Box' }))?.text,
    ]).toEqual([
        ['o1', 'o2'],
        expect.stringMatching(
            /push FRM-1 once ci is green ➡️ after ci.*changed/,
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
            /o1 🤩 accepted: name a bird \(your pick: pelican\)/,
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
    expect(joined(w.contexts).join('\n')).toContain('o1 🤩 accepted');
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

test('an empty orbit adds no reminder', async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'hi');
    expect((w.contexts.at(-1) ?? []).join('\n')).not.toContain('orbit');
});

test('the phases show in the board, a moon each, at most five', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, {
        lines: ['now: a', 'next: b', 'then: c', 'd', 'e', 'f'],
        op: 'plan',
    });
    expect(
        (await ui.findAll({ type: 'Text' }))
            .map((t) => t.text)
            .filter((t) => /^[🌕🌔🌓🌒🌑] (?!phases)/u.test(t ?? '')),
    ).toEqual(['🌕 now: a', '🌔 next: b', '🌓 then: c', '🌒 d', '🌑 e']);
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
        [true, false],
        [false, false],
        [false, true],
    ]);
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
        text: 'name a bird. pick: pelican',
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
