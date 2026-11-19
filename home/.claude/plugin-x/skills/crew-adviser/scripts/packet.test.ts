import {
    mkdtempSync,
    readFileSync,
    readdirSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    buildPacket,
    consoleOf,
    cutLine,
    decisionOf,
    leavesToSend,
    prViewArgs,
    proposalOf,
    resolveLeaves,
} from './packet.ts';
import { fixtures, lines, toolUse } from './test-rows.ts';
import { transcriptDelta } from './transcript.ts';

const leavesDir = join(fixtures, 'leaves');

describe('proposalOf reads a proposal written by Bash', () => {
    test('a heredoc redirect into a proposal file wakes', () => {
        expect(
            proposalOf(
                'Bash',
                undefined,
                "cat > .scratch/x/grill-1-proposal.md <<'EOF'",
            ),
        ).toEqual({ kind: 'proposal', path: '.scratch/x/grill-1-proposal.md' });
    });

    test('a tee into a proposal file wakes', () => {
        expect(
            proposalOf(
                'Bash',
                undefined,
                'echo hi | tee -a /a/.scratch/b-proposal.md',
            ),
        ).toEqual({ kind: 'proposal', path: '/a/.scratch/b-proposal.md' });
    });

    test('a ~ path wakes with the home dir expanded', () => {
        expect(
            proposalOf(
                'Bash',
                undefined,
                "cat >> ~/frame/_clio/.scratch/pk159/grill-1-proposal.md <<'EOF'",
            ),
        ).toEqual({
            kind: 'proposal',
            path: `${homedir()}/frame/_clio/.scratch/pk159/grill-1-proposal.md`,
        });
    });

    test('a relative target resolves against a leading cd, else the hook cwd', () => {
        const command = "printf 'x' >> .scratch/h/g-proposal.md && echo ok";
        expect(
            proposalOf(
                'Bash',
                undefined,
                `cd ~/frame/_clio && ${command}`,
                '/z',
            ),
        ).toEqual({
            kind: 'proposal',
            path: join(homedir(), 'frame/_clio/.scratch/h/g-proposal.md'),
        });
        expect(proposalOf('Bash', undefined, command, '/z')).toEqual({
            kind: 'proposal',
            path: '/z/.scratch/h/g-proposal.md',
        });
    });

    test('a command that only reads a proposal file stays quiet', () => {
        expect(
            proposalOf('Bash', undefined, 'cat .scratch/x/grill-1-proposal.md'),
        ).toBeUndefined();
    });
});

describe('resolveLeaves', () => {
    test('expands {today} into every match of the day', () => {
        const { found } = resolveLeaves(
            [`${leavesDir}/flawlog/{today}-*.md`],
            '2026-10-06',
        );
        expect(found.map((path) => path.split('/').at(-1))).toEqual([
            '2026-10-06-a.md',
            '2026-10-06-b.md',
        ]);
    });

    test('takes only the newest match for a latest line', () => {
        const dir = mkdtempSync(join(tmpdir(), 'crow-'));
        for (const [name, time] of [
            ['old.md', 1000],
            ['new.md', 2000],
        ] as const) {
            writeFileSync(join(dir, name), name);
            utimesSync(join(dir, name), time, time);
        }
        const { found } = resolveLeaves([`latest ${dir}/*.md`], '2026-10-06');
        expect(found.map((path) => path.split('/').at(-1))).toEqual(['new.md']);
    });

    test('reports a line with no match', () => {
        const { missing } = resolveLeaves(
            [`${leavesDir}/nope.md`],
            '2026-10-06',
        );
        expect(missing).toEqual([`${leavesDir}/nope.md`]);
    });
});

describe('buildPacket', () => {
    test('writes one packet.md: the delta, then each leaf under its header', () => {
        const dir = join(mkdtempSync(join(tmpdir(), 'crow-')), 'packet');
        const leaf = join(leavesDir, 'strategy.md');
        buildPacket({
            deltaText: '## dima\nhi',
            dir,
            leaves: [leaf],
            missing: [],
        });
        expect(readdirSync(dir)).toEqual(['packet.md']);
        expect(readFileSync(join(dir, 'packet.md'), 'utf8')).toBe(
            `# clio main since the last wake\n\n## dima\nhi\n\n## leaf · ${leaf}\n\nvector: ship the fleet\n`,
        );
    });

    const packetOf = (deltaLines: string[]) => {
        const dir = join(mkdtempSync(join(tmpdir(), 'crow-')), 'packet');
        const delta = transcriptDelta(deltaLines, 0);
        buildPacket({
            cut: cutLine(delta.cut, '/t/clio.jsonl'),
            deltaText: delta.text,
            dir,
            leaves: [],
            missing: [],
        });
        return readFileSync(join(dir, 'packet.md'), 'utf8');
    };

    test('a cut packet carries one cut line naming the transcript', () => {
        const report = 'x'.repeat(5_000);
        const packet = packetOf([
            JSON.stringify({
                message: {
                    content: `<task-notification><result>${report}</result></task-notification>`,
                },
                type: 'user',
            }),
        ]);
        expect(packet.match(/^cut: .*$/gm)).toEqual([
            'cut: 0 older blocks dropped, 1 tool outputs capped · transcript /t/clio.jsonl',
        ]);
    });

    test('an uncut packet carries no cut line', () => {
        expect(packetOf(lines)).not.toMatch(/^cut:/m);
    });
});

