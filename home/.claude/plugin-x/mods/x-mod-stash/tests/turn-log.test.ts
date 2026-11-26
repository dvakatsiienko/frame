import type { On } from 'claude-code';

import {
    add,
    board,
    endTurn,
    start as orbitStart,
    world as orbitWorld,
    say,
} from './orbit-world.ts';
import { type Engine, expect, mock, test } from './shared-boot.ts';

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

function world(on: On, store: Record<string, unknown> = {}) {
    const clock = mock.clock(on, { now: NOW });
    mock.store(on, store);
    const files: Record<string, string> = {};
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
    on('process.run', () => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: `${PID}\nThu Nov 26 12:00:00 2026\n`,
        },
    }));
    on('fs.write', (_$, e) => {
        files[e.path] = e.text;
        return { value: undefined };
    });
    on('fs.read', (_$, e) =>
        e.path in files ? { value: files[e.path] ?? '' } : { deny: 'ENOENT' },
    );
    on('fs.list', () => ({ value: [] }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('prompt.submit', (_$, e) => ({ text: e.text }));
    on('turn.start', (_$, e) => ({ turnId: e.turnId }));
    on('turn.complete', () => ({ text: '' }));
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
    return { clock, files, rows };
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
