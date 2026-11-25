import type { On } from 'claude-code';

import {
    allAsksTicks,
    isAllAsksMarkable,
    joinText,
    orbitOp,
} from '../hooks/orbit.ts';
import { strandedLine } from '../hooks/orbit-ask-kind.ts';
import type { OrbitAsk } from '../types/stash.d.ts';
import {
    AREAS,
    TITLED,
    TITLED_TEXT,
    addLinked,
    addOf,
    assume,
    bgWorld,
    partOff,
    press,
    ran,
    texts,
    tickLog,
    ticked,
} from './orbit-helpers.ts';
import {
    SID,
    add,
    asksShown,
    board,
    endTurn,
    orbit,
    registered,
    say,
    start,
    world,
} from './orbit-world.ts';
import { expect, test } from './shared-boot.ts';

// the hook entry loads the way cc loads it and its start registers the orbit tool and /board, so a split of
// register.tsx that loses a module or throws at load turns this red first (FRM-662 exit 2)
test('a session start registers the orbit tool and the /board command', async ($, on) => {
    const commands: string[] = [];
    on('command.register', (_$, e) => {
        commands.push(e.name);
        return { value: { command: e.name } };
    });
    world(on);
    await start($);
    expect([registered.described.startsWith('orbit:'), commands]).toEqual([
        true,
        expect.arrayContaining(['board']),
    ]);
});

test("a follow-up clears dima's steer on the old question", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.input({ key: 'orbit:steer:o1', text: 'tastaet' });
    await say($, 'go');
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'after ci',
        text: 'push the branch once ci is green',
    });
    await endTurn($);
    // the box drew '' and still holds his text: the clear remounts it under a new key (FRM-492)
    const box = await ui.find({ key: 'orbit:steer:o1#1', type: 'Input' });
    expect([
        box?.props.value,
        await ui.find({ key: 'orbit:steer:o1' }),
    ]).toEqual(['', undefined]);
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
            /^🆕 o1 mods: push the branch once ci is green➡️ after cia test ask🛎️ tick/u,
        ),
    ]);
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

test("an agent's own orbit ops never write a tick", async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    await orbit($, {
        ops: [
            {
                asks: [
                    {
                        area: 'mods',
                        mark: 'accepted',
                        pick: 'yes',
                        text: 'push `origin`',
                        why: 'a test ask',
                    },
                ],
                op: 'add',
            },
            {
                id: 'o1',
                mark: 'accepted',
                op: 'follow',
                text: 'push `origin` now',
            },
            { ids: ['o1'], op: 'resolve' },
        ],
    });
    expect(writes).toEqual([]);
});

const long = 'x'.repeat(91);

