import { spawn, spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
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
        longTurn: join(state, 'gate-queue.long.turn'),
        state,
        turn: join(state, 'gate-queue.turn'),
    };
}

function queueEnv(state: string, wait = '20') {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        GATE_QUEUE_WAIT: wait,
        X_STATE: state,
    };
    delete env.GATE_QUEUE_HELD;
    return env;
}

function queue(state: string, args: string[], wait?: string) {
    return spawnSync(script, args, {
        encoding: 'utf8',
        env: queueEnv(state, wait),
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

describe('gate-queue', () => {
    test('hands back the command exit code and frees the turn', () => {
        const { state, turn } = fixture();
        expect(queue(state, ['sh', '-c', 'exit 7']).status).toBe(7);
        expect(existsSync(turn)).toBe(false);
    });

    test('a live holder makes the run wait to its deadline, and nothing runs', () => {
        const { state, turn } = fixture();
        plantHolder(turn, String(process.pid), liveSince());
        const marker = join(state, 'ran');
        const got = queue(state, ['touch', marker], '2');
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
        const got = queue(state, ['sh', '-c', 'exit 0']);
        expect(got.status).toBe(0);
        expect(got.stderr).toContain('freed');
    });

    test('a queued run calling a queued run keeps its turn', () => {
        const { state } = fixture();
        const got = queue(state, [script, 'sh', '-c', 'exit 3'], '2');
        expect(got.status).toBe(3);
    });

    test('a long run does not wait behind a gate holder', () => {
        const { state, turn } = fixture();
        plantHolder(turn, String(process.pid), liveSince());
        const got = queue(state, ['--long', 'sh', '-c', 'exit 4'], '2');
        expect(got.status).toBe(4);
        expect(existsSync(turn)).toBe(true);
    });

    test('a gate does not wait behind a long holder', () => {
        const { state, longTurn } = fixture();
        plantHolder(longTurn, String(process.pid), liveSince());
        expect(queue(state, ['sh', '-c', 'exit 5'], '2').status).toBe(5);
        expect(existsSync(longTurn)).toBe(true);
    });

    test('a long run waits behind a long holder to its deadline', () => {
        const { state, longTurn } = fixture();
        plantHolder(longTurn, String(process.pid), liveSince());
        const got = queue(state, ['--long', 'sh', '-c', 'exit 0'], '2');
        expect(got.status).toBe(75);
        expect(got.stderr).toContain('old run');
        expect(existsSync(longTurn)).toBe(true);
    });

    test('--long with no command is a usage error', () => {
        const { state } = fixture();
        expect(queue(state, ['--long']).status).toBe(2);
    });

    test('a finished run logs its slot, wait, run seconds, exit and command', () => {
        const { state } = fixture();
        queue(state, ['sh', '-c', 'exit 7']);
        queue(state, ['--long', 'sh', '-c', 'exit 0']);
        // the two seconds columns are wall clock: a number, never a value
        const rows = logRows(state).map((row) => row.slice(2));
        expect(rows.map(([slot, , , exit, cmd]) => [slot, exit, cmd])).toEqual([
            ['gate', '7', 'sh -c exit 7'],
            ['long', '0', 'sh -c exit 0'],
        ]);
        expect(rows.flatMap((row) => row.slice(1, 3))).toEqual(
            Array(4).fill(expect.stringMatching(/^\d+$/)),
        );
    });

    test('a wait past its deadline logs no run seconds and exit 75', () => {
        const { state, turn } = fixture();
        plantHolder(turn, String(process.pid), liveSince());
        const marker = join(state, 'ran');
        queue(state, ['touch', marker], '2');
        const [row] = logRows(state);
        expect(row?.[1]).toMatch(/^\d+\.\d+$/);
        expect(Number(row?.[3])).toBeGreaterThanOrEqual(2);
        expect(row?.slice(4)).toEqual(['-', '75', `touch ${marker}`]);
    });

    test('a nested run writes no row of its own', () => {
        const { state } = fixture();
        queue(state, [script, 'sh', '-c', 'exit 0']);
        expect(logRows(state)).toHaveLength(1);
    });

    test('a free turn still waits behind an older live ticket', () => {
        const { state, turn } = fixture();
        plantTicket(turn, `1.${process.pid}`, liveSince());
        const marker = join(state, 'ran');
        expect(queue(state, ['touch', marker], '2').status).toBe(75);
        expect(existsSync(marker)).toBe(false);
    });

    test.each([
        ['a dead pid', '1.999999', 'Fri Nov  6 10:00:00 2026'],
        ['a reused pid', `1.${process.pid}`, 'Fri Nov  6 10:00:00 2026'],
    ])('%s leaves the line', (_name, name, since) => {
        const { state, turn } = fixture();
        plantTicket(turn, name, since);
        expect(queue(state, ['sh', '-c', 'exit 6']).status).toBe(6);
        expect(readdirSync(`${turn}.tickets`)).toEqual([]);
    });

    test('a ticket leaves with its deadline', () => {
        const { state, turn } = fixture();
        plantHolder(turn, String(process.pid), liveSince());
        queue(state, ['sh', '-c', 'exit 0'], '2');
        expect(readdirSync(`${turn}.tickets`)).toEqual([]);
    });

    test('a newcomer never jumps a waiter', { timeout: 30_000 }, async () => {
        const { state, turn } = fixture();
        const log = join(state, 'log');
        const run = (name: string, seconds = 0) =>
            new Promise<void>((done) => {
                spawn(
                    script,
                    ['sh', '-c', `sleep ${seconds}; echo ${name} >>${log}`],
                    { env: queueEnv(state) },
                ).on('exit', () => done());
            });
        const tickets = () => readdirSync(`${turn}.tickets`).length;
        const lined = async (count: number) => {
            while (!existsSync(`${turn}.tickets`) || tickets() !== count)
                await sleep(50);
        };
        const holder = run('holder', 6);
        while (!existsSync(turn)) await sleep(50);
        const first = run('first');
        await lined(1);
        await sleep(1100);
        const second = run('second');
        await lined(2);
        await Promise.all([holder, first, second]);
        expect(readFileSync(log, 'utf8')).toBe('holder\nfirst\nsecond\n');
    });

    test('two runs never overlap', { timeout: 15_000 }, async () => {
        const { state } = fixture();
        const log = join(state, 'log');
        const body = `echo in >>${log}; sleep 1; echo out >>${log}`;
        const start = () =>
            new Promise<void>((done) => {
                spawn(script, ['sh', '-c', body], {
                    env: queueEnv(state),
                }).on('exit', () => done());
            });
        await Promise.all([start(), start()]);
        expect(readFileSync(log, 'utf8')).toBe('in\nout\nin\nout\n');
    });
});
