import {
    ASK,
    CODIE,
    CODIE_NAME,
    ITEMS,
    TOOL,
    board,
    codieAt,
    create,
    denied,
    endTurn,
    kept,
    keptLane,
    lane,
    linked,
    published,
    say,
    shelf,
    start,
    steer,
    step,
    subText,
    take,
    world,
} from './lane-world.ts';
import { expect, test } from './shared-boot.ts';

/* a part switched off in 🎛️ settings is off for the model too (l13 r4) */

const glideOff = (w: { store: Map<string, unknown> }) =>
    w.store.set('shown', { 'stash.glide': false });

test("with 🛼 glide switched off, a stale lane reaches no prompt of clio's", async ($, on) => {
    const w = world(on);
    await start($);
    await create($, { title: 't' });
    for (let i = 0; i < 8; i++) await endTurn($);
    glideOff(w);
    await say($, 'go');
    expect(w.contexts.at(-1)?.some((c) => c.includes('stale'))).toBe(false);
});

test("with 🛼 glide switched off, a taken steer joins no prompt of clio's", async ($, on) => {
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

test("with 🛼 glide switched off, a taken steer joins no tool call of clio's", async ($, on) => {
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

test('every board card folds by one rule: open until folded, a member subcard folded until opened', async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODIE, [ASK]);
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
    const cards = ['lane:l1:codie', 'orbit', 'phases'];
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

test("a link by the member's desktop id keeps its registry name", async ($, on) => {
    const w = world(on, { peers: [codieAt(CODIE)] });
    await start($);
    await create($);
    await lane($, {
        act: 'link',
        id: 'l1',
        role: 'codie',
        session: 'local_94d65a2a',
    });
    expect(kept(w)[0]?.members.codie).toBe(CODIE_NAME);
});

test("a link by an 8-char session prefix keeps the member's registry name", async ($, on) => {
    const w = world(on, { peers: [codieAt(CODIE)] });
    await start($);
    await create($);
    await lane($, {
        act: 'link',
        id: 'l1',
        role: 'codie',
        session: 'c0c0c0c0',
    });
    expect(kept(w)[0]?.members.codie).toBe(CODIE_NAME);
});

test("after a /clear mints a new session id, the card still shows the member's asks", async ($, on) => {
    const w = world(on, {
        files: shelf(keptLane({ members: { codie: CODIE_NAME } })),
        peers: [codieAt('n3n3n3n3-after-clear')],
    });
    published(w, 'n3n3n3n3-after-clear', [ASK]);
    await start($);
    const ui = await board($);
    expect(await subText(ui, 'codie')).toContain('1 ask');
});

// FRM-617 exit 4: a dispatch retitles a member to its next ticket; the card follows its linked id, never the old name
test('a member renamed after its link still shows its asks on the card', async ($, on) => {
    const w = world(on, {
        files: shelf(
            keptLane({
                linkedIds: { codie: CODIE },
                members: { codie: '⚡ 🔧 mods | FRM-1' },
            }),
        ),
        peers: [codieAt(CODIE, { name: '⚡ 🔧 mods | FRM-2' })],
    });
    published(w, CODIE, [ASK]);
    await start($);
    expect(await subText(await board($), 'codie')).toContain('1 ask');
});

test('two lanes whose codies share an old name each show their own linked codie’s asks', async ($, on) => {
    const OTHER = 'd0d0d0d0-other';
    const STALE = '⚡ 🔧 mods | FRM-1';
    const w = world(on, {
        files: shelf(
            keptLane({
                linkedIds: { codie: CODIE },
                members: { codie: STALE },
            }),
            keptLane({
                id: 'l2',
                linkedIds: { codie: OTHER },
                members: { codie: STALE },
            }),
        ),
        peers: [
            codieAt(CODIE, { name: '⚡ 🔧 mods | FRM-2' }),
            codieAt(OTHER, { name: '⚡ 🔧 mods | FRM-3', pid: 5002 }),
        ],
    });
    published(w, CODIE, [ASK]);
    published(w, OTHER, [ASK, { ...ASK, id: 'o4' }]);
    await start($);
    const ui = await board($);
    expect([
        await subText(ui, 'codie'),
        (await ui.find({ key: 'lane:l2:codie', type: 'Box' }))?.text,
    ]).toEqual([
        expect.stringContaining('1 ask'),
        expect.stringContaining('2 asks'),
    ]);
});

test('two live sessions under one name: the card follows the newer', async ($, on) => {
    const w = world(on, {
        files: shelf(keptLane({ members: { codie: CODIE_NAME } })),
        peers: [
            codieAt('o1o1o1o1-older', { pid: 5001, startedAt: 1 }),
            codieAt('n2n2n2n2-newer', { pid: 5002, startedAt: 2 }),
        ],
    });
    published(w, 'o1o1o1o1-older', [ASK]);
    published(w, 'n2n2n2n2-newer', [ASK, { ...ASK, id: 'o4' }]);
    await start($);
    const ui = await board($);
    expect(await subText(ui, 'codie')).toContain('2 asks');
});

/* rider (clio's ask, 18:01): a card edits in place, up to 7 steps */

test('seven steps make a card', async ($, on) => {
    const w = world(on);
    await start($);
    await create($, { items: [...ITEMS, ...ITEMS, ITEMS[0]] });
    expect(kept(w)[0]?.items.length).toBe(7);
});

test('an edit keeps the lane id, its members (old role keys read as the new ones) and its history, adding one edit entry', async ($, on) => {
    const w = world(on, {
        files: shelf(
            keptLane({
                history: [{ act: 'create', at: 1, current: 0, done: 0 }],
                members: {
                    coder: 'c0c0c0c0-codie',
                    verifier: 'v0v0v0v0-sixth',
                }, // read-both
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
            { codie: 'c0c0c0c0-codie', 'sixth-sense': 'v0v0v0v0-sixth' },
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

test("a lane-order key a board left before o138 is dropped by clio's stash, never applied", async ($, on) => {
    const w = world(on, { files: shelf(threeQueued()) });
    w.store.set('lane-order:l1', { at: 0, order: ['d', 'c', 'b'] });
    await start($);
    await say($, 'go');
    expect([
        w.store.has('lane-order:l1'),
        kept(w)[0]?.items.map((x) => x.text),
    ]).toEqual([false, ['a', 'b', 'c', 'd']]);
});