test('an ask text over 90 chars is refused with its length', async ($, on) => {
    world(on);
    await start($);
    const r = await add($, [long, 'yes']);
    expect((r as { deny?: string }).deny).toMatch(
        /91 chars; keep it ≤90, subject first, detail he need not read in hiddenNote/,
    );
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

/* FRM-695: a title, a body and the pick, handed to herdr as three fields */

const RETIRED = '; text is retired: title (the topic, ≤7 words) and body';
test('a titled ask publishes title, body and pick apart, its text the two, and takes a press on all of it', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    const writes = tickLog(on);
    await start($);
    const gated = 'runs `git push`';
    await orbit($, addOf({}, { body: gated }, { kind: 'look' }));
    const items = () =>
        (w.store.get(`asks:${SID}`) as { items: Record<string, unknown>[] })
            .items;
    const shown = items();
    const ui = await board($);
    const card = (await ui.find({ key: 'orbit:ask:o3', type: 'Box' }))?.text;
    const at = w.clock.now();
    const pressed = (id: string, text: unknown) =>
        press({ at, id, pick: 'log', text, verdict: 'tick' });
    // a body-only follow lands before the press written on the old body is read: that press marks nothing
    await orbit($, { body: 'a new fact', id: 'o1', op: 'follow' });
    files[`/home/.claude/shelf/orbit-ticks/${SID}.jsonl`] =
        pressed('o1', TITLED_TEXT) + pressed('o2', shown[1]?.text);
    await $.tool.call({ command: 'ls', tool: 'Bash' });
    const body = '- log each run\n- or **skip** it';
    expect([
        shown.map((a) => [a.title, a.body, a.pick, a.text, a.isGated]),
        card,
        items().map((a) => [a.mark, a.text]),
        writes.at(-1),
    ]).toEqual([
        [
            [TITLED.title, body, 'log', TITLED_TEXT, undefined],
            [TITLED.title, gated, 'log', `${TITLED.title}\n\n${gated}`, true],
            [TITLED.title, body, 'log', `look: ${TITLED_TEXT}`, undefined],
        ],
        expect.stringMatching(/^👀 o3 mods: 🧩 tests queue/u),
        [
            [undefined, `${TITLED.title}\n\na new fact`],
            ['accepted', `${TITLED.title}\n\n${gated}`],
            [undefined, `look: ${TITLED_TEXT}`],
        ],
        [expect.objectContaining({ id: 'o2', targets: ['git push'] })],
    ]);
});

for (const [what, fields, miss] of [
    [
        'an 8-word title',
        { title: 'a b c d e f g h' },
        '«a b c d e f g h»: title is 8 words, keep ≤7',
    ],
    [
        'a 46-char title',
        { title: 'x'.repeat(46) },
        `«${'x'.repeat(40)}»: title is 46 chars, keep it ≤45`,
    ],
    ['no body', { body: undefined }, 'log or not»: body is missing'],
    ['a blank body', { body: ' \n ' }, 'log or not»: body is missing'],
    [
        'a 201-char body',
        { body: 'b'.repeat(201) },
        'log or not»: body is 201 chars, keep it ≤200',
    ],
    [
        'no title',
        { body: 'b'.repeat(50), title: undefined },
        `«${'b'.repeat(40)}»: title is missing`,
    ],
    ['a blank title', { body: 'so', title: ' ' }, '«so»: title is missing'],
    ['an emoji title', { body: 'so', title: '🧩 1️⃣' }, '«so»: title is missing'],
    [
        'a text beside a body',
        { body: 'so', text: 'x', title: undefined },
        '«so»: title is missing',
    ],
    [
        'a long bracket for a tag',
        { title: `[${'x '.repeat(25)}] queue` },
        'title is 26 words, keep ≤7; title is 58 chars, keep it ≤45',
    ],
    [
        'two misses',
        { body: '', title: 'a b c d e f g h' },
        'title is 8 words, keep ≤7; body is missing',
    ],
    // a security read, 25 Nov: a title herdr cuts could hide the command his tick opens
    [
        'a command in a title',
        { title: 'tidy `git clean -fdx`' },
        'title holds a backtick: a command goes in the pick',
    ],
    [
        'an 8-word title past its kind',
        { title: 'look: a b c d e f g h' },
        'title is 8 words, keep ≤7',
    ],
] as const)
    test(`an ask with ${what} is refused whole in one line, as a follow is`, () => {
        const deny = `${miss}; an ask is { title, body, pick, area, why }`;
        const { body, text, title } = fields as Record<string, string>;
        // a follow keeps the field it leaves out, so one with no title is refused on an ask that has none
        const was = addOf(
            'title' in fields && title === undefined
                ? { body: undefined, text: 'x', title: undefined }
                : {},
        );
        const follow = { body, id: 'o1', op: 'follow', text, title };
        for (const got of [
            ran(addOf(TITLED, fields)),
            ...(what === 'no body' ? [] : [ran(was, follow)]),
        ])
            expect([
                String(got).includes(deny),
                String(got).split('\n').length,
            ]).toEqual([true, 1]);
    });

for (const [what, fields] of [
    [
        '7 words past ⚠️, an emoji and a tag',
        { title: '⚠️ 🧩 [mods] a b c d e f g' },
    ],
    ['45 chars past a tag', { title: `[mods] ${'x'.repeat(45)}` }],
    ['45 chars past its kind', { title: `test: ${'x'.repeat(45)}` }],
    ['a 200-char body', { body: '🧩'.repeat(200) }],
    ['a text beside its title', { text: 'x'.repeat(91) }],
] as const)
    test(`an ask with ${what} lands`, () => {
        const got = ran(addOf(fields));
        expect(got).toHaveLength(1);
        expect(got[0]).not.toHaveProperty('text', expect.stringMatching(/^x/));
    });

test('the old text call lands as before, its line naming title and body', () => {
    const old = {
        area: 'mods',
        pick: 'yes',
        text: 'ship it',
        why: 'a test ask',
    };
    const o = { asks: [], next: 1, turns: 0 };
    const add = orbitOp(o, { asks: [old], op: 'add' }, true);
    const follow = orbitOp(
        'orbit' in add ? add.orbit : o,
        { id: 'o1', op: 'follow', text: 'ship it now' },
        true,
    );
    expect([
        add,
        follow,
        (orbitOp(o, addOf({}), true) as { result: string }).result,
    ]).toEqual([
        expect.objectContaining({
            result: `added o1 to dima's orbit; never repeat them in the reply${RETIRED}`,
        }),
        expect.objectContaining({ result: `o1 changed in place${RETIRED}` }),
        "added o1 to dima's orbit; never repeat them in the reply",
    ]);
    expect(ran({ asks: [old], op: 'add' })[0]).not.toHaveProperty('title');
});

test('a titled ask draws on one line where one line is read, and an emoji-led merge takes its own 🛎️', () => {
    const [a, merge, gated] = ran(
        addOf(
            { kind: 'look' },
            { title: '1️⃣ [a] [b] merge pr 7' },
            { body: 'runs `git push`' },
        ),
    ) as [OrbitAsk, OrbitAsk, OrbitAsk];
    const line = `look: ${TITLED_TEXT.replaceAll(/\n+/g, ' — ')}`;
    expect([
        joinText([{ ...a, mark: 'accepted' }]).split('\n')[1],
        strandedLine(a, 'p', undefined).includes(`«${line}»`),
        [a, merge, { ...a, text: '⚠️ x' }].map(isAllAsksMarkable),
        allAsksTicks([gated], 1)[0]?.targets,
        // a turned-down command in the body is no word of his: the pick's spans alone once it holds one
        allAsksTicks(
            [
                {
                    ...gated,
                    pick: 'run `git push -n`',
                },
                // one word is a command too, and a span never crosses from the title into the body
                { ...gated, pick: 'run `~/clean.sh`' },
                { ...gated, pick: '`pbcopy`', text: 'a `b c` on `~/a.ts`' },
                { ...gated, pick: '`mcp__x__send`' },
                { ...gated, pick: 'yes, `main` stays' },
                { ...gated, text: 'the ` key\n\nruns `git push`' },
                { ...gated, text: '🧩 `git branch\n\n-D foo` is it' },
            ],
            1,
        ).map((t) => t.targets),
    ]).toEqual([
        `- o1 🛎️ accepted: ${line} (your pick: log)`,
        true,
        [true, false, false],
        ['git push'],
        [
            ['git push -n'],
            ['~/clean.sh'],
            ['~/a.ts', 'pbcopy'],
            ['mcp__x__send'],
            ['git push', 'main'],
            ['git push'],
            [],
        ],
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

test("orbit's description fits the 4096 chars cc shows the model, every op named", async ($, on) => {
    world(on, {
        [AREAS]: 'chords cli fleet herdr memory mods pm speak stray trophy-sys'
            .split(' ')
            .join('\n'),
    });
    await start($);
    const ops = [...registered.described.matchAll(/^op (\w+)/gmu)].map(
        (m) => m[1],
    );
    expect([
        registered.described.length <= 4096,
        // the retired name is in no line of its own; the glide line's items keep theirs
        /\btext\b/u.test(registered.described.split('\nop glide')[0] ?? ''),
        ops,
    ]).toEqual([
        true,
        false,
        ['add', 'resolve', 'follow', 'assume', 'plan', 'glide'],
    ]);
});

test("orbit's text names the required area and why, and from with every starter", async ($, on) => {
    world(on, { [AREAS]: 'chords 🎹\nspeak 🎙️\n' });
    await start($);
    const add = registered.described.match(/^op add.*$/mu)?.[0] ?? '';
    expect(add).toContain('area, required: chords, speak;');
    expect(add).toContain('why, required: 2+ words;');
    expect(add).toContain(
        "from: a starter not you, { who: crow, wishkeeper, codie, sixth sense, wing N, main clio, designer, helga, dima's rule, plain cc }",
    );
});

for (const [what, line, words] of [
    [
        'the note never holds what dima must read or pick',
        'add',
        'never what he must read or pick',
    ],
    [
        'a list for dima goes in the body',
        'add',
        'a list for him is bullets or numbers in the body, a longer one in a file',
    ],
    [
        'a file for dima goes in link, named in the body',
        'add',
        'a file or page in link (https/obsidian:// url or path), named in words in body; pictures to compare: one in link, the rest as paths in body.',
    ],
    [
        'an ask is a title, its topic, and a body, the fact that decides',
        'add',
        "asks: title: the topic, led by its area's emoji, ≤7 words, ≤45 chars, no backtick; body ≤200 chars, the fact that decides, crew names and deciding words **bold**, readable alone",
    ],
    ['a pick is the action', 'add', 'pick: your recommendation, the action;'],
    [
        'a follow carries a title and a body',
        'follow',
        'id, title, body, pick, area, why, from|null:',
    ],
    [
        'an ask reads plain',
        'add',
        'plain: what happens for him, no plan number («(24)») or unexplained label',
    ],
    [
        'an ask has a kind, look or test',
        'add',
        'kind: look (ready, only his check is left) or test (he probes something), both pinned;',
    ],
    [
        'an ask for his hands links its steps',
        'add',
        'an ask for his hands links a file of plain numbered steps;',
    ],
    [
        "a running lane's card stays until its plan is ticked",
        'glide',
        "a running lane's card stays until every plan line is ticked",
    ],
    [
        "a parked lane's card stays through the halt",
        'glide',
        "a parked lane's through the halt",
    ],
    [
        'a fixing follow hides a look or a test',
        'follow',
        'on a look or test a why opening «fixing» hides it, your next follow shows it',
    ],
    [
        'an ask goes up as soon as it is known',
        'when',
        "known, at the turn's start before the work, mid-turn at once: his tick slipstreams into a running turn, and the turn goes on with",
    ],
    [
        'a guarded ask names its target in plain words',
        'guard',
        'names its target in plain words, the pick quotes it whole',
    ],
    ['a --bg session sets no phases', 'plan', 'a --bg session sets neither'],
] as const)
    test(`orbit's text says ${what}`, async ($, on) => {
        world(on);
        await start($);
        expect(
            registered.described.match(
                new RegExp(`^(?:op )?${line}\\b.*$`, 'mu'),
            )?.[0],
        ).toContain(words);
    });

/* brief 8 item 1: an ask carries one link dima opens in a click */

test('a link that is neither an https url nor a file path is refused, and no ask lands', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await addLinked($, 'javascript:alert(1)');
    expect([r.deny, w.store.has('asks:o1o1o1o1-orbit')]).toEqual([
        'orbit add: «the proposal for the catch kinds»: link «javascript:alert(1)» is neither an https url, an obsidian://open url nor a file path (/… or ~/…)',
        false,
    ]);
});

test('an obsidian:// link that writes (new, overwrite) is refused, and no ask lands', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await addLinked(
        $,
        'obsidian://new?vault=v&file=_hq%2Finbox&overwrite=true',
    );
    expect([r.deny, w.store.has('asks:o1o1o1o1-orbit')]).toEqual([
        'orbit add: «the proposal for the catch kinds»: link «obsidian://new?vault=v&file=_hq%2Finbox&» is neither an https url, an obsidian://open url nor a file path (/… or ~/…)',
        false,
    ]);
});

test('an http url, a file:// url and a bare word are still refused as links', async ($, on) => {
    world(on);
    await start($);
    for (const link of ['http://x.test/a', 'file:///etc/passwd', 'inbox.md'])
        expect((await addLinked($, link)).deny).toContain(
            'is neither an https url',
        );
});

// FRM-544 slice 1: x-herdr-deck draws the gated mark the stash publishes, never its own copy of the pattern
test('a gated ask carries isGated in the store, a plain ask none', async ($, on) => {
    const w = world(on);
    await start($);
    const asks = [
        {
            area: 'mods',
            pick: 'run it',
            text: '⚠️ mirror: `git push --mirror origin`',
            why: 'a test ask',
        },
        {
            area: 'mods',
            pick: 'merge it',
            text: 'test: merge https://github.com/x/y/pull/7 at abc1234',
            why: 'a test ask',
        },
        ...addOf(
            { pick: 'run `git push -n`' },
            { pick: 'yes, `main`' },
            { body: 'a ` b\nc ` d' },
        ).asks,
    ];
    await orbit($, { asks, op: 'add' });
    const items = (
        w.store.get('asks:o1o1o1o1-orbit') as {
            items: { isGated?: boolean; text: string }[];
        }
    ).items;
    expect(items.map((a) => a.isGated)).toEqual([
        true,
        true,
        true,
        undefined,
        undefined,
    ]);
});

test('orbit registers loaded up front, never behind ToolSearch', async ($, on) => {
    world(on);
    await start($);
    expect(registered.isDeferred).toBe(false);
});

/* a tick lands at once: no sending state, no delay field */

// the engine drops an argument its schema does not name: an arg missing here reaches no op (clio, 21:08)
test("orbit's schema names every argument its ops read", async ($, on) => {
    world(on);
    await start($);
    const props = registered.schema.properties ?? {};
    const inner = (name: string) =>
        Object.keys(props[name]?.items?.properties ?? {}).sort();
    expect([
        [
            'act',
            'area',
            'asks',
            'body',
            'current',
            'from',
            'id',
            'ids',
            'items',
            'lines',
            'op',
            'ops',
            'pick',
            'plan',
            'role',
            'session',
            'text',
            'texts',
            'title',
            'why',
            'words',
        ].filter((name) => !(name in props)),
        inner('asks'),
        props.asks?.items?.required,
        inner('ops').includes('text'),
        props.act?.enum,
    ]).toEqual([
        [],
        [
            'area',
            'body',
            'from',
            'hiddenNote',
            'kind',
            'link',
            'pick',
            'text',
            'title',
            'why',
        ],
        // a required title would refuse a session still sending `text`
        ['pick', 'area', 'why'],
        true,
        ['create', 'edit', 'link', 'step', 'end'],
    ]);
});

for (const words of [{}, { o1: 'shipped' }, { o1: 'landed as planned' }])
    test(`a ticked ask's resolve with neither «as ticked» nor «changed:» is refused: ${JSON.stringify(words)}`, async ($, on) => {
        const w = world(on);
        await start($);
        const ui = await ticked($, w);
        const r = await orbit($, { ids: ['o1'], op: 'resolve', words });
        await endTurn($);
        expect([r.deny, await asksShown(ui)]).toEqual([
            expect.stringMatching(/o1 was ticked.*as ticked.*changed:/),
            ['o1'],
        ]);
    });

test('a ticked ask resolved «as ticked» leaves', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await ticked($, w);
    const r = await orbit($, {
        ids: ['o1'],
        op: 'resolve',
        words: { o1: 'as ticked: renamed' },
    });
    await endTurn($);
    await say($, 'next');
    await endTurn($);
    expect([r.deny, await asksShown(ui)]).toEqual([undefined, []]);
});

test('a ticked ask resolved «changed:» alone is refused, naming the follow', async ($, on) => {
    const w = world(on);
    await start($);
    await ticked($, w);
    const r = await orbit($, {
        ids: ['o1'],
        op: 'resolve',
        words: { o1: 'changed: kept the old name' },
    });
    expect(r.deny).toMatch(/follow or an add in the same call/);
});

test('a ticked ask resolved «changed:» beside a follow lands both', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await ticked($, w);
    const r = await orbit($, {
        ops: [
            {
                ids: ['o1'],
                op: 'resolve',
                words: { o1: 'changed: the bars stay, the name moves' },
            },
            { id: 'o1', op: 'follow', pick: 'pulse', text: 'name the band v2' },
        ],
    });
    expect([r.deny, await asksShown(ui), await texts(ui)]).toEqual([
        undefined,
        ['o1'],
        expect.stringContaining('name the band v2'),
    ]);
});

test('an unticked ask resolves with no word, as before', async ($, on) => {
    world(on);
    await start($);
    await add($, ['name the band', 'breathing bars']);
    const r = await orbit($, { ids: ['o1'], op: 'resolve' });
    expect(r.deny).toBeUndefined();
});

// o83: one call carries many ops; each reports, and a refused one leaves the rest landed
test('one call carrying an add, a resolve and a plan lands all three', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    const r = await orbit($, {
        ops: [
            {
                asks: [
                    {
                        area: 'mods',
                        pick: 'yes',
                        text: 'trash the probe',
                        why: 'a test ask',
                    },
                ],
                op: 'add',
            },
            { ids: ['o1'], op: 'resolve' },
            { lines: ['now: build', 'next: test'], op: 'plan' },
        ],
    });
    await endTurn($);
    expect([
        String(r.result),
        await asksShown(ui),
        (await texts(ui)).includes('now: build'),
    ]).toEqual([
        expect.stringMatching(
            /1 add: added o2.*\n2 resolve: resolved o1\n3 plan: plan set/s,
        ),
        ['o2'],
        true,
    ]);
});

