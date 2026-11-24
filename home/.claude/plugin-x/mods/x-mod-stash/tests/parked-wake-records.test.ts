import {
    DISPATCH,
    WORKING,
    codie,
    onDialog,
    parked,
    parkedWorld,
    pass,
    sixth,
    turnEnd,
} from './parked-world.ts';
import {
    EVEN,
    LANES,
    MIN,
    PID,
    SID,
    ping,
    say,
    send,
    start,
    steps,
} from './quiet-helpers.ts';
import { expect, test } from './shared-boot.ts';
import { THREADS_FILE, recordOf, threadsFile } from './threads.ts';

const C = codie().sid;
const R = sixth().sid;
const FOUR = steps('FRM-1', 'FRM-1', 'FRM-1', 'FRM-2');
const ONE_LEFT = steps('FRM-1', 'FRM-2');
const FINISHED = { current: 1 };
const SIGNED = { labels: ['signed'] };
const DISPATCHED = { description: DISPATCH, labels: ['agent'] };
const builder = (text: string) => expect.stringContaining(text);
const said = (sid: string, wait: string, ago = 9) => ({
    [`reply:${sid}`]: { at: EVEN - ago * MIN, wait },
});
const tagged = (sid: string, tag: string, at = EVEN - 9 * MIN) => ({
    'quiet-tagged': { [sid]: { at, tag } },
});

/* FRM-698: every live member by its record, card or no card */

const OPEN_DONE = { ...said(C, 'waiting on 🦉 clio'), ...tagged(C, 'done') };
const ENDED = { ...FOUR, endedAt: EVEN };
for (const [why, card] of [
    ['an ended card', ENDED],
    ['a card that does not name it', { ...FOUR, linkedIds: {}, members: {} }],
    ['an open card (control)', FOUR],
] as const)
    test(`a [done] left open by a member on ${why} wakes its clio once`, async ($, on) => {
        const w = parkedWorld(on, [codie()], { card, store: OPEN_DONE });
        expect(await parked($, w, 2, 5, 30)).toEqual([
            '⚡ 🔧 mods | FRM-1 sent its [done] 10 min ago, unanswered.',
        ]);
    });

test('an [ask] left open by a member on no card wakes its clio once', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: ENDED,
        store: { ...said(C, 'waiting on 🦉 clio'), ...tagged(C, 'ask') },
    });
    expect(await parked($, w, 2, 5, 30)).toEqual([
        '⚡ 🔧 mods | FRM-1 sent its [ask] 10 min ago, unanswered.',
    ]);
});

for (const [why, at, over] of [
    ['a turn of its own 12 min later', EVEN - 21 * MIN, {}],
    ['a resume an hour later', EVEN - 60 * MIN, { startedAt: EVEN - 2 * MIN }],
] as const)
    test(`a [done] on no card, ${why}: still one wake, said once`, async ($, on) => {
        const w = parkedWorld(on, [codie(over)], {
            card: ENDED,
            store: {
                ...said(C, 'waiting on 🦉 clio'),
                ...tagged(C, 'done', at),
            },
        });
        const first = await parked($, w, 2, 30);
        w.spoke(C, EVEN + 33 * MIN);
        await pass($, w, 30);
        expect([first.length, w.wakes().length]).toEqual([1, 1]);
    });

for (const [what, tag, members] of [
    ['a builder’s [done]', 'done', [codie(), sixth(WORKING)]],
    ['a builder’s [ask]', 'ask', [codie(), sixth(WORKING)]],
    ['a reviewer’s [ask]', 'ask', [sixth()]],
] as const)
    test(`${what} told on its card is not told again when the card ends`, async ($, on) => {
        const by = members[0].sid;
        const w = parkedWorld(on, [...members], {
            card: FOUR,
            store: tagged(by, tag),
            tickets: { 'FRM-2': DISPATCHED },
        });
        const first = await parked($, w, by === R ? 32 : 2);
        const { lanes } = JSON.parse(w.files[LANES] ?? '');
        w.files[LANES] = JSON.stringify({
            lanes: lanes.map((l: object) => ({ ...l, endedAt: EVEN })),
        });
        await pass($, w, 30);
        expect([first.length, w.wakes().length]).toEqual([1, 1]);
    });

