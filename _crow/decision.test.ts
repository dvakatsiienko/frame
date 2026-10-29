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
import { setTimeout as sleep } from 'node:timers/promises';
import { afterEach, describe, expect, test } from 'vitest';

// a fixture home with a crow socket this test owns, so the live crow is never touched
const HOOK = join(import.meta.dirname, 'decision.ts');
const servers: Server[] = [];
afterEach(() => {
    for (const server of servers.splice(0)) server.close();
});

function home({ tab = false } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'crow-dec-'));
    const sessions = join(dir, '.claude/sessions');
    mkdirSync(sessions, { recursive: true });
    mkdirSync(join(dir, '.claude/shelf'), { recursive: true });
    mkdirSync(join(dir, '.local/state/crow'), { recursive: true });
    mkdirSync(join(dir, 'bin'));
    const socket = join(dir, 's.sock');
    writeFileSync(
        join(sessions, '1.json'),
        JSON.stringify({ name: '🦉 clio', sessionId: 'clio-1' }),
    );
    writeFileSync(
        join(sessions, `${process.pid}.json`),
        JSON.stringify({
            cwd: dir,
            ...(tab ? {} : { jobId: 'job-1' }),
            messagingSocketPath: socket,
            name: '🐦 ⬛ crow',
            pid: process.pid,
            sessionId: 'crow-1',
        }),
    );
    const transcript = join(dir, 'clio-1.jsonl');
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

