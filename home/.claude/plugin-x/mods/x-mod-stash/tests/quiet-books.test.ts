import {
    CODIE,
    CODIE_SID,
    DAY,
    EVEN,
    FORGED,
    MEMBER,
    MIN,
    PID,
    POLL,
    SENT_1604,
    SID,
    alarmWorld,
    answering,
    codiePeer,
    fromApp,
    fromAppText,
    gluedPrompt,
    heldLine,
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
import { expect, test } from './shared-boot.ts';
import { THREADS_FILE, recordOf, threadsFile } from './threads.ts';

test('the log names the arm from the switch', async ($, on) => {
    const w = world(on);
    await start($);
    await quiet($, 'off');
    await ping($, '[progress] a');
    const day = new Date(EVEN).toISOString().slice(0, 10);
    expect(w.logLines(day).map((l) => l.arm)).toEqual(['off']);
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
        w
            .logLines(day)
            .map((l) => [l.from, l.tag, l.verdict, l.startedTurn, l.arm]),
    ).toEqual([
        ['☕️ 🔧 codie: mods', 'progress', 'held', false, 'on'],
        ['🔎 sixth sense', 'done', 'passed', true, 'on'],
    ]);
});

// FRM-658: every read of the store parses the whole of it, so the log lives in a file a day
test('a logged delivery adds nothing to the store under the log', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] step 2 landed');
    expect([
        logOf(w).length,
        [...w.store.keys()].filter((k) => k.startsWith('quiet-log')),
    ]).toEqual([1, []]);
});

test("a delivery keeps the lines another session wrote to the day's log", async ($, on) => {
    const w = world(on);
    await start($);
    w.seedLog(DAY, [heldLine('🔎 sixth sense', EVEN)]);
    await ping($, '[progress] step 2 landed');
    expect(logOf(w).map((l) => l.from)).toEqual([
        '🔎 sixth sense',
        '☕️ 🔧 codie: mods',
    ]);
});

// FRM-658:W2, dima's ages: the log's files 30 days, a gone session's keys 7
const DAY_MS = 24 * 60 * MIN;
const dayOf = (ago: number) =>
    new Date(EVEN - ago * DAY_MS).toISOString().slice(0, 10);
// the log's dir holds these files, and what the mod removed
const logDir = (names: string[]) => {
    const removed: string[] = [];
    return {
        removed,
        world: {
            listed: {
                '/home/.claude/shelf/quiet-log': names.map((name) => ({
                    mtimeMs: 0,
                    name,
                })),
            },
            run: (argv: readonly string[]) => {
                if (argv[0] === 'trash') removed.push(...argv.slice(1));
                return undefined;
            },
        },
    };
};

test("a day's first log line drops the log's files past 30 days", async ($, on) => {
    const dir = logDir([
        ...Array.from({ length: 40 }, (_, i) => `${dayOf(i + 1)}.jsonl`),
        '2020-notes.md',
    ]);
    world(on, dir.world);
    await start($);
    await ping($, '[progress] step 2 landed');
    expect(dir.removed.sort()).toEqual(
        Array.from(
            { length: 10 },
            (_, i) => `/home/.claude/shelf/quiet-log/${dayOf(i + 31)}.jsonl`,
        ).sort(),
    );
});

test("a later log line of the day looks at no file's age", async ($, on) => {
    const dir = logDir([`${dayOf(40)}.jsonl`]);
    const w = world(on, dir.world);
    await start($);
    w.seedLog(DAY, [heldLine('🔎 sixth sense', EVEN)]);
    await ping($, '[progress] step 2 landed');
    expect(dir.removed).toEqual([]);
});

test("a test child's log sits beside its store, the fleet's untouched", async ($, on) => {
    const w = world(on, { isTestChild: true });
    await start($);
    await ping($, '[progress] step 2 landed');
    expect(Object.keys(w.files).filter((f) => f.includes('quiet-log'))).toEqual(
        [`/run/plugin-cache/quiet-log/${DAY}.jsonl`],
    );
});

