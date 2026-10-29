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
    ['/repo', 'x as codie -- gh pr view 12'],
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

// FRM-394: gh's --jq is gojq, not jq
for (const typed of [
    "gh pr view 3 --json title --jq '.title'",
    "gh api repos/o/r --jq='.name'",
    "gh api repos/o/r -q '.name'",
])
    test(`a gh --jq call runs with a gojq hint: ${typed}`, async ($, on) => {
        const w = world(on);
        const r = await bash($, typed);
        expect([w.ran, hinted(r.context, 'gh --jq').length]).toEqual([
            [typed],
            1,
        ]);
    });

test('gh --json piped into jq gets no gojq hint', async ($, on) => {
    world(on);
    const r = await bash($, "gh pr view 3 --json title | jq '.title'");
    expect(hinted(r.context, 'gh --jq')).toHaveLength(0);
});

/* PK-67: the three warnings */

const HOME_REPO = '/home/frame';
const edited = (context: readonly string[] | undefined) =>
    (context ?? []).filter((l) => l.includes('goes through `Edit`'));
for (const typed of [
    "sd -F 'a' 'b' x.ts",
    "sed -i '' 's/a/b/' x.ts",
    "python3 - <<'EOF'\nopen('x.ts', 'w').write(s)\nEOF",
])
    test(`a scripted replace into a repo file names Edit: ${typed.split('\n')[0]}`, async ($, on) => {
        const w = world(on, HOME_REPO);
        const r = await bash($, typed);
        expect([w.ran, edited(r.context).length]).toEqual([[typed], 1]);
    });

test('a scripted replace outside the repos runs unhinted', async ($, on) => {
    world(on, '/tmp/scratch');
    const r = await bash($, "sd -F 'a' 'b' x.ts");
    expect(edited(r.context)).toEqual([]);
});

test('an append into a repo file runs with no Edit hint', async ($, on) => {
    const w = world(on, HOME_REPO);
    const r = await bash($, 'echo hi >> x.ts');
    expect([w.ran, edited(r.context)]).toEqual([['echo hi >> x.ts'], []]);
});

const echoed = (context: readonly string[] | undefined) =>
    (context ?? []).filter((l) => l.includes("zsh's `echo`"));

test("echo of json names zsh's escapes and printf", async ($, on) => {
    world(on);
    const r = await bash($, `echo '{"text":"a\\nb"}' | jq .`);
    expect(echoed(r.context)).toHaveLength(1);
});

test('echo of plain words gets no json hint', async ($, on) => {
    world(on);
    const r = await bash($, 'echo hi there');
    expect(echoed(r.context)).toEqual([]);
});

const looped = (context: readonly string[] | undefined) =>
    (context ?? []).filter((l) =>
        l.includes('`claude -p` inside `while read`'),
    );

test('claude -p inside while read names </dev/null', async ($, on) => {
    world(on);
    const r = await $.tool.call({
        command: 'ls | while read f; do claude -p "say $f"; done',
        run_in_background: true,
        tool: 'Bash',
    });
    expect(looped(r.context)).toHaveLength(1);
});

test('claude -p inside while read with </dev/null runs unhinted', async ($, on) => {
    world(on);
    const r = await $.tool.call({
        command: 'ls | while read f; do claude -p "say $f" </dev/null; done',
        run_in_background: true,
        tool: 'Bash',
    });
    expect(looped(r.context)).toEqual([]);
});

const RG_MISSES = [
    ['/repo', "rg -l 'x:shape' /home/frame"],
    ['/home/frame', "rg -n 'shape-idea'"],
    ['/repo', "rg -c 'foo' /home/frame/home"],
    ['/home/frame', "rg -l 'x' --glob '*.py' ."],
] as const;
for (const [cwd, typed] of RG_MISSES)
    test(`an rg that skips dot dirs runs with a --hidden hint: ${typed}`, async ($, on) => {
        const w = world(on, cwd);
        const r = await bash($, typed);
        expect(w.ran).toEqual([typed]);
        expect(hinted(r.context, 'rg')).toHaveLength(1);
    });

const RG_FINE = [
    ['/home/frame', "rg --hidden -n 'shape-idea' ."],
    ['/home/frame', "rg -uu -l 'x'"],
    ['/repo', "rg -n 'foo' src"],
    ['/home/frame', "sed -n 1,9p a.md | rg 'status'"],
    ['/home/frame', "rg -c 'x' home/.claude/shelf/flawlog/a.md"],
    ['/home/frame', "rg -n -e '- dead code' -A1 home/.claude/skills/a.md"],
    ['/home/frame', "rg -n -g '!*.jsonl' 'x' src"],
] as const;
for (const [cwd, typed] of RG_FINE)
    test(`an rg that reaches dot dirs or needs none gets no hint: ${typed}`, async ($, on) => {
        const w = world(on, cwd);
        expect(hinted((await bash($, typed)).context, 'rg')).toHaveLength(0);
        expect(w.ran).toEqual([typed]);
    });