test('a call whose resolve is refused reports per op, the other ops landing', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await ticked($, w);
    const r = await orbit($, {
        ops: [
            {
                asks: [
                    {
                        area: 'mods',
                        pick: 'yes',
                        text: 'trash the probe',
                        why: 'a test ask',
                    },
                ],
                op: 'add',
            },
            { ids: ['o1'], op: 'resolve' },
            { lines: ['now: build'], op: 'plan' },
        ],
    });
    expect([String(r.result), await asksShown(ui)]).toEqual([
        expect.stringMatching(
            /2 resolve: refused — orbit resolve: o1 was ticked/,
        ),
        ['o1', 'o2'],
    ]);
});

test('a call whose every op is refused is refused', async ($, on) => {
    world(on);
    await start($);
    const r = await orbit($, {
        ops: [{ op: 'nope' }, { id: 'o9', op: 'follow' }],
    });
    expect(r.deny).toMatch(/1 nope: refused.*\n2 follow: refused/s);
});

test('with assumed switched off, op assume is refused in one line naming the switch', async ($, on) => {
    const w = world(on);
    await start($);
    partOff(w, 'stash.assumed');
    const r = (await assume($, 'kept the old port')) as { deny?: string };
    expect([r.deny?.includes('\n'), r.deny]).toEqual([
        false,
        expect.stringContaining(
            'assumed section is switched off in 🎛️ settings',
        ),
    ]);
});

