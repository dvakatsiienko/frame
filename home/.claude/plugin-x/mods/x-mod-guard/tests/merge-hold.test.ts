import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

const HOLD_DIR = '/home/.local/state/x/merge-hold';

type Tick = { at: number; id: string; targets: string[]; text: string };
// holds: dima's holds as x's brake check answers them, or why it could not read them; ticks: dima's live ticks as
// x-mod-stash keeps them; brake: what the check answers for the brake (null: x does not answer at all; 'unread': x
// exits 1 naming brakeUnread, the holds still beside it)
function world(
    on: On,
    holds: readonly string[] | { unread: string } = [],
    ticks: Tick[] = [],
    brake: string | null = '',
    press?: string,
) {
    mock.clock(on, { now: 1_000_000 });
    liveStore(on);
    const ran: string[] = [];
    const checks: string[][] = [];
    const answer = Array.isArray(holds)
        ? { holds, holdsUnread: '' }
        : { holds: [], holdsUnread: (holds as { unread: string }).unread };
    on('state.get', (_$, e, next) =>
        e.plugin === 'x-mod-stash' && e.key === 'ticks'
            ? { value: { value: ticks, version: 1 } }
            : e.plugin === 'x-mod-stash' && e.key === 'orbit' && press
              ? { value: { value: { asks: pressedAsk(press) }, version: 1 } }
              : next(e),
    );
    on('process.run', (_$, e) => {
        if (e.argv.includes('--brake-check')) checks.push([...e.argv]);
        return {
            value: {
                exitCode: brake === 'unread' ? 1 : 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout:
                    e.argv.includes('--brake-check') && brake !== null
                        ? JSON.stringify({
                              data:
                                  brake === 'unread'
                                      ? { brakeUnread: 'no clone', ...answer }
                                      : { brake, ...answer },
                          })
                        : '',
            },
        };
    });
    on('session.id', () => ({ value: 'h1h1h1h1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: true }));
    on('fs.stat', (_$, e) => ({
        value: {
            isLink: false,
            kind: 'file' as const,
            mtimeMs: 0,
            realPath: e.path,
            size: e.path.endsWith('huge.sh') ? 1_000_000 : 0,
        },
    }));
    const scripts: Record<string, string> = {
        '/repo/echoing.sh': "echo 'gh pr merge 5'\n",
        '/repo/huge.sh': 'gh pr merge 5\n',
        '/repo/m.sh': 'set -e\ngh pr merge 5 --squash\n',
        '/repo/nested.sh': 'bash m.sh # the merge\n',
        '/repo/plain.sh': 'echo hi\n',
        '/repo/s1.sh': 'gh pr merge 5\n',
        '/repo/s2.sh': 'bash s1.sh\n',
    };
    on('fs.read', (_$, e) =>
        press && e.path === PRESSES
            ? { value: pressLine(press, 1_000_000 - 1) }
            : e.path in scripts
              ? { value: scripts[e.path] ?? '' }
              : { deny: 'no such file' },
    );
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { checks, ran };
}
const bash = ($: Engine, command: string) =>
    $.tool.call({ command, run_in_background: true, tool: 'Bash' });
// his 🛎 on x-herdr-deck: x-herdr-deck writes the press, x-mod-stash keeps the ask accepted (FRM-544 slice 2g)
const PRESSES = '/home/.claude/shelf/orbit-ticks/h1h1h1h1-0000.jsonl';
const pressLine = (text: string, at: number) =>
    `${JSON.stringify({ at, id: 'o7', text, verdict: 'tick' })}\n`;
const pressedAsk = (text: string) => [{ id: 'o7', mark: 'accepted', text }];

const HELD_7 = ['7'];

test('a query in a file is refused with a way to run it inline', async ($, on) => {
    world(on);
    const r = await bash($, 'gh api graphql -F query=@threads.graphql');
    expect(r.deny).toContain('write the query or the endpoint inline');
});

for (const line of [
    'gh pr merge 7',
    'gh pr merge 7 --squash',
    'gh pr merge --squash 7',
    'gh pr merge --subject "a title" 7',
    'gh pr merge https://github.com/o/r/pull/7 --squash',
    'gh -R o/r pr merge 7',
    'gh stack merge 7',
    'gh api -X PUT repos/o/r/pulls/7/merge',
    'gh api -X=PUT repos/o/r/pulls/7/merge',
    'gh api -X PUT "repos/o/r/pulls/7/merge?merge_method=squash"',
    'gh pr merge 007',
    'gh api --method PUT repos/o/r/pulls/7/merge',
    'gh api --method=put repos/o/r/pulls/7/merge -f merge_method=squash',
    'gh api -XPUT /repos/o/r/pulls/7/merge-async',
    'x as dima -- gh pr merge 7',
    'github-token-wrap gh pr merge 7',
    'timeout 60 gh pr merge 7',
    'echo first && gh pr merge 7 && echo done',
    'sh -c "gh pr merge 7"',
    'github-token-wrap pr merge 7',
    'github-token-wrap api -X PUT repos/o/r/pulls/7/merge',
    'gh pr merge 7 --body "--help"',
    'gh pr merge 7 --subject --help',
    'gh api -X PUT repos/o/r/pulls/7/merge -q --help',
    'gh api -X PUT https://api.github.com/repos/o/r/pulls/7/merge',
])
    test(`a raw merge of a held pr is refused: ${line}`, async ($, on) => {
        const { ran } = world(on, HELD_7);
        const r = await bash($, line);
        expect(r.deny).toContain('merge-hold');
        expect(r.deny).toContain('#7');
        expect(r.deny).toContain('x lane merge-auto');
        expect(ran).toEqual([]);
    });

// door 5 found it (23:47): a tick quoting the merge runs it past the hold and the raw-merge rule (slice 2c), so both say so
const TICK_DOOR = 'or his tick on an orbit ask quoting this whole command';
for (const [why, holds, line] of [
    ['a raw merge', [], 'gh pr merge 12 --squash'],
    ['a held pr', HELD_7, 'gh pr merge 7'],
] as const)
    test(`${why}'s refusal names the tick door`, async ($, on) => {
        world(on, holds);
        expect((await bash($, line)).deny).toContain(TICK_DOOR);
    });

// BYT-94's rider, o48: every raw merge is refused from birth, held or not, naming the door
for (const line of [
    'gh pr merge 12',
    'gh pr merge 12 --squash',
    'gh pr merge --auto 12',
    'gh pr merge 12 --auto --squash',
    'gh pr merge',
    'gh pr merge "$PR"',
    'gh -R o/r pr merge 12',
    'x as codie -- gh pr merge 12',
    'cd /repo && gh pr merge 12 --admin',
    'github-token-wrap gh pr merge 12',
    'github-token-wrap pr merge 12',
    'sh -c "gh pr merge 12"',
    'gh api -X PUT repos/o/r/pulls/12/merge',
    'gh api --method PUT repos/o/r/pulls/12/merge',
    'github-token-wrap gh api -X PUT repos/o/r/pulls/12/merge',
    'gh api -X PUT repos/o/r/pulls/12/merge-async',
    `gh api graphql -f query='mutation { mergePullRequest(input: {}) { clientMutationId } }'`,
    'github-token-wrap gh api graphql -f query=@merge.graphql',
    'gh api graphql -f query="$Q"',
    'gh api graphql --input q.json',
    'gh api graphql --input=q.json',
    'gh api graphql -fquery="$Q"',
    'gh api graphql -Fquery=@q.graphql',
    'gh api graphql --raw-field=query="$Q"',
    'gh api graphql --field query="$Q"',
    'gh api graphql -f "$FIELD"',
    'gh api graphql $ARGS',
    'gh api -X"$M" repos/o/r/pulls/5/merge',
    'bash s2.sh',
    "sed -i '' s/a/b/ m.sh; bash m.sh",
    'gh api -X PUT "$URL"',
    'gh api -X "$M" repos/o/r/pulls/12/merge',
    'gh api --method="$M" repos/o/r/pulls/12/merge',
    'gh api -X "$M" "$URL"',
    'gh stack merge 12',
    'gh stack merge',
    'github-token-wrap gh stack merge 12',
    'x as codie -- gh stack merge 12',
    'bash m.sh',
    'sh m.sh',
    './m.sh',
    '/repo/m.sh',
    'source m.sh',
    '. m.sh',
    'sh < m.sh',
    'bash nested.sh',
    `cat > w.sh <<'EOF'\ngh pr merge 5\nEOF\nbash w.sh`,
])
    test(`a raw merge is refused naming the door, nothing held: ${line}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect(ran).toEqual([]);
        expect(r.deny).toContain('x lane merge-auto');
        expect(r.deny).toContain('rule raw-merge');
    });

for (const line of [
    'gh stack merge --help',
    'gh api -X "$M" repos/o/r/pulls/12',
    'gh api -X PUT repos/o/r/topics -f names="$b"',
    'gh api "$URL"',
    'bash plain.sh',
    './plain.sh',
    'bash echoing.sh',
    'bash missing.sh',
    'bash huge.sh',
    'gh pr merge --help',
    'gh pr merge -h',
    'gh pr merge 12 -h',
    'gh pr merge 12 --disable-auto',
    `gh api graphql -F id="$ID" -f query='mutation { resolveReviewThread(input: {threadId: $id}) { thread { id } } }'`,
    `gh api graphql -f query='query($n:Int!){ viewer { login } }' -F n="$PR"`,
    `gh api graphql -f query='{ viewer { login } }' --jq "$J"`,
    'x lane merge-auto 12',
    "echo 'gh pr merge 12'",
    "cat <<'EOF'\ngh pr merge 12\nEOF",
    'git merge main',
    'gh api repos/o/r/pulls/12/merge',
    `gh api graphql -f query='{ viewer { login } }'`,
])
    test(`no raw merge in: ${line.split('\n')[0]}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect([r.deny, ran.length]).toEqual([undefined, 1]);
    });

for (const line of [
    'gh api repos/o/r/pulls/7/merge',
    'gh pr view 7',
    'gh pr list',
    'gh api repos/o/r/pulls/7',
    'gh pr merge --help',
    'gh pr merge 7 --help',
    'gh stack merge --help',
    'echo gh pr merge 7',
    'github-token-wrap pr view 7',
])
    test(`an unheld layer or another gh call passes: ${line}`, async ($, on) => {
        const { ran } = world(on, HELD_7);
        const r = await bash($, line);
        expect(r.deny).toBeUndefined();
        expect(ran.length).toBe(1);
    });

for (const line of [
    'gh pr merge',
    'gh pr merge --squash',
    'gh pr merge codie/FRM-1-a',
    'gh pr merge "$PR"',
    'gh stack merge',
    'gh stack merge 8',
    'gh api -X PUT repos/o/r/pulls/8/merge-async',
    'gh api -X PUT "repos/o/r/pulls/$n/merge"',
    'gh api -X PUT -f commit_title=a/pulls/8/merge repos/o/r/pulls/7/merge',
]) {
    test(`a raw merge whose target cannot be read is refused while a hold stands: ${line}`, async ($, on) => {
        const { ran } = world(on, HELD_7);
        const r = await bash($, line);
        expect(r.deny).toContain('merge-hold');
        expect(ran).toEqual([]);
    });
    test(`with no hold anywhere merge-hold stays out: ${line}`, async ($, on) => {
        world(on);
        const r = await bash($, line);
        expect(r.deny ?? '').not.toContain('rule merge-hold');
    });
}

for (const line of [
    `gh api graphql -f query='mutation { mergePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`,
    `gh api -X POST graphql -f query='mutation { mergePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`,
    `gh api --method POST graphql -f query='mutation { mergePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`,
    `gh api graphql -f query='mutation { enqueuePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`,
    `gh api /graphql -f query='mutation { mergePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`,
    `gh api https://api.github.com/graphql -f query='mutation { mergePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`,
    `gh api '/graphql?a=1' -f query='mutation { mergePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`,
    'gh api graphql -F query=@m.graphql',
    'gh api graphql --input m.json',
    'gh api graphql -f query="$Q"',
])
    test(`a graphql merge names no pr number, so a standing hold refuses it: ${line}`, async ($, on) => {
        const { ran } = world(on, HELD_7);
        const r = await bash($, line);
        expect(r.deny).toContain('merge-hold');
        expect(ran).toEqual([]);
    });

test('a graphql read passes while a hold stands', async ($, on) => {
    const { ran } = world(on, HELD_7);
    const r = await bash(
        $,
        `gh api graphql -f query='query { viewer { login } }'`,
    );
    expect(r.deny).toBeUndefined();
    expect(ran.length).toBe(1);
});

test('a graphql read with a variable of its own passes while a hold stands', async ($, on) => {
    const { ran } = world(on, HELD_7);
    const r = await bash(
        $,
        `gh api graphql -f query='query($n: Int!) { viewer { login } }'`,
    );
    expect(r.deny).toBeUndefined();
    expect(ran.length).toBe(1);
});

test('holds x cannot read read as every merge held, naming x', async ($, on) => {
    const { ran } = world(on, { unread: 'o_r.json: not json' });
    const r = await bash($, 'gh pr merge 8');
    expect(r.deny).toContain('merge-hold');
    expect(r.deny).toContain('x lane merge-auto --brake-check');
    expect(ran).toEqual([]);
});

test('x not answering reads as every merge held, naming x', async ($, on) => {
    const { ran } = world(on, [], [], null);
    const r = await bash($, 'gh pr merge 8');
    expect(r.deny).toContain('merge-hold');
    expect(r.deny).toContain('x lane merge-auto --brake-check');
    expect(ran).toEqual([]);
});

// FRM-570: an unread brake still lists his holds, so a held pr is refused as held, not as an unreadable hold record
test('a brake x could not read still names a hold as a hold', async ($, on) => {
    const { ran } = world(on, HELD_7, [], 'unread');
    const r = await bash($, 'gh pr merge 7');
    expect([r.deny, ran]).toEqual([
        expect.stringContaining('#7 is held by dima'),
        [],
    ]);
});

test('no x call on a line with no raw merge', async ($, on) => {
    const { checks, ran } = world(on, { unread: 'o_r.json: not json' });
    const r = await bash($, 'gh pr view 7');
    expect([r.deny, ran.length, checks]).toEqual([undefined, 1, []]);
});

const RECORD = `${HOLD_DIR}/o_r.json`;
// x is the record's one writer, for every session: the rule reads no name
for (const line of [
    `echo '{"prs":[]}' > ${RECORD}`,
    `echo '{"prs":[]}' > ~/.local/state/x/merge-hold/o_r.json`,
    `trash ${RECORD}`,
    `mv ${RECORD} /tmp/kept.json`,
    `cp a.json ${RECORD}`,
    `python3 -c "import os; os.remove('${RECORD}')"`,
    'cd ~/.local/state/x/merge-hold && echo {} > o_r.json',
    'cd ~/.local/state/x/merge-hold && cp /tmp/a.json o_r.json',
    'cd ~/.local/state/x && trash merge-hold',
    'trash ~/.local/state/x',
    'd=~/.local/state/x; echo {} > $d/merge-hold/o_r.json',
])
    test(`the hold record cannot change by hand: ${line}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect(r.deny).toContain('merge-hold');
        expect(r.deny).toContain('--release-hold');
        expect(ran).toEqual([]);
    });

for (const line of [
    `cat ${RECORD}`,
    `jq . ${RECORD}`,
    `ls ${HOLD_DIR}`,
    'find ~/.local/state/x/lanes -name a',
    `f=$(rg -l FRM-411 ~/.local/state/x -g '*.md'); cut -c1-9 "$f"`,
    'cd ~/.local/state/x/merge-hold && ls',
    'x lane merge-auto 7 --hold --apply',
    'rg merge-hold home/.claude/plugin-x/mods/x-mod-guard/hooks/rules/merge-hold.ts',
])
    test(`a read of the hold record passes: ${line}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect(r.deny).toBeUndefined();
        expect(ran.length).toBe(1);
    });

// FRM-544 slice 2c: his tick on an ask quoting the whole raw merge runs it once, past his hold and the raw-merge rule
const tickOn = (line: string): Tick => ({
    at: 1_000_000 - 1,
    id: 'o9',
    targets: [line],
    text: `⚠️ merge: \`${line}\``,
});
test('his tick on an ask quoting a held pr merge runs it once', async ($, on) => {
    const line = 'gh pr merge 7 --squash';
    const { ran } = world(on, HELD_7, [tickOn(line)]);
    const first = await bash($, line);
    const second = await bash($, line);
    expect([first.deny, second.deny !== undefined, ran]).toEqual([
        undefined,
        true,
        [line],
    ]);
});

test('his tick on a raw merge runs it once with no hold standing', async ($, on) => {
    const line = 'gh pr merge 5 --squash';
    const { ran } = world(on, [], [tickOn(line)]);
    expect([(await bash($, line)).deny, ran]).toEqual([undefined, [line]]);
});

test('his tick on a raw merge runs past a brake that does not read', async ($, on) => {
    const line = 'gh pr merge 5 --squash';
    const { ran } = world(on, [], [tickOn(line)], null);
    expect([(await bash($, line)).deny, ran]).toEqual([undefined, [line]]);
});

for (const [why, ticked, line, brake] of [
    [
        'the command adds a flag',
        'gh pr merge 7 --squash',
        'gh pr merge 7 --squash --admin',
        '',
    ],
    [
        'the tick quotes another pr',
        'gh pr merge 8 --squash',
        'gh pr merge 7 --squash',
        '',
    ],
    [
        'the brake is on',
        'gh pr merge 7 --squash',
        'gh pr merge 7 --squash',
        'held by dima',
    ],
] as const)
    test(`a held pr merge stays refused on a tick when ${why}`, async ($, on) => {
        const { ran } = world(on, HELD_7, [tickOn(ticked)], brake);
        expect([(await bash($, line)).deny !== undefined, ran]).toEqual([
            true,
            [],
        ]);
    });

// 12b (FRM-544 slice 2g): his press on x-herdr-deck clears a held pr as his orbit tick does
test('his press on x-herdr-deck on an ask quoting a held pr merge runs it once', async ($, on) => {
    const line = 'gh pr merge 7 --squash';
    const { ran } = world(on, HELD_7, [], '', `⚠️ merge: \`${line}\``);
    const first = await bash($, line);
    const second = await bash($, line);
    expect([first.deny, second.deny !== undefined, ran]).toEqual([
        undefined,
        true,
        [line],
    ]);
});

test('his press on x-herdr-deck on another pr runs no held merge', async ($, on) => {
    const other = '⚠️ merge: `gh pr merge 8 --squash`';
    const { ran } = world(on, HELD_7, [], '', other);
    const r = await bash($, 'gh pr merge 7 --squash');
    expect([r.deny !== undefined, ran]).toEqual([true, []]);
});
