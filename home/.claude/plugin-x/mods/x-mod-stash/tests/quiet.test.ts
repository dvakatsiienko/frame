import type { On } from 'claude-code';
import { type Engine, expect, test } from 'claude-code/testing';

import { parkedWakeMs } from '../hooks/parked-wake.ts';
import { clioAddress, peerPing } from '../hooks/quiet.ts';
import { laneMemberRow } from '../hooks/roster.ts';
import {
    CLIO,
    CODIE_SID,
    EVEN,
    EVENT,
    FORGED,
    IDLE,
    LANE,
    LANES,
    LINKED,
    MEMBER,
    MIN,
    NOTE,
    POLL,
    ROUNDS_FILE,
    ROUND_CODIE,
    SID,
    alarmWorld,
    codiePeer,
    fromAppText,
    gluedPrompt,
    held,
    kept,
    laneCard,
    linesFor,
    logOf,
    message,
    ping,
    roundsIn,
    roundsRaw,
    say,
    send,
    silentWorld,
    start,
    steps,
    stored,
    thread,
    world,
} from './quiet-helpers.ts';
import { THREADS_FILE, recordOf } from './threads.ts';

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

const RELAY = '/home/.local/state/crow/relay.json';

const CROW_SID = 'f9f9f9f9-crow';

const WAKE = JSON.stringify({
    id: 'w1',
    line: 'wake w1 · day · read the last 30 steps',
});

const crowPeer = { name: '🐦 ⬛ crow', pid: 777, sessionId: CROW_SID };

function relayWorld(on: On, delivered = true) {
    const files: Record<string, string> = { [RELAY]: WAKE };
    const sent: { to: unknown; text: string }[] = [];
    const w = world(on, { files, peers: [crowPeer] });
    on('session.send', (_$, e) => {
        sent.push({ text: e.text, to: e.to });
        return delivered
            ? { isDelivered: true }
            : { isDelivered: false, reason: 'not reachable' };
    });
    return { ...w, files, sent };
}

test("a parked crow wake goes to her session from clio's poll, and is marked sent", async ($, on) => {
    const w = relayWorld(on);
    await start($);
    await w.clock.advance(POLL);
    expect([w.sent, JSON.parse(w.files[RELAY] ?? '{}').isSent]).toEqual([
        [{ text: 'wake w1 · day · read the last 30 steps', to: CROW_SID }],
        true,
    ]);
});

test('a wake that does not go out stays parked for the next poll', async ($, on) => {
    const w = relayWorld(on, false);
    await start($);
    await w.clock.advance(POLL);
    expect(w.files[RELAY]).toBe(WAKE);
});

test('a wake already sent goes out once', async ($, on) => {
    const w = relayWorld(on);
    await start($);
    await w.clock.advance(POLL);
    await w.clock.advance(POLL);
    expect(w.sent.length).toBe(1);
});

/* o75: the quiet ledger's gaps and a stuck hold raise a native alarm */

const parkedWakes = (w: { submitted: string[] }) =>
    w.submitted.filter((text) => text.includes('🅿️ parked lane'));

