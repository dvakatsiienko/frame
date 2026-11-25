import { overCap } from './fixtures/second-wind-over-cap.ts';
import { unknownRow } from './fixtures/second-wind-unknown-row.ts';
import { expect, test } from './shared-boot.ts';
import {
    NOW,
    PID,
    POLL_MS,
    SID,
    SLUG,
    WIND_STORE,
    type World,
    band,
    compact,
    edit,
    endTurn,
    fake,
    notes,
    noticesOf,
    ready,
    say,
    start,
    storeFile,
    turnAt,
    withSecondWind,
    world,
} from './wind-world.ts';

test('an asked session reads the second wind note once, at its next turn', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await start($);
    await say($);
    await say($, 'again');
    expect([
        notes(w.lines),
        (w.store.get(`wind:${SID}`) as { state?: string }).state,
    ]).toEqual([
        [expect.stringMatching(/^🐦‍🔥 second wind: dima asked/)],
        'writing',
    ]);
});

test("a peer's ping carries the note too: any turn takes it", async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await start($);
    await say($, 'a ping from clio', 'peer');
    expect(notes(w.lines)).toHaveLength(1);
});

test("clio's note names her good stop", async ($, on) => {
    const w = world(on, '🦉 clio', undefined, undefined, null);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await start($);
    await say($);
    expect(notes(w.lines)[0]).toMatch(
        /finish that topic whole first.*never split.*clio:checkpoint/,
    );
});

const INIT_LIST =
    /first first-act is your role's init list.*x:crew-codie, x:crew-dna read whole.*plugin-authoring.*clio: her boot/;

for (const [who, name, role] of [
    ['a codie', undefined, 'codie'],
    ['clio', '🦉 clio', null],
] as const)
    test(`${who}'s note makes the handoff open with the role's init list`, async ($, on) => {
        const w = world(on, name, undefined, undefined, role);
        w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
        await start($);
        await say($);
        expect(notes(w.lines).map((n) => INIT_LIST.test(n))).toEqual([true]);
    });

const WIND_HEAD = '🐦‍🔥 second wind: dima asked you';

test('a press on a busy session joins its next tool step once', async ($, on) => {
    const w = world(on);
    await start($);
    await say($);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    const first = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    const second = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    expect([
        notes([...(first.context ?? [])]).map((n) => n.startsWith(WIND_HEAD)),
        notes([...(second.context ?? [])]),
        (w.store.get(`wind:${SID}`) as { state?: string }).state,
    ]).toEqual([[true], [], 'writing']);
});

test('a press on an idle session wakes nothing: the ask waits for its next turn', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await start($);
    await w.clock.advance(60_000);
    expect([
        notes(w.lines),
        (w.store.get(`wind:${SID}`) as { state?: string }).state,
    ]).toEqual([[], 'asked']);
});

test('a session nobody asked reads no second wind line', async ($, on) => {
    const w = world(on);
    await start($);
    await say($);
    expect(notes(w.lines)).toEqual([]);
});

test('a cancel reaches the session once, and the ask is gone', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'cancelled' });
    await start($);
    await say($);
    await say($, 'again');
    expect([notes(w.lines), w.store.has(`wind:${SID}`)]).toEqual([
        [expect.stringMatching(/^🐦‍🔥 second wind cancelled/)],
        false,
    ]);
});

test('a named handoff compacts, then ingests, at the turn end', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'writing' });
    await start($);
    await say($);
    const r = await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect([
        r.deny,
        w.commands.map((c) => c.split(' ')[0]),
        w.commands[1],
        w.store.has(`wind:${SID}`),
    ]).toEqual([
        undefined,
        ['/compact', '/x:handoff-ingest'],
        `/x:handoff-ingest ${SLUG}`,
        false,
    ]);
});

test('the compact runs once, never again at the next turn end', async ($, on) => {
    const w = world(on);
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands).toHaveLength(2);
});

test('nothing compacts before the turn that named the handoff ends', async ($, on) => {
    const w = world(on);
    await start($);
    await ready($, SLUG);
    await w.clock.advance(POLL_MS);
    expect(w.commands).toEqual([]);
});

