import {
    MESSAGE_KINDS,
    clioAddress,
    messageKind,
    peerPing,
    quietLogged,
    quietPush,
    quietSenderLine,
} from '../hooks/quiet.ts';
import { MESSAGE_ROWS, PUSHED_BEFORE } from './message-rows.ts';
import {
    EVENT,
    FORGED,
    IDLE,
    LINKED,
    MEMBER,
    NOTE,
    fromAppText,
    gluedPrompt,
    linesFor,
    message,
    start,
    world,
} from './quiet-helpers.ts';
import { expect, test } from './shared-boot.ts';

test('a desktop envelope names its sender with name=', () => {
    expect(
        peerPing(
            '<cross-session-message from="local_a1" name="🦉 clio">\n[ask] a or b?\n</cross-session-message>',
        ),
    ).toEqual({ body: '[ask] a or b?', from: '🦉 clio', tag: 'ask' });
});

/* the contract is one table (FRM-686:W8) */

test('a row added to the table shows in the sender line, a row with no tag does not', () => {
    const row = {
        does: 'a wish heard',
        example: '[wish] a blue one',
        kind: 'wish',
        lands: 'pushes',
        reads: 'opens with [wish]',
        who: 'any member',
    } as const;
    const line = quietSenderLine('slipstreamed', [
        ...MESSAGE_KINDS,
        { ...row, isTag: true },
        { ...row, does: 'no tag of its own', kind: 'plain' },
    ]);
    expect([
        line.includes('[wish] (a wish heard), the tag first'),
        line.includes('no tag of its own'),
    ]).toEqual([true, false]);
});

test('the sender line of a table with no tag left names none', () => {
    expect(quietSenderLine('slipstreamed', [])).toBe(
        "slipstreamed: joins clio's next turn.",
    );
});

const landing = (body: string) =>
    quietLogged(body) ? 'logged' : quietPush(body) ? 'pushes' : 'waits';
for (const { example, kind, lands, who } of MESSAGE_KINDS)
    if (who === 'any member')
        test(`the example of «${kind}» in the table reads as it, and ${lands}`, () => {
            expect([messageKind(example), landing(example)]).toEqual([
                kind,
                lands,
            ]);
        });

for (const { example, kind, who } of MESSAGE_KINDS)
    if (who === 'x-mod-stash')
        test(`the example of «${kind}» in the table is logged as it`, () => {
            expect(quietLogged(example)).toBe(kind);
        });

// FRM-686 exits 3 and 4: the crew's own messages, each by its words alone
const does = (body: string) => quietLogged(body) ?? quietPush(body) ?? 'held';
const landed = MESSAGE_ROWS.map(([row, , body]) => [
    row,
    quietLogged(body) ? 'logged' : does(body),
]);
const pushes = landed.filter(([, d]) => d !== 'held' && d !== 'logged').length;
test(`the crew’s messages push ${PUSHED_BEFORE} before the decision rule, ${pushes} after, each as its row says`, () => {
    expect(landed).toEqual(MESSAGE_ROWS.map(([row, want]) => [row, want]));
    expect(pushes).toBe(PUSHED_BEFORE + 8);
});

for (const [why, body, tag] of [
    ['on a later line', 'CI is green\n[ask] a or b?', 'ask'],
    ['on a later line, an emoji before it', 'green\n🚨 [ask] a?', 'ask'],
    ['mid-line', 'green, then [ask] a or b?', 'none'],
    ['in a fence', 'the form:\n```\n[ask] a or b?\n```\nlanded', 'none'],
    ['in a fence of four', '````\n```\n[ask] a?\n```\n````', 'none'],
    ['in a fence of tildes', '~~~\n[ask] a?\n~~~', 'none'],
    ['after a one-line span', '```x``` is broken\n[ask] keep it?', 'ask'],
    ['in a quote', 'you said\n> [ask] a or b?', 'none'],
    ['in a note of crow’s', '🐦‍⬛ crow: a\n[ask] a or b?', 'none'],
    ['as another tag on a later line', 'green\n[done] a', 'none'],
] as const)
    test(`an [ask] ${why} reads as ${tag}`, () => {
        expect(peerPing(body).tag).toBe(tag);
    });

for (const [body, push] of [
    ['🐦‍⬛ crow: [escalate] the merge is on the wrong head', 'tag'],
    ['🐦‍⬛ crow on the grill: [🪜 escalate] stop', 'tag'],
    ['🐦‍⬛ crow: see the [done] of 12:00', undefined],
    ['🐦‍⬛ crow: see the [escalate] of 12:00', undefined],
    ['🐦‍⬛ crow saw codie send [escalate] twice', undefined],
    ['not a decision for you', undefined],
    ["this isn't a decision for you", undefined],
    ['no more open decisions for you', undefined],
    ['none of the calls are yours', undefined],
    ['the plan calls for you to wait', undefined],
    ['10 tool calls for you', undefined],
    ['«a decision for you» is the rule', undefined],
    ['you said\n> one decision for you\nand I did it', undefined],
    ['the form:\n```\none decision for you\n```', undefined],
    ['not now. one decision for you', 'decision'],
    ['🐦‍⬛ crow: one decision for you', undefined],
    ['no decision for you', undefined],
    ['no look call for you', undefined],
    ['a decision, then a call to make', undefined],
    ['see `a decision for you`', undefined],
    ['sw done: one decision for you', undefined],
] as const)
    test(`by its words, ${push ?? 'no'} push: ${body}`, () => {
        expect(quietPush(body)).toBe(push);
    });