test('a lane whose members sit idle 10 min wakes its clio once, no shift needed', async ($, on) => {
    const w = silentWorld(on, { wait: 60 });
    await start($);
    await w.clock.advance(9 * MIN);
    const early = parkedWakes(w).length;
    await w.clock.advance(2 * MIN);
    await $.turn.complete({
        answer: 'ok',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
    await w.clock.advance(5 * MIN);
    expect([early, parkedWakes(w).length]).toEqual([0, 1]);
});

const idleLane = async (
    $: Engine,
    w: { clock: { advance: (ms: number) => Promise<void> } },
) => {
    await start($);
    await w.clock.advance(11 * MIN);
};

test('a parked lane two steps from its end whose next chunk is signed wakes nobody', async ($, on) => {
    const w = silentWorld(on, {
        card: steps('FRM-1', 'FRM-1', 'FRM-2'),
        labels: { 'FRM-2': ['agent', 'signed'] },
        wait: 60,
    });
    await idleLane($, w);
    expect(parkedWakes(w)).toEqual([]);
});

test('a parked lane two steps from its end whose next chunk is unsigned wakes once, naming the lane and the ticket', async ($, on) => {
    const w = silentWorld(on, {
        card: steps('FRM-1', 'FRM-1', 'FRM-2'),
        labels: { 'FRM-2': ['agent'] },
        wait: 60,
    });
    await idleLane($, w);
    expect(parkedWakes(w)).toEqual([
        expect.stringContaining(
            '«mods lane» (l1): 2 steps left in FRM-1; next chunk FRM-2 is unsigned',
        ),
    ]);
});

test('a parked lane more than two steps from its chunk end wakes nobody', async ($, on) => {
    const w = silentWorld(on, {
        card: steps('FRM-1', 'FRM-1', 'FRM-1', 'FRM-2'),
        labels: { 'FRM-2': ['agent'] },
        wait: 60,
    });
    await idleLane($, w);
    expect(parkedWakes(w)).toEqual([]);
});

test('a parked lane with nothing queued past its chunk wakes once: nothing queued, sign the next', async ($, on) => {
    const w = silentWorld(on, { card: steps('FRM-1', 'FRM-1'), wait: 60 });
    await idleLane($, w);
    expect(parkedWakes(w)).toEqual([
        expect.stringContaining(
            '«mods lane» (l1): 2 steps left in FRM-1, nothing queued, sign the next',
        ),
    ]);
});

test('a parked lane whose next chunk linear cannot read wakes nobody', async ($, on) => {
    const w = silentWorld(on, { card: steps('FRM-1', 'FRM-2'), wait: 60 });
    await idleLane($, w);
    expect(parkedWakes(w)).toEqual([]);
});

test('a parked lane counts only the open steps of its chunk: a done one after the pointer is not left', async ($, on) => {
    const card = steps('FRM-1', 'FRM-1', 'FRM-1', 'FRM-2');
    card.items[1] = {
        ...card.items[1],
        isDone: true,
    } as (typeof card.items)[number];
    card.items[2] = {
        ...card.items[2],
        isDone: true,
    } as (typeof card.items)[number];
    const w = silentWorld(on, {
        card,
        labels: { 'FRM-2': ['agent'] },
        wait: 60,
    });
    await idleLane($, w);
    expect(parkedWakes(w)).toEqual([
        expect.stringContaining(
            '1 step left in FRM-1; next chunk FRM-2 is unsigned',
        ),
    ]);
});

test("a parked lane's chunk ends where another ticket's steps start", async ($, on) => {
    const w = silentWorld(on, {
        card: steps('FRM-1', 'FRM-2', 'FRM-2', 'FRM-1', 'FRM-1'),
        labels: { 'FRM-2': ['agent'] },
        wait: 60,
    });
    await idleLane($, w);
    expect(parkedWakes(w)).toEqual([
        expect.stringContaining(
            '1 step left in FRM-1; next chunk FRM-2 is unsigned',
        ),
    ]);
});

test('a parked hand-made card with no tickets keeps the idle wake', async ($, on) => {
    const w = silentWorld(on, {
        card: {
            items: [1, 2, 3].map((i) => ({ done: false, text: `step ${i}` })),
        },
        wait: 60,
    });
    await idleLane($, w);
    expect(parkedWakes(w)).toEqual([
        expect.stringContaining('«mods lane» has open steps'),
    ]);
});

test('a failed linear read waits 10 min before the next, logged once', async ($, on) => {
    const w = silentWorld(on, { card: steps('FRM-1', 'FRM-2'), wait: 60 });
    await idleLane($, w);
    await w.clock.advance(3 * MIN);
    expect(
        w.logged.filter((l) => l.includes('linear read FRM-2')),
    ).toHaveLength(1);
});

test('a member speaking again re-arms the parked wake', async ($, on) => {
    const w = silentWorld(on, { wait: 60 });
    await start($);
    await w.clock.advance(11 * MIN);
    await $.turn.complete({
        answer: 'ok',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
    w.spoke.at = EVEN + 12 * MIN;
    await w.clock.advance(12 * MIN);
    expect(parkedWakes(w).length).toBe(2);
});

test('a finished or ended lane wakes nobody', async ($, on) => {
    const w = silentWorld(on, { card: { current: 1 }, wait: 60 });
    await start($);
    await w.clock.advance(15 * MIN);
    expect(parkedWakes(w)).toEqual([]);
});

test('a member still working wakes nobody', async ($, on) => {
    const w = silentWorld(on, {
        peer: { ...codiePeer, status: 'busy' },
        wait: 60,
    });
    await start($);
    await w.clock.advance(15 * MIN);
    expect(parkedWakes(w)).toEqual([]);
});

test("a live wing's lane wakes nobody here", async ($, on) => {
    const wing = '🦉🪽 clio: wing 9';
    const w = silentWorld(on, {
        also: [{ name: wing, pid: 779, sessionId: 'w9', status: 'idle' }],
        card: { runner: wing },
        wait: 60,
    });
    await start($);
    await w.clock.advance(15 * MIN);
    expect(parkedWakes(w)).toEqual([]);
});

test("a dead wing's lane falls to main", async ($, on) => {
    const w = silentWorld(on, {
        card: { runner: '🦉🪽 clio: wing 9' },
        wait: 60,
    });
    await start($);
    await w.clock.advance(15 * MIN);
    expect(parkedWakes(w).length).toBe(1);
});

test('a ping moving the last word back wakes no second time', async ($, on) => {
    const w = silentWorld(on, { wait: 60 });
    await start($);
    await w.clock.advance(11 * MIN);
    await $.turn.complete({
        answer: 'ok',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
    w.spoke.at = EVEN - 5 * MIN;
    await w.clock.advance(12 * MIN);
    expect(parkedWakes(w).length).toBe(1);
});

/* FRM-605: the 14:55 replay, built from that minute's records, never from the answer: clio's link calls on herdr lane 2
   (her transcript, 14:54:04, a session id per role; the card took each registry name then, «🔧 fleet | FRM-588» and
   «🌗 🔎 fleet | FRM-588»), dima's /rename of the codie to «🌗 🔧 fleet | FRM-601» (its transcript, 14:54:33), the codie
   at work 14:54:48–15:01, the alarm at 14:55:43 reading «idle 14 min» (both members' last word at 14:41) */

const SIXTH_SID = '2735ed87-sixth';

const replayCodie = { ...codiePeer, name: '🔧 fleet | FRM-588' };

const replaySixth = {
    name: '🌗 🔎 fleet | FRM-588',
    pid: 779,
    sessionId: SIXTH_SID,
    status: 'idle',
};

async function replay1455($: Engine, on: On) {
    const files: Record<string, string> = {
        [LANES]: JSON.stringify({
            lanes: [laneCard({ members: {}, title: 'herdr lane 2' })],
        }),
    };
    const w = alarmWorld(on, {
        also: [replaySixth],
        files,
        lastWrite: () => EVEN - 14 * MIN,
        peer: replayCodie,
    });
    w.store.set('quiet-wait', 60);
    await start($);
    // clio may name a member by its 8-char prefix: the card still keeps the full session id
    for (const [role, session] of [
        ['codie', CODIE_SID.slice(0, 8)],
        ['sixth-sense', SIXTH_SID],
    ])
        await $.tool.call({
            act: 'link',
            id: 'l1',
            op: 'glide',
            role,
            session,
            tool: 'mcp__x-mod-stash__orbit',
        } as never);
    const renamed = {
        ...replayCodie,
        name: '🌗 🔧 fleet | FRM-601',
        status: 'busy',
    };
    files[`/home/.claude/sessions/${replayCodie.pid}.json`] =
        JSON.stringify(renamed);
    const card = JSON.parse(files[LANES] ?? '{}').lanes[0];
    const rows = [renamed, replaySixth].map((r) => ({
        base: { name: r.name, sid: r.sessionId, status: r.status },
        isAlive: true,
    }));
    return { card, rows, w };
}

test('the 14:55 replay: each card entry resolves to its own live session after a rename', async ($, on) => {
    const { card, rows } = await replay1455($, on);
    expect(
        (['codie', 'sixth-sense'] as const).map(
            (role) =>
                laneMemberRow(rows, card.members[role], card.linkedIds?.[role])
                    ?.base.sid,
        ),
    ).toEqual([CODIE_SID, SIXTH_SID]);
});

test('the 14:55 replay: a codie renamed after its link and at work wakes nobody', async ($, on) => {
    const { w } = await replay1455($, on);
    await w.clock.advance(15 * MIN);
    expect(parkedWakes(w)).toEqual([]);
});

const turnEnd = ($: Engine) =>
    $.turn.complete({
        answer: 'ok',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });

const unreadLines = (w: { logged: string[] }) =>
    w.logged.filter((l) => l.includes('reads no live session'));

test('a stopped codie and a sixth sense idle 30 min wake once, the unread line said once', async ($, on) => {
    const card = laneCard({
        linkedIds: { codie: 'dead0000-codie', 'sixth-sense': SIXTH_SID },
        members: {
            codie: '🔧 gone | FRM-1',
            'sixth-sense': replaySixth.name,
        },
    });
    const w = alarmWorld(on, {
        files: { [LANES]: JSON.stringify({ lanes: [card] }) },
        lastWrite: () => EVEN - 30 * MIN,
        peer: replaySixth,
    });
    w.store.set('quiet-wait', 60);
    await start($);
    for (let tick = 0; tick < 5; tick++) {
        await w.clock.advance(3 * MIN);
        await turnEnd($);
    }
    expect([parkedWakes(w).length, unreadLines(w)]).toEqual([
        1,
        [
            'x-mod-stash: lane l1 reads no live session for codie «🔧 gone | FRM-1»; counted as gone',
        ],
    ]);
});

test('a working codie beside an idle sixth sense wakes nobody', async ($, on) => {
    const card = laneCard({
        linkedIds: { codie: CODIE_SID, 'sixth-sense': SIXTH_SID },
        members: { codie: codiePeer.name, 'sixth-sense': replaySixth.name },
    });
    const w = alarmWorld(on, {
        also: [replaySixth],
        files: { [LANES]: JSON.stringify({ lanes: [card] }) },
        lastWrite: () => EVEN - 30 * MIN,
        peer: { ...codiePeer, status: 'busy' },
    });
    w.store.set('quiet-wait', 60);
    await start($);
    await w.clock.advance(15 * MIN);
    expect(parkedWakes(w)).toEqual([]);
});

test('a codie and a sixth sense both idle past 10 min wake once, again only after a word', async ($, on) => {
    const spoke = { at: EVEN };
    const card = laneCard({
        linkedIds: { codie: CODIE_SID, 'sixth-sense': SIXTH_SID },
        members: { codie: codiePeer.name, 'sixth-sense': replaySixth.name },
    });
    const w = alarmWorld(on, {
        also: [replaySixth],
        files: { [LANES]: JSON.stringify({ lanes: [card] }) },
        lastWrite: () => spoke.at,
    });
    w.store.set('quiet-wait', 60);
    await start($);
    await w.clock.advance(9 * MIN);
    const early = parkedWakes(w).length;
    for (let tick = 0; tick < 4; tick++) {
        await w.clock.advance(3 * MIN);
        await turnEnd($);
    }
    const quiet = parkedWakes(w).length;
    spoke.at = EVEN + 22 * MIN;
    await w.clock.advance(12 * MIN);
    expect([early, quiet, parkedWakes(w).length]).toEqual([0, 1, 2]);
});

const HERDR_SETTINGS = '/home/.claude/shelf/herdr-settings/settings.json';

const herdrRows = (rows: Record<string, unknown>) =>
    JSON.stringify({ rows, v: 1 });

// herdr's «lane idle alarm after» row: the wakes counted at minutes 4, 6, 11, 24 and 26 of a silence
async function parkedAfter($: Engine, on: On, settings?: string) {
    const w = silentWorld(on, {
        files: settings === undefined ? {} : { [HERDR_SETTINGS]: settings },
        wait: 60,
    });
    await start($);
    const seen: number[] = [];
    let at = 0;
    for (const minute of [4, 6, 11, 24, 26]) {
        await w.clock.advance((minute - at) * MIN);
        at = minute;
        await turnEnd($);
        seen.push(parkedWakes(w).length);
    }
    return seen;
}

test("herdr's lane idle row at 5 min wakes the lane at 5", async ($, on) => {
    expect(
        await parkedAfter($, on, herdrRows({ 'stash.park.after': 5 })),
    ).toEqual([0, 1, 1, 1, 1]);
});

test("herdr's lane idle row at 25 min holds the wake past 10", async ($, on) => {
    expect(
        await parkedAfter($, on, herdrRows({ 'stash.park.after': 25 })),
    ).toEqual([0, 0, 0, 0, 1]);
});

test('an unreadable herdr settings file keeps the 10 min line', async ($, on) => {
    expect(await parkedAfter($, on, '{ not json')).toEqual([0, 0, 1, 1, 1]);
});

test('no herdr settings file keeps the 10 min line', async ($, on) => {
    expect(await parkedAfter($, on)).toEqual([0, 0, 1, 1, 1]);
});

test('an empty or broken lane idle row keeps the 10 min line', () => {
    expect(
        ['', ' ', 'soon', -3, 0, null, undefined, '0x10', '15'].map(
            (row) => parkedWakeMs(row) / MIN,
        ),
    ).toEqual([10, 10, 10, 10, 10, 10, 10, 10, 15]);
});

test('a lane idle row edited mid-silence counts at the next poll', async ($, on) => {
    const files: Record<string, string> = {};
    const w = silentWorld(on, { files, wait: 60 });
    await start($);
    await w.clock.advance(6 * MIN);
    await turnEnd($);
    const before = parkedWakes(w).length;
    files[HERDR_SETTINGS] = herdrRows({ 'stash.park.after': 5 });
    await w.clock.advance(1 * MIN);
    expect([before, parkedWakes(w).length]).toEqual([0, 1]);
});

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

const LANE_KEY = `lane-rounds:${LANE}`;

const PLAN_DIR = '/home/.local/state/x/lanes/mods-lane-5';

const ROUND_SENSE = '⚡ 🔎 sixth sense: mods lane 5';

const roundLines = (r: { context?: string[] }) =>
    (r.context ?? []).filter((c) => /\bround \d/.test(c));

// a plan file's mtime is the parse cache's key: each world its own
let planAt = 1;

// a codie on lane 5: a whole-file write lands as the shell's mv would; `plan` is the lane plan's steps as x prints them
function roundWorld(
    on: On,
    {
        files = {} as Record<string, string>,
        greenlit,
        isMvRefused = false,
        name = ROUND_CODIE,
        plan,
        record = {} as Record<string, unknown>,
        refusal,
        role = 'codie',
        sent,
        threads = [],
        unreadable = [],
    }: {
        files?: Record<string, string>;
        // the steps above the plan's «## not greenlit» heading, the rest held by x; all of them when unset
        greenlit?: number;
        // a write the shell's mv refuses
        isMvRefused?: boolean;
        unreadable?: string[];
        name?: string;
        plan?: { done: boolean; ticket?: string; text: string }[];
        record?: Record<string, unknown>;
        // why a mod's own send to a session does not go
        refusal?: string;
        role?: string;
        sent?: Record<string, unknown>;
        // more of x's records, beside this codie's and clio's
        threads?: Record<string, unknown>[];
    } = {},
) {
    const base = JSON.parse(thread(role, record)[THREADS_FILE] ?? '{}') as {
        threads: unknown[];
    };
    const all: Record<string, string> = {
        [THREADS_FILE]: JSON.stringify({
            ...base,
            threads: [...base.threads, ...threads],
        }),
        ...files,
    };
    // x's answer to plan-steps, which a test may change: undefined is x failing; each change is a new mtime
    const planNow = {
        steps: plan?.map((s, i) =>
            greenlit !== undefined && i >= greenlit ? { ...s, held: true } : s,
        ),
    };
    const listed: Record<string, { mtimeMs: number; name: string }[]> = plan
        ? { [PLAN_DIR]: [{ mtimeMs: planAt++, name: 'lane-plan.md' }] }
        : {};
    const setPlan = (steps: typeof plan) => {
        planNow.steps = steps;
        listed[PLAN_DIR] = [{ mtimeMs: planAt++, name: 'lane-plan.md' }];
    };
    const w = world(on, {
        files: all,
        listed,
        name,
        peers: [CLIO],
        run: (argv) => {
            if (argv[0] === 'mv') {
                const [, , from, to] = argv;
                if (isMvRefused || from === undefined || to === undefined)
                    return 1;
                all[to] = all[from] ?? '';
                delete all[from];
                return 0;
            }
            if (argv[0] === 'x' && argv[2] === 'plan-steps')
                return planNow.steps
                    ? JSON.stringify({ data: { steps: planNow.steps } })
                    : 1;
            return undefined;
        },
        unreadable,
        ...(sent ? { sent } : {}),
    });
    on('fs.exists', (_$, e) => ({ value: e.path in all }));
    const told: { text: string; to: unknown }[] = [];
    on('session.send', (_$, e) => {
        if (refusal) return { isDelivered: false, reason: refusal };
        told.push({ text: e.text, to: e.to });
        return { isDelivered: true };
    });
    return { ...w, files: all, setPlan, told };
}

test('a round message counts in the shelf file under its lane and ticket', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await send($, ROUND_SENSE, 'round 1 on abc12345 — pushed');
    await send($, ROUND_SENSE, 'round 2 on def67890');
    expect(kept(w)).toEqual({
        count: 2,
        shas: ['abc12345', 'def67890'],
    });
    expect(Object.keys(roundsIn(w.files))).toEqual([LANE]);
});

test('a resend of one round counts once, its sha long or short', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await send($, ROUND_SENSE, 'round 1 on abc12345');
    await send($, ROUND_SENSE, 'round 1 on abc12345');
    await send($, ROUND_SENSE, 'round 1 on abc1234567890');
    expect(kept(w)).toEqual({ count: 1, shas: ['abc12345'] });
});

for (const message of [
    'BYT-116 round 4 on e4fa48a. Fixed: the replace',
    'coder: round 2 on 78c130b9 — all 7 addressed',
    'final — round 3 on 6381739f, the pr',
    'round 1 on **fc54774**, branch codie/x',
    'sixth sense, round 2 on 7c90198',
    'sixth sense, final round 2 on 7c90198',
    'FRM-504: round 2 on 7c90198',
    'BYT-1 #127 round 2 on 7c90198',
    'BYT-1 slice 01 round 2 on 7c90198',
    'round 4, final, on 7c90198',
    'round 2 pushed: 7c90198 holds the fix',
])
    test(`a real lead counts: ${message}`, async ($, on) => {
        const w = roundWorld(on);
        await start($);
        await send($, ROUND_SENSE, message);
        expect(
            Object.values(roundsIn(w.files)).flatMap(
                (r) => (r as { shas: string[] }).shas,
            ).length,
        ).toBe(1);
    });

for (const message of [
    'your round 2 on abc12345 still stands',
    'final: base 7c90198, head 6381739f',
    'final word, your round 2 on 7c90198 stands',
    'BYT-105: clean — «round 4 on dbc4c111 — verdict: clean»',
    'parked: nothing new since the review',
    'round 2 needs a look, nothing pushed yet',
    'round 2 defaced the old row',
])
    test(`no round in this line: ${message}`, async ($, on) => {
        const w = roundWorld(on);
        await start($);
        const r = await send($, ROUND_SENSE, message);
        expect([kept(w), roundLines(r)]).toEqual([undefined, []]);
    });

for (const [name, sender, to] of [
    ["sixth sense's own verdict", ROUND_SENSE, ROUND_CODIE],
    ['a session outside a lane', '🦉 clio', ROUND_SENSE],
    [
        'a thread that only names codie past its colon',
        '🔎 helper: codie round',
        ROUND_SENSE,
    ],
    ['a report to the coordinator', ROUND_CODIE, '🦉 clio'],
] as const)
    test(`not counted: ${name}`, async ($, on) => {
        const w = roundWorld(on, {
            name: sender,
            role:
                sender === ROUND_CODIE
                    ? 'codie'
                    : sender === ROUND_SENSE
                      ? 'sixth-sense'
                      : 'none',
        });
        await start($);
        await send($, to, 'round 1 on abc12345');
        expect([w.files[ROUNDS_FILE], w.told]).toEqual([undefined, []]);
    });

test('a send that went nowhere is no round', async ($, on) => {
    const w = roundWorld(on, {
        sent: { message: 'no such session', success: false },
    });
    await start($);
    await send($, ROUND_SENSE, 'round 1 on abc12345');
    expect(w.files[ROUNDS_FILE]).toBeUndefined();
});

test('no round is written to the private store', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await send($, ROUND_SENSE, 'round 1 on abc12345');
    expect([
        [...w.store.keys()].filter((k) => k.startsWith('lane-rounds:')),
        kept(w),
    ]).toEqual([[], { count: 1, shas: ['abc12345'] }]);
});

const sendRounds = async ($: Engine, n: number) => {
    const out = [];
    for (let i = 0; i < n; i++)
        out.push(
            await send(
                $,
                ROUND_SENSE,
                `round ${i + 1} on abcdef${i} · P0/P1: 1`,
            ),
        );
    return out;
};

const PLAN_NEXT = [
    { done: true, text: 'the round store', ticket: 'FRM-9' },
    { done: true, text: 'reviewed and closed', ticket: 'FRM-9' },
    { done: false, text: 'the next chunk', ticket: 'FRM-10' },
];

// FRM-649: the count keys on the lane record's ticket, as the card does: each chunk opens with clio's dispatch, which
// moves the record; a plan's first open step can be an old chunk's leftover (a false «round 9» on FRM-605)
test('a next chunk the dispatch moved the record to starts its own count at 1, with no cap line', async ($, on) => {
    const w = roundWorld(on, {
        files: {
            [ROUNDS_FILE]: JSON.stringify({
                rounds: {
                    [LANE]: { count: 4, shas: ['a1', 'b2', 'c3', 'd4'] },
                },
                v: 1,
            }),
        },
        record: { ticket: 'FRM-10' },
    });
    await start($);
    const r = await send($, ROUND_SENSE, 'round 1 on ccccccc');
    expect([
        kept(w, 'mods-lane-5 | FRM-10'),
        kept(w),
        roundLines(r),
        w.told,
    ]).toEqual([
        { count: 1, shas: ['ccccccc'] },
        { count: 4, shas: ['a1', 'b2', 'c3', 'd4'] },
        [],
        [],
    ]);
});

test("a stale open step in the lane plan never keys the count, the record's ticket does", async ($, on) => {
    const w = roundWorld(on, {
        plan: [
            { done: false, text: 'an old chunk left open', ticket: 'FRM-605' },
            ...PLAN_NEXT,
        ],
        record: { ticket: 'FRM-10' },
    });
    await start($);
    await send($, ROUND_SENSE, 'round 1 on ccccccc');
    expect(Object.keys(roundsIn(w.files))).toEqual(['mods-lane-5 | FRM-10']);
});

test('a record with no ticket counts nothing and asks a resend', async ($, on) => {
    const w = roundWorld(on, { record: { ticket: undefined } });
    await start($);
    const r = await send($, ROUND_SENSE, 'round 1 on ccccccc');
    expect([w.files[ROUNDS_FILE], roundLines(r), w.told]).toEqual([
        undefined,
        [
            "round 1 on ccccccc not counted (x's record names no ticket): resend the same line once clio's dispatch writes one",
        ],
        [],
    ]);
});

test("with no lane plan the count keys on x's record's ticket", async ($, on) => {
    const w = roundWorld(on, { record: { ticket: 'FRM-10' } });
    await start($);
    await send($, ROUND_SENSE, 'round 1 on ccccccc');
    expect(kept(w, 'mods-lane-5 | FRM-10')).toEqual({
        count: 1,
        shas: ['ccccccc'],
    });
});

// the cap is per chunk: herdr lane 2's codie named «FRM-638 slice 5» after the sha while x's record held FRM-625, and its
// slices 4 and 5 counted as one, escalating a «round 4» its chunk never reached
test('two chunks a round line names count apart, the record trailing both, and the cap line names the chunk', async ($, on) => {
    const w = roundWorld(on, { record: { ticket: 'FRM-625' } });
    await start($);
    for (const [n, sha] of [
        [1, 'a1a1a1a'],
        [2, 'b2b2b2b'],
    ] as const)
        await send(
            $,
            ROUND_SENSE,
            `round ${n} on ${sha} (slice 4, base main:1234567)`,
        );
    const r = [];
    for (const [n, sha] of [
        [1, 'c3c3c3c'],
        [2, 'd4d4d4d'],
        [3, 'e5e5e5e'],
    ] as const)
        r.push(
            await send(
                $,
                ROUND_SENSE,
                `round ${n} on ${sha} (FRM-638 slice 05, base main:1234567) · P0/P1: 1`,
            ),
        );
    expect([
        Object.keys(roundsIn(w.files)),
        kept(w, 'mods-lane-5 | FRM-638 slice 5'),
        r.flatMap(roundLines),
        w.told,
    ]).toEqual([
        ['mods-lane-5 | FRM-625 slice 4', 'mods-lane-5 | FRM-638 slice 5'],
        { count: 3, shas: ['c3c3c3c', 'd4d4d4d', 'e5e5e5e'] },
        [
            'round 3 with a P0 or P1 in this chunk: a next one is past the cap of 3',
        ],
        [],
    ]);
    await send(
        $,
        ROUND_SENSE,
        'round 4 on f6f6f6f (FRM-638 slice 5) · P0/P1: 1',
    );
    expect(w.told.map((t) => t.text)).toEqual([
        `[escalate] round 4 of mods-lane-5 | FRM-638 slice 5, past the cap of 3, from ${ROUND_CODIE}: ask dima «go on, or stop the lane»`,
    ]);
});

test('a lone slice joins the key a fuller line gave it, and a ticket the line only mentions keys nothing', async ($, on) => {
    const w = roundWorld(on, { record: { ticket: 'FRM-625' } });
    await start($);
    await send(
        $,
        ROUND_SENSE,
        'round 1 on a1a1a1a (FRM-638 slice 5, base main:1234567)',
    );
    await send($, ROUND_SENSE, 'round 2 on b2b2b2b (slice 5)');
    await send(
        $,
        ROUND_SENSE,
        'round 1 on c3c3c3c, fixes the FRM-617 regression',
    );
    expect(roundsIn(w.files)).toEqual({
        'mods-lane-5 | FRM-625': { count: 1, shas: ['c3c3c3c'] },
        'mods-lane-5 | FRM-638 slice 5': {
            count: 2,
            shas: ['a1a1a1a', 'b2b2b2b'],
        },
    });
});

// FRM-656 exit 2: 18 Nov's herdr lane read «round 6» over three chunks each clean at round 1
test('three chunks each clean at round 1 keep three keys at count 1 and tell no one', async ($, on) => {
    const w = roundWorld(on, { record: { ticket: 'FRM-648' } });
    await start($);
    const r = [];
    for (const line of [
        'round 1 on 1dc7e6cb (FRM-638 slice 6b) · P0/P1: 0',
        'round 1 on adb1fbef (FRM-638 slice 12c) · P0/P1: 0',
        'round 1 on b89b8bea',
    ])
        r.push(await send($, ROUND_SENSE, line));
    expect([
        Object.values(roundsIn(w.files)).map(
            (k) => (k as { count: number }).count,
        ),
        r.flatMap(roundLines).filter((l) => l.includes('cap')),
        w.told,
    ]).toEqual([[1, 1, 1], [], []]);
});

// FRM-656 exit 5: the five round lines the herdr codie sent its sixth sense on 18 Nov (transcript 52af0793), as sent
const HERDR_18_NOV = [
    'round 4 on 721588be (FRM-638 slice 5, scoped): the each-path-once row, attachments.test.ts',
    'round 2 on 1dc7e6cb (FRM-638 slice 6b), main:9d387640 base, on origin/main.',
    'round 3 on 35a13429 (FRM-638 end step, slices.md 12 + FRM-633), base d4ccf50d.',
    "round 4 on adb1fbef (FRM-648) · P0/P1: 0 open — slice 12b, base 3f2f4bc5, dima's 21:42 tick + vote via clio.",
    'round 2 on b89b8bea (FRM-638 slice 12c) · P0/P1: 0',
];

test("18 Nov's herdr round lines count per chunk: no round 6, only slice 5's unknown round 4 warns", async ($, on) => {
    const w = roundWorld(on, { record: { ticket: 'FRM-648' } });
    await start($);
    const r = [];
    for (const line of HERDR_18_NOV) r.push(await send($, ROUND_SENSE, line));
    expect([
        Object.fromEntries(
            Object.entries(roundsIn(w.files)).map(([k, v]) => [
                k,
                (v as { count: number }).count,
            ]),
        ),
        r.flatMap(roundLines),
        w.told.map((t) => t.text),
    ]).toEqual([
        {
            'mods-lane-5 | FRM-638 slice 12c': 2,
            'mods-lane-5 | FRM-638 slice 5': 4,
            'mods-lane-5 | FRM-638 slice 6b': 2,
            'mods-lane-5 | FRM-648': 3,
            'mods-lane-5 | FRM-648 slice 12b': 4,
        },
        [
            'round 4 in this chunk not known clean (3 with a P0 or P1, 1 unknown: no «P0/P1: n» in the line), past the cap of 3: the coordinator has the count and says go on or stop; nothing is refused, keep working',
            'round 3 in this chunk not known clean (2 with a P0 or P1, 1 unknown: no «P0/P1: n» in the line): a next one is past the cap of 3',
        ],
        [
            `[escalate] round 4 of mods-lane-5 | FRM-638 slice 5, past the cap of 3, from ${ROUND_CODIE} (1 unknown: their lines named no «P0/P1: n», ask for the count): ask dima «go on, or stop the lane»`,
        ],
    ]);
});

test('a round file that does not parse moves aside and the count starts over', async ($, on) => {
    const w = roundWorld(on, { files: { [ROUNDS_FILE]: '{"rounds": [torn' } });
    await start($);
    const r = await send($, ROUND_SENSE, 'round 1 on ccccccc');
    expect([w.files[`${ROUNDS_FILE}.bad`], kept(w), roundLines(r)]).toEqual([
        '{"rounds": [torn',
        { count: 1, shas: ['ccccccc'] },
        [],
    ]);
});

test('a round file that is there but will not read is never written over', async ($, on) => {
    const w = roundWorld(on, {
        files: { [ROUNDS_FILE]: 'kept' },
        unreadable: [ROUNDS_FILE],
    });
    await start($);
    const r = await send($, ROUND_SENSE, 'round 1 on ccccccc');
    expect([w.files[ROUNDS_FILE], roundLines(r)]).toEqual([
        'kept',
        [
            'round 1 on ccccccc not counted (the round file would not read): resend the same line to count it',
        ],
    ]);
});

test('a resend of a round past the cap says nothing and tells clio nothing again', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await sendRounds($, 4);
    const r = await send($, ROUND_SENSE, 'round 4 on abcdef3');
    expect([roundLines(r), w.told.length]).toEqual([[], 1]);
});

test('an entry missing its shas reads as none', async ($, on) => {
    const w = roundWorld(on, {
        files: {
            [ROUNDS_FILE]: JSON.stringify({
                rounds: { [LANE]: { count: 2 } },
                v: 1,
            }),
        },
    });
    await start($);
    await send($, ROUND_SENSE, 'round 3 on ccccccc');
    expect(kept(w)).toEqual({ count: 3, shas: ['ccccccc'] });
});

test('a round that could not be written tells the sender to resend it', async ($, on) => {
    const w = roundWorld(on, { isMvRefused: true });
    await start($);
    const r = await send($, ROUND_SENSE, 'round 1 on ccccccc');
    expect([w.files[ROUNDS_FILE], roundLines(r), r.result.success]).toEqual([
        undefined,
        [
            'round 1 on ccccccc not counted (mv failed): resend the same line to count it',
        ],
        true,
    ]);
});

// the cap counts rounds with a P0 or P1 (crew-dna § the loop): a line naming «P0/P1: 0» is a clean round, a line naming
// none is unknown, counted toward the cap; four rounds with one P1 among them reach no cap
const fourRounds = async ($: Engine, severe: string[]) => {
    const out = [];
    for (const [i, p] of severe.entries())
        out.push(
            await send(
                $,
                ROUND_SENSE,
                `round ${i + 1} on abcdef${i} (FRM-9 slice 5, ${p})`,
            ),
        );
    return out;
};

test('four rounds with one P1 among them reach no cap and tell no one', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    const r = await fourRounds($, [
        'P0/P1: 0',
        'p0/p1: 0',
        'p0/p1: 0',
        'P0/P1: 1',
    ]);
    expect([r.flatMap(roundLines), w.told]).toEqual([[], []]);
});

test('four rounds each with a P1, the last one naming none, escalate at the fourth, and a clean fifth tells no one', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    const r = await fourRounds($, [
        'P0/P1: 1',
        'P0/P1: 2',
        'P0/P1: 1',
        'base main:1234567',
    ]);
    r.push(
        await send(
            $,
            ROUND_SENSE,
            'round 5 on abcdef5 (FRM-9 slice 5, P0/P1: 0)',
        ),
    );
    expect([
        r.map((x) => roundLines(x).length),
        w.told.map((t) => t.text),
    ]).toEqual([
        [0, 0, 1, 1, 0],
        [
            `[escalate] round 4 of mods-lane-5 | FRM-9 slice 5, past the cap of 3, from ${ROUND_CODIE} (1 unknown: their lines named no «P0/P1: n», ask for the count): ask dima «go on, or stop the lane»`,
        ],
    ]);
});

