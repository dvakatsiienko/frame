import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { MESSAGE_KINDS, messageKind } from '../hooks/quiet.ts';
import { THREADS_FILE, recordOf, threadsFile } from './threads.ts';

// 🐦‍🔥 second wind, the asked session's side (todo 16): the note rides its next turn, a cancel takes it back, and the
// op it calls with its handoff compacts and ingests at that turn's end

const SID = 'w1w1w1w1-wind';
const PID = 4646;
const TOOL = 'mcp__x-mod-stash__orbit';
const NOW = new Date(2026, 9, 13, 17, 40).getTime();
const SLUG = 'mods-l14-2';

// what lands while the engine compacts: one `on` per event, so a test sets this flag before its first `$` call
let inCompact: (() => Promise<unknown>) | undefined;
// a session started with no plugin x skills (crow's pane, FRM-505) lists no ingest command
let hasIngestCommand = true;
// the engine refuses the compact, as it refuses an unknown command
let compactRefusal: string | undefined;
let ingestRefusal: string | undefined;
// the engine refuses the mod's own prompt
let submitRefusal: string | undefined;
// the context % a step reads live, through $.session.usage
let fillNow: number | undefined;

// the live peers a test's messages come from, as cc's registry names them and x's records give their roles
const SENSE_NAMES = [
    '⚡ 🔎 sixth sense: mods',
    '⚡ 🔎 sixth sense: mods lane 6 | main',
];
const PEERS = [
    { name: '🦉 clio', pid: 1, record: recordOf('🦉 clio') },
    {
        name: '🦉🪽 clio: wing 1',
        pid: 2,
        record: recordOf('🦉🪽 clio: wing 1'),
    },
    ...SENSE_NAMES.map((name, i) => ({
        name,
        pid: 3 + i,
        record: { display: name, role: 'sixth-sense' },
    })),
    // the 01:28 fork: clio's name, no record
    { name: '🦉 clio', pid: 90, record: {} },
];
// `name` is the session's registry name; `handoffs` the slugs `x handoff peek` finds
// `during` runs inside the compact, as a turn end that lands while it works would
// `role` is the role x's thread record gives the session, `null` for none
function world(
    on: On,
    name = '☕️ 🔧 codie: mods',
    handoffs = [SLUG],
    during?: () => Promise<unknown>,
    role: string | null = 'codie',
) {
    inCompact = undefined;
    hasIngestCommand = true;
    compactRefusal = undefined;
    ingestRefusal = undefined;
    submitRefusal = undefined;
    fillNow = undefined;
    const prompts: string[] = [];
    const lines: string[] = [];
    const commands: string[] = [];
    const appended: string[] = [];
    const clock = mock.clock(on, { now: NOW });
    const store = new Map<string, unknown>();
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        store.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...store.keys()] }));
    on('store.delete', (_$, e) => {
        store.delete(e.key);
        return { value: undefined };
    });
    on('session.id', () => ({ value: SID }));
    on('env.get', () => ({ value: '/home' }));
    on('process.run', (_$, e) => {
        const isPeek = e.argv[1] === 'handoff' && e.argv[2] === 'peek';
        return {
            value: {
                exitCode: isPeek && !handoffs.includes(e.argv[3] ?? '') ? 1 : 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: isPeek
                    ? ''
                    : e.argv[0] === 'ps'
                      ? [PID, ...PEERS.map((p) => p.pid)].join('\n')
                      : `${PID}\nMon Oct 13 17:00:00 2026\n`,
            },
        };
    });
    const files: Record<string, string> = {
        [`/home/.claude/sessions/${PID}.json`]: JSON.stringify({
            name,
            pid: PID,
        }),
        [THREADS_FILE]: threadsFile([
            {
                pid: PID,
                sessionId: SID,
                ...(role ? { display: name, role } : recordOf(name)),
            },
            ...PEERS.map((p) => ({
                pid: p.pid,
                sessionId: `peer-${p.pid}`,
                ...p.record,
            })),
        ]),
    };
    for (const p of PEERS)
        files[`/home/.claude/sessions/${p.pid}.json`] = JSON.stringify({
            name: p.name,
            pid: p.pid,
            sessionId: `peer-${p.pid}`,
        });
    on('fs.read', (_$, e) =>
        e.path in files
            ? { value: files[e.path] ?? '' }
            : { deny: 'no such file' },
    );
    on('fs.list', (_$, e) => ({
        value:
            e.path === '/home/.claude/sessions'
                ? PEERS.map((p) => ({
                      isLink: false,
                      kind: 'file' as const,
                      mtimeMs: 0,
                      name: `${p.pid}.json`,
                      size: 1,
                  }))
                : [],
    }));
    on('ui.log', () => ({ value: undefined }));
    on('ui.toast', () => ({ value: undefined }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('prompt.submit', (_$, e) => {
        if (e.origin?.kind === 'plugin' && submitRefusal)
            throw new Error(submitRefusal);
        lines.push(...(e.context ?? []));
        if (e.origin?.kind === 'plugin') prompts.push(e.text);
        return { text: e.text };
    });
    on('session.usage', () => ({
        value: {
            context: {
                percent: fillNow,
                tokens: (fillNow ?? 0) * 10_000,
                window: 1_000_000,
            },
            rateLimits: [],
            startedAt: 0,
        },
    }));
    on('command.list', () => ({
        value: [
            { description: '', name: 'compact', source: 'builtin' as const },
            ...(hasIngestCommand
                ? [
                      {
                          description: '',
                          name: 'x:handoff-ingest',
                          source: 'plugin' as const,
                      },
                  ]
                : []),
        ],
    }));
    on('command.run', async (_$, e) => {
        if (e.command === 'compact' && compactRefusal)
            throw new Error(compactRefusal);
        if (e.command === 'x:handoff-ingest' && ingestRefusal)
            throw new Error(ingestRefusal);
        commands.push(`/${e.command} ${e.args}`);
        if (e.command === 'compact') await during?.();
        return { text: '' };
    });
    on('turn.complete', () => ({ text: '' }));
    on('session.compact', async (_$, e) => {
        await inCompact?.();
        return e.messages[0]?.text === 'veto'
            ? ({ skip: 'vetoed' } as never)
            : { messages: e.messages };
    });
    on('classic.Stop', () => ({}));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    on('session.append', (_$, e, next) => {
        for (const c of e.message.content)
            if (c.type === 'text') appended.push(String(c.text));
        return next(e);
    });
    return { appended, clock, commands, lines, prompts, store };
}

const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });

const say = ($: Engine, text = 'go', kind = 'composer') =>
    $.prompt.submit({ origin: { kind } as never, text, wait: false });

const endTurn = ($: Engine) =>
    $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });

// the op names what is still pending; «none» is the only word that lets it compact
const ready = ($: Engine, slug?: string, pending: string | null = 'none') =>
    $.tool.call({
        op: 'second-wind',
        tool: TOOL,
        ...(slug === undefined ? {} : { slug }),
        ...(pending === null ? {} : { pending }),
    } as never) as Promise<{ deny?: string; result?: unknown }>;