test('with 🌔 phases switched off, op plan is refused in one line naming the switch', async ($, on) => {
    const w = world(on);
    await start($);
    partOff(w, 'stash.phases');
    const r = (await orbit($, { lines: ['now: a'], op: 'plan' })) as {
        deny?: string;
    };
    expect([r.deny?.includes('\n'), r.deny]).toEqual([
        false,
        expect.stringContaining('🌔 phases is switched off in 🎛️ settings'),
    ]);
});

test("a --bg session's plan op answers that phases are off there and stores none, its add lands", async ($, on) => {
    const w = bgWorld(on);
    await start($);
    const r = await orbit($, { lines: ['now: a'], op: 'plan', step: 2 });
    const kept = [...w.store.keys()];
    await add($, ['push FRM-1', 'yes']);
    await endTurn($);
    const asks = w.store.get(`asks:${SID}`) as { items?: { id: string }[] };
    expect([
        r,
        kept.filter((k) => /^(?:kept|lane-step):/.test(k)),
        asks?.items?.map((a) => a.id),
    ]).toEqual([
        expect.objectContaining({ result: 'phases are off in --bg' }),
        [],
        ['o1'],
    ]);
});

// review round 1: «changed:» needs a follow or an add that lands, never one the same call refuses
for (const [why, follow] of [
    ['refused', { id: 'o9', text: 'no such ask' }],
    // he sees no new round of an ask that hides
    ['«fixing»', { id: 'o1', text: 'look: the bars', why: 'fixing the wrap' }],
] as const)
    test(`a «changed:» resolve beside a ${why} follow is refused`, async ($, on) => {
        const w = world(on);
        await start($);
        await ticked($, w);
        const r = (await orbit($, {
            ops: [
                {
                    ids: ['o1'],
                    op: 'resolve',
                    words: { o1: 'changed: renamed' },
                },
                { op: 'follow', pick: 'x', ...follow },
            ],
        })) as { deny?: string; result?: string };
        expect(r.deny ?? r.result).toMatch(
            /1 resolve: refused.*follow or an add/s,
        );
    });

