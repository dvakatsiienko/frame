import { isSeated } from '../hooks/roster.ts';
import {
    HERE,
    MIN,
    NOW,
    PEER,
    board,
    fleet,
    held,
    rowsBySid,
} from './board-world.ts';
import { type Engine, expect, test } from './shared-boot.ts';

test('a row shows 🤫 n while its session holds n member pings, nothing at 0', async ($, on) => {
    fleet(on, {
        [`quiet-held:${HERE}`]: [held('a', 'x', 1), held('b', 'y', 2)],
        [`quiet-held:${PEER}`]: [],
    });
    const rows = await rowsBySid($);
    expect([rows[HERE]?.includes('🤫 2'), rows[PEER]?.includes('🤫')]).toEqual([
        true,
        false,
    ]);
});

test('🤫 n opens the held pings: sender, age, first line', async ($, on) => {
    fleet(on, {
        [`quiet-held:${HERE}`]: [held('🔎 sixth sense', 'round 2 clean', 3)],
    });
    const ui = await board($);
    const closed = (await ui.findAll({ type: 'Text' })).some((t) =>
        t.text?.includes('round 2 clean'),
    );
    await ui.press({ key: `fold:quiet:${HERE}` });
    const line = (await ui.findAll({ type: 'Text' })).find((t) =>
        t.text?.includes('round 2 clean'),
    )?.text;
    expect([closed, line]).toEqual([
        false,
        '🤫 🔎 sixth sense · 3m ago: round 2 clean',
    ]);
});

test('a held message of many lines draws its first line in the row', async ($, on) => {
    fleet(on, {
        [`quiet-held:${HERE}`]: [
            held('🔎 sixth sense', 'round 2 clean\nthe detail', 3),
        ],
    });
    const ui = await board($);
    await ui.press({ key: `fold:quiet:${HERE}` });
    expect(
        (await ui.findAll({ type: 'Text' })).find((t) =>
            t.text?.includes('round 2 clean'),
        )?.text,
    ).toBe('🤫 🔎 sixth sense · 3m ago: round 2 clean');
});

// the quiet ledger (brief 6): a member's transcript sends to clio against her quiet log, on her board only
const DAY = new Date(NOW).toISOString().slice(0, 10);
const at = (ms: number) => new Date(ms).toISOString();
const logged = (from: string, ms: number, verdict = 'held') => ({
    arm: 'on',
    at: ms,
    from,
    startedTurn: false,
    tag: 'progress',
    verdict,
});
const PEER_NAME = '☕️ 🔧 FRM-1 code: x';
const gapRow = async (
    $: Engine,
    clock: { advance: (ms: number) => Promise<void> },
    store: Map<string, unknown>,
) => {
    await board($);
    await clock.advance(9000);
    const gaps = (
        store.get('quiet-gap') as { gaps?: QuietGapLine[] } | undefined
    )?.gaps;
    return gaps?.length
        ? gaps
              .map(
                  (g) =>
                      `${g.from} · a progress ping skipped the quiet hold (sent ${g.sent}, logged ${g.logged})`,
              )
              .join('\n')
        : undefined;
};
type QuietGapLine = { from: string; logged: number; sent: number };

test('a member that sent clio more pings than her log holds is a gap in the ledger, never a 🚨 row', async ($, on) => {
    const { clock, store } = fleet(
        on,
        { [`quiet-log:${DAY}`]: [logged(PEER_NAME, NOW - 30 * MIN)] },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] },
        },
    );
    const ui = await board($);
    await clock.advance(9000);
    expect([
        (store.get('quiet-gap') as { gaps: unknown[] } | undefined)?.gaps,
        await ui.find({ text: /^🚨/, type: 'Text' }),
    ]).toEqual([[{ from: PEER_NAME, logged: 1, sent: 2 }], undefined]);
});

const RENAMED = 'FRM-426 code: band and board read true';
// a rename keeps the session id: x's one record names the peer as it is now, and its lines logged under the old name
// carry that id (FRM-570: no record ever carries an old name)
const RENAMED_THREADS = [{ name: PEER_NAME, role: 'codie', sessionId: PEER }];
const loggedAsOld = (at: number) => ({
    ...logged(`☕️ 🔧 ${RENAMED}`, at),
    sid: PEER,
});

test('a member renamed mid-day keeps its logged pings, so the old name leaves no gap', async ($, on) => {
    const { clock, store } = fleet(
        on,
        {
            [`quiet-log:${DAY}`]: [
                loggedAsOld(NOW - 30 * MIN),
                loggedAsOld(NOW - 20 * MIN),
            ],
        },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] },
            threads: RENAMED_THREADS,
        },
    );
    expect(await gapRow($, clock, store)).toBeUndefined();
});

test('a renamed member that sent more than its old-name lines hold still shows its gap', async ($, on) => {
    const { clock, store } = fleet(
        on,
        { [`quiet-log:${DAY}`]: [loggedAsOld(NOW - 30 * MIN)] },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] },
            threads: RENAMED_THREADS,
        },
    );
    expect(await gapRow($, clock, store)).toContain('(sent 2, logged 1)');
});

test("a log line carrying the sender's session id counts for it whatever name it was logged under", async ($, on) => {
    const { clock, store } = fleet(
        on,
        {
            [`quiet-log:${DAY}`]: [
                {
                    ...logged('☕️ 🧪 an unrelated name', NOW - 30 * MIN),
                    sid: PEER,
                },
            ],
        },
        { isOwner: true, sends: { [PEER]: [at(NOW - 30 * MIN)] } },
    );
    expect(await gapRow($, clock, store)).toBeUndefined();
});