const DIMAS_WORDS =
    'a second wind is a graceful context refresh, a request, never urgent — the session and its coders resolve every subagent and park everything before the compact, so nothing is lost.';

const notes = (lines: string[]) => lines.filter((l) => l.includes('🐦‍🔥'));

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
    await w.clock.advance(5_000);
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

// FRM-505: past 55 % a session hears the wind is coming; past 65 % the mod asks for it, a turn after the notice
const NOTICE = /^🐦‍🔥 context at \d+ %/;
const noticesOf = (lines: string[]) => lines.filter((l) => NOTICE.test(l));
// the prompt path reads the fill the board shows; each prompt is one turn
async function turnAt($: Engine, w: ReturnType<typeof world>, fill: number) {
    w.store.set(`context:${SID}`, fill);
    await say($);
}

test('past 55 % a session hears once that 65 % is the upper boundary', async ($, on) => {
    const w = world(on);
    await start($);
    await turnAt($, w, 56);
    await turnAt($, w, 57);
    expect(noticesOf(w.lines)).toEqual([
        expect.stringMatching(/context at 56 %.*65 % is the upper boundary/),
    ]);
});

test('the notice says to finish the meaningful part, commit and hand off before the wind, never mid-build', async ($, on) => {
    const w = world(on);
    await start($);
    await turnAt($, w, 56);
    const said = noticesOf(w.lines).join('');
    expect(
        [
            'do not compact now',
            'finish the meaningful part',
            'commit',
            'handoff',
            'never mid-build or mid-step',
        ].map((t) => said.includes(t)),
    ).toEqual([true, true, true, true, true]);
});

test('a long turn hears the notice at its next tool step, from the live fill', async ($, on) => {
    const w = world(on);
    await start($);
    await turnAt($, w, 40);
    fillNow = 57;
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
    fillNow = 68;
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

test("the coordinator's thread is 🍃 off by default: no notice and no ask", async ($, on) => {
    const w = world(on, '🦉 clio', undefined, undefined, 'coordinator');
    await start($);
    for (const fill of [70, 70]) await turnAt($, w, fill);
    expect([noticesOf(w.lines), w.store.has(`wind:${SID}`)]).toEqual([
        [],
        false,
    ]);
});

// 🍃 second-wind-auto (W1909–W1918): on for every thread, off for the coordinator's; 💨 afk or a shift turn hers on
const AUTO = `second-wind-auto:${SID}`;
const proposals = (lines: string[]) =>
    lines.filter((l) => l.includes('propose the wind to dima'));
const coordinator = (on: On) =>
    world(on, '🦉 clio', undefined, undefined, 'coordinator');
const band = ($: Engine) =>
    $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 120,
            hasSurvey: false,
            isCollapsed: false,
            isWorking: false,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface: 'desktop',
    });

test('🍃 off draws no notice and no ask', async ($, on) => {
    const w = world(on);
    w.store.set(AUTO, { at: NOW, on: false });
    await start($);
    for (const fill of [70, 70]) await turnAt($, w, fill);
    expect([noticesOf(w.lines), w.store.has(`wind:${SID}`)]).toEqual([
        [],
        false,
    ]);
});

test("the coordinator's thread with 🍃 off hears one line at 65 %, proposing the wind to dima", async ($, on) => {
    const w = coordinator(on);
    await start($);
    for (const fill of [56, 70, 71]) await turnAt($, w, fill);
    expect([proposals(w.lines).length, w.store.has(`wind:${SID}`)]).toEqual([
        1,
        false,
    ]);
});

test("💨 afk on turns the coordinator's 🍃 on at read time, and afk off shows the stored value again", async ($, on) => {
    const w = coordinator(on);
    w.store.set('afk', { at: NOW, on: true });
    await start($);
    await turnAt($, w, 56);
    w.store.set('afk', { at: NOW + 1, on: false });
    await turnAt($, w, 40);
    await turnAt($, w, 56);
    expect([noticesOf(w.lines).length, w.store.has(AUTO)]).toEqual([1, false]);
});

test("a shift turns the coordinator's 🍃 on, and its end turns it back", async ($, on) => {
    const w = coordinator(on);
    w.store.set(`pace:${SID}`, { since: NOW });
    await start($);
    await turnAt($, w, 56);
    w.store.delete(`pace:${SID}`);
    await turnAt($, w, 40);
    await turnAt($, w, 56);
    expect(noticesOf(w.lines)).toHaveLength(1);
});

test('a press during afk wins until the next afk on', async ($, on) => {
    const w = coordinator(on);
    w.store.set('afk', { at: NOW, on: true });
    w.store.set(AUTO, { at: NOW + 1, on: false });
    await start($);
    await turnAt($, w, 56);
    w.store.set('afk', { at: NOW + 2, on: true });
    await turnAt($, w, 40);
    await turnAt($, w, 56);
    expect(noticesOf(w.lines)).toHaveLength(1);
});

test('a press on the band 🍃 flips only this session', async ($, on) => {
    const w = world(on);
    w.store.set('second-wind-auto:other-sid', { at: NOW, on: true });
    await start($);
    const ui = await band($);
    await ui.press({ key: 'auto-wind' });
    expect([
        (w.store.get(AUTO) as { on?: boolean } | undefined)?.on,
        (w.store.get('second-wind-auto:other-sid') as { on?: boolean }).on,
    ]).toEqual([false, true]);
});

test("🍃 flipped off takes back the mod's pending ask, and keeps one dima pressed", async ($, on) => {
    const w = world(on);
    await start($);
    for (const fill of [70, 70]) await turnAt($, w, fill);
    w.store.set(`wind:${SID}`, { at: NOW, by: 'mod', state: 'asked' });
    const ui = await band($);
    await ui.press({ key: 'auto-wind' });
    const modGone = w.store.has(`wind:${SID}`);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await ui.press({ key: 'auto-wind' });
    await ui.press({ key: 'auto-wind' });
    expect([modGone, w.store.has(`wind:${SID}`)]).toEqual([false, true]);
});

test('🍃 flipped on past both lines still gives the notice first and the ask a turn later', async ($, on) => {
    const w = world(on);
    w.store.set(AUTO, { at: NOW, on: false });
    await start($);
    await turnAt($, w, 70);
    w.store.set(AUTO, { at: NOW + 1, on: true });
    await turnAt($, w, 70);
    const first = [noticesOf(w.lines).length, w.store.has(`wind:${SID}`)];
    await turnAt($, w, 70);
    expect([first, w.store.has(`wind:${SID}`)]).toEqual([[1, false], true]);
});

test('💨 afk on past the line the coordinator was proposed at still gives her the notice, then the ask a turn later', async ($, on) => {
    const w = coordinator(on);
    await start($);
    await turnAt($, w, 70);
    w.store.set('afk', { at: NOW + 1, on: true });
    await turnAt($, w, 70);
    const first = [noticesOf(w.lines).length, w.store.has(`wind:${SID}`)];
    await turnAt($, w, 70);
    expect([first, w.store.has(`wind:${SID}`)]).toEqual([[1, false], true]);
});