test('a [done] told to a wing that died is told to main', async ($, on) => {
    const w = parkedWorld(on, [ofWing], {
        card: ENDED,
        store: {
            ...OPEN_DONE,
            [`parked-ping:${C}`]: { at: EVEN - 9 * MIN, to: 'clio-wing-1' },
        },
    });
    expect((await parked($, w, 2, 30)).length).toBe(1);
});

test('an idle member on no open card with no open ping wakes nobody', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: ENDED,
        store: said(C, 'waiting on 🦉 clio'),
    });
    expect(await parked($, w, 2, 30)).toEqual([]);
});

test('a member at work on no card, its [done] open, wakes nobody', async ($, on) => {
    const w = parkedWorld(on, [codie(WORKING)], {
        card: ENDED,
        store: OPEN_DONE,
    });
    expect(await parked($, w, 2, 30)).toEqual([]);
});

const WING_1 = {
    display: '🦉🪽 clio: wing 1',
    role: 'wing',
    sessionId: 'w1w1w1w1-wing',
    wing: 1,
};
const liveWing = { threads: [{ ...WING_1, pid: 90 }] };
const wingRow = (over: object) => ({
    name: WING_1.display,
    pid: 90,
    sessionId: WING_1.sessionId,
    status: 'idle',
    ...over,
});
const ofWing = codie({ record: { coordinator: 'clio-wing-1' } });
const ALIVE = { sessions: [wingRow({})], threads: [{ ...WING_1, pid: 90 }] };
for (const [who, name, over, wakes] of [
    ['a wing wakes for its own member', WING_1.display, {}, 1],
    ['main does not wake for a live wing’s member', '🦉 clio', ALIVE, 0],
    [
        'main wakes for a dead wing’s member',
        '🦉 clio',
        { threads: [WING_1] },
        1,
    ],
    [
        'main wakes for a wing’s that died, its pid still on record',
        '🦉 clio',
        { threads: ALIVE.threads },
        1,
    ],
    ['another wing does not wake', '🦉🪽 clio: wing 2', ALIVE, 0],
] as const)
    test(`a member on no card, its [done] open: ${who}`, async ($, on) => {
        const w = parkedWorld(on, [ofWing], {
            card: ENDED,
            name,
            store: {
                ...OPEN_DONE,
                'quiet-tagged:clio-wing-1': OPEN_DONE['quiet-tagged'],
            },
            ...structuredClone(over as object),
        });
        expect((await parked($, w, 2)).length).toBe(wakes);
    });

for (const [why, isAnswered, wakes] of [
    ['a second one left open wakes it again', false, 2],
    ['its answer closes the second', true, 1],
] as const)
    test(`a wing’s own lines are booked: ${why}`, async ($, on) => {
        const w = parkedWorld(on, [ofWing], {
            card: ENDED,
            name: WING_1.display,
            store: said(C, 'waiting on 🪽 wing 1', 0),
        });
        await start($);
        await ping($, '[done] FRM-1 landed', codie().name);
        expect(w.queued.length).toBe(1);
        await pass($, w, 11);
        w.spoke(C, EVEN + 11 * MIN);
        await ping($, '[done] FRM-2 landed', codie().name);
        await pass($, w, 1);
        if (isAnswered) await send($, codie().name, 'heard');
        await pass($, w, 12);
        expect(w.wakes().length).toBe(wakes);
    });

test('a wing’s send closes no ping of main’s', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: ENDED,
        store: {
            ...OPEN_DONE,
            'quiet-sent:clio-wing-1': { [C]: EVEN - 8 * MIN },
        },
    });
    expect((await parked($, w, 2)).length).toBe(1);
});

