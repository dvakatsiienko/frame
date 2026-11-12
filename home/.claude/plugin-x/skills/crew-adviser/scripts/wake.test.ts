import { spawn, spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { type Server, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';

import { CROW_RECORD, plantThreads } from './fixtures/threads.ts';

// a fixture home: two clio threads, a --bg crow on a socket this test owns, so the live crow is never touched
const WAKE = join(import.meta.dirname, 'wake.ts');
const servers: Server[] = [];
afterEach(() => {
    for (const server of servers.splice(0)) server.close();
});

// a step is one model request: crow counts them by message id
const steps = Array.from({ length: 12 }, (_, n) =>
    JSON.stringify({
        message: { content: [{ text: 'a step', type: 'text' }], id: `m${n}` },
        type: 'assistant',
    }),
).join('\n');

function home() {
    const dir = mkdtempSync(join(tmpdir(), 'crow-wake-'));
    const sessions = join(dir, '.claude/sessions');
    const state = join(dir, 'state');
    mkdirSync(sessions, { recursive: true });
    mkdirSync(state);
    const socket = join(dir, 's.sock');
    const threads = {
        main: { name: '🦉 clio', sessionId: 'clio-main' },
        wing: { name: '🦉🪽 clio: wing 2', sessionId: 'clio-wing' },
    };
    for (const [key, entry] of Object.entries(threads)) {
        writeFileSync(join(sessions, `${key}.json`), JSON.stringify(entry));
        writeFileSync(join(dir, `${entry.sessionId}.jsonl`), `${steps}\n`);
    }
    plantThreads(dir, [
        { display: '🦉 clio', role: 'coordinator', sessionId: 'clio-main' },
        {
            display: '🦉🪽 clio: wing 2',
            role: 'wing',
            sessionId: 'clio-wing',
            wing: 2,
        },
        CROW_RECORD,
    ]);
    writeFileSync(
        join(sessions, `${process.pid}.json`),
        JSON.stringify({
            cwd: dir,
            jobId: 'job-1',
            messagingSocketPath: socket,
            name: '🐦 ⬛ crow',
            pid: process.pid,
            sessionId: 'crow-1',
        }),
    );
    const lines: string[] = [];
    const server = createServer((conn) => {
        let buffer = '';
        conn.on('data', (chunk) => {
            buffer += chunk;
        });
        conn.on('end', () => lines.push(JSON.parse(buffer).message.content));
    }).listen(socket);
    servers.push(server);
    const wake = (thread: keyof typeof threads) =>
        new Promise<string>((done) => {
            // async, so this process's own socket server can take the wake line
            const child = spawn(
                process.execPath,
                [
                    WAKE,
                    '--transcript',
                    join(dir, `${threads[thread].sessionId}.jsonl`),
                ],
                {
                    env: {
                        ...process.env,
                        CROW_STATE_DIR: state,
                        HOME: dir,
                        PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
                    },
                },
            );
            let out = '';
            child.stdout.on('data', (chunk) => {
                out += chunk;
            });
            child.on('close', () => done(out.trim()));
        });
    return { lines, state, wake };
}

test('each clio thread runs on its own 30 min clock', async () => {
    const fixture = home();
    const main = await fixture.wake('main');
    const wing = await fixture.wake('wing');
    const again = await fixture.wake('wing');
    expect([
        /^woke \d{12} main /.test(main),
        /^woke \d{12}w2 wing-2 /.test(wing),
        again.startsWith('skipped: last wake 0 min ago'),
    ]).toEqual([true, true, true]);
});

test("a wing's wake line names the wing to reply to", async () => {
    const fixture = home();
    await fixture.wake('wing');
    await new Promise((done) => setTimeout(done, 200));
    expect(fixture.lines.at(-1)).toContain(
        '· thread wing-2 · reply to «🦉🪽 clio: wing 2»',
    );
});

test("a wake's state write keeps what a peer thread wrote while it packed", () => {
    const state = mkdtempSync(join(tmpdir(), 'crow-merge-'));
    writeFileSync(
        join(state, 'state.json'),
        JSON.stringify({ lastWakeAt: { main: 1 }, offsets: { main: 5 } }),
    );
    // the wing packed from a read taken before main's write: it knows nothing of main
    const script = `import { writeWakeState, readState } from ${JSON.stringify(join(import.meta.dirname, 'lib.ts'))};
writeWakeState({ packed: { offsets: { wing: 9 } }, thread: 'wing-2', transcriptPath: 'wing', wakeAt: 2 });
const s = readState();
console.log(JSON.stringify([s.offsets, s.lastWakeAt]));`;
    const child = spawnSync(
        process.execPath,
        ['--input-type=module', '-e', script],
        {
            encoding: 'utf8',
            env: { ...process.env, CROW_STATE_DIR: state },
            timeout: 10_000,
        },
    );
    expect(JSON.parse(child.stdout)).toEqual([
        { main: 5, wing: 9 },
        { main: 1, 'wing-2': 2 },
    ]);
});

test('a wake that cannot reach crow leaves a failed line in harvest.log', async () => {
    const fixture = home();
    for (const server of servers.splice(0)) server.close();
    await fixture.wake('main');
    const log = join(fixture.state, 'harvest.log');
    expect(existsSync(log) && readFileSync(log, 'utf8')).toMatch(
        / main failed: cannot reach crow's socket/,
    );
});

test('a skipped trigger names its thread and reason in harvest.log', async () => {
    const fixture = home();
    await fixture.wake('wing');
    await fixture.wake('wing');
    const log = join(fixture.state, 'harvest.log');
    expect(existsSync(log) && readFileSync(log, 'utf8')).toMatch(
        / wing-2 skipped: last wake 0 min ago/,
    );
});