// a fake crow: records every wake line, and answers a merge wake by writing its note file
function crow(socket: string, note?: string) {
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
    join(fixture.dir, '.local/state/crow/state.json');

// a string is a Bash command at PreToolUse; a write lands at PostToolUse
function hook(
    fixture: ReturnType<typeof home>,
    call: string | { tool: string; path: string },
    waitMs = 5_000,
) {
    const child = spawn(process.execPath, [HOOK], {
        env: {
            ...process.env,
            CROW_DECISION_WAIT_MS: String(waitMs),
            HOME: fixture.dir,
            PATH: `${join(fixture.dir, 'bin')}:${process.env.PATH}`,
        },
    });
    child.stdin.end(
        JSON.stringify({
            cwd: fixture.dir,
            transcript_path: fixture.transcript,
            ...(typeof call === 'string'
                ? {
                      hook_event_name: 'PreToolUse',
                      tool_input: { command: call },
                      tool_name: 'Bash',
                  }
                : {
                      hook_event_name: 'PostToolUse',
                      tool_input: { file_path: call.path },
                      tool_name: call.tool,
                  }),
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
    test('wakes crow once with the pr, the verified head and the current head', async () => {
        const fixture = home();
        const { lines } = crow(
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

    test('carries crow’s note into the merge as one context line', async () => {
        const fixture = home();
        crow(fixture.socket, 'hold: two commits past the clean');
        const { code, out } = await hook(fixture, 'gh pr merge 82 --squash');
        expect([code, out?.hookSpecificOutput.additionalContext]).toEqual([
            0,
            "🐦‍⬛ dvakatsiienko/frame#82 (verified a2cfe573, head b0b0b0b0: unverified delta): crow's note: hold: two commits past the clean",
        ]);
    });

    test('says crow is silent when no note lands in time', async () => {
        const fixture = home();
        crow(fixture.socket);
        const { out } = await hook(fixture, 'gh pr merge 82', 1_000);
        expect(out?.hookSpecificOutput.additionalContext).toMatch(
            /: crow silent after 1 s$/,
        );
    });

    test('denies a tab crow’s first merge with the wake line to relay', async () => {
        const fixture = home({ tab: true });
        const { out } = await hook(fixture, 'gh pr merge 82');
        expect([
            out?.hookSpecificOutput.permissionDecision,
            /\ncrow wake \S+ · mode decision .* · merge dvakatsiienko\/frame#82 · /.test(
                out?.hookSpecificOutput.permissionDecisionReason ?? '',
            ),
        ]).toEqual(['deny', true]);
    });

    test('lets a tab crow’s rerun pass with the note crow wrote', async () => {
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
            "🐦‍⬛ dvakatsiienko/frame#82 (verified a2cfe573, head b0b0b0b0: unverified delta): crow's note: none",
        ]);
    });
});

describe('a spawn in the coordinator session', () => {
    const spawnLine =
        'cd ~/frame && claude --bg -n "☕️ 🔧 x" "/x:crew-codie FRM-1"';

    test('wakes crow with a spawn line', async () => {
        const fixture = home();
        const { first } = crow(fixture.socket);
        await hook(fixture, spawnLine);
        expect(await first).toMatch(/ · mode decision · .* · spawn$/);
    });

    test('hands clio the spawn line to relay to a tab crow', async () => {
        const fixture = home({ tab: true });
        const { out } = await hook(fixture, spawnLine);
        expect(out?.hookSpecificOutput.additionalContext).toMatch(
            /\ncrow wake \S+ · mode decision · .* · spawn$/,
        );
    });

    test('runs on without waiting for a note', async () => {
        const fixture = home();
        crow(fixture.socket);
        const { ms, out } = await hook(fixture, spawnLine, 60_000);
        expect([out, ms < 10_000]).toEqual([undefined, true]);
    });
});

describe('a proposal clio writes', () => {
    function proposal(fixture: ReturnType<typeof home>) {
        const path = join(fixture.dir, '.scratch/sweep/step-4-proposal.md');
        mkdirSync(join(fixture.dir, '.scratch/sweep'), { recursive: true });
        writeFileSync(path, '# step 4\n\ncut the rules sweep in two\n');
        return path;
    }

    test('wakes crow with a proposal line', async () => {
        const fixture = home();
        const path = proposal(fixture);
        const { first } = crow(fixture.socket);
        await hook(fixture, { path, tool: 'Write' });
        expect(await first).toMatch(
            new RegExp(` · mode decision · .* · proposal ${path}$`),
        );
    });

    test('puts the proposal file whole into the packet', async () => {
        const fixture = home();
        const path = proposal(fixture);
        const { first } = crow(fixture.socket);
        await hook(fixture, { path, tool: 'Edit' });
        const packet = / · packet (\S+) /.exec(await first)?.[1] ?? '';
        expect(readFileSync(packet, 'utf8')).toContain(
            `## proposal · ${path}\n\n# step 4\n\ncut the rules sweep in two\n`,
        );
    });

    test('opens the packet with crow’s ledger line', async () => {
        const fixture = home();
        const path = proposal(fixture);
        const { first } = crow(fixture.socket);
        await hook(fixture, { path, tool: 'Write' });
        const packet = / · packet (\S+) /.exec(await first)?.[1] ?? '';
        expect(readFileSync(packet, 'utf8').split('\n')[0]).toMatch(
            /^📒 \d+ sent today \| .*🎯 \d+ ok today$/,
        );
    });

    test('runs on without waiting for a note', async () => {
        const fixture = home();
        const path = proposal(fixture);
        crow(fixture.socket);
        const { ms, out } = await hook(
            fixture,
            { path, tool: 'Write' },
            60_000,
        );
        expect([out, ms < 10_000]).toEqual([undefined, true]);
    });

    test('hands clio the proposal line to relay to a tab crow', async () => {
        const fixture = home({ tab: true });
        const path = proposal(fixture);
        const { out } = await hook(fixture, { path, tool: 'Write' });
        expect(out?.hookSpecificOutput).toEqual({
            additionalContext: expect.stringMatching(
                new RegExp(
                    `\\ncrow wake \\S+ · mode decision · .* · proposal ${path}$`,
                ),
            ),
            hookEventName: 'PostToolUse',
        });
    });

    test('tells clio to hold a boot board for the note, any other proposal not', async () => {
        const fixture = home({ tab: true });
        mkdirSync(join(fixture.dir, '.scratch/boot-2026-10-12'), {
            recursive: true,
        });
        const board = join(
            fixture.dir,
            '.scratch/boot-2026-10-12/board-proposal.md',
        );
        writeFileSync(board, '# board\n');
        const held = await hook(fixture, { path: board, tool: 'Write' });
        const other = await hook(fixture, {
            path: proposal(fixture),
            tool: 'Write',
        });
        expect([
            held.out?.hookSpecificOutput?.additionalContext?.includes(
                'the board waits on her note',
            ),
            other.out?.hookSpecificOutput?.additionalContext?.includes(
                'do not wait for it',
            ),
        ]).toEqual([true, true]);
    });

    test('a boot board starts the Stop wake gap, any other proposal leaves it', async () => {
        const fixture = home({ tab: true });
        mkdirSync(join(fixture.dir, '.scratch/boot-2026-10-12'), {
            recursive: true,
        });
        const board = join(
            fixture.dir,
            '.scratch/boot-2026-10-12/board-proposal.md',
        );
        writeFileSync(board, '# board\n');
        const stateOf = () =>
            JSON.parse(
                readFileSync(
                    join(fixture.dir, '.local/state/crow/state.json'),
                    'utf8',
                ),
            );
        await hook(fixture, { path: proposal(fixture), tool: 'Write' });
        const before = stateOf().lastWakeAt;
        await hook(fixture, { path: board, tool: 'Write' });
        expect([before, typeof stateOf().lastWakeAt]).toEqual([
            undefined,
            'number',
        ]);
    });

    test('wakes crow once for several edits in one turn', async () => {
        const fixture = home();
        const path = proposal(fixture);
        const { lines } = crow(fixture.socket);
        await hook(fixture, { path, tool: 'Write' });
        await hook(fixture, { path, tool: 'Edit' });
        await hook(fixture, { path, tool: 'Edit' });
        await sleep(300);
        expect(lines.length).toBe(1);
    });

    test('wakes crow again when the next turn edits the proposal', async () => {
        const fixture = home();
        const path = proposal(fixture);
        const { lines } = crow(fixture.socket);
        await hook(fixture, { path, tool: 'Write' });
        writeFileSync(
            fixture.transcript,
            `${JSON.stringify({ message: { content: [{ content: 'ok', type: 'tool_result' }] }, type: 'user' })}\n`,
            { flag: 'a' },
        );
        await hook(fixture, { path, tool: 'Edit' });
        writeFileSync(
            fixture.transcript,
            `${JSON.stringify({ message: { content: 'cut step 2' }, type: 'user' })}\n`,
            { flag: 'a' },
        );
        await hook(fixture, { path, tool: 'Edit' });
        await sleep(300);
        expect(lines.length).toBe(2);
    });

    test('wakes nothing on a write to any other file', async () => {
        const fixture = home();
        crow(fixture.socket, 'x');
        const path = join(fixture.dir, '.scratch/sweep/spec.md');
        mkdirSync(join(fixture.dir, '.scratch/sweep'), { recursive: true });
        writeFileSync(path, 'a spec');
        await hook(fixture, { path, tool: 'Write' });
        expect(existsSync(stateOf(fixture))).toBe(false);
    });

    test('wakes nothing on a read of a proposal', async () => {
        const fixture = home();
        const path = proposal(fixture);
        crow(fixture.socket, 'x');
        await hook(fixture, { path, tool: 'Read' });
        expect(existsSync(stateOf(fixture))).toBe(false);
    });
});

describe('a push to main', () => {
    test('wakes nothing', async () => {
        const fixture = home();
        crow(fixture.socket, 'x');
        const { out } = await hook(fixture, 'x lane push --apply');
        expect([existsSync(stateOf(fixture)), out]).toEqual([false, undefined]);
    });
});

test('a session other than clio wakes nothing', async () => {
    const fixture = home();
    crow(fixture.socket, 'x');
    writeFileSync(
        join(fixture.dir, '.claude/sessions/1.json'),
        JSON.stringify({ name: '☕️ 🔧 coder', sessionId: 'clio-1' }),
    );
    await hook(fixture, 'gh pr merge 82');
    expect(existsSync(stateOf(fixture))).toBe(false);
});

test('a decision wake leaves the Stop wake’s 30-min clock alone', async () => {
    const fixture = home();
    crow(fixture.socket, 'none');
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