test('main reads a dead wing’s books for its member', async ($, on) => {
    const w = parkedWorld(on, [ofWing], {
        card: ENDED,
        store: {
            ...said(C, 'waiting on 🪽 wing 1'),
            'quiet-tagged:clio-wing-1': tagged(C, 'done')['quiet-tagged'],
        },
    });
    expect((await parked($, w, 2)).length).toBe(1);
});

test('a designer’s open [done] wakes its clio', async ($, on) => {
    const w = parkedWorld(on, [codie({ record: { role: 'designer' } })], {
        card: ENDED,
        store: OPEN_DONE,
    });
    expect((await parked($, w, 2)).length).toBe(1);
});

/* FRM-698 exit 3: a reviewer's [done] is its clean, never unanswered */

for (const [why, card] of [
    ['an open card', FOUR],
    ['no card', ENDED],
] as const)
    test(`a reviewer's [done] on ${why} is never read as unanswered`, async ($, on) => {
        const w = parkedWorld(on, [sixth()], {
            card,
            store: tagged(R, 'done'),
        });
        expect(await parked($, w, 2, 15)).toEqual([]);
    });

test("a reviewer's [done] leaves its 30 min row, said once", async ($, on) => {
    const w = parkedWorld(on, [sixth()], {
        card: FOUR,
        store: { ...said(R, 'waiting on 🔧 codie'), ...tagged(R, 'done') },
    });
    expect(await parked($, w, 15, 7, 30)).toEqual([builder('idle 31 min')]);
});

/* FRM-698 exit 4: a codie whose reviewer is done is settled on that card */

const SETTLED = {
    'quiet-tagged': { [R]: { at: EVEN - 9 * MIN, tag: 'done' } },
};
const both = [codie(), sixth(WORKING)];
test('a codie past its reviewer’s [done], steps left: no builder wake', async ($, on) => {
    const w = parkedWorld(on, both, {
        card: FOUR,
        store: SETTLED,
        tickets: { 'FRM-2': DISPATCHED },
    });
    expect(await parked($, w, 2, 35)).toEqual([]);
});

test('a lane whose reviewer sent no [done] wakes for its builder as before', async ($, on) => {
    const w = parkedWorld(on, both, {
        card: FOUR,
        tickets: { 'FRM-2': DISPATCHED },
    });
    expect((await parked($, w, 2, 35)).length).toBe(1);
});

test('a settled codie’s next chunk not dispatched still wakes', async ($, on) => {
    const w = parkedWorld(on, [codie(), sixth()], {
        card: ONE_LEFT,
        store: SETTLED,
        tickets: { 'FRM-2': SIGNED },
    });
    expect(await parked($, w, 2)).toEqual([
        builder('next chunk FRM-2 is signed, not dispatched'),
    ]);
});

test('a finished card of a settled codie wakes once, not at its next word', async ($, on) => {
    const w = parkedWorld(on, both, { card: FINISHED, store: SETTLED });
    const first = await parked($, w, 2);
    w.spoke(C, EVEN + 3 * MIN);
    await pass($, w, 14);
    expect([first.length, w.wakes().length]).toEqual([1, 1]);
});

const TWO = { also: { ...FOUR, title: 'card B' }, card: FOUR };
for (const [end, over, record] of [
    [
        'its coordinator’s message',
        { store: { 'quiet-sent': { [C]: EVEN - 8 * MIN } } },
        {},
    ],
    ['a dispatch', {}, { dispatchedAt: EVEN - 8 * MIN }],
    ['another open card', TWO, {}],
] as const)
    test(`a settled codie’s silence ends with ${end}`, async ($, on) => {
        const w = parkedWorld(on, [codie({ record }), sixth(WORKING)], {
            card: FOUR,
            tickets: { 'FRM-2': DISPATCHED },
            ...over,
            store: { ...SETTLED, ...('store' in over ? over.store : {}) },
        });
        expect((await parked($, w, 2))[0]).toContain(
            'idle 10 min with 4 steps',
        );
    });

