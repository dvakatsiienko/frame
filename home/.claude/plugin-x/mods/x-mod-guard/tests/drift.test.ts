import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const TREE = '/home/frame/.claude/worktrees/FRM-1-x';

// cwd: where the session's shell sits; failing: the call beneath errors
function world(on: On, cwd: string, isFailing = false) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: cwd }));
    on('session.root', () => ({ value: TREE }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('tool.call', () =>
        isFailing
            ? {
                  isError: true,
                  result: {},
                  text: 'refused: outside the worktree',
              }
            : { result: {}, text: 'ran' },
    );
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

test('a worktree session refused outside its tree is pointed back with EnterWorktree', async ($, on) => {
    world(on, '/home/frame');
    expect((await bash($, 'rm x')).deny).toContain(
        `EnterWorktree(path: "${TREE}")`,
    );
});

test('a worktree session whose call fails outside its tree gets the hint', async ($, on) => {
    world(on, '/home/frame', true);
    expect((await bash($, 'ls')).context?.join()).toContain(
        `EnterWorktree(path: "${TREE}")`,
    );
});

test('a call that runs outside the tree gets no hint', async ($, on) => {
    world(on, '/home/frame');
    expect((await bash($, 'ls')).context).toBeUndefined();
});

test('a refusal inside the tree gets no hint', async ($, on) => {
    world(on, `${TREE}/src`);
    expect((await bash($, 'rm x')).deny).not.toContain('EnterWorktree');
});