test('a send inside the 2 min grace is not a gap yet', async ($, on) => {
    const { clock, store } = fleet(
        on,
        { [`quiet-log:${DAY}`]: [logged(PEER_NAME, NOW - 30 * MIN)] },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - MIN)] },
        },
    );
    expect(await gapRow($, clock, store)).toBeUndefined();
});

test("a send before the day's first log line is not counted", async ($, on) => {
    const { clock, store } = fleet(
        on,
        { [`quiet-log:${DAY}`]: [logged(PEER_NAME, NOW - 30 * MIN)] },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 40 * MIN), at(NOW - 30 * MIN)] },
        },
    );
    expect(await gapRow($, clock, store)).toBeUndefined();
});

test('a flushed line does not count as a logged delivery', async ($, on) => {
    const { clock, store } = fleet(
        on,
        {
            [`quiet-log:${DAY}`]: [
                logged(PEER_NAME, NOW - 30 * MIN),
                logged(PEER_NAME, NOW - 25 * MIN, 'flushed'),
            ],
        },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] },
        },
    );
    expect(await gapRow($, clock, store)).toContain('(sent 2, logged 1)');
});

test('a held app note does not count as a logged delivery', async ($, on) => {
    const { clock, store } = fleet(
        on,
        {
            [`quiet-log:${DAY}`]: [
                logged(PEER_NAME, NOW - 30 * MIN),
                { ...logged(PEER_NAME, NOW - 25 * MIN, 'held'), tag: 'notice' },
            ],
        },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] },
        },
    );
    expect(await gapRow($, clock, store)).toContain('(sent 2, logged 1)');
});

test("the ledger's gap stays off any board but clio's", async ($, on) => {
    const { clock, store } = fleet(
        on,
        { [`quiet-log:${DAY}`]: [logged(PEER_NAME, NOW - 30 * MIN)] },
        {
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] },
            threads: [{ sessionId: HERE }],
        },
    );
    expect(await gapRow($, clock, store)).toBeUndefined();
});

// the stuck alarm: a held ping past the idle wait (10 min) + 2 min turns clio's 🤫 n red
const heldFor = (ms: number) => ({
    [`quiet-held:${HERE}`]: [{ at: NOW - ms, from: PEER_NAME, text: 'step 2' }],
});

test('a held ping past the wait + 2 min turns the 🤫 n red', async ($, on) => {
    fleet(on, heldFor(13 * MIN));
    const badge = await (await board($)).find({ text: '🤫 1', type: 'Text' });
    expect(badge?.props.color).toBe('error');
});

// FRM-570 exit 16, FRM-579: a chair is a record's role, a claim for clio, a wing, crow and helga; a name alone carries none
test('a chair comes from a role, never a name', () => {
    expect([isSeated(undefined), isSeated('wing'), isSeated('codie')]).toEqual([
        false,
        true,
        true,
    ]);
});

test('a held ping inside the wait + 2 min keeps the 🤫 n plain', async ($, on) => {
    fleet(on, heldFor(11 * MIN));
    const badge = await (await board($)).find({ text: '🤫 1', type: 'Text' });
    expect(badge?.props.color).toBeUndefined();
});

test("crow's lines count for her though the log keeps the registry's split «🐦 ⬛» and the board the joined «🐦‍⬛»", async ($, on) => {
    const { clock, store } = fleet(
        on,
        {
            [`quiet-log:${DAY}`]: [
                logged('🐦 ⬛ crow', NOW - 30 * MIN),
                logged('🐦 ⬛ crow', NOW - 20 * MIN),
            ],
        },
        {
            isOwner: true,
            patch: { 2: { name: '🐦 ⬛ crow' } },
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] },
        },
    );
    expect(await gapRow($, clock, store)).toBeUndefined();
});

// FRM-429 exit 2 (dima's o56): no quiet-comms card draws on any board; held pings and ledger gaps stay in the store
test('no quiet-comms card draws on clio’s board, with pings held and a gap open', async ($, on) => {
    const { clock, store } = fleet(
        on,
        {
            [`quiet-held:${HERE}`]: [
                { at: NOW - MIN, from: PEER_NAME, text: 'step 2' },
            ],
            [`quiet-log:${DAY}`]: [logged(PEER_NAME, NOW - 30 * MIN)],
        },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 20 * MIN)] },
        },
    );
    const ui = await board($);
    await clock.advance(9000);
    expect([
        await ui.find({ key: 'quiet:card', type: 'Box' }),
        await ui.find({ text: /quiet comms/, type: 'Text' }),
        (store.get('quiet-gap') as { gaps: unknown[] } | undefined)?.gaps
            .length,
    ]).toEqual([undefined, undefined, 1]);
});

// FRM-412 exit 3: the cause of «holds 0» — a member renamed from ☕️ to 🌗 logged under both names, and the ledger
// matched the log's name to the registry's exactly (10-22: 4 lines as ☕️, 9 as 🌗 for one codie)
test('a member whose mode emoji changed keeps its logged pings counted: no gap', async ($, on) => {
    const { clock, store } = fleet(
        on,
        {
            [`quiet-log:${DAY}`]: [
                logged('🌗 🔧 FRM-1 code: x', NOW - 30 * MIN),
                logged('🌗 🔧 FRM-1 code: x', NOW - 25 * MIN),
            ],
        },
        {
            isOwner: true,
            sends: { [PEER]: [at(NOW - 30 * MIN), at(NOW - 25 * MIN)] },
        },
    );
    const ui = await board($);
    await clock.advance(9000);
    expect([
        (store.get('quiet-gap') as { gaps: unknown[] } | undefined)?.gaps,
        await ui.find({ text: /^🚨/, type: 'Text' }),
    ]).toEqual([[], undefined]);
});
