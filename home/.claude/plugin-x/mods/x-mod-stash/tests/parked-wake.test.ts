import type { On } from 'claude-code';

import { parkedWakeMs } from '../hooks/parked-wake.ts';
import { laneMemberRow } from '../hooks/roster.ts';
import {
    DISPATCH,
    WORKING,
    codie,
    parked,
    parkedWorld,
    pass,
    sixth,
} from './parked-world.ts';
import {
    CODIE_SID,
    EVEN,
    LANES,
    MIN,
    POLL,
    alarmWorld,
    codiePeer,
    laneCard,
    silentWorld,
    start,
    steps,
    world,
} from './quiet-helpers.ts';
import { type Engine, expect, test } from './shared-boot.ts';

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

test('a parked lane with nothing queued past its chunk wakes once: nothing queued, sign the next', async ($, on) => {
    const w = silentWorld(on, { card: steps('FRM-1', 'FRM-1'), wait: 60 });
    await idleLane($, w);
    expect(parkedWakes(w)).toEqual([
        expect.stringContaining(
            '«mods lane» (l1): 2 steps left in FRM-1, nothing queued, sign the next',
        ),
    ]);
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

/* FRM-692: the members are read one by one */

const ONE_LEFT = steps('FRM-1', 'FRM-2');
const SIGNED = { labels: ['signed'] };
const DISPATCHED = { description: DISPATCH, labels: ['agent'] };
const builder = (text: string) => expect.stringContaining(text);

/* exit 1: the next chunk */

test('a parked lane whose next chunk is signed and not dispatched wakes its runner, naming both', async ($, on) => {
    const w = parkedWorld(on, [sixth()], {
        card: steps('FRM-1', 'FRM-1', 'FRM-2'),
        tickets: { 'FRM-2': SIGNED },
    });
    expect(await parked($, w, 2, 5)).toEqual([
        '«mods lane» (l1): 2 steps left in FRM-1; next chunk FRM-2 is signed, not dispatched.',
    ]);
});

test('a parked lane whose next chunk is dispatched wakes nobody while no builder sits idle', async ($, on) => {
    const w = parkedWorld(on, [sixth()], {
        card: ONE_LEFT,
        tickets: { 'FRM-2': DISPATCHED },
    });
    expect(await parked($, w, 2, 10)).toEqual([]);
});

test('a dispatch taken back reads as not dispatched', async ($, on) => {
    const w = parkedWorld(on, [sixth()], {
        card: ONE_LEFT,
        tickets: {
            'FRM-2': {
                ...SIGNED,
                description: `${DISPATCH}\n↩️ back to Todo 2026-11-23`,
            },
        },
    });
    expect(await parked($, w, 2)).toEqual([builder('signed, not dispatched')]);
});

test('a sample sign block above the real one is not read', async ($, on) => {
    const w = parkedWorld(on, [sixth()], {
        card: ONE_LEFT,
        tickets: {
            'FRM-2': {
                description: `## signed\nthe sample\n\n${DISPATCH}\n## signed-label notes\nafter it`,
                labels: [],
            },
        },
    });
    expect(await parked($, w, 2, 5)).toEqual([]);
});

test('a quick ticket has no sign block, its dispatch closes the body', async ($, on) => {
    const w = parkedWorld(on, [sixth()], {
        card: ONE_LEFT,
        tickets: {
            'FRM-2': {
                description:
                    '## why\n\nit hurts\n\n🚀 dispatched 2026-11-24 — chores, codie y',
                labels: [],
            },
        },
    });
    expect(await parked($, w, 2, 5)).toEqual([]);
});

test('a dispatch quoted outside the sign block is no dispatch', async ($, on) => {
    const w = parkedWorld(on, [sixth()], {
        card: ONE_LEFT,
        tickets: {
            'FRM-2': {
                ...SIGNED,
                description: `the shape:\n🚀 dispatched 2026-11-23 — x, codie y\n\n## signed\n\n✍️ signed\n\n## after\n🚀 dispatched 2026`,
            },
        },
    });
    expect(await parked($, w, 2)).toEqual([builder('signed, not dispatched')]);
});

test('a dispatched next chunk still wakes the runner on a builder idle with one step left', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: { ...ONE_LEFT, current: 1 },
        tickets: { 'FRM-2': DISPATCHED },
    });
    expect(await parked($, w, 2, 5)).toEqual([
        builder('🔧 mods | FRM-1 idle 10 min with 1 step left'),
    ]);
});

