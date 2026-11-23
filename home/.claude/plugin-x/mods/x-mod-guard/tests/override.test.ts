import type { On } from 'claude-code';

import { answerPrompts } from './said.ts';
import { type Engine, expect, mock, test } from './shared-boot.ts';
import { liveStore } from './store.ts';

// the off switch: «operator-override all [until HH:MM]» or the band's 🔓 press turns the floor to warn-only, plain rm and the
// brake aside; it is read first, fails open, ends at his word, and logs every call it passed
const SID = 'o1o1o1o1-0000';
const NOW = Date.parse('2026-11-07T14:00:00.000Z');
const REAL = '/real-home/.local/state/x/operator-override.json';
const LOG = '/real-home/.local/state/x/operator-override.log';
const REGISTRY = '/planted-home/.claude/sessions/9.json';
const ROW = JSON.stringify({ kind: 'interactive', pid: 9, sessionId: SID });

type World = {
    brake?: string;
    files?: Record<string, string>;
    // the pid ps answers for: running, or gone
    isPidGone?: boolean;
    // the judge's first read, planted to throw or to answer 5 s late
    cwd?: 'throws' | 'slow';
    // the session's id now: a `/clear` mints a new one for the same process
    sid?: string;
    // his ticks on this seat's orbit asks, and what the call answers
    ticks?: { at: number; id: string; targets: string[]; text: string }[];
    call?: 'denied' | 'failed';
};

function world(on: On, opts: World = {}) {
    const clock = mock.clock(on, { now: NOW });
    liveStore(on);
    answerPrompts(on);
    const files: Record<string, string> = {
        [REGISTRY]: ROW,
        ...opts.files,
    };
    const ran: string[] = [];
    const logged: string[] = [];
    on('session.id', () => ({ value: opts.sid ?? SID }));
    on('session.cwd', async () => {
        if (opts.cwd === 'throws') return { deny: 'planted throw' };
        if (opts.cwd === 'slow') await clock.sleep(5000);
        return { value: '/repo' };
    });
    on('env.get', (_$, e) =>
        e.name === 'HOME' ? { value: '/planted-home' } : { value: undefined },
    );
    on('process.run', (_$, e) => {
        const answer = (exitCode: number, stdout = '') => ({
            value: {
                exitCode,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout,
            },
        });
        if (e.argv[0] === 'sh') {
            if (e.argv[5] === LOG) logged.push(e.argv[4] ?? '');
            return answer(0);
        }
        if (e.argv[0] === 'id')
            return answer(
                0,
                'dima:********:501:20::0:0:Dima:/real-home:/bin/zsh\n',
            );
        // ps -o lstart= -p 9: the session's start, or nothing for a pid that no longer runs
        if (e.argv[0] === 'ps')
            return opts.isPidGone ? answer(1) : answer(0, `${START}\n`);
        if (e.argv.includes('--brake-check'))
            return answer(
                0,
                JSON.stringify({
                    data: {
                        brake: opts.brake ?? '',
                        holds: [],
                        holdsUnread: '',
                    },
                }),
            );
        return answer(1);
    });
    on('fs.exists', (_$, e) => ({
        value: Object.keys(files).some((f) => f.startsWith(e.path)),
    }));
    on('fs.list', (_$, e) => ({
        value: Object.keys(files)
            .filter((f) => f.startsWith(`${e.path}/`))
            .map((f) => ({
                isLink: false,
                kind: 'file' as const,
                mtimeMs: 0,
                name: f.slice(e.path.length + 1),
                size: 1,
            })),
    }));
    on('fs.read', (_$, e) => {
        const body = files[e.path];
        return body === undefined ? { deny: 'no such file' } : { value: body };
    });
    on('fs.write', (_$, e) => {
        files[e.path] = e.text;
        return { value: undefined };
    });
    on('ui.log', () => ({ value: undefined }));
    on('state.get', (_$, e, next) =>
        opts.ticks && e.plugin === 'x-mod-stash' && e.key === 'ticks'
            ? { value: { value: opts.ticks, version: 1 } }
            : next(e),
    );
    // the grant store as the command found it
    const atRun: string[] = [];
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : e.tool);
        atRun.push(files[REAL] ?? '{}');
        if (opts.call === 'denied') return { deny: 'another hook' };
        return opts.call === 'failed'
            ? { isError: true, result: {}, text: 'failed' }
            : { result: {}, text: 'ran' };
    });
    return { atRun, clock, files, logged, opts, ran };
}

