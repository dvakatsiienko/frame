import { expect, test } from './shared-boot.ts';
import {
    CLIO,
    NAME_HELD,
    NOW,
    PID,
    SID,
    STORE,
    compact,
    delivered,
    fake,
    fromPeer,
    receiveWorld,
    say,
    start,
} from './wind-world.ts';

// FRM-579 exit 6, sixth sense round 3: a record-less fork that signs as «🦉 clio» holds no wind note, its socket names it
test('a fork named «🦉 clio» with no record gets no wind note held', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    const r = await fromPeer($, 'next: r6', CLIO, 90);
    expect(r.text?.includes('held for your second wind')).toBe(false);
});

test("clio's message to a codie past 55 % becomes the wind note, and joins the first turn after the compact", async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    const r = await fromPeer($, 'next: r6, then 12b');
    await say($, 'the rewritten ping', 'peer');
    const before = delivered(w.lines);
    await compact($, 'plugin');
    await say($, 'the ingest', 'skill');
    await say($, 'later');
    expect([
        r.text?.includes(
            "🦉 clio's message is held for your second wind: your context reads 62 %",
        ),
        r.text?.includes('next: r6'),
        (w.store.get(`wind:${SID}`) as { state?: string } | undefined)?.state,
        before,
        delivered(w.lines),
    ]).toEqual([
        true,
        false,
        undefined,
        [],
        [
            '🐦‍🔥 held for your second wind, delivered now — 🦉 clio (untagged): next: r6, then 12b',
        ],
    ]);
});

// FRM-617 round 1: a retitle while the message waits strands nothing, the store keys on the session id
test('a message held before a retitle still joins the first turn after the compact', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6, then 12b');
    w.files[`/home/.claude/sessions/${PID}.json`] = JSON.stringify({
        name: '⚡ 🔧 mods | FRM-2',
        pid: PID,
    });
    await say($, 'the rewritten ping', 'peer');
    await compact($, 'plugin');
    await say($, 'the ingest', 'skill');
    await say($, 'later');
    expect([delivered(w.lines), w.store.has(STORE)]).toEqual([
        [
            '🐦‍🔥 held for your second wind, delivered now — 🦉 clio (untagged): next: r6, then 12b',
        ],
        false,
    ]);
});

test('a message held before a /clear joins the new conversation under its new id', async ($, on) => {
    const w = receiveWorld(on);
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6, then 12b');
    await $.session.end({ reason: 'clear', sessionId: SID } as never);
    fake.sidNow = 'w2w2w2w2-wind';
    await say($, 'the rewritten ping', 'peer');
    await compact($, 'plugin');
    await say($, 'the ingest', 'skill');
    await say($, 'later');
    expect([
        delivered(w.lines),
        w.store.has(STORE),
        w.store.has('held:w2w2w2w2-wind'),
    ]).toEqual([
        [
            '🐦‍🔥 held for your second wind, delivered now — 🦉 clio (untagged): next: r6, then 12b',
        ],
        false,
        false,
    ]);
});

test('a message held under the name, the store before, joins once and its key goes', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(NAME_HELD, {
        isCompacted: true,
        messages: [{ at: NOW, from: CLIO, id: 'n1', text: 'next: r6' }],
    });
    await start($);
    await say($, 'next');
    await say($, 'and next');
    expect([
        w.lines.join('\n').split('next: r6').length - 1,
        w.store.has(NAME_HELD),
    ]).toEqual([1, false]);
});

test('the held message marks the wind as writing, so the board reads ✍️', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 70);
    await start($);
    await fromPeer($, 'next: r6');
    expect((w.store.get(`wind:${SID}`) as { state?: string }).state).toBe(
        'writing',
    );
});

test('a second message while one is held waits unseen, and both join after the compact', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'one');
    const r = await fromPeer($, 'two');
    await compact($, 'plugin');
    await say($, 'the ingest', 'skill');
    expect([
        r.consumed !== undefined,
        w.queued.length,
        delivered(w.lines),
    ]).toEqual([
        true,
        1,
        [
            '🐦‍🔥 held for your second wind, delivered now — 🦉 clio (untagged): one',
            '🐦‍🔥 held for your second wind, delivered now — 🦉 clio (untagged): two',
        ],
    ]);
});