// dima, 2026-10-28 15:33: the 🐠 catch shelf is gone, settings row included — «full delete but surgical»
test('orbit has no catch op: the schema names none, a call is refused as unknown', async ($, on) => {
    world(on);
    await start($);
    const props = registered.schema.properties ?? {};
    const r = await orbit($, {
        op: 'catch',
        pieces: [{ hiddenNote: 'n', kind: '💡', text: 'f1' }],
    });
    expect([
        (props.op?.enum ?? []).includes('catch'),
        'pieces' in props || 'clear' in props,
        /\bcatch\b/.test(registered.described),
        r.deny,
    ]).toEqual([
        false,
        false,
        false,
        expect.stringMatching(/op is .*got «catch»/),
    ]);
});

const denied = (r: unknown) => String((r as { deny?: string }).deny ?? '');

const URL = 'https://github.com/o/n/pull/7';

for (const [what, text, pick] of [
    [
        'a sign pick on a text without the sign shape',
        'sign FRM-1 please',
        'signed',
    ],
    ['a merge pick on a text naming no pr', 'merge frame#7 please', 'merge'],
    ['a merge ask naming no head', '⚠️ merge frame#7: the title', 'merge'],
    [
        'a merge ask with no clean for its pr',
        `⚠️ merge ${URL} at abc1234`,
        'merge',
    ],
] as const)
    test(`add takes ${what}`, async ($, on) => {
        world(on);
        await start($);
        expect(denied(await add($, [text, pick]))).toBe('');
    });