test('a leaf goes again only when it changed, or when crow started a new transcript', () => {
    const leaf = join(leavesDir, 'strategy.md');
    const first = leavesToSend([leaf], { offsets: {} }, 't1');
    expect(first.changed).toEqual([leaf]);
    const state = { leafHashes: first.hashes, leavesFor: 't1', offsets: {} };
    expect(leavesToSend([leaf], state, 't1')).toMatchObject({
        changed: [],
        unchanged: [leaf],
    });
    expect(leavesToSend([leaf], state, 't2').changed).toEqual([leaf]);
});

describe('decisionOf', () => {
    test.each([
        ['gh pr merge 82 -R dvakatsiienko/frame --squash', 'merge'],
        ['x lane push --apply && gh pr merge 82', 'merge'],
        ['GH_TOKEN=x gh pr merge 5', 'merge'],
        ['gh pr merge --subject "a; claude --bg" 82', 'merge'],
        [
            'cd ~/frame && claude --bg -n "☕️ 🔧 x" "/x:crew-codie FRM-1"',
            'spawn',
        ],
        ['A=1 claude --bg hi', 'spawn'],
        ['x lane commit -m "gh pr merge 3"', undefined],
        ["echo 'claude --bg'", undefined],
        ['gh pr view 82', undefined],
        ['claude -p hi', undefined],
        ['x lane push --apply', undefined],
        ['git log | grep "gh pr merge"', undefined],
        // the $54 batch's own command, 2026-11-03 l2543
        [
            'cd ~/frame && script/op-run.sh python3 -I /tmp/s/retro/batch.py submit 2>&1 | tail -5',
            'paid',
        ],
        [
            `script/op-run.sh sh -c 'curl -sS https://api.anthropic.com/v1/messages -d "{}"'`,
            'paid',
        ],
        ['curl https://example.com/v1/messages/batches', 'paid'],
        ["python3 -I - <<'PY'\nimport anthropic\nPY", 'paid'],
        ['batch.py status', undefined],
        ['rg -n api.anthropic.com docs', undefined],
        ['x lane commit -m "curl docs"', undefined],
        ['curl https://example.com', undefined],
        ['gh pr create --title x', 'post'],
        ['gh pr comment 5 --body-file f', 'post'],
        ['gh issue create --title x', 'post'],
        ['gh issue comment 9 --body hi', 'post'],
        ['slk send general hello', 'post'],
        ['slk s general hello', 'post'],
        ['himalaya message send < m.eml', 'post'],
        ['gh pr view 5', undefined],
        ['gh issue view 99217', undefined],
        ['slk read general', undefined],
        ['slk draft general hello', undefined],
        ['himalaya envelope list', undefined],
        ['x linear set FRM-1 --state Done', 'close'],
        ['x linear set FRM-1 --state=Canceled', 'close'],
        ['x linear set FRM-1 --state done --add-label x', 'close'],
        ['x linear set FRM-1 --state Todo', undefined],
        ['x linear set FRM-1 --add-label done', undefined],
        ['git push', undefined],
        ['rg -n ANTHROPIC_CREDITS_KEY op.env', undefined],
        ["python3 - <<'PY'\nedit = 'rg -e @anthropic-ai/sdk'\nPY", undefined],
        ['rg -l -e @anthropic-ai/sdk -e api.anthropic.com frame', undefined],
        ['echo "batch.py submit"', undefined],
        ['git commit -m "node hook: @anthropic-ai/sdk note"', undefined],
        [
            'git commit -m "curl https://api.anthropic.com/v1/messages"',
            undefined,
        ],
        [
            "cat > doc.md <<'EOF'\ngh pr merge 5\nimport anthropic\nEOF",
            undefined,
        ],
        ["x lane commit <<'EOF'\nclaude --bg hi\nEOF\ngh pr view 5", undefined],
        ["cat > a.md <<'EOF'\nx\nEOF\ngh pr merge 5", 'merge'],
        ['env A=1 gh pr merge 5', 'merge'],
        [`bash -c 'x linear set FRM-1 --state Done'`, 'close'],
    ])('%s → %s', (line, kind) => {
        expect(decisionOf(line)?.kind).toBe(kind);
    });

    test('a script counts as paid by its own source, through a runner or a pnpm verb', () => {
        const dir = mkdtempSync(join(tmpdir(), 'crow-paid-'));
        writeFileSync(
            join(dir, 'paid.ts'),
            "import Anthropic from '@anthropic-ai/sdk';\n",
        );
        writeFileSync(join(dir, 'free.ts'), 'console.log(1);\n');
        writeFileSync(
            join(dir, 'package.json'),
            JSON.stringify({
                scripts: {
                    'free:run': 'node ./free.ts',
                    'paid:run': 'node ./paid.ts',
                },
            }),
        );
        const kindOf = (line: string) => decisionOf(line, dir)?.kind;
        expect(kindOf('node paid.ts')).toBe('paid');
        expect(kindOf('node free.ts')).toBeUndefined();
        expect(kindOf('cat paid.ts')).toBeUndefined();
        expect(kindOf('pnpm paid:run')).toBe('paid');
        expect(kindOf(`pnpm -C ${dir} --silent paid:run`)).toBe('paid');
        expect(decisionOf('pnpm -C sub paid:run', join(dir, '..'))?.kind).toBe(
            undefined,
        );
        expect(kindOf('pnpm free:run')).toBeUndefined();
        expect(kindOf('rg x paid.ts')).toBeUndefined();
        expect(decisionOf(`cd ${dir} && node paid.ts`, '/')?.kind).toBe('paid');
    });

    test('the close names its ticket, the post its verb', () => {
        expect(decisionOf('x linear set FRM-1 --state Done')).toEqual({
            kind: 'close',
            what: 'FRM-1',
        });
        expect(decisionOf('gh pr comment 5')).toEqual({
            kind: 'post',
            what: 'gh pr comment',
        });
    });
});

