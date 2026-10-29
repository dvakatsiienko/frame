import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// 🛼 glide (FRM-385): the fleet's lanes in one shelf file, written only by 🦉 cclio, drawn on every board
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
        peers = [],
    }: {
        files?: Record<string, string>;
        name?: string;
        // other live sessions in the registry, as cc writes their files
        peers?: Record<string, unknown>[];
    } = {},
) {
    const contexts: string[][] = [];
    const texts: string[] = [];
    files[`/home/.claude/sessions/${PID}.json`] = JSON.stringify({
        name,
        pid: PID,
        sessionId: SID,
    });
    for (const p of peers)
        files[`/home/.claude/sessions/${p.pid}.json`] = JSON.stringify(p);
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
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('process.run', (_$, e) => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout:
                e.argv[0] === 'ps'
                    ? [PID, ...peers.map((p) => p.pid)].join('\n')
                    : `${PID}\nSat Oct 11 18:00:00 2026\n`,
        },
    }));
    on('fs.list', (_$, e) => ({
        value:
            e.path === '/home/.claude/sessions'
                ? [PID, ...peers.map((p) => p.pid)].map((pid) => ({
                      isLink: false,
                      kind: 'file' as const,
                      mtimeMs: 0,
                      name: `${pid}.json`,
                      size: 1,
                  }))
                : [],
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
    $.tool.call({ op: 'glide', tool: TOOL, ...input } as never);
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
// dima's steer on lane l1 as the board keeps it
const steerOf = (w: { store: Map<string, unknown> }) =>
    w.store.get('lane-steer:l1') as
        | { steer?: string; isTaken?: boolean }
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
    [
        'an 8th step',
        {
            act: 'create',
            items: [...ITEMS, ...ITEMS, ...ITEMS.slice(0, 2)],
            title: 'x',
        },
    ],
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
        expect(await denied($, input)).toMatch(/^orbit glide: [^\n]+$/);
    });

test('a session the registry does not name 🦉 cclio is refused', async ($, on) => {
    const w = world(on, { name: '☕️ 🔧 coder' });
    await start($);
    expect([(await create($)).deny, w.files[FILE]]).toEqual([
        'orbit glide: only 🦉 cclio writes the lanes; every board shows them',
        undefined,
    ]);
});

test('cclio writes the lanes from a hook that runs before session.start', async ($, on) => {
    const w = world(on, { files: shelf(keptLane()) });
    const r = await lane($, { act: 'step', current: 1, id: 'l1' });
    expect([r.deny, kept(w)[0]?.current]).toEqual([undefined, 1]);
});

test('cclio still writes the lanes after a plugin reload', async ($, on) => {
    const w = world(on, { files: shelf(keptLane()) });
    await start($);
    await start($);
    const r = await lane($, { act: 'step', current: 1, id: 'l1' });
    expect([r.deny, kept(w)[0]?.current]).toEqual([undefined, 1]);
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

test('a second open lane of one topic is refused, naming the open one and its fix', async ($, on) => {
    const w = world(on);
    await start($);
    await create($, { title: 'mods — x' });
    expect([
        await denied($, { act: 'create', items: ITEMS, title: 'MODS — y' }),
        await denied($, { act: 'create', items: ITEMS, title: 'mods: z' }),
        kept(w).map((l) => l.id),
    ]).toEqual([
        'orbit glide: lane l1 «mods — x» is still open: end it first (glide end l1)',
        'orbit glide: lane l1 «mods — x» is still open: end it first (glide end l1)',
        ['l1'],
    ]);
});

test('a finished lane holds its topic until it is ended', async ($, on) => {
    const w = world(on);
    await start($);
    await create($, { items: [{ text: 'a' }], title: 'mods — x' });
    await lane($, { act: 'step', current: 1, id: 'l1' });
    const whileFinished = await denied($, {
        act: 'create',
        items: ITEMS,
        title: 'mods — y',
    });
    await lane($, { act: 'end', id: 'l1' });
    const afterEnd = await denied($, {
        act: 'create',
        items: ITEMS,
        title: 'mods — y',
    });
    expect([
        whileFinished,
        afterEnd,
        kept(w).map((l) => [l.id, l.endedAt === undefined]),
    ]).toEqual([
        'orbit glide: lane l1 «mods — x» is still open: end it first (glide end l1)',
        undefined,
        [
            ['l1', false],
            ['l2', true],
        ],
    ]);
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
        /🛼 glide: mods settings.*✅ shape the settings pane.*➡️ .*FRM-391the board in cards.*⬜ guard rules/su,
    );
});

test("any session's board draws the lane cclio wrote", async ($, on) => {
    world(on, { files: shelf(keptLane()), name: '☕️ 🔧 coder' });
    await start($);
    expect(await laneText(await board($))).toMatch(/🛼 glide: kept.*➡️ a/su);
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

const steer = async (ui: Board, text: string) =>
    ui.input({ key: 'lane:l1:steer', kind: 'change', text });
const take = (ui: Board) => ui.press({ key: 'lane:l1:take' });

test("a bare tick on the current step reaches cclio's next prompt once as «good to go»", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await take(ui);
    await say($, 'go');
    await say($, 'again');
    expect([
        w.contexts.at(-2)?.some((c) => c.includes('🛎️ good to go')),
        w.contexts.at(-1)?.some((c) => c.includes('🛎️ good to go')),
    ]).toEqual([true, false]);
});

test("one steer box and one take, on the current step only; a taken steer joins dima's next prompt once", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await lane($, { act: 'step', current: 1, id: 'l1' });
    const boxes = (await ui.findAll({ type: 'Input' })).filter((n) =>
        n.key?.startsWith('lane:'),
    ).length;
    await steer(ui, 'cards first');
    await take(ui);
    await say($, 'go');
    await say($, 'again');
    expect([
        boxes,
        w.contexts.at(-2)?.some((c) => c.includes('«cards first»')),
        w.contexts.at(-1)?.some((c) => c.includes('«cards first»')),
    ]).toEqual([1, true, false]);
});

test('a steer never sent with take stays a draft (dima, 20:51)', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await steer(ui, 'cards first');
    await say($, 'go');
    expect([
        w.contexts.at(-1)?.some((c) => c.includes('cards first')),
        steerOf(w)?.steer,
    ]).toEqual([false, 'cards first']);
});

test("a peer's prompt never carries a taken steer (dima, 20:51: only via send prompt)", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await steer(ui, 'cards first');
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

test("a steer taken while cclio's turn runs joins it at her next tool call", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($);
    await say($, 'go');
    await steer(ui, 'stop and look');
    await take(ui);
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    const again = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    expect([
        r.context?.some((c) => c.includes('«stop and look»')),
        again.context?.some((c) => c.includes('stop and look')) ?? false,
    ]).toEqual([true, false]);
});

test("a member's board takes a steer that reaches cclio, never the member's own prompt", async ($, on) => {
    const w = world(on, { files: shelf(keptLane()), name: '☕️ 🔧 coder' });
    await start($);
    const ui = await board($);
    await steer(ui, 'slow down');
    await take(ui);
    await say($, 'go');
    expect([
        steerOf(w)?.steer,
        steerOf(w)?.isTaken,
        w.contexts.at(-1)?.some((c) => c.includes('slow down')),
        // only cclio's lane op writes the shelf file
        kept(w)[0]?.steer,
    ]).toEqual(['slow down', true, false, undefined]);
});

test('a steer on a step leaves when cclio moves the lane past it', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await steer(ui, 'cards first');
    await lane($, { act: 'step', current: 1, id: 'l1' });
    expect(steerOf(w)).toBe(undefined);
});

