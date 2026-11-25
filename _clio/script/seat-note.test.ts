/* Core */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, expect, test } from 'vitest';

const hook =
    process.env.SEAT_NOTE_HOOK ??
    path.resolve(import.meta.dirname, '../.claude/hooks/seat-note.sh');
let state = '';

beforeEach(() => {
    state = mkdtempSync(path.join(tmpdir(), 'seat-note-'));
    mkdirSync(path.join(state, 'seat-notes'));
    mkdirSync(path.join(state, 'bin'));
    // the real trash would fill dima's Trash from a test
    writeFileSync(
        path.join(state, 'bin/trash'),
        '#!/bin/bash\nexec rm -f "$@"\n',
        { mode: 0o755 },
    );
});

const noteOf = (session: string) => path.join(state, 'seat-notes', session);

const readNote = (session: string, prompt = 'go on') =>
    new Promise<{ code: number | null; out: string }>((resolve) => {
        const child = spawn('bash', [hook], {
            env: {
                ...process.env,
                FORK_GUARD_STATE: state,
                PATH: `${path.join(state, 'bin')}:${process.env.PATH}`,
            },
        });
        let out = '';
        child.stdout.on('data', (part) => {
            out += part;
        });
        child.on('close', (code) => resolve({ code, out }));
        child.stdin.end(JSON.stringify({ prompt, session_id: session }));
    });

test('no note prints nothing', async () => {
    expect(await readNote('s1')).toEqual({ code: 0, out: '' });
});

test('a note is read once, at the next prompt', async () => {
    writeFileSync(noteOf('s1'), 'you are a wing now\n');
    expect(await readNote('s1')).toEqual({
        code: 0,
        out: 'you are a wing now\n',
    });
    expect(await readNote('s1')).toEqual({ code: 0, out: '' });
});

test('two prompts at once print it once', async () => {
    writeFileSync(noteOf('s1'), 'you are main now\n');
    const outs = await Promise.all([readNote('s1'), readNote('s1')]);
    expect(outs.map(({ out }) => out).sort()).toEqual([
        '',
        'you are main now\n',
    ]);
});

test('a prompt that is the line itself reads it once', async () => {
    writeFileSync(noteOf('s1'), 'you are main now\n');
    expect(await readNote('s1', 'you are main now')).toEqual({
        code: 0,
        out: '',
    });
    expect(existsSync(noteOf('s1'))).toBe(false);
});

test("another session's note stays", async () => {
    writeFileSync(noteOf('s2'), 'you are main now\n');
    expect((await readNote('s1')).out).toBe('');
    expect(existsSync(noteOf('s2'))).toBe(true);
});

test('a session id that is no file name moves nothing', async () => {
    writeFileSync(path.join(state, 'main-session'), 'pid=1\n');
    expect(await readNote('../main-session')).toEqual({ code: 0, out: '' });
    expect(existsSync(path.join(state, 'main-session'))).toBe(true);
});
