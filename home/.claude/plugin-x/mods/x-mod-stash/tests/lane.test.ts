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
    const texts: string[] = [];
    files[`/home/.claude/sessions/${PID}.json`] = JSON.stringify({
        name,
        pid: PID,
    });
    const clock = mock.clock(on, {
        now: new Date(2026, 9, 11, 18, 30).getTime(),
    });
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
        texts.push(e.text);
        return { text: e.text };
    });
    on('turn.complete', () => ({ text: '' }));
    on('classic.Stop', () => ({}));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    return { clock, contexts, files, store, texts };
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
// dima's note on lane l1 as the board keeps it
const noteOf = (w: { store: Map<string, unknown> }) =>
    w.store.get('lane-note:l1') as
        | { note?: string; isTaken?: boolean }
        | undefined;
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
        /🛼 mods settings.*✅ shape the settings pane.*➡️ the board in cards.*⬜ guard rules/su,
    );
});

test("any session's board draws the lane cclio wrote", async ($, on) => {
    world(on, { files: shelf(keptLane()), name: '☕️ 🔧 coder' });
    await start($);
    expect(await laneText(await board($))).toMatch(/🛼 kept.*➡️ a/su);
});

test('the current step reads ➡️, no «we are here» (dima, 20:46)', async ($, on) => {
    world(on, { files: shelf(keptLane()) });
    await start($);
    const text = await laneText(await board($));
    expect([text?.includes('➡️ a'), text?.includes('we are here')]).toEqual([
        true,
        false,
    ]);
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

const note = async (ui: Board, text: string) =>
    ui.input({ key: 'lane:l1:note', kind: 'change', text });
const take = (ui: Board) => ui.press({ key: 'lane:l1:take' });

test("one note box and one take, on the current step only; a taken note joins dima's next prompt once", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await lane($, { act: 'step', current: 1, id: 'l1' });
    const boxes = (await ui.findAll({ type: 'Input' })).filter((n) =>
        n.key?.startsWith('lane:'),
    ).length;
    await note(ui, 'cards first');
    await take(ui);
    await say($, 'go');
    await say($, 'again');
    expect([
        boxes,
        w.contexts.at(-2)?.some((c) => c.includes('«cards first»')),
        w.contexts.at(-1)?.some((c) => c.includes('«cards first»')),
    ]).toEqual([1, true, false]);
});

test('a note never sent with take stays a draft (dima, 20:51)', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await note(ui, 'cards first');
    await say($, 'go');
    expect([
        w.contexts.at(-1)?.some((c) => c.includes('cards first')),
        noteOf(w)?.note,
    ]).toEqual([false, 'cards first']);
});

test("a peer's prompt never carries a taken note (dima, 20:51: only via send prompt)", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await note(ui, 'cards first');
    await take(ui);
    await $.prompt.submit({
        origin: { kind: 'peer' },
        text: 'a ping',
        wait: false,
    } as never);
    expect(w.contexts.at(-1)?.some((c) => c.includes('cards first'))).toBe(
        false,
    );
});

test("a note taken while cclio's turn runs joins it at her next tool call", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($);
    await say($, 'go');
    await note(ui, 'stop and look');
    await take(ui);
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    const again = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    expect([
        r.context?.some((c) => c.includes('«stop and look»')),
        again.context?.some((c) => c.includes('stop and look')) ?? false,
    ]).toEqual([true, false]);
});

test("a member's board takes a note that reaches cclio, never the member's own prompt", async ($, on) => {
    const w = world(on, { files: shelf(keptLane()), name: '☕️ 🔧 coder' });
    await start($);
    const ui = await board($);
    await note(ui, 'slow down');
    await take(ui);
    await say($, 'go');
    expect([
        noteOf(w)?.note,
        noteOf(w)?.isTaken,
        w.contexts.at(-1)?.some((c) => c.includes('slow down')),
        // only cclio's lane op writes the shelf file
        kept(w)[0]?.note,
    ]).toEqual(['slow down', true, false, undefined]);
});

test('a note on a step leaves when cclio moves the lane past it', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await note(ui, 'cards first');
    await lane($, { act: 'step', current: 1, id: 'l1' });
    expect(noteOf(w)).toBe(undefined);
});