for (const [why, act, wakes] of [
    ['made', 'create', 1],
    ['linked to it', 'link codie', 1],
    ['given its reviewer', 'link sixth-sense', 1],
    ['ticked', 'step', 0],
] as const)
    test(`a card ${why} after its reviewer’s [done]: ${wakes} builder wake`, async ($, on) => {
        const w = parkedWorld(on, both, {
            card: {
                ...FOUR,
                history: [{ act, at: EVEN - 8 * MIN, current: 0, done: 0 }],
            },
            store: SETTLED,
            tickets: { 'FRM-2': DISPATCHED },
        });
        expect((await parked($, w, 2)).length).toBe(wakes);
    });

test('a settled codie stays so once its reviewer’s session ended', async ($, on) => {
    const w = parkedWorld(on, [codie()], {
        card: {
            ...FOUR,
            linkedIds: { codie: C, 'sixth-sense': R },
            members: { codie: codie().name, 'sixth-sense': sixth().name },
        },
        store: SETTLED,
        tickets: { 'FRM-2': DISPATCHED },
    });
    expect(await parked($, w, 2, 35)).toEqual([]);
});

test('a wing’s codie stays settled in main once its reviewer’s session ended', async ($, on) => {
    const w = parkedWorld(on, [ofWing], {
        card: {
            ...FOUR,
            linkedIds: { codie: C, 'sixth-sense': R },
            members: { codie: codie().name, 'sixth-sense': sixth().name },
        },
        store: { 'quiet-tagged:clio-wing-1': SETTLED['quiet-tagged'] },
        tickets: { 'FRM-2': DISPATCHED },
    });
    expect(await parked($, w, 2, 35)).toEqual([]);
});

test('an open [ask] on a finished card wakes after the finished wake', async ($, on) => {
    const w = parkedWorld(on, both, { card: FINISHED, store: SETTLED });
    const first = await parked($, w, 2);
    w.spoke(C, EVEN + 3 * MIN);
    w.store.set('quiet-tagged', {
        ...SETTLED['quiet-tagged'],
        [C]: { at: EVEN + 3 * MIN, tag: 'ask' },
    });
    await pass($, w, 12);
    expect([first.length, w.wakes().slice(1)]).toEqual([
        1,
        [builder('sent its [ask] 11 min ago, unanswered')],
    ]);
});

test('a reviewer’s [ask] after its [done] leaves its codie settled', async ($, on) => {
    const w = parkedWorld(on, both, {
        card: FOUR,
        tickets: { 'FRM-2': DISPATCHED },
    });
    await start($);
    await ping($, '[done] clean', sixth().name);
    await ping($, '[ask] a or b?', sixth().name);
    await pass($, w, 2, 35);
    expect(w.wakes().filter((x) => x.includes('🔧'))).toEqual([]);
});

for (const [why, record, wakes] of [
    ['a second clean', {}, 1],
    ['a dispatch, then a clean', { dispatchedAt: EVEN + 4 * MIN }, 2],
] as const)
    test(`a finished card said, then ${why}: ${wakes} finished wakes`, async ($, on) => {
        const w = parkedWorld(on, both, { card: FINISHED, store: SETTLED });
        await parked($, w, 2);
        w.files[THREADS_FILE] = threadsFile([
            { pid: PID, sessionId: SID, ...recordOf('🦉 clio') },
            ...both.map(({ pid, role, sid }) => ({
                pid,
                role,
                sessionId: sid,
                ...(sid === C ? record : {}),
            })),
        ]);
        w.spoke(C, EVEN + 4 * MIN);
        await pass($, w, 3);
        w.store.set('quiet-tagged', {
            [R]: { at: EVEN + 5 * MIN, tag: 'done' },
        });
        await pass($, w, 14);
        expect(w.wakes().length).toBe(wakes);
    });

test('a settled codie’s own open [ask] still wakes', async ($, on) => {
    const w = parkedWorld(on, both, {
        card: FOUR,
        store: {
            'quiet-tagged': {
                ...SETTLED['quiet-tagged'],
                [C]: { at: EVEN - 8 * MIN, tag: 'ask' },
            },
        },
        tickets: { 'FRM-2': DISPATCHED },
    });
    expect(await parked($, w, 2)).toEqual([builder('its [ask] unanswered')]);
});

