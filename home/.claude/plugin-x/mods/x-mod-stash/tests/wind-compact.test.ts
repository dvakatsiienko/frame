import type { On } from 'claude-code';

import { MESSAGE_KINDS, messageKind } from '../hooks/quiet.ts';
import { expect, test } from './shared-boot.ts';
import {
    CLIO,
    type Held,
    NOW,
    OLD_HELD,
    POLL_MS,
    SENSE_NAMES,
    SID,
    SLUG,
    STORE,
    compact,
    delivered,
    endTurn,
    fake,
    fromPeer,
    ready,
    receiveWorld,
    say,
    start,
} from './wind-world.ts';

// r10 (dima's o62): a message held 10 min for a codie that has not wound tells its sender once; the hold stays
const sentWorld = (on: On, name?: string, role?: string) => {
    const w = receiveWorld(on, name, role);
    const sent: { to: unknown; text: string }[] = [];
    on('session.send', (_$, e) => {
        sent.push({ text: e.text, to: e.to });
        return { isDelivered: true };
    });
    return { ...w, sent };
};
const HELD_LINE =
    'your message to ☕️ 🔧 codie: mods is held: it is at 62 % and has not wound';

// dima's o141 (00:20, widened 00:24): a compact holds every message sent into the thread, from any sender, then hands
// them over whole and in order at its next turn
const SIXTH = '⚡ 🔎 sixth sense: mods';
const compactHeld = (lines: string[]) =>
    lines.filter((l) => l.startsWith('🌀 held while this thread compacted'));
for (const trigger of ['manual', 'auto'] as const)
    test(`a ${trigger} compact holds a message sent while it runs, and hands it over at the next turn`, async ($, on) => {
        const w = sentWorld(on);
        let r: { consumed?: string; text?: string } = {};
        fake.inCompact = async () => {
            r = await fromPeer($, 'round 9 on abc1234', SIXTH);
        };
        await start($);
        await compact($, trigger);
        await say($, 'next');
        expect([
            r.consumed !== undefined,
            w.sent.map((s) => s.text),
            compactHeld(w.lines),
        ]).toEqual([
            true,
            [
                'held: ☕️ 🔧 codie: mods is compacting; your message joins its next turn',
                "delivered: your message joined ☕️ 🔧 codie: mods's first turn after its compact",
            ],
            [
                `🌀 held while this thread compacted, delivered now — ${SIXTH} (untagged): round 9 on abc1234`,
            ],
        ]);
    });

test('a message held during a wind follows the ingest as a prompt of its own, so an idle session reads it', async ($, on) => {
    const w = sentWorld(on);
    await start($);
    await ready($, SLUG);
    w.store.set(OLD_HELD, {
        isCompacted: true,
        steers: [
            {
                at: NOW,
                from: SIXTH,
                isCompact: true,
                text: 'round 9 on abc1234',
            },
        ],
    });
    await endTurn($);
    await w.clock.advance(2_000);
    expect([
        w.prompts.filter((p) =>
            p.startsWith('🌀 held while this thread compacted, delivered now'),
        ),
        w.store.has(STORE),
    ]).toEqual([
        [
            `🌀 held while this thread compacted, delivered now — ${SIXTH} (untagged): round 9 on abc1234`,
        ],
        false,
    ]);
});

test("a coordinator's push to a codie under 55 % mid-compact is held too", async ($, on) => {
    const w = sentWorld(on);
    let r: { consumed?: string; text?: string } = {};
    fake.inCompact = async () => {
        r = await fromPeer($, '[done] the gate is green');
    };
    w.store.set(`context:${SID}`, 30);
    await start($);
    await compact($, 'auto');
    await say($, 'next');
    expect([r.consumed !== undefined, compactHeld(w.lines)]).toEqual([
        true,
        [
            `🌀 held while this thread compacted, delivered now — ${CLIO} (done): [done] the gate is green`,
        ],
    ]);
});