test('the op refuses in one line with no slug, and nothing compacts', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await ready($);
    await endTurn($);
    await w.clock.advance(2_000);
    expect([r.deny?.includes('\n'), r.deny, w.commands]).toEqual([
        false,
        expect.stringContaining('slug: "<lane or topic>-<n>"'),
        [],
    ]);
});

test('the op refuses a slug the handoff store lacks, and nothing compacts', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await ready($, 'no-such-9');
    await endTurn($);
    await w.clock.advance(2_000);
    expect([r.deny, w.commands]).toEqual([
        expect.stringContaining('no handoff «no-such-9»'),
        [],
    ]);
});

test('🐦‍🔥 second wind switched off never compacts, even with a handoff named', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    w.store.set('shown', { 'stash.second-wind': false });
    await start($);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands).toEqual([]);
});

test('the ingest is queued while the compact still runs, so no prompt slips between', async ($, on) => {
    let queued: string[] = [];
    const w = world(on, undefined, undefined, async () => {
        for (let i = 0; i < 50; i++) await Promise.resolve();
        queued = [...w.commands];
    });
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(queued.map((c) => c.split(' ')[0])).toEqual([
        '/compact',
        '/x:handoff-ingest',
    ]);
});

test("a 🐦‍🔥 press reads dima's press note from its row", async ($, on) => {
    const w = world(on);
    await start($);
    edit(
        w,
        'stash.wind.text.press',
        'my press note at {fill} of {wind}: handoff, then second-wind',
    );
    await w.clock.advance(POLL_MS);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await turnAt($, w, 30);
    expect(withSecondWind(w.lines)).toEqual([
        'my press note at 30 of 65: handoff, then second-wind',
    ]);
});

test('a notice crossing reads the notice row, with the fill and the wind line in it', async ($, on) => {
    const w = world(on);
    await start($);
    edit(w, 'stash.wind.text.notice', 'ctx {fill} of {wind}: second-wind soon');
    await w.clock.advance(POLL_MS);
    await turnAt($, w, 56);
    expect(withSecondWind(w.lines)).toEqual(['ctx 56 of 65: second-wind soon']);
});

test("a wind line crossing reads the mod's ask from its row", async ($, on) => {
    const w = world(on);
    await start($);
    edit(w, 'stash.wind.text.at', 'past {wind}: handoff, then second-wind');
    await w.clock.advance(POLL_MS);
    await turnAt($, w, 56);
    await turnAt($, w, 66);
    expect(w.lines.filter((l) => l.startsWith('past'))).toEqual([
        'past 65: handoff, then second-wind',
    ]);
});

test("the coordinator's wind line crossing reads her own row", async ($, on) => {
    const w = world(on, '🦉 clio', undefined, undefined, 'coordinator');
    await start($);
    edit(w, 'stash.wind.text.at.coordinator', 'lead past {wind}: checkpoint');
    await w.clock.advance(POLL_MS);
    for (const fill of [56, 70, 70]) await turnAt($, w, fill);
    expect(w.lines.filter((l) => l.startsWith('lead past'))).toEqual([
        'lead past 65: checkpoint',
    ]);
});

test('a coordinator with no row of her own reads the wind line row every thread reads', async ($, on) => {
    const w = world(on, '🦉 clio', undefined, undefined, 'coordinator');
    await start($);
    edit(w, 'stash.wind.text.at', 'past {wind}: handoff, then second-wind');
    await w.clock.advance(POLL_MS);
    for (const fill of [56, 70, 70]) await turnAt($, w, fill);
    expect(w.lines.filter((l) => l.startsWith('past'))).toEqual([
        'past 65: handoff, then second-wind',
    ]);
});

test("a 🍃-off coordinator's propose line reads its row", async ($, on) => {
    const w = world(on, '🦉 clio', undefined, undefined, 'coordinator');
    w.store.set(`second-wind-auto:${SID}`, { at: NOW - 1, on: false });
    await start($);
    edit(w, 'stash.wind.text.propose', 'ask dima: {fill} of {wind}');
    await w.clock.advance(POLL_MS);
    for (const fill of [56, 70]) await turnAt($, w, fill);
    expect(w.lines.filter((l) => l.startsWith('ask dima'))).toEqual([
        'ask dima: 70 of 65',
    ]);
});