// FRM-656 exit 3: a round naming no «P0/P1: n» counts, and the sender hears it called unknown
test('a round line naming no P0/P1 reaches the cap called unknown, never one with a P0 or P1', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await send($, ROUND_SENSE, 'round 1 on abcdef7');
    await send($, ROUND_SENSE, 'round 2 on abcdef8');
    const line = roundLines(
        await send($, ROUND_SENSE, 'round 3 on abcdef9'),
    ).join('');
    expect([
        line.includes('3 unknown'),
        line.includes('with a P0 or P1'),
        roundsRaw(w.files)[LANE]?.unknown,
    ]).toEqual([true, false, 3]);
});

// FRM-570 exit 15: the count reads x's record, so a rename keeps it and a name alone starts none
for (const name of ['⚡ 🔧 mods 6 | FRM-574', 'mods six'])
    test(`a codie named «${name}» counts its rounds by its record`, async ($, on) => {
        const w = roundWorld(on, { name });
        await start($);
        await send($, ROUND_SENSE, 'round 1 on abc12345');
        expect(kept(w)).toEqual({ count: 1, shas: ['abc12345'] });
    });

test('a codie name with no thread record counts no round', async ($, on) => {
    const w = roundWorld(on, { role: 'none' });
    await start($);
    await send($, ROUND_SENSE, 'round 1 on abc12345');
    expect(w.files[ROUNDS_FILE]).toBeUndefined();
});

