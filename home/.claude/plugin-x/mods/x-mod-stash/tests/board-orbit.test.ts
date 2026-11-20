import type { On } from 'claude-code';
import { expect, test } from 'claude-code/testing';

import { addLinked, assume, hrefs } from './orbit-helpers.ts';
import {
    type Board,
    add,
    asksShown,
    board,
    orbit,
    say,
    start,
    world,
} from './orbit-world.ts';

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
    expect(row?.text?.startsWith('👀 o1:')).toBe(true);
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
        asks: [{ link: '/tmp/proposal.md', pick: 'apply', text: 'r34 groom' }],
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
