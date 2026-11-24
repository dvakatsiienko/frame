import type { On } from 'claude-code';

import {
    boldFleetWords,
    dropWaitAside,
    linkTickets,
    numberCircled,
} from '../hooks/parse.ts';
import { SID, add, orbit, say, start, world } from './orbit-world.ts';
import { type Engine, expect, mock, test } from './shared-boot.ts';

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
        asks: [
            {
                area: 'mods',
                pick: 'a',
                text: 'Q2 which door for the tick record?',
                why: 'a test ask',
            },
        ],
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
        asks: [
            {
                area: 'mods',
                pick: 'a',
                text: 'Q2 which door for the tick record?',
                why: 'a test ask',
            },
        ],
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
        asks: [
            {
                area: 'mods',
                pick: 'a',
                text: 'Q2 which door for the tick record?',
                why: 'a test ask',
            },
        ],
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
        asks: [
            {
                area: 'mods',
                pick: 'a',
                text: 'Q2 which door for the tick record?',
                why: 'a test ask',
            },
        ],
        op: 'add',
    });
    expect((await stop($, '❓ **Q20** another question')).block).toMatch(
        /Q2.*❓ \*\*Q2\*\*/s,
    );
});

/* the fleet words, bold */

test('a bare fleet word prints bold with its badge', () => {
    expect(boldFleetWords('that becomes a wisp.').text).toBe(
        'that becomes a **✨ wisp**.',
    );
});

test('a plural keeps its badge', () => {
    expect(boldFleetWords('two wisps, then a siesta').text).toBe(
        'two **✨ wisps**, then a **🌤️ siesta**',
    );
});

test('a freebie prints bold with its clover', () => {
    expect(boldFleetWords('do the freebies').text).toBe(
        'do the **🍀 freebies**',
    );
});

test('a wish is bolded as a noun, never as a verb', () => {
    expect(boldFleetWords('i wish it ran; the wish holds').text).toBe(
        'i wish it ran; the **🌠 wish** holds',
    );
});

test('a fleet member prints bold with its badge', () => {
    expect(
        boldFleetWords('clio asks crow; codie and two sixth senses').text,
    ).toBe(
        '**🦉 clio** asks **🐦‍⬛ crow**; **🔧 codie** and two **🔎 sixth senses**',
    );
});

test("dima's name takes his badge, a path through a member's dir keeps its own", () => {
    expect(boldFleetWords("dima's word, read _clio/AGENTS.md").text).toBe(
        "**🙋‍♂️ dima**'s word, read _clio/AGENTS.md",
    );
});

test("a skill name, a quote, a session name and another member's badge keep their words", () => {
    const text = [
        'run clio:halt',
        '«dima, 2026-10-08»',
        'ask ☕️ 🔧 mods codie',
        'ping ⚡ 🔧 mods lane 3 codie: FRM-431',
        'ping 🌗 🔎 cli lane sixth sense: #12',
        'a 🔎 codie',
    ].join('\n');
    expect(boldFleetWords(text).text).toBe(text);
});

test('helga prints bold with her badge', () => {
    expect(boldFleetWords('ask helga to edit').text).toBe(
        'ask **🎀 helga** to edit',
    );
});

test('a badged word only gains the bold', () => {
    expect(boldFleetWords('a ✨ wisp here').text).toBe('a **✨ wisp** here');
});

test('code, fences, bold text, quotes, links and names keep their words', () => {
    const text = [
        'see `wisp` here',
        '```',
        'a wisp',
        '```',
        'the **wisp list** holds',
        '> a wisp in his words',
        '[the stash](https://linear.app/wisp)',
        'x-mod-wisp and wisp.md',
        'stay in the lane',
    ].join('\n');
    expect(boldFleetWords(text).text).toBe(text);
});

test('each rewrite is counted by its word', () => {
    expect(boldFleetWords('a wisp, two wisps, a freebie').hits).toEqual({
        freebie: 1,
        wisp: 2,
    });
});

// the harness keeps no rows: this hook sees what would be stored
function storedWorld(on: On) {
    mock.clock(on, { now: new Date(2026, 9, 8, 13, 58).getTime() });
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
    on('session.id', () => ({ value: 's1s1s1s1-0000' }));
    const stored: string[] = [];
    on('session.append', (_$, e, next) => {
        stored.push(JSON.stringify(e.message.content));
        return next(e);
    });
    return { store, stored };
}

const reply = ($: Engine, text: string) =>
    $.session
        .append({
            door: 'response',
            message: {
                content: [{ text, type: 'text' }],
                role: 'assistant',
                type: 'assistant',
            },
            origin: { kind: 'model', model: 'claude-opus-5-5' },
            uuid: 'u1',
        })
        .catch(() => undefined);

test("a reply's bare fleet word is stored bold", async ($, on) => {
    const w = storedWorld(on);
    await reply($, 'that becomes a wisp');
    expect(w.stored.join()).toContain('that becomes a **✨ wisp**');
});

test("a reply's fleet-word rewrites are counted for the day", async ($, on) => {
    const w = storedWorld(on);
    await reply($, 'a wisp and a freebie');
    await reply($, 'one more wisp');
    expect(w.store.get('words:2026-10-08:s1s1s1s1-0000')).toEqual({
        freebie: 1,
        wisp: 2,
    });
});
