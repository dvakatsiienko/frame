import type { On } from 'claude-code';

import { addLinked, assume, hrefs, typed } from './orbit-helpers.ts';
import {
    type Board,
    SID,
    add,
    asksShown,
    board,
    orbit,
    say,
    start,
    world,
} from './orbit-world.ts';
import { expect, test } from './shared-boot.ts';

const origin = (who: string, rest: Record<string, string> = {}) => ({
    from: { who, ...rest },
    why: 'it rang twice',
});

test('asks the tool adds list in orbit oldest first, each by its id', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the old probe', 'yes']);
    await add($, ['rename the band', 'later']);
    expect(await asksShown(ui)).toEqual(['o1', 'o2', 'o3']);
});

test("an ask's row reads its text and clio's pick", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push the branch to main', 'yes, now']);
    expect(
        (await ui.find({ key: 'orbit:ask:o1', type: 'Box' }))?.text,
    ).toContain('push the branch to main➡️ yes, now');
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

test('a joined ask keeps its buttons but no steer field while the turn runs', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await ui.input({ key: 'orbit:steer:o1', text: 'after ci' });
    await say($, 'go');
    const keys = (await ui.findAll({})).map((n) => n.key ?? '');
    expect([
        keys.filter((k) => /^orbit:(accepted|rejected|steer|read):o1$/.test(k)),
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
    expect([held, await take()]).toEqual(['🔓 tick', '🔓 tick']);
});

test('a held mark swaps its emoji for ✅, and only one of the two holds it', async ($, on) => {
    const w = world(on);
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
    await w.clock.advance(5_000);
    const taken = await look();
    await ui.press({ key: 'orbit:rejected:o1' });
    await w.clock.advance(5_000);
    expect([idle, taken, await look()]).toEqual([
        ['🛎️ tick|primary', '🔁 replay|-'],
        ['✅ tick|primary', '🔁 replay|-'],
        ['🛎️ tick|primary', '✅ replay|-'],
    ]);
});

test('a resolved ask reads its closing word on a line of its own under it', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await orbit($, { ids: ['o1'], op: 'resolve', words: { o1: 'landed' } });
    const box = await ui.find({ key: 'orbit:ask:o1', type: 'Box' });
    expect([
        box?.props.flexDirection,
        (await ui.find({ text: '➡️ landed', type: 'Text' }))?.text,
    ]).toEqual(['column', '➡️ landed']);
});

test('the orbit card is bordered a soft grey on the desktop', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['a one', 'x']);
    expect(
        (await ui.find({ key: 'orbit', type: 'Box' }))?.props.borderColor,
    ).toBe('#8080804d');
});

test('🔁 replay reads ✅ replay at once', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:rejected:o1' });
    expect((await ui.find({ key: 'orbit:rejected:o1' }))?.text).toBe(
        '✅ replay',
    );
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
    expect(row?.text?.startsWith('👀 o1 mods:')).toBe(true);
});

// FRM-645: an ask that needs his eyes or hands sits on top, led by its kind's emoji
test('look asks draw first, then test asks, then the rest, each led by its emoji, his row over the built-in one', async ($, on) => {
    const w = world(
        on,
        typed({
            'stash.orbit.look.emoji': ' ',
            'stash.orbit.test.emoji': '🔭',
        }),
    );
    await start($);
    const ui = await board($);
    await add(
        $,
        ['a plain one', 'x'],
        ['test: press it', 'x'],
        ['a plain two', 'x'],
        ['look: the card', 'x'],
    );
    await w.clock.advance(5_000);
    const rows = await Promise.all(
        (await asksShown(ui)).map(
            async (id) =>
                (
                    await ui.find({ key: `orbit:ask:${id}`, type: 'Box' })
                )?.text?.split('➡️')[0],
        ),
    );
    expect(rows).toEqual([
        '👀 o4 mods: the card',
        '🔭 o2 mods: press it',
        'o1 mods: a plain one',
        'o3 mods: a plain two',
    ]);
});

test('a look ask answered this turn leads with ✅, never 👀', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['look: the card', 'x']);
    await say($, 'go');
    const read = async () =>
        (await ui.find({ key: 'orbit:ask:o1', type: 'Box' }))?.text?.split(
            '➡️',
        )[0];
    const before = await read();
    await orbit($, { ids: ['o1'], op: 'resolve' });
    expect([before, await read()]).toEqual([
        '👀 o1 mods: the card',
        '✅ o1 mods: look: the card',
    ]);
});

test('a ticket id in an ask opens its linear page', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['close FRM-381 after the sixth sense', 'yes']);
    expect(await hrefs(ui)).toContain('https://linear.app/x-com/issue/FRM-381');
});

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

test('with read-aloud on assumptions off, an assumption draws no 🔊', async ($, on) => {
    const w = world(on);
    w.store.set('speak-assumed', false);
    await start($);
    const ui = await board($);
    await orbit($, { op: 'assume', texts: ['moons repeat'] });
    expect(await ui.find({ key: 'orbit:read:a1' })).toBe(undefined);
});

test("an ask's https link draws as a link to that url", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await addLinked($, 'https://github.com/x/y/pull/7');
    expect(
        (await ui.find({ text: '🔗 github.com', type: 'Link' }))?.props.href,
    ).toBe('https://github.com/x/y/pull/7');
});

test("an ask's file link opens through open, its ~ the home dir", async ($, on) => {
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
                stdout: '',
            },
        };
    });
    await start($);
    const ui = await board($);
    await addLinked($, '~/frame/.scratch/catch/kinds.md');
    const label = (await ui.find({ key: 'ask:link:o1', type: 'Button' }))?.text;
    await ui.press({ key: 'ask:link:o1' });
    expect([label, runs.at(-1)]).toEqual([
        '🔗 kinds.md',
        ['open', '/home/frame/.scratch/catch/kinds.md'],
    ]);
});

