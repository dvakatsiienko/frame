import type { On } from 'claude-code';

import { TITLED } from './orbit-helpers.ts';
import {
    add,
    board,
    endTurn,
    orbit,
    start as orbitStart,
    world as orbitWorld,
    say,
} from './orbit-world.ts';
import { type Engine, expect, mock, test } from './shared-boot.ts';
import {
    SLUG,
    SID as WIND_SID,
    ready,
    turnAt,
    compact as windCompact,
    endTurn as windEnd,
    say as windSay,
    world as windWorld,
} from './wind-world.ts';

// 📊 the turn log (FRM-639 slice A): one row per main turn, its starter, its joined acts counted once, its keys a
// closed list; the switch off writes nothing

const SID = 't0g0t0g0-turnlog';
const PID = 6161;
const NOW = Date.UTC(2026, 10, 26, 12, 0);
const ROOT = '/home/.claude/shelf/events';
const MARK = 'MARKED-7f3a';
const KEYS = [
    'answerLen',
    'asksOpened',
    'cards',
    'ctx',
    'end',
    'ended',
    'herdrJoins',
    'isQueued',
    'pid',
    'pingsJoined',
    'prevEnd',
    'reason',
    'sid',
    'start',
    'starter',
    'ticks',
    'tools',
    'turnId',
    'typedJoined',
    'wind',
    'windAsked',
];

function world(
    on: On,
    store: Record<string, unknown> = {},
    refuse?: (text: string) => Refusal | undefined,
) {
    const clock = mock.clock(on, { now: NOW });
    mock.store(on, store);
    const files: Record<string, string> = {};
    const trashed: string[][] = [];
    on('session.id', () => ({ value: SID }));
    on('session.cwd', () => ({ value: '/tmp' }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.usage', () => ({
        value: {
            context: { percent: 42 } as never,
            rateLimits: [],
            startedAt: NOW,
        },
    }));
    on('env.get', () => ({ value: '/home' }));
    on('process.run', (_$, e) => {
        if (e.argv[0] === 'trash') trashed.push(e.argv.slice(1));
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: `${PID}\nThu Nov 26 12:00:00 2026\n`,
            },
        };
    });
    on('fs.write', (_$, e) => {
        files[e.path] = e.text;
        return { value: undefined };
    });
    on('fs.read', (_$, e) =>
        e.path in files ? { value: files[e.path] ?? '' } : { deny: 'ENOENT' },
    );
    on('fs.list', (_$, e) => ({
        value:
            e.path === ROOT
                ? ['2026-10-26', '2026-10-27', 'open'].map((name) => ({
                      isLink: false,
                      kind: 'dir' as const,
                      mtimeMs: 0,
                      name,
                      size: 1,
                  }))
                : [],
    }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('prompt.submit', (_$, e) => {
        const r = refuse?.(e.text);
        if (r && 'throw' in r) throw new Error('refused');
        return r ? { drop: r.drop } : { text: e.text };
    });
    on('turn.start', (_$, e) => ({ turnId: e.turnId }));
    on('turn.complete', () => ({ text: '' }));
    on('session.compact', (_$, e) => ({ messages: e.messages }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    on('agent.spawn', (_$, e) =>
        e.description.includes('refused')
            ? { deny: 'no' }
            : { agentId: `a-${e.tool_use_id}`, model: 'm' },
    );
    const rows = () =>
        Object.entries(files)
            .filter(([p]) => p.startsWith(`${ROOT}/2`))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, t]) => JSON.parse(t) as Record<string, unknown>);
    return { clock, files, rows, trashed };
}