test('a taken steer clears from the box once cclio took it', async ($, on) => {
    world(on);
    on('ui.panes', () => ({
        value: [
            {
                id: 'fleet-board',
                isFocused: false,
                isPlaced: true,
                isShown: true,
                plugin: 'x-mod-stash',
                title: 'fleet board',
            },
        ],
    }));
    await start($);
    const ui = await board($);
    await create($);
    await steer(ui, 'cards first');
    await take(ui);
    await say($, 'go');
    // the field held what it showed while typed into; the clear remounts it, so the surface drops the typed text
    const box = (await ui.findAll({ type: 'Input' })).find((n) =>
        n.key?.startsWith('lane:l1:steer'),
    );
    expect([
        box?.key,
        box?.props.value,
        (await ui.find({ key: 'lane:l1:take', type: 'Button' }))?.text,
    ]).toEqual(['lane:l1:steer#1', '', '🛎️ tick']);
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

test('a step back moves the pointer back and reopens the steps after it', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($, {
        items: [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
        title: 't',
    });
    await lane($, { act: 'step', current: 2, id: 'l1' });
    await lane($, { act: 'step', current: 1, id: 'l1' });
    expect(await laneText(ui)).toMatch(/✅ a.*➡️ b.*⬜ c/su);
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
    expect(await laneText(await board($))).toMatch(
        /🛼 glide: kept.*✅ a.*➡️ b/su,
    );
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
        expect.stringMatching(
            /✅ shape.*✅ .*FRM-391the board.*✅ guard rules/su,
        ),
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
        files: shelf(keptLane({ steer: 'n' })),
        name: '☕️ 🔧 coder',
    });
    await start($);
    for (let i = 0; i < 9; i++) await endTurn($);
    await say($, 'go');
    expect(w.contexts.at(-1)?.some((c) => /lane|kept/.test(c))).toBe(false);
});