// FRM-426 rider: a vault note can be linked from an ask
function openRuns(on: On) {
    const runs: string[][] = [];
    on('process.run', (_$, e) => {
        runs.push([...e.argv]);
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: '',
            },
        };
    });
    return runs;
}

test("an ask's file link may hold spaces, as an iCloud vault path does", async ($, on) => {
    world(on);
    const runs = openRuns(on);
    await start($);
    const ui = await board($);
    await addLinked(
        $,
        '~/Library/Mobile Documents/iCloud~md~obsidian/Documents/vault/_hq/the inbox.md',
    );
    const label = (await ui.find({ key: 'ask:link:o1', type: 'Button' }))?.text;
    await ui.press({ key: 'ask:link:o1' });
    expect([label, runs.at(-1)]).toEqual([
        '🔗 the inbox.md',
        [
            'open',
            '/home/Library/Mobile Documents/iCloud~md~obsidian/Documents/vault/_hq/the inbox.md',
        ],
    ]);
});

test("an ask's obsidian:// link opens through open, labelled by its note", async ($, on) => {
    world(on);
    const runs = openRuns(on);
    await start($);
    const ui = await board($);
    const url = 'obsidian://open?vault=vault&file=_hq%2Finbox';
    await addLinked($, url);
    const label = (await ui.find({ key: 'ask:link:o1', type: 'Button' }))?.text;
    await ui.press({ key: 'ask:link:o1' });
    expect([label, runs.at(-1)]).toEqual(['🔗 inbox', ['open', url]]);
});

test('an obsidian:// link with a stray % still draws, labelled by the raw note', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await addLinked($, 'obsidian://open?vault=v&file=100%');
    expect((await ui.find({ key: 'ask:link:o1', type: 'Button' }))?.text).toBe(
        '🔗 100%',
    );
});

test('a tick reads ✅ tick at once', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    expect((await ui.find({ key: 'orbit:accepted:o1' }))?.text).toBe('✅ tick');
});

test("an ask's row puts its steer before its file link (dima, 20:57)", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, {
        asks: [
            {
                area: 'mods',
                link: '/tmp/proposal.md',
                pick: 'apply',
                text: 'r34 groom',
                why: 'a test ask',
            },
        ],
        op: 'add',
    });
    // the harness keeps no text or key on a row's children (mods/engine.md): the steer is the one Box, the link a Button
    const row = await ui.find({ key: 'orbit:row:o1' });
    const types = (row?.children ?? []).map(
        (c) => (c as { type?: string }).type,
    );
    expect(types.slice(-2)).toEqual(['Box', 'Button']);
});

/* o84: dima reorders, ticks and steers the phases on the board */

/* FRM-670: ask origin, the area before the text and the muted line under the pick */

test('an ask draws its area before its text and who started it and why under its pick', async ($, on) => {
    const w = world(on);
    const asks: [Record<string, unknown>, string, string][] = [
        [
            { area: 'speak', areaEmoji: '🎙️', why: 'it jumps' },
            ' 🎙️ speak: ',
            'it jumps',
        ],
        [{}, ': ', ''],
        [
            origin('codie', { lane: 'mods', ticket: 'FRM-662' }),
            ': ',
            '🔧 mods | FRM-662 · it rang twice',
        ],
        [
            origin('codie', { topic: 'the pill' }),
            ': ',
            '🔧 the pill · it rang twice',
        ],
        [
            origin('sixth sense', { lane: 'mods', ticket: 'FRM-662' }),
            ': ',
            '🔎 mods | FRM-662 · it rang twice',
        ],
        [origin('crow'), ': ', '🐦‍⬛ crow · it rang twice'],
        [origin('wishkeeper'), ': ', '🐬 wishkeeper · it rang twice'],
        [origin('wing 2'), ': ', '🪽 wing 2 · it rang twice'],
        [origin('main clio'), ': ', '🦉 clio · it rang twice'],
        [
            origin('designer', { topic: 'the key map' }),
            ': ',
            '🎨 designer: the key map · it rang twice',
        ],
        [origin('helga'), ': ', '🎀 helga · it rang twice'],
        [origin("dima's rule"), ': ', "🙋‍♂️ dima's rule · it rang twice"],
        [origin('plain cc'), ': ', '💻 cc · it rang twice'],
    ];
    w.store.set(`kept:${SID}`, {
        at: w.clock.now(),
        orbit: {
            asks: asks.map(([fields], i) => ({
                id: `o${i}`,
                pick: 'yes',
                text: 'it',
                ...fields,
            })),
            next: 20,
            turns: 1,
        },
    });
    await start($);
    const ui = await board($);
    const drawn = await Promise.all(
        asks.map(
            async (_, i) =>
                (await ui.find({ key: `orbit:ask:o${i}`, type: 'Box' }))?.text,
        ),
    );
    // the harness reads a link as its url, then its label
    expect(
        drawn.map(
            (t) =>
                t
                    ?.replaceAll(/https:\S+\/issue\/FRM-\d+(?=FRM)/g, '')
                    .split('🛎️')[0],
        ),
    ).toEqual(asks.map(([, head, line], i) => `o${i}${head}it➡️ yes${line}`));
    const muted = (await ui.findAll({ type: 'Text' })).find((t) =>
        t.text?.startsWith('🐦‍⬛'),
    );
    expect(muted?.props.dimColor).toBe(true);
});
