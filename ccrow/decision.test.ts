import { spawn } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { type Server, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

// a fixture home with a ccrow socket this test owns, so the live ccrow is never touched
const HOOK = join(import.meta.dirname, 'decision.ts');
const servers: Server[] = [];
afterEach(() => {
    for (const server of servers.splice(0)) server.close();
});

function home({ tab = false } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'ccrow-dec-'));
    const sessions = join(dir, '.claude/sessions');
    mkdirSync(sessions, { recursive: true });
    mkdirSync(join(dir, '.claude/shelf'), { recursive: true });
    mkdirSync(join(dir, '.local/state/ccrow'), { recursive: true });
    mkdirSync(join(dir, 'bin'));
    const socket = join(dir, 's.sock');
    writeFileSync(
        join(sessions, '1.json'),
        JSON.stringify({ name: '🦉 cclio', sessionId: 'cclio-1' }),
    );
    writeFileSync(
        join(sessions, `${process.pid}.json`),
        JSON.stringify({
            cwd: dir,
            ...(tab ? {} : { jobId: 'job-1' }),
            messagingSocketPath: socket,
            name: '🐦 ⬛ ccrow',
            pid: process.pid,
            sessionId: 'ccrow-1',
        }),
    );
    const transcript = join(dir, 'cclio-1.jsonl');
    writeFileSync(
        transcript,
        `${JSON.stringify({ message: { content: 'merge it' }, type: 'user' })}\n`,
    );
    writeFileSync(
        join(dir, '.claude/shelf/pr-verified.json'),
        JSON.stringify({ 'dvakatsiienko/frame#82': 'a2cfe573' }),
    );
    writeFileSync(
        join(dir, 'bin/gh'),
        `#!/bin/bash\necho '{"number":82,"headRefOid":"b0b0b0b0aaaa","url":"https://github.com/dvakatsiienko/frame/pull/82"}'\n`,
    );
    chmodSync(join(dir, 'bin/gh'), 0o755);
    return { dir, socket, transcript };
}

// a fake ccrow: records every wake line, and answers a merge wake by writing its note file
function ccrow(socket: string, note?: string) {
    const lines: string[] = [];
    let heard: (line: string) => void = () => {};
    const first = new Promise<string>((done) => {
        heard = done;
    });
    const server = createServer((conn) => {
        let buffer = '';
        conn.on('data', (chunk) => {
            buffer += chunk;
        });
        conn.on('end', () => {
            const line: string = JSON.parse(buffer).message.content;
            lines.push(line);
            const path = / · note (\S+)$/.exec(line)?.[1];
            if (path && note) writeFileSync(path, note);
            heard(line);
        });
    }).listen(socket);
    servers.push(server);
    return { first, lines };
}

// every wake writes state.json, so its absence after the hook exits is the signal that none fired
const stateOf = (fixture: ReturnType<typeof home>) =>
    join(fixture.dir, '.local/state/ccrow/state.json');

function hook(
    fixture: ReturnType<typeof home>,
    command: string,
    waitMs = 5_000,
) {
    const child = spawn(process.execPath, [HOOK], {
        env: {
            ...process.env,
            CCROW_DECISION_WAIT_MS: String(waitMs),
            HOME: fixture.dir,
            PATH: `${join(fixture.dir, 'bin')}:${process.env.PATH}`,
        },
    });
    child.stdin.end(
        JSON.stringify({
            cwd: fixture.dir,
            tool_input: { command },
            transcript_path: fixture.transcript,
        }),
    );
    let out = '';
    child.stdout.on('data', (chunk) => {
        out += chunk;
    });
    const started = Date.now();
    return new Promise<{
        out: Hook | undefined;
        code: number | null;
        ms: number;
    }>((done) =>
        child.on('close', (code) =>
            done({
                code,
                ms: Date.now() - started,
                out: out.trim() ? JSON.parse(out) : undefined,
            }),
        ),
    );
}