test('the 🛼 glide switch hides every glide card', async ($, on) => {
    const w = world(on, { files: shelf(keptLane()) });
    w.store.set('shown', { 'stash.glide': false });
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
        text?.indexOf('🙋 🔧 coder · 2 asks'),
        text?.includes('cut the second probe'),
    ]).toEqual([expect.any(Number), false]);
    expect(
        (text?.indexOf('🙋 🔧 coder · 2 asks') ?? -1) <
            (text?.indexOf('🙋 🔎 verifier · 1 ask') ?? -1),
    ).toBe(true);
});

test('a member with asks heads its subcard in bold amber with a 🙋; at 0 it reads plain, and no strip draws', async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODER, [ASK]);
    published(w, VERIFIER, []);
    await start($);
    const ui = await board($);
    const head = async (text: string) => {
        const t = await ui.find({ text, type: 'Text' });
        return [t?.props.bold, t?.props.color];
    };
    expect([
        await head('🙋 🔧 coder · 1 ask'),
        await head('🔎 verifier · 0 asks'),
    ]).toEqual([
        [true, '#d9661a'],
        [true, undefined],
    ]);
});

test("at 0 asks the board's top has no strip", async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODER, []);
    await start($);
    expect(
        await (await board($)).find({ key: 'asks-strip', type: 'Box' }),
    ).toBe(undefined);
});

test("the board's top strip counts the asks waiting on dima, per member, a marked one not counted", async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODER, [ASK, { ...ASK, id: 'o4' }, { ...ASK, id: 'o5' }]);
    published(w, VERIFIER, [{ ...ASK, mark: 'accepted' }]);
    await start($);
    const ui = await board($);
    const keys = (await ui.findAll({ type: 'Box' })).map((b) => b.key ?? '');
    expect([
        (await ui.find({ key: 'asks-strip', type: 'Box' }))?.text,
        keys.indexOf('asks-strip') < keys.indexOf('lane:l1'),
    ]).toEqual(['🙋 3 asks wait for you· 🔧 coder 3', true]);
});

test('🛼 glide switched off draws no strip', async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODER, [ASK]);
    w.store.set('shown', { 'stash.glide': false });
    await start($);
    expect(
        await (await board($)).find({ key: 'asks-strip', type: 'Box' }),
    ).toBe(undefined);
});

// todo 21: a /clear left the l14 card linked to the coder's old id, so its asks never drew there
const OLD = 'o0o0o0o0-old';

test('a member linked by an id it cleared away from keeps its asks on the card', async ($, on) => {
    const w = world(on, {
        files: shelf(keptLane({ members: { coder: OLD } })),
    });
    w.store.set(`succ:${OLD}`, { at: 1, sid: CODER });
    published(w, CODER, [ASK, { ...ASK, id: 'o4' }]);
    await start($);
    expect(await laneText(await board($))).toContain('🙋 🔧 coder · 2 asks');
});

test('a /clear records the id the session goes on under', async ($, on) => {
    const w = world(on);
    await start($);
    await $.session.end({ reason: 'clear', sessionId: OLD } as never);
    await endTurn($);
    expect(w.store.get(`succ:${OLD}`)).toEqual({
        at: expect.any(Number),
        sid: SID,
    });
});

test("unfolded, a subcard's rows are the member's own asks", async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODER, [ASK]);
    await start($);
    const ui = await board($);
    await ui.press({ key: 'fold:lane:l1:coder' });
    expect(await subText(ui, 'coder')).toMatch(
        /o3: cut the second probe\?.*➡️ cut it.*tick.*replay/su,
    );
});

test("a tick on the card waits in the store for the member's own stash", async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODER, [ASK]);
    await start($);
    const ui = await board($);
    await ui.press({ key: 'fold:lane:l1:coder' });
    await ui.press({ key: 'lane:l1:coder:accepted:o3' });
    await w.clock.advance(5_000);
    expect([
        (w.store.get(`marks:${CODER}:o3`) as { mark?: string })?.mark,
        await subText(ui, 'coder'),
    ]).toEqual(['accepted', expect.stringContaining('✅ tick')]);
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

test('a member publishes its open asks whole, with ids, for the glide card', async ($, on) => {
    const w = await memberWithAsk($, on);
    expect(
        (w.store.get(`asks:${SID}`) as { items?: unknown[] })?.items,
    ).toEqual([{ id: 'o1', pick: 'cut it', text: 'cut the second probe?' }]);
});

