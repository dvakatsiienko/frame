import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const TREE = '/home/frame/.claude/worktrees/FRM-1-x';
// cc core's own words for a worktree command it cannot prove stays in the tree (7 seen in coder transcripts)
const CORE = `This session is isolated in the worktree ${TREE}, but this command names git in a form too complex to verify that it stays inside the worktree. Refusing to run it — a worktree-isolated session's git operations must target its own worktree.`;

function world(on: On, refuses: boolean) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: TREE }));
    on('session.root', () => ({ value: TREE }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('fs.stat', (_$, e) => ({
        value: {
            isLink: false,
            kind: 'file' as const,
            mtimeMs: 0,
            realPath: e.path,
            size: 1,
        },
    }));
    on('tool.call', () =>
        refuses ? { deny: CORE } : { result: {}, text: 'ran' },
    );
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

const CORE_REFUSES = [
    "cat > $CLAUDE_JOB_DIR/tmp/body.md <<'EOF'\nsee https://github.com/o/r/pull/1\nEOF",
    'gh api repos/o/r/pulls/1/comments --jq length',
] as const;
for (const typed of CORE_REFUSES)
    test(`a worktree command cc core refuses carries the scratch-script door: ${typed.slice(0, 30)}`, async ($, on) => {
        world(on, true);
        const r = await bash($, typed);
        expect([
            r.deny?.startsWith('This session is isolated'),
            r.deny?.includes('scratch script'),
        ]).toEqual([true, true]);
    });

test('a worktree command core lets run gets no door', async ($, on) => {
    world(on, false);
    const r = await bash($, 'gh api repos/o/r/pulls/1/comments --jq length');
    expect([
        r.deny,
        (r.context ?? []).filter((l) => l.includes('scratch script')),
    ]).toEqual([undefined, []]);
});