// a session's first typed prompt is read like any other here: the switch works from the first
const say = ($: Engine, text: string, kind = 'composer') =>
    $.prompt.submit({
        origin: { kind } as { kind: 'composer' },
        text,
        wait: false,
    });
const bash = ($: Engine, command: string) =>
    $.tool.call({ command, run_in_background: true, tool: 'Bash' });
const grant = (files: Record<string, string>) =>
    JSON.parse(files[REAL] ?? '{}').all as
        | { at?: string; by?: string; sid?: string; until?: string }
        | undefined;
const START = 'Sat Nov  7 13:00:00 2026';
const ALL_ON = JSON.stringify({
    all: { at: '2026-11-07T13:00:00.000Z', by: 'word', pid: 9, start: START },
});

test('«operator-override all» turns the switch on until this session ends', async ($, on) => {
    const { files } = world(on);
    await say($, 'operator-override all');
    expect(grant(files)).toEqual({
        at: '2026-11-07T14:00:00.000Z',
        by: 'word',
        pid: 9,
        start: START,
    });
});

test('a flip lands in the log, naming where the words came from', async ($, on) => {
    const { logged } = world(on);
    await say($, 'operator-override all');
    expect(JSON.parse(logged[0] ?? '{}')).toMatchObject({
        scope: 'all',
        what: `flipped all from composer in session ${SID}`,
    });
});

test('«operator-override all until 18:30» ends at the next 18:30, local', async ($, on) => {
    const { files } = world(on);
    await say($, 'Operator override all until 18:30.');
    const until = new Date(grant(files)?.until ?? '');
    expect([
        until.getHours(),
        until.getMinutes(),
        until.getTime() > NOW,
    ]).toEqual([18, 30, true]);
});

test('an until already past today ends at that time tomorrow', async ($, on) => {
    const { files } = world(on);
    const hour = (new Date(NOW).getHours() + 23) % 24;
    await say(
        $,
        `operator-override all until ${String(hour).padStart(2, '0')}:00`,
    );
    const until = Date.parse(grant(files)?.until ?? '');
    expect([until > NOW, until - NOW <= 24 * 60 * 60 * 1000]).toEqual([
        true,
        true,
    ]);
});

test('his phrase through a bg composer moves nothing: a spawn prompt reads the same', async ($, on) => {
    const { files } = world(on, {
        files: {
            [REGISTRY]: JSON.stringify({ kind: 'bg', pid: 9, sessionId: SID }),
        },
    });
    await say($, 'operator-override all');
    expect(grant(files)).toBeUndefined();
});

test('«operator-override off» ends it', async ($, on) => {
    const { files } = world(on, { files: { [REAL]: ALL_ON } });
    await say($, 'operator-override off');
    expect(files[REAL]).toBe('{}');
});

const FLOOR = [
    'git push --force origin main',
    'git reset --hard',
    'git branch -D old',
    'pkill -f vite',
    'git commit --no-verify -m x -- a.ts',
];

for (const command of FLOOR) {
    test(`off, the floor refuses: ${command}`, async ($, on) => {
        const { ran } = world(on);
        expect([(await bash($, command)).deny !== undefined, ran]).toEqual([
            true,
            [],
        ]);
    });
    test(`on, the floor runs with a warn and a log line: ${command}`, async ($, on) => {
        const { logged, ran } = world(on, { files: { [REAL]: ALL_ON } });
        const r = await bash($, command);
        expect([
            r.deny,
            ran,
            JSON.stringify(r.context ?? []).includes('operator-override is on'),
            logged.some((l) => l.includes(`let through: ${command}`)),
        ]).toEqual([undefined, [command], true, true]);
    });
}

test('on, plain rm stays refused with the trash door', async ($, on) => {
    const { ran } = world(on, { files: { [REAL]: ALL_ON } });
    const r = await bash($, 'rm x');
    expect([r.deny?.includes('trash'), ran]).toEqual([true, []]);
});

test('on, a raw merge runs while the brake is off', async ($, on) => {
    const { ran } = world(on, { files: { [REAL]: ALL_ON } });
    expect((await bash($, 'gh pr merge 5 --squash')).deny).toBeUndefined();
    expect(ran).toEqual(['gh pr merge 5 --squash']);
});