test('a count follows the number sent, a lane opening past round 1', async ($, on) => {
    roundWorld(on);
    await start($);
    const lines: string[] = [];
    for (const [n, sha] of [
        [2, 'aaaaaaa'],
        [3, 'bbbbbbb'],
        [4, 'ccccccc'],
    ] as const)
        lines.push(
            roundLines(await send($, ROUND_SENSE, `round ${n} on ${sha}`)).join(
                '',
            ),
        );
    expect(lines[0]).toBe('');
    expect(lines[1]).toContain('past the cap');
    expect(lines[2]).toContain('the coordinator has the count');
});

test('a final leading a numbered round counts that round', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await send($, ROUND_SENSE, 'final FRM-9 round 3 on abc1234');
    expect((kept(w) as { count: number }).count).toBe(3);
});

test('a final with no number counts as round 1', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await send($, ROUND_SENSE, 'final on 6381739f, the pr');
    await send($, ROUND_SENSE, 'round 2 on 7c90198');
    expect(kept(w)).toEqual({
        count: 2,
        shas: ['6381739f', '7c90198'],
    });
});

test('a final with no sha in it is no round', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await send($, ROUND_SENSE, 'final word: defaced is not a sha');
    expect(kept(w)).toBeUndefined();
});

// clio's call 9: the old private keys are read at the land, only the shelf file is written
for (const [shape, old] of [
    ['the first build', ['aaaaaaa', 'bbbbbbb']],
    ['the second build', { count: 2, shas: ['aaaaaaa', 'bbbbbbb'] }],
] as const)
    test(`a key ${shape} kept privately seeds the shelf count`, async ($, on) => {
        const w = roundWorld(on);
        w.store.set(LANE_KEY, old);
        await start($);
        await send($, ROUND_SENSE, 'round 3 on ccccccc');
        expect([kept(w), w.store.get(LANE_KEY)]).toEqual([
            { count: 3, shas: ['aaaaaaa', 'bbbbbbb', 'ccccccc'] },
            old,
        ]);
    });