test('a taken note clears from the box once cclio took it', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($);
    await note(ui, 'cards first');
    await take(ui);
    const typed = (await ui.find({ key: 'lane:l1:note', type: 'Input' }))?.props
        .value;
    await say($, 'go');
    expect([
        typed,
        (await ui.find({ key: 'lane:l1:note', type: 'Input' }))?.props.value,
        (await ui.find({ key: 'lane:l1:take', type: 'Button' }))?.text,
    ]).toEqual(['cards first', '', '🛎️ take']);
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
        expect.stringMatching(/✅ a.*➡️ b/su),
        expect.stringMatching(/✅ a.*✅ b.*➡️ c/su),
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
    expect(await laneText(await board($))).toMatch(/🛼 kept.*✅ a.*➡️ b/su);
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

/* exit 3 — the members' asks on the card */

const CODER = 'c0c0c0c0-coder';
const VERIFIER = 'v0v0v0v0-verifier';
const linked = () =>
    shelf(keptLane({ members: { coder: CODER, verifier: VERIFIER } }));
const published = (
    w: ReturnType<typeof world>,
    sid: string,
    items: Record<string, unknown>[],
) =>
    w.store.set(`asks:${sid}`, {
        asks: items.map((a) => a.text),
        at: 1,
        items,
        label: 'frame',
    });
const ASK = { id: 'o3', pick: 'cut it', text: 'cut the second probe?' };
const subText = async (ui: Board, role: string) =>
    (await ui.find({ key: `lane:l1:${role}`, type: 'Box' }))?.text;

test('a coder subcard sits above a verifier subcard, each folded to its count', async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODER, [ASK, { ...ASK, id: 'o4' }]);
    published(w, VERIFIER, [ASK]);
    await start($);
    const text = await laneText(await board($));
    expect([
        text?.indexOf('🔧 coder · 2 asks'),
        text?.includes('cut the second probe'),
    ]).toEqual([expect.any(Number), false]);
    expect(
        (text?.indexOf('🔧 coder · 2 asks') ?? -1) <
            (text?.indexOf('🔎 verifier · 1 ask') ?? -1),
    ).toBe(true);
});

test("unfolded, a subcard's rows are the member's own asks", async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODER, [ASK]);
    await start($);
    const ui = await board($);
    await ui.press({ key: 'fold:lane:l1:coder' });
    expect(await subText(ui, 'coder')).toMatch(
        /o3: cut the second probe\?.*➡️ cut it.*take.*redo/su,
    );
});

test("a take on the card waits in the store for the member's own stash", async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODER, [ASK]);
    await start($);
    const ui = await board($);
    await ui.press({ key: 'fold:lane:l1:coder' });
    await ui.press({ key: 'lane:l1:coder:accepted:o3' });
    expect([
        (w.store.get(`marks:${CODER}:o3`) as { mark?: string })?.mark,
        await subText(ui, 'coder'),
    ]).toEqual(['accepted', expect.stringContaining('✅ take')]);
});

async function memberWithAsk($: Engine, on: On) {
    const w = world(on, { name: '☕️ 🔧 coder' });
    await start($);
    await $.tool.call({
        asks: [{ pick: 'cut it', text: 'cut the second probe?' }],
        op: 'add',
        tool: TOOL,
    } as never);
    await endTurn($);
    return w;
}

test('a member publishes its open asks whole, with ids, for the lane card', async ($, on) => {
    const w = await memberWithAsk($, on);
    expect(
        (w.store.get(`asks:${SID}`) as { items?: unknown[] })?.items,
    ).toEqual([{ id: 'o1', pick: 'cut it', text: 'cut the second probe?' }]);
});

test("a mark from a lane card joins the member's running turn", async ($, on) => {
    const w = await memberWithAsk($, on);
    await say($, 'go on');
    w.store.set(`marks:${SID}:o1`, { at: w.clock.now(), mark: 'accepted' });
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    expect(
        r.context?.some((c) => /o1 🛎️ accepted: cut the second probe/.test(c)),
    ).toBe(true);
});

test('an idle member with marks wakes once, after dima prompts anywhere', async ($, on) => {
    const w = await memberWithAsk($, on);
    const before = w.texts.length;
    w.store.set(`marks:${SID}:o1`, {
        at: w.clock.now(),
        mark: 'rejected',
        note: 'later',
    });
    await w.clock.advance(5_000);
    const quiet = w.texts.length;
    w.store.set('dima-at', w.clock.now() + 1);
    await w.clock.advance(5_000);
    await w.clock.advance(5_000);
    const woke = w.texts.slice(before);
    expect([quiet - before, woke.length, woke[0]]).toEqual([
        0,
        1,
        expect.stringMatching(/o1 ↩️ rejected: cut the second probe.*«later»/su),
    ]);
});

test("dima's own prompt records when he last prompted, for the members to read", async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'go');
    expect(w.store.get('dima-at')).toBe(w.clock.now());
});

test("the lanes stick to the board's bottom, on top of the phases (dima, 20:12)", async ($, on) => {
    world(on, { files: shelf(keptLane()) });
    await start($);
    await $.tool.call({ lines: ['now: x'], op: 'plan', tool: TOOL } as never);
    const keys = (await (await board($)).findAll({ type: 'Box' })).map(
        (b) => b.key ?? '',
    );
    const at = (key: string) => keys.indexOf(key);
    expect([
        at('phases:gap') < at('lane:l1'),
        at('lane:l1') < at('phases'),
    ]).toEqual([true, true]);
});

/* an ask: its line, the pick on its own line, the buttons under it (dima, 20:23) */

test("an ask's buttons sit on the line under its pick, never beside it", async ($, on) => {
    world(on);
    await start($);
    await $.tool.call({
        asks: [{ pick: 'cut it', text: 'cut the second probe?' }],
        op: 'add',
        tool: TOOL,
    } as never);
    const row = (
        await (await board($)).find({ key: 'orbit:row:o1', type: 'Box' })
    )?.text;
    expect([row?.includes('take'), row?.includes('cut it')]).toEqual([
        true,
        false,
    ]);
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
    isNoteTaken?: boolean;
    history: { act: string; at: number; current: number; done: number }[];
    endedAt?: number;
}