test('on, the brake still stops a raw merge', async ($, on) => {
    const { ran } = world(on, {
        brake: 'revert on main',
        files: { [REAL]: ALL_ON },
    });
    const r = await bash($, 'gh pr merge 5 --squash');
    expect([r.deny?.includes('the brake is on'), ran]).toEqual([true, []]);
});

test('on, a release of the brake stays refused', async ($, on) => {
    const { ran } = world(on, { files: { [REAL]: ALL_ON } });
    const r = await bash($, 'x lane merge-auto 5 --release-brake --dima-ok 5');
    expect([r.deny?.includes('brake'), ran]).toEqual([true, []]);
});

test('on, a check that throws lets ls run with a warn', async ($, on) => {
    const { ran } = world(on, { cwd: 'throws', files: { [REAL]: ALL_ON } });
    const r = await bash($, 'ls');
    expect([r.deny, ran, JSON.stringify(r.context ?? [])]).toEqual([
        undefined,
        ['ls'],
        expect.stringContaining('ran unchecked'),
    ]);
});

test('on, a check that throws still refuses plain rm', async ($, on) => {
    const { ran } = world(on, { cwd: 'throws', files: { [REAL]: ALL_ON } });
    expect([(await bash($, 'rm -rf x')).deny?.includes('trash'), ran]).toEqual([
        true,
        [],
    ]);
});

test('on, a check that hangs past 2 s lets ls run', async ($, on) => {
    const { clock, ran } = world(on, {
        cwd: 'slow',
        files: { [REAL]: ALL_ON },
    });
    const call = bash($, 'ls');
    await clock.advance(2000);
    expect([(await call).deny, ran]).toEqual([undefined, ['ls']]);
    await clock.advance(3000);
});

test('off, a check that throws refuses: fail closed', async ($, on) => {
    const { ran } = world(on, { cwd: 'throws' });
    expect([(await bash($, 'ls')).deny?.includes('fail closed'), ran]).toEqual([
        true,
        [],
    ]);
});

test('a bare all grant ends with its session: a pid that no longer runs reads off', async ($, on) => {
    const { ran } = world(on, { files: { [REAL]: ALL_ON }, isPidGone: true });
    expect((await bash($, 'git reset --hard')).deny).toBeDefined();
    expect(ran).toEqual([]);
});

test('a bare all grant lives past /clear: a new session id keeps it on', async ($, on) => {
    const { ran } = world(on, {
        files: { [REAL]: ALL_ON },
        sid: 'n2n2n2n2-0000',
    });
    expect((await bash($, 'git reset --hard')).deny).toBeUndefined();
    expect(ran).toEqual(['git reset --hard']);
});

test('a bare all grant whose pid was reused reads off', async ($, on) => {
    const { files, ran } = world(on);
    files[REAL] = JSON.stringify({
        all: {
            at: '2026-11-07T13:00:00.000Z',
            by: 'word',
            pid: 9,
            start: 'Fri Nov  6 09:00:00 2026',
        },
    });
    expect((await bash($, 'git reset --hard')).deny).toBeDefined();
    expect(ran).toEqual([]);
});

for (const command of [
    'gh pr merge 5 --squash',
    'x lane merge-auto 5 --release-brake --dima-ok 5',
    '/bin/rm -rf x',
    'find . -name "*.map" -delete',
])
    test(`on, a check that hangs still refuses: ${command}`, async ($, on) => {
        const { clock, ran } = world(on, {
            cwd: 'slow',
            files: { [REAL]: ALL_ON },
        });
        const call = bash($, command);
        await clock.advance(2000);
        expect([(await call).deny !== undefined, ran]).toEqual([true, []]);
        await clock.advance(3000);
    });

test('an all grant past its until reads off', async ($, on) => {
    const { ran } = world(on, {
        files: {
            [REAL]: JSON.stringify({
                all: {
                    at: '2026-11-07T12:00:00Z',
                    by: 'word',
                    until: '2026-11-07T13:00:00Z',
                },
            }),
        },
    });
    expect((await bash($, 'git reset --hard')).deny).toBeDefined();
    expect(ran).toEqual([]);
});