test('follow takes a sign pick on a text without the shape', async ($, on) => {
    world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    const r = await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'signed',
        text: 'sign it',
    });
    expect(denied(r)).toBe('');
});

for (const [what, text, pick] of [
    ['a pick holding sign-in', 'push FRM-1', 'sign-in flow first'],
    ['a pick holding signed-in', 'push FRM-1', 'signed-in flow first'],
    ['a pick reading signed in', 'push FRM-1', 'signed in already'],
    ['a pick with no need', 'push FRM-1', 'no need to re-sign'],
    ['one id', '✍️ sign FRM-1: the title', 'signed'],
    ['a batch', '✍️ sign FRM-1, BYT-2: the titles', 're-signed'],
    ['no sign word in the pick', 'push FRM-1', 'yes'],
    ['a word holding it', 'design FRM-1', 'designed as drawn'],
    ['a sign word that signs nothing', 'push FRM-1', 'sign in first'],
    ['a pick that never signs', 'push FRM-1', 'never signed'],
    ['a pick that does not sign', 'push FRM-1', 'not signed yet'],
    ['a pick that does not re-sign', 'push FRM-1', 'not re-signed yet'],
    // FRM-519 item 12: two of the 11 recorded false refusals, on non-sign asks
    ['a pick needing no re-sign', 'push FRM-1', "doesn't need a re-sign"],
    ['a pick not signed yet', 'push FRM-1', 'not yet signed'],
    // sixth sense round 9 on 59feb7c8: a negation a few words off, or trailing
    ['a pick with no need for one', 'push FRM-1', 'no need for a re-sign'],
    ['a pick that needs none', 'push FRM-1', 're-sign not needed'],
] as const)
    test(`add passes ${what}`, async ($, on) => {
        world(on);
        await start($);
        expect(denied(await add($, [text, pick]))).toBe('');
    });