/* FRM-698 exit 6: a member on a dialog for 3 min */

const alarmLog = (w: { logged: string[] }) =>
    w.logged.filter((l) => !l.endsWith(' was not registered'));
const APPROVE = 'approve Bash: touch /tmp/a';
const asks = { herdr: { 781: APPROVE } };
const stuck = codie(onDialog(EVEN));
const WAKE = `⚡ 🔧 mods | FRM-1 stands on a permission dialog 3 min: «${APPROVE}».`;
for (const [why, card] of [
    ['no card', ENDED],
    ['an open card', FOUR],
] as const)
    test(`a member on ${why} on a permission dialog wakes its clio once, at 3 min`, async ($, on) => {
        const w = parkedWorld(on, [stuck], { ...asks, card });
        const early = await parked($, w, 1, 1);
        await pass($, w, 1, 1, 30);
        expect([early.length, w.wakes()]).toEqual([0, [WAKE]]);
    });

test('a question dialog wakes the same, herdr asked only then', async ($, on) => {
    const w = parkedWorld(on, [codie(onDialog(EVEN, 'input needed'))], {
        ...asks,
        card: ENDED,
    });
    await parked($, w, 2);
    const before = w.asked.length;
    await pass($, w, 1, 10);
    expect([before, w.asked, w.wakes()]).toEqual([
        0,
        ['ls --json', 'get t781 --json'],
        [WAKE.replace('permission', 'question')],
    ]);
});

test('a dialog answered at 2 min wakes nobody', async ($, on) => {
    const w = parkedWorld(on, [stuck], { ...asks, card: ENDED });
    await parked($, w, 2);
    w.reads(stuck, WORKING);
    await pass($, w, 1, 10);
    expect(w.wakes()).toEqual([]);
});

for (const [why, text] of [
    ['a second dialog', 'approve plan'],
    ['the same text again after a clear read', APPROVE],
] as const)
    test(`${why} is a new wake, 3 min into its own stretch`, async ($, on) => {
        const herdr = { 781: APPROVE };
        const w = parkedWorld(on, [stuck], { card: ENDED, herdr });
        await parked($, w, 3);
        w.reads(stuck, WORKING);
        await pass($, w, 1);
        herdr[781] = text;
        w.reads(stuck, onDialog(EVEN + 4 * MIN));
        await pass($, w, 2);
        const early = w.wakes().length;
        await pass($, w, 1, 20);
        expect([early, w.wakes()]).toEqual([
            1,
            [WAKE, WAKE.replace(APPROVE, text)],
        ]);
    });

test('a busy clio’s polls ask herdr nothing, her turn’s end does', async ($, on) => {
    const w = parkedWorld(on, [stuck], { ...asks, card: ENDED });
    await start($);
    await say($, 'look at the board');
    await w.skip(4 * MIN);
    await w.skip(4 * MIN);
    const busy = [w.asked.length, w.wakes().length];
    await turnEnd($);
    await pass($, w, 2);
    expect([busy, w.wakes().length]).toEqual([[0, 0], 1]);
});

test('a registry with no stamp counts from the first read, a clear one ends it', async ($, on) => {
    const bare = codie({ status: 'waiting', waitingFor: 'input needed' });
    const w = parkedWorld(on, [bare], { ...asks, card: ENDED });
    await parked($, w, 1, 3);
    const first = w.wakes().length;
    w.reads(bare, WORKING);
    await pass($, w, 1);
    w.reads(bare, {});
    await pass($, w, 1, 4);
    expect([first, w.wakes().length]).toEqual([1, 2]);
});

