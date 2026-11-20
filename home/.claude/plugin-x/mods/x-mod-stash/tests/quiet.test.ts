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
    linesFor,
    message,
    start,
    world,
} from './quiet-helpers.ts';

test('a desktop envelope names its sender with name=', () => {
    expect(
        peerPing(
            '<cross-session-message from="local_a1" name="🦉 clio">\n[ask] a or b?\n</cross-session-message>',
        ),
    ).toEqual({ body: '[ask] a or b?', from: '🦉 clio', tag: 'ask' });
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
