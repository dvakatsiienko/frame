import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

function world(on: On, cwd = '/repo') {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: cwd }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: true }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });
const hinted = (context: readonly string[] | undefined, verb: string) =>
    (context ?? []).filter((l) => l.includes(`hint: \`${verb}`));

const PR_READS = [
    'gh pr view 12',
    'gh pr checks 12',
    'gh api repos/o/r/pulls/12/comments',
    'gh api -X GET repos/o/r/pulls',
    'cd /repo && gh pr view 3 --json title | jq .title',
] as const;
for (const typed of PR_READS)
    test(`a raw pr read runs with an x gh pr hint: ${typed}`, async ($, on) => {
        const w = world(on);
        const r = await bash($, typed);
        expect(w.ran).toEqual([typed]);
        expect(hinted(r.context, 'x gh pr')).toHaveLength(1);
    });

const LANE = [
    ['/home/frame', 'git add a.ts'],
    ['/home/frame/x', 'git commit -m m -- a.ts'],
    ['/repo', 'git -C /home/projects/bytes add a.ts'],
    ['/repo', 'cd ~/frame && git add a.ts'],
] as const;
for (const [cwd, typed] of LANE)
    test(`a raw git add or commit in frame or bytes runs with an x lane commit hint: ${typed}`, async ($, on) => {
        const w = world(on, cwd);
        const r = await bash($, typed);
        expect(w.ran).toEqual([typed]);
        expect(hinted(r.context, 'x lane commit')).toHaveLength(1);
    });

const QUIET = [
    ['/repo', 'git add a.ts'],
    ['/repo', 'git commit -m m -- a.ts'],
    ['/home/frame', 'git status'],
    ['/home/frame', 'x lane commit m.txt -- a.ts'],
    ['/home/frame', "echo 'git add a.ts and gh pr view 1'"],
    ['/home/frame', "cat <<'EOF'\ngit add a.ts\ngh pr view 1\nEOF"],
    ['/repo', 'x gh pr 12'],
    ['/repo', 'x as coder -- gh pr view 12'],
    ['/repo', 'gh pr create --fill'],
    ['/repo', 'gh api repos/o/r/issues/12'],
    ['/repo', 'gh api -X POST repos/o/r/pulls/12/comments'],
    ['/repo', 'gh api repos/o/r/pulls -f title=t'],
] as const;
for (const [cwd, typed] of QUIET)
    test(`no hint for: ${typed}`, async ($, on) => {
        world(on, cwd);
        const r = await bash($, typed);
        expect(hinted(r.context, 'x ')).toEqual([]);
    });