const GONE_SID = '11111111-1111-4111-8111-111111111111';
const RECENT_SID = '22222222-2222-4222-8222-222222222222';
const LIVE_SID = '33333333-3333-4333-8333-333333333333';
const FAMILIES = [
    'reply:',
    'band-read:',
    'model:',
    'hot:',
    'context:',
    'quiet-held:',
];
const KEPT_FAMILIES = ['herdr-read:', 'words:2026-10-01:', 'lane-step:'];
// a start over a store holding each family's key of a gone, a recent and a live session; `find` lists recent transcripts
const pruneStart = async (
    $: Parameters<typeof start>[0],
    on: Parameters<typeof world>[0],
    find: string | { exitCode: number; stdout: string },
    listed = {},
    tear = (_files: Record<string, string>) => {},
) => {
    const w = world(on, {
        listed,
        peers: [{ name: 'peer', pid: 77, sessionId: LIVE_SID }],
        // a whole `7d`: a bare number rounds each age up to full days
        run: (argv) =>
            argv[0] === 'find' && argv.includes('-7d') ? find : undefined,
    });
    for (const sid of [GONE_SID, RECENT_SID, LIVE_SID])
        for (const family of [...FAMILIES, ...KEPT_FAMILIES])
            w.store.set(family + sid, { at: 1 });
    w.store.set('model:a name, no session id', 'x');
    tear(w.files);
    await start($);
    return w;
};
const goneKeys = (w: { store: Map<string, unknown> }) =>
    [...w.store.keys()].filter((k) => k.endsWith(GONE_SID));
const RECENT = `/home/.claude/projects/-p/${RECENT_SID}.jsonl\n`;

test('a start drops a gone session’s keys, and no key of a recent or a live one', async ($, on) => {
    const w = await pruneStart($, on, RECENT);
    expect([
        goneKeys(w),
        [...w.store.keys()].filter(
            (k) => k.endsWith(RECENT_SID) || k.endsWith(LIVE_SID),
        ).length,
        w.store.has('model:a name, no session id'),
    ]).toEqual([
        KEPT_FAMILIES.map((f) => f + GONE_SID),
        2 * (FAMILIES.length + KEPT_FAMILIES.length),
        true,
    ]);
});

for (const [why, find] of [
    ['fails halfway', { exitCode: 1, stdout: RECENT }],
    ['finds none', ''],
] as const)
    test(`a transcript lookup that ${why} drops no key`, async ($, on) => {
        const w = await pruneStart($, on, find);
        expect(goneKeys(w).length).toBe(FAMILIES.length + KEPT_FAMILIES.length);
    });

test('a registry that lists no session drops no key', async ($, on) => {
    const w = await pruneStart($, on, RECENT, { '/home/.claude/sessions': [] });
    expect(goneKeys(w).length).toBe(FAMILIES.length + KEPT_FAMILIES.length);
});

test("a gone session's 🔥 off outlives it", async ($, on) => {
    const w = world(on, {
        run: (argv) => (argv[0] === 'find' ? RECENT : undefined),
    });
    w.store.set(`hot:${GONE_SID}`, { off: true });
    await start($);
    expect([w.store.has(`hot:${GONE_SID}`), w.store.has('pruned-at')]).toEqual([
        true,
        true,
    ]);
});

test('a torn registry file drops no key', async ($, on) => {
    const w = await pruneStart($, on, RECENT, {}, (files) => {
        files['/home/.claude/sessions/77.json'] = '{"pid":7';
    });
    expect(goneKeys(w).length).toBe(FAMILIES.length + KEPT_FAMILIES.length);
});

test('a resumed session keeps its own keys, its transcript old', async ($, on) => {
    on('session.id', () => ({ value: GONE_SID }));
    const w = await pruneStart($, on, RECENT);
    expect(goneKeys(w)).toContain(`reply:${GONE_SID}`);
});

test('a second start of the day looks for nothing to drop', async ($, on) => {
    const w = await pruneStart($, on, RECENT);
    w.store.set(`reply:${GONE_SID}`, { at: 1 });
    await start($);
    const same = w.store.has(`reply:${GONE_SID}`);
    w.store.set('pruned-at', EVEN - DAY_MS);
    await start($);
    expect([same, w.store.has(`reply:${GONE_SID}`)]).toEqual([true, false]);
});