test("the band's 🔓 press turns the floor to warn", async ($, on) => {
    const { ran } = world(on, {
        files: {
            [REAL]: JSON.stringify({
                prs: { at: '2026-11-07T13:00:00.000Z', by: 'band' },
            }),
        },
    });
    expect((await bash($, 'git reset --hard')).deny).toBeUndefined();
    expect(ran).toEqual(['git reset --hard']);
});

test('a band press holds until he presses off, 11 days on', async ($, on) => {
    const { ran } = world(on, {
        files: {
            [REAL]: JSON.stringify({
                prs: { at: '2026-10-27T01:00:00.000Z', by: 'band' },
            }),
        },
    });
    expect((await bash($, 'git reset --hard')).deny).toBeUndefined();
    expect(ran).toEqual(['git reset --hard']);
});

test('a band press past the 2 h his setting asked for is over', async ($, on) => {
    const { ran } = world(on, {
        files: {
            [REAL]: JSON.stringify({
                prs: {
                    at: '2026-11-07T11:00:00.000Z',
                    by: 'band',
                    until: '2026-11-07T13:00:00.000Z',
                },
            }),
        },
    });
    expect((await bash($, 'git reset --hard')).deny).toBeDefined();
    expect(ran).toEqual([]);
});

test('his typed «operator-override prs» opens merges in x, never the floor', async ($, on) => {
    const { ran } = world(on, {
        files: {
            [REAL]: JSON.stringify({
                prs: { at: '2026-11-07T13:00:00.000Z', by: 'word' },
            }),
        },
    });
    expect((await bash($, 'git reset --hard')).deny).toBeDefined();
    expect(ran).toEqual([]);
});

test('a store planted under HOME reads off', async ($, on) => {
    const { ran } = world(on, {
        files: {
            '/planted-home/.local/state/x/operator-override.json': ALL_ON,
        },
    });
    expect((await bash($, 'git reset --hard')).deny).toBeDefined();
    expect(ran).toEqual([]);
});

test('every pass lands in the log x writes', async ($, on) => {
    const { logged } = world(on, { files: { [REAL]: ALL_ON } });
    await bash($, 'git branch -D old');
    expect(JSON.parse(logged[0] ?? '{}')).toMatchObject({
        by: 'word',
        scope: 'all',
        what: 'let through: git branch -D old',
    });
});

// FRM-596: his tick on a board ask whose pick quotes a seat switch reaches x as a one-use grant for this session; nothing typed
const SEAT = 'x thread rename wing1 --role main';
const seatTick = (command = SEAT, id = 'o7') => [
    { at: NOW, id, targets: [command], text: `move: \`${command}\`` },
];
const seatGrant = (store: string | undefined) =>
    (JSON.parse(store ?? '{}') as Record<string, unknown>)[`seat:${SID}`];
// x took the grant: it removes it as it moves the seat
const xTakes = (files: Record<string, string>) => {
    files[REAL] = '{}';
};

test('his tick on a seat switch leaves x a 60 s grant for this session, thread and role', async ($, on) => {
    const { atRun } = world(on, { ticks: seatTick() });
    await bash($, SEAT);
    expect(seatGrant(atRun[0])).toMatchObject({
        at: '2026-11-07T14:00:00.000Z',
        by: 'tick o7',
        role: 'main',
        thread: 'wing1',
        until: '2026-11-07T14:01:00.000Z',
    });
});

test('a seat grant keeps every other grant in the store', async ($, on) => {
    const { atRun } = world(on, {
        files: {
            [REAL]: JSON.stringify({ prs: { at: 'x', by: 'word' } }),
        },
        ticks: seatTick(),
    });
    await bash($, SEAT);
    expect(JSON.parse(atRun[0] ?? '{}')).toMatchObject({
        prs: { at: 'x', by: 'word' },
    });
});

test('a seat grant lands one line in the log, naming the tick', async ($, on) => {
    const { logged } = world(on, { ticks: seatTick() });
    await bash($, SEAT);
    expect(logged.map((l) => JSON.parse(l))).toMatchObject([
        {
            by: 'tick o7',
            scope: 'seat',
            what: `granted for session ${SID}: ${SEAT}`,
        },
    ]);
});

