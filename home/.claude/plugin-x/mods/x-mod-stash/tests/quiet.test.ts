import type { On } from 'claude-code';
import { type Engine, expect, test } from 'claude-code/testing';

import { parkedWakeMs } from '../hooks/parked-wake.ts';
import { clioAddress, peerPing } from '../hooks/quiet.ts';
import { laneMemberRow } from '../hooks/roster.ts';
import {
    CODIE_SID,
    EVEN,
    EVENT,
    FORGED,
    IDLE,
    LANES,
    LINKED,
    MEMBER,
    MIN,
    NOTE,
    POLL,
    alarmWorld,
    codiePeer,
    fromAppText,
    gluedPrompt,
    held,
    laneCard,
    linesFor,
    logOf,
    message,
    ping,
    say,
    silentWorld,
    start,
    steps,
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
