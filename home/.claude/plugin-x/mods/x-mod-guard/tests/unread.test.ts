import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const FILE = '/repo/src/a.test.ts';

// FILE is on disk; `tracked` says whether git ls-files knows it
function world(on: On, tracked: boolean) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'u1u1u1u1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', (_$, e) => ({ value: e.path === FILE }));
    on('fs.stat', (_$, e) => ({
        value: {
            isLink: false,
            kind: 'file' as const,
            mtimeMs: 0,
            realPath: e.path,
            size: 1,
        },
    }));
    on('process.run', () => ({
        value: {
            exitCode: tracked ? 0 : 1,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: '',
        },
    }));
    on('tool.call', (_$, e) => {
        ran.push(e.tool);
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const write = ($: Engine, file = FILE) =>
    $.tool.call({ content: 'x', file_path: file, tool: 'Write' });
const read = ($: Engine) => $.tool.call({ file_path: FILE, tool: 'Read' });

test('a Write over a tracked file never read is refused naming the Read', async ($, on) => {
    const { ran } = world(on, true);
    const r = await write($);
    expect(r.deny).toContain('Read the file first');
    expect(ran).toEqual([]);
});

test('a Write over a tracked file runs after a Read of it', async ($, on) => {
    const { ran } = world(on, true);
    await read($);
    expect((await write($)).deny).toBeUndefined();
    expect(ran).toEqual(['Read', 'Write']);
});

test('a Write over an untracked file runs unread', async ($, on) => {
    const { ran } = world(on, false);
    expect((await write($)).deny).toBeUndefined();
    expect(ran).toEqual(['Write']);
});

test('a Write of a new file runs', async ($, on) => {
    const { ran } = world(on, true);
    expect((await write($, '/repo/src/new.ts')).deny).toBeUndefined();
    expect(ran).toEqual(['Write']);
});