describe('consoleOf', () => {
    const nav = 'mcp__Claude_Browser__navigate';
    const click = 'mcp__Claude_Browser__computer';
    const onConsole = () => [
        toolUse('n', nav, { url: 'https://console.anthropic.com/settings' }),
    ];

    test.each([
        [nav, { url: 'https://console.anthropic.com/x' }, 'console'],
        [nav, { url: 'https://platform.claude.com/settings/keys' }, 'console'],
        [nav, { url: 'https://vercel.com/acme/settings/billing' }, 'console'],
        [nav, { url: 'https://example.com/billingsworth' }, undefined],
        [nav, { url: 'https://example.com' }, undefined],
        [click, { action: 'left_click' }, 'console'],
        [click, { action: 'screenshot' }, undefined],
        ['Bash', { url: 'https://console.anthropic.com' }, undefined],
    ])('%s %j → %s', (tool, input, kind) => {
        expect(consoleOf(tool, input, onConsole)?.kind).toBe(kind);
    });
});

describe('prViewArgs', () => {
    const json = ['--json', 'number,headRefOid,url'];
    test.each([
        ['82 -R o/r --squash', ['82', '--repo', 'o/r']],
        [
            '--repo=o/r https://github.com/o/r/pull/9',
            ['https://github.com/o/r/pull/9', '--repo', 'o/r'],
        ],
        ['-t "x y" -b z --squash 3', ['3']],
        ['--squash', []],
        ['--subject 82 7', ['7']],
    ])('gh pr merge %s', (args, view) => {
        const merge = decisionOf(`gh pr merge ${args}`);
        expect(merge?.kind === 'merge' && prViewArgs(merge.args)).toEqual([
            'pr',
            'view',
            ...view,
            ...json,
        ]);
    });
});

test('x lane merge-auto is a merge decision, behind a timeout too', () => {
    expect(decisionOf('x lane merge-auto 82 --apply')).toMatchObject({
        args: ['82', '--apply'],
        kind: 'merge',
    });
    expect(decisionOf('timeout 280 x lane merge-auto 82 --apply')?.kind).toBe(
        'merge',
    );
    expect(decisionOf('x lane merge-main')?.kind).not.toBe('merge');
});

test('a merge-auto with no pr, a redirect or a pipe is no merge decision', () => {
    expect(
        decisionOf('x lane merge-auto --override-off --apply 2>&1 | tail -2')
            ?.kind,
    ).not.toBe('merge');
    const merge = decisionOf('x lane merge-auto 82 --apply > out.txt 2>&1');
    expect(merge?.kind === 'merge' && prViewArgs(merge.args)).toEqual([
        'pr',
        'view',
        '82',
        '--json',
        'number,headRefOid,url',
    ]);
});

test('a plan-only x lane merge-auto spends no merge check', () => {
    expect(decisionOf('x lane merge-auto 82')?.kind).not.toBe('merge');
});
