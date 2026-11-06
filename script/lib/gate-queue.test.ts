import { spawn, spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, test } from 'vitest';

const script = join(import.meta.dirname, '../gate-queue.sh');

function fixture() {
    const state = mkdtempSync(
        join(process.env.TMPDIR ?? tmpdir(), 'gate-queue-'),
    );
    return {
        gateTurn: join(state, 'gate-queue.turn'),
        state,
        turn: join(state, 'gate-queue.long.turn'),
    };
}

function queueEnv(state: string, wait = '20') {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        GATE_QUEUE_WAIT: wait,
        X_STATE: state,
    };
    delete env.GATE_QUEUE_HELD;
    delete env.CLAUDE_CODE_SESSION_ID;
    return env;
}

function queue(
    state: string,
    args: string[],
    wait?: string,
    extra: NodeJS.ProcessEnv = {},
) {
    return spawnSync(script, args, {
        encoding: 'utf8',
        env: { ...queueEnv(state, wait), ...extra },
    });
}

const long = (state: string, args: string[], wait?: string) =>
    queue(state, ['--long', ...args], wait);

// what x does: --hold prints its ready line once it has the gate turn, and exits with the code x writes on its stdin
function hold(state: string, wait?: string, code = '0') {
    return spawnSync(script, ['--hold', 'x', 'lane', 'commit'], {
        encoding: 'utf8',
        env: queueEnv(state, wait),
        input: `${code}\n`,
    });
}

function logRows(state: string) {
    return readFileSync(join(state, 'gate-queue.log'), 'utf8')
        .trimEnd()
        .split('\n')
        .map((row) => row.split('\t'));
}

function plantTicket(turn: string, name: string, since: string) {
    mkdirSync(`${turn}.tickets`, { recursive: true });
    writeFileSync(join(`${turn}.tickets`, name), `${since}\n`);
}

function plantHolder(turn: string, pid: string, since: string) {
    mkdirSync(turn);
    writeFileSync(join(turn, 'holder'), `${pid}\n${since}\nold run\n`);
}

const liveSince = () =>
    spawnSync('sh', ['-c', `ps -o lstart= -p ${process.pid}`], {
        encoding: 'utf8',
    }).stdout.trimEnd();

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
        });
        expect(got.stdout.trim()).toBe('turn');
        expect(got.status).toBe(1);
        expect(existsSync(gateTurn)).toBe(false);
    });

    test('a live holder makes it wait to its deadline, never ready', () => {
        const { state, gateTurn } = fixture();
        plantHolder(gateTurn, String(process.pid), liveSince());
        const got = hold(state, '2');
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
        const got = long(state, [script, '--hold', 'x'], '2');
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
                    await sleep(1000);
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
        const got = long(state, ['touch', marker], '2');
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
        long(state, ['touch', marker], '2');
        const [row] = logRows(state);
        expect(row?.[1]).toMatch(/^\d+\.\d+$/);
        expect(Number(row?.[3])).toBeGreaterThanOrEqual(2);
        expect(row?.slice(4)).toEqual(['-', '75', '-', `touch ${marker}`]);
    });

    test('a free turn still waits behind an older live ticket', () => {
        const { state, turn } = fixture();
        plantTicket(turn, `1.${process.pid}`, liveSince());
        const marker = join(state, 'ran');
        expect(long(state, ['touch', marker], '2').status).toBe(75);
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
        expect(long(state, ['sh', '-c', 'exit 0'], '2').status).toBe(75);
        const old = new Date(Date.now() - 300_000);
        utimesSync(turn, old, old);
        expect(long(state, ['sh', '-c', 'exit 6']).status).toBe(6);
    });

    test('a waiter behind the line never frees a stale turn', () => {
        const { state, turn } = fixture();
        plantTicket(turn, `1.${process.pid}`, liveSince());
        plantHolder(turn, '999999', 'Fri Nov  6 10:00:00 2026');
        const got = long(state, ['sh', '-c', 'exit 0'], '2');
        expect(got.status).toBe(75);
        expect(existsSync(join(turn, 'holder'))).toBe(true);
    });

    test('a ticket leaves with its deadline', () => {
        const { state, turn } = fixture();
        plantHolder(turn, String(process.pid), liveSince());
        long(state, ['sh', '-c', 'exit 0'], '2');
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
        // the holder leaves only on the marker: a slow machine cannot end the line early
        const holder = run('holder', `until [ -e ${go} ]; do sleep 0.1; done`);
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

    test('two runs never overlap', { timeout: 15_000 }, async () => {
        const { state } = fixture();
        const log = join(state, 'log');
        const body = `echo in >>${log}; sleep 1; echo out >>${log}`;
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