const HERDR_SETTINGS = '/home/.claude/shelf/herdr-settings/settings.json';
const herdrRows = (rows: Record<string, unknown>) =>
    JSON.stringify({ rows, v: 1 });

test('a text typed in herdr after the mod started is read from the next poll on', async ($, on) => {
    const w = world(on);
    w.files[HERDR_SETTINGS] = herdrRows({ 'stash.wind.text.notice': '' });
    await start($);
    await w.clock.advance(POLL_MS);
    w.files[HERDR_SETTINGS] = herdrRows({
        'stash.wind.text.notice': 'herdr says {fill}: second-wind soon',
    });
    await w.clock.advance(POLL_MS);
    await turnAt($, w, 56);
    expect(withSecondWind(w.lines)).toEqual([
        'herdr says 56: second-wind soon',
    ]);
});

test('a text herdr held before the store existed is taken once', async ($, on) => {
    const w = world(on);
    w.files[HERDR_SETTINGS] = herdrRows({
        'stash.wind.text.notice': 'typed long ago, {fill}: second-wind',
    });
    await start($);
    await w.clock.advance(POLL_MS);
    const taken = storeFile(w).rows['stash.wind.text.notice'].text;
    edit(w, 'stash.wind.text.notice', 'the door, {fill}: second-wind');
    await w.clock.advance(2 * POLL_MS);
    await turnAt($, w, 56);
    expect([taken, withSecondWind(w.lines)]).toEqual([
        'typed long ago, {fill}: second-wind',
        ['the door, 56: second-wind'],
    ]);
});

test("a blank row at herdr's first read is only noted: a text the door wrote stays", async ($, on) => {
    const w = world(on);
    await start($);
    edit(w, 'stash.wind.text.notice', 'the door, {fill}: second-wind');
    await w.clock.advance(2 * POLL_MS);
    w.store.delete('herdr-seen');
    w.files[HERDR_SETTINGS] = herdrRows({ 'stash.wind.text.notice': '' });
    await w.clock.advance(2 * POLL_MS);
    await turnAt($, w, 56);
    expect(withSecondWind(w.lines)).toEqual(['the door, 56: second-wind']);
});

test('a start writes the store: five rows with their defaults, the applied values, this session and its pid', async ($, on) => {
    const w = world(on);
    await start($);
    const file = storeFile(w);
    expect([
        file.v,
        file.cap,
        Object.entries(file.rows).map(([row, r]) => [
            row,
            (r as { default: string }).default.slice(0, 2),
            (r as { text: string }).text,
        ]),
        file.applied,
    ]).toEqual([
        1,
        4000,
        [
            'stash.wind.text.press',
            'stash.wind.text.notice',
            'stash.wind.text.at',
            'stash.wind.text.at.coordinator',
            'stash.wind.text.propose',
        ].map((row) => [row, '🐦', '']),
        {
            'second-wind': true,
            'second-wind-auto': true,
            sessions: { [SID]: { auto: true, pid: PID } },
            'wind-at': 65,
            'wind-notice': 55,
        },
    ]);
});

test('the notice default keeps its placeholders in the store', async ($, on) => {
    const w = world(on);
    await start($);
    expect(storeFile(w).rows['stash.wind.text.notice'].default).toContain(
        'context at {fill} %',
    );
});

test('a start that finds the store as it would write it writes no file again', async ($, on) => {
    const w = world(on);
    await start($);
    await start($);
    expect(w.moves.filter((p) => p === WIND_STORE)).toHaveLength(1);
});

test('an edited text sits in the store beside its default after the next poll', async ($, on) => {
    const w = world(on);
    await start($);
    edit(w, 'stash.wind.text.press', 'my words');
    await w.clock.advance(POLL_MS);
    const row = storeFile(w).rows['stash.wind.text.press'];
    await w.clock.advance(POLL_MS);
    expect([
        row.text,
        row.default.startsWith('🐦‍🔥 second wind: dima'),
        w.store.has('wind-text-edits'),
    ]).toEqual(['my words', true, false]);
});