test('a session at 🌀 holds every message until the compact, in the order sent', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    await start($);
    const a = await fromPeer($, '[ask] a or b?', SIXTH);
    const b = await fromPeer($, 'for dima: look at #9');
    await say($, 'before the compact');
    const held = (lines: string[]) =>
        lines.filter((l) => /^(🌀|🐦‍🔥) held /u.test(l));
    const before = held(w.lines);
    await compact($, 'plugin');
    await say($, 'the ingest', 'skill');
    // clio's message meets r5 first, which holds it for the codie's wind; the sixth sense's, which r5 never takes, the compact
    expect([
        a.consumed !== undefined,
        b.consumed !== undefined,
        before,
        held(w.lines),
    ]).toEqual([
        true,
        true,
        [],
        [
            `🌀 held while this thread compacted, delivered now — ${SIXTH} (ask): [ask] a or b?`,
            `🐦‍🔥 held for your second wind, delivered now — ${CLIO} (for-dima): for dima: look at #9`,
        ],
    ]);
});

test("clio's own thread at 🌀 holds a member's [done]", async ($, on) => {
    const w = receiveWorld(on, CLIO, 'coordinator');
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    await start($);
    const r = await fromPeer($, '[done] final on abc1234', SIXTH);
    await compact($, 'plugin');
    await say($, 'the ingest', 'skill');
    expect([r.consumed !== undefined, compactHeld(w.lines)]).toEqual([
        true,
        [
            `🌀 held while this thread compacted, delivered now — ${SIXTH} (done): [done] final on abc1234`,
        ],
    ]);
});

// FRM-597: helga's 13:13 — an auto-compact mid-turn, then idle, and the held message waited 22 min for a prompt
const heldPrompts = (prompts: string[]) =>
    prompts.filter((p) => p.includes('🌀 held while this thread compacted'));
for (const isWindOn of [true, false])
    test(`a compact mid-turn hands its held message to the idle session within 10 s of the turn's end, once${isWindOn ? '' : ', second wind off'}`, async ($, on) => {
        const w = sentWorld(on);
        if (!isWindOn) w.store.set('shown', { 'stash.second-wind': false });
        fake.inCompact = async () => {
            await fromPeer($, 'round 9 on abc1234', SIXTH);
        };
        await start($);
        await say($, 'work');
        await compact($, 'auto');
        await w.clock.advance(POLL_MS);
        const midTurn = heldPrompts(w.prompts).length;
        await endTurn($);
        await w.clock.advance(10_000);
        const afterEnd = heldPrompts(w.prompts);
        await w.clock.advance(20 * 60_000);
        expect([midTurn, afterEnd, heldPrompts(w.prompts).length]).toEqual([
            0,
            [
                `🌀 held while this thread compacted, delivered now — ${SIXTH} (untagged): round 9 on abc1234`,
            ],
            1,
        ]);
    });

test('an idle /compact hands its held message over within 10 s of its end, once', async ($, on) => {
    const w = sentWorld(on);
    fake.inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
    };
    await start($);
    await compact($, 'manual');
    await w.clock.advance(10_000);
    const first = heldPrompts(w.prompts).length;
    await say($, 'his next prompt');
    await w.clock.advance(20 * 60_000);
    expect([
        first,
        heldPrompts(w.prompts).length,
        compactHeld(w.lines),
    ]).toEqual([1, 1, []]);
});