test("the coordinator's mod-asked wind note carries her checkpoint", async ($, on) => {
    const w = coordinator(on);
    w.store.set('afk', { at: NOW, on: true });
    await start($);
    for (const fill of [56, 70, 70]) await turnAt($, w, fill);
    const ask = notes(w.lines).find((l) =>
        l.startsWith('🐦‍🔥 second wind: the mod asks'),
    );
    expect([
        ask?.includes('clio:checkpoint'),
        ask?.includes('tell the fleet'),
    ]).toEqual([true, true]);
});

test('a reload after the notice turn still asks at the next turn', async ($, on) => {
    const w = world(on);
    w.store.set(`fill:${SID}`, { noticed: 1, windAt: 65 });
    await start($);
    await turnAt($, w, 70);
    expect(w.store.has(`wind:${SID}`)).toBe(true);
});

test('🍃 switched off in 🎛️ gives the coordinator no propose line', async ($, on) => {
    const w = coordinator(on);
    w.store.set('shown', { 'stash.second-wind-auto': false });
    await start($);
    for (const fill of [70, 70]) await turnAt($, w, fill);
    expect(proposals(w.lines)).toEqual([]);
});

test("a shift, then afk on, then afk off keeps the coordinator's 🍃 on while the shift lasts", async ($, on) => {
    const w = coordinator(on);
    w.store.set(`pace:${SID}`, { since: NOW });
    await start($);
    await turnAt($, w, 56);
    w.store.set('afk', { at: NOW + 1, on: true });
    await turnAt($, w, 40);
    w.store.set('afk', { at: NOW + 2, on: false });
    await turnAt($, w, 56);
    expect(noticesOf(w.lines)).toHaveLength(2);
});

test('afk on, then a press off, then afk off keeps the press', async ($, on) => {
    const w = coordinator(on);
    w.store.set('afk', { at: NOW, on: true });
    await start($);
    await turnAt($, w, 56);
    w.store.set(AUTO, { at: NOW + 1, on: false });
    await turnAt($, w, 40);
    w.store.set('afk', { at: NOW + 2, on: false });
    await turnAt($, w, 56);
    expect(noticesOf(w.lines)).toHaveLength(1);
});

test("a session first read past the wind line gets the notice first and the ask a turn later, whatever another session's mark holds", async ($, on) => {
    const w = world(on);
    w.store.set('fill:other-sid', { asked: 1, noticed: 1, windAt: 65 });
    await start($);
    await turnAt($, w, 72);
    const first = [noticesOf(w.lines).length, w.store.has(`wind:${SID}`)];
    await turnAt($, w, 72);
    expect([
        first,
        w.store.has(`wind:${SID}`),
        w.store.get('fill:other-sid'),
    ]).toEqual([[1, false], true, { asked: 1, noticed: 1, windAt: 65 }]);
});

test('a session that quits keeps its 🍃 press for a resume', async ($, on) => {
    const w = world(on);
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
    w.store.set(AUTO, { at: NOW, on: false });
    await start($);
    await $.session.end({ reason: 'other', sessionId: SID } as never);
    expect(w.store.get(AUTO)).toEqual({ at: NOW, on: false });
});

// the 🎛️ knobs: a moved line reads at the next poll, and only moves crossings after it; past the wind line + 5 the
// coordinator hears one overrun line
function sendsOf(on: On) {
    const sent: { text: string; to: unknown }[] = [];
    on('session.send', (_$, e) => {
        sent.push({ text: e.text, to: e.to });
        return { isDelivered: true };
    });
    return sent;
}
const askedByMod = (w: ReturnType<typeof world>) =>
    notes(w.lines).some((l) => l.startsWith('🐦‍🔥 second wind: the mod asks'));

test('a wind line lowered in 🎛️ asks at the next poll', async ($, on) => {
    const w = world(on);
    w.store.set('wind-notice', 45);
    w.store.set('wind-at', 50);
    await start($);
    for (const fill of [46, 51]) await turnAt($, w, fill);
    expect(askedByMod(w)).toBe(true);
});

test('the wind lowered to 45 with a session at 60 % writes no ask and no overrun line', async ($, on) => {
    const w = world(on);
    const sent = sendsOf(on);
    await start($);
    await turnAt($, w, 56);
    w.store.set('wind-notice', 40);
    w.store.set('wind-at', 45);
    for (const fill of [60, 60]) await turnAt($, w, fill);
    expect([w.store.has(`wind:${SID}`), sent]).toEqual([false, []]);
});

test('past the wind line + 5, the coordinator hears one overrun line, after the ask', async ($, on) => {
    const w = world(on);
    const sent = sendsOf(on);
    await start($);
    for (const fill of [66, 70]) await turnAt($, w, fill);
    const beforeAsk = sent.length;
    for (const fill of [71, 72]) await turnAt($, w, fill);
    expect([beforeAsk, sent]).toEqual([
        0,
        [
            {
                text: expect.stringMatching(/overrun.*71 %/),
                to: 'peer-1',
            },
        ],
    ]);
});

test("the overrun line never lands in the ask's own turn", async ($, on) => {
    const w = world(on);
    const sent = sendsOf(on);
    await start($);
    for (const fill of [66, 70]) await turnAt($, w, fill);
    fillNow = 76;
    await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    expect(sent).toEqual([]);
});

test("dima's take-back of the mod's ask sends no overrun line", async ($, on) => {
    const w = world(on);
    const sent = sendsOf(on);
    await start($);
    for (const fill of [66, 70]) await turnAt($, w, fill);
    w.store.delete(`wind:${SID}`);
    for (const fill of [71, 72]) await turnAt($, w, fill);
    expect(sent).toEqual([]);
});

test('a wind dima pressed and the session left standing past the line + 5 sends one overrun line', async ($, on) => {
    const w = world(on);
    const sent = sendsOf(on);
    await start($);
    await turnAt($, w, 60);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    for (const fill of [66, 71, 72]) await turnAt($, w, fill);
    expect(sent.map((s) => s.text)).toEqual([
        expect.stringMatching(/overrun.*71 %/),
    ]);
});

test("dima's take-back of his own press holds until the fill drops: the mod writes no ask at the same fill", async ($, on) => {
    const w = world(on);
    await start($);
    await turnAt($, w, 60);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await turnAt($, w, 70);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'cancelled' });
    for (const fill of [70, 70, 70]) await turnAt($, w, fill);
    expect(
        notes(w.lines).filter((l) =>
            l.startsWith('🐦‍🔥 second wind: the mod asks'),
        ),
    ).toHaveLength(0);
});

test('🍃 flipped off takes back the ask the mod wrote, after its note went out', async ($, on) => {
    const w = world(on);
    await start($);
    for (const fill of [70, 70, 70]) await turnAt($, w, fill);
    const was = (w.store.get(`wind:${SID}`) as { state?: string } | undefined)
        ?.state;
    const ui = await band($);
    await ui.press({ key: 'auto-wind' });
    expect([was, w.store.has(`wind:${SID}`)]).toEqual(['writing', false]);
});