test('the shelf file outranks a private key of the same lane', async ($, on) => {
    const w = roundWorld(on, {
        files: {
            [ROUNDS_FILE]: JSON.stringify({
                rounds: { [LANE]: { count: 1, shas: ['aaaaaaa'] } },
                v: 1,
            }),
        },
    });
    w.store.set(LANE_KEY, { count: 5, shas: ['x1', 'x2', 'x3', 'x4', 'x5'] });
    await start($);
    await send($, ROUND_SENSE, 'round 2 on bbbbbbb');
    expect(kept(w)).toEqual({ count: 2, shas: ['aaaaaaa', 'bbbbbbb'] });
});

test("another lane's rounds in the file stay as they were", async ($, on) => {
    const other = { count: 2, shas: ['e1', 'e2'] };
    const w = roundWorld(on, {
        files: {
            [ROUNDS_FILE]: JSON.stringify({
                rounds: { 'herdr-lane-2 | FRM-1': other },
                v: 1,
            }),
        },
    });
    await start($);
    await send($, ROUND_SENSE, 'round 1 on abc12345');
    expect(roundsIn(w.files)).toEqual({
        [LANE]: { count: 1, shas: ['abc12345'] },
        'herdr-lane-2 | FRM-1': other,
    });
});

test('below the cap the sender hears no round line', async ($, on) => {
    roundWorld(on);
    await start($);
    const sent = await sendRounds($, 2);
    expect(sent.flatMap(roundLines)).toEqual([]);
});

