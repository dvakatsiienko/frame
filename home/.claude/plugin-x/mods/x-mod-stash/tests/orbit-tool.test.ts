import type { On } from 'claude-code';
import { expect, test } from 'claude-code/testing';

import {
    addLinked,
    assume,
    partOff,
    texts,
    tickLog,
    ticked,
} from './orbit-helpers.ts';
import {
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
            /^🆕 o1: push the branch once ci is green➡️ after ci🛎️ tick/u,
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
                    { mark: 'accepted', pick: 'yes', text: 'push `origin`' },
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
    world(on);
    await start($);
    const ops = [...registered.described.matchAll(/^op (\w+)/gmu)].map(
        (m) => m[1],
    );
    expect([registered.described.length <= 4096, ops]).toEqual([
        true,
        ['add', 'resolve', 'follow', 'assume', 'plan', 'glide'],
    ]);
});

/* brief 8 item 1: an ask carries one link dima opens in a click */

test('a link that is neither an https url nor a file path is refused, and no ask lands', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await addLinked($, 'javascript:alert(1)');
    expect([r.deny, w.store.has('asks:o1o1o1o1-orbit')]).toEqual([
        'orbit add: link «javascript:alert(1)» is neither an https url, an obsidian://open url nor a file path (/… or ~/…)',
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
        'orbit add: link «obsidian://new?vault=v&file=_hq%2Finbox&» is neither an https url, an obsidian://open url nor a file path (/… or ~/…)',
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
        { pick: 'run it', text: '⚠️ mirror: `git push --mirror origin`' },
        {
            pick: 'merge it',
            text: 'merge https://github.com/x/y/pull/7 at abc1234',
        },
        { pick: 'cut it', text: 'cut the probe?' },
    ];
    await orbit($, { asks, op: 'add' });
    const items = (
        w.store.get('asks:o1o1o1o1-orbit') as {
            items: { isGated?: boolean; text: string }[];
        }
    ).items;
    expect(items.map((a) => a.isGated)).toEqual([true, true, undefined]);
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
            'asks',
            'current',
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
            'words',
        ].filter((name) => !(name in props)),
        inner('asks'),
        props.act?.enum,
    ]).toEqual([
        [],
        ['hiddenNote', 'link', 'pick', 'text'],
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
            { asks: [{ pick: 'yes', text: 'trash the probe' }], op: 'add' },
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
            { asks: [{ pick: 'yes', text: 'trash the probe' }], op: 'add' },
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

// review round 1: «changed:» needs a follow or an add that lands, never one the same call refuses
test('a «changed:» resolve beside a refused follow is refused', async ($, on) => {
    const w = world(on);
    await start($);
    await ticked($, w);
    const r = await orbit($, {
        ops: [
            { ids: ['o1'], op: 'resolve', words: { o1: 'changed: renamed' } },
            { id: 'o9', op: 'follow', pick: 'x', text: 'no such ask' },
        ],
    });
    expect(r.deny).toMatch(/1 resolve: refused.*follow or an add/s);
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