test('the overrun line follows the wind knob', async ($, on) => {
    const w = world(on);
    const sent = sendsOf(on);
    w.store.set('wind-at', 60);
    await start($);
    for (const fill of [56, 61, 66]) await turnAt($, w, fill);
    expect(sent).toHaveLength(1);
});

test('with second wind switched off, no notice and no ask', async ($, on) => {
    const w = world(on);
    w.store.set('shown', { 'stash.second-wind': false });
    await start($);
    for (const fill of [70, 70]) await turnAt($, w, fill);
    expect([noticesOf(w.lines), w.store.has(`wind:${SID}`)]).toEqual([
        [],
        false,
    ]);
});

test('a session with no ingest command ingests its handoff through a plain prompt', async ($, on) => {
    const w = world(on);
    hasIngestCommand = false;
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect([
        w.commands.map((c) => c.split(' ')[0]),
        w.prompts.filter((p) => p.includes(`x handoff ingest ${SLUG} --for`))
            .length,
        w.store.has(`wind:${SID}`),
    ]).toEqual([['/compact'], 1, false]);
});

// the ingest refused: the toast reaches no one in a pane nobody watches
function refusedWind(on: On) {
    ingestRefusal = 'no ingest here';
    const sent: { text: string; to: unknown }[] = [];
    on('session.send', (_$, e) => {
        sent.push({ text: e.text, to: e.to });
        return { isDelivered: true };
    });
    return sent;
}

test('a stopped wind tells the coordinator in one line, naming the handoff kept in the store', async ($, on) => {
    const w = world(on);
    const sent = refusedWind(on);
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(sent).toEqual([
        {
            text: expect.stringMatching(
                new RegExp(
                    `second wind stopped.*${SLUG} is still in the store`,
                ),
            ),
            to: 'peer-1',
        },
    ]);
});

test('a compact that fails while its ingest runs tells the coordinator the handoff was ingested, and stops nothing', async ($, on) => {
    const w = world(on);
    const sent = sendsOf(on);
    compactRefusal = 'no compact here';
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect([sent, w.store.has(`wind:${SID}`)]).toEqual([
        [
            {
                text: expect.stringMatching(
                    new RegExp(`compact failed.*${SLUG} was ingested`),
                ),
                to: 'peer-1',
            },
        ],
        false,
    ]);
});

test('a handoff gone from the store before the compact stops the wind: no compact, the coordinator hears it', async ($, on) => {
    const kept = [SLUG];
    const w = world(on, undefined, kept);
    const sent = sendsOf(on);
    await start($);
    await ready($, SLUG);
    kept.length = 0;
    await endTurn($);
    await w.clock.advance(2_000);
    expect([
        w.commands,
        sent.map((s) => s.text),
        (w.store.get(`wind:${SID}`) as { state?: string }).state,
    ]).toEqual([
        [],
        [expect.stringMatching(new RegExp(`stopped.*${SLUG} left the store`))],
        'stopped',
    ]);
    await say($);
    expect(
        notes(w.lines).filter((l) => l.includes('write the handoff again')),
    ).toHaveLength(1);
});

test('a stopped wind keeps the session from reading idle on the board', async ($, on) => {
    const w = world(on);
    refusedWind(on);
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect((w.store.get(`wind:${SID}`) as { state?: string }).state).toBe(
        'stopped',
    );
});

test('a stopped wind tells the session once, at its next turn, how to ingest by hand', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'stopped' });
    await start($);
    await say($);
    await say($, 'again');
    expect([
        notes(w.lines).map((l) => l.includes(`x handoff ingest ${SLUG} --for`)),
        w.store.has(`wind:${SID}`),
    ]).toEqual([[true], false]);
});

test('the op tells the session to end its turn with no waiting line', async ($, on) => {
    world(on);
    await start($);
    expect((await ready($, SLUG)).result).toMatch(
        /end your turn now, with no «waiting on» line/,
    );
});

test('a turn end that lands during the compact starts no second one', async ($, on) => {
    const w = world(on, undefined, undefined, async () => {
        await endTurn($);
        await w.clock.advance(2_000);
    });
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands.filter((c) => c.startsWith('/compact'))).toHaveLength(1);
});

const compact = (
    $: Engine,
    trigger: 'auto' | 'manual' | 'plugin' | 'precompute',
) =>
    $.session.compact({
        messages: [{ role: 'user', text: 'hi', toolUses: [] }],
        trigger,
    } as never);

for (const state of ['asked', 'writing'] as const)
    test(`a threshold compact clears a wind left ${state}, so the board stops waiting`, async ($, on) => {
        const w = world(on);
        w.store.set(`wind:${SID}`, { at: NOW, state });
        await start($);
        await compact($, 'auto');
        expect(w.store.has(`wind:${SID}`)).toBe(false);
    });

test('a compact another hook skipped keeps the wind', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await start($);
    await $.session.compact({
        messages: [{ role: 'user', text: 'veto', toolUses: [] }],
        trigger: 'auto',
    } as never);
    expect(w.store.has(`wind:${SID}`)).toBe(true);
});

test('the compact a wind started clears its row, its ingest still queued', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'refreshing' });
    await start($);
    await compact($, 'plugin');
    expect(w.store.has(`wind:${SID}`)).toBe(false);
});

test('a refreshing row past 30 min clears at the next turn end', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW - 31 * 60_000, state: 'refreshing' });
    await start($);
    await endTurn($);
    expect(w.store.has(`wind:${SID}`)).toBe(false);
});

test('a compact keeps a wind that is refreshing, and a precompute keeps a writing one', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    await start($);
    await compact($, 'plugin');
    const kept = w.store.has(`wind:${SID}`);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'writing' });
    await compact($, 'precompute');
    expect([kept, w.store.has(`wind:${SID}`)]).toEqual([true, true]);
});

test('the op refuses with no pending field, and nothing compacts', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await ready($, SLUG, null);
    await endTurn($);
    await w.clock.advance(2_000);
    expect([r.deny?.includes('\n'), r.deny, w.commands]).toEqual([
        false,
        expect.stringContaining('pending is required'),
        [],
    ]);
});

test('the op refuses a pending that names work, saying what is pending, and nothing compacts', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await ready($, SLUG, 'two subagents still running');
    await endTurn($);
    await w.clock.advance(2_000);
    expect([r.deny, w.commands]).toEqual([
        expect.stringContaining('two subagents still running'),
        [],
    ]);
});

test('a wind held for named pending says the compact waits and the work does not', async ($, on) => {
    world(on);
    await start($);
    const r = await ready($, SLUG, 'a ci run');
    expect(r.deny).toMatch(
        /the compact waits, the work does not: do every step that run doesn't need/,
    );
});

for (const [who, isOwner] of [
    ['a codie', false],
    ['clio', true],
] as const)
    test(`${who}'s second wind note carries dima's words whole`, async ($, on) => {
        const w = world(
            on,
            isOwner ? '🦉 clio' : '☕️ 🔧 codie: mods',
            undefined,
            undefined,
            isOwner ? null : 'codie',
        );
        w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
        await start($);
        await say($);
        expect(notes(w.lines).join('\n')).toContain(DIMAS_WORDS);
    });