test('a wind line changed in 🎛️ is the applied line in the store after the next poll', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.set('wind-notice', 45);
    w.store.set('wind-at', 50);
    await w.clock.advance(POLL_MS);
    const { applied } = storeFile(w);
    expect([applied['wind-notice'], applied['wind-at']]).toEqual([45, 50]);
});

test('a second wind switch flipped off is off in the store after the next poll', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.set('shown', {
        'stash.second-wind': false,
        'stash.second-wind-auto': false,
    });
    await w.clock.advance(POLL_MS);
    const { applied } = storeFile(w);
    expect([applied['second-wind'], applied['second-wind-auto']]).toEqual([
        false,
        false,
    ]);
});

test('a press on the band 🍃 is in the store at once', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await band($);
    await ui.press({ key: 'auto-wind' });
    expect(storeFile(w).applied.sessions[SID]).toEqual({
        auto: false,
        pid: PID,
    });
});

const withSessions = (w: World, sessions: Record<string, unknown>) => {
    const file = storeFile(w);
    w.files[WIND_STORE] = JSON.stringify({
        ...file,
        applied: { ...file.applied, sessions },
    });
};
const OTHERS = {
    'dead-sid': { auto: true, pid: 99_999 },
    'peer-1': { auto: false, pid: 1 },
};

test("a session whose pid is gone leaves the store at a session's first pass, a live one's entry stays", async ($, on) => {
    const w = world(on);
    withSessions(w, OTHERS);
    await start($);
    expect(storeFile(w).applied.sessions).toEqual({
        'peer-1': { auto: false, pid: 1 },
        [SID]: { auto: true, pid: PID },
    });
});

test('a session whose pid goes later leaves the store within five polls, never at each one', async ($, on) => {
    const w = world(on);
    withSessions(w, { 'peer-1': { auto: false, pid: 1 } });
    await start($);
    withSessions(w, { ...OTHERS, [SID]: { auto: true, pid: PID } });
    await w.clock.advance(4 * POLL_MS);
    const before = Object.keys(storeFile(w).applied.sessions);
    await w.clock.advance(POLL_MS);
    expect([before, Object.keys(storeFile(w).applied.sessions)]).toEqual([
        ['dead-sid', 'peer-1', SID],
        ['peer-1', SID],
    ]);
});

test('an entry with this pid under an older session id, left by a /clear, leaves the store', async ($, on) => {
    const w = world(on);
    withSessions(w, { 'before-clear': { auto: false, pid: PID } });
    await start($);
    expect(Object.keys(storeFile(w).applied.sessions)).toEqual([SID]);
});

test('an entry whose pid is no whole positive number is dropped, and the live peers stay', async ($, on) => {
    const w = world(on);
    withSessions(w, {
        hostile: { auto: true, pid: -1 },
        'peer-1': { auto: false, pid: 1 },
    });
    await start($);
    expect(Object.keys(storeFile(w).applied.sessions)).toEqual(['peer-1', SID]);
});

test("an edit a peer's older file wrote over is folded again at the next poll", async ($, on) => {
    const w = world(on);
    await start($);
    const older = w.files[WIND_STORE] ?? '';
    edit(w, 'stash.wind.text.press', 'my words');
    await w.clock.advance(POLL_MS);
    w.files[WIND_STORE] = older;
    await w.clock.advance(POLL_MS);
    expect(storeFile(w).rows['stash.wind.text.press'].text).toBe('my words');
});

test('an edit over the cap, as herdr could leave one, is not taken and the log says so', async ($, on) => {
    const w = world(on);
    await start($);
    edit(w, 'stash.wind.text.press', 'x'.repeat(4001));
    await w.clock.advance(POLL_MS);
    expect([
        storeFile(w).rows['stash.wind.text.press'].text,
        w.store.has('wind-text-edits'),
        w.logs.filter((l) => l.includes('was not taken')),
    ]).toEqual([
        '',
        false,
        [
            'x-mod-stash second wind: an edit of stash.wind.text.press is over 4000 chars and was not taken',
        ],
    ]);
});