test('at the cap the sender hears that a next round is past it, and clio hears nothing', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    const sent = await sendRounds($, 3);
    expect([roundLines(sent[2] ?? {}).join(''), w.told]).toEqual([
        expect.stringContaining(
            'with a P0 or P1 in this chunk: a next one is past the cap',
        ),
        [],
    ]);
});

test('round 4 tells the coordinator the lane and the count, once, and warns the sender', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    const sent = await sendRounds($, 4);
    await send($, ROUND_SENSE, 'round 4 on abcdef3');
    expect([w.told, roundLines(sent[3] ?? {})]).toEqual([
        [
            {
                text: `[escalate] round 4 of ${LANE}, past the cap of 3, from ${ROUND_CODIE}: ask dima «go on, or stop the lane»`,
                to: CLIO.sessionId,
            },
        ],
        [
            'round 4 with a P0 or P1 in this chunk, past the cap of 3: the coordinator has the count and says go on or stop; nothing is refused, keep working',
        ],
    ]);
});

// a wing that runs the lane by its glide card hears the line, not main clio
const WING = {
    hostSessionId: 'local_wing',
    name: '🦉🪽 clio: wing 2',
    pid: 71,
    sessionId: 'wing-sid',
};

const wingLane = (over: Record<string, unknown> = {}) => ({
    '/home/.claude/shelf/lanes.json': JSON.stringify({
        lanes: [
            {
                current: 0,
                history: [],
                id: 'l1',
                items: [{ done: false, text: 'the round store' }],
                members: { codie: SID },
                movedAt: 0,
                runner: WING.name,
                title: 'mods lane 5',
                ...over,
            },
        ],
    }),
});

