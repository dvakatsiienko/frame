import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// the gate queue's test kit: a state dir per test, the script run against it
export const script = join(import.meta.dirname, '../gate-queue.sh');

export function fixture() {
    const state = mkdtempSync(
        join(process.env.TMPDIR ?? tmpdir(), 'gate-queue-'),
    );
    return {
        gateTurn: join(state, 'gate-queue.turn'),
        state,
        turn: join(state, 'gate-queue.long.turn'),
    };
}

export function queueEnv(state: string, wait = '20') {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        GATE_QUEUE_POLL: '0.1',
        GATE_QUEUE_WAIT: wait,
        X_STATE: state,
    };
    delete env.GATE_QUEUE_HELD;
    delete env.CLAUDE_CODE_SESSION_ID;
    return env;
}

export function queue(
    state: string,
    args: string[],
    wait?: string,
    extra: NodeJS.ProcessEnv = {},
) {
    return spawnSync(script, args, {
        encoding: 'utf8',
        env: { ...queueEnv(state, wait), ...extra },
        timeout: 10_000,
    });
}

export const long = (state: string, args: string[], wait?: string) =>
    queue(state, ['--long', ...args], wait);

// what x does: --hold prints its ready line once it has the gate turn, and exits with the code x writes on its stdin
export function hold(state: string, wait?: string, code = '0') {
    return spawnSync(script, ['--hold', 'x', 'lane', 'commit'], {
        encoding: 'utf8',
        env: queueEnv(state, wait),
        input: `${code}\n`,
        timeout: 10_000,
    });
}

export function logRows(state: string) {
    return readFileSync(join(state, 'gate-queue.log'), 'utf8')
        .trimEnd()
        .split('\n')
        .map((row) => row.split('\t'));
}

export function plantTicket(turn: string, name: string, since: string) {
    mkdirSync(`${turn}.tickets`, { recursive: true });
    writeFileSync(join(`${turn}.tickets`, name), `${since}\n`);
}

export function plantHolder(turn: string, pid: string, since: string) {
    mkdirSync(turn);
    writeFileSync(join(turn, 'holder'), `${pid}\n${since}\nold run\n`);
}

export const liveSince = () =>
    spawnSync('sh', ['-c', `ps -o lstart= -p ${process.pid}`], {
        encoding: 'utf8',
        timeout: 10_000,
    }).stdout.trimEnd();