test("the coordinator's blank rows keep her defaults: her checkpoint at the wind line, the propose line with 🍃 off", async ($, on) => {
    const w = world(on, '🦉 clio', undefined, undefined, 'coordinator');
    w.files[WIND_STORE] = JSON.stringify({
        rows: {
            'stash.wind.text.at.coordinator': { text: ' ' },
            'stash.wind.text.propose': { text: '' },
        },
    });
    await start($);
    for (const fill of [56, 70, 70]) await turnAt($, w, fill);
    w.store.set(`second-wind-auto:${SID}`, { at: NOW + 1, on: false });
    w.store.delete(`fill:${SID}`);
    await turnAt($, w, 71);
    expect(
        [
            /^🐦‍🔥 second wind: the mod asks you to checkpoint, your context is past 65 %/,
            /^🐦‍🔥 second wind due at 71 %: past the 65 % boundary/,
        ].map((note) => w.lines.filter((l) => note.test(l)).length),
    ).toEqual([1, 1]);
});

test('a row name the mod does not know stays in the store untouched', async ($, on) => {
    const w = world(on);
    w.files[WIND_STORE] = JSON.stringify(unknownRow);
    await start($);
    await w.clock.advance(POLL_MS);
    const file = storeFile(w);
    expect([
        file.rows['stash.wind.text.from-the-future'],
        file.rows['stash.wind.text.press'].text,
        file.note,
    ]).toEqual([
        unknownRow.rows['stash.wind.text.from-the-future'],
        'kept beside it',
        unknownRow.note,
    ]);
});

test('a text over the cap is refused: the default is read, one log line says so, and no read throws', async ($, on) => {
    const w = world(on);
    w.files[WIND_STORE] = JSON.stringify(overCap);
    await start($);
    for (const fill of [56, 40, 56]) await turnAt($, w, fill);
    expect([
        noticesOf(w.lines).length,
        w.logs.filter((l) => l.includes('over 4000 chars')),
    ]).toEqual([
        2,
        [
            'x-mod-stash second wind: the text of stash.wind.text.notice is over 4000 chars, so its default is read',
        ],
    ]);
});

test('a store file that is no JSON reads as empty and is written whole again', async ($, on) => {
    const w = world(on);
    w.files[WIND_STORE] = '{"rows": {"stash.wind.te';
    await start($);
    await turnAt($, w, 56);
    expect([noticesOf(w.lines).length, storeFile(w).v]).toEqual([1, 1]);
});

test('a blank text row keeps the default of each note', async ($, on) => {
    const w = world(on);
    w.files[WIND_STORE] = JSON.stringify({
        rows: {
            'stash.wind.text.at': { text: '' },
            'stash.wind.text.notice': { text: '  ' },
            'stash.wind.text.press': { text: 7 },
        },
    });
    await start($);
    await turnAt($, w, 56);
    await turnAt($, w, 66);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await say($);
    expect(
        [
            /^🐦‍🔥 context at 56 %.*65 % is the upper boundary/,
            /^🐦‍🔥 second wind: the mod asks you for it, your context is past 65 %/,
            /^🐦‍🔥 second wind: dima asked you to refresh/,
        ].map((note) => w.lines.filter((l) => note.test(l)).length),
    ).toEqual([1, 1, 1]);
});

test('past 55 % a session hears once that 65 % is the upper boundary', async ($, on) => {
    const w = world(on);
    await start($);
    await turnAt($, w, 56);
    await turnAt($, w, 57);
    expect(noticesOf(w.lines)).toEqual([
        expect.stringMatching(/context at 56 %.*65 % is the upper boundary/),
    ]);
});

test('the notice says wind now with nothing in hand, else finish the meaningful part, commit and hand off first, never mid-build', async ($, on) => {
    const w = world(on);
    await start($);
    await turnAt($, w, 56);
    const said = noticesOf(w.lines).join('');
    expect(
        [
            'nothing planned and nothing pending: take it now',
            'work in hand: wind at a good point of your own',
            'plan your nearest steps so you finish the meaningful part',
            'solve its tails',
            'commit',
            'handoff',
            'never mid-build or mid-step',
        ].filter((t) => !said.includes(t)),
    ).toEqual([]);
});