for (const [what, call] of [
    ['an agent', { tool: 'Agent' }],
    ['a watch', { command: 'tail -f ci.log', tool: 'Monitor' }],
    [
        'a background session with its flag last',
        { command: "claude -p 'work' --bg", tool: 'Bash' },
    ],
] as const)
    test(`${what} started after pending: none makes the wind refuse, and the next prompt says why`, async ($, on) => {
        const w = world(on);
        await start($);
        await ready($, SLUG);
        await $.tool.call(call as never);
        await endTurn($);
        await w.clock.advance(2_000);
        await say($);
        expect([
            w.commands.filter((c) => c.startsWith('/compact')),
            notes(w.lines).join('\n').includes('second wind refused'),
            w.store.has(`wind:${SID}`),
        ]).toEqual([[], true, false]);
    });

test('a background command started after pending: none does not block the wind', async ($, on) => {
    const w = world(on);
    await start($);
    await ready($, SLUG);
    await $.tool.call({
        command: 'sleep 90',
        run_in_background: true,
        tool: 'Bash',
    } as never);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands.filter((c) => c.startsWith('/compact'))).toHaveLength(1);
});

// the turn's own Stop lists what still runs; a watch is cc's `monitor` task, a background command its `shell` one
const stopWith = ($: Engine, type: string, description: string) =>
    $.classic.Stop({
        background_tasks: [{ description, id: 't1', status: 'running', type }],
        last_assistant_message: 'done.',
        session_id: SID,
        stop_hook_active: false,
    } as never);

test('a watch still running at the turn end holds the wind, naming it and its two doors', async ($, on) => {
    const w = world(on);
    await start($);
    await ready($, SLUG);
    await stopWith($, 'monitor', 'watch ci on #170');
    await endTurn($);
    await w.clock.advance(2_000);
    await say($);
    const said = notes(w.lines).join('\n');
    expect([
        w.commands.filter((c) => c.startsWith('/compact')),
        ['watch ci on #170', 'TaskStop', 'pending'].map((t) =>
            said.includes(t),
        ),
    ]).toEqual([[], [true, true, true]]);
});

test('a background command still running at the turn end does not hold the wind', async ($, on) => {
    const w = world(on);
    await start($);
    await ready($, SLUG);
    await stopWith($, 'shell', 'pnpm mods:test');
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands.filter((c) => c.startsWith('/compact'))).toHaveLength(1);
});

test('an agent started before pending: none does not block the wind', async ($, on) => {
    const w = world(on);
    await start($);
    await $.tool.call({ tool: 'Agent' } as never);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands.filter((c) => c.startsWith('/compact'))).toHaveLength(1);
});

test('a foreground command started after pending: none does not block the wind', async ($, on) => {
    const w = world(on);
    await start($);
    await ready($, SLUG);
    await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands.filter((c) => c.startsWith('/compact'))).toHaveLength(1);
});

// r5 (dima's o23): a coordinator's message to a codie past 55 % context waits for the codie's second wind
const CLIO = '🦉 clio';
// FRM-583: one held store, `held:<name>`, one entry per message id, for every reason a message waits; the old key's
// lists are read at the land, so a fixture planted under it still holds
const STORE = 'held:☕️🔧codie:mods';
const OLD_HELD = 'steer-held:☕️🔧codie:mods';
type Held = { isCompacted?: true; messages: { id: string; text: string }[] };
const receiveWorld = (on: On, name?: string, role = 'codie') => {
    const w = world(on, name, undefined, undefined, role);
    const queued: string[] = [];
    on('session.receive', (_$, e) => {
        queued.push(e.text);
        return { text: e.text };
    });
    return { ...w, queued };
};
// the socket is the sender's own, as cc writes it; the name is only what it signs with
const fromPeer = (
    $: Engine,
    body: string,
    from = CLIO,
    pid = PEERS.find((p) => p.name === from)?.pid ?? 1,
) =>
    $.session.receive({
        origin: { kind: 'peer' },
        text: `<cross-session-message from="uds:/tmp/cc-socks/${pid}.sock" from-name="${from}" from-mode="bypass">\n${body}\n</cross-session-message>`,
    }) as Promise<{ consumed?: string; text?: string }>;
const delivered = (lines: string[]) =>
    lines.filter((l) => l.startsWith('🐦‍🔥 held for your second wind'));

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

// r10 (dima's o62): a message held 10 min for a codie that has not wound tells its sender once; the hold stays
const sentWorld = (on: On, name?: string, role?: string) => {
    const w = receiveWorld(on, name, role);
    const sent: { to: unknown; text: string }[] = [];
    on('session.send', (_$, e) => {
        sent.push({ text: e.text, to: e.to });
        return { isDelivered: true };
    });
    return { ...w, sent };
};
const HELD_LINE =
    'your message to ☕️ 🔧 codie: mods is held: it is at 62 % and has not wound';

// dima's o141 (00:20, widened 00:24): a compact holds every message sent into the thread, from any sender, then hands
// them over whole and in order at its next turn
const SIXTH = '⚡ 🔎 sixth sense: mods';
const compactHeld = (lines: string[]) =>
    lines.filter((l) => l.startsWith('🌀 held while this thread compacted'));
for (const trigger of ['manual', 'auto'] as const)
    test(`a ${trigger} compact holds a message sent while it runs, and hands it over at the next turn`, async ($, on) => {
        const w = sentWorld(on);
        let r: { consumed?: string; text?: string } = {};
        inCompact = async () => {
            r = await fromPeer($, 'round 9 on abc1234', SIXTH);
        };
        await start($);
        await compact($, trigger);
        await say($, 'next');
        expect([
            r.consumed !== undefined,
            w.sent.map((s) => s.text),
            compactHeld(w.lines),
        ]).toEqual([
            true,
            [
                'held: ☕️ 🔧 codie: mods is compacting; your message joins its next turn',
                "delivered: your message joined ☕️ 🔧 codie: mods's first turn after its compact",
            ],
            [
                `🌀 held while this thread compacted, delivered now — ${SIXTH} (untagged): round 9 on abc1234`,
            ],
        ]);
    });

test('a message held during a wind follows the ingest as a prompt of its own, so an idle session reads it', async ($, on) => {
    const w = sentWorld(on);
    await start($);
    await ready($, SLUG);
    w.store.set(OLD_HELD, {
        isCompacted: true,
        steers: [
            {
                at: NOW,
                from: SIXTH,
                isCompact: true,
                text: 'round 9 on abc1234',
            },
        ],
    });
    await endTurn($);
    await w.clock.advance(2_000);
    expect([
        w.prompts.filter((p) =>
            p.startsWith('🌀 held while this thread compacted, delivered now'),
        ),
        w.store.has(STORE),
    ]).toEqual([
        [
            `🌀 held while this thread compacted, delivered now — ${SIXTH} (untagged): round 9 on abc1234`,
        ],
        false,
    ]);
});