async function start($: Engine) {
    await $.session.start({ cwd: '/tmp', isInteractive: true, surface: null });
}
function type($: Engine, text: string, turnId?: string) {
    return $.prompt.submit({
        origin: { kind: 'composer' },
        text,
        wait: false,
        ...(turnId ? { turnId } : {}),
    });
}
function ping($: Engine, text: string, turnId?: string) {
    return $.prompt.submit({
        isMeta: true,
        origin: { kind: 'peer' },
        text,
        wait: false,
        ...(turnId ? { turnId } : {}),
    });
}
function begin($: Engine, turnId: string, text = '') {
    return $.turn.start({ text, turnId });
}
function end(
    $: Engine,
    turnId: string,
    reason: 'answer' | 'aborted' | 'error' = 'answer',
) {
    return $.turn.complete({
        answer: 'done',
        durationMs: 5_000,
        isAborted: reason === 'aborted',
        reason,
        turnId,
    });
}
function deliver($: Engine, kind: 'composer' | 'peer' | 'task-notification') {
    return $.session.append({
        door: 'delivery',
        message: {
            content: [{ text: 'joined', type: 'text' }],
            role: 'user',
            type: 'user',
        },
        origin: { kind },
        uuid: `u-${kind}`,
    } as never);
}
function spawn($: Engine, type: string, id: string, extra = {}) {
    return $.agent.spawn({
        background: true,
        description: id,
        fork: false,
        parentModel: 'm',
        prompt: 'go',
        subagentType: type,
        tool_use_id: id,
        ...extra,
    } as never);
}

test('his typed prompt is one row, named typed, its keys the closed list, with an open stamp', async ($, on) => {
    const w = world(on);
    await start($);
    await type($, 'hello');
    await begin($, 't1', 'hello');
    await w.clock.advance(5_000);
    await end($, 't1');
    const [row, ...rest] = w.rows();
    expect([
        Object.keys(row ?? {}).sort(),
        row?.starter,
        row?.ctx,
        row?.pid,
        rest.length,
        JSON.parse(w.files[`${ROOT}/open/${SID}.json`] ?? '{}').turnId,
    ]).toEqual([KEYS, 'typed', 42, PID, 0, 't1']);
});

test("a prompt and a ping delivered into the running turn count once on it, never on the next, and a task's notice is neither", async ($, on) => {
    const w = world(on);
    await start($);
    await type($, 'go');
    await begin($, 't1');
    await type($, 'and this', 't1');
    await deliver($, 'composer');
    await ping($, 'a ping', 't1');
    await deliver($, 'peer');
    await deliver($, 'task-notification');
    await end($, 't1');
    await w.clock.advance(1_000);
    await ping($, 'later');
    await begin($, 't2');
    await end($, 't2');
    expect(
        w.rows().map((r) => [r.starter, r.typedJoined, r.pingsJoined]),
    ).toEqual([
        ['typed', 1, 1],
        ['member', 0, 0],
    ]);
});

test('a prompt queued under a running turn that starts the next one is that turn, a slipstream', async ($, on) => {
    const w = world(on);
    await start($);
    await type($, 'go');
    await begin($, 't1');
    await type($, 'queued', 't1');
    await end($, 't1');
    await w.clock.advance(100);
    await begin($, 't2', 'queued');
    await end($, 't2');
    expect(w.rows().map((r) => [r.starter, r.isQueued, r.typedJoined])).toEqual(
        [
            ['typed', false, 0],
            ['typed', true, 0],
        ],
    );
});

test("an aborted turn's join is not counted, and its row says aborted", async ($, on) => {
    const w = world(on);
    await start($);
    await type($, 'go');
    await begin($, 't1');
    await type($, 'more', 't1');
    await deliver($, 'composer');
    await end($, 't1', 'aborted');
    expect(w.rows().map((r) => [r.ended, r.typedJoined])).toEqual([
        ['aborted', 0],
    ]);
});

test('a turn no prompt explains reads unknown, and a card spawned between turns lands on the next row', async ($, on) => {
    const w = world(on);
    await start($);
    await spawn($, 'scout', 'c1');
    await begin($, 't1');
    await spawn($, 'helper', 'c2');
    await spawn($, 'someone-new', 'c3');
    await spawn($, 'helper', 'c4 refused');
    await spawn($, 'helper', 'c5', { resume: { agentId: 'a-c2' } });
    await end($, 't1');
    const [row] = w.rows();
    expect([row?.starter, row?.cards]).toEqual([
        'unknown',
        { helper: 1, other: 1, scout: 1 },
    ]);
});

test('a reload mid-turn keeps the row whole: its counts come back from $.state', async ($, on) => {
    const w = world(on);
    await start($);
    await type($, 'go');
    await begin($, 't1');
    await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    await $.tool.call({ command: 'pwd', tool: 'Bash' } as never);
    // the reload: module memory gone, turn.complete before the fresh session.start
    await $.session
        .end({
            reason: 'other',
            resume: { id: SID },
            sessionId: SID,
        } as never)
        .catch(() => undefined);
    await end($, 't1');
    const [row] = w.rows();
    expect([row?.starter, row?.tools]).toEqual(['typed', 2]);
});

