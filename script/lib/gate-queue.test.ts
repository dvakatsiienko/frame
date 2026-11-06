import { spawn, spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const script = join(import.meta.dirname, '../gate-queue.sh');

function fixture() {
    const state = mkdtempSync(
        join(process.env.TMPDIR ?? tmpdir(), 'gate-queue-'),
    );
    return { state, turn: join(state, 'gate-queue.turn') };
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