test("a coordinator's push to a codie under 55 % mid-compact is held too", async ($, on) => {
    const w = sentWorld(on);
    let r: { consumed?: string; text?: string } = {};
    inCompact = async () => {
        r = await fromPeer($, '[done] the gate is green');
    };
    w.store.set(`context:${SID}`, 30);
    await start($);
    await compact($, 'auto');
    await say($, 'next');
    expect([r.consumed !== undefined, compactHeld(w.lines)]).toEqual([
        true,
        [
            `🌀 held while this thread compacted, delivered now — ${CLIO} (done): [done] the gate is green`,
        ],
    ]);
});

test('a session at 🌀 holds every message until the compact, in the order sent', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    await start($);
    const a = await fromPeer($, '[ask] a or b?', SIXTH);
    const b = await fromPeer($, 'for dima: look at #9');
    await say($, 'before the compact');
    const held = (lines: string[]) =>
        lines.filter((l) => /^(🌀|🐦‍🔥) held /u.test(l));
    const before = held(w.lines);
    await compact($, 'plugin');
    await say($, 'the ingest', 'skill');
    // clio's message meets r5 first, which holds it for the codie's wind; the sixth sense's, which r5 never takes, the compact
    expect([
        a.consumed !== undefined,
        b.consumed !== undefined,
        before,
        held(w.lines),
    ]).toEqual([
        true,
        true,
        [],
        [
            `🌀 held while this thread compacted, delivered now — ${SIXTH} (ask): [ask] a or b?`,
            `🐦‍🔥 held for your second wind, delivered now — ${CLIO} (for-dima): for dima: look at #9`,
        ],
    ]);
});

test("clio's own thread at 🌀 holds a member's [done]", async ($, on) => {
    const w = receiveWorld(on, CLIO, 'coordinator');
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    await start($);
    const r = await fromPeer($, '[done] final on abc1234', SIXTH);
    await compact($, 'plugin');
    await say($, 'the ingest', 'skill');
    expect([r.consumed !== undefined, compactHeld(w.lines)]).toEqual([
        true,
        [
            `🌀 held while this thread compacted, delivered now — ${SIXTH} (done): [done] final on abc1234`,
        ],
    ]);
});

// FRM-597: helga's 13:13 — an auto-compact mid-turn, then idle, and the held message waited 22 min for a prompt
const heldPrompts = (prompts: string[]) =>
    prompts.filter((p) => p.includes('🌀 held while this thread compacted'));
for (const isWindOn of [true, false])
    test(`a compact mid-turn hands its held message to the idle session within 10 s of the turn's end, once${isWindOn ? '' : ', second wind off'}`, async ($, on) => {
        const w = sentWorld(on);
        if (!isWindOn) w.store.set('shown', { 'stash.second-wind': false });
        inCompact = async () => {
            await fromPeer($, 'round 9 on abc1234', SIXTH);
        };
        await start($);
        await say($, 'work');
        await compact($, 'auto');
        await w.clock.advance(5_000);
        const midTurn = heldPrompts(w.prompts).length;
        await endTurn($);
        await w.clock.advance(10_000);
        const afterEnd = heldPrompts(w.prompts);
        await w.clock.advance(20 * 60_000);
        expect([midTurn, afterEnd, heldPrompts(w.prompts).length]).toEqual([
            0,
            [
                `🌀 held while this thread compacted, delivered now — ${SIXTH} (untagged): round 9 on abc1234`,
            ],
            1,
        ]);
    });

test('an idle /compact hands its held message over within 10 s of its end, once', async ($, on) => {
    const w = sentWorld(on);
    inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
    };
    await start($);
    await compact($, 'manual');
    await w.clock.advance(10_000);
    const first = heldPrompts(w.prompts).length;
    await say($, 'his next prompt');
    await w.clock.advance(20 * 60_000);
    expect([
        first,
        heldPrompts(w.prompts).length,
        compactHeld(w.lines),
    ]).toEqual([1, 1, []]);
});

test('two messages and a push held through one compact go in once, in order, and each sender hears held, then delivered', async ($, on) => {
    const w = sentWorld(on);
    inCompact = async () => {
        await fromPeer($, '[ask] a or b?', SIXTH);
        await fromPeer($, '[done] the gate is green');
    };
    await start($);
    await compact($, 'auto');
    await w.clock.advance(10_000);
    await w.clock.advance(20 * 60_000);
    expect([heldPrompts(w.prompts), w.sent]).toEqual([
        [
            [
                `🌀 held while this thread compacted, delivered now — ${SIXTH} (ask): [ask] a or b?`,
                `🌀 held while this thread compacted, delivered now — ${CLIO} (done): [done] the gate is green`,
            ].join('\n'),
        ],
        [
            {
                text: 'held: ☕️ 🔧 codie: mods is compacting; your message joins its next turn',
                to: 'uds:/tmp/cc-socks/3.sock',
            },
            {
                text: 'held: ☕️ 🔧 codie: mods is compacting; your message joins its next turn',
                to: 'uds:/tmp/cc-socks/1.sock',
            },
            {
                text: "delivered: your message joined ☕️ 🔧 codie: mods's first turn after its compact",
                to: 'uds:/tmp/cc-socks/3.sock',
            },
            {
                text: "delivered: your message joined ☕️ 🔧 codie: mods's first turn after its compact",
                to: 'uds:/tmp/cc-socks/1.sock',
            },
        ],
    ]);
});

// wisphunter on 6e7afec4: a 🌀 row left when second wind went off held every message, and no compact ever released it
test('second wind off, a 🌀 row left behind holds nothing', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set('shown', { 'stash.second-wind': false });
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    await start($);
    const r = await fromPeer($, 'round 9 on abc1234', SIXTH);
    expect([r.consumed, r.text?.includes('round 9 on abc1234')]).toEqual([
        undefined,
        true,
    ]);
});

test('a release the engine refuses keeps the held message for the next one', async ($, on) => {
    const w = sentWorld(on);
    inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
    };
    await start($);
    submitRefusal = 'busy';
    await compact($, 'manual');
    await w.clock.advance(10_000);
    const kept = (w.store.get(STORE) as Held).messages.length;
    submitRefusal = undefined;
    await say($, 'his prompt');
    expect([kept, compactHeld(w.lines).length, w.sent.length]).toEqual([
        1, 1, 2,
    ]);
});

test('a sender told its r5 hold outlived 10 min hears no «after its compact» when no compact ran', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    await w.clock.advance(10 * 60_000);
    w.store.set('shown', { 'stash.second-wind': false });
    await say($, 'his prompt');
    expect([delivered(w.lines).length, w.sent]).toEqual([
        1,
        [{ text: HELD_LINE, to: 'uds:/tmp/cc-socks/1.sock' }],
    ]);
});