test('no row holds his prompt, a tool argument or a path', async ($, on) => {
    const w = world(on);
    await start($);
    await type($, `please ${MARK}`);
    await begin($, 't1', `please ${MARK}`);
    await $.tool.call({ command: `echo ${MARK}`, tool: 'Bash' } as never);
    await $.tool.call({ file_path: `/tmp/${MARK}.md`, tool: 'Read' } as never);
    await spawn($, 'helper', `brief ${MARK}`);
    await end($, 't1');
    const written = Object.entries(w.files)
        .filter(([p]) => p.startsWith(ROOT))
        .map(([, t]) => t)
        .join('\n');
    expect([w.rows().length, written.includes(MARK)]).toEqual([1, false]);
});

test('📊 switched off, a turn writes no row and no open stamp', async ($, on) => {
    const w = world(on, { shown: { 'stash.events': false } });
    await start($);
    await type($, 'go');
    await begin($, 't1');
    await end($, 't1');
    expect(Object.keys(w.files).filter((p) => p.startsWith(ROOT))).toEqual([]);
});

test('a keep-hot ping is its own turn, started by the mod for keep-hot', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 100,
            hasSurvey: false,
            isCollapsed: false,
            isWorking: false,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface: 'desktop',
    });
    await ui.press({ key: 'hot' });
    await end($, 't0');
    await w.clock.advance(50 * 60_000);
    await begin($, 't1');
    await end($, 't1');
    expect(w.rows().map((r) => [r.starter, r.reason])).toEqual([
        ['unknown', null],
        ['mod', 'keep-hot'],
    ]);
});

test('a tick his prompt took is on its turn: its pick, no steer, the seconds it waited', async ($, on) => {
    const w = orbitWorld(on);
    const files: Record<string, string> = {};
    on('fs.write', (_$, e) => {
        files[e.path] = e.text;
        return { value: undefined };
    });
    on('env.get', () => ({ value: '/home' }));
    on('turn.start', (_$, e) => ({ turnId: e.turnId }));
    await orbitStart($);
    await add($, ['push it', 'yes']);
    const ui = await board($);
    await w.clock.advance(90_000);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    await $.turn.start({ text: 'go', turnId: 't' });
    await endTurn($);
    const rows = Object.entries(files)
        .filter(([p]) => p.startsWith(`${ROOT}/2`))
        .map(([, t]) => JSON.parse(t) as { ticks: unknown });
    expect(rows.map((r) => r.ticks)).toEqual([
        [{ isSteer: false, pick: 'tick', waitS: 90 }],
    ]);
});

test('a schedule, a summon, a task and a command a mod ran each name their starter; an ingest is the wind', async ($, on) => {
    const w = world(on);
    await start($);
    const origins = [
        { origin: { kind: 'scheduled-trigger' } },
        { origin: { kind: 'sdk' } },
        { origin: { kind: 'task-notification' } },
        { command: { name: 'board' }, origin: { kind: 'plugin' } },
        { command: { name: 'x:handoff-ingest' }, origin: { kind: 'plugin' } },
    ];
    for (const [i, o] of origins.entries()) {
        await $.prompt.submit({ text: 'go', wait: false, ...o } as never);
        await begin($, `t${i}`);
        await w.clock.advance(1_000);
        await end($, `t${i}`);
    }
    expect(w.rows().map((r) => [r.starter, r.reason])).toEqual([
        ['schedule', null],
        ['summon', null],
        ['task', null],
        ['mod', 'command'],
        ['mod', 'wind'],
    ]);
});

