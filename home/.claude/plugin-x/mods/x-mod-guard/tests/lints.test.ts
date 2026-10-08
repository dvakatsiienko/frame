import type { On } from 'claude-code';
import { expect, mock, test } from 'claude-code/testing';

// each hazard lint: the bad shape, what its refusal says, and a near-miss good shape that runs
const LINTS = [
    [
        'sd $ in double quotes',
        `sd 'a' "$x" f.ts`,
        'python or the Edit tool',
        `sd 'a' 'b' f.ts`,
    ],
    [
        'sd $ in a single-quoted replacement',
        `sd 'a' 'under $CLAUDE_JOB_DIR/tmp' f.ts`,
        'python or the Edit tool',
        `sd '$x' 'y' f.ts`,
    ],
    [
        'sd find led by -',
        `sd '-x' 'y' f.ts`,
        "sd -- '-x'",
        `sd -- '-x' 'y' f.ts`,
    ],
    [
        '$var before a colon',
        'git push origin "$SHA:refs/heads/main"',
        '${SHA}',
        'git push origin "${SHA}:refs/heads/main"',
    ],
    ['$var before a non-ascii char', 'echo «$v»', '${v}', 'echo «${v}»'],
    [
        'sd on a workflow',
        `sd 'a' 'b' .github/workflows/ci.yml`,
        'the Edit tool',
        `sd 'a' 'b' src/ci.yml`,
    ],
    [
        'sed -i on a workflow',
        `sed -i '' 's/a/b/' .github/workflows/ci.yml`,
        'the Edit tool',
        'sed -n 1p .github/workflows/ci.yml',
    ],
    [
        'a trailing &',
        'pnpm dev &',
        'add wait',
        'pnpm dev & sleep 2; curl -s localhost:3000',
    ],
    [
        'a gate piped to head',
        'pnpm typecheck | head',
        'exit code',
        'pnpm typecheck; echo done',
    ],
    [
        'a gate piped to grep',
        'pnpm --filter chords test 2>&1 | grep FAIL',
        'exit code',
        'pnpm --filter chords test 2>&1 > out.txt',
    ],
    [
        'grepping push output',
        'git push origin main 2>&1 | grep main',
        'git ls-remote',
        'git ls-remote origin main | grep main',
    ],
    [
        'a bare git commit',
        'git commit -m wip',
        'x lane commit',
        'git commit -F m.txt -- a.ts',
    ],
    ['git add -A', 'git add -A', 'x lane commit', 'git add a.ts'],
    [
        'an obsidian verb with --help',
        'obsidian delete --help',
        'obsidian --help',
        'obsidian --help',
    ],
    [
        'obsidian delete with no file named',
        'obsidian delete',
        'path=',
        'obsidian delete path=_hq/old.md',
    ],
    [
        'an unquoted $var after set --',
        'set -- $FILES; echo $#',
        '${=FILES}',
        'set -- ${=FILES}; set -- "$A" b',
    ],
    [
        'a sha pushed to main in frame',
        'cd /home/frame && git push origin abc123:main',
        'x lane push',
        'cd /home/frame && git push',
    ],
    [
        'a ref pushed to refs/heads/main in bytes',
        'git -C /home/projects/bytes push origin HEAD:refs/heads/main',
        'x lane push',
        'cd /home/elsewhere && git push origin abc123:main',
    ],
] as const;

function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    // every path a command names exists, but the fresh file a near miss writes to
    on('fs.exists', (_$, e) => ({ value: e.path !== '/repo/out.txt' }));
    on('tool.call', () => ({ result: {}, text: 'ran' }));
}

for (const [lint, bad, fix] of LINTS)
    test(`${lint} is refused with its fix`, async ($, on) => {
        world(on);
        expect(
            (await $.tool.call({ command: bad, tool: 'Bash' })).deny,
        ).toContain(fix);
    });

for (const [lint, , , good] of LINTS)
    test(`${lint}: the near miss runs`, async ($, on) => {
        world(on);
        expect(
            (await $.tool.call({ command: good, tool: 'Bash' })).deny,
        ).toBeUndefined();
    });

// a gate tool that lists or prints help checks nothing, and a `;` ends the gate before the pipe
const NOT_GATES = [
    'tsc --listFilesOnly | grep -c hotkeys',
    'pnpm exec tsc --showConfig -p x | grep strict',
    'vitest list | grep foo',
    'pnpm exec biome check --help | head',
    'pnpm typecheck; ls | grep d',
] as const;

for (const command of NOT_GATES)
    test(`${command} is not a piped gate`, async ($, on) => {
        world(on);
        expect(
            (await $.tool.call({ command, tool: 'Bash' })).deny,
        ).toBeUndefined();
    });

test("a Monitor's command is read like a Bash one", async ($, on) => {
    world(on);
    const r = await $.tool.call({
        command: 'set -- $PIDS; until false; do sleep 5; done',
        description: 'watch',
        timeout_ms: 60_000,
        tool: 'Monitor',
    });
    expect(r.deny).toContain('${=PIDS}');
});

test('a refusal says nothing in the command ran', async ($, on) => {
    world(on);
    expect(
        (await $.tool.call({ command: 'rm x; echo hi', tool: 'Bash' })).deny,
    ).toMatch(/^nothing in this command ran — /);
});