test('two failed linear reads in a row wake once, saying linear could not be read; one failed read says nothing', async ($, on) => {
    const w = parkedWorld(on, [sixth()], { card: ONE_LEFT });
    expect([
        await parked($, w, 1),
        (await pass($, w, 1, 1, 1, 1), w.wakes()),
        w.logged.filter((l) => l.includes('linear read FRM-2')).length,
    ]).toEqual([
        [],
        [builder('next chunk FRM-2 could not be read from linear')],
        1,
    ]);
});

test('a read that fails once is tried at the next poll, and its answer is the one said', async ($, on) => {
    const w = parkedWorld(on, [sixth()], { card: ONE_LEFT });
    await parked($, w, 1);
    w.tickets['FRM-2'] = SIGNED;
    await pass($, w, 1);
    expect(w.wakes()).toEqual([builder('signed, not dispatched')]);
});

test('an unread next chunk that reads again wakes once more, and its next failed reads none', async ($, on) => {
    const w = parkedWorld(on, [sixth()], { card: ONE_LEFT });
    await parked($, w, 1, 1);
    w.tickets['FRM-2'] = SIGNED;
    await pass($, w, 1);
    delete w.tickets['FRM-2'];
    await pass($, w, 11, 1, 1);
    expect(w.wakes()).toEqual([
        builder('could not be read'),
        builder('signed, not dispatched'),
    ]);
});

test('two failed reads an hour apart are not two in a row', async ($, on) => {
    const w = parkedWorld(on, [sixth()], { card: ONE_LEFT });
    await parked($, w, 1);
    w.spoke(R, EVEN + 61 * MIN);
    await pass($, w, 60, 9, 1);
    const first = w.wakes();
    await pass($, w, 1);
    expect([first, w.wakes()]).toEqual([
        [],
        [builder('could not be read from linear')],
    ]);
});

test('a ticket read for one wake is read again for the next, however soon the row brings it', async ($, on) => {
    const w = parkedWorld(on, [sixth()], {
        card: ONE_LEFT,
        extraFiles: { [HERDR_SETTINGS]: herdrRows({ 'stash.park.after': 5 }) },
        tickets: { 'FRM-2': { labels: [] } },
    });
    await parked($, w, 2);
    w.spoke(R, EVEN + 2 * MIN);
    w.tickets['FRM-2'] = SIGNED;
    await pass($, w, 6);
    expect(w.wakes()).toEqual([
        builder('is unsigned'),
        builder('is signed, not dispatched'),
    ]);
});

test('an unsigned next chunk signed 10 min later with no word between wakes a second time', async ($, on) => {
    const w = parkedWorld(on, [sixth({ ago: 9 })], {
        card: ONE_LEFT,
        tickets: { 'FRM-2': { labels: [] } },
    });
    await parked($, w, 2);
    w.tickets['FRM-2'] = SIGNED;
    await pass($, w, 10, 1);
    expect(w.wakes().map((t) => t.match(/FRM-2 (is [^.;]+)/)?.[1])).toEqual([
        'is unsigned',
        'is signed, not dispatched',
    ]);
});

test('a chunk dispatched after its wake is read before the next word is answered', async ($, on) => {
    const w = parkedWorld(on, [sixth()], {
        card: ONE_LEFT,
        store: { 'quiet-wait': 60 },
        tickets: { 'FRM-2': SIGNED },
    });
    await parked($, w, 2);
    w.tickets['FRM-2'] = DISPATCHED;
    w.spoke(R, EVEN + 2 * MIN);
    await pass($, w, 11);
    expect(w.wakes().length).toBe(1);
});

const C = codie().sid;
const R = sixth().sid;

const said = (sid: string, wait: string, ago = 9) => ({
    [`reply:${sid}`]: { at: EVEN - ago * MIN, wait },
});

/* exit 2: a finished card */

const FINISHED = { current: 1 };
for (const [why, tickets] of [
    ['dispatched', { 'FRM-2': DISPATCHED }],
    ['undispatched', { 'FRM-2': SIGNED }],
    ['unreadable', {}],
] as const)
    test(`a finished card with an idle member wakes once, the next ticket ${why}`, async ($, on) => {
        const w = parkedWorld(on, [codie()], { card: FINISHED, tickets });
        expect(await parked($, w, 2, 5)).toEqual([
            '«mods lane» (l1) finished, nothing queued for ⚡ 🔧 mods | FRM-1, idle 10 min.',
        ]);
    });