test("an errored turn counts no join, the join it hands back lands on the next turn, and that row's prevEnd is the last end", async ($, on) => {
    const w = world(on);
    await start($);
    await type($, 'go');
    await begin($, 't1');
    await type($, 'more', 't1');
    await deliver($, 'composer');
    await ping($, 'a ping', 't1');
    await deliver($, 'peer');
    await w.clock.advance(1_000);
    await end($, 't1', 'error');
    await w.clock.advance(60_000);
    await type($, 'again');
    await begin($, 't2');
    await type($, 'more', 't2');
    await deliver($, 'composer');
    await end($, 't2');
    const [failed, landed] = w.rows();
    expect([
        [failed?.ended, failed?.typedJoined, failed?.pingsJoined],
        [landed?.typedJoined, landed?.prevEnd],
    ]).toEqual([
        ['error', 0, 0],
        [1, failed?.end],
    ]);
});

test('a prompt no turn took by the end of one is dropped, so the next turn reads unknown', async ($, on) => {
    const w = world(on);
    await start($);
    await begin($, 't1');
    await ping($, 'stray');
    await end($, 't1');
    await w.clock.advance(1_000);
    await begin($, 't2');
    await end($, 't2');
    expect(w.rows().map((r) => r.starter)).toEqual(['unknown', 'unknown']);
});

test("a subagent's turn, tool call and delivery touch no main row", async ($, on) => {
    const w = world(on);
    await start($);
    await type($, 'go');
    await begin($, 't1');
    await $.turn.start({ agentId: 'a1', text: '', turnId: 's1' } as never);
    await $.tool.call({ agentId: 'a1', command: 'ls', tool: 'Bash' } as never);
    await $.session.append({
        agentId: 'a1',
        door: 'delivery',
        message: {
            content: [{ text: 'x', type: 'text' }],
            role: 'user',
            type: 'user',
        },
        origin: { kind: 'composer' },
        uuid: 'u-a1',
    } as never);
    await $.tool.call({ command: 'pwd', tool: 'Bash' } as never);
    await end($, 't1');
    expect(w.rows().map((r) => [r.turnId, r.tools, r.typedJoined])).toEqual([
        ['t1', 1, 0],
    ]);
});

test('a compact inside a turn leaves its row no context fill', async ($, on) => {
    const w = world(on);
    await start($);
    await type($, 'go');
    await begin($, 't1');
    await $.session.compact({
        messages: [{ role: 'user', text: 'hi', toolUses: [] }],
        trigger: 'auto',
    } as never);
    await end($, 't1');
    expect(w.rows().map((r) => r.ctx)).toEqual([null]);
});

test('day dirs past 30 days go to the trash at a start, and the 30th day stays', async ($, on) => {
    const w = world(on);
    await start($);
    expect(w.trashed).toEqual([[`${ROOT}/2026-10-26`]]);
});

for (const refusal of [{ drop: 'no' }, { throw: true }] as Refusal[])
    test(`a keep-hot ping the engine ${'drop' in refusal ? 'drops' : 'refuses'} gives its slot back`, async ($, on) => {
        const w = world(on, {}, (text) =>
            text.includes('keep-hot ping') ? refusal : undefined,
        );
        await start($);
        const ui = await $.ui.mount({
            component: 'AbovePrompt',
            plugin: 'x-mod-stash',
            props: {
                bodyColumns: 100,
                hasSurvey: false,
                isCollapsed: false,
                isWorking: false,
                maxRows: 12,
                scroll: { bodyRows: 40, offset: 0 },
                view: {},
            },
            surface: 'desktop',
        });
        await ui.press({ key: 'hot' });
        await end($, 't0');
        await w.clock.advance(50 * 60_000);
        await begin($, 't1');
        await end($, 't1');
        expect(w.rows().map((r) => r.starter)).toEqual(['unknown', 'unknown']);
    });

for (const [ended, joins] of [
    ['answer', 2],
    ['error', 0],
] as const)
    test(`herdr joins a turn took count on its row only when it lands: ${ended} counts ${joins}`, async ($, on) => {
        const w = world(on, { [`join-taken:${SID}`]: ['j1', 'j2'] });
        await start($);
        await type($, 'go');
        await begin($, 't1');
        await end($, 't1', ended);
        expect(w.rows().map((r) => r.herdrJoins)).toEqual([joins]);
    });

