import { spawn, spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, test } from 'vitest';

import {
    fixture,
    hold,
    liveSince,
    logRows,
    long,
    plantHolder,
    plantTicket,
    queue,
    queueEnv,
    script,
} from './gate-queue-kit.ts';

describe('gate-queue --long on a loaded mac', () => {
    // an uptime that answers each load in turn, the last one on; a claude and a pnpm that only say they ran
    function loaded(
        loads: string[],
        args: string[],
        extra: NodeJS.ProcessEnv = {},
    ) {
        const { state } = fixture();
        const bin = join(state, 'bin');
        mkdirSync(bin);
        const put = (name: string, body: string) =>
            writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, {
                mode: 0o755,
            });
        writeFileSync(join(state, 'loads'), `${loads.join('\n')}\n`);
        put(
            'uptime',
            `l=$(head -n 1 ${state}/loads); [ $(wc -l <${state}/loads) -gt 1 ] && sed -i.bak 1d ${state}/loads; echo "12:27  up 1 day, 7 users, load averages: $l 9.00 9.00"`,
        );
        put('claude', 'echo ran');
        put('pnpm', 'echo ran');
        return queue(state, ['--long', ...args], '1', {
            PATH: `${bin}:${process.env.PATH}`,
            ...extra,
        });
    }
    const SUITE = ['claude', 'plugin', 'test', 'mod'];

    test.each([
        ['x’s suite', SUITE],
        ['a hand run', ['pnpm', 'mods:test', 'x-mod-stash']],
        ['a timed run', ['/usr/bin/time', '-p', 'pnpm', 'mods:test']],
        ['a run by its file', ['node', 'home/.claude/plugin-x/mods/test.ts']],
        ['a shell line', ['sh', '-c', 'claude plugin test mod']],
        ['a quiet pnpm', ['pnpm', '--silent', 'mods:test']],
    ])(
        '%s over the number waits, then runs nothing and says the load',
        (_name, args) => {
            const got = loaded(['14.01'], args);
            expect([got.status, got.stdout]).toEqual([75, '']);
            expect(got.stderr).toMatch(
                /gate-queue: waited \d+s, deadline passed, nothing ran\. the 1-minute load is 14\.01, a mods suite starts at 14 or under/,
            );
        },
    );

    test('a load that falls inside the wait lets it run', () => {
        const got = loaded(['30.00', '30.00', '30.00', '12.00'], SUITE);
        expect([got.status, got.stdout]).toEqual([0, 'ran\n']);
    });

    test('a suite inside a held long turn waits for the load too', () => {
        const held = { GATE_QUEUE_HELD: 'long' };
        expect(loaded(['30.00'], SUITE, held).status).toBe(75);
        expect(loaded(['9.00'], SUITE, held).stdout).toBe('ran\n');
    });

    test.each([
        ['at the number', '14.00', SUITE],
        ['any other long run, over it', '90.00', ['sh', '-c', 'echo ran']],
    ])('%s it runs', (_name, load, args) => {
        const got = loaded([load], args);
        expect([got.status, got.stdout]).toEqual([0, 'ran\n']);
    });
});

describe('gate-queue, no flag: no turn', () => {
    test.each([
        ['a script path', ['landing.sh']],
        ['a chain', ['sh', '-c', 'x lane commit m -- a && x lane push']],
        ['a pnpm script', ['pnpm', 'x-go:gate']],
    ])('%s runs past a live gate holder, and says so', (_name, command) => {
        const { state, gateTurn } = fixture();
        plantHolder(gateTurn, String(process.pid), liveSince());
        const stub = join(state, 'bin');
        mkdirSync(stub);
        for (const name of ['x', 'pnpm', 'landing.sh']) {
            writeFileSync(join(stub, name), '#!/bin/sh\nexit 9\n', {
                mode: 0o755,
            });
        }
        const got = spawnSync(script, command, {
            encoding: 'utf8',
            env: {
                ...queueEnv(state, '1'),
                PATH: `${stub}:${process.env.PATH}`,
            },
            timeout: 10_000,
        });
        expect(got.status).toBe(9);
        expect(got.stderr).toContain('no turn');
        expect(existsSync(gateTurn)).toBe(true);
        const row = logRows(state).at(-1);
        expect(row?.slice(2, 4)).toEqual(['none', '0']);
        expect(row?.[5]).toBe('9');
    });

    test('a TERM still logs its row', { timeout: 15_000 }, async () => {
        const { state } = fixture();
        const ran = join(state, 'ran');
        const child = spawn(script, ['sh', '-c', `touch ${ran}; sleep 1`], {
            env: queueEnv(state),
            stdio: 'ignore',
        });
        while (!existsSync(ran)) await sleep(50);
        child.kill('SIGTERM');
        await new Promise((done) => child.on('exit', done));
        expect(logRows(state).at(-1)?.slice(2, 3)).toEqual(['none']);
        expect(logRows(state).at(-1)?.[5]).toBe('143');
    });

    test('a nested run writes no row of its own', () => {
        const { state } = fixture();
        queue(state, [script, 'sh', '-c', 'exit 0']);
        expect(logRows(state)).toHaveLength(1);
    });

    test('with no command is a usage error', () => {
        const { state } = fixture();
        expect(queue(state, []).status).toBe(2);
    });

    test('a long round inside it inside a long round keeps its turn', () => {
        const { state } = fixture();
        const got = long(
            state,
            [script, script, '--long', 'sh', '-c', 'exit 3'],
            '2',
        );
        expect(got.status).toBe(3);
    });
});

