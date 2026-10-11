import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// 🛼 lanes (FRM-385): the fleet's lanes in one shelf file, written only by 🦉 cclio, drawn on every board
const SID = 'l1l1l1l1-lane';
const TOOL = 'mcp__x-mod-stash__orbit';
const FILE = '/home/.claude/shelf/lanes.json';
const PID = 4242;
const CCLIO = '🦉 cclio';

function world(
    on: On,
    {
        files = {},
        name = CCLIO,
    }: { files?: Record<string, string>; name?: string } = {},
) {
    const contexts: string[][] = [];
    files[`/home/.claude/sessions/${PID}.json`] = JSON.stringify({
        name,
        pid: PID,
    });
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
    on('process.run', () => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: `${PID}\nSat Oct 11 18:00:00 2026\n`,
        },
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
const create = ($: Engine, input: Record<string, unknown> = {}) =>
    lane($, { act: 'create', items: ITEMS, title: 'mods settings', ...input });
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
const laneText = async (ui: Board, id = 'l1') =>
    (await ui.find({ key: `lane:${id}`, type: 'Box' }))?.text;
const denied = async ($: Engine, input: Record<string, unknown>) =>
    (await lane($, input)).deny;
const kept = (w: ReturnType<typeof world>) =>
    (JSON.parse(w.files[FILE] ?? '{"lanes":[]}') as { lanes: KeptLane[] })
        .lanes;
const shelf = (...lanes: KeptLane[]) => ({ [FILE]: JSON.stringify({ lanes }) });
const keptLane = (over: Partial<KeptLane> = {}): KeptLane => ({
    current: 0,
    history: [],
    id: 'l1',
    items: [
        { isDone: false, text: 'a' },
        { isDone: false, text: 'b' },
    ],
    members: {},
    movedAt: 0,
    title: 'kept',
    ...over,
});

/* exit 1 — the ops and the file */

test('a create lands in the shelf file with its history', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await create($);
    expect([
        r.deny,
        kept(w).map((l) => [l.id, l.title, l.history.length]),
    ]).toEqual([undefined, [['l1', 'mods settings', 1]]]);
});

for (const [why, input] of [
    ['a 6th step', { act: 'create', items: [...ITEMS, ...ITEMS], title: 'x' }],
    ['an empty list', { act: 'create', items: [], title: 'x' }],
    [
        'a step over 60 chars',
        { act: 'create', items: [{ text: 'x'.repeat(61) }], title: 'x' },
    ],
    ['an unknown lane id', { act: 'step', current: 1, id: 'l9' }],
    ['a step out of range', { act: 'step', current: 4, id: 'l1' }],
] as const)
    test(`${why} is refused with a one-line reason`, async ($, on) => {
        world(on, { files: shelf(keptLane()) });
        await start($);
        expect(await denied($, input)).toMatch(/^orbit lane: [^\n]+$/);
    });

test('a session the registry does not name 🦉 cclio is refused', async ($, on) => {
    const w = world(on, { name: '☕️ 🔧 coder' });
    await start($);
    expect([(await create($)).deny, w.files[FILE]]).toEqual([
        'orbit lane: only 🦉 cclio writes the lanes; every board shows them',
        undefined,
    ]);
});

test('a new cclio after a handoff steps and ends a lane it did not create', async ($, on) => {
    const w = world(on, { files: shelf(keptLane()) });
    await start($);
    await lane($, { act: 'step', current: 1, id: 'l1' });
    await lane($, { act: 'end', id: 'l1' });
    const [l] = kept(w);
    expect([l?.current, typeof l?.endedAt]).toEqual([1, 'number']);
});

test('a second link of a role replaces the first', async ($, on) => {
    const w = world(on);
    await start($);
    await create($);
    await lane($, {
        act: 'link',
        id: 'l1',
        role: 'coder',
        session: 'old-coder',
    });
    await lane($, {
        act: 'link',
        id: 'l1',
        role: 'coder',
        session: 'new-coder',
    });
    await lane($, { act: 'link', id: 'l1', role: 'verifier', session: 'v' });
    expect(kept(w)[0]?.members).toEqual({ coder: 'new-coder', verifier: 'v' });
});

test('two lanes live at once both persist', async ($, on) => {
    const w = world(on);
    await start($);
    await create($, { title: 'mods' });
    await create($, { title: 'cli' });
    await lane($, { act: 'step', current: 1, id: 'l1' });
    expect(kept(w).map((l) => [l.id, l.title, l.current])).toEqual([
        ['l1', 'mods', 1],
        ['l2', 'cli', 0],
    ]);
});

test('every pointer move lands in the history with its time', async ($, on) => {
    const w = world(on);
    await start($);
    await create($);
    await lane($, { act: 'step', current: 0, id: 'l1' });
    await lane($, { act: 'step', current: 1, id: 'l1' });
    expect(
        kept(w)[0]?.history.map((h) => [h.act, h.current, typeof h.at]),
    ).toEqual([
        ['create', 0, 'number'],
        ['step', 1, 'number'],
    ]);
});

/* exit 2 — the card on every board */

test('a card lists every step in order, done ones kept, the current marked', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($);
    await lane($, { act: 'step', current: 1, id: 'l1' });
    expect(await laneText(ui)).toMatch(
        /🛼 mods settings.*✅ shape the settings pane.*🛼 the board in cards.*← we are here.*⬜ guard rules/su,
    );
});

