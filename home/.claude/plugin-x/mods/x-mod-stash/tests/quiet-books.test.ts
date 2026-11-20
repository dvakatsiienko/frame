import { expect, test } from 'claude-code/testing';

import {
    CODIE,
    CODIE_SID,
    EVEN,
    FORGED,
    MEMBER,
    MIN,
    SENT_1604,
    SID,
    alarmWorld,
    answering,
    codiePeer,
    fromApp,
    fromAppText,
    gluedPrompt,
    linesFor,
    logOf,
    message,
    noteOf,
    ping,
    quiet,
    say,
    send,
    silentWorld,
    start,
    world,
} from './quiet-helpers.ts';

test('the log names the arm from the switch', async ($, on) => {
    const w = world(on);
    await start($);
    await quiet($, 'off');
    await ping($, '[progress] a');
    const day = new Date(EVEN).toISOString().slice(0, 10);
    expect(
        (w.store.get(`quiet-log:${day}`) as Record<string, unknown>[]).map(
            (l) => l.arm,
        ),
    ).toEqual(['off']);
});

const gapNote = (w: ReturnType<typeof world>) =>
    (w.contexts.at(-1) ?? []).filter((c) =>
        c.startsWith('🤫 quiet-comms ledger'),
    );

test('a ledger gap rides the lane owner’s next prompt once, naming the member', async ($, on) => {
    const w = world(on);
    w.store.set('quiet-gap', {
        at: 1,
        gaps: [{ from: '☕️ 🔧 codie: mods', logged: 1, sent: 2 }],
    });
    await start($);
    await say($, 'status?');
    const first = gapNote(w);
    await say($, 'and now?');
    expect([first, gapNote(w)]).toEqual([
        [
            '🤫 quiet-comms ledger: ☕️ 🔧 codie: mods sent you 2 pings and your quiet log holds 1: 1 skipped the hold, check its log line.',
        ],
        [],
    ]);
});

test('a standing gap of the same size after one more send and one more line is not told again', async ($, on) => {
    const w = world(on);
    w.store.set('quiet-gap', {
        at: 1,
        gaps: [{ from: '☕️ 🔧 codie: mods', logged: 23, sent: 24 }],
    });
    await start($);
    await say($, 'status?');
    w.store.set('quiet-gap', {
        at: 2,
        gaps: [{ from: '☕️ 🔧 codie: mods', logged: 24, sent: 25 }],
    });
    await say($, 'and now?');
    expect(gapNote(w)).toEqual([]);
});

test('a gap that closes and opens again is told again', async ($, on) => {
    const w = world(on);
    const gap = { from: '☕️ 🔧 codie: mods', logged: 1, sent: 2 };
    w.store.set('quiet-gap', { at: 1, gaps: [gap] });
    await start($);
    await say($, 'status?');
    w.store.set('quiet-gap', { at: 2, gaps: [] });
    await say($, 'closed?');
    w.store.set('quiet-gap', { at: 3, gaps: [gap] });
    await say($, 'again?');
    expect(gapNote(w)).toHaveLength(1);
});

test('a gap that grows is told again', async ($, on) => {
    const w = world(on);
    w.store.set('quiet-gap', {
        at: 1,
        gaps: [{ from: '☕️ 🔧 codie: mods', logged: 1, sent: 2 }],
    });
    await start($);
    await say($, 'status?');
    w.store.set('quiet-gap', {
        at: 2,
        gaps: [{ from: '☕️ 🔧 codie: mods', logged: 1, sent: 3 }],
    });
    await say($, 'and now?');
    expect(gapNote(w)).toHaveLength(1);
});

test('each delivery logs its sender, tag, verdict and whether it started a turn', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] step 2 landed');
    await ping($, '[done] landed', '🔎 sixth sense');
    const day = new Date(EVEN).toISOString().slice(0, 10);
    expect(
        (w.store.get(`quiet-log:${day}`) as Record<string, unknown>[]).map(
            (l) => [l.from, l.tag, l.verdict, l.startedTurn, l.arm],
        ),
    ).toEqual([
        ['☕️ 🔧 codie: mods', 'progress', 'held', false, 'on'],
        ['🔎 sixth sense', 'done', 'passed', true, 'on'],
    ]);
});