test("a mark from a glide card joins the member's running turn", async ($, on) => {
    const w = await memberWithAsk($, on);
    await say($, 'go on');
    // marked on another board past its 5 s sending window
    w.store.set(`marks:${SID}:o1`, {
        at: w.clock.now() - 5_000,
        mark: 'accepted',
    });
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
        steer: 'later',
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
    expect([row?.includes('tick'), row?.includes('cut it')]).toEqual([
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

/* a part switched off in 🎛️ settings is off for the model too (l13 r4) */

const glideOff = (w: { store: Map<string, unknown> }) =>
    w.store.set('shown', { 'stash.glide': false });

test("with 🛼 glide switched off, a stale lane reaches no prompt of cclio's", async ($, on) => {
    const w = world(on);
    await start($);
    await create($, { title: 't' });
    for (let i = 0; i < 8; i++) await endTurn($);
    glideOff(w);
    await say($, 'go');
    expect(w.contexts.at(-1)?.some((c) => c.includes('stale'))).toBe(false);
});

test("with 🛼 glide switched off, a taken steer joins no prompt of cclio's", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await steer(ui, 'cards first');
    await take(ui);
    glideOff(w);
    await say($, 'go');
    expect(w.contexts.at(-1)?.some((c) => c.includes('cards first'))).toBe(
        false,
    );
});

test("with 🛼 glide switched off, a taken steer joins no tool call of cclio's", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await say($, 'go');
    await steer(ui, 'stop and look');
    await take(ui);
    glideOff(w);
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    expect(r.context?.some((c) => c.includes('stop and look')) ?? false).toBe(
        false,
    );
});

test('with 🛼 glide switched off, op glide is refused in one line naming the switch', async ($, on) => {
    const w = world(on);
    await start($);
    glideOff(w);
    const r = (await create($)) as { deny?: string };
    expect([r.deny?.includes('\n'), r.deny]).toEqual([
        false,
        expect.stringContaining('🛼 glide is switched off in 🎛️ settings'),
    ]);
});

/* Types */

interface KeptLane {
    id: string;
    title: string;
    items: { isDone: boolean; text: string; ticket?: string }[];
    current: number;
    movedAt: number;
    members: Record<string, string>;
    steer?: string;
    isSteerTaken?: boolean;
    plan?: string;
    isPlanGone?: boolean;
    history: {
        act: string;
        at: number;
        by?: string;
        current: number;
        done: number;
    }[];
    endedAt?: number;
}

test('every board card folds by one rule: open until folded, a member subcard folded until opened', async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODER, [ASK]);
    await start($);
    await $.tool.call({
        lines: ['probe: one'],
        op: 'plan',
        tool: TOOL,
    } as never);
    const ui = await board($);
    const label = async (card: string) =>
        (await ui.find({ key: `fold:${card}`, type: 'Button' }))?.text;
    // the subcard first: a folded glide card hides it
    const cards = ['lane:l1:coder', 'orbit', 'phases'];
    const before = await Promise.all(cards.map(label));
    const after: (string | undefined)[] = [];
    for (const card of cards) {
        await ui.press({ key: `fold:${card}` });
        after.push(await label(card));
    }
    await ui.press({ key: 'fold:lane:l1' });
    expect([before, after, await label('lane:l1')]).toEqual([
        ['📁', '📂', '📂'],
        ['📂', '📁', '📁'],
        '📁',
    ]);
});

test("the current step's ticket leads its text, the tick and steer follow on its own line, tick first (dima's shots, 17:41, 17:46, 19:44)", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($);
    await lane($, { act: 'step', current: 1, id: 'l1' });
    const step = await ui.find({ key: 'lane:l1:1', type: 'Box' });
    expect([step?.props.flexDirection, step?.text]).toEqual([
        'row',
        expect.stringMatching(/^➡️ .*FRM-391the board in cards🛎️ tick$/u),
    ]);
});

test("the step's text gives way before its link: it truncates, the link keeps its width", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($);
    await lane($, { act: 'step', current: 1, id: 'l1' });
    const text = await ui.find({ text: /the board in cards$/, type: 'Text' });
    const link = (await ui.findAll({ type: 'Box' })).find(
        (n) => n.text?.endsWith('FRM-391') && !n.text.includes('cards'),
    );
    expect([text?.props.wrap, link?.props.flexShrink]).toEqual([
        'truncate-end',
        0,
    ]);
});

test('a lane steer typed before the rename survives: drawn in the field, sent by tick, its old key gone', async ($, on) => {
    const w = world(on);
    w.store.set('lane-note:l1', { note: 'cards first' });
    await start($);
    const ui = await board($);
    await create($);
    const drawn = (await ui.find({ key: 'lane:l1:steer', type: 'Input' }))
        ?.props.value;
    await take(ui);
    await say($, 'go');
    expect([
        drawn,
        w.contexts.at(-1)?.some((c) => c.includes('«cards first»')),
        w.store.has('lane-note:l1'),
    ]).toEqual(['cards first', true, false]);
});