for (const [what, text, pick] of [
    ['a word holding it', 'push FRM-1', 'submerge it'],
    ['a pick that does not merge', 'push FRM-1', 'do not merge yet'],
    ['a pick that holds the merge', 'push FRM-1', "don't merge yet"],
    ['a pick that holds it, typed curly', 'push FRM-1', 'don’t merge yet'],
    ['a pick that never merges', 'push FRM-1', 'never merge it'],
    ['a pick of no merge', 'push FRM-1', 'no merge tonight'],
    [
        'a sign ask whose pick names its merge',
        '✍️ sign FRM-511: the title',
        'signed, its merge on your word',
    ],
    [
        'a merge word that names no pr',
        'FRM-360 into FRM-387',
        'merge: you made 0 rows',
    ],
    ['no merge word in the pick', 'merge frame#7 please', 'yes'],
    // FRM-519 item 12: recorded false refusals, a merge of text and a merge-auto pick
    [
        'a merge of one text into another',
        'nurture-skills joins the plan',
        'yes: merge nurture-skills into step 9',
    ],
    [
        'a merge-auto pick on a quoted command',
        '⚠️ land: `x lane merge-auto 104 --apply`',
        'merge-auto when green',
    ],
] as const)
    test(`add passes ${what}`, async ($, on) => {
        world(on);
        await start($);
        expect(denied(await add($, [text, pick]))).toBe('');
    });