test("any session's board draws the lane cclio wrote", async ($, on) => {
    world(on, { files: shelf(keptLane()), name: '☕️ 🔧 coder' });
    await start($);
    expect(await laneText(await board($))).toMatch(
        /🛼 kept.*🛼 a.*← we are here/su,
    );
});

test('a ticket step links to linear', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($);
    expect((await ui.find({ text: 'FRM-391', type: 'Link' }))?.props.href).toBe(
        'https://linear.app/x-com/issue/FRM-391',
    );
});

test("one note box, on the current step only, joins cclio's next prompt once", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await lane($, { act: 'step', current: 1, id: 'l1' });
    const boxes = (await ui.findAll({ type: 'Input' })).filter((n) =>
        n.key?.startsWith('lane:'),
    ).length;
    await ui.input({
        key: 'lane:l1:note',
        kind: 'change',
        text: 'cards first',
    });
    await say($, 'go');
    await say($, 'again');
    expect([
        boxes,
        w.contexts.at(-2)?.some((c) => c.includes('«cards first»')),
        w.contexts.at(-1)?.some((c) => c.includes('«cards first»')),
    ]).toEqual([1, true, false]);
});

test("a member's board takes a note that reaches cclio, never the member's own prompt", async ($, on) => {
    const w = world(on, { files: shelf(keptLane()), name: '☕️ 🔧 coder' });
    await start($);
    const ui = await board($);
    await ui.input({ key: 'lane:l1:note', kind: 'change', text: 'slow down' });
    await say($, 'go');
    expect([
        kept(w)[0]?.note,
        w.contexts.at(-1)?.some((c) => c.includes('slow down')),
    ]).toEqual(['slow down', false]);
});

test('a step past an item marks it done, never leaving the pointer on a done one', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($, {
        items: [{ done: true, text: 'a' }, { text: 'b' }, { text: 'c' }],
        title: 't',
    });
    const first = await laneText(ui);
    await lane($, { act: 'step', current: 2, id: 'l1' });
    expect([first, await laneText(ui)]).toEqual([
        expect.stringMatching(/✅ a.*🛼 b.*← we are here/su),
        expect.stringMatching(/✅ a.*✅ b.*🛼 c/su),
    ]);
});

test('a lane reads back whole from the shelf file at a fresh start', async ($, on) => {
    world(on, {
        files: shelf(
            keptLane({
                current: 1,
                items: [
                    { isDone: true, text: 'a' },
                    { isDone: false, text: 'b' },
                ],
            }),
        ),
    });
    await start($);
    expect(await laneText(await board($))).toMatch(/🛼 kept.*✅ a.*🛼 b/su);
});

test("a finished lane stays, all done, across turn ends until the end call (dima's o57)", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($);
    await lane($, { act: 'step', current: 3, id: 'l1' });
    for (let i = 0; i < 4; i++) await endTurn($);
    const finished = await laneText(ui);
    await lane($, { act: 'end', id: 'l1' });
    expect([finished, await laneText(ui)]).toEqual([
        expect.stringMatching(/✅ shape.*✅ the board.*✅ guard rules/su),
        undefined,
    ]);
});

test('an ended lane never comes back at a fresh start', async ($, on) => {
    world(on, { files: shelf(keptLane({ endedAt: 1, title: 'gone' })) });
    await start($);
    expect(await laneText(await board($))).toBe(undefined);
});

test("nothing of a lane enters a member's model context", async ($, on) => {
    const w = world(on, {
        files: shelf(keptLane({ note: 'n' })),
        name: '☕️ 🔧 coder',
    });
    await start($);
    for (let i = 0; i < 9; i++) await endTurn($);
    await say($, 'go');
    expect(w.contexts.at(-1)?.some((c) => /lane|kept/.test(c))).toBe(false);
});

test('the 🛼 lane switch hides every lane card', async ($, on) => {
    const w = world(on, { files: shelf(keptLane()) });
    w.store.set('shown', { 'stash.lane': false });
    await start($);
    expect(await laneText(await board($))).toBe(undefined);
});

/* exit 5 — the stale nag, cclio's turns only */

test("a lane that moved nothing for 8 of cclio's turns reads stale; a step that moves nothing keeps the count", async ($, on) => {
    const w = world(on);
    await start($);
    await create($, { title: 't' });
    for (let i = 0; i < 8; i++) {
        await endTurn($);
        await lane($, { act: 'step', current: 0, id: 'l1' });
    }
    await say($, 'go');
    expect(w.contexts.at(-1)?.some((c) => /lane l1 «t».*stale/.test(c))).toBe(
        true,
    );
});

test('with no lane the reminder carries no lane text', async ($, on) => {
    const w = world(on);
    await start($);
    for (let i = 0; i < 9; i++) await endTurn($);
    await say($, 'go');
    expect(w.contexts.at(-1)?.some((c) => c.includes('lane'))).toBe(false);
});

/* Types */

interface KeptLane {
    id: string;
    title: string;
    items: { isDone: boolean; text: string; ticket?: string }[];
    current: number;
    movedAt: number;
    members: Record<string, string>;
    note?: string;
    history: { act: string; at: number; current: number; done: number }[];
    endedAt?: number;
}
