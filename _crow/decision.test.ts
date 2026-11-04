import { spawn, spawnSync } from 'node:child_process';
import {
    appendFileSync,
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

// a string is a Bash command at PreToolUse; a write lands at PostToolUse; `raw` is any other hook input
function hook(
    fixture: ReturnType<typeof home>,
    call: string | { tool: string; path: string } | { raw: object },
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
                : 'raw' in call
                  ? call.raw
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

const packetOf = (fixture: ReturnType<typeof home>, line: string) =>
    readFileSync(
        /· packet (\S+)/.exec(line)?.[1] ??
            join(fixture.dir, 'no-packet-in-the-line'),
        'utf8',
    );

describe('a summon', () => {
    test('wakes crow once across the hook before the call and the hook after it', async () => {
        const fixture = home();
        const { lines } = crow(fixture.socket);
        const command = 'cd ~/frame && claude --bg -n x hi';
        await hook(fixture, command);
        await hook(fixture, {
            raw: {
                hook_event_name: 'PostToolUse',
                tool_input: { command },
                tool_name: 'Bash',
            },
        });
        expect(lines).toHaveLength(1);
    });
});

describe('a paid call', () => {
    test.each([
        ['the batch', 'script/op-run.sh python3 -I /tmp/retro/batch.py submit'],
        ['a paid verb', 'pnpm paid:run'],
        ['an sdk script', 'node paid.ts'],
    ])('%s waits for the note and carries it', async (_label, command) => {
        const fixture = home();
        writeFileSync(
            join(fixture.dir, 'paid.ts'),
            "import Anthropic from '@anthropic-ai/sdk';\n",
        );
        writeFileSync(
            join(fixture.dir, 'package.json'),
            JSON.stringify({ scripts: { 'paid:run': 'node ./paid.ts' } }),
        );
        const { lines } = crow(fixture.socket, 'hold: who asked for this?');
        const { code, out } = await hook(fixture, command);
        expect(code).toBe(0);
        expect(lines[0]).toContain(' · paid ');
        expect(out?.hookSpecificOutput.additionalContext).toContain(
            'hold: who asked for this?',
        );
    });

    test('a note her guard kept from the note path still ends the hold', async () => {
        const fixture = home();
        const { first } = crow(fixture.socket);
        const held = hook(fixture, 'python3 /tmp/batch.py submit', 30_000);
        const wakeId = /crow wake (\S+)/.exec(await first)?.[1];
        writeFileSync(
            join(fixture.dir, '.local/state/crow/notes.jsonl'),
            `${JSON.stringify({ note: 'hold: who asked?', wakeId })}\n`,
        );
        const { ms, out } = await held;
        expect(ms).toBeLessThan(10_000);
        expect(out?.hookSpecificOutput.additionalContext).toContain(
            'hold: who asked?',
        );
    });

    test('a crow that never answers lets it through and logs a timed out row', async () => {
        const fixture = home();
        crow(fixture.socket);
        const { code, ms, out } = await hook(
            fixture,
            'python3 /tmp/batch.py submit',
            1_000,
        );
        const log = readFileSync(
            join(fixture.dir, '.local/state/crow/decisions/log.jsonl'),
            'utf8',
        );
        expect(code).toBe(0);
        expect(ms).toBeLessThan(10_000);
        expect(out?.hookSpecificOutput.permissionDecision).toBeUndefined();
        expect(out?.hookSpecificOutput.additionalContext).toContain(
            'crow silent after 1 s',
        );
        expect(JSON.parse(log).value).toBe('timed out');
    });

    test('a tab crow denies the first call with the line, the rerun waits', async () => {
        const fixture = home({ tab: true });
        const command = 'python3 /tmp/batch.py submit';
        const first = await hook(fixture, command, 1_000);
        expect(first.out?.hookSpecificOutput.permissionDecision).toBe('deny');
        const second = await hook(fixture, command, 1_000);
        expect(
            second.out?.hookSpecificOutput.permissionDecision,
        ).toBeUndefined();
    });
});

describe('a console page', () => {
    test('holds once a turn, a read of it never', async () => {
        const fixture = home();
        const { lines } = crow(fixture.socket, 'none');
        const navigate = {
            raw: {
                hook_event_name: 'PreToolUse',
                tool_input: { url: 'https://console.anthropic.com/settings' },
                tool_name: 'mcp__Claude_Browser__navigate',
            },
        };
        await hook(fixture, navigate);
        await hook(fixture, navigate);
        await hook(fixture, {
            raw: {
                hook_event_name: 'PreToolUse',
                tool_input: { action: 'screenshot' },
                tool_name: 'mcp__Claude_Browser__computer',
            },
        });
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain(' · console https://console.anthropic.com');
    });
});

test('a tab crow denies a console page first, and the rerun waits for the note', async () => {
    const fixture = home({ tab: true });
    const navigate = {
        raw: {
            hook_event_name: 'PreToolUse',
            tool_input: { url: 'https://console.anthropic.com/settings' },
            tool_name: 'mcp__Claude_Browser__navigate',
        },
    };
    const first = await hook(fixture, navigate, 1_000);
    expect(first.out?.hookSpecificOutput.permissionDecision).toBe('deny');
    const second = await hook(fixture, navigate, 1_000);
    expect(second.out?.hookSpecificOutput.additionalContext).toContain(
        'crow silent after 1 s',
    );
});

describe('a post and a close', () => {
    test.each([
        ['gh pr comment 5 --body-file f', 'post gh pr comment'],
        ['slk send general hi', 'post slk send'],
        ['x linear set FRM-1 --state Done', 'close FRM-1'],
    ])('%s wakes crow and waits for nothing', async (command, fields) => {
        const fixture = home();
        const { first } = crow(fixture.socket);
        const { ms, out } = await hook(fixture, command, 30_000);
        expect(await first).toContain(` · ${fields}`);
        expect(ms).toBeLessThan(10_000);
        expect(out).toBeUndefined();
    });

    test.each(['git push', 'x linear set FRM-1 --state Todo'])(
        '%s wakes nothing',
        async (command) => {
            const fixture = home();
            crow(fixture.socket);
            await hook(fixture, command);
            expect(existsSync(stateOf(fixture))).toBe(false);
        },
    );
});

describe('a claim at the turn end', () => {
    const stop = { raw: { hook_event_name: 'Stop' } };
    const call = (id: string, name: string, input: object) =>
        `${JSON.stringify({ message: { content: [{ id, input, name, type: 'tool_use' }], id }, type: 'assistant' })}\n${JSON.stringify({ message: { content: [{ content: 'ok', tool_use_id: id, type: 'tool_result' }] }, type: 'user' })}\n`;
    const reply = (text: string) =>
        `${JSON.stringify({ message: { content: [{ text, type: 'text' }], id: text }, type: 'assistant' })}\n`;

    test('a «fixed» after an edit wakes crow once, on receipts with no prose of clio', async () => {
        const fixture = home();
        const { first, lines } = crow(fixture.socket);
        appendFileSync(
            fixture.transcript,
            reply('a long aside of clio on how she sees it') +
                call('e', 'Edit', { file_path: '/tmp/a.ts' }) +
                reply('Fixed the gate.'),
        );
        await hook(fixture, stop);
        const line = await first;
        const packet = packetOf(fixture, line);
        expect(lines).toHaveLength(1);
        expect(line).toContain(' · claim Fixed the gate.');
        expect(packet).toContain('merge it');
        expect(packet).toContain('Fixed the gate.');
        expect(packet).toContain('- Edit ok · /tmp/a.ts');
        expect(packet).not.toContain('a long aside');
    });

    test('a claim wake leaves the delta for the next cadence wake', async () => {
        const fixture = home();
        const { first } = crow(fixture.socket);
        appendFileSync(fixture.transcript, reply('Done.'));
        await hook(fixture, stop);
        await first;
        const state = JSON.parse(readFileSync(stateOf(fixture), 'utf8'));
        expect(state.offsets[fixture.transcript]).toBeUndefined();
    });

    test('an exit 0 after the edit wakes nothing', async () => {
        const fixture = home();
        crow(fixture.socket);
        appendFileSync(
            fixture.transcript,
            call('e', 'Edit', { file_path: '/tmp/a.ts' }) +
                call('t', 'Bash', { command: 'pnpm test' }) +
                reply('Fixed the gate.'),
        );
        await hook(fixture, stop);
        expect(existsSync(stateOf(fixture))).toBe(false);
    });

    test('a Stop already blocked once wakes nothing', async () => {
        const fixture = home();
        crow(fixture.socket);
        appendFileSync(fixture.transcript, reply('Done.'));
        await hook(fixture, {
            raw: { hook_event_name: 'Stop', stop_hook_active: true },
        });
        expect(existsSync(stateOf(fixture))).toBe(false);
    });

    test('a claim keeps what the cadence wake wrote meanwhile', async () => {
        const fixture = home();
        writeFileSync(
            stateOf(fixture),
            JSON.stringify({ lastWakeAt: 5, offsets: { a: 1 } }),
        );
        const { first } = crow(fixture.socket);
        appendFileSync(fixture.transcript, reply('Done.'));
        await hook(fixture, stop);
        await first;
        const state = JSON.parse(readFileSync(stateOf(fixture), 'utf8'));
        expect([state.lastWakeAt, state.offsets.a]).toEqual([5, 1]);
    });

    test('a busy relay logs the skipped claim and overwrites nothing', async () => {
        const fixture = home({ tab: true });
        const relay = join(fixture.dir, '.local/state/crow/relay.json');
        writeFileSync(relay, '{"line":"parked"}');
        appendFileSync(fixture.transcript, reply('Done.'));
        await hook(fixture, stop);
        expect(readFileSync(relay, 'utf8')).toBe('{"line":"parked"}');
        expect(
            readFileSync(
                join(fixture.dir, '.local/state/crow/decisions/log.jsonl'),
                'utf8',
            ),
        ).toContain('skipped: relay busy');
    });

    test('a tab crow gets it through the relay, with nothing printed', async () => {
        const fixture = home({ tab: true });
        appendFileSync(fixture.transcript, reply('Done.'));
        const { out } = await hook(fixture, stop);
        const relay = JSON.parse(
            readFileSync(
                join(fixture.dir, '.local/state/crow/relay.json'),
                'utf8',
            ),
        );
        expect(out).toBeUndefined();
        expect(relay.line).toContain(' · claim Done.');
    });
});

test('a changed charter rides the next packet, once', async () => {
    const fixture = home();
    writeFileSync(
        stateOf(fixture),
        JSON.stringify({ charterHash: 'deadbeef', offsets: {} }),
    );
    const { first, lines } = crow(fixture.socket);
    await hook(fixture, 'claude --bg hi');
    expect(packetOf(fixture, await first)).toContain('## charter changed');
    await hook(fixture, 'claude --bg again');
    expect(packetOf(fixture, lines[1] ?? '')).not.toContain(
        '## charter changed',
    );
});

describe('a cadence wake at park', () => {
    const WAKE = join(import.meta.dirname, 'wake.ts');
    const steps = Array.from(
        { length: 12 },
        (_, i) =>
            `${JSON.stringify({ message: { content: [{ text: `s${i}`, type: 'text' }], id: `m${i}` }, type: 'assistant' })}\n`,
    ).join('');
    const usage = (fixture: ReturnType<typeof home>, used: number) =>
        writeFileSync(
            join(fixture.dir, '.claude/shelf/cc-usage-window.json'),
            JSON.stringify({
                rate_limits: {
                    five_hour: {
                        resets_at: Date.now() / 1000 + 2.5 * 3600,
                        used_percentage: used,
                    },
                },
            }),
        );
    // async: a sync spawn would block the fake crow's server in this process, and a wake that sends would hang
    const tick = (fixture: ReturnType<typeof home>) =>
        new Promise<string>((done) => {
            const child = spawn(
                process.execPath,
                [WAKE, '--transcript', fixture.transcript],
                { env: { ...process.env, HOME: fixture.dir } },
            );
            let out = '';
            child.stdout.on('data', (chunk) => {
                out += chunk;
            });
            child.on('close', () => done(out));
        });

    test('logs a skip and builds no packet, while a merge still wakes crow', async () => {
        const fixture = home();
        appendFileSync(fixture.transcript, steps);
        usage(fixture, 60);
        const { lines } = crow(fixture.socket, 'none');
        const run = await tick(fixture);
        const state = join(fixture.dir, '.local/state/crow');
        expect(run).toContain('skipped: park');
        expect(readFileSync(join(state, 'harvest.log'), 'utf8')).toContain(
            'skipped: park',
        );
        expect(existsSync(join(state, 'packets'))).toBe(false);
        await hook(fixture, 'gh pr merge 82');
        expect(lines[0]).toContain(' · merge ');
    });

    test('on pace it builds the packet', async () => {
        const fixture = home();
        appendFileSync(fixture.transcript, steps);
        usage(fixture, 50);
        crow(fixture.socket);
        const run = await tick(fixture);
        expect(run).toContain('woke ');
    });
});

test('a verdict carries what the note changed', () => {
    const state = mkdtempSync(join(tmpdir(), 'crow-vet-'));
    writeFileSync(
        join(state, 'notes.jsonl'),
        `${JSON.stringify({ id: 'n1', note: 'head\nbody' })}\n`,
    );
    const vet = (...args: string[]) =>
        spawnSync(
            process.execPath,
            [join(import.meta.dirname, 'note-vet.ts'), ...args],
            {
                encoding: 'utf8',
                env: {
                    ...process.env,
                    CROW_STATE_DIR: state,
                    CROW_VET_WAIT_MS: '0',
                },
            },
        );
    expect(
        vet('ok', 'n1', 'a real', 'catch', '--changed', 'file', '--ref', '/a')
            .status,
    ).toBe(0);
    expect(vet('ok', 'n1', 'why', '--changed', 'nonsense').status).not.toBe(0);
    expect(vet('ok', 'n1', 'plain why').status).toBe(0);
    const rows = readFileSync(join(state, 'verdicts.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
    expect(rows).toMatchObject([
        { changed: 'file', ref: '/a', why: 'a real catch' },
        { why: 'plain why' },
    ]);
    expect(rows[1].changed).toBeUndefined();
});

/* Types */

interface Hook {
    hookSpecificOutput: {
        additionalContext?: string;
        permissionDecision?: string;
        permissionDecisionReason?: string;
    };
}