test('two messages and a push held through one compact go in once, in order, and each sender hears held, then delivered', async ($, on) => {
    const w = sentWorld(on);
    fake.inCompact = async () => {
        await fromPeer($, '[ask] a or b?', SIXTH);
        await fromPeer($, '[done] the gate is green');
    };
    await start($);
    await compact($, 'auto');
    await w.clock.advance(10_000);
    await w.clock.advance(20 * 60_000);
    expect([heldPrompts(w.prompts), w.sent]).toEqual([
        [
            [
                `🌀 held while this thread compacted, delivered now — ${SIXTH} (ask): [ask] a or b?`,
                `🌀 held while this thread compacted, delivered now — ${CLIO} (done): [done] the gate is green`,
            ].join('\n'),
        ],
        [
            {
                text: 'held: ☕️ 🔧 codie: mods is compacting; your message joins its next turn',
                to: 'uds:/tmp/cc-socks/3.sock',
            },
            {
                text: 'held: ☕️ 🔧 codie: mods is compacting; your message joins its next turn',
                to: 'uds:/tmp/cc-socks/1.sock',
            },
            {
                text: "delivered: your message joined ☕️ 🔧 codie: mods's first turn after its compact",
                to: 'uds:/tmp/cc-socks/3.sock',
            },
            {
                text: "delivered: your message joined ☕️ 🔧 codie: mods's first turn after its compact",
                to: 'uds:/tmp/cc-socks/1.sock',
            },
        ],
    ]);
});

// wisphunter on 6e7afec4: a 🌀 row left when second wind went off held every message, and no compact ever released it
test('second wind off, a 🌀 row left behind holds nothing', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set('shown', { 'stash.second-wind': false });
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    await start($);
    const r = await fromPeer($, 'round 9 on abc1234', SIXTH);
    expect([r.consumed, r.text?.includes('round 9 on abc1234')]).toEqual([
        undefined,
        true,
    ]);
});

test('a release the engine refuses keeps the held message for the next one', async ($, on) => {
    const w = sentWorld(on);
    fake.inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
    };
    await start($);
    fake.submitRefusal = 'busy';
    await compact($, 'manual');
    await w.clock.advance(10_000);
    const kept = (w.store.get(STORE) as Held).messages.length;
    fake.submitRefusal = undefined;
    await say($, 'his prompt');
    expect([kept, compactHeld(w.lines).length, w.sent.length]).toEqual([
        1, 1, 2,
    ]);
});

test('a sender told its r5 hold outlived 10 min hears no «after its compact» when no compact ran', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    await w.clock.advance(10 * 60_000);
    w.store.set('shown', { 'stash.second-wind': false });
    await say($, 'his prompt');
    expect([delivered(w.lines).length, w.sent]).toEqual([
        1,
        [{ text: HELD_LINE, to: 'uds:/tmp/cc-socks/1.sock' }],
    ]);
});

test('a prompt inside the settle window takes the held message, and no release follows', async ($, on) => {
    const w = sentWorld(on);
    fake.inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
    };
    await start($);
    await compact($, 'manual');
    await say($, 'his prompt');
    await w.clock.advance(20 * 60_000);
    expect([
        compactHeld(w.lines).length,
        heldPrompts(w.prompts),
        w.sent.map((m) => m.text.split(':')[0]),
    ]).toEqual([1, [], ['held', 'delivered']]);
});

// sixth sense round 9 on 59feb7c8: a compact whose process died never cleared its key; past COMPACT_MAX_MS it holds nothing
test('a compact key left by a dead process holds nothing past its bound', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`compacting:${SID}`, NOW - 20 * 60_000);
    await start($);
    const r = await fromPeer($, 'round 9 on abc1234', SIXTH);
    expect([r.consumed, r.text?.includes('round 9 on abc1234')]).toEqual([
        undefined,
        true,
    ]);
});

test('a refused wind holds nothing: nothing compacts', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refused' });
    await start($);
    const r = await fromPeer($, 'round 9 on abc1234', SIXTH);
    expect([r.consumed, r.text?.includes('round 9 on abc1234')]).toEqual([
        undefined,
        true,
    ]);
});

test(
    'a message held 10 min for a codie that has not wound tells its sender once, and the hold stays',
    { timeoutMs: 30_000 },
    async ($, on) => {
        const w = sentWorld(on);
        w.store.set(`context:${SID}`, 62);
        await start($);
        await fromPeer($, 'next: r6');
        await w.clock.advance(9 * 60_000);
        const early = w.sent.length;
        await w.clock.advance(60_000);
        await w.clock.advance(20 * 60_000);
        expect([
            early,
            w.sent,
            (w.store.get(STORE) as Held).messages.length,
        ]).toEqual([
            0,
            [{ text: HELD_LINE, to: 'uds:/tmp/cc-socks/1.sock' }],
            1,
        ]);
    },
);