describe('a merge in the coordinator session', () => {
    test('wakes ccrow once with the pr, the verified head and the current head', async () => {
        const fixture = home();
        const { lines } = ccrow(
            fixture.socket,
            'hold: two commits past the clean',
        );
        await hook(fixture, 'gh pr merge 82 -R dvakatsiienko/frame --squash');
        expect(
            lines.map((line) =>
                / · mode decision · .* · merge dvakatsiienko\/frame#82 · verified a2cfe573 · head b0b0b0b0aaaa · note /.test(
                    line,
                ),
            ),
        ).toEqual([true]);
    });

    test('carries ccrow’s note into the merge as one context line', async () => {
        const fixture = home();
        ccrow(fixture.socket, 'hold: two commits past the clean');
        const { code, out } = await hook(fixture, 'gh pr merge 82 --squash');
        expect([code, out?.hookSpecificOutput.additionalContext]).toEqual([
            0,
            "🐦‍⬛ dvakatsiienko/frame#82 (verified a2cfe573, head b0b0b0b0: unverified delta): ccrow's note: hold: two commits past the clean",
        ]);
    });

    test('says ccrow is silent when no note lands in time', async () => {
        const fixture = home();
        ccrow(fixture.socket);
        const { out } = await hook(fixture, 'gh pr merge 82', 1_000);
        expect(out?.hookSpecificOutput.additionalContext).toMatch(
            /: ccrow silent after 1 s$/,
        );
    });

    test('denies a tab ccrow’s first merge with the wake line to relay', async () => {
        const fixture = home({ tab: true });
        const { out } = await hook(fixture, 'gh pr merge 82');
        expect([
            out?.hookSpecificOutput.permissionDecision,
            /\nccrow wake \S+ · mode decision .* · merge dvakatsiienko\/frame#82 · /.test(
                out?.hookSpecificOutput.permissionDecisionReason ?? '',
            ),
        ]).toEqual(['deny', true]);
    });

    test('lets a tab ccrow’s rerun pass with the note ccrow wrote', async () => {
        const fixture = home({ tab: true });
        const first = await hook(fixture, 'gh pr merge 82');
        const notePath = / · note (\S+)$/.exec(
            first.out?.hookSpecificOutput.permissionDecisionReason ?? '',
        )?.[1];
        writeFileSync(notePath ?? '', 'none');
        const { out } = await hook(fixture, 'gh pr merge 82');
        expect([
            out?.hookSpecificOutput.permissionDecision,
            out?.hookSpecificOutput.additionalContext,
        ]).toEqual([
            undefined,
            "🐦‍⬛ dvakatsiienko/frame#82 (verified a2cfe573, head b0b0b0b0: unverified delta): ccrow's note: none",
        ]);
    });
});

describe('a spawn in the coordinator session', () => {
    const spawnLine =
        'cd ~/frame && claude --bg -n "☕️ 🔧 x" "/x:crew-coder FRM-1"';

    test('wakes ccrow with a spawn line', async () => {
        const fixture = home();
        const { first } = ccrow(fixture.socket);
        await hook(fixture, spawnLine);
        expect(await first).toMatch(/ · mode decision · .* · spawn$/);
    });

    test('hands cclio the spawn line to relay to a tab ccrow', async () => {
        const fixture = home({ tab: true });
        const { out } = await hook(fixture, spawnLine);
        expect(out?.hookSpecificOutput.additionalContext).toMatch(
            /\nccrow wake \S+ · mode decision · .* · spawn$/,
        );
    });

    test('runs on without waiting for a note', async () => {
        const fixture = home();
        ccrow(fixture.socket);
        const { ms, out } = await hook(fixture, spawnLine, 60_000);
        expect([out, ms < 10_000]).toEqual([undefined, true]);
    });
});

describe('a push to main', () => {
    test('wakes nothing', async () => {
        const fixture = home();
        ccrow(fixture.socket, 'x');
        const { out } = await hook(fixture, 'x lane push --apply');
        expect([existsSync(stateOf(fixture)), out]).toEqual([false, undefined]);
    });
});

test('a session other than cclio wakes nothing', async () => {
    const fixture = home();
    ccrow(fixture.socket, 'x');
    writeFileSync(
        join(fixture.dir, '.claude/sessions/1.json'),
        JSON.stringify({ name: '☕️ 🔧 coder', sessionId: 'cclio-1' }),
    );
    await hook(fixture, 'gh pr merge 82');
    expect(existsSync(stateOf(fixture))).toBe(false);
});

test('a decision wake leaves the Stop wake’s 30-min clock alone', async () => {
    const fixture = home();
    ccrow(fixture.socket, 'none');
    const state = stateOf(fixture);
    writeFileSync(state, JSON.stringify({ lastWakeAt: 5, offsets: {} }));
    await hook(fixture, 'gh pr merge 82');
    expect(JSON.parse(readFileSync(state, 'utf8')).lastWakeAt).toBe(5);
});

/* Types */

interface Hook {
    hookSpecificOutput: {
        additionalContext?: string;
        permissionDecision?: string;
        permissionDecisionReason?: string;
    };
}