// exit 6: 40 days of each family, 12 sessions a day, each value as long as the live store's is on 23 Nov
const PER_DAY = 12;
const CAP = 160_000;
const sidAt = (ago: number, n: number) =>
    `${String(ago).padStart(8, '0')}-1111-4111-8111-${String(n).padStart(12, '0')}`;
const longAs = (bytes: number) => 'x'.repeat(bytes);
const seedOldStore = (store: Map<string, unknown>) => {
    for (let ago = 0; ago < 40; ago++)
        for (let n = 0; n < PER_DAY; n++) {
            const sid = sidAt(ago, n);
            const at = EVEN - ago * DAY_MS;
            store.set(`reply:${sid}`, { at, text: longAs(80) });
            store.set(`band-read:${sid}`, at);
            store.set(`model:${sid}`, 'Opus 5.5 (xhigh)');
            store.set(`hot:${sid}`, { at, isOn: true });
            store.set(`context:${sid}`, 41);
            store.set(`quiet-held:${sid}`, []);
            store.set(`kept:${sid}`, { asks: longAs(420), at });
            store.set(`succ:${sid}`, { at, to: sid });
            store.set(`words:${dayOf(ago)}:${sid}`, longAs(60));
        }
};
// the oldest day each family still holds a key of, in days
const oldestDays = (store: Map<string, unknown>) => {
    const oldest: Record<string, number> = {};
    for (const key of store.keys()) {
        const ago = Number(/(\d{8})-1111-/.exec(key)?.[1] ?? -1);
        const family = key.split(':')[0] ?? '';
        if (ago >= 0) oldest[family] = Math.max(oldest[family] ?? 0, ago);
    }
    return oldest;
};

test('a store fed 40 days of each family keeps its ages and stays under the cap', async ($, on) => {
    const recent = Array.from({ length: 7 }, (_, ago) =>
        Array.from(
            { length: PER_DAY },
            (__, n) => `/home/.claude/projects/-p/${sidAt(ago, n)}.jsonl\n`,
        ).join(''),
    ).join('');
    const w = world(on, {
        run: (argv) => (argv[0] === 'find' ? recent : undefined),
    });
    seedOldStore(w.store);
    await start($);
    // the words go at a reply that bolds one
    await $.session
        .append({
            door: 'response',
            message: {
                content: [{ text: 'a wisp', type: 'text' }],
                role: 'assistant',
                type: 'assistant',
            },
            origin: { kind: 'model', model: 'claude-opus-5-5' },
            uuid: 'u1',
        })
        .catch(() => undefined);
    expect(oldestDays(w.store)).toEqual({
        'band-read': 6,
        context: 6,
        hot: 6,
        kept: 6,
        model: 6,
        'quiet-held': 6,
        reply: 6,
        succ: 6,
        words: 30,
    });
    expect(JSON.stringify(Object.fromEntries(w.store)).length).toBeLessThan(
        CAP,
    );
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
    await w.skip(11 * MIN);
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
    await w.skip(29 * MIN);
    const early = silentAlarms(w).length;
    await w.skip(3 * MIN);
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
    await w.skip(4 * MIN);
    w.spoke.at = EVEN + 4 * MIN;
    await w.skip(4 * MIN);
    expect(silentAlarms(w).length).toBe(2);
});