test('a finished card wakes again only after a word of its member', async ($, on) => {
    const w = parkedWorld(on, [codie()], { card: FINISHED });
    const first = (await parked($, w, 2, 8)).length;
    w.spoke(C, EVEN + 10 * MIN);
    await pass($, w, 9);
    const early = w.wakes().length;
    await pass($, w, 2, 1, 1);
    expect([first, early, w.wakes().length]).toEqual([1, 1, 2]);
});

test('a finished card whose two members went idle apart wakes once', async ($, on) => {
    const w = parkedWorld(on, [codie(), sixth({ ago: 5 })], { card: FINISHED });
    expect((await parked($, w, 2, 4, 25)).length).toBe(1);
});

test('a finished card with one member idle and one at work wakes once, not at each word of the second', async ($, on) => {
    const w = parkedWorld(on, [codie(), sixth(WORKING)], { card: FINISHED });
    await parked($, w, 2);
    for (let i = 0; i < 3; i++) {
        w.spoke(R, w.clock.now());
        await pass($, w, 2);
    }
    expect(w.wakes().length).toBe(1);
});

test('every step ticked under a pointer left behind is a finished card', async ($, on) => {
    const { items } = steps('FRM-1', 'FRM-1');
    const w = parkedWorld(on, [codie()], {
        card: { items: items.map((x) => ({ ...x, isDone: true })) },
    });
    expect(await parked($, w, 2)).toEqual([builder('finished')]);
});

test('an ended card wakes nobody', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: { ...FINISHED, endedAt: EVEN },
    });
    expect(await parked($, w, 2, 30)).toEqual([]);
});

test('a finished card whose member is gone wakes nobody', async ($, on) => {
    const w = parkedWorld(on, [], {
        card: { ...FINISHED, members: { codie: 'gone' } },
    });
    expect(await parked($, w, 2, 10)).toEqual([]);
});

test('a member reused on an open card is not called idle on its finished one', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        also: {
            ...steps('FRM-1', 'FRM-1', 'FRM-1', 'FRM-2'),
            title: 'next lane',
        },
        card: FINISHED,
        store: said(C, 'waiting on 🔎 sixth sense'),
    });
    expect(await parked($, w, 2, 5)).toEqual([]);
});

/* exit 3: a builder */

const FOUR = steps('FRM-1', 'FRM-1', 'FRM-1', 'FRM-2');
for (const [left, card, tickets] of [
    ['1 step', steps('FRM-1'), {}],
    ['3 steps', steps('FRM-1', 'FRM-1', 'FRM-1'), {}],
    ['4 steps', FOUR, { 'FRM-2': DISPATCHED }],
] as const)
    test(`a builder idle past the row with ${left} left wakes the runner once, naming it`, async ($, on) => {
        const w = parkedWorld(on, [codie(), sixth(WORKING)], { card, tickets });
        expect(await parked($, w, 2, 5)).toEqual([
            `⚡ 🔧 mods | FRM-1 idle 10 min with ${left} left.`,
        ]);
    });

test('a builder idle under the row wakes nobody', async ($, on) => {
    const w = parkedWorld(on, [codie({ ago: 2 })], { card: FOUR });
    expect(await parked($, w, 7)).toEqual([]);
});

test('a builder whose 🔭 line names its reviewer wakes nobody for 30 min, then once, the wait named', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: FOUR,
        store: said(C, 'waiting on 🔎 sixth sense'),
    });
    expect([
        await parked($, w, 2, 18),
        (await pass($, w, 2, 5), w.wakes()),
    ]).toEqual([
        [],
        ['⚡ 🔧 mods | FRM-1 idle 30 min, waiting on 🔎 sixth sense.'],
    ]);
});

test('a near-done lane whose builder waits on a named other is no parked lane', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: ONE_LEFT,
        store: said(C, 'waiting on 🙋‍♂️ dima'),
        tickets: { 'FRM-2': SIGNED },
    });
    expect(await parked($, w, 2, 10)).toEqual([]);
});

test('a wait drawn from a live watch is no named wait', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: FOUR,
        store: {
            [`reply:${C}`]: {
                at: EVEN - 9 * MIN,
                tasks: [{ description: 'the pr', id: 't', type: 'monitor' }],
                wait: 'waiting on the pr',
            },
        },
    });
    expect((await parked($, w, 2)).length).toBe(1);
});

