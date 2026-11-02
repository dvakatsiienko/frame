import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { ESCAPES, JOB, type World } from './escapes.ts';

// FRM-471: one runner for the escape table; the world is a codie session (not the coordinator) in frame's checkout,
// with a job tmp, so every rule — the lift, the doors, the linear rules — meets each row as it would live
function world(on: On, w: World = {}) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    const { cwd = '/repo', reals = {}, commonDirs = {}, files = [] } = w;
    on('session.id', () => ({ value: 'e1e1e1e1-0000' }));
    on('session.cwd', () => ({ value: cwd }));
    on('env.get', (_$, e) => ({
        value: e.name === 'CLAUDE_JOB_DIR' ? JOB : '/home',
    }));
    on('fs.exists', () => ({ value: true }));
    on('fs.stat', (_$, e) => ({
        value: {
            isLink: false,
            kind: files.includes(e.path) ? 'file' : 'dir',
            mtimeMs: 0,
            realPath: reals[e.path] ?? e.path,
            size: 0,
        },
    }));
    on('fs.list', () => ({
        value: [
            {
                isLink: false,
                kind: 'file' as const,
                mtimeMs: 0,
                name: '1.json',
                size: 1,
            },
        ],
    }));
    on('fs.read', (_$, e) =>
        e.path === '/home/.claude/sessions/1.json'
            ? {
                  value: JSON.stringify({
                      name: '⚡ 🔧 codie',
                      sessionId: 'e1e1e1e1-0000',
                  }),
              }
            : { deny: 'no such file' },
    );
    on('process.run', (_$, e) => {
        const common = commonDirs[e.argv[2] ?? ''];
        return {
            value: {
                exitCode: common ? 0 : 128,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: common ? `${common}\n` : '',
            },
        };
    });
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}
const bash = ($: Engine, command: string) =>
    $.tool.call({ command, run_in_background: true, tool: 'Bash' });

test(`the escape table holds ${ESCAPES.length} rows, no row twice`, () => {
    expect(new Set(ESCAPES.map((r) => JSON.stringify([r[3], r[4]]))).size).toBe(
        ESCAPES.length,
    );
});

for (const [verdict, escapeClass, shape, command, w] of ESCAPES)
    test(`${escapeClass}: ${shape} ${verdict === 'refused' ? 'is refused' : 'still runs (open)'}`, async ($, on) => {
        const { ran } = world(on, w);
        const isRefused = (await bash($, command)).deny !== undefined;
        expect([isRefused, ran.length]).toEqual(
            verdict === 'refused' ? [true, 0] : [false, 1],
        );
    });