test('a member whose last word to clio was its [done] raises none', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await ping($, '[done] FRM-1 landed', codiePeer.name);
    await w.skip(9 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('a [done] and its turn-end notice raise none', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await ping($, '[done] FRM-1 landed', codiePeer.name);
    await fromApp($, noteOf(codiePeer.name, 'landed'));
    await w.skip(9 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('an untagged receipt after a [done] re-arms nothing', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await ping($, '[done] FRM-1 landed', codiePeer.name);
    await ping($, 'heard, parked', codiePeer.name);
    await w.skip(9 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

// FRM-698 exit 4: a codie whose lane's reviewer is done raises no silent alarm on that card
const REVIEWER = {
    ...codiePeer,
    name: '🔎 sixth sense',
    pid: 779,
    sessionId: 's1x7s1x7-sixth',
};
for (const [why, tagged, sent, count] of [
    ['its reviewer’s [done] is in', true, false, 0],
    ['its reviewer sent none', false, false, 1],
    ['its clio sent it a line after the [done]', true, true, 1],
] as const)
    test(`a silent codie, ${why}: ${count} alarm`, async ($, on) => {
        const w = silentWorld(on, {
            also: [REVIEWER],
            card: {
                members: {
                    codie: codiePeer.name,
                    'sixth-sense': REVIEWER.name,
                },
            },
        });
        await start($);
        if (tagged)
            w.store.set('quiet-tagged', {
                [REVIEWER.sessionId]: { at: EVEN, tag: 'done' },
            });
        if (sent) w.store.set('quiet-sent', { [CODIE_SID]: EVEN + 1 });
        await w.skip(5 * MIN);
        expect(
            silentAlarms(w).filter((t) => t.startsWith(codiePeer.name)).length,
        ).toBe(count);
    });

test('a wing’s member parked by its [done] raises no silent alarm in main', async ($, on) => {
    const w = silentWorld(on, {
        files: {
            [THREADS_FILE]: threadsFile([
                { pid: PID, sessionId: SID, ...recordOf('🦉 clio') },
                {
                    coordinator: 'clio-wing-1',
                    pid: codiePeer.pid,
                    role: 'codie',
                    sessionId: CODIE_SID,
                },
            ]),
        },
    });
    await start($);
    w.store.set('quiet-tagged:clio-wing-1', {
        [CODIE_SID]: { at: EVEN, tag: 'done' },
    });
    await w.skip(5 * MIN);
    const parked = silentAlarms(w).length;
    w.store.set('quiet-sent:clio-wing-1', { [CODIE_SID]: EVEN + 5 * MIN });
    await w.skip(5 * MIN);
    expect([parked, silentAlarms(w).length]).toEqual([0, 1]);
});

test('an [ask] after a [done] alarms', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await ping($, '[done] FRM-1 landed', codiePeer.name);
    await ping($, '[ask] a or b?', codiePeer.name);
    await w.skip(4 * MIN);
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
        await w.skip(4 * MIN);
        expect(silentAlarms(w).length).toBe(count);
    });

test("clio's send after a [done] re-arms the member, counted from the send", async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await ping($, '[done] FRM-1 landed', codiePeer.name);
    await w.skip(5 * MIN);
    await send($, CODIE_SID, 'next: FRM-2');
    await w.skip(2 * MIN);
    const early = silentAlarms(w).length;
    await w.skip(2 * MIN);
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
        await w.skip(5 * MIN);
        await send($, codiePeer.name, line);
        await w.skip(9 * MIN);
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
        await w.skip(5 * MIN);
        await send($, codiePeer.name, line);
        await w.skip(4 * MIN);
        expect(silentAlarms(w).length).toBe(1);
    });

test("a [done] older than the day's log lines still parks the member", async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await ping($, '[done] FRM-1 landed', codiePeer.name);
    const day = new Date(w.clock.now()).toISOString().slice(0, 10);
    const kept = w.logLines(day);
    w.seedLog(
        day,
        Array.from({ length: 500 }, () => ({
            ...kept.at(-1),
            sid: 'someone-else',
        })),
    );
    await w.skip(9 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test("clio's send before a [done] re-arms nothing", async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await send($, codiePeer.name, 'next: FRM-2');
    await w.clock.advance(MIN);
    await ping($, '[done] FRM-2 landed', codiePeer.name);
    await w.skip(9 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('a keep-hot ping is no word of the member, so it raises no second alarm', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await w.skip(4 * MIN);
    w.store.set(`reply:${CODIE_SID}`, {
        at: EVEN - 3000,
        pingedAt: EVEN + 4 * MIN,
    });
    w.spoke.at = EVEN + 4 * MIN;
    await w.skip(4 * MIN);
    expect(silentAlarms(w).length).toBe(1);
});

test('a member working after a ping reads as speaking', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    w.store.set(`reply:${CODIE_SID}`, { at: EVEN - 60 * MIN, pingedAt: EVEN });
    w.spoke.at = EVEN + 2 * MIN;
    await w.skip(4 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('a member of a finished card raises none', async ($, on) => {
    const w = silentWorld(on, { card: { current: 1 } });
    await start($);
    await w.skip(4 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('an old held notice draws no stuck alarm', async ($, on) => {
    const w = alarmWorld(on);
    w.store.set(`quiet-held:${SID}`, [
        { at: EVEN - 33 * MIN, from: codiePeer.name, tag: 'notice', text: 'a' },
    ]);
    await start($);
    await w.skip(3 * MIN);
    expect(w.scripted.join('')).not.toContain('stuck');
});

test('a member of an ended lane raises none', async ($, on) => {
    const w = silentWorld(on, { card: { endedAt: EVEN } });
    await start($);
    await w.skip(4 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('a member with no lane raises none', async ($, on) => {
    const w = silentWorld(on, { card: { members: {} } });
    await start($);
    await w.skip(4 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('quiet off raises no silent alarm', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    await quiet($, 'off');
    await w.skip(4 * MIN);
    expect(silentAlarms(w)).toEqual([]);
});

test('under afk a silent member takes no turn of clio', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    w.store.set('afk', { on: true });
    await w.skip(4 * MIN);
    expect([silentAlarms(w).length, w.contexts]).toEqual([1, []]);
});

/* a lane parked: open steps, every live member idle */

test('under a shift a silent member wakes clio once', async ($, on) => {
    const w = silentWorld(on);
    await start($);
    w.store.set(`pace:${SID}`, { since: EVEN });
    const before = w.contexts.length;
    await w.skip(4 * MIN);
    await $.turn.complete({
        answer: 'ok',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
    await w.skip(3 * MIN);
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
    await w.skip(4 * MIN);
    const busy = w.contexts.length - before;
    await $.turn.complete({
        answer: 'ok',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
    await w.skip(2 * MIN);
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
    await w.skip(10 * MIN);
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
    await w.skip(10 * MIN);
    sends.length = 0;
    await w.skip(2 * MIN);
    sends.push(sendAt(2));
    await w.skip(2 * MIN);
    expect(w.scripted.length).toBe(2);
});

test('a gap notify sends itself goes no further', async ($, on) => {
    const w = alarmWorld(on, { notify: 'sent', sends: [sendAt(2)] });
    await start($);
    await w.skip(10 * MIN);
    expect([w.notified.length, w.scripted]).toEqual([1, []]);
});

test('a held ping stuck past the idle wait + 2 min raises one alarm', async ($, on) => {
    const w = alarmWorld(on, { refuseAppend: true });
    w.store.set(`quiet-held:${SID}`, [
        {
            at: EVEN - 12.2 * MIN,
            from: '☕️ 🔧 codie: mods',
            text: '[progress] a',
        },
    ]);
    await start($);
    await w.skip(3 * MIN);
    expect(w.scripted).toEqual([
        '1 held ping stuck 13 min, oldest from ☕️ 🔧 codie: mods',
    ]);
});

test('a held ping inside the idle wait + 2 min raises none', async ($, on) => {
    const w = alarmWorld(on, { refuseAppend: true });
    w.store.set(`quiet-held:${SID}`, [
        {
            at: EVEN - 10.9 * MIN,
            from: '☕️ 🔧 codie: mods',
            text: '[progress] a',
        },
    ]);
    await start($);
    await w.clock.advance(POLL);
    expect([w.notified, w.scripted]).toEqual([[], []]);
});

test('an alarm neither notify nor osascript can raise is logged, never thrown', async ($, on) => {
    const w = alarmWorld(on, { osascript: 1, sends: [sendAt(2)] });
    await start($);
    await w.skip(10 * MIN);
    expect(
        w.logged.filter((l) => l.includes('quiet alarm not raised')),
    ).toEqual([
        'x-mod-stash: quiet alarm not raised (notify: no-surface; osascript: exit 1): ☕️ 🔧 codie: mods sent clio 1, her quiet log holds 0',
    ]);
});

test('a notify that rejects falls through to osascript, never thrown', async ($, on) => {
    const w = alarmWorld(on, { notify: 'deny', sends: [sendAt(2)] });
    await start($);
    await w.skip(10 * MIN);
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
