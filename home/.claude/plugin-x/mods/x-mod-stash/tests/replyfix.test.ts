import { type Engine, expect, test } from 'claude-code/testing';

import { dropWaitAside, linkTickets, numberCircled } from '../hooks/parse.ts';
import { SID, add, orbit, say, start, world } from './orbit-world.ts';

const L = (id: string) => `[${id}](https://linear.app/x-com/issue/${id})`;

for (const [why, from, to] of [
    [
        'a run of circled digits',
        'next: ① build ② test ③ ship',
        'next:\n1. build\n2. test\n3. ship',
    ],
    ['a run that opens the line', '① a ② b', '1. a\n2. b'],
    ['a bullet keeps its indent', '  ① a ② b', '  1. a\n  2. b'],
    ['a run past ⑨', '⑨ a ⑩ b', '9. a\n10. b'],
] as const)
    test(`numberCircled: ${why} becomes numbered lines`, () => {
        expect(numberCircled(from)).toBe(to);
    });

for (const [why, text] of [
    ['a lone circled digit', 'step ② is the slow one'],
    ['a fence', '```\n① a ② b\n```'],
    ['inline code', 'the glyphs `① ②` are banned'],
    ['the 📄 stamp', '📄 last report: ① a ② b'],
] as const)
    test(`numberCircled: ${why} stays as written`, () => {
        expect(numberCircled(text)).toBe(text);
    });

for (const [why, from, to] of [
    ['a bare FRM id', 'see FRM-385 for it', `see ${L('FRM-385')} for it`],
    [
        'a bare BYT id and an FRM one',
        'BYT-12, FRM-3.',
        `${L('BYT-12')}, ${L('FRM-3')}.`,
    ],
] as const)
    test(`linkTickets: ${why} becomes its link`, () => {
        expect(linkTickets(from)).toBe(to);
    });

for (const [why, text] of [
    [
        'an id already linked',
        `[FRM-385](https://linear.app/x-com/issue/FRM-385): glide`,
    ],
    ['an id in a url', 'https://linear.app/x-com/issue/FRM-385'],
    ['an id in a url query', 'https://x.dev/search?q=FRM-385'],
    ['an id in inline code', 'the line `- ticket: FRM-385`'],
    ['an id in a fence', '```\n- ticket: FRM-385\n```'],
    ['an id inside a longer word', 'XFRM-385 and FRM-385a'],
    ['an id in a path', 'docs/FRM-385.md'],
] as const)
    test(`linkTickets: ${why} stays as written`, () => {
        expect(linkTickets(text)).toBe(text);
    });

for (const [why, from, to] of [
    ['an aside', '🔭 waiting on ci (a ping when it lands)', '🔭 waiting on ci'],
    [
        'an aside in a bullet',
        '- 🔭 waiting on **clio** (her halt)',
        '- 🔭 waiting on **clio**',
    ],
    [
        'an aside beside a link',
        '🔭 waiting on [🐙 pr](https://x.dev/pr/1) (review)',
        '🔭 waiting on [🐙 pr](https://x.dev/pr/1)',
    ],
] as const)
    test(`dropWaitAside: ${why} leaves the 🔭 line`, () => {
        expect(dropWaitAside(from)).toBe(to);
    });

for (const [why, text] of [
    ['a link url', '🔭 waiting on [ci](https://x.dev/runs/(1))'],
    ['a paren on a line that is no 🔭 line', 'done (mostly)'],
    ['a 🔭 in a fence', '```\n🔭 waiting on ci (aside)\n```'],
] as const)
    test(`dropWaitAside: ${why} stays as written`, () => {
        expect(dropWaitAside(text)).toBe(text);
    });

test('the Stop passes with 🪐 orbit switched off, an ask open and a wrap_up ask', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    w.store.set('shown', { 'stash.orbit': false });
    await say($, 'go');
    await wrapUp($, 'Commit now?');
    expect((await stop($)).block).toBeUndefined();
});

// PK-227: one home for the next move — a wrap_up ask while an orbit ask is open reds the Stop once
const WRAP_UP = 'mcp__ccd_turn__wrap_up';