test('an ask opened in a turn counts on it; his steered tick and his replay ride the next, with no title or steer of his in a row', async ($, on) => {
    const w = orbitWorld(on);
    const files: Record<string, string> = {};
    on('fs.write', (_$, e) => {
        files[e.path] = e.text;
        return { value: undefined };
    });
    on('env.get', () => ({ value: '/home' }));
    on('turn.start', (_$, e) => ({ turnId: e.turnId }));
    await orbitStart($);
    await say($, 'go');
    await $.turn.start({ text: 'go', turnId: 't' });
    await orbit($, {
        asks: [
            { ...TITLED, title: `push ${MARK}` },
            { ...TITLED, title: 'a second one' },
        ],
        op: 'add',
    });
    await endTurn($);
    const ui = await board($);
    await w.clock.advance(30_000);
    await ui.input({
        key: 'orbit:steer:o1',
        kind: 'change',
        text: `say ${MARK}`,
    });
    await ui.press({ key: 'orbit:accepted:o1' });
    await ui.press({ key: 'orbit:rejected:o2' });
    await w.clock.advance(1_000);
    await say($, 'next');
    await $.turn.start({ text: 'next', turnId: 't2' });
    await $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't2',
    });
    const rows = Object.entries(files)
        .filter(([p]) => p.startsWith(`${ROOT}/2`))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, t]) => t);
    expect([
        rows.map((t) => {
            const r = JSON.parse(t) as { asksOpened: number; ticks: unknown[] };
            return [r.asksOpened, r.ticks];
        }),
        rows.some((t) => t.includes(MARK)),
    ]).toEqual([
        [
            [2, []],
            [
                0,
                [
                    { isSteer: true, pick: 'tick', waitS: 30 },
                    { isSteer: false, pick: 'replay', waitS: 30 },
                ],
            ],
        ],
        false,
    ]);
});

const windRows = (files: Record<string, string>) =>
    Object.entries(files)
        .filter(([p]) => p.startsWith(`${ROOT}/2`))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, t]) => JSON.parse(t) as Record<string, unknown>);
for (const [asker, by] of [
    [undefined, 'self'],
    ['mod', 'mod'],
    ['dima', 'dima'],
] as const)
    test(`a second wind ${asker ? `the ${asker} asked` : 'the thread took itself'} lands on its ingest's row, by ${by}, with the fill before the compact`, async ($, on) => {
        const w = windWorld(on, undefined, [SLUG], () =>
            windCompact($, 'manual'),
        );
        on('turn.start', (_$, e) => ({ turnId: e.turnId }));
        if (asker)
            w.store.set(`wind:${WIND_SID}`, {
                at: 0,
                ...(asker === 'mod' ? { by: 'mod' } : {}),
                state: 'writing',
            });
        w.store.set(`context:${WIND_SID}`, 61);
        await $.session.start({
            cwd: '/tmp',
            isInteractive: true,
            surface: 'desktop',
        });
        await windSay($);
        await $.turn.start({ text: 'go', turnId: 't' });
        await ready($, SLUG);
        await windEnd($);
        await w.clock.advance(2_000);
        await $.prompt.submit({
            command: { args: SLUG, name: 'x:handoff-ingest' },
            origin: { kind: 'plugin' },
            text: `/x:handoff-ingest ${SLUG}`,
            wait: false,
        } as never);
        await $.turn.start({ text: '', turnId: 'i' });
        await w.clock.advance(1_000);
        await $.turn.complete({
            answer: 'ingested',
            durationMs: 1,
            isAborted: false,
            reason: 'answer',
            turnId: 'i',
        });
        expect(
            windRows(w.files).map((r) => [r.starter, r.reason, r.wind]),
        ).toEqual([
            ['typed', null, null],
            ['mod', 'wind', { by, ctx: 61 }],
        ]);
    });

test('the 65 % ask counts on the turn its prompt started', async ($, on) => {
    const w = windWorld(on);
    on('turn.start', (_$, e) => ({ turnId: e.turnId }));
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    for (const [i, fill] of [56, 66].entries()) {
        await turnAt($, w, fill);
        await $.turn.start({ text: 'go', turnId: `t${i}` });
        await w.clock.advance(1_000);
        await $.turn.complete({
            answer: '',
            durationMs: 1,
            isAborted: false,
            reason: 'answer',
            turnId: `t${i}`,
        });
    }
    expect(windRows(w.files).map((r) => r.windAsked)).toEqual([0, 1]);
});

/* Types */

type Refusal = { drop: string } | { throw: true };