test('a builder whose 🔭 line names the runner wakes it, naming the wait', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: FOUR,
        store: said(C, 'waiting on 🦉 clio'),
    });
    expect(await parked($, w, 2, 5)).toEqual([
        builder('idle 10 min with 4 steps left, waiting on 🦉 clio'),
    ]);
});

const tagged = (sid: string, tag: string, at = EVEN - 9 * MIN) => ({
    'quiet-tagged': { [sid]: { at, tag } },
});
test('an [ask] to the runner open past the row outranks a wait named on another, and is named', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: FOUR,
        store: { ...said(C, 'waiting on 🙋‍♂️ dima'), ...tagged(C, 'ask') },
    });
    expect(await parked($, w, 2, 5)).toEqual([builder('its [ask] unanswered')]);
});

test('a [done] to the runner open past the row wakes it whatever the card shows, the ping named', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: FOUR,
        store: {
            ...said(C, 'waiting on 🔎 sixth sense'),
            ...tagged(C, 'done'),
        },
        tickets: { 'FRM-2': DISPATCHED },
    });
    expect(await parked($, w, 2, 5)).toEqual([
        '⚡ 🔧 mods | FRM-1 sent its [done] 10 min ago, unanswered.',
    ]);
});

for (const tag of ['ask', 'done'])
    test(`an [${tag}] the runner answered is open no more`, async ($, on) => {
        const w = parkedWorld(on, [codie()], {
            card: FOUR,
            store: {
                ...said(C, 'waiting on 🙋‍♂️ dima'),
                ...tagged(C, tag),
                'quiet-sent': { [C]: EVEN - 8 * MIN },
            },
        });
        expect(await parked($, w, 2, 5)).toEqual([]);
    });

test('with quiet comms off no ping is booked, so none reads as open', async ($, on) => {
    const w = parkedWorld(on, [sixth()], {
        card: FOUR,
        store: { ...tagged(R, 'done'), 'quiet-comms': false },
    });
    expect(await parked($, w, 2, 5)).toEqual([]);
});

test('a near-done lane with a [done] and a wait named on another says the [done] alone', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: steps('FRM-1'),
        store: {
            ...said(C, 'waiting on 🔎 sixth sense'),
            ...tagged(C, 'done'),
        },
    });
    expect(await parked($, w, 2)).toEqual([
        '⚡ 🔧 mods | FRM-1 sent its [done] 10 min ago, unanswered.',
    ]);
});

const WING = '🦉🪽 clio: wing 1';
for (const [wait, runner, wakes, name = runner] of [
    ['waiting on 🪽 wing 1', WING, 1],
    ['waiting on 🦉🪽 clio: wing 2', WING, 0],
    ['waiting on 🦉🪽 clio: wing 2', '🦉 clio', 0],
    ['waiting on **🦉🪽 ****🦉 clio****: wing 2**', '🦉 clio', 0],
    ['waiting on **🔎 sixth sense** (clio-lean)', '🦉 clio', 0],
    ['waiting on 🦉 clio', WING, 1],
    ['waiting on the coordinator', '🦉 clio', 1],
    // a dead wing's lane, fallen to main
    ['waiting on 🦉🪽 clio: wing 9', '🦉🪽 clio: wing 9', 1, '🦉 clio'],
] as const)
    test(`${name} runs the lane of a builder «${wait}»: ${wakes} wake at 10 min`, async ($, on) => {
        const w = parkedWorld(on, [codie()], {
            card: { ...FOUR, runner },
            name,
            store: said(C, wait),
        });
        expect((await parked($, w, 2, 5)).length).toBe(wakes);
    });

for (const [why, wait, tag, at] of [
    ['a [done] under the row since its member', undefined, 'done', 12],
    ['an [ask] under the row', 'waiting on 🙋‍♂️ dima', 'ask', 1],
] as const)
    test(`${why} is no open one yet`, async ($, on) => {
        const ago = tag === 'done' ? 5 : 9;
        const w = parkedWorld(on, [sixth()], {
            card: FOUR,
            store: {
                [`reply:${R}`]: { at: EVEN - ago * MIN, wait },
                ...tagged(R, tag, EVEN - at * MIN),
            },
        });
        expect(await parked($, w, 2, 2)).toEqual([]);
    });

test('a [done] its member worked on after is no parked one', async ($, on) => {
    const w = parkedWorld(on, [sixth()], {
        card: FOUR,
        store: {
            ...said(R, 'waiting on 🔧 codie'),
            ...tagged(R, 'done', EVEN - 60 * MIN),
        },
    });
    expect(await parked($, w, 2, 5)).toEqual([]);
});