describe('gate-queue --hold: the turn x takes', () => {
    test('prints ready, exits with the code on its stdin, frees the turn', () => {
        const { state, gateTurn } = fixture();
        const got = hold(state, undefined, '7');
        expect(got.stdout.trim()).toBe('turn');
        expect(got.status).toBe(7);
        expect(existsSync(gateTurn)).toBe(false);
    });

    test('its row carries the gate slot, its wait, its run and its label', () => {
        const { state } = fixture();
        hold(state, undefined, '7');
        const [row] = logRows(state);
        expect(row?.[2]).toBe('gate');
        expect(row?.slice(3, 5)).toEqual(
            Array(2).fill(expect.stringMatching(/^\d+$/)),
        );
        expect(row?.slice(5)).toEqual(['7', '-', 'x lane commit']);
    });

    test('a closed stdin frees the turn', () => {
        const { state, gateTurn } = fixture();
        const got = spawnSync(script, ['--hold', 'x'], {
            encoding: 'utf8',
            env: queueEnv(state),
            input: '',
            timeout: 10_000,
        });
        expect(got.stdout.trim()).toBe('turn');
        expect(got.status).toBe(1);
        expect(existsSync(gateTurn)).toBe(false);
    });

    // x died in line, so the ready line meets a closed pipe: bash 3.2, the mac's, once wrote it into the run's own clock read
    test('an x gone before its turn leaves the turn free, its row at exit 141', async () => {
        const { gateTurn, state } = fixture();
        plantHolder(gateTurn, String(process.pid), liveSince());
        const child = spawn(script, ['--hold', 'x'], {
            env: queueEnv(state),
            stdio: ['pipe', 'pipe', 'ignore'],
        });
        const ended = new Promise((done) => child.on('exit', done));
        const tickets = `${gateTurn}.tickets`;
        while (!existsSync(tickets) || readdirSync(tickets).length === 0)
            await sleep(20);
        child.stdin.destroy();
        child.stdout.destroy();
        rmSync(gateTurn, { recursive: true });
        await ended;
        expect(existsSync(gateTurn)).toBe(false);
        expect(logRows(state).map((row) => row[5])).toEqual(['141']);
    });

    test('a hold past its cap frees the turn, logs 124 and names the cap', () => {
        const { state, gateTurn } = fixture();
        const stdin = join(state, 'stdin');
        // an open pipe nobody writes to: a hung hook, x alive above it
        const got = spawnSync(
            'sh',
            [
                '-c',
                `mkfifo ${stdin}; sleep 4 >${stdin} 2>/dev/null & ${script} --hold x <${stdin}`,
            ],
            {
                encoding: 'utf8',
                env: { ...queueEnv(state), GATE_QUEUE_HOLD_CAP: '1' },
                timeout: 20_000,
            },
        );
        expect(got.stderr).toContain('1s cap');
        expect(got.stderr).toContain('goes on: x');
        expect(existsSync(gateTurn)).toBe(false);
        expect(logRows(state).at(-1)?.[5]).toBe('124');
    });

    test('a live holder makes it wait to its deadline, never ready', () => {
        const { state, gateTurn } = fixture();
        plantHolder(gateTurn, String(process.pid), liveSince());
        const got = hold(state, '1');
        expect(got.status).toBe(75);
        expect(got.stdout).toBe('');
        expect(got.stderr).toContain('old run');
        expect(existsSync(gateTurn)).toBe(true);
    });

    test('it does not wait behind a long holder', () => {
        const { state, turn } = fixture();
        plantHolder(turn, String(process.pid), liveSince());
        expect(hold(state, '2', '5').status).toBe(5);
        expect(existsSync(turn)).toBe(true);
    });

    test('inside a long round it still takes the gate slot', () => {
        const { state, gateTurn } = fixture();
        plantHolder(gateTurn, String(process.pid), liveSince());
        const got = long(state, [script, '--hold', 'x'], '1');
        expect(got.status).toBe(75);
    });

    test('with no label is a usage error', () => {
        const { state } = fixture();
        expect(queue(state, ['--hold']).status).toBe(2);
    });

    test('two holds never overlap', { timeout: 15_000 }, async () => {
        const { state } = fixture();
        const log = join(state, 'log');
        const start = (name: string) =>
            new Promise<void>((done) => {
                const child = spawn(script, ['--hold', name], {
                    env: queueEnv(state),
                    stdio: ['pipe', 'pipe', 'ignore'],
                });
                child.stdout.once('data', async () => {
                    writeFileSync(log, 'in\n', { flag: 'a' });
                    await sleep(200);
                    writeFileSync(log, 'out\n', { flag: 'a' });
                    child.stdin.end('0\n');
                });
                child.on('exit', () => done());
            });
        await Promise.all([start('one'), start('two')]);
        expect(readFileSync(log, 'utf8')).toBe('in\nout\nin\nout\n');
    });
});

describe('gate-queue session column', () => {
    test.each([
        ['a session', 'f39b1ae2-aaaa-bbbb', 'f39b1ae2'],
        ['none', undefined, '-'],
    ])('%s reads in the column before the command', (_name, session, want) => {
        const { state } = fixture();
        const extra = session ? { CLAUDE_CODE_SESSION_ID: session } : {};
        queue(state, ['sh', '-c', 'exit 0'], undefined, extra);
        queue(state, ['--long', 'sh', '-c', 'exit 0'], undefined, extra);
        const rows = logRows(state);
        expect(rows).toHaveLength(2);
        for (const row of rows) {
            expect(row.slice(-2)).toEqual([want, 'sh -c exit 0']);
        }
    });
});