test('a codie that wound inside the 10 min tells no sender', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    await compact($, 'plugin');
    await w.clock.advance(11 * 60_000);
    expect(w.sent).toEqual([]);
});

test('a hold kept across a reload still tells its sender at 10 min', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    w.store.set(OLD_HELD, {
        steers: [
            {
                at: NOW - 9 * 60_000,
                from: CLIO,
                reply: 'uds:/tmp/cc-socks/1.sock',
                text: 'next: r6',
            },
        ],
    });
    w.store.set(`wind:${SID}`, { at: NOW - 9 * 60_000, state: 'writing' });
    await start($);
    await w.clock.advance(60_000);
    expect(w.sent).toEqual([
        { text: HELD_LINE, to: 'uds:/tmp/cc-socks/1.sock' },
    ]);
});

test('each held message tells its own sender at its own 10 min', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'one');
    await w.clock.advance(5 * 60_000);
    await $.session.receive({
        origin: { kind: 'peer' },
        text: '<cross-session-message from="uds:/tmp/cc-socks/2.sock" from-name="🦉🪽 clio: wing 1" from-mode="bypass">\ntwo\n</cross-session-message>',
    });
    await w.clock.advance(5 * 60_000);
    const first = w.sent.map((s) => s.to);
    await w.clock.advance(5 * 60_000);
    expect([first, w.sent.map((s) => s.to)]).toEqual([
        ['uds:/tmp/cc-socks/1.sock'],
        ['uds:/tmp/cc-socks/1.sock', 'uds:/tmp/cc-socks/2.sock'],
    ]);
});

// wisphunter on 990334f5: the tell wrote back its first read after the sends, so a delivery meanwhile came back
test('a hold delivered while its sender is told stays delivered', async ($, on) => {
    const w = receiveWorld(on);
    on('session.send', () => {
        w.store.delete(STORE);
        return { isDelivered: true };
    });
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    await w.clock.advance(10 * 60_000);
    expect(w.store.has(STORE)).toBe(false);
});

test('a compact holds its message in the one store, keyed by its id', async ($, on) => {
    const w = sentWorld(on);
    let held: Held | undefined;
    fake.inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
        held = w.store.get(STORE) as Held | undefined;
    };
    await start($);
    await compact($, 'manual');
    expect([
        held?.messages.map((m) => [typeof m.id, m.text]),
        w.store.has(OLD_HELD),
    ]).toEqual([[['string', 'round 9 on abc1234']], false]);
});

test("the old stores are read at the land: a compact's and quiet's held lists each go in once, and both keys go", async ($, on) => {
    const w = receiveWorld(on, CLIO, 'coordinator');
    w.store.set('steer-held:🦉clio', {
        steers: [{ at: NOW, from: SIXTH, isCompact: true, text: 'round 9' }],
    });
    w.store.set(`quiet-held:${SID}`, [
        { at: NOW, from: SIXTH, tag: 'progress', text: 'step 2 landed' },
    ]);
    await start($);
    await say($, 'next');
    await say($, 'and next');
    const all = w.lines.join('\n');
    expect([
        all.split('round 9').length - 1,
        all.split('step 2 landed').length - 1,
        w.store.has('steer-held:🦉clio'),
        w.store.has(`quiet-held:${SID}`),
    ]).toEqual([1, 1, false, false]);
});

// exit 2: a member ping quiet comms holds while clio's thread compacts goes in once, by quiet's own release
const QUIET_PING = 'step 2 landed';
const quietSeen = (w: ReturnType<typeof receiveWorld>) =>
    [...w.lines, ...w.prompts, ...w.appended].join('\n').split('step 2 landed')
        .length - 1;