test('a long turn hears the notice at its next tool step, from the live fill', async ($, on) => {
    const w = world(on);
    await start($);
    await turnAt($, w, 40);
    fake.fillNow = 57;
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    expect(noticesOf([...(r.context ?? [])])).toHaveLength(1);
});

test('54, 56, 54, 56 draws one notice', async ($, on) => {
    const w = world(on);
    await start($);
    for (const fill of [54, 56, 54, 56]) await turnAt($, w, fill);
    expect(noticesOf(w.lines)).toHaveLength(1);
});

test('a fill 10 under the notice re-arms it', async ($, on) => {
    const w = world(on);
    await start($);
    for (const fill of [56, 44, 56]) await turnAt($, w, fill);
    expect(noticesOf(w.lines)).toHaveLength(2);
});

test('a compact re-arms the notice', async ($, on) => {
    const w = world(on);
    await start($);
    await turnAt($, w, 56);
    await compact($, 'auto');
    await turnAt($, w, 56);
    expect(noticesOf(w.lines)).toHaveLength(2);
});

test('one step crossing both lines gives the notice first and the ask a turn later', async ($, on) => {
    const w = world(on);
    await start($);
    await turnAt($, w, 52);
    await turnAt($, w, 68);
    const after68 = [
        noticesOf(w.lines).length,
        notes(w.lines).filter((l) => l.includes('second wind:')).length,
    ];
    await turnAt($, w, 68);
    expect([
        after68,
        notes(w.lines).filter((l) =>
            l.startsWith('🐦‍🔥 second wind: the mod asks'),
        ),
        (w.store.get(`wind:${SID}`) as { state?: string }).state,
    ]).toEqual([[1, 0], [expect.any(String)], 'writing']);
});

test("the ask never lands in the notice's own turn, even at a later tool step", async ($, on) => {
    const w = world(on);
    await start($);
    await turnAt($, w, 68);
    fake.fillNow = 68;
    await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    expect(w.store.has(`wind:${SID}`)).toBe(false);
});

test('a session first seen past 65 % gets one notice, then one ask', async ($, on) => {
    const w = world(on);
    await start($);
    for (const fill of [70, 71, 72]) await turnAt($, w, fill);
    expect([
        noticesOf(w.lines).length,
        notes(w.lines).filter((l) =>
            l.startsWith('🐦‍🔥 second wind: the mod asks'),
        ).length,
    ]).toEqual([1, 1]);
});

test("the mod's ask names the mod, a must that still lets the step on hand finish", async ($, on) => {
    const w = world(on);
    await start($);
    for (const fill of [70, 70]) await turnAt($, w, fill);
    const ask =
        notes(w.lines).find((l) =>
            l.startsWith('🐦‍🔥 second wind: the mod asks'),
        ) ?? '';
    expect([
        ask.includes('dima asked'),
        ask.includes('a must'),
        ask.includes('finish the step'),
    ]).toEqual([false, true, true]);
});

test('an ask pressed by dima is never written over', async ($, on) => {
    const w = world(on);
    await start($);
    await turnAt($, w, 70);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await turnAt($, w, 70);
    expect(
        notes(w.lines).filter((l) =>
            l.startsWith('🐦‍🔥 second wind: dima asked'),
        ),
    ).toHaveLength(1);
});

test("dima's take-back holds until the fill drops under 65 %, then the next crossing asks again", async ($, on) => {
    const w = world(on);
    await start($);
    for (const fill of [70, 70]) await turnAt($, w, fill);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'cancelled' });
    for (const fill of [70, 70, 60, 70]) await turnAt($, w, fill);
    expect(
        notes(w.lines).filter((l) =>
            l.startsWith('🐦‍🔥 second wind: the mod asks'),
        ),
    ).toHaveLength(2);
});

// FRM-634, dima's tick: a coordinator's 🍃 is on until pressed off, as every thread's
test("the coordinator's thread is 🍃 on by default: the notice at 55 %, the mod's ask at 65 %", async ($, on) => {
    const w = world(on, '🦉 clio', undefined, undefined, 'coordinator');
    await start($);
    for (const fill of [56, 70]) await turnAt($, w, fill);
    expect([noticesOf(w.lines).length, w.store.has(`wind:${SID}`)]).toEqual([
        1,
        true,
    ]);
});