test('a member with a background task up, its status «shell», is idle to the wake', async ($, on) => {
    const w = parkedWorld(on, [codie({ status: 'shell' })], { card: FOUR });
    expect(await parked($, w, 2)).toEqual([builder('idle 10 min')]);
});

test("a write past the member's own turn, a mod's reload row, moves no idle", async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: FOUR,
        store: { [`reply:${C}`]: { at: EVEN - 9 * MIN } },
    });
    w.wrote.set(C, EVEN);
    await parked($, w, 2);
    w.wrote.set(C, w.clock.now());
    await pass($, w, 12);
    expect(w.wakes()).toEqual([builder('idle 10 min')]);
});

for (const [why, reply] of [
    ['a resumed member', { at: EVEN - 600 * MIN, ended: EVEN - 590 * MIN }],
    ['a member stopped with no end', { at: EVEN - 600 * MIN }],
    ['a member with no reply kept', undefined],
] as const)
    test(`${why} counts from its process's start, and a write moves nothing`, async ($, on) => {
        const w = parkedWorld(
            on,
            [codie({ ago: 300, startedAt: EVEN - 9 * MIN })],
            { card: FOUR, store: reply ? { [`reply:${C}`]: reply } : {} },
        );
        await start($);
        const atStart = w.wakes();
        await pass($, w, 2);
        w.wrote.set(C, w.clock.now());
        await pass($, w, 12);
        expect([atStart, w.wakes()]).toEqual([[], [builder('idle 10 min')]]);
    });

test('a turn that ended with no reply counts as the last one', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: FOUR,
        store: {
            [`reply:${C}`]: { at: EVEN - 50 * MIN, turnAt: EVEN - 5 * MIN },
        },
    });
    expect([await parked($, w, 4), (await pass($, w, 2), w.wakes())]).toEqual([
        [],
        [builder('idle 10 min')],
    ]);
});

/* exit 4: a reviewer */

for (const [why, member, store, wakes] of [
    ['a reviewer', sixth({ ago: 29 }), {}, 1],
    [
        'a 🔭 wait',
        codie({ ago: 29 }),
        {
            [`reply:${codie().sid}`]: {
                at: EVEN - 29 * MIN,
                wait: 'waiting on 🙋‍♂️ dima',
            },
        },
        1,
    ],
    ['a builder', codie({ ago: 29 }), {}, 0],
] as const)
    test(`herdr's row at 60 min: ${why} idle 31 min wakes ${wakes}`, async ($, on) => {
        const w = parkedWorld(on, [member], {
            card: FOUR,
            extraFiles: {
                [HERDR_SETTINGS]: herdrRows({ 'stash.park.after': 60 }),
            },
            store,
        });
        expect((await parked($, w, 2)).length).toBe(wakes);
    });

test('a reviewer idle 30 min beside a working builder wakes once, two pings between and one after', async ($, on) => {
    const w = parkedWorld(on, [codie(WORKING), sixth({ ago: 0 })], {
        card: FOUR,
        store: { [`reply:${R}`]: { at: EVEN - 2000 } },
    });
    const ping = (at: number) => {
        w.store.set(`reply:${R}`, { at: EVEN - 2000, pingedAt: at });
        w.wrote.set(R, at + 1000);
    };
    await parked($, w, 8);
    ping(w.clock.now());
    await pass($, w, 10);
    ping(w.clock.now());
    await pass($, w, 11);
    const early = w.wakes();
    await pass($, w, 2);
    const at30 = w.wakes();
    ping(w.clock.now());
    await pass($, w, 4);
    expect([early, at30, w.wakes().length]).toEqual([
        [],
        ['⚡ 🔎 mods | FRM-1 idle 30 min.'],
        1,
    ]);
});

test('a reviewer waiting on its builder wakes the runner at 30 min, the wait named', async ($, on) => {
    const w = parkedWorld(on, [codie(WORKING), sixth({ ago: 28 })], {
        card: FOUR,
        store: said(R, 'waiting on 🔧 codie', 28),
    });
    expect([await parked($, w, 1), (await pass($, w, 2), w.wakes())]).toEqual([
        [],
        [builder('idle 30 min, waiting on 🔧 codie')],
    ]);
});

/* exit 5: a second wind that never fired */