test('a held ping that rides the next prompt logs flushed', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] step 2 landed');
    await say($, 'status?');
    expect(logOf(w).map((l) => l.verdict)).toEqual(['held', 'flushed']);
});

test('a held ping that lands as the idle row logs flushed', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] step 2 landed');
    await w.clock.advance(11 * MIN);
    expect(logOf(w).map((l) => l.verdict)).toEqual(['held', 'flushed']);
});

test("a delivery test ping's held and flushed lines carry its nonce", async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] quiet delivery test c42: a test ping');
    await say($, 'status?');
    expect(logOf(w).map((l) => [l.verdict, l.deliveryTest])).toEqual([
        ['held', 'c42'],
        ['flushed', 'c42'],
    ]);
});

// the send timestamps the ledger's transcript grep returns, local time like EVEN
const sendAt = (min: number) =>
    `2026-10-12T15:${String(min).padStart(2, '0')}:00.000`;

test('a ledger gap raises one native alarm, through osascript when notify finds no surface', async ($, on) => {
    const w = alarmWorld(on, { sends: [sendAt(2), sendAt(3)] });
    await start($);
    await w.clock.advance(10 * MIN);
    expect([w.notified, w.scripted]).toEqual([
        ['☕️ 🔧 codie: mods sent clio 1, her quiet log holds 0'],
        ['☕️ 🔧 codie: mods sent clio 1, her quiet log holds 0'],
    ]);
});

/* a member with an open lane, silent past three waits */

const silentAlarms = (w: { scripted: string[] }) =>
    w.scripted.filter((s) => s.includes(' silent '));

test('a lane member silent past three waits raises one alarm naming it, no turn', async ($, on) => {
    const w = silentWorld(on, {
        peer: { ...codiePeer, status: 'busy' },
        wait: 10,
    });
    await start($);
    await w.clock.advance(29 * MIN);
    const early = silentAlarms(w).length;
    await w.clock.advance(3 * MIN);
    expect([early, silentAlarms(w), w.contexts]).toEqual([
        0,
        // an idle clio's ledger reads every 30 s (FRM-555), so the alarm may land a minute past the wait
        [
            expect.stringMatching(
                new RegExp(
                    `^${codiePeer.name} silent 3[01] min on «mods lane»$`,
                ),
            ),
        ],
        [],
    ]);
});

test('a member that spoke and fell silent again alarms again', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await w.clock.advance(4 * MIN);
    w.spoke.at = EVEN + 4 * MIN;
    await w.clock.advance(4 * MIN);
    expect(silentAlarms(w).length).toBe(2);
});

