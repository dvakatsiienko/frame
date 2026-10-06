import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const JOB = '/home/.claude/jobs/j1';

// files: the paths that exist on disk, absolute
function world(on: On, files: string[] = []) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', (_$, e) => ({
        value: e.name === 'CLAUDE_JOB_DIR' ? JOB : '/home',
    }));
    on('fs.exists', (_$, e) => ({ value: files.includes(e.path) }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

test('a git add of a missing path is refused, naming the path', async ($, on) => {
    const w = world(on, ['/repo/a']);
    const r = await bash($, 'git add a b');
    expect(r.deny).toContain('stage only paths that exist');
    expect(r.deny).toContain('dima-ok: b');
    expect(w.ran).toEqual([]);
});

test('a git add whose every path exists runs', async ($, on) => {
    const w = world(on, ['/repo/a', '/repo/src/b.ts']);
    const r = await bash($, 'git add a -- src/b.ts');
    expect(r.deny).toBeUndefined();
    expect(w.ran).toEqual(['git add a -- src/b.ts']);
});

test('a git add after a cd is checked against that dir', async ($, on) => {
    world(on, ['/repo/a']);
    expect((await bash($, 'cd sub && git add a')).deny).toContain('dima-ok: a');
});

const SCRATCH = [
    ['git add -A', `cd ${JOB}/tmp/clone && git add -A`],
    ['git checkout --', `cd ${JOB}/tmp/clone && git checkout -- a.ts`],
    ['git reset --hard', 'cd "$CLAUDE_JOB_DIR/tmp/clone" && git reset --hard'],
    ['git -C', 'git -C ${CLAUDE_JOB_DIR}/tmp/clone clean -fd'],
] as const;

for (const [shape, command] of SCRATCH)
    test(`${shape} in the job's own tmp runs`, async ($, on) => {
        const w = world(on);
        expect((await bash($, command)).deny).toBeUndefined();
        expect(w.ran).toEqual([command]);
    });

// the same commands one step outside the job's tmp
const OUTSIDE = [
    ['git add -A in the job dir', `cd ${JOB} && git add -A`],
    ['git checkout -- in the repo', 'git checkout -- a.ts'],
    [
        'a path that climbs out of the tmp',
        `cd ${JOB}/tmp/clone && git checkout -- ../../../x.ts`,
    ],
    [
        'another job tmp',
        'cd /home/.claude/jobs/j2/tmp/clone && git reset --hard',
    ],
    ['a force-push from the tmp', `cd ${JOB}/tmp/clone && git push -f`],
    [
        'a skipped hook in the tmp',
        `cd ${JOB}/tmp/clone && git commit --no-verify -m x -- a.ts`,
    ],
] as const;

for (const [shape, command] of OUTSIDE)
    test(`${shape} is refused`, async ($, on) => {
        const w = world(on);
        expect((await bash($, command)).deny).toBeDefined();
        expect(w.ran).toEqual([]);
    });