test(
    'a ping quiet held before the compact is never appended mid-compact, and goes in once after it',
    { timeoutMs: 30_000 },
    async ($, on) => {
        const w = receiveWorld(on, CLIO, 'coordinator');
        // a wait shorter than a compact's longest run, so it passes inside the compact
        w.store.set('quiet-wait', 2);
        let midCompact = -1;
        fake.inCompact = async () => {
            await w.clock.advance(3 * 60_000);
            midCompact = w.appended.length;
        };
        await start($);
        const r = await fromPeer($, QUIET_PING, SIXTH);
        await compact($, 'manual');
        await w.clock.advance(10_000);
        await say($, 'next');
        await w.clock.advance(20 * 60_000);
        expect([r.consumed !== undefined, midCompact, quietSeen(w)]).toEqual([
            true,
            0,
            1,
        ]);
    },
);

for (const isPrompt of [true, false])
    test(`a ping sent into clio's compact is held by quiet comms, starts no turn, and goes in once at ${isPrompt ? 'her next prompt' : 'the idle append'}`, async ($, on) => {
        const w = sentWorld(on, CLIO, 'coordinator');
        fake.inCompact = async () => {
            await fromPeer($, QUIET_PING, SIXTH);
        };
        await start($);
        await compact($, 'manual');
        await w.clock.advance(10_000);
        const turns = w.prompts.length;
        if (isPrompt) await say($, 'next');
        await w.clock.advance(20 * 60_000);
        expect([turns, quietSeen(w), w.sent]).toEqual([0, 1, []]);
    });

// exit 3: every role's compact hands two messages, a push among them, to its first turn after, in order, once each
for (const [name, role] of [
    [undefined, 'codie'],
    [SIXTH, 'sixth-sense'],
    [CLIO, 'coordinator'],
    ['🦉🪽 clio: wing 1', 'wing'],
] as const)
    test(`a ${role} mid-compact takes a ping and a push, sent in that order, in its first turn after, once each`, async ($, on) => {
        const w = receiveWorld(on, name, role);
        fake.inCompact = async () => {
            await fromPeer($, 'round 9 on abc1234', SENSE_NAMES[1]);
            await fromPeer($, '[done] the gate is green');
        };
        await start($);
        await compact($, 'manual');
        await w.clock.advance(10_000);
        await w.clock.advance(20 * 60_000);
        const all = [...w.lines, ...w.prompts, ...w.appended].join('\n');
        const at = (s: string) => [all.indexOf(s), all.split(s).length - 1];
        const [ping, push] = [
            at('round 9 on abc1234'),
            at('the gate is green'),
        ];
        expect([ping[1], push[1], (ping[0] ?? 0) < (push[0] ?? 0)]).toEqual([
            1,
            1,
            true,
        ]);
    });

// sixth sense's P2s on 1fea2c06: a release timer a reload dropped, a refused release with no prompt behind it
test('a start with a compact-held list and no turn running releases it', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(STORE, {
        isCompacted: true,
        messages: [
            {
                at: NOW,
                from: SIXTH,
                id: 'a1',
                isCompact: true,
                text: 'round 9 on abc1234',
            },
        ],
    });
    await start($);
    await w.clock.advance(5_000);
    expect(heldPrompts(w.prompts)).toEqual([
        `🌀 held while this thread compacted, delivered now — ${SIXTH} (untagged): round 9 on abc1234`,
    ]);
});

test('a refused release tries again, so an idle session with no next prompt still reads it', async ($, on) => {
    const w = sentWorld(on);
    fake.inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
    };
    await start($);
    fake.submitRefusal = 'busy';
    await compact($, 'manual');
    await w.clock.advance(10_000);
    fake.submitRefusal = undefined;
    await w.clock.advance(60_000);
    expect(heldPrompts(w.prompts).length).toBe(1);
});

// FRM-583 exit 1: every hold names a held message's kind from the one list
const KINDS: readonly string[] = MESSAGE_KINDS.map((k) => k.kind);
const kindsIn = (text: string) =>
    [...text.matchAll(/ \(([\w-]+)\): /g)].map((m) => m[1] ?? '');