/* FRM-510: his press is never lost. every get of one dispatch reads one moment (engine.md), so a hook running while he
   presses reads the orbit from before the press; `frozen` serves that old copy, and writes keeps what landed */

// FRM-649 exit 1 (FRM-616:W10): one ask counter for the fleet, minted under a lock dir beside the shelf, so two threads
// asking at once never both hand out o1; it starts at 1 again once no thread holds an open ask
// `alive`: the pids ps reports alive, so a registry row counts as a live session
const lockDirs = (
    on: On,
    { alive = [] as number[], isHeld = false, onUnlock = () => {} } = {},
) => {
    const dirs = new Set<string>(
        isHeld ? ['/home/.claude/shelf/ask-counter.lock'] : [],
    );
    on('process.run', (_$, e) => {
        const [cmd, path = ''] = e.argv;
        if (cmd === 'ps')
            return {
                value: {
                    exitCode: 0,
                    isStderrTruncated: false,
                    isStdoutTruncated: false,
                    stderr: '',
                    stdout: alive.join('\n'),
                },
            };
        const isTaken = cmd === 'mkdir' && !dirs.has(path);
        if (isTaken) dirs.add(path);
        if (cmd === 'rmdir') {
            onUnlock();
            dirs.delete(path);
        }
        return {
            value: {
                exitCode: cmd === 'mkdir' && !isTaken ? 1 : 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: '',
            },
        };
    });
    return dirs;
};

test("an ask takes the fleet's next id while another thread holds an open one", async ($, on) => {
    const w = world(on, {
        '/home/.claude/sessions/777.json': JSON.stringify({
            pid: 777,
            sessionId: 'other-thread',
        }),
    });
    const dirs = lockDirs(on, { alive: [777] });
    w.store.set('ask-counter', { next: 5 });
    w.store.set('asks:other-thread', {
        asks: ['its ask'],
        items: [{ id: 'o4' }],
    });
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    expect([
        await asksShown(ui),
        w.store.get('ask-counter'),
        dirs.size,
    ]).toEqual([['o5', 'o6'], { next: 7 }, 0]);
});

// a second thread that takes the lock the moment it frees reads this thread's ask, so it never restarts at the o1 just
// minted (macroscope on herdr's slice 6: a publish after the unlock let two threads mint one id)
test('the minted ask is published before the counter lock frees', async ($, on) => {
    const w = world(on);
    const seen: string[][] = [];
    lockDirs(on, {
        onUnlock: () =>
            seen.push([...w.store.keys()].filter((k) => k.startsWith('asks:'))),
    });
    await start($);
    await add($, ['push FRM-1', 'yes']);
    expect(seen.map((keys) => keys.length)).toEqual([1]);
});

test("a gone session's ask left in the store holds no count", async ($, on) => {
    const w = world(on, {
        '/home/.claude/sessions/778.json': JSON.stringify({
            pid: 778,
            sessionId: 'gone-thread',
        }),
    });
    lockDirs(on);
    w.store.set('ask-counter', { next: 9 });
    w.store.set('asks:gone-thread', {
        asks: ['its ask'],
        items: [{ id: 'o8' }],
    });
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    expect(await asksShown(ui)).toEqual(['o1']);
});

test('with no open ask anywhere the count starts at 1 again', async ($, on) => {
    const w = world(on);
    lockDirs(on);
    w.store.set('ask-counter', { next: 9 });
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    expect(await asksShown(ui)).toEqual(['o1']);
});

test('a restart skips an id this thread still draws, a resolved ask dimmed for one more turn', async ($, on) => {
    world(on);
    lockDirs(on);
    await start($);
    const ui = await board($);
    await say($, 'go');
    await add($, ['push FRM-1', 'yes']);
    await orbit($, { ids: ['o1'], op: 'resolve', words: { o1: 'landed' } });
    await add($, ['rename the band', 'later']);
    expect(await asksShown(ui)).toEqual(['o1', 'o2']);
});

test('a counter lock another thread holds refuses the add, never mints a local id', async ($, on) => {
    world(on);
    lockDirs(on, { isHeld: true });
    await start($);
    const r = (await add($, ['push FRM-1', 'yes'])) as { deny?: string };
    expect(r.deny).toMatch(/ask counter is held/);
});