test('a lane steer ticked before the rename joins once, never again', async ($, on) => {
    const w = world(on);
    w.store.set('lane-note:l1', { isTaken: true, note: 'cards first' });
    await start($);
    await board($);
    await create($);
    await say($, 'go');
    await say($, 'again');
    expect([
        w.contexts.at(-2)?.some((c) => c.includes('«cards first»')),
        w.contexts.at(-1)?.some((c) => c.includes('«cards first»')),
    ]).toEqual([true, false]);
});

test('a glide mark saved before the steer rename clears for good when dima empties its steer', async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODER, [ASK]);
    w.store.set(`marks:${CODER}:o3`, { at: 1, mark: 'accepted', note: 'old' });
    await start($);
    const ui = await board($);
    await ui.press({ key: 'fold:lane:l1:coder' });
    await ui.input({ key: 'lane:l1:coder:steer:o3', kind: 'submit', text: '' });
    const m = w.store.get(`marks:${CODER}:o3`) as Record<string, unknown>;
    expect([m.mark, m.steer, 'note' in m]).toEqual([
        'accepted',
        undefined,
        false,
    ]);
});

/* rider (cclio's wisp, 18:01): a member is linked by its registry name, so its asks survive a /clear */

const CODER_NAME = '☕️ 🔧 coder: mods';
const coderAt = (sessionId: string, more: Record<string, unknown> = {}) => ({
    hostSessionId: 'local_94d65a2a',
    name: CODER_NAME,
    pid: 5001,
    sessionId,
    ...more,
});

test("a link by the member's desktop id keeps its registry name", async ($, on) => {
    const w = world(on, { peers: [coderAt(CODER)] });
    await start($);
    await create($);
    await lane($, {
        act: 'link',
        id: 'l1',
        role: 'coder',
        session: 'local_94d65a2a',
    });
    expect(kept(w)[0]?.members.coder).toBe(CODER_NAME);
});

test("a link by an 8-char session prefix keeps the member's registry name", async ($, on) => {
    const w = world(on, { peers: [coderAt(CODER)] });
    await start($);
    await create($);
    await lane($, {
        act: 'link',
        id: 'l1',
        role: 'coder',
        session: 'c0c0c0c0',
    });
    expect(kept(w)[0]?.members.coder).toBe(CODER_NAME);
});

test("after a /clear mints a new session id, the card still shows the member's asks", async ($, on) => {
    const w = world(on, {
        files: shelf(keptLane({ members: { coder: CODER_NAME } })),
        peers: [coderAt('n3n3n3n3-after-clear')],
    });
    published(w, 'n3n3n3n3-after-clear', [ASK]);
    await start($);
    const ui = await board($);
    expect(await subText(ui, 'coder')).toContain('1 ask');
});

test("a tick on the card reaches the member's session id of now", async ($, on) => {
    const w = world(on, {
        files: shelf(keptLane({ members: { coder: CODER_NAME } })),
        peers: [coderAt('n3n3n3n3-after-clear')],
    });
    published(w, 'n3n3n3n3-after-clear', [ASK]);
    await start($);
    const ui = await board($);
    await ui.press({ key: 'fold:lane:l1:coder' });
    await ui.press({ key: 'lane:l1:coder:accepted:o3' });
    expect(
        (w.store.get('marks:n3n3n3n3-after-clear:o3') as { mark?: string })
            ?.mark,
    ).toBe('accepted');
});

test('two live sessions under one name: the card follows the newer', async ($, on) => {
    const w = world(on, {
        files: shelf(keptLane({ members: { coder: CODER_NAME } })),
        peers: [
            coderAt('o1o1o1o1-older', { pid: 5001, startedAt: 1 }),
            coderAt('n2n2n2n2-newer', { pid: 5002, startedAt: 2 }),
        ],
    });
    published(w, 'o1o1o1o1-older', [ASK]);
    published(w, 'n2n2n2n2-newer', [ASK, { ...ASK, id: 'o4' }]);
    await start($);
    const ui = await board($);
    expect(await subText(ui, 'coder')).toContain('2 asks');
});

/* rider (cclio's ask, 18:01): a card edits in place, up to 7 steps */

const step = (text: string, isDone = false) => ({ isDone, text });

test('seven steps make a card', async ($, on) => {
    const w = world(on);
    await start($);
    await create($, { items: [...ITEMS, ...ITEMS, ITEMS[0]] });
    expect(kept(w)[0]?.items.length).toBe(7);
});

test('an edit keeps the lane id, its members and its history, adding one edit entry', async ($, on) => {
    const w = world(on, {
        files: shelf(
            keptLane({
                history: [{ act: 'create', at: 1, current: 0, done: 0 }],
                members: { coder: 'c0c0c0c0-coder' },
            }),
        ),
    });
    await start($);
    await lane($, { act: 'edit', id: 'l1', title: 'kept, renamed' });
    const l = kept(w)[0];
    expect([l?.id, l?.title, l?.members, l?.history.map((h) => h.act)]).toEqual(
        [
            'l1',
            'kept, renamed',
            { coder: 'c0c0c0c0-coder' },
            ['create', 'edit'],
        ],
    );
});