const TWINS = [
    ['round 9 on abc1234', 'untagged'],
    ['step 2 landed', 'untagged'],
    ['for dima: a or b', 'for-dima'],
    ['[ask] a or b?', 'ask'],
] as const;

for (const [body, kind] of [
    ['', 'untagged'],
    ['[ask]', 'ask'],
    ['🪜 [escalate] stuck', 'escalate'],
    ['[🪜 escalate] stuck', 'escalate'],
    ['sw done\nfor dima: a or b', 'for-dima'],
    ['`for dima` in code', 'untagged'],
    ['[Ask] a?', 'untagged'],
    ['[done', 'untagged'],
    ['waiting on dima', 'for-dima'],
    ['[progress]', 'untagged'],
] as const)
    test(`a message reads as its kind from the list: ${JSON.stringify(body)} is ${kind}`, () => {
        expect([messageKind(body), KINDS.includes(kind)]).toEqual([kind, true]);
    });

test('a compact names each held message by its kind from the list', async ($, on) => {
    const w = sentWorld(on);
    fake.inCompact = async () => {
        for (const [body] of TWINS) await fromPeer($, body, SIXTH);
    };
    await start($);
    await compact($, 'manual');
    await w.clock.advance(10_000);
    const kinds = kindsIn(heldPrompts(w.prompts).join('\n'));
    expect([kinds, kinds.every((k) => KINDS.includes(k))]).toEqual([
        TWINS.map(([, kind]) => kind),
        true,
    ]);
});

test("a wind's held message names its kind from the list", async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    await fromPeer($, '[ask] a or b?');
    w.store.set('shown', { 'stash.second-wind': false });
    await say($, 'his prompt');
    expect(kindsIn(delivered(w.lines).join('\n'))).toEqual(['untagged', 'ask']);
});

test('quiet comms name each held ping by its kind, a push kind switched off kept as its kind', async ($, on) => {
    const w = sentWorld(on, CLIO, 'coordinator');
    w.store.set('quiet-ask', false);
    await start($);
    for (const [body] of TWINS) await fromPeer($, body, SIXTH);
    await say($, 'next');
    expect(
        kindsIn(
            w.lines
                .filter((l) => l.startsWith('🤫 quiet comms'))
                .join('\n')
                .replaceAll(/^- \d\d:\d\d /gm, ' '),
        ),
    ).toEqual(['untagged', 'untagged', 'ask']);
});

// FRM-583 exit 4: a compact's held message no turn takes inside the deadline never ends in silence
const WAITING_LINE =
    'held, waiting: ☕️ 🔧 codie: mods has taken no turn since its compact; your message joins its next turn';
const waitOf = (w: ReturnType<typeof sentWorld>) =>
    (w.store.get(`reply:${SID}`) as { wait?: string } | undefined)?.wait;

test('a compact-held message no turn takes in 10 min tells its sender «held, waiting» once, and the thread shows waiting', async ($, on) => {
    const w = sentWorld(on);
    fake.inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
    };
    await start($);
    fake.submitRefusal = 'busy';
    await compact($, 'manual');
    await w.clock.advance(9 * 60_000);
    const early = w.sent.length;
    await w.clock.advance(2 * 60_000);
    await w.clock.advance(20 * 60_000);
    expect([
        early,
        w.sent.map((s) => s.text),
        waitOf(w)?.startsWith('waiting: held messages'),
    ]).toEqual([
        1,
        [
            'held: ☕️ 🔧 codie: mods is compacting; your message joins its next turn',
            WAITING_LINE,
        ],
        true,
    ]);
});

test('a compact-held message a turn takes inside the deadline tells no one it waits', async ($, on) => {
    const w = sentWorld(on);
    fake.inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
    };
    await start($);
    await compact($, 'manual');
    await w.clock.advance(30 * 60_000);
    expect([w.sent.map((s) => s.text.split(':')[0]), waitOf(w)]).toEqual([
        ['held', 'delivered'],
        undefined,
    ]);
});