test('a prompt inside the settle window takes the held message, and no release follows', async ($, on) => {
    const w = sentWorld(on);
    inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
    };
    await start($);
    await compact($, 'manual');
    await say($, 'his prompt');
    await w.clock.advance(20 * 60_000);
    expect([
        compactHeld(w.lines).length,
        heldPrompts(w.prompts),
        w.sent.map((m) => m.text.split(':')[0]),
    ]).toEqual([1, [], ['held', 'delivered']]);
});

// sixth sense round 9 on 59feb7c8: a compact whose process died never cleared its key; past COMPACT_MAX_MS it holds nothing
test('a compact key left by a dead process holds nothing past its bound', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`compacting:${SID}`, NOW - 20 * 60_000);
    await start($);
    const r = await fromPeer($, 'round 9 on abc1234', SIXTH);
    expect([r.consumed, r.text?.includes('round 9 on abc1234')]).toEqual([
        undefined,
        true,
    ]);
});

test('a refused wind holds nothing: nothing compacts', async ($, on) => {
    const w = receiveWorld(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refused' });
    await start($);
    const r = await fromPeer($, 'round 9 on abc1234', SIXTH);
    expect([r.consumed, r.text?.includes('round 9 on abc1234')]).toEqual([
        undefined,
        true,
    ]);
});

test('a message held 10 min for a codie that has not wound tells its sender once, and the hold stays', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    await w.clock.advance(9 * 60_000);
    const early = w.sent.length;
    await w.clock.advance(60_000);
    await w.clock.advance(20 * 60_000);
    expect([
        early,
        w.sent,
        (w.store.get(STORE) as Held).messages.length,
    ]).toEqual([0, [{ text: HELD_LINE, to: 'uds:/tmp/cc-socks/1.sock' }], 1]);
});

test('a codie that wound inside the 10 min tells no sender', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    await compact($, 'plugin');
    await w.clock.advance(11 * 60_000);
    expect(w.sent).toEqual([]);
});

test('a hold kept across a reload still tells its sender at 10 min', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    w.store.set(OLD_HELD, {
        steers: [
            {
                at: NOW - 9 * 60_000,
                from: CLIO,
                reply: 'uds:/tmp/cc-socks/1.sock',
                text: 'next: r6',
            },
        ],
    });
    w.store.set(`wind:${SID}`, { at: NOW - 9 * 60_000, state: 'writing' });
    await start($);
    await w.clock.advance(60_000);
    expect(w.sent).toEqual([
        { text: HELD_LINE, to: 'uds:/tmp/cc-socks/1.sock' },
    ]);
});

test('each held message tells its own sender at its own 10 min', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'one');
    await w.clock.advance(5 * 60_000);
    await $.session.receive({
        origin: { kind: 'peer' },
        text: '<cross-session-message from="uds:/tmp/cc-socks/2.sock" from-name="🦉🪽 clio: wing 1" from-mode="bypass">\ntwo\n</cross-session-message>',
    });
    await w.clock.advance(5 * 60_000);
    const first = w.sent.map((s) => s.to);
    await w.clock.advance(5 * 60_000);
    expect([first, w.sent.map((s) => s.to)]).toEqual([
        ['uds:/tmp/cc-socks/1.sock'],
        ['uds:/tmp/cc-socks/1.sock', 'uds:/tmp/cc-socks/2.sock'],
    ]);
});

// wisphunter on 990334f5: the tell wrote back its first read after the sends, so a delivery meanwhile came back
test('a hold delivered while its sender is told stays delivered', async ($, on) => {
    const w = receiveWorld(on);
    on('session.send', () => {
        w.store.delete(STORE);
        return { isDelivered: true };
    });
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    await w.clock.advance(10 * 60_000);
    expect(w.store.has(STORE)).toBe(false);
});

test('a compact holds its message in the one store, keyed by its id', async ($, on) => {
    const w = sentWorld(on);
    let held: Held | undefined;
    inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
        held = w.store.get(STORE) as Held | undefined;
    };
    await start($);
    await compact($, 'manual');
    expect([
        held?.messages.map((m) => [typeof m.id, m.text]),
        w.store.has(OLD_HELD),
    ]).toEqual([[['string', 'round 9 on abc1234']], false]);
});

test("the old stores are read at the land: a compact's and quiet's held lists each go in once, and both keys go", async ($, on) => {
    const w = receiveWorld(on, CLIO, 'coordinator');
    w.store.set('steer-held:🦉clio', {
        steers: [{ at: NOW, from: SIXTH, isCompact: true, text: 'round 9' }],
    });
    w.store.set(`quiet-held:${SID}`, [
        { at: NOW, from: SIXTH, tag: 'progress', text: 'step 2 landed' },
    ]);
    await start($);
    await say($, 'next');
    await say($, 'and next');
    const all = w.lines.join('\n');
    expect([
        all.split('round 9').length - 1,
        all.split('step 2 landed').length - 1,
        w.store.has('steer-held:🦉clio'),
        w.store.has(`quiet-held:${SID}`),
    ]).toEqual([1, 1, false, false]);
});

// exit 2: a member ping quiet comms holds while clio's thread compacts goes in once, by quiet's own release
const QUIET_PING = '[progress] step 2 landed';
const quietSeen = (w: ReturnType<typeof receiveWorld>) =>
    [...w.lines, ...w.prompts, ...w.appended].join('\n').split('step 2 landed')
        .length - 1;
test('a ping quiet held before the compact is never appended mid-compact, and goes in once after it', async ($, on) => {
    const w = receiveWorld(on, CLIO, 'coordinator');
    // a wait shorter than a compact's longest run, so it passes inside the compact
    w.store.set('quiet-wait', 2);
    let midCompact = -1;
    inCompact = async () => {
        await w.clock.advance(3 * 60_000);
        midCompact = w.appended.length;
    };
    await start($);
    const r = await fromPeer($, QUIET_PING, SIXTH);
    await compact($, 'manual');
    await w.clock.advance(10_000);
    await say($, 'next');
    await w.clock.advance(20 * 60_000);
    expect([r.consumed !== undefined, midCompact, quietSeen(w)]).toEqual([
        true,
        0,
        1,
    ]);
});

for (const isPrompt of [true, false])
    test(`a ping sent into clio's compact is held by quiet comms, starts no turn, and goes in once at ${isPrompt ? 'her next prompt' : 'the idle append'}`, async ($, on) => {
        const w = sentWorld(on, CLIO, 'coordinator');
        inCompact = async () => {
            await fromPeer($, QUIET_PING, SIXTH);
        };
        await start($);
        await compact($, 'manual');
        await w.clock.advance(10_000);
        const turns = w.prompts.length;
        if (isPrompt) await say($, 'next');
        await w.clock.advance(20 * 60_000);
        expect([turns, quietSeen(w), w.sent]).toEqual([0, 1, []]);
    });

