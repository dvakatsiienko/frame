import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const NOW = 10_000_000;
const A = 'b1b1b1b1-aaaa';
const B = 'a2a2a2a2-bbbb';
const STORE = '/home/.claude/plugins/store';
const FILE = 'x-mod-holds_inline-abc.json';
const START = 'Sun Oct  4 21:00:00 2026';

// session B in /repo; x-mod-holds' store says A holds /repo/x.ts, dirty in git; `pidAlive` false ends A
function world(on: On, { pidAlive = true } = {}) {
    mock.clock(on, { now: NOW });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: B }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', (_$, e) => ({
        value: e.name === 'HOME' ? '/home' : undefined,
    }));
    on('fs.exists', () => ({ value: false }));
    on('fs.list', (_$, e) => ({
        value:
            e.path === STORE
                ? [
                      {
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: 0,
                          name: FILE,
                          size: 1,
                      },
                  ]
                : [],
    }));
    on('fs.read', (_$, e) => ({
        value:
            e.path === `${STORE}/${FILE}`
                ? JSON.stringify({
                      [`hold:${A}:/repo/x.ts`]: {
                          at: NOW - 60_000,
                          file: '/repo/x.ts',
                          landed: true,
                          top: '/repo',
                      },
                      [`holder:${A}`]: {
                          idleSince: null,
                          pid: 100,
                          start: START,
                      },
                  })
                : '{}',
    }));
    on('fs.stat', (_$, e) => ({
        value: {
            isLink: false,
            kind: 'file' as const,
            mtimeMs: 0,
            realPath: e.path,
            size: 1,
        },
    }));
    on('process.run', (_$, e) => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout:
                e.argv[0] === 'ps'
                    ? pidAlive
                        ? `${START}\n`
                        : ''
                    : ' M /repo/x.ts\n',
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
const swept = (context: readonly string[] | undefined) =>
    (context ?? []).filter(
        (l) =>
            l.includes('stash-sweep') &&
            l.includes('git stash push -u -- <your paths>'),
    ).length;

// refused since its verifier's clean (FRM-428 round 2): nothing runs, the refusal names the door
const SWEEPS = [
    'git stash',
    'git stash -u',
    'git stash push -m wip',
    'git stash save wip',
    'cd /repo && git stash push --include-untracked',
] as const;
for (const typed of SWEEPS)
    test(`a whole-tree stash while another session holds a file is refused: ${typed}`, async ($, on) => {
        const w = world(on);
        const r = await bash($, typed);
        expect([
            w.ran,
            r.deny?.includes('git stash push -u -- <your paths>'),
            r.deny?.includes('/repo/x.ts'),
        ]).toEqual([[], true, true]);
    });

const FINE = [
    'git stash push -- y.ts',
    'git stash push -m wip -- y.ts z.ts',
    'git stash list',
    'git stash pop',
    'git stash show -p',
    'git -C /other stash',
] as const;
for (const typed of FINE)
    test(`no stash-sweep warning: ${typed}`, async ($, on) => {
        world(on);
        expect(swept((await bash($, typed)).context)).toBe(0);
    });

test('a whole-tree stash with no live holder elsewhere runs unwarned', async ($, on) => {
    world(on, { pidAlive: false });
    expect(swept((await bash($, 'git stash -u')).context)).toBe(0);
});