const stop = ($: Engine, text = 'done.', isActive = false) =>
    $.classic.Stop({
        last_assistant_message: text,
        session_id: SID,
        stop_hook_active: isActive,
    } as never);

const wrapUp = ($: Engine, ask?: string) =>
    $.tool.call({
        ...(ask ? { ask } : {}),
        recap: 'shipped',
        tool: WRAP_UP,
    } as never);

test('a wrap_up carrying an ask while an orbit ask is open reds the Stop, naming the ask', async ($, on) => {
    world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'go');
    await wrapUp($, 'Commit now?');
    const r = await stop($);
    expect(r.block).toMatch(/wrap_up.*o1.*push FRM-1/s);
});

for (const [why, run] of [
    [
        'no open orbit ask',
        async ($: Engine) => {
            await say($, 'go');
            await wrapUp($, 'Commit now?');
        },
    ],
    [
        'a wrap_up with no ask',
        async ($: Engine) => {
            await add($, ['push FRM-1', 'yes']);
            await say($, 'go');
            await wrapUp($);
        },
    ],
] as const)
    test(`the Stop passes with ${why}`, async ($, on) => {
        world(on);
        await start($);
        await run($);
        expect((await stop($)).block).toBeUndefined();
    });

test('the turn right after its own red passes: no loop', async ($, on) => {
    world(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'go');
    await wrapUp($, 'Commit now?');
    await stop($);
    // the continuation the red woke repeats the wrap_up ask; it still passes
    await wrapUp($, 'Commit now?');
    expect((await stop($, 'fixed.', true)).block).toBeUndefined();
});

test('a --bg session passes: its asks go to its coordinator', async ($, on) => {
    world(on, {
        '/home/.claude/sessions/4242.json': JSON.stringify({
            kind: 'bg',
            name: 'probe',
            pid: 4242,
        }),
    });
    on('process.run', () => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: '4242\nMon Oct 12 15:00:00 2026\n',
        },
    }));
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'go');
    await wrapUp($, 'Commit now?');
    expect((await stop($)).block).toBeUndefined();
});

// the 10-25 rider: a grill's Q asks go out with their round — an add opening «Q<n>» needs «❓ **Q<n>**» in the reply
test('an orbit add opening «Q2» passes, and a reply lacking «❓ **Q2**» reds the Stop', async ($, on) => {
    world(on);
    await start($);
    await say($, 'grill me');
    const r = await orbit($, {
        asks: [{ pick: 'a', text: 'Q2 which door for the tick record?' }],
        op: 'add',
    });
    expect([r.deny, (await stop($, 'asked in orbit.')).block]).toEqual([
        undefined,
        expect.stringMatching(/Q2.*❓ \*\*Q2\*\*/s),
    ]);
});

test('a reply printing «❓ **Q2**» passes the Stop', async ($, on) => {
    world(on);
    await start($);
    await say($, 'grill me');
    await orbit($, {
        asks: [{ pick: 'a', text: 'Q2 which door for the tick record?' }],
        op: 'add',
    });
    expect(
        (await stop($, '❓ **Q2** which door?\n- a) state\n- b) file')).block,
    ).toBeUndefined();
});

test('a round with its title inside the bold passes the Stop, no reprint', async ($, on) => {
    world(on);
    await start($);
    await say($, 'grill me');
    await orbit($, {
        asks: [{ pick: 'a', text: 'Q2 which door for the tick record?' }],
        op: 'add',
    });
    expect(
        (await stop($, '❓ **Q2 - which door**: state or file?')).block,
    ).toBeUndefined();
});

test('a printed «❓ **Q20**» does not stand in for «Q2»', async ($, on) => {
    world(on);
    await start($);
    await say($, 'grill me');
    await orbit($, {
        asks: [{ pick: 'a', text: 'Q2 which door for the tick record?' }],
        op: 'add',
    });
    expect((await stop($, '❓ **Q20** another question')).block).toMatch(
        /Q2.*❓ \*\*Q2\*\*/s,
    );
});