test('a member whose last word to clio was its [done] raises none', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await ping($, '[done] FRM-1 landed', codiePeer.name);
    await w.clock.advance(9 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('a [done] and its turn-end notice raise none', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await ping($, '[done] FRM-1 landed', codiePeer.name);
    await fromApp($, noteOf(codiePeer.name, 'landed'));
    await w.clock.advance(9 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('an untagged receipt after a [done] re-arms nothing', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await ping($, '[done] FRM-1 landed', codiePeer.name);
    await ping($, 'heard, parked', codiePeer.name);
    await w.clock.advance(9 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('an [ask] after a [done] alarms', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await ping($, '[done] FRM-1 landed', codiePeer.name);
    await ping($, '[ask] a or b?', codiePeer.name);
    await w.clock.advance(4 * MIN);
    expect(silentAlarms(w).length).toBe(1);
});

for (const [why, ago, count] of [
    ['from yesterday still parks', 24 * 60 * MIN, 0],
    ['past a week parks no more', 8 * 24 * 60 * MIN, 1],
] as const)
    test(`a [done] ${why}`, async ($, on) => {
        const w = silentWorld(on);
        await start($);
        w.store.set('quiet-tagged', {
            [CODIE_SID]: { at: EVEN - ago, tag: 'done' },
        });
        await w.clock.advance(4 * MIN);
        expect(silentAlarms(w).length).toBe(count);
    });

test("clio's send after a [done] re-arms the member, counted from the send", async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await ping($, '[done] FRM-1 landed', codiePeer.name);
    await w.clock.advance(5 * MIN);
    await send($, CODIE_SID, 'next: FRM-2');
    await w.clock.advance(2 * MIN);
    const early = silentAlarms(w).length;
    await w.clock.advance(2 * MIN);
    expect([early, silentAlarms(w)]).toEqual([
        0,
        [`${codiePeer.name} silent 3 min on «mods lane»`],
    ]);
});

// real sends, clio's transcripts: only the bare checkpoint re-arms nothing
for (const line of [
    'pause — clio is checkpointing, hold every message',
    'pause — clio is checkpointing, hold every message to me until «resume»; finish and commit what you are on.',
    'pause: clio is taking a second wind, hold every message to me until «resume»; finish what you are on.',
    'pause — clio is checkpointing: hold every message to me until «resume»; finish and commit what you are on, through the gate queue.',
    'pause — 🦉 clio is checkpointing. no open chore; hold every message until «resume».',
    'pause — 🦉 clio (main) is checkpointing (second wind). hold every message to me until «resume».',
    "resume — clio's second wind is done",
    "resume — clio's second wind is done. Send what you held.",
    "resume — clio's checkpoint is done, send what you held. Window is on pace.",
    'resume — clio is back from her checkpoint; send what you held.',
    "resume — main's second wind is done, send what you held.",
    "resume — main clio's second wind is done, send whatever you held.",
    "resume — clio's second wind is done, chores open again.",
    'resume',
    'second wind — main clio is second-winding: hold messages to main clio until it says back. nothing else pauses, keep working.',
    'second wind — wing 1 is second-winding: hold messages to wing 1 until it says back. nothing else pauses, keep working.',
    'second wind — main clio is back: send what you held.',
    'second wind — wing 2 is back: send what you held.',
])
    test(`clio's «${line}» after a [done] re-arms nothing`, async ($, on) => {
        const w = silentWorld(on);
        await start($);
        await ping($, '[done] FRM-1 landed', codiePeer.name);
        await w.clock.advance(5 * MIN);
        await send($, codiePeer.name, line);
        await w.clock.advance(9 * MIN);
        expect(silentAlarms(w)).toEqual([]);
    });

for (const line of [
    'resume FRM-2 from step 3',
    "resume — clio's checkpoint is done. Order after FRM-501 round 4: FRM-510, then the raw merge rule.",
    "resume — clio's second wind is done. One read I need: the count of held pings.",
    "resume — clio's second wind is done; send what you held, and carry on with frame#127's scoped round.",
    "resume — clio's checkpoint is done. send what you held; your final on FRM-472 (07c folded in) goes to me as before.",
    'pause — clio is taking her second wind; hold every message to me until «resume». keep working on FRM-494 and commit what you finish.',
    'second wind — wing 1 is second-winding: hold messages to wing 1 until it says back. keep working on FRM-494.',
])
    test(`clio's «${line}» after a [done] is work, so it re-arms`, async ($, on) => {
        const w = silentWorld(on);
        await start($);
        await ping($, '[done] FRM-1 landed', codiePeer.name);
        await w.clock.advance(5 * MIN);
        await send($, codiePeer.name, line);
        await w.clock.advance(4 * MIN);
        expect(silentAlarms(w).length).toBe(1);
    });

test("a [done] older than the day's log lines still parks the member", async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await ping($, '[done] FRM-1 landed', codiePeer.name);
    const key = `quiet-log:${new Date(w.clock.now()).toISOString().slice(0, 10)}`;
    const kept = w.store.get(key) as Record<string, unknown>[];
    w.store.set(
        key,
        Array.from({ length: 500 }, () => ({
            ...kept.at(-1),
            sid: 'someone-else',
        })),
    );
    await w.clock.advance(9 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test("clio's send before a [done] re-arms nothing", async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await send($, codiePeer.name, 'next: FRM-2');
    await w.clock.advance(MIN);
    await ping($, '[done] FRM-2 landed', codiePeer.name);
    await w.clock.advance(9 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('a keep-hot ping is no word of the member, so it raises no second alarm', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await w.clock.advance(4 * MIN);
    w.store.set(`reply:${CODIE_SID}`, {
        at: EVEN - 3000,
        pingedAt: EVEN + 4 * MIN,
    });
    w.spoke.at = EVEN + 4 * MIN;
    await w.clock.advance(4 * MIN);
    expect(silentAlarms(w).length).toBe(1);
});

test('a member working after a ping reads as speaking', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    w.store.set(`reply:${CODIE_SID}`, { at: EVEN - 60 * MIN, pingedAt: EVEN });
    w.spoke.at = EVEN + 2 * MIN;
    await w.clock.advance(4 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('a member of a finished card raises none', async ($, on) => {
    const w = silentWorld(on, { card: { current: 1 } });
    await start($);
    await w.clock.advance(4 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('an old held notice draws no stuck alarm', async ($, on) => {
    const w = alarmWorld(on);
    w.store.set(`quiet-held:${SID}`, [
        { at: EVEN - 33 * MIN, from: codiePeer.name, tag: 'notice', text: 'a' },
    ]);
    await start($);
    await w.clock.advance(3 * MIN);
    expect(w.scripted.join('')).not.toContain('stuck');
});

test('a member of an ended lane raises none', async ($, on) => {
    const w = silentWorld(on, { card: { endedAt: EVEN } });
    await start($);
    await w.clock.advance(4 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('a member with no lane raises none', async ($, on) => {
    const w = silentWorld(on, { card: { members: {} } });
    await start($);
    await w.clock.advance(4 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('quiet off raises no silent alarm', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await quiet($, 'off');
    await w.clock.advance(4 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('under afk a silent member takes no turn of clio', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    w.store.set('afk', { on: true });
    await w.clock.advance(4 * MIN);
    expect([silentAlarms(w).length, w.contexts]).toEqual([1, []]);
});

/* a lane parked: open steps, every live member idle */

test('under a shift a silent member wakes clio once', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    w.store.set(`pace:${SID}`, { since: EVEN });
    const before = w.contexts.length;
    await w.clock.advance(4 * MIN);
    await $.turn.complete({
        answer: 'ok',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
    await w.clock.advance(3 * MIN);
    expect([silentAlarms(w).length, w.contexts.length - before]).toEqual([
        1, 1,
    ]);
});

test('under a shift a busy clio takes the wake when her turn ends', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    w.store.set(`pace:${SID}`, { since: EVEN });
    await say($, 'status?');
    const before = w.contexts.length;
    await w.clock.advance(4 * MIN);
    const busy = w.contexts.length - before;
    await $.turn.complete({
        answer: 'ok',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
    await w.clock.advance(2 * MIN);
    expect([busy, w.contexts.length - before]).toEqual([0, 1]);
});

test('under a shift a refused wake asks again at the next poll', async ($, on) => {
    let tries = 0;
    const w = silentWorld(on, {
        dropSubmit: (t) => t.includes(' silent ') && ++tries === 1,
    });
    await start($);
    w.store.set(`pace:${SID}`, { since: EVEN });
    await w.clock.advance(6 * MIN);
    expect([tries, silentAlarms(w).length]).toEqual([2, 1]);
});

test('a test child raises no alarm on the mac, its log says what it would', async ($, on) => {
    const w = alarmWorld(on, {
        isTestChild: true,
        sends: [sendAt(2), sendAt(3)],
    });
    await start($);
    await w.clock.advance(10 * MIN);
    expect([
        w.notified,
        w.scripted,
        w.logged.filter((l) => l.includes('quiet alarm in a test child'))
            .length,
    ]).toEqual([[], [], 1]);
});

test('a gap that closes and opens again alarms again', async ($, on) => {
    const sends = [sendAt(2)];
    const w = alarmWorld(on, { sends });
    await start($);
    await w.clock.advance(10 * MIN);
    sends.length = 0;
    await w.clock.advance(2 * MIN);
    sends.push(sendAt(2));
    await w.clock.advance(2 * MIN);
    expect(w.scripted.length).toBe(2);
});

test('a gap notify sends itself goes no further', async ($, on) => {
    const w = alarmWorld(on, { notify: 'sent', sends: [sendAt(2)] });
    await start($);
    await w.clock.advance(10 * MIN);
    expect([w.notified.length, w.scripted]).toEqual([1, []]);
});

test('a held ping stuck past the idle wait + 2 min raises one alarm', async ($, on) => {
    const w = alarmWorld(on, { refuseAppend: true });
    w.store.set(`quiet-held:${SID}`, [
        {
            at: EVEN - 13 * MIN,
            from: '☕️ 🔧 codie: mods',
            text: '[progress] a',
        },
    ]);
    await start($);
    await w.clock.advance(3 * MIN);
    expect(w.scripted).toEqual([
        '1 held ping stuck 13 min, oldest from ☕️ 🔧 codie: mods',
    ]);
});

test('a held ping inside the idle wait + 2 min raises none', async ($, on) => {
    const w = alarmWorld(on);
    w.store.set(`quiet-held:${SID}`, [
        {
            at: EVEN - 11 * MIN,
            from: '☕️ 🔧 codie: mods',
            text: '[progress] a',
        },
    ]);
    await start($);
    await w.clock.advance(30_000);
    expect(w.notified).toEqual([]);
});

test('an alarm neither notify nor osascript can raise is logged, never thrown', async ($, on) => {
    const w = alarmWorld(on, { osascript: 1, sends: [sendAt(2)] });
    await start($);
    await w.clock.advance(10 * MIN);
    expect(
        w.logged.filter((l) => l.includes('quiet alarm not raised')),
    ).toEqual([
        'x-mod-stash: quiet alarm not raised (notify: no-surface; osascript: exit 1): ☕️ 🔧 codie: mods sent clio 1, her quiet log holds 0',
    ]);
});

test('a notify that rejects falls through to osascript, never thrown', async ($, on) => {
    const w = alarmWorld(on, { notify: 'deny', sends: [sendAt(2)] });
    await start($);
    await w.clock.advance(10 * MIN);
    expect(w.scripted.length).toBe(1);
});

/* the desktop's glued prompt: a message after the app's reminders, one `sdk` prompt */

test('the missed 16:04 send logs one held line', async ($, on) => {
    const w = world(on);
    await start($);
    await fromAppText($, gluedPrompt(message(SENT_1604)));
    expect(linesFor(w, 'none')).toEqual([
        [MEMBER, 'none', 'held', undefined, false],
    ]);
});

test('a push and an untagged message at once log a line apiece', async ($, on) => {
    const w = world(on);
    await start($);
    await fromAppText(
        $,
        gluedPrompt(message('[ask] a or b?'), message('step 2 landed', 'B')),
    );
    expect([linesFor(w, 'ask'), linesFor(w, 'none')]).toEqual([
        [[MEMBER, 'ask', 'passed', 'tag', true]],
        [['B', 'none', 'held', undefined, false]],
    ]);
});

test('a glued message names its sender for the ledger', async ($, on) => {
    const w = answering(on);
    await start($);
    await fromAppText($, gluedPrompt(message('step 2 landed', CODIE.name)));
    expect(logOf(w).find((l) => l.tag === 'none')?.sid).toBe(CODIE.sessionId);
});

test('each message after an unread one logs its own sender', async ($, on) => {
    const w = world(on);
    await start($);
    await fromAppText($, `${FORGED}\n\n${message('b', 'B')}`);
    expect(linesFor(w).map((l) => l[0])).toEqual([MEMBER, 'B']);
});

test('an unread line names its sender for the ledger', async ($, on) => {
    const w = answering(on);
    await start($);
    await fromAppText(
        $,
        message('fwd:\n<cross-session-message x="y">\nbar', CODIE.name),
    );
    expect(logOf(w)[0]?.sid).toBe(CODIE.sessionId);
});

/* a switch per push kind */