for (const [why, after, stamps, wakes] of [
    ['a dialog drawn again', 0, [1, 2, 3, 4, 5, 6], 1],
    ['a dialog still up after an unread hour', 60, [], 1],
    ['another after an unread hour', 60, [58], 2],
] as const)
    test(`${why}: ${wakes} wake`, async ($, on) => {
        let isDown = false;
        const w = parkedWorld(on, [stuck], {
            ...asks,
            card: ENDED,
            isPsDown: () => isDown,
        });
        await parked($, w, 3);
        isDown = after > 0;
        if (after) await pass($, w, after - 1);
        for (const m of stamps) {
            w.reads(stuck, onDialog(EVEN + (3 + m) * MIN - 1));
            if (!after) await pass($, w, 1);
        }
        isDown = false;
        await pass($, w, 1, 5);
        expect(w.wakes().length).toBe(wakes);
    });

test('a dialog drawn again every minute still wakes at 3 min', async ($, on) => {
    const w = parkedWorld(on, [stuck], { ...asks, card: ENDED });
    await start($);
    for (const m of [1, 2, 3, 4]) {
        w.reads(stuck, onDialog(EVEN + m * MIN - 1));
        await pass($, w, 1);
    }
    expect(w.wakes().length).toBe(1);
});

test('a member resumed onto a new dialog starts a new one', async ($, on) => {
    const w = parkedWorld(on, [stuck], { ...asks, card: ENDED });
    await parked($, w, 3);
    w.reads(stuck, {
        ...onDialog(EVEN + 4 * MIN),
        startedAt: EVEN + 3.5 * MIN,
    });
    await pass($, w, 1, 4);
    expect(w.wakes().length).toBe(2);
});

for (const word of ['sandbox request', 'worker request', 'goal proposal'])
    test(`cc’s «${word}» is a permission dialog`, async ($, on) => {
        const w = parkedWorld(on, [codie(onDialog(EVEN, word))], {
            ...asks,
            card: ENDED,
        });
        expect(await parked($, w, 3)).toEqual([WAKE]);
    });

test('a dialog told to main is not told again by the wing that came back', async ($, on) => {
    const w = parkedWorld(on, [codie({ ...stuck, record: ofWing.record })], {
        card: ENDED,
        name: WING_1.display,
        store: {
            [`parked-dialog:${C}`]: {
                readAt: EVEN,
                saidTo: 'clio-main',
                since: EVEN - 9 * MIN,
                stamp: EVEN,
            },
        },
    });
    expect(await parked($, w, 1, 5)).toEqual([]);
});

test('a busy clio’s polls ask herdr nothing, her turn’s end does', async ($, on) => {
    const w = parkedWorld(on, [stuck], { ...asks, card: ENDED });
    await start($);
    await say($, 'look at the board');
    await w.skip(4 * MIN);
    await w.skip(4 * MIN);
    const busy = [w.asked.length, w.wakes().length];
    await turnEnd($);
    await pass($, w, 2);
    expect([busy, w.wakes().length]).toEqual([[0, 0], 1]);
});

test('a registry with no stamp counts from the first read, a clear one ends it', async ($, on) => {
    const bare = codie({ status: 'waiting', waitingFor: 'input needed' });
    const w = parkedWorld(on, [bare], { ...asks, card: ENDED });
    await parked($, w, 1, 3);
    const first = w.wakes().length;
    w.reads(bare, WORKING);
    await pass($, w, 1);
    w.reads(bare, {});
    await pass($, w, 1, 4);
    expect([first, w.wakes().length]).toEqual([1, 2]);
});

for (const [why, after, stamps, wakes] of [
    ['a dialog drawn again', 0, [1, 2, 3, 4, 5, 6], 1],
    ['a dialog still up after an unread hour', 60, [], 1],
    ['another after an unread hour', 60, [58], 2],
] as const)
    test(`${why}: ${wakes} wake`, async ($, on) => {
        let isDown = false;
        const w = parkedWorld(on, [stuck], {
            ...asks,
            card: ENDED,
            isPsDown: () => isDown,
        });
        await parked($, w, 3);
        isDown = after > 0;
        if (after) await pass($, w, after - 1);
        for (const m of stamps) {
            w.reads(stuck, onDialog(EVEN + (3 + m) * MIN - 1));
            if (!after) await pass($, w, 1);
        }
        isDown = false;
        await pass($, w, 1, 5);
        expect(w.wakes().length).toBe(wakes);
    });