test('a codie under 55 % reads the message as sent', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 54);
    await start($);
    const r = await fromPeer($, 'next: r6');
    expect([r.text?.includes('next: r6'), w.store.has(STORE)]).toEqual([
        true,
        false,
    ]);
});

test("a full sixth sense reads clio's message as sent", async ($, on) => {
    const w = receiveWorld(
        on,
        '⚡ 🔎 sixth sense: mods lane 6 | main',
        'sixth-sense',
    );
    w.store.set(`context:${SID}`, 80);
    await start($);
    const toSixth = await fromPeer($, 'next: round 2');
    expect(toSixth.text?.includes('next: round 2')).toBe(true);
});

test('a sixth sense or a pause reaching a full codie passes as sent', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 80);
    await start($);
    const fromSixth = await fromPeer(
        $,
        'round 1: clean',
        '⚡ 🔎 sixth sense: mods lane 6 | main',
    );
    const pause = await fromPeer(
        $,
        'pause — hold every message until «resume»',
    );
    const fromWing = await fromPeer($, 'next: r6', '🦉🪽 clio: wing 1');
    expect([
        fromSixth.text?.includes('round 1: clean'),
        pause.text?.includes('pause'),
        fromWing.text?.includes("🦉🪽 clio: wing 1's message is held"),
    ]).toEqual([true, true, true]);
});

test('a wind dima takes back hands the held message over at the next turn', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    w.store.set(`wind:${SID}`, { at: NOW, state: 'cancelled' });
    await say($, 'his prompt');
    expect(delivered(w.lines)).toEqual([
        '🐦‍🔥 held for your second wind, delivered now — 🦉 clio (untagged): next: r6',
    ]);
});

test('🐦‍🔥 second wind switched off holds nothing', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 90);
    w.store.set('shown', { 'stash.second-wind': false });
    await start($);
    const r = await fromPeer($, 'next: r6');
    expect([r.text?.includes('next: r6'), w.store.has(STORE)]).toEqual([
        true,
        false,
    ]);
});

test('a /clear while a message is held keeps it for the next conversation', async ($, on) => {
    const w = receiveWorld(on);
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    await $.session.end({ reason: 'clear', sessionId: SID } as never);
    expect(w.store.has(STORE)).toBe(true);
});

test('a wind dima took back stays taken back: a message at 62 % passes as sent', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'cancelled' });
    await start($);
    const r = await fromPeer($, 'next: r6');
    expect([
        r.text?.includes('next: r6'),
        (w.store.get(`wind:${SID}`) as { state?: string }).state,
        w.store.has(STORE),
    ]).toEqual([true, 'cancelled', false]);
});

test('once dima takes the wind back, the next message is no longer swallowed', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'one');
    w.store.set(`wind:${SID}`, { at: NOW, state: 'cancelled' });
    const r = await fromPeer($, 'two');
    expect(r.text?.includes('two')).toBe(true);
});

test('second wind switched off mid-hold hands the held message over at the next turn', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    w.store.set('shown', { 'stash.second-wind': false });
    await say($, 'his prompt');
    expect(delivered(w.lines)).toEqual([
        '🐦‍🔥 held for your second wind, delivered now — 🦉 clio (untagged): next: r6',
    ]);
});

test('a refused wind keeps the message held until the compact', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    w.store.set(`wind:${SID}`, {
        at: NOW,
        blocked: 'an agent',
        state: 'refused',
    });
    await say($, 'the refusal turn');
    const before = delivered(w.lines);
    await compact($, 'plugin');
    await say($, 'the ingest', 'skill');
    expect([before, delivered(w.lines)]).toEqual([
        [],
        [
            '🐦‍🔥 held for your second wind, delivered now — 🦉 clio (untagged): next: r6',
        ],
    ]);
});
