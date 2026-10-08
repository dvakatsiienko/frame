import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const CCLIO = '/home/frame/cclio';

// every tree is clean unless it holds `.scratch/` or its HEAD reaches a commit no branch does
function world(on: On, root: string, { scratch = false, orphan = false } = {}) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'c1c1c1c1-0000' }));
    on('session.cwd', () => ({ value: root }));
    on('session.root', () => ({ value: root }));
    on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? '/home' : '' }));
    on('fs.exists', (_$, e) => ({
        value: !e.path.endsWith('/.scratch') || scratch,
    }));
    on('process.run', () => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: orphan ? 'a1b2c3\n' : '',
        },
    }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

for (const command of [
    'git -C /home/frame worktree remove .claude/worktrees/FRM-1-x',
    'git -C /home/projects/bytes worktree remove /home/projects/bytes/.claude/worktrees/BYT-2-y',
    'git worktree remove /home/.claude/jobs/ab12/tmp/clone',
    'git branch -D scratch/probe scratch/night',
    'git branch -d coder/FRM-1-x',
])
    test(`cclio cleans up without dima's word: ${command}`, async ($, on) => {
        const { ran } = world(on, CCLIO);
        expect((await bash($, command)).deny).toBeUndefined();
        expect(ran).toEqual([command]);
    });

for (const command of [
    'git -C /home/frame worktree remove /home/projects/other',
    'git -C /home/frame worktree remove --force .claude/worktrees/FRM-1-x',
    'git -C /home/frame worktree remove .claude/worktrees',
    'git branch -D coder/FRM-1-x',
    'git branch -D scratch/probe main',
])
    test(`cclio still asks: ${command}`, async ($, on) => {
        const { ran } = world(on, CCLIO);
        expect((await bash($, command)).deny).toContain('ask cclio');
        expect(ran).toEqual([]);
    });

for (const tree of [
    '/home/frame/.claude/worktrees/FRM-1-x',
    '/home/.claude/jobs/ab12/tmp/clone',
]) {
    test(`cclio asks to remove a tree holding a .scratch plan: ${tree}`, async ($, on) => {
        const { ran } = world(on, CCLIO, { scratch: true });
        const r = await bash($, `git worktree remove ${tree}`);
        expect(r.deny).toContain('ask cclio');
        expect(ran).toEqual([]);
    });

    test(`cclio asks to remove a tree whose HEAD has commits no branch reaches: ${tree}`, async ($, on) => {
        const { ran } = world(on, CCLIO, { orphan: true });
        const r = await bash($, `git worktree remove ${tree}`);
        expect(r.deny).toContain('ask cclio');
        expect(ran).toEqual([]);
    });
}

test('a session outside cclio still asks to remove a scratch tree', async ($, on) => {
    const { ran } = world(on, '/home/frame');
    const r = await bash($, 'git worktree remove .claude/worktrees/FRM-1-x');
    expect(r.deny).toContain('ask cclio');
    expect(ran).toEqual([]);
});