for (const [why, lanes, peer, to] of [
    ['a live wing runs its card', wingLane(), true, WING.sessionId],
    [
        'a later card of a gone wing links it too',
        {
            '/home/.claude/shelf/lanes.json': JSON.stringify({
                lanes: [
                    ...JSON.parse(wingLane()['/home/.claude/shelf/lanes.json'])
                        .lanes,
                    ...JSON.parse(
                        wingLane({ id: 'l2', runner: '🦉🪽 clio: wing 9' })[
                            '/home/.claude/shelf/lanes.json'
                        ],
                    ).lanes,
                ],
            }),
        },
        true,
        WING.sessionId,
    ],
    ['the card is ended', wingLane({ endedAt: 1 }), true, CLIO.sessionId],
    ["the card's wing is gone", wingLane(), false, CLIO.sessionId],
    [
        'the card links another codie',
        wingLane({ members: { codie: 'other-sid' } }),
        true,
        CLIO.sessionId,
    ],
    // a real card keeps its codie by registry name (sixth sense, FRM-504 exit 2)
    [
        'the card names its codie as the registry does',
        wingLane({ members: { codie: ROUND_CODIE } }),
        true,
        WING.sessionId,
    ],
    [
        'the card names its codie by a name it has since left, linked by id',
        wingLane({
            linkedIds: { codie: SID },
            members: { codie: '⚡ 🔧 codie: mods lane 5 | FRM-1' },
        }),
        true,
        WING.sessionId,
    ],
    [
        'the card names another codie, linked by another id',
        wingLane({
            linkedIds: { codie: 'other-sid' },
            members: { codie: '⚡ 🔧 codie: herdr | FRM-2' },
        }),
        true,
        CLIO.sessionId,
    ],
    // a resume under a new id leaves the linked one behind: the name still finds the card
    [
        'the card names its codie as the registry does, linked by an id it left',
        wingLane({
            linkedIds: { codie: 'left-sid' },
            members: { codie: ROUND_CODIE },
        }),
        true,
        WING.sessionId,
    ],
] as const)
    test(`past the cap the line goes to ${to === WING.sessionId ? 'the wing' : 'main clio'}: ${why}`, async ($, on) => {
        const w = roundWorld(on, {
            files: {
                ...lanes,
                ...(peer
                    ? {
                          [`/home/.claude/sessions/${WING.pid}.json`]:
                              JSON.stringify(WING),
                      }
                    : {}),
            },
            threads: peer
                ? [
                      {
                          pid: WING.pid,
                          sessionId: WING.sessionId,
                          ...recordOf(WING.name),
                      },
                  ]
                : [],
        });
        await start($);
        await sendRounds($, 4);
        expect(w.told.map((t) => t.to)).toEqual([to]);
    });