// exit 3: every role's compact hands two messages, a push among them, to its first turn after, in order, once each
for (const [name, role] of [
    [undefined, 'codie'],
    [SIXTH, 'sixth-sense'],
    [CLIO, 'coordinator'],
    ['🦉🪽 clio: wing 1', 'wing'],
] as const)
    test(`a ${role} mid-compact takes a ping and a push, sent in that order, in its first turn after, once each`, async ($, on) => {
        const w = receiveWorld(on, name, role);
        inCompact = async () => {
            await fromPeer($, 'round 9 on abc1234', SENSE_NAMES[1]);
            await fromPeer($, '[done] the gate is green');
        };
        await start($);
        await compact($, 'manual');
        await w.clock.advance(10_000);
        await w.clock.advance(20 * 60_000);
        const all = [...w.lines, ...w.prompts, ...w.appended].join('\n');
        const at = (s: string) => [all.indexOf(s), all.split(s).length - 1];
        const [ping, push] = [
            at('round 9 on abc1234'),
            at('the gate is green'),
        ];
        expect([ping[1], push[1], (ping[0] ?? 0) < (push[0] ?? 0)]).toEqual([
            1,
            1,
            true,
        ]);
    });

// sixth sense's P2s on 1fea2c06: a release timer a reload dropped, a refused release with no prompt behind it
test('a start with a compact-held list and no turn running releases it', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(STORE, {
        isCompacted: true,
        messages: [
            {
                at: NOW,
                from: SIXTH,
                id: 'a1',
                isCompact: true,
                text: 'round 9 on abc1234',
            },
        ],
    });
    await start($);
    await w.clock.advance(5_000);
    expect(heldPrompts(w.prompts)).toEqual([
        `🌀 held while this thread compacted, delivered now — ${SIXTH} (untagged): round 9 on abc1234`,
    ]);
});

test('a refused release tries again, so an idle session with no next prompt still reads it', async ($, on) => {
    const w = sentWorld(on);
    inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
    };
    await start($);
    submitRefusal = 'busy';
    await compact($, 'manual');
    await w.clock.advance(10_000);
    submitRefusal = undefined;
    await w.clock.advance(60_000);
    expect(heldPrompts(w.prompts).length).toBe(1);
});

// FRM-583 exit 1: every hold names a held message's kind from the one list
const KINDS: readonly string[] = MESSAGE_KINDS.map((k) => k.kind);
const kindsIn = (text: string) =>
    [...text.matchAll(/ \(([\w-]+)\): /g)].map((m) => m[1] ?? '');
const TWINS = [
    ['round 9 on abc1234', 'untagged'],
    ['[progress] step 2 landed', 'progress'],
    ['for dima: a or b', 'for-dima'],
    ['[ask] a or b?', 'ask'],
] as const;

test('the kinds list names each kind once, and every kind says how it reads and what it does', () => {
    expect([
        new Set(KINDS).size === KINDS.length,
        MESSAGE_KINDS.every((k) => k.reads.length > 0 && k.does.length > 0),
    ]).toEqual([true, true]);
});

for (const body of [
    '',
    '[ask]',
    '🪜 [escalate] stuck',
    '[🪜 escalate] stuck',
    '[progress] sw done\nfor dima: a or b',
    '`for dima` in code',
    '[Ask] a?',
    '[done',
    'waiting on dima',
    '[progress]',
])
    test(`a message reads as a kind on the list: ${JSON.stringify(body)}`, () => {
        expect(KINDS).toContain(messageKind(body));
    });

test('a compact names each held message by its kind from the list', async ($, on) => {
    const w = sentWorld(on);
    inCompact = async () => {
        for (const [body] of TWINS) await fromPeer($, body, SIXTH);
    };
    await start($);
    await compact($, 'manual');
    await w.clock.advance(10_000);
    const kinds = kindsIn(heldPrompts(w.prompts).join('\n'));
    expect([kinds, kinds.every((k) => KINDS.includes(k))]).toEqual([
        TWINS.map(([, kind]) => kind),
        true,
    ]);
});

test("a wind's held message names its kind from the list", async ($, on) => {
    const w = sentWorld(on);
    w.store.set(`context:${SID}`, 62);
    await start($);
    await fromPeer($, 'next: r6');
    await fromPeer($, '[progress] the gate is green');
    w.store.set('shown', { 'stash.second-wind': false });
    await say($, 'his prompt');
    expect(kindsIn(delivered(w.lines).join('\n'))).toEqual([
        'untagged',
        'progress',
    ]);
});

test('quiet comms name each held ping by its kind, a push kind switched off kept as its kind', async ($, on) => {
    const w = sentWorld(on, CLIO, 'coordinator');
    w.store.set('quiet-ask', false);
    await start($);
    for (const [body] of TWINS) await fromPeer($, body, SIXTH);
    await say($, 'next');
    expect(
        kindsIn(
            w.lines
                .filter((l) => l.startsWith('🤫 quiet comms'))
                .join('\n')
                .replaceAll(/^- \d\d:\d\d /gm, ' '),
        ),
    ).toEqual(['untagged', 'progress', 'ask']);
});

// FRM-583 exit 4: a compact's held message no turn takes inside the deadline never ends in silence
const WAITING_LINE =
    'held, waiting: ☕️ 🔧 codie: mods has taken no turn since its compact; your message joins its next turn';
const waitOf = (w: ReturnType<typeof sentWorld>) =>
    (w.store.get(`reply:${SID}`) as { wait?: string } | undefined)?.wait;

test('a compact-held message no turn takes in 10 min tells its sender «held, waiting» once, and the thread shows waiting', async ($, on) => {
    const w = sentWorld(on);
    inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
    };
    await start($);
    submitRefusal = 'busy';
    await compact($, 'manual');
    await w.clock.advance(9 * 60_000);
    const early = w.sent.length;
    await w.clock.advance(2 * 60_000);
    await w.clock.advance(20 * 60_000);
    expect([
        early,
        w.sent.map((s) => s.text),
        waitOf(w)?.startsWith('waiting: held messages'),
    ]).toEqual([
        1,
        [
            'held: ☕️ 🔧 codie: mods is compacting; your message joins its next turn',
            WAITING_LINE,
        ],
        true,
    ]);
});

test('a compact-held message a turn takes inside the deadline tells no one it waits', async ($, on) => {
    const w = sentWorld(on);
    inCompact = async () => {
        await fromPeer($, 'round 9 on abc1234', SIXTH);
    };
    await start($);
    await compact($, 'manual');
    await w.clock.advance(30 * 60_000);
    expect([w.sent.map((s) => s.text.split(':')[0]), waitOf(w)]).toEqual([
        ['held', 'delivered'],
        undefined,
    ]);
});

test('a reload re-arms the deadline of a compact-held message', async ($, on) => {
    const w = sentWorld(on);
    w.store.set(STORE, {
        isCompacted: true,
        messages: [
            {
                at: NOW,
                from: SIXTH,
                id: 'a1',
                isCompact: true,
                isTold: true,
                reply: 'uds:/tmp/cc-socks/3.sock',
                text: 'round 9 on abc1234',
            },
        ],
    });
    submitRefusal = 'busy';
    await start($);
    await w.clock.advance(11 * 60_000);
    expect(w.sent).toEqual([
        { text: WAITING_LINE, to: 'uds:/tmp/cc-socks/3.sock' },
    ]);
});