test('a step whose text stays keeps its done flag, and the pointer lands on the first step not done', async ($, on) => {
    const w = world(on, {
        files: shelf(
            keptLane({ current: 1, items: [step('a', true), step('b')] }),
        ),
    });
    await start($);
    await lane($, {
        act: 'edit',
        id: 'l1',
        items: [{ text: 'a' }, { text: 'new' }, { text: 'b' }],
    });
    const l = kept(w)[0];
    expect([l?.items.map((x) => x.isDone), l?.current]).toEqual([
        [true, false, false],
        1,
    ]);
});

test("an edit that keeps the current step keeps dima's steer on it", async ($, on) => {
    const w = world(on, {
        files: shelf(
            keptLane({ current: 1, items: [step('a', true), step('b')] }),
        ),
    });
    w.store.set('lane-steer:l1', { steer: 'cards first' });
    await start($);
    await lane($, {
        act: 'edit',
        id: 'l1',
        items: [{ done: true, text: 'z0' }, { text: 'a' }, { text: 'b' }],
    });
    expect([kept(w)[0]?.current, w.store.has('lane-steer:l1')]).toEqual([
        2,
        true,
    ]);
});

test('an edit that puts another step current drops the steer', async ($, on) => {
    const w = world(on, {
        files: shelf(
            keptLane({ current: 1, items: [step('a', true), step('b')] }),
        ),
    });
    w.store.set('lane-steer:l1', { steer: 'cards first' });
    await start($);
    await lane($, {
        act: 'edit',
        id: 'l1',
        items: [{ text: 'a' }, { text: 'c' }, { text: 'b' }],
    });
    expect(w.store.has('lane-steer:l1')).toBe(false);
});

test('an edit with a step past 60 chars is refused and the card stays', async ($, on) => {
    const w = world(on, { files: shelf(keptLane()) });
    await start($);
    const r = await denied($, {
        act: 'edit',
        id: 'l1',
        items: [{ text: 'x'.repeat(61) }],
    });
    expect([r, kept(w)[0]?.items.length]).toEqual([
        expect.stringMatching(/keep it ≤60/),
        2,
    ]);
});

const threeQueued = () =>
    keptLane({
        items: [
            { isDone: false, text: 'a' },
            { isDone: false, text: 'b' },
            { isDone: false, text: 'c' },
            { isDone: false, text: 'd' },
        ],
    });

/* o138: the glide card reads as a status — no reorder arrows on any step */

test('no glide row carries ↑ or ↓, queued steps included', async ($, on) => {
    world(on, { files: shelf(threeQueued()) });
    await start($);
    const ui = await board($);
    const arrows = await Promise.all(
        [0, 1, 2, 3]
            .flatMap((i) => [`lane:l1:${i}:up`, `lane:l1:${i}:down`])
            .map(async (key) => Boolean(await ui.find({ key }))),
    );
    expect(arrows.some(Boolean)).toBe(false);
});

test("a lane-order key a board left before o138 is dropped by cclio's stash, never applied", async ($, on) => {
    const w = world(on, { files: shelf(threeQueued()) });
    w.store.set('lane-order:l1', { at: 0, order: ['d', 'c', 'b'] });
    await start($);
    await say($, 'go');
    expect([
        w.store.has('lane-order:l1'),
        kept(w)[0]?.items.map((x) => x.text),
    ]).toEqual([false, ['a', 'b', 'c', 'd']]);
});

/* todo 6 — glide steps itself from the linked coder's plan step (spec exits 3–4) */

const STEP_VERIFIER = '☕️ 🔎 verify: mods';
const NOW = new Date(2026, 9, 11, 18, 30).getTime();
const stepKey = (name: string) =>
    `lane-step:${name.replaceAll(/[\s\u200d]/g, '')}`;
const fiveSteps = (done = 0) =>
    ['a', 'b', 'c', 'd', 'e'].map((text, i) => ({ isDone: i < done, text }));
const coderLane = (over: Partial<KeptLane> = {}) =>
    keptLane({ items: fiveSteps(), members: { coder: CODER_NAME }, ...over });
const pointerOf = (w: ReturnType<typeof world>) => {
    const l = kept(w)[0];
    return [
        l?.current,
        l?.items.map((x) => x.isDone),
        l?.history.map((h) => h.by),
    ];
};

test("a session's plan step lands in the store under its registry name", async ($, on) => {
    const w = world(on, { name: CODER_NAME });
    await start($);
    const r = await lane($, { lines: ['now: b'], op: 'plan', step: 2 });
    expect([r.deny, w.store.get(stepKey(CODER_NAME))]).toEqual([
        undefined,
        { at: NOW, step: 2 },
    ]);
});

