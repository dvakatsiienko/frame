import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// 🛼 lane (FRM-385): a running lane's whole scope on the board, kept in a file so a compaction or a restart reads it back
const SID = 'l1l1l1l1-lane';
const TOOL = 'mcp__x-mod-stash__orbit';
const FILE = `/home/.claude/shelf/lanes/${SID}.json`;

function world(on: On, files: Record<string, string> = {}) {
    const contexts: string[][] = [];
    mock.clock(on, { now: new Date(2026, 9, 11, 18, 30).getTime() });
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
    on('fs.read', (_$, e) =>
        e.path in files
            ? { value: files[e.path] ?? '' }
            : { deny: 'no such file' },
    );
    on('fs.write', (_$, e) => {
        files[e.path] = e.text;
        return { value: undefined };
    });
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('prompt.submit', (_$, e) => {
        contexts.push([...(e.context ?? [])]);
        return { text: e.text };
    });
    on('turn.complete', () => ({ text: '' }));
    on('classic.Stop', () => ({}));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    return { contexts, files, store };
}

const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });
const lane = ($: Engine, input: Record<string, unknown>) =>
    $.tool.call({ op: 'lane', tool: TOOL, ...input } as never);
const say = ($: Engine, text: string) =>
    $.prompt.submit({ origin: { kind: 'composer' }, text, wait: false });
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

const ITEMS = [
    { text: 'shape the settings pane' },
    { text: 'the board in cards', ticket: 'FRM-391' },
    { text: 'guard rules' },
];
const laneText = async (ui: Board) =>
    (await ui.find({ key: 'lane', type: 'Box' }))?.text;
const denied = async ($: Engine, input: Record<string, unknown>) =>
    (await lane($, input)).deny;

test('(a, b, c) a lane lists every item in order, done ones kept, the current marked', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await lane($, { current: 1, items: ITEMS, title: 'mods settings' });
    expect(await laneText(ui)).toMatch(
        /🛼 mods settings.*✅ shape the settings pane.*🛼 the board in cards.*← we are here.*⬜ guard rules/su,
    );
});

test('(d) a ticket item links to linear', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await lane($, { current: 0, items: ITEMS, title: 'mods settings' });
    expect((await ui.find({ text: 'FRM-391', type: 'Link' }))?.props.href).toBe(
        'https://linear.app/x-com/issue/FRM-391',
    );
});

test("(e) one note box, on the current item only, joins dima's next prompt once", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await lane($, { current: 1, items: ITEMS, title: 'mods settings' });
    const boxes = (await ui.findAll({ type: 'Input' })).filter((n) =>
        n.key?.startsWith('lane:'),
    ).length;
    await ui.input({ key: 'lane:note', kind: 'change', text: 'cards first' });
    await say($, 'go');
    await say($, 'again');
    expect([
        boxes,
        w.contexts.at(-2)?.some((c) => c.includes('«cards first»')),
        w.contexts.at(-1)?.some((c) => c.includes('«cards first»')),
    ]).toEqual([1, true, false]);
});

for (const [why, input] of [
    ['a 6th item', { current: 0, items: [...ITEMS, ...ITEMS], title: 'x' }],
    ['an empty list', { current: 0, items: [], title: 'x' }],
    ['an index out of range', { current: 3, items: ITEMS, title: 'x' }],
] as const)
    test(`(f) ${why} is refused with a one-line reason`, async ($, on) => {
        world(on);
        await start($);
        expect(await denied($, input)).toMatch(/^orbit lane: [^\n]+$/);
    });

test('(g) moving the index past an item marks it done, never leaving the pointer on a done one', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await lane($, {
        current: 0,
        items: [{ done: true, text: 'a' }, { text: 'b' }, { text: 'c' }],
        title: 't',
    });
    const first = await laneText(ui);
    await lane($, { current: 2, items: ITEMS.slice(0, 3), title: 't' });
    expect([first, await laneText(ui)]).toEqual([
        expect.stringMatching(/✅ a.*🛼 b.*← we are here/su),
        expect.stringMatching(/✅ shape.*✅ the board.*🛼 guard rules/su),
    ]);
});

test('(h) an item over 60 chars is refused', async ($, on) => {
    world(on);
    await start($);
    expect(
        await denied($, {
            current: 0,
            items: [{ text: 'x'.repeat(61) }],
            title: 't',
        }),
    ).toMatch(/61 chars; keep it ≤60/);
});

test('every pointer move lands in the lane file with its time', async ($, on) => {
    const w = world(on);
    await start($);
    await lane($, { current: 0, items: ITEMS, title: 't' });
    await lane($, { current: 0, items: ITEMS, title: 't' });
    await lane($, { current: 1, items: ITEMS, title: 't' });
    const kept = JSON.parse(w.files[FILE] ?? '{}');
    expect(kept.history.map((h: { current: number }) => h.current)).toEqual([
        0, 1,
    ]);
});

test('(2) a lane reads back whole from its file at a fresh start', async ($, on) => {
    world(on, {
        [FILE]: JSON.stringify({
            current: 1,
            history: [],
            items: [
                { isDone: true, text: 'a' },
                { isDone: false, text: 'b' },
            ],
            movedAt: 0,
            title: 'kept',
        }),
    });
    await start($);
    expect(await laneText(await board($))).toMatch(/🛼 kept.*✅ a.*🛼 b/su);
});

test('(2) a finished lane stays through the next turn end, then leaves and its file records the end', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await lane($, {
        current: 2,
        items: [...ITEMS.slice(0, 2), { done: true, text: 'last' }],
        title: 't',
    });
    await endTurn($);
    const after1 = await laneText(ui);
    await endTurn($);
    expect([
        after1 !== undefined,
        await laneText(ui),
        typeof JSON.parse(w.files[FILE] ?? '{}').endedAt,
    ]).toEqual([true, undefined, 'number']);
});

test('(2) a lane end call takes it off the board at once', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await lane($, { current: 0, items: ITEMS, title: 't' });
    await lane($, { end: true });
    expect(await laneText(ui)).toBe(undefined);
});

test('(2) an ended lane never comes back at a fresh start', async ($, on) => {
    world(on, {
        [FILE]: JSON.stringify({
            current: 0,
            endedAt: 1,
            history: [],
            items: [{ isDone: false, text: 'a' }],
            movedAt: 0,
            title: 'gone',
        }),
    });
    await start($);
    expect(await laneText(await board($))).toBe(undefined);
});

test('(3) a lane that moved nothing for 8 turns reads stale; a re-call that moves nothing keeps the count', async ($, on) => {
    const w = world(on);
    await start($);
    await lane($, { current: 0, items: ITEMS, title: 't' });
    for (let i = 0; i < 8; i++) {
        await endTurn($);
        await lane($, { current: 0, items: ITEMS, title: 't' });
    }
    await say($, 'go');
    expect(w.contexts.at(-1)?.some((c) => /lane «t».*stale/.test(c))).toBe(
        true,
    );
});

test('(3) with no lane set the reminder carries no lane text', async ($, on) => {
    const w = world(on);
    await start($);
    for (let i = 0; i < 9; i++) await endTurn($);
    await say($, 'go');
    expect(w.contexts.at(-1)?.some((c) => c.includes('lane'))).toBe(false);
});

test('(4c) the 🛼 lane switch hides the lane section', async ($, on) => {
    const w = world(on);
    w.store.set('shown', { 'stash.lane': false });
    await start($);
    const ui = await board($);
    await lane($, { current: 0, items: ITEMS, title: 't' });
    expect(await laneText(ui)).toBe(undefined);
});