describe('gate-queue --long', () => {
    test('hands back the command exit code and frees the turn', () => {
        const { state, turn } = fixture();
        expect(long(state, ['sh', '-c', 'exit 7']).status).toBe(7);
        expect(existsSync(turn)).toBe(false);
    });

    test('a live holder makes the run wait to its deadline, and nothing runs', () => {
        const { state, turn } = fixture();
        plantHolder(turn, String(process.pid), liveSince());
        const marker = join(state, 'ran');
        const got = long(state, ['touch', marker], '1');
        expect(got.status).toBe(75);
        expect(got.stderr).toContain('old run');
        expect(existsSync(marker)).toBe(false);
        expect(existsSync(turn)).toBe(true);
    });

    test.each([
        ['a dead pid', '999999', 'Fri Nov  6 10:00:00 2026'],
        ['a reused pid', String(process.pid), 'Fri Nov  6 10:00:00 2026'],
    ])('%s frees the turn', (_name, pid, since) => {
        const { state, turn } = fixture();
        plantHolder(turn, pid, since);
        const got = long(state, ['sh', '-c', 'exit 0']);
        expect(got.status).toBe(0);
        expect(got.stderr).toContain('freed');
    });

    test('a queued run calling a queued run keeps its turn', () => {
        const { state } = fixture();
        const got = long(state, [script, '--long', 'sh', '-c', 'exit 3'], '2');
        expect(got.status).toBe(3);
    });

    test('a long run does not wait behind a gate holder', () => {
        const { state, gateTurn } = fixture();
        plantHolder(gateTurn, String(process.pid), liveSince());
        const got = long(state, ['sh', '-c', 'exit 4'], '2');
        expect(got.status).toBe(4);
        expect(existsSync(gateTurn)).toBe(true);
    });

    test('with no command is a usage error', () => {
        const { state } = fixture();
        expect(queue(state, ['--long']).status).toBe(2);
    });

    test('a finished run logs its slot, wait, run seconds, exit and command', () => {
        const { state } = fixture();
        long(state, ['sh', '-c', 'exit 7']);
        const [row] = logRows(state);
        expect(row?.[2]).toBe('long');
        expect(row?.slice(5)).toEqual(['7', '-', 'sh -c exit 7']);
        // the two seconds columns are wall clock: a number, never a value
        expect(row?.slice(3, 5)).toEqual(
            Array(2).fill(expect.stringMatching(/^\d+$/)),
        );
    });

    test('a wait past its deadline logs no run seconds and exit 75', () => {
        const { state, turn } = fixture();
        plantHolder(turn, String(process.pid), liveSince());
        const marker = join(state, 'ran');
        long(state, ['touch', marker], '1');
        const [row] = logRows(state);
        expect(row?.[1]).toMatch(/^\d+\.\d+$/);
        expect(Number(row?.[3])).toBeGreaterThanOrEqual(1);
        expect(row?.slice(4)).toEqual(['-', '75', '-', `touch ${marker}`]);
    });

    test('a free turn still waits behind an older live ticket', () => {
        const { state, turn } = fixture();
        plantTicket(turn, `1.${process.pid}`, liveSince());
        const marker = join(state, 'ran');
        expect(long(state, ['touch', marker], '1').status).toBe(75);
        expect(existsSync(marker)).toBe(false);
    });

    test.each([
        ['a dead pid', '1.999999', 'Fri Nov  6 10:00:00 2026'],
        ['a reused pid', `1.${process.pid}`, 'Fri Nov  6 10:00:00 2026'],
    ])('%s leaves the line', (_name, name, since) => {
        const { state, turn } = fixture();
        plantTicket(turn, name, since);
        expect(long(state, ['sh', '-c', 'exit 6']).status).toBe(6);
        expect(readdirSync(`${turn}.tickets`)).toEqual([]);
    });

    test('a dead owner with a blank ticket leaves the line', () => {
        const { state, turn } = fixture();
        plantTicket(turn, '1.999999', '');
        expect(long(state, ['sh', '-c', 'exit 6']).status).toBe(6);
    });

    test('a dead holder with a blank start frees the turn', () => {
        const { state, turn } = fixture();
        plantHolder(turn, '999999', '');
        expect(long(state, ['sh', '-c', 'exit 6']).status).toBe(6);
    });

    test('a turn with no holder file frees after its minute, and not before', () => {
        const { state, turn } = fixture();
        mkdirSync(turn);
        expect(long(state, ['sh', '-c', 'exit 0'], '1').status).toBe(75);
        const old = new Date(Date.now() - 300_000);
        utimesSync(turn, old, old);
        expect(long(state, ['sh', '-c', 'exit 6']).status).toBe(6);
    });

    test.each([
        // a pipe nobody reads, and no signal for it: the write fails and the script lives on
        ['cannot be written', ''],
        ['have nowhere to go', ' >&- 2>&-'],
    ])(
        'a waiter whose words %s waits on, and the holder keeps its turn',
        async (_name, closed) => {
            const { state, turn } = fixture();
            plantHolder(turn, String(process.pid), liveSince());
            const ran = join(state, 'ran');
            const child = spawn(
                'sh',
                [
                    '-c',
                    `trap "" PIPE; exec ${script} --long touch ${ran}${closed}`,
                ],
                {
                    env: queueEnv(state, '1'),
                    stdio: ['ignore', 'ignore', 'pipe'],
                },
            );
            child.stderr.destroy();
            const code = await new Promise((done) => child.on('exit', done));
            expect([code, existsSync(ran)]).toEqual([75, false]);
            expect(readFileSync(join(turn, 'holder'), 'utf8')).toContain(
                'old run',
            );
        },
    );

    test.each(['SIGTERM', 'SIGHUP'] as const)(
        'a %s while it frees its turn leaves no turn and keeps its row',
        async (signal) => {
            const { state, turn } = fixture();
            const bin = join(state, 'bin');
            const freeing = join(state, 'freeing');
            mkdirSync(bin);
            writeFileSync(
                join(bin, 'rm'),
                `#!/bin/sh\ncase "$*" in *long.turn) touch ${freeing}; sleep 0.5 ;; esac\nexec /bin/rm "$@"\n`,
                { mode: 0o755 },
            );
            const child = spawn(script, ['--long', 'true'], {
                env: { ...queueEnv(state), PATH: `${bin}:${process.env.PATH}` },
                stdio: 'ignore',
            });
            const ended = new Promise((done) => child.on('exit', done));
            while (
                !existsSync(freeing) &&
                child.exitCode === null &&
                child.signalCode === null
            )
                await sleep(20);
            expect(existsSync(freeing)).toBe(true);
            child.kill(signal);
            await ended;
            expect(existsSync(turn)).toBe(false);
            expect(logRows(state).map((row) => row[5])).toEqual(['0']);
        },
    );

    test('a waiter behind the line never frees a stale turn', () => {
        const { state, turn } = fixture();
        plantTicket(turn, `1.${process.pid}`, liveSince());
        plantHolder(turn, '999999', 'Fri Nov  6 10:00:00 2026');
        const got = long(state, ['sh', '-c', 'exit 0'], '1');
        expect(got.status).toBe(75);
        expect(existsSync(join(turn, 'holder'))).toBe(true);
    });

    test('a ticket leaves with its deadline', () => {
        const { state, turn } = fixture();
        plantHolder(turn, String(process.pid), liveSince());
        long(state, ['sh', '-c', 'exit 0'], '1');
        expect(readdirSync(`${turn}.tickets`)).toEqual([]);
    });

    test('a newcomer never jumps a waiter', { timeout: 30_000 }, async () => {
        const { state, turn } = fixture();
        const log = join(state, 'log');
        const go = join(state, 'go');
        const run = (name: string, wait = 'true') =>
            new Promise<void>((done) => {
                spawn(
                    script,
                    ['--long', 'sh', '-c', `${wait}; echo ${name} >>${log}`],
                    { env: queueEnv(state) },
                ).on('exit', () => done());
            });
        const tickets = () => readdirSync(`${turn}.tickets`).length;
        const lined = async (count: number) => {
            while (!existsSync(`${turn}.tickets`) || tickets() !== count)
                await sleep(50);
        };
        // the holder leaves on the marker: a slow machine cannot end the line early. the bound, past the test's own timeout, ends it when the test died
        const holder = run(
            'holder',
            `i=0; until [ -e ${go} ] || [ $i -ge 600 ]; do sleep 0.1; i=$((i+1)); done`,
        );
        while (!existsSync(turn)) await sleep(50);
        const first = run('first');
        await lined(1);
        await sleep(1100);
        const second = run('second');
        await lined(2);
        writeFileSync(go, '');
        await Promise.all([holder, first, second]);
        expect(readFileSync(log, 'utf8')).toBe('holder\nfirst\nsecond\n');
    });

    // a held turn, the runs lined up behind it in their order of arrival, then the order they ran in
    async function orderOf(queued: [string, string[]][]) {
        const { state, turn } = fixture();
        const log = join(state, 'log');
        const go = join(state, 'go');
        const bin = join(state, 'bin');
        mkdirSync(bin);
        // claude, pnpm and go only say their run's name, the RUN of its own env
        for (const name of ['claude', 'pnpm', 'go', 'batch'])
            writeFileSync(
                join(bin, name),
                `#!/bin/sh\necho "$RUN" >>${log}\n`,
                { mode: 0o755 },
            );
        // a calm mac, whatever this one's load: a mods suite waits for it
        writeFileSync(
            join(bin, 'uptime'),
            '#!/bin/sh\necho "12:27  up 1 day, load averages: 1.00 1.00 1.00"\n',
            { mode: 0o755 },
        );
        const run = (name: string, args: string[]) =>
            new Promise<void>((done) => {
                spawn(script, ['--long', ...args], {
                    env: {
                        ...queueEnv(state),
                        PATH: `${bin}:${process.env.PATH}`,
                        RUN: name,
                    },
                }).on('exit', () => done());
            });
        const holder = run('holder', [
            'sh',
            '-c',
            `i=0; until [ -e ${go} ] || [ $i -ge 600 ]; do sleep 0.1; i=$((i+1)); done; echo holder >>${log}`,
        ]);
        while (!existsSync(turn)) await sleep(50);
        const runs: Promise<void>[] = [];
        for (const [name, args] of queued) {
            runs.push(run(name, args));
            while (readdirSync(`${turn}.tickets`).length !== runs.length)
                await sleep(50);
            await sleep(1100);
        }
        writeFileSync(go, '');
        await Promise.all([holder, ...runs]);
        return readFileSync(log, 'utf8').trim().split('\n');
    }
    const BATCH = ['batch', 'mut.py'];

    test.each([
        ['a whole mods suite', ['pnpm', 'mods:test', 'x-mod-stash']],
        ['x’s own suite', ['claude', 'plugin', 'test', 'mod']],
        ['a suite run by its file', ['pnpm', 'node', 'mods/test.ts', 'm']],
        ['a go suite', ['pnpm', 'x-go:test']],
        ['a whole go test', ['go', 'test', '-count=1', './...']],
        ['a go suite of a dir', ['go', '-C', 'x/go', 'test', '-count=1', '.']],
        ['a package’s own suite', ['pnpm', '--filter', 'speak', 'test']],
        ['a package by one word', ['pnpm', '--filter=speak', 'test']],
        ['a timed suite', ['env', 'A=1', 'claude', 'plugin', 'test', 'mod']],
        ['a shell line of suites', ['sh', '-c', 'pnpm mods:test && pnpm test']],
    ])(
        '%s takes the turn before a batch queued ahead of it',
        { timeout: 30_000 },
        async (_name, args) => {
            const order = await orderOf([
                ['batch', BATCH],
                ['suite', args],
            ]);
            expect([...new Set(order)]).toEqual(['holder', 'suite', 'batch']);
        },
    );

    test('one file of a suite, a red round, a go test by name and a run that only holds a suite’s words keep their order', {
        timeout: 60_000,
    }, async () => {
        expect(
            await orderOf([
                ['batch', BATCH],
                ['only', ['pnpm', 'mods:test', '--only', 'a.test.ts']],
                ['red', ['batch', 'verify', 'red', '--pairs', 'mods:test']],
                ['named', ['go', 'test', '-run=TestX', './...']],
                ['proof', ['batch', 'red-proof', 'plugin test mod']],
                ['extra', ['pnpm', 'mods:test', 'm', '--extra', 'f']],
                ['file', ['pnpm', 'test', 'a.test.ts']],
                ['words', ['batch', 'claude plugin test mod; pnpm test']],
                ['loop', ['sh', '-c', 'batch; claude plugin test mod']],
                ['mutants', ['sh', '-c', 'pnpm mods:test && batch']],
            ]),
        ).toEqual([
            'holder',
            'batch',
            'only',
            'red',
            'named',
            'proof',
            'extra',
            'file',
            'words',
            'loop',
            'loop',
            'mutants',
            'mutants',
        ]);
    });

    // the class of a command alone, read by the script's own functions: no queue, no wait
    test.each([
        // what `pnpm mods:test` queues itself as
        ['suite', ['/opt/x/bin/node', '/f/mods/test.ts', 'x-mod-stash']],
        ['suite', ['claude', 'plugin', 'test', '/f/x-mod-stash']],
        [
            'suite',
            [
                '/usr/bin/time',
                '-p',
                '-o',
                '/f',
                'go',
                '-C',
                'x/go',
                'test',
                '.',
            ],
        ],
        [
            'suite',
            [
                'env',
                'GIT_TRACE2_EVENT=/x',
                '/usr/bin/time',
                '-p',
                'go',
                'test',
                './...',
            ],
        ],
        ['suite', ['env', '-C', 'x/go', 'go', 'test', './...', '-count=1']],
        [
            'suite',
            ['../../script/test-vm-go.sh', 'go', 'test', '-json', './...'],
        ],
        ['suite', ['/opt/homebrew/bin/pnpm', '-s', 'mods:test', 'x-mod-guard']],
        ['suite', ['sh', '-c', 'pnpm --silent mods:test x-mod-guard']],
        [
            'suite',
            ['zsh', '-c', 'pnpm daemon:test && pnpm test && pnpm typecheck'],
        ],
        ['suite', ['bash', '-c', 'pnpm typecheck && pnpm test']],
        ['suite', ['bash', '-c', 'cd x/go && go test ./... -count=1']],
        ['suite', ['sh', '-c', 'go -C x/go test -count=1 . >out 2>&1']],
        [
            'suite',
            ['sh', '-c', 'cd x/go && ../../script/test-vm-go.sh go test ./...'],
        ],
        ['suite', ['sh', '-c', 'timeout 60 pnpm mods:test x']],
        ['batch', ['sh', '-c', 'pnpm mods:test --only "$PWD/a.test.ts"']],
        ['batch', ['sh', '-c', 'pnpm test && pnpm exec x verify red f a b']],
        ['batch', ['sh', '-c', 'pnpm mods:test && node mut.mjs']],
        ['batch', ['sh', '-c', 'pnpm mods:test a; node mut.mjs']],
        ['batch', ['sh', '-c', 'pnpm mods:test a | node mut.mjs']],
        ['batch', ['sh', '-c', 'pnpm mods:test a $(node mut.mjs)']],
        ['batch', ['sh', '-c', 'pnpm mods:test a & node mut.mjs']],
        ['batch', ['sh', '-c', 'pnpm mods:test a <(node mut.mjs)']],
        ['batch', ['sh', '-c', 'pnpm mods:test a &&& node mut.mjs']],
        ['batch', ['sh', '-c', 'pnpm mods:test a\nnode mut.mjs']],
        ['batch', ['sh', '-c', '{ pnpm mods:test a']],
        ['suite', ['sh', '-c', 'pnpm mods:test a >/x/a.log 2>&1']],
        ['batch', ['sh', '-c', 'pnpm test | tee out']],
        ['batch', ['sh', '-c', 'pnpm test $(python3 mut.py)']],
        ['batch', ['sh', '-c', 'cd x && pnpm typecheck']],
        ['batch', ['go', 'test', '--run', 'TestX', './...']],
        ['batch', ['go', 'test', '-test.run=X', './...']],
        ['batch', ['timeout', '2400', 'python3', '/x/mut21b.py']],
        ['batch', ['pnpm', 'vitest', 'run', 'script/lib/a.test.ts']],
        [
            'batch',
            ['/x/bin/x', 'verify', 'red', '--pairs', 'f', 'a', 'mods:test'],
        ],
        ['batch', ['x', 'mods', 'edit', 'push']],
        ['batch', ['mut', 'claude plugin test mod; pnpm test']],
        ['suite', ['pnpm', '--filter', 'speak', 'daemon:build']],
        ['suite', ['pnpm', 'build']],
        ['batch', ['pnpm', 'builder']],
        ['batch', ['sh', 'run.sh']],
        ['batch', ['env']],
        ['batch', ['timeout']],
    ])('%s: %j', (kind, args) => {
        const text = readFileSync(script, 'utf8');
        const read = text.slice(
            text.indexOf('kind_of() {'),
            text.indexOf('is_suite=\n[ "$slot'),
        );
        const got = spawnSync(
            '/bin/bash',
            [
                '-c',
                `set -u\n${read}\nis_suite_run "$@" && echo suite || echo batch`,
                'q',
                ...args,
            ],
            { encoding: 'utf8', timeout: 10_000 },
        );
        expect([got.stdout.trim(), got.stderr]).toEqual([kind, '']);
    });

    test('two suites keep their order, and a batch behind both waits', {
        timeout: 30_000,
    }, async () => {
        expect(
            await orderOf([
                ['batch', BATCH],
                ['first', ['pnpm', 'mods:test', 'x-mod-stash']],
                ['second', ['pnpm', 'mods:test', 'x-mod-guard']],
            ]),
        ).toEqual(['holder', 'first', 'second', 'batch']);
    });

    // the line cuts only a known batch; anything else runs whole and hears one line past it
    const ENDED = 'was ended';
    const KEPT = 'kept the long turn';
    test.each([
        [
            'a mutant script past its line is ended',
            '0',
            ['mut.py'],
            [124, ENDED],
        ],
        [
            'a python mutant past its line is ended',
            '0',
            ['python3', '-c', 'import time; time.sleep(5)'],
            [124, ENDED],
        ],
        [
            'a node mutant past its line is ended',
            '0',
            ['node', '-e', 'setTimeout(() => {}, 5000)'],
            [124, ENDED],
        ],
        [
            'a run of one test file past its line is ended',
            '0',
            ['pnpm', 'vitest', 'run', 'a.test.ts'],
            [124, ENDED],
        ],
        [
            'a go test by name past its line is ended',
            '0',
            ['go', 'test', '-run', 'TestX', './...'],
            [124, ENDED],
        ],
        [
            'a red round past its line is ended',
            '0',
            ['pnpm', 'x', 'verify', 'red', '--pairs', 'p.tsv'],
            [124, ENDED],
        ],
        [
            'a short batch keeps its exit and says nothing',
            '60',
            ['mut.py', 'fast'],
            [7, ''],
        ],
        [
            'an unknown run runs whole past the line, told once',
            '0',
            ['sh', '-c', 'sleep 1; exit 3'],
            [3, KEPT],
        ],
        [
            'a typecheck runs whole past the line',
            '0',
            ['pnpm', 'typecheck'],
            [0, KEPT],
        ],
        [
            'a typecheck run by node runs whole past the line',
            '0',
            ['node', './home/.claude/plugin-x/mods/typecheck.ts'],
            [0, KEPT],
        ],
        [
            'a whole go suite runs past the line, silent',
            '0',
            ['go', 'test', './...'],
            [0, ''],
        ],
        [
            'a build runs past the line, silent',
            '0',
            ['pnpm', '--filter', 'speak', 'daemon:build'],
            [0, ''],
        ],
    ] as const)('%s', (_name, max, args, [status, says]) => {
        const { state } = fixture();
        const bin = join(state, 'bin');
        mkdirSync(bin);
        const put = (name: string, body: string) =>
            writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, {
                mode: 0o755,
            });
        put('go', 'case "$*" in *-run*) sleep 5 ;; *) sleep 1 ;; esac');
        put(
            'pnpm',
            'case "$*" in *a.test.ts* | *verify*) sleep 5 ;; *) sleep 1 ;; esac',
        );
        put('mut.py', '[ "$1" = fast ] && exit 7; sleep 5');
        put('node', 'case "$*" in *typecheck*) sleep 1 ;; *) sleep 5 ;; esac');
        const got = queue(state, ['--long', ...args], '20', {
            GATE_QUEUE_BATCH_MAX: max,
            GATE_QUEUE_KILL_GRACE: '0.2',
            PATH: `${bin}:${process.env.PATH}`,
        });
        const told = [ENDED, KEPT].filter((line) => got.stderr.includes(line));
        expect([got.status, told.join()]).toEqual([status, says]);
        expect(logRows(state).at(-1)?.[5]).toBe(String(status));
    });

    // a child that ignores TERM is the one only the KILL after the grace ends
    test.each([
        ['its line', '1', false, ''],
        ['a signal to the queue', '2', true, ''],
        ['its line, a child ignoring TERM', '1', false, `trap '' TERM; `],
        ['a signal, a child ignoring TERM', '2', true, `trap '' TERM; `],
    ])(
        'a batch ended by %s takes every process it started with it',
        async (_name, max, signal, ignore) => {
            const { state } = fixture();
            const pidFile = join(state, 'grandchild');
            const child = spawn(
                script,
                [
                    '--long',
                    'sh',
                    '-c',
                    `${ignore}sleep 30 & echo $! >${pidFile}; wait`,
                    // its $0: a word the line reads as a mutant script
                    'mut.py',
                ],
                {
                    env: {
                        ...queueEnv(state),
                        GATE_QUEUE_BATCH_MAX: max,
                        GATE_QUEUE_KILL_GRACE: '0.2',
                    },
                    stdio: 'ignore',
                },
            );
            const ended = new Promise((done) => child.on('exit', done));
            for (let i = 0; i < 100 && !existsSync(pidFile); i++)
                await sleep(50);
            if (signal) child.kill('SIGTERM');
            await ended;
            const pid = Number(readFileSync(pidFile, 'utf8'));
            // past the line: a line the signal left alive would mark the batch ended after the queue is gone
            await sleep(signal ? 2500 : 200);
            expect(() => process.kill(pid, 0)).toThrow();
            expect(
                readdirSync(state).filter((f) => f.endsWith('.capped')),
            ).toEqual([]);
        },
    );

    test('a batch that ends before its line leaves no sleep of the line behind', async () => {
        const { state } = fixture();
        const bin = join(state, 'bin');
        mkdirSync(bin);
        writeFileSync(join(bin, 'mut.py'), '#!/bin/sh\nexit 0\n', {
            mode: 0o755,
        });
        // a line no other run uses, so a leftover is this run's
        const max = String(170 + (process.pid % 9));
        queue(state, ['--long', 'mut.py'], '20', {
            GATE_QUEUE_BATCH_MAX: max,
            PATH: `${bin}:${process.env.PATH}`,
        });
        await sleep(200);
        const left = spawnSync('ps', ['-ax', '-o', 'command='], {
            encoding: 'utf8',
            timeout: 10_000,
        });
        expect(
            left.stdout.split('\n').filter((c) => c === `sleep ${max}`),
        ).toEqual([]);
    });

    test('a holder an older copy wrote is named by its command alone', () => {
        const { state, turn } = fixture();
        plantHolder(turn, String(process.pid), liveSince());
        const got = queue(state, ['--long', 'true'], '1');
        expect(got.stderr).toMatch(/holder: old run\n/);
    });

    test('a wait names the holder, how long it has run and its thread', () => {
        const { state, turn } = fixture();
        const threads = join(state, 'threads.json');
        writeFileSync(
            threads,
            JSON.stringify({
                threads: [{ name: '⚡ 🔧 mods | FRM-1', sessionId: 'sid-1' }],
            }),
        );
        mkdirSync(turn);
        const took = Math.floor(Date.now() / 1000) - 42;
        writeFileSync(
            join(turn, 'holder'),
            `${process.pid}\n${liveSince()}\nold run\n${took}\nsid-1\n`,
        );
        const got = queue(state, ['--long', 'true'], '1', {
            GATE_QUEUE_THREADS: threads,
        });
        expect(got.status).toBe(75);
        expect(got.stderr).toMatch(
            /holder: old run, running 4[2-4]s, from ⚡ 🔧 mods \| FRM-1/,
        );
    });

    function onLoad(state: string, load: string, args: string[]) {
        const bin = join(state, 'bin');
        mkdirSync(bin);
        writeFileSync(
            join(bin, 'uptime'),
            `#!/bin/sh\necho "1 day, load averages: ${load} 1.00 1.00"\n`,
            { mode: 0o755 },
        );
        return queue(state, ['--long', ...args], '1', {
            PATH: `${bin}:${process.env.PATH}`,
        });
    }

    // a mods suite first in line over the load, and a batch behind it at a free turn
    test.each([
        ['30.00', 600, 600, 0],
        ['3.00', 600, 600, 75],
        ['30.00', 5, 600, 75],
        ['30.00', 600, 5, 75],
        ['30.00', 600, undefined, 0],
        ['30.00', 600, 'garbage', 0],
        ['30.00', 600, '01795522718', 0],
        ['30.00', 600, '9999999999', 0],
    ])(
        'a batch goes past a mods suite over the load once the turn stood free 2 min (load %s, in line %s s, free %s s: exit %d)',
        (load, inLine, free, status) => {
            const { state, turn } = fixture();
            const ago = (s: number) => Math.floor(Date.now() / 1000) - s;
            plantTicket(turn, `0.${ago(inLine)}.m.${process.pid}`, liveSince());
            if (free !== undefined)
                writeFileSync(
                    `${turn}.freed`,
                    `${typeof free === 'string' ? free : ago(free)}\n`,
                );
            expect(onLoad(state, load, ['true']).status).toBe(status);
        },
    );

    test('a batch that the load gates lets the batch behind it past too', () => {
        const { state, turn } = fixture();
        const born = Math.floor(Date.now() / 1000) - 600;
        plantTicket(turn, `${born}.m.${process.pid}`, liveSince());
        const got = onLoad(state, '30.00', ['true']);
        expect(got.status).toBe(0);
    });

    test('a batch passes no suite while the turn is held, whatever the last release says', () => {
        const { state, turn } = fixture();
        const born = Math.floor(Date.now() / 1000) - 600;
        plantTicket(turn, `0.${born}.m.${process.pid}`, liveSince());
        plantHolder(turn, String(process.pid), liveSince());
        expect(onLoad(state, '30.00', ['true']).status).toBe(75);
    });

    // the read alone: in the script a held turn refuses the mkdir too, all but in the moment its release runs
    test('no suite reads as kept out while the turn is held', () => {
        const { turn } = fixture();
        mkdirSync(turn);
        writeFileSync(`${turn}.freed`, '5\n');
        const text = readFileSync(script, 'utf8');
        const from = text.indexOf('is_load_outside() {');
        const read = text.slice(from, text.indexOf('\n}\n', from) + 3);
        const got = spawnSync(
            '/bin/bash',
            [
                '-c',
                `set -u\nturn=${turn}\nis_low_load() { return 1; }\n${read}\nis_load_outside 0.5.m.1 && echo past; rmdir $turn; is_load_outside 0.5.m.1 && echo free`,
            ],
            { encoding: 'utf8', timeout: 10_000 },
        );
        expect([got.stdout, got.stderr]).toEqual(['free\n', '']);
    });

    test('a batch the load gates stands in line with the gated mark', async () => {
        const { state, turn } = fixture();
        const bin = join(state, 'bin');
        mkdirSync(bin);
        writeFileSync(
            join(bin, 'uptime'),
            '#!/bin/sh\necho "1 day, load averages: 30.00 1.00 1.00"\n',
            { mode: 0o755 },
        );
        const run = spawn(
            script,
            ['--long', 'sh', '-c', 'claude plugin test m; true'],
            {
                env: {
                    ...queueEnv(state, '3'),
                    PATH: `${bin}:${process.env.PATH}`,
                },
            },
        );
        const gone = new Promise((done) => run.on('exit', done));
        const tickets = () =>
            existsSync(`${turn}.tickets`)
                ? readdirSync(`${turn}.tickets`).filter(
                      (n) => !n.startsWith('.'),
                  )
                : [];
        while (!tickets().length && run.exitCode === null) await sleep(20);
        expect(tickets()).toEqual([
            expect.stringMatching(new RegExp(`^\\d+\\.m\\.${run.pid}$`)),
        ]);
        await gone;
    });

    test('a run that ends says when the turn was free, the gate slot writes nothing', () => {
        const { gateTurn, state, turn } = fixture();
        long(state, ['true']);
        expect(
            Date.now() / 1000 - Number(readFileSync(`${turn}.freed`)),
        ).toBeLessThan(30);
        hold(state);
        expect(existsSync(`${gateTurn}.freed`)).toBe(false);
    });

    // the suite that frees it waits on the load, so no run of its own writes the time
    test('a dead holder freed says when the turn was free', () => {
        const { state, turn } = fixture();
        plantHolder(turn, '999999', 'Fri Nov  6 10:00:00 2026');
        const got = onLoad(state, '30.00', ['pnpm', 'mods:test']);
        expect([got.status, existsSync(`${turn}.freed`)]).toEqual([75, true]);
    });

    test('a ticket of the old form still holds its place', () => {
        const { state, turn } = fixture();
        plantTicket(turn, `1.${process.pid}`, liveSince());
        const marker = join(state, 'ran');
        expect(long(state, ['touch', marker], '1').status).toBe(75);
        expect(existsSync(marker)).toBe(false);
    });

    test("a dead suite's ticket leaves the line", () => {
        const { state, turn } = fixture();
        plantTicket(turn, '0.1.999999', 'Fri Nov  6 10:00:00 2026');
        expect(long(state, ['sh', '-c', 'exit 6']).status).toBe(6);
        expect(readdirSync(`${turn}.tickets`)).toEqual([]);
    });

    test('--hold-long holds the long turn until it is told, its gate twin free', () => {
        const { state, turn } = fixture();
        plantHolder(turn, String(process.pid), liveSince());
        const held = queue(state, ['--hold-long', 'x', 'verify'], '1');
        expect(held.status).toBe(75);
        const free = fixture();
        const got = spawnSync(script, ['--hold-long', 'x', 'verify'], {
            encoding: 'utf8',
            env: queueEnv(free.state),
            input: '0\n',
            timeout: 10_000,
        });
        expect([got.status, got.stdout, existsSync(free.turn)]).toEqual([
            0,
            'turn\n',
            false,
        ]);
        expect(logRows(free.state)[0]?.[2]).toBe('long');
    });

    test('two runs never overlap', { timeout: 15_000 }, async () => {
        const { state } = fixture();
        const log = join(state, 'log');
        const body = `echo in >>${log}; sleep 0.2; echo out >>${log}`;
        const start = () =>
            new Promise<void>((done) => {
                spawn(script, ['--long', 'sh', '-c', body], {
                    env: queueEnv(state),
                }).on('exit', () => done());
            });
        await Promise.all([start(), start()]);
        expect(readFileSync(log, 'utf8')).toBe('in\nout\nin\nout\n');
    });
});