for (const step of [1.5, -1, '2'])
    test(`a plan step of ${JSON.stringify(step)} is refused in one line`, async ($, on) => {
        const w = world(on, { name: CODER_NAME });
        await start($);
        const r = await lane($, { lines: ['now: b'], op: 'plan', step });
        expect([r.deny, w.store.has(stepKey(CODER_NAME))]).toEqual([
            'orbit plan: step is your lane step now, a whole number from 0, as your brief numbers it',
            false,
        ]);
    });

test("the linked coder's step 3 moves the lane while cclio idles, and her next prompt hears it once", async ($, on) => {
    const w = world(on, { files: shelf(coderLane()) });
    w.store.set(stepKey(CODER_NAME), { at: NOW + 1, step: 3 });
    await start($);
    await w.clock.advance(5_000);
    const moved = pointerOf(w);
    await say($, 'hi');
    await say($, 'again');
    const note = 'lane l1 «kept» moved to step 3 by ☕️ 🔧 coder: mods';
    expect([
        moved,
        w.contexts.map((c) => c.filter((x) => x === note).length),
    ]).toEqual([
        [3, [true, true, true, false, false], [CODER_NAME]],
        [1, 0],
    ]);
});

test("a move reaches cclio's running turn at her next tool call", async ($, on) => {
    const w = world(on, { files: shelf(coderLane()) });
    w.store.set(stepKey(CODER_NAME), { at: NOW + 1, step: 2 });
    await start($);
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    expect([pointerOf(w)[0], r.context]).toEqual([
        2,
        expect.arrayContaining([
            'lane l1 «kept» moved to step 2 by ☕️ 🔧 coder: mods',
        ]),
    ]);
});

const AT_3 = coderLane({
    current: 3,
    history: [{ act: 'step', at: NOW, current: 3, done: 3 }],
    items: fiveSteps(3),
});
for (const [why, lanes, key, step, shown] of [
    ['the coder names a step behind the pointer', [AT_3], CODER_NAME, 2],
    ['the coder names the step count', [AT_3], CODER_NAME, 5],
    [
        'the verifier names a step',
        [{ ...AT_3, members: { coder: CODER_NAME, verifier: STEP_VERIFIER } }],
        STEP_VERIFIER,
        4,
    ],
    ['an unlinked session names a step', [AT_3], '☕️ 🔧 coder: cli', 4],
    ['the lane is ended', [{ ...AT_3, endedAt: NOW }], CODER_NAME, 4],
    ['🛼 glide is switched off', [AT_3], CODER_NAME, 4, false],
] as const)
    test(`the pointer stays and the file gains nothing when ${why}`, async ($, on) => {
        const w = world(on, { files: shelf(...lanes) });
        const before = w.files[FILE];
        w.store.set(stepKey(key), { at: NOW + 1, step });
        if (shown === false) w.store.set('shown', { 'stash.glide': false });
        await start($);
        await w.clock.advance(5_000);
        await say($, 'hi');
        expect([
            w.files[FILE] === before,
            w.contexts.flat().some((c) => c.includes('moved to step')),
        ]).toEqual([true, false]);
    });

test("cclio's step back holds until the coder names a step again", async ($, on) => {
    const w = world(on, { files: shelf(coderLane()) });
    w.store.set(stepKey(CODER_NAME), { at: NOW + 1, step: 3 });
    await start($);
    await w.clock.advance(5_000);
    await lane($, { act: 'step', current: 1, id: 'l1' });
    await w.clock.advance(5_000);
    const held = pointerOf(w)[0];
    w.store.set(stepKey(CODER_NAME), { at: NOW + 10_001, step: 2 });
    await w.clock.advance(5_000);
    expect([held, pointerOf(w)[0]]).toEqual([1, 2]);
});

/* FRM-429 exit 1 — a glide card linked to its lane plan file moves on its own */

const PLAN = '/home/.local/state/x/lanes/mods/lane-plan.md';
const planText = (marks: string) =>
    marks
        .split('')
        .map((m, i) => `- [${m}] 0${i + 1} · step ${i + 1}`)
        .join('\n');
const linkedPlan = async (
    $: Engine,
    w: ReturnType<typeof world>,
    marks = '   ',
) => {
    w.files[PLAN] = planText(marks);
    const r = await create($, {
        items: undefined,
        plan: '~/.local/state/x/lanes/mods/lane-plan.md',
    });
    return r.deny;
};
const poll = (w: ReturnType<typeof world>) => w.clock.advance(5_000);

test('a create naming a lane plan takes its steps from the file', async ($, on) => {
    const w = world(on);
    await start($);
    expect(await linkedPlan($, w, 'x  ')).toBeUndefined();
    expect(kept(w)[0]?.items.map((i) => [i.text, i.isDone])).toEqual([
        ['step 1', true],
        ['step 2', false],
        ['step 3', false],
    ]);
});

