import { expect, test } from 'claude-code/testing';

import { clioAddress, peerPing } from '../hooks/quiet.ts';
import {
    EVENT,
    FORGED,
    IDLE,
    LINKED,
    MEMBER,
    NOTE,
    fromAppText,
    gluedPrompt,
    held,
    linesFor,
    logOf,
    message,
    ping,
    say,
    start,
    stored,
    world,
} from './quiet-helpers.ts';

test("clio cd'd out of ~/frame/_clio still holds a [progress] ping", async ($, on) => {
    const w = world(on, { cwd: '/home/frame/home/.claude/plugin-x/mods' });
    await start($);
    await ping($, '[progress] step 2 landed');
    expect(w.queued).toEqual([]);
});

test('a session the registry names other than clio passes a [progress] ping, even in her dir', async ($, on) => {
    const w = world(on, { name: '☕️ 🔧 codie: mods' });
    await start($);
    await ping($, '[progress] step 2 landed');
    expect(w.queued).toHaveLength(1);
});

test("the held pings reach the store for clio's sessions row", async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] a');
    await ping($, '[progress] b');
    expect(stored(w).map((p) => [p.from, p.text])).toEqual([
        ['☕️ 🔧 codie: mods', 'a'],
        ['☕️ 🔧 codie: mods', 'b'],
    ]);
});

/* the envelope */

test('a desktop envelope names its sender with name=', () => {
    expect(
        peerPing(
            '<cross-session-message from="local_a1" name="🦉 clio">\n[ask] a or b?\n</cross-session-message>',
        ),
    ).toEqual({ body: '[ask] a or b?', from: '🦉 clio', tag: 'ask' });
});

/* the safety net (brief 6) */

test('a held list that does not save passes the ping, failed-open, nothing held', async ($, on) => {
    let isBroken = false;
    const w = world(on, {
        refuseSet: (key) => isBroken && key.startsWith('held:'),
    });
    await start($);
    isBroken = true;
    await ping($, '[progress] step 2 landed');
    expect([w.queued.length, logOf(w).map((l) => l.verdict)]).toEqual([
        1,
        ['failed-open'],
    ]);
});

test('a message whose hold did not save is never delivered again', async ($, on) => {
    let isBroken = false;
    const w = world(on, {
        refuseSet: (key) => isBroken && key.startsWith('held:'),
    });
    await start($);
    isBroken = true;
    await ping($, 'once only');
    isBroken = false;
    await say($, 'status?');
    expect(held(w)).toEqual([]);
});

test('a list that will not empty waits, and reaches the prompt after once', async ($, on) => {
    let isBroken = false;
    const w = world(on, {
        refuseSet: (key) => isBroken && key.startsWith('held:'),
    });
    await start($);
    await ping($, 'once only');
    isBroken = true;
    await say($, 'one');
    const during = held(w);
    isBroken = false;
    await say($, 'two');
    const reached = held(w).join('\n');
    await say($, 'three');
    expect([during, reached.includes('once only'), held(w)]).toEqual([
        [],
        true,
        [],
    ]);
});

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