test('each round past the cap tells the coordinator again', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await sendRounds($, 5);
    expect(w.told.map((t) => t.text.match(/round (\d)/)?.[1])).toEqual([
        '4',
        '5',
    ]);
});

test('a round past the cap is still delivered', async ($, on) => {
    roundWorld(on);
    await start($);
    const sent = await sendRounds($, 4);
    expect(sent[3]?.result.success).toBe(true);
});

test('a coordinator line that cannot go says so in the sender’s turn', async ($, on) => {
    const w = roundWorld(on, { refusal: 'not reachable' });
    await start($);
    const sent = await sendRounds($, 4);
    expect([
        roundLines(sent[3] ?? {}).join(''),
        sent[3]?.result.success,
    ]).toEqual([
        expect.stringContaining(
            'the line to the coordinator did not go (not reachable)',
        ),
        true,
    ]);
    expect(w.told).toEqual([]);
});

test('the past-the-cap line still fires across a compact and a reload, read from the shelf file', async ($, on) => {
    on('session.compact', (_$, e) => ({ messages: e.messages }));
    const w = roundWorld(on);
    await start($);
    await sendRounds($, 3);
    await $.session.compact({
        messages: [{ role: 'user', text: 'hi', toolUses: [] }],
        trigger: 'auto',
    } as never);
    w.store.clear();
    const r = await send($, ROUND_SENSE, 'round 4 on ddddddd');
    expect([roundLines(r).join(''), w.told.length]).toEqual([
        expect.stringContaining('the coordinator has the count'),
        1,
    ]);
});

test('🎛️ rounds switched off: no count, no coordinator line', async ($, on) => {
    const w = roundWorld(on, { plan: PLAN_NEXT });
    w.store.set('shown', { 'stash.rounds': false });
    await start($);
    for (let i = 0; i < 4; i++)
        await send($, ROUND_SENSE, `round ${i + 1} on abcdef${i}`);
    expect([w.files[ROUNDS_FILE], w.told]).toEqual([undefined, []]);
});