test('a tick in the plan file moves the card to the first unticked line on the next poll', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w, 'x  ');
    w.files[PLAN] = planText('xx ');
    await poll(w);
    expect(kept(w)[0]?.current).toBe(2);
});

test('an all-ticked plan file shows the lane done', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w, 'x  ');
    w.files[PLAN] = planText('xxx');
    await poll(w);
    expect(kept(w)[0]?.current).toBe(3);
});

test('a nested or unnumbered checklist line moves nothing', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w);
    w.files[PLAN] =
        `  - [ ] 00 · nested\n- [ ] no number\n- [ ] 7 - dash\n${planText('x  ')}`;
    await poll(w);
    expect([kept(w)[0]?.current, kept(w)[0]?.items.length]).toEqual([1, 3]);
});

test('a capital X ticks a step like x', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w);
    w.files[PLAN] = planText('x  ').replace('[x]', '[X]');
    await poll(w);
    expect([kept(w)[0]?.items[0]?.isDone, kept(w)[0]?.items.length]).toEqual([
        true,
        3,
    ]);
});

test('a plan file grown past seven steps keeps every step and its pointer', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w);
    w.files[PLAN] = planText('xxxxxxx  ');
    await poll(w);
    expect([kept(w)[0]?.items.length, kept(w)[0]?.current]).toEqual([9, 7]);
});

test('a create naming a plan of eleven steps is taken, never refused', async ($, on) => {
    const w = world(on);
    await start($);
    expect(await linkedPlan($, w, ' '.repeat(11))).toBeUndefined();
    expect(kept(w)[0]?.items.length).toBe(11);
});

test('a card of eleven steps draws the current one with its neighbours and says where it is', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await linkedPlan($, w, `${'x'.repeat(4)}${' '.repeat(7)}`);
    await poll(w);
    const text = (await laneText(ui)) ?? '';
    expect([
        text.includes('4–8 of 11'),
        text.includes('step 5'),
        text.includes('step 8'),
        text.includes('step 3'),
        text.includes('step 9'),
    ]).toEqual([true, true, true, false, false]);
});

test('a lane whose data breaks its draw blanks alone, the next lane draws', async ($, on) => {
    const w = world(on, {
        files: shelf(
            keptLane({ items: [null] as never }),
            keptLane({ id: 'l2', title: 'fine' }),
        ),
    });
    await start($);
    const ui = await board($);
    await w.clock.advance(5_000);
    expect([
        (await ui.find({ key: 'broken:lane l1', type: 'Box' }))?.text,
        await laneText(ui, 'l2'),
    ]).toEqual([
        '⚠ lane l1 could not draw',
        expect.stringContaining('🛼 glide: fine'),
    ]);
});

test('a card of seven steps draws all of them with no window label', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await linkedPlan($, w, 'x'.repeat(3) + ' '.repeat(4));
    await poll(w);
    expect(await laneText(ui)).not.toContain(' of 7');
});

test('a tick on the card after typing keeps the typed steer, not the published one', async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODER, [ASK]);
    await start($);
    const ui = await board($);
    await ui.press({ key: 'fold:lane:l1:coder' });
    await ui.input({
        key: 'lane:l1:coder:steer:o3',
        kind: 'change',
        text: 'new words',
    });
    await ui.press({ key: 'lane:l1:coder:accepted:o3' });
    expect(
        (w.store.get(`marks:${CODER}:o3`) as { steer?: string })?.steer,
    ).toBe('new words');
});

test('a missing plan file keeps the last state marked «plan file gone»', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w, 'x  ');
    delete w.files[PLAN];
    await poll(w);
    const l = kept(w)[0];
    expect([l?.current, l?.isPlanGone]).toEqual([1, true]);
    expect(await laneText(await board($))).toContain('· plan file gone');
});

test('a hand step on a linked card is refused, naming the file', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w);
    expect(await denied($, { act: 'step', current: 1, id: 'l1' })).toContain(
        'lane-plan.md',
    );
});

test('a card with no linked file stays hand-stepped', async ($, on) => {
    world(on);
    await start($);
    await create($);
    expect(
        await denied($, { act: 'step', current: 1, id: 'l1' }),
    ).toBeUndefined();
});

test("a plan tick that moves the pointer drops dima's steer on the old step", async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w);
    w.store.set('lane-steer:l1', { steer: 'hold on step 1' });
    w.files[PLAN] = planText('x  ');
    await poll(w);
    expect(steerOf(w)).toBeUndefined();
});

test('a create naming a relative plan path is refused for its shape, not read', async ($, on) => {
    const w = world(on);
    await start($);
    w.files['plan.md'] = planText('   ');
    expect(
        await denied($, { act: 'create', plan: 'plan.md', title: 'x' }),
    ).toContain('absolute or ~/');
});