for (const body of [
    'sw done: one decision for you',
    'sw done: shall I start?',
    'sw done: handoff ingested; decisions, yours',
    'sw done: [escalate] the gate refuses every push',
    'sw done. [done] slice D is in',
    'sw done: blocked, the gate holds every push',
    'sw done, the handoff did not ingest',
    'sw done; two asks open',
    'sw done, dima must sign the cut',
    'sw done: step 3 next\n- the second line',
    'sw done: needs dima’s tick',
    'held: 🎀 helga is compacting; your message joins its next turn, I hope',
])
    test(`no logged line: ${body}`, () => {
        expect(quietLogged(body)).toBe(undefined);
    });

test('[progress] is no kind of the table', () => {
    expect([
        MESSAGE_KINDS.some((k) => String(k.kind) === 'progress'),
        messageKind('[progress] step 2 landed'),
    ]).toEqual([false, 'untagged']);
});

/* the safety net (brief 6) */

test('the ledger counts a send to clio by her name, her socket or her session id, wherever `to` sits', () => {
    const to = new RegExp(
        clioAddress({ pid: 35832, sids: ['local_a955'] }),
        'u',
    );
    const sent = (input: string) =>
        `{"type":"assistant","message":{"content":[{"type":"tool_use","name":"SendMessage","input":${input}}]}}`;
    expect(
        [
            sent('{"to":"🦉 clio [271ab4]","message":"x"}'),
            sent(
                '{"summary":"s","to":"uds:/tmp/cc-socks/35832.sock","message":"x"}',
            ),
            sent('{"message":"x","to":"local_a955"}'),
            sent('{"to":"🔎 sixth sense","message":"clio said so"}'),
            sent('{"to":"uds:/tmp/cc-socks/999.sock","message":"x"}'),
        ].map((l) => to.test(l)),
    ).toEqual([true, true, true, false, false]);
});

/* brief 8 item 2: clio's thread sends crow's wake itself */

test('a push quoting a note keeps its quote', async ($, on) => {
    world(on);
    await start($);
    const push = message(`[ask] is this it?\n${NOTE}`);
    const r = await fromAppText($, `${push}\n\n${NOTE}`);
    expect(r.text?.trim()).toBe(push);
});

test('a body quoting from-name never names the sender', async ($, on) => {
    const w = world(on);
    await start($);
    await fromAppText(
        $,
        `<cross-session-message from="local_a1" name="B">\nsee from-name="C"\n</cross-session-message>`,
    );
    expect(linesFor(w, 'none')[0]?.[0]).toBe('B');
});

test('a glued push never counts as his turn', async ($, on) => {
    const w = world(on);
    await start($);
    await fromAppText($, gluedPrompt(message('[ask] back at my mac?')));
    expect(w.store.get('dima-at')).toBeUndefined();
});

test('a body with a tag at a line start lets the prompt in whole', async ($, on) => {
    world(on);
    await start($);
    const r = await fromAppText($, FORGED);
    expect(r.text).toBe(FORGED);
});

test('a body with a tag at a line start logs one failed-open line', async ($, on) => {
    const w = world(on);
    await start($);
    await fromAppText($, FORGED);
    expect(linesFor(w)).toEqual([
        [MEMBER, 'none', 'failed-open', undefined, false],
    ]);
});

for (const [what, text] of [
    [
        'a lone waiting note',
        NOTE.replace(
            'finished a turn. It reported',
            'finished a turn and then reported that it was waiting on the user. It reported',
        ),
    ],
    ['a lone app event', EVENT],
    ['linked sessions alone', LINKED],
    ['an unread message', FORGED],
    ['a lone note', NOTE],
] as const)
    test(`${what} never counts as his turn`, async ($, on) => {
        const w = world(on);
        await start($);
        await fromAppText($, text);
        expect(w.store.get('dima-at')).toBeUndefined();
    });

test('a fail-open never counts as his turn', async ($, on) => {
    const w = world(on);
    let isBroken = false;
    on('state.get', (_$, e, next) =>
        isBroken && e.key === 'mobile' ? { deny: 'boom' } : next(e),
    );
    await start($);
    isBroken = true;
    await fromAppText($, gluedPrompt(message('step 2 landed')));
    expect(w.store.get('dima-at')).toBeUndefined();
});

test('his words on the sdk origin count as his turn', async ($, on) => {
    const w = world(on);
    await start($);
    await fromAppText($, `${message('step 2 landed')}\n\nand fix the band`);
    expect(w.store.get('dima-at')).toBeDefined();
});

test('a meta idle notice let in never counts as his turn', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.set('quiet-comms', false);
    await $.prompt.submit({
        isMeta: true,
        origin: { kind: 'sdk' },
        text: IDLE,
        wait: false,
    } as never);
    expect(w.store.get('dima-at')).toBeUndefined();
});