const refused = (sid: string, at = EVEN - MIN) => ({
    [`wind:${sid}`]: {
        at,
        blocked: 'a watch («ci»)',
        slug: 'mods-9',
        state: 'refused',
    },
});
const AT = { ago: 1 };
test('a refused second wind whose handoff still waits wakes the runner at 3 min, once, naming both', async ($, on) => {
    const w = parkedWorld(on, [codie(AT)], {
        card: FOUR,
        handoffs: ['mods-9'],
        store: refused(C),
    });
    expect([
        await parked($, w, 1),
        (await pass($, w, 2, 2), w.wakes()),
    ]).toEqual([
        [],
        [
            '⚡ 🔧 mods | FRM-1 said second wind «mods-9» 3 min ago, it never fired: held by a watch («ci»); its handoff is still in the store.',
        ],
    ]);
});

test('a second wind left refreshing with its handoff wakes the runner too', async ($, on) => {
    const w = parkedWorld(on, [codie(AT)], {
        card: FOUR,
        handoffs: ['mods-9'],
        store: {
            [`wind:${C}`]: {
                at: EVEN - MIN,
                slug: 'mods-9',
                state: 'refreshing',
            },
        },
    });
    expect(await parked($, w, 3)).toEqual([builder('never fired')]);
});

for (const [why, over, at, handoffs] of [
    ['whose handoff is gone', AT, EVEN - MIN, []],
    ['with a turn of its member since', AT, EVEN - 6 * MIN, ['mods-9']],
    ['of a member at work', { ...AT, ...WORKING }, EVEN - MIN, ['mods-9']],
] as const)
    test(`a refused second wind ${why} wakes nobody`, async ($, on) => {
        const w = parkedWorld(on, [codie(over)], {
            card: FOUR,
            handoffs: [...handoffs],
            store: refused(C, at),
        });
        expect(await parked($, w, 5)).toEqual([]);
    });

test('a peek that failed is tried at the next poll', async ($, on) => {
    const w = parkedWorld(on, [codie(AT)], {
        card: FOUR,
        handoffs: ['mods-9'],
        peeksDown: 1,
        store: refused(C),
    });
    expect([await parked($, w, 2), (await pass($, w, 1), w.wakes())]).toEqual([
        [],
        [builder('never fired')],
    ]);
});

test('a peek that reads several handoffs is tried at the next poll', async ($, on) => {
    const w = parkedWorld(on, [codie(AT)], {
        card: FOUR,
        peekSays: 'several pending handoffs match',
        store: refused(C),
    });
    await parked($, w, 2);
    w.handoffs.push('mods-9');
    await pass($, w, 1);
    expect(w.wakes()).toEqual([builder('never fired')]);
});

test('a wind asked early in a long turn, its compact lost, is a stuck one', async ($, on) => {
    const w = parkedWorld(on, [codie(AT)], {
        card: FOUR,
        handoffs: ['mods-9'],
        store: {
            [`reply:${C}`]: { at: EVEN - MIN },
            [`wind:${C}`]: {
                at: EVEN - 8 * MIN,
                slug: 'mods-9',
                state: 'refreshing',
            },
        },
    });
    expect(await parked($, w, 3)).toEqual([builder('never fired')]);
});

test('a handoff found gone is looked for once', async ($, on) => {
    const w = parkedWorld(on, [codie(AT)], { card: FOUR, store: refused(C) });
    await parked($, w, 2, 1, 1);
    expect(w.peeks).toEqual(['mods-9']);
});

test('a refresh that dropped its slug is compacting, no stuck wind', async ($, on) => {
    const w = parkedWorld(on, [codie(AT)], {
        card: FOUR,
        handoffs: ['mods-9'],
        store: { [`wind:${C}`]: { at: EVEN - MIN, state: 'refreshing' } },
    });
    expect(await parked($, w, 5)).toEqual([]);
});

test('second wind switched off, a stuck one wakes nobody', async ($, on) => {
    const w = parkedWorld(on, [codie(AT)], {
        card: FOUR,
        handoffs: ['mods-9'],
        store: { ...refused(C), shown: { 'stash.second-wind': false } },
    });
    expect(await parked($, w, 5)).toEqual([]);
});

test('one wake names every member a rule holds for, and the lane', async ($, on) => {
    const w = parkedWorld(on, [codie({ ago: 9 }), sixth({ ago: 9 })], {
        card: FINISHED,
        handoffs: ['mods-9'],
        store: refused(R, EVEN - 9 * MIN),
    });
    const [first, ...more] = await parked($, w, 2, 5);
    expect([first, more]).toEqual([
        expect.stringMatching(/finished.*said second wind «mods-9»/),
        [],
    ]);
});