test('a reload re-arms the deadline of a compact-held message', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(STORE, {
        isCompacted: true,
        messages: [
            {
                at: NOW,
                from: SIXTH,
                id: 'a1',
                isCompact: true,
                isTold: true,
                reply: 'uds:/tmp/cc-socks/3.sock',
                text: 'round 9 on abc1234',
            },
        ],
    });
    fake.submitRefusal = 'busy';
    await start($);
    await w.clock.advance(11 * 60_000);
    expect(w.sent).toEqual([
        { text: WAITING_LINE, to: 'uds:/tmp/cc-socks/3.sock' },
    ]);
});

// sixth sense round 1 on f1579643: a compact inside a turn still running is no missed turn
test('a compact mid-turn in a turn still running past 10 min tells no one it waits', async ($, on) => {
    const w = sentWorld(on);
    fake.inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
    };
    await start($);
    await say($, 'long work');
    await compact($, 'auto');
    await w.clock.advance(11 * 60_000);
    expect([w.sent.map((s) => s.text.split(':')[0]), waitOf(w)]).toEqual([
        ['held'],
        undefined,
    ]);
});

// sixth sense round 2 on 28a06804: a state read inside the timer sees its arming hook's moment, a busy turn forever
test('a hold armed mid-turn still tells its sender once that turn ended and every release was refused', async ($, on) => {
    let isStale = false;
    on('state.get', (_$, e, next) =>
        isStale && e.key === 'turn'
            ? { value: { value: { isBusy: true }, version: 1 } }
            : next(e),
    );
    const w = sentWorld(on);
    fake.inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
    };
    await start($);
    await say($, 'long work');
    await compact($, 'auto');
    fake.submitRefusal = 'busy';
    await $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
    isStale = true;
    await w.clock.advance(20 * 60_000);
    expect(w.sent.map((s) => s.text)).toContain(WAITING_LINE);
});

// a reload re-arms for the untold one, and the tell it fires skips the sender already told
test('a reload after the waiting line was told tells that sender no second time', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(STORE, {
        isCompacted: true,
        messages: [
            {
                at: NOW,
                from: SIXTH,
                id: 'a1',
                isCompact: true,
                isTold: true,
                isWaitTold: true,
                reply: 'uds:/tmp/cc-socks/3.sock',
                text: 'round 9 on abc1234',
            },
            {
                at: NOW,
                from: '🦉 clio',
                id: 'a2',
                isCompact: true,
                isTold: true,
                reply: 'uds:/tmp/cc-socks/4.sock',
                text: 'next: r6',
            },
        ],
    });
    fake.submitRefusal = 'busy';
    await start($);
    await w.clock.advance(11 * 60_000);
    expect(w.sent.map((s) => s.to)).toEqual(['uds:/tmp/cc-socks/4.sock']);
});

// wisphunter on f9e633d2: the wind's first message swapped for its note while no store held it
test("a coordinator's message the held store will not save passes as sent, no wind note", async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    fake.isHeldRefused = true;
    await start($);
    const r = await fromPeer($, 'next: r6');
    expect([
        r.text?.includes('next: r6'),
        r.text?.includes('held for your second wind'),
        w.store.has(`wind:${SID}`),
    ]).toEqual([true, false, false]);
});

// wisphunter on f9e633d2: a ping held under the session id while the registry name could not be read
test('a ping held under the session id goes in once the name is back, and the id key goes', async ($, on) => {
    const w = receiveWorld(on, CLIO, 'coordinator');
    w.store.set(`held:${SID}`, {
        messages: [
            {
                at: NOW,
                from: SIXTH,
                id: 'q1',
                isQuiet: true,
                tag: 'progress',
                text: 'step 2 landed',
            },
        ],
    });
    await start($);
    await say($, 'next');
    await say($, 'and next');
    expect([
        w.lines.join('\n').split('step 2 landed').length - 1,
        w.store.has(`held:${SID}`),
    ]).toEqual([1, false]);
});
