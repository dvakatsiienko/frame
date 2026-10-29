import { spawn } from 'node:child_process';
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
import { setTimeout as sleep } from 'node:timers/promises';
import { afterEach, expect, test } from 'vitest';

// a fixture home holding one past note and a crow transcript that already answered the reconcile
const SCRIPT = join(import.meta.dirname, 'reconcile.ts');
const NOTE_ID = '202610111830-opus';
const servers: Server[] = [];
afterEach(() => {
    for (const server of servers.splice(0)) server.close();
});

function home({ tab = true } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'crow-rec-'));
    const state = join(dir, '.local/state/crow');
    const sessions = join(dir, '.claude/sessions');
    const projects = join(
        dir,
        '.claude/projects',
        state.replaceAll(/[/.]/g, '-'),
    );
    for (const path of [state, sessions, projects])
        mkdirSync(path, { recursive: true });
    const socket = join(dir, 's.sock');
    writeFileSync(
        join(sessions, `${process.pid}.json`),
        JSON.stringify({
            cwd: state,
            ...(tab ? {} : { jobId: 'job-1' }),
            messagingSocketPath: socket,
            name: '🐦 ⬛ crow',
            pid: process.pid,
            sessionId: 'crow-1',
        }),
    );
    writeFileSync(
        join(state, 'state.json'),
        JSON.stringify({ arm: 'opus', offsets: {} }),
    );
    writeFileSync(
        join(state, 'notes.jsonl'),
        `${JSON.stringify({ id: NOTE_ID, note: 'hold the merge' })}\n`,
    );
    const turn = [
        {
            message: {
                content: `reconcile ${NOTE_ID}: the verifier re-ran on b0b0`,
            },
            timestamp: '2026-10-11T18:40:00Z',
            type: 'user',
        },
        {
            message: {
                content: [
                    { text: 'withdrawn: the head was verified', type: 'text' },
                ],
                id: 'm1',
                model: 'claude-opus-5-5',
                usage: { input_tokens: 10, output_tokens: 5 },
            },
            type: 'assistant',
        },
        {
            subtype: 'stop_hook_summary',
            timestamp: '2026-10-11T18:40:12Z',
            type: 'system',
        },
    ];
    writeFileSync(
        join(projects, 'crow-1.jsonl'),
        `${turn.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
    );
    return { dir, notes: join(state, 'notes.jsonl'), socket };
}

// async: a --bg test's socket server lives in this process, which spawnSync would block
function reconcile(fixture: ReturnType<typeof home>, ...args: string[]) {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
        env: { ...process.env, HOME: fixture.dir },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
        stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
        stderr += chunk;
    });
    return new Promise<{
        status: number | null;
        stdout: string;
        stderr: string;
    }>((done) =>
        child.on('close', (status) => done({ status, stderr, stdout })),
    );
}

async function loggedAnswer(notes: string) {
    for (let i = 0; i < 40; i++) {
        const found = readFileSync(notes, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line))
            .find((note) => note.reconciles === NOTE_ID);
        if (found) return found;
        await sleep(250);
    }
}

test('hands clio the reconcile line to relay to a tab crow', async () => {
    const fixture = home();
    const { stdout } = await reconcile(
        fixture,
        NOTE_ID,
        'the verifier re-ran on b0b0',
    );
    expect(stdout.trim().split('\n').at(-1)).toBe(
        `reconcile ${NOTE_ID}: the verifier re-ran on b0b0`,
    );
});

test('sends the reconcile line to a --bg crow’s socket', async () => {
    const fixture = home({ tab: false });
    const heard = new Promise<string>((done) => {
        const server = createServer((conn) => {
            let buffer = '';
            conn.on('data', (chunk) => {
                buffer += chunk;
            });
            conn.on('end', () => done(JSON.parse(buffer).message.content));
        }).listen(fixture.socket);
        servers.push(server);
    });
    const child = await reconcile(
        fixture,
        NOTE_ID,
        'the verifier re-ran on b0b0',
    );
    expect([child.status, await heard]).toEqual([
        0,
        `reconcile ${NOTE_ID}: the verifier re-ran on b0b0`,
    ]);
});

test('logs crow’s one answer under the note’s id', async () => {
    const fixture = home();
    await reconcile(fixture, NOTE_ID, 'the verifier re-ran on b0b0');
    const answer = await loggedAnswer(fixture.notes);
    expect([
        answer?.id,
        answer?.channel,
        answer?.evidence,
        answer?.note,
    ]).toEqual([
        `${NOTE_ID}-reconcile`,
        'reconcile',
        'the verifier re-ran on b0b0',
        'withdrawn: the head was verified',
    ]);
});

test('refuses a note id that was never logged', async () => {
    const fixture = home();
    const { status, stderr } = await reconcile(fixture, 'nope-opus', 'x');
    expect([status, stderr.trim()]).toEqual([2, 'no note with id nope-opus']);
});

test('refuses a second reconcile on the same note', async () => {
    const fixture = home();
    writeFileSync(
        fixture.notes,
        `${JSON.stringify({ id: `${NOTE_ID}-reconcile` })}\n`,
        { flag: 'a' },
    );
    const { status, stderr } = await reconcile(fixture, NOTE_ID, 'x');
    expect([status, stderr.trim()]).toEqual([
        2,
        `${NOTE_ID} is reconciled already: one answer per note`,
    ]);
});

test('refuses a second reconcile while the first waits for crow', async () => {
    const fixture = home();
    const pending = join(fixture.dir, '.local/state/crow/reconciles');
    mkdirSync(pending);
    writeFileSync(
        join(pending, `${NOTE_ID}.json`),
        JSON.stringify({ at: Date.now() }),
    );
    const { status, stderr } = await reconcile(fixture, NOTE_ID, 'again');
    expect([status, stderr.trim()]).toEqual([
        2,
        `${NOTE_ID} has a reconcile waiting for crow's answer`,
    ]);
});

test('marks a sent reconcile as waiting for crow', async () => {
    const fixture = home();
    await reconcile(fixture, NOTE_ID, 'the verifier re-ran on b0b0');
    expect(
        existsSync(
            join(fixture.dir, `.local/state/crow/reconciles/${NOTE_ID}.json`),
        ),
    ).toBe(true);
});

test('refuses a reconcile before crow ever started', async () => {
    const fixture = home();
    writeFileSync(
        join(fixture.dir, '.local/state/crow/state.json'),
        JSON.stringify({ offsets: {} }),
    );
    const { status, stderr } = await reconcile(fixture, NOTE_ID, 'x');
    expect([status, stderr.trim()]).toEqual([
        2,
        'no arm in state.json: start crow first',
    ]);
});

test('refuses to reconcile a reconcile answer', async () => {
    const fixture = home();
    writeFileSync(
        fixture.notes,
        `${JSON.stringify({ id: `${NOTE_ID}-reconcile` })}\n`,
        { flag: 'a' },
    );
    const { status, stderr } = await reconcile(
        fixture,
        `${NOTE_ID}-reconcile`,
        'x',
    );
    expect([status, stderr.trim()]).toEqual([
        2,
        `no note with id ${NOTE_ID}-reconcile`,
    ]);
});