test('a dialog drawn again every minute still wakes at 3 min', async ($, on) => {
    const w = parkedWorld(on, [stuck], { ...asks, card: ENDED });
    await start($);
    for (const m of [1, 2, 3, 4]) {
        w.reads(stuck, onDialog(EVEN + m * MIN - 1));
        await pass($, w, 1);
    }
    expect(w.wakes().length).toBe(1);
});

test('a member resumed onto a new dialog starts a new one', async ($, on) => {
    const w = parkedWorld(on, [stuck], { ...asks, card: ENDED });
    await parked($, w, 3);
    w.reads(stuck, {
        ...onDialog(EVEN + 4 * MIN),
        startedAt: EVEN + 3.5 * MIN,
    });
    await pass($, w, 1, 4);
    expect(w.wakes().length).toBe(2);
});

for (const word of ['sandbox request', 'worker request', 'goal proposal'])
    test(`cc’s «${word}» is a permission dialog`, async ($, on) => {
        const w = parkedWorld(on, [codie(onDialog(EVEN, word))], {
            ...asks,
            card: ENDED,
        });
        expect(await parked($, w, 3)).toEqual([WAKE]);
    });

for (const [what, saidTo, wakes] of [
    ['a wing that now stands on one', 'clio-wing-1', 1],
    ['main', 'clio-main', 0],
] as const)
    test(`a dialog told to ${what}: ${wakes} wake of main`, async ($, on) => {
        const w = parkedWorld(on, [ofWing], {
            card: ENDED,
            ...liveWing,
            sessions: [wingRow(onDialog(EVEN + 2 * MIN))],
            store: {
                [`parked-dialog:${C}`]: {
                    readAt: EVEN,
                    saidTo,
                    since: EVEN - 9 * MIN,
                    stamp: EVEN,
                },
            },
        });
        w.reads(ofWing, onDialog(EVEN));
        expect((await parked($, w, 1)).length).toBe(wakes);
    });

test('a busy clio’s polls ask herdr nothing, her turn’s end does', async ($, on) => {
    const w = parkedWorld(on, [stuck], { ...asks, card: ENDED });
    await start($);
    await say($, 'look at the board');
    await w.skip(4 * MIN);
    await w.skip(4 * MIN);
    const busy = [w.asked.length, w.wakes().length];
    await turnEnd($);
    await pass($, w, 2);
    expect([busy, w.wakes().length]).toEqual([[0, 0], 1]);
});

test('a registry with no stamp counts from the first read, a clear one ends it', async ($, on) => {
    const bare = codie({ status: 'waiting', waitingFor: 'input needed' });
    const w = parkedWorld(on, [bare], { ...asks, card: ENDED });
    await parked($, w, 1, 3);
    const first = w.wakes().length;
    w.reads(bare, WORKING);
    await pass($, w, 1);
    w.reads(bare, {});
    await pass($, w, 1, 4);
    expect([first, w.wakes().length]).toEqual([1, 2]);
});

for (const [why, over] of [
    ['an idle member', {}],
    ['a member at work', WORKING],
    ['a screen opened by hand', onDialog(EVEN, 'dialog open')],
] as const)
    test(`${why} is on no dialog`, async ($, on) => {
        const w = parkedWorld(on, [codie(over)], { ...asks, card: ENDED });
        expect([await parked($, w, 3, 10), alarmLog(w)]).toEqual([[], []]);
    });

