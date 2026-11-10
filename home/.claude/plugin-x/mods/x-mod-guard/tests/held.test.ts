import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { writtenPaths } from '../hooks/rules/overwrite.ts';

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
    ['a cp onto a file', 'cp a.ts x.ts', ['/repo/x.ts', '/repo/x.ts/a.ts']],
    ['a write in bash -c', "bash -c 'echo hi > x.ts'", ['/repo/x.ts']],
    // FRM-472 R3 row 17
    ['perl -pi', "perl -pi -e 's/a/b/' x.ts", ['/repo/x.ts']],
    ['dd of=', 'dd if=a.ts of=x.ts', ['/repo/x.ts']],
    ['curl -o', 'curl -fsSL -o x.ts https://e.com/x', ['/repo/x.ts']],
    ['curl --output=', 'curl --output=x.ts https://e.com/x', ['/repo/x.ts']],
    ['curl -so, packed', 'curl -so x.ts https://e.com/x', ['/repo/x.ts']],
    ['rsync', 'rsync -a a.ts x.ts', ['/repo/x.ts', '/repo/x.ts/a.ts']],
    ['ditto', 'ditto a.ts x.ts', ['/repo/x.ts', '/repo/x.ts/a.ts']],
    ['git checkout --', 'git checkout -- x.ts', ['/repo/x.ts']],
    ['git restore', 'git restore x.ts', ['/repo/x.ts']],
    ['cp -t', 'cp -t dir a.ts', ['/repo/dir', '/repo/dir/a.ts']],
    // FRM-472 review: rsync's -t keeps times, it names no dest; git -C moves where restore writes
    ['rsync -t', 'rsync -t a.ts dir', ['/repo/dir', '/repo/dir/a.ts']],
    ['git -C restore', 'git -C app restore x.ts', ['/repo/app/x.ts']],
    ['git restore -SW', 'git restore -SW x.ts', ['/repo/x.ts']],
    [
        'perl -pi with two -e',
        "perl -pi -e 's/a/b/' -e 's/c/d/' x.ts",
        ['/repo/x.ts'],
    ],
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
    ['git restore --staged', 'git restore --staged x.ts'],
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

// session B in /repo; x-mod-holds' store file says A holds x.ts. `pidAlive` and `clean` steer the release checks;
// `newFile`: /repo is a link to /real/repo and A holds new.ts there, a file not written yet
function world(
    on: On,
    {
        pidAlive = true,
        clean = false,
        idleSince = null as number | null,
        newFile = false,
        passFor = undefined as string | undefined,
        ticks = [] as {
            id: string;
            text: string;
            targets: string[];
            at: number;
        }[],
    } = {},
) {
    const held = newFile ? '/real/repo/new.ts' : '/repo/x.ts';
    mock.clock(on, { now: NOW });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: B }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('state.get', (_$, e, next) =>
        e.plugin === 'x-mod-stash' && e.key === 'ticks'
            ? { value: { value: ticks, version: 1 } }
            : next(e),
    );
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
                      [`hold:${A}:${held}`]: {
                          at: NOW - 3 * MIN,
                          file: held,
                          landed: true,
                          top: '/repo',
                      },
                      [`holder:${A}`]: { idleSince, pid: 100, start: START },
                      ...(passFor
                          ? { [`pass:${passFor}:${held}`]: { at: NOW } }
                          : {}),
                  })
                : '{}',
    }));
    on('fs.stat', (_$, e) => {
        if (newFile && e.path === '/repo/new.ts') throw new Error('ENOENT');
        return {
            value: {
                isLink: false,
                kind: 'file' as const,
                mtimeMs: 0,
                realPath: newFile
                    ? e.path.replace(/^\/repo/, '/real/repo')
                    : e.path,
                size: 1,
            },
        };
    });
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

test('a Bash write to a held file not written yet is refused through a linked folder', async ($, on) => {
    world(on, { newFile: true });
    expect((await bash($, 'echo hi > new.ts')).deny).toMatch(
        /^x-mod-holds: \/repo\/new\.ts is held by session b1b1b1b1/,
    );
});

// FRM-544 slice 2d: dima's tick on an ask quoting the held file is the door; holds' pass covers the turn
const tickOn = (target: string, at = NOW - MIN) => ({
    at,
    id: 'o7',
    targets: [target],
    text: `let B write \`${target}\``,
});

test("a Bash write to a held file runs on holds' pass for this session", async ($, on) => {
    const w = world(on, { passFor: B });
    expect((await bash($, "sd 'a' 'b' x.ts")).deny).toBeUndefined();
    expect(w.ran).toHaveLength(1);
});

test('a Bash write to a held file runs once on his tick quoting the file', async ($, on) => {
    const w = world(on, { ticks: [tickOn('/repo/x.ts')] });
    expect((await bash($, "sd 'a' 'b' x.ts")).deny).toBeUndefined();
    expect((await bash($, "sd 'c' 'd' x.ts")).deny).toMatch(
        /^x-mod-holds: \/repo\/x\.ts is held by session b1b1b1b1/,
    );
    expect(w.ran).toHaveLength(1);
});

for (const [shape, tick] of [
    ['a tick quoting another file', tickOn('/repo/y.ts')],
    ['a tick older than 2 h', tickOn('/repo/x.ts', NOW - 121 * MIN)],
    ['a tick stamped in the future', tickOn('/repo/x.ts', NOW + MIN)],
] as const)
    test(`a Bash write to a held file stays refused on ${shape}`, async ($, on) => {
        world(on, { ticks: [tick] });
        expect((await bash($, "sd 'a' 'b' x.ts")).deny).toMatch(
            /^x-mod-holds: \/repo\/x\.ts is held by session b1b1b1b1/,
        );
    });

test("another session's pass opens nothing for this one", async ($, on) => {
    world(on, { passFor: 'c3c3c3c3-cccc' });
    expect((await bash($, "sd 'a' 'b' x.ts")).deny).toMatch(
        /held by session b1b1b1b1/,
    );
});
