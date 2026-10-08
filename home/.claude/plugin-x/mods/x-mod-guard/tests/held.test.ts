import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { writtenPaths } from '../hooks/rules.ts';

// every file a Bash command writes, resolved from /repo
const writes: [string, string, string[]][] = [
    ['sd', "sd -F 'a' 'b' x.ts y.ts", ['/repo/x.ts', '/repo/y.ts']],
    ['sd with --', 'sd -- -a b x.ts', ['/repo/x.ts']],
    ['sed -i on macOS', "sed -i '' 's/a/b/' x.ts", ['/repo/x.ts']],
    ['sed -i with -e', "sed -i -e 's/a/b/' x.ts", ['/repo/x.ts']],
    ['a redirect', 'echo hi > x.ts', ['/repo/x.ts']],
    ['an append', 'echo hi >>x.ts', ['/repo/x.ts']],
    ['a heredoc', "cat > x.ts <<'EOF'\na > b\nEOF", ['/repo/x.ts']],
    ['a heredoc piped to a file', 'cat <<EOF > x.ts\nhi\nEOF', ['/repo/x.ts']],
    ['tee', 'echo hi | tee -a x.ts', ['/repo/x.ts']],
    [
        'python open',
        "python3 - <<'EOF'\nopen('x.ts', 'w').write(s)\nEOF",
        ['/repo/x.ts'],
    ],
    ['a write after a cd', 'cd sub && echo hi > x.ts', ['/repo/sub/x.ts']],
];
for (const [shape, command, files] of writes)
    test(`reads the file a Bash write targets: ${shape}`, () => {
        expect(writtenPaths(command, '/repo')).toEqual(files);
    });

const reads: [string, string][] = [
    ['a stream redirect', 'ls 2>&1 >/dev/null'],
    ['a quoted arrow', "echo 'a > b'"],
    ['sed without -i', "sed 's/a/b/' x.ts"],
    ['a variable path', 'echo hi > "$out"'],
];
for (const [shape, command] of reads)
    test(`finds no write in ${shape}`, () => {
        expect(writtenPaths(command, '/repo')).toEqual([]);
    });

const NOW = 10_000_000;
const MIN = 60 * 1000;
const A = 'b1b1b1b1-aaaa';
const B = 'a2a2a2a2-bbbb';
const STORE = '/home/.claude/plugins/store';
const FILE = 'x-mod-holds_inline-abc.json';
const START = 'Sun Oct  4 21:00:00 2026';

// session B in /repo; x-mod-holds' store file says A holds x.ts. `pidAlive` and `clean` steer the release checks
function world(
    on: On,
    { pidAlive = true, clean = false, idleSince = null as number | null } = {},
) {
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
                          at: NOW - 3 * MIN,
                          file: '/repo/x.ts',
                          landed: true,
                          top: '/repo',
                      },
                      [`holder:${A}`]: { idleSince, pid: 100, start: START },
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
    on('process.run', (_$, e) => {
        const stdout =
            e.argv[0] === 'ps'
                ? pidAlive
                    ? `${START}\n`
                    : ''
                : clean
                  ? ''
                  : ' M /repo/x.ts\n';
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout,
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
    $.tool.call({ command, tool: 'Bash' });

test("a Bash write to another session's held file is refused with the holder named", async ($, on) => {
    const w = world(on);
    expect((await bash($, "sd 'a' 'b' x.ts")).deny).toBe(
        'x-mod-holds: /repo/x.ts is held by session b1b1b1b1, which took it 3 min ago. wait, or ask it to commit the file.',
    );
    expect(w.ran).toEqual([]);
});

test('a Bash write to a file held by a dead session runs', async ($, on) => {
    const w = world(on, { pidAlive: false });
    expect((await bash($, "sd 'a' 'b' x.ts")).deny).toBeUndefined();
    expect(w.ran).toHaveLength(1);
});

test('a Bash write to a held file already clean in git runs', async ($, on) => {
    world(on, { clean: true });
    expect((await bash($, "sd 'a' 'b' x.ts")).deny).toBeUndefined();
});

test('a Bash write to a file held by a session idle 30 min runs', async ($, on) => {
    world(on, { idleSince: NOW - 31 * MIN });
    expect((await bash($, "sd 'a' 'b' x.ts")).deny).toBeUndefined();
});

test('a Bash write after `cd X;` is read from X', async ($, on) => {
    world(on);
    expect((await bash($, "cd sub; sd 'a' 'b' x.ts")).deny).toBeUndefined();
});