for (const [who, members, world, wakes] of [
    [
        'main wakes for a wing',
        [],
        { sessions: [wingRow(onDialog(EVEN))] },
        [WING_1.display],
    ],
    [
        'main wakes for a member whose wing is on one too',
        [codie({ ...stuck, record: ofWing.record })],
        { sessions: [wingRow(onDialog(EVEN))] },
        [WING_1.display, stuck.name],
    ],
    [
        'main leaves a live wing’s member to it',
        [codie({ ...stuck, record: ofWing.record })],
        { sessions: [wingRow({})] },
        [],
    ],
] as const)
    test(`on a dialog: ${who}`, async ($, on) => {
        const w = parkedWorld(on, [...members], {
            card: ENDED,
            ...liveWing,
            sessions: [...world.sessions],
        });
        const [text = ''] = await parked($, w, 3, 10);
        expect([
            w.wakes().length,
            wakes.every((n) => text.includes(`${n} stands on`)),
        ]).toEqual([wakes.length ? 1 : 0, true]);
    });

test('a wing wakes for its own member on a dialog', async ($, on) => {
    const w = parkedWorld(on, [codie({ ...stuck, record: ofWing.record })], {
        ...asks,
        card: ENDED,
        name: WING_1.display,
    });
    expect(await parked($, w, 3, 10)).toEqual([WAKE]);
});

test('a wake said is not said again after a reload', async ($, on) => {
    const w = parkedWorld(on, [stuck], { ...asks, card: ENDED });
    await parked($, w, 3);
    await start($);
    await pass($, w, 5);
    expect(w.wakes()).toEqual([WAKE]);
});

test('a status cc names that the alarm does not know wakes nobody, one line', async ($, on) => {
    const w = parkedWorld(on, [codie(onDialog(EVEN, 'a new word'))], {
        ...asks,
        card: ENDED,
    });
    expect([await parked($, w, 3, 10), alarmLog(w)]).toEqual([
        [],
        [
            'x-mod-stash: ⚡ 🔧 mods | FRM-1 reads «waiting · a new word», a status the dialog wake does not know',
        ],
    ]);
});

test('a registry read that fails wakes nobody, one line, and keeps the dialog', async ($, on) => {
    let isDown = false;
    const w = parkedWorld(on, [stuck], {
        ...asks,
        card: ENDED,
        isPsDown: () => isDown,
    });
    await parked($, w, 2);
    isDown = true;
    await pass($, w, 1, 5);
    const down = [w.wakes().length, alarmLog(w)];
    isDown = false;
    await pass($, w, 1);
    expect([down, w.wakes()]).toEqual([
        [
            0,
            [
                'x-mod-stash: the session registry did not read; the idle alarm asks again at the next poll',
            ],
        ],
        [WAKE.replace('3 min', '9 min')],
    ]);
});

test('a herdr that does not answer costs the words alone', async ($, on) => {
    const w = parkedWorld(on, [stuck], { card: ENDED, herdr: null });
    expect([await parked($, w, 3, 10), alarmLog(w)]).toEqual([
        ['⚡ 🔧 mods | FRM-1 stands on a permission dialog 3 min.'],
        ['x-mod-stash: herdr did not say what ⚡ 🔧 mods | FRM-1 is asked'],
    ]);
});

test('a member outside herdr wakes with no words and no log line', async ($, on) => {
    const w = parkedWorld(on, [stuck], { card: ENDED });
    expect([await parked($, w, 3, 10), alarmLog(w)]).toEqual([
        ['⚡ 🔧 mods | FRM-1 stands on a permission dialog 3 min.'],
        [],
    ]);
});

test('a dialog of many lines reads as one, cut at 200', async ($, on) => {
    const w = parkedWorld(on, [stuck], {
        card: ENDED,
        herdr: { 781: `approve Bash:\n  ${'x'.repeat(300)}` },
    });
    expect(await parked($, w, 3)).toEqual([
        WAKE.replace(APPROVE, `approve Bash: ${'x'.repeat(186)}`),
    ]);
});

test('an unknown word is said again after a known one', async ($, on) => {
    const odd = codie(onDialog(EVEN, 'a new word'));
    const w = parkedWorld(on, [odd], { card: ENDED });
    await parked($, w, 1);
    w.reads(odd, WORKING);
    await pass($, w, 1);
    w.reads(odd, {});
    await pass($, w, 1, 5);
    expect(alarmLog(w).length).toBe(2);
});