test('a spent seat tick grants nothing a second time', async ($, on) => {
    const w = world(on, { ticks: seatTick() });
    await bash($, SEAT);
    xTakes(w.files);
    await w.clock.advance(61_000);
    await bash($, SEAT);
    expect([w.ran.length, seatGrant(w.atRun[1])]).toEqual([2, undefined]);
});

for (const [why, command] of [
    ['another command', 'x thread list'],
    ['another thread', 'x thread rename wing2 --role main'],
    ['another role', 'x thread rename wing1 --role wing:2'],
    ['a longer line around it', `${SEAT}; x thread list`],
] as const)
    test(`a seat switch his tick does not quote gets no grant: ${why}`, async ($, on) => {
        const { atRun } = world(on, { ticks: seatTick(command) });
        await bash($, SEAT);
        expect(atRun).toEqual(['{}']);
    });

for (const [line, thread] of [
    ["x thread rename '🦉🪽 clio: wing 1' --role main", '🦉🪽 clio: wing 1'],
    ['X_DEV=1 x thread rename --role=main wing1', 'wing1'],
    ['x --json thread rename wing1 --role main', 'wing1'],
] as const)
    test(`a ticked seat switch in another spelling is granted: ${line}`, async ($, on) => {
        const { atRun } = world(on, { ticks: seatTick(line) });
        await bash($, line);
        expect(seatGrant(atRun[0])).toMatchObject({ role: 'main', thread });
    });

for (const line of [
    'x thread rename wing1 main --role main',
    'x thread rename wing1 main',
    'x thread rename --role main',
    'x lane thread rename wing1 --role main',
    'y thread rename wing1 --role main',
    "sh -c 'x thread rename wing1 --role main'",
])
    test(`a ticked line that is no seat switch gets no grant: ${line}`, async ($, on) => {
        const { atRun } = world(on, { ticks: seatTick(line) });
        await bash($, line);
        expect(atRun).toEqual(['{}']);
    });

test('a ticked line that is more than the seat switch gets no grant', async ($, on) => {
    const line = `${SEAT}; x thread list`;
    const { atRun } = world(on, { ticks: seatTick(line) });
    await bash($, line);
    expect(atRun).toEqual(['{}']);
});

test('a seat switch with the override on spends no tick', async ($, on) => {
    const { atRun } = world(on, {
        files: { [REAL]: ALL_ON },
        ticks: seatTick(),
    });
    await bash($, SEAT);
    expect(seatGrant(atRun[0])).toBeUndefined();
});

for (const body of ['{"prs"', '[]', 'null'])
    test(`a store that reads ${body} is left as it is, and the tick unspent`, async ($, on) => {
        const w = world(on, { files: { [REAL]: body }, ticks: seatTick() });
        await bash($, SEAT);
        const left = w.files[REAL];
        w.files[REAL] = '{}';
        await bash($, SEAT);
        expect([left, seatGrant(w.atRun[1]) !== undefined]).toEqual([
            body,
            true,
        ]);
    });

for (const call of ['failed', 'denied'] as const)
    test(`a seat switch that ${call === 'failed' ? 'fails' : 'another hook refuses'} hands the tick back and removes the grant`, async ($, on) => {
        const w = world(on, { call, ticks: seatTick() });
        await bash($, SEAT);
        const left = seatGrant(w.files[REAL]);
        delete w.opts.call;
        await bash($, SEAT);
        expect([left, seatGrant(w.atRun[1]) !== undefined]).toEqual([
            undefined,
            true,
        ]);
    });

test('a grant never used is gone after 60 s, and the tick is back', async ($, on) => {
    const w = world(on, { ticks: seatTick() });
    await bash($, SEAT);
    await w.clock.advance(59_000);
    const held = seatGrant(w.files[REAL]) !== undefined;
    await w.clock.advance(2000);
    const left = seatGrant(w.files[REAL]);
    await bash($, SEAT);
    expect([held, left, seatGrant(w.atRun[1]) !== undefined]).toEqual([
        true,
        undefined,
        true,
    ]);
});

test('the end of an old grant leaves a newer one alone', async ($, on) => {
    const w = world(on, {
        ticks: [...seatTick(), ...seatTick(SEAT, 'o8')],
    });
    await bash($, SEAT);
    await w.clock.advance(30_000);
    await bash($, SEAT);
    await w.clock.advance(31_000);
    expect(seatGrant(w.files[REAL])).toBeDefined();
});
