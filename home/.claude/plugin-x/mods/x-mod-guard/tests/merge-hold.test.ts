import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

const HOLD_DIR = '/home/.local/state/x/merge-hold';

function world(on: On, record: string | null, dirStands = record !== null) {
    mock.clock(on, { now: 1_000_000 });
    liveStore(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'h1h1h1h1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', (_$, e) => ({
        value: e.path === HOLD_DIR ? dirStands : true,
    }));
    on('fs.list', (_$, e) =>
        e.path === HOLD_DIR && record !== null
            ? {
                  value: [
                      {
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: 0,
                          name: 'o_r.json',
                          size: 1,
                      },
                  ],
              }
            : { deny: 'no such dir' },
    );
    on('fs.read', (_$, e) =>
        e.path === `${HOLD_DIR}/o_r.json` && record !== null
            ? { value: record }
            : { deny: 'no such file' },
    );
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}
const bash = ($: Engine, command: string) =>
    $.tool.call({ command, run_in_background: true, tool: 'Bash' });

const HELD_7 = '{"prs":["7"]}';

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
])
    test(`a raw merge of a held pr is refused: ${line}`, async ($, on) => {
        const { ran } = world(on, HELD_7);
        const r = await bash($, line);
        expect(r.deny).toContain('merge-hold');
        expect(r.deny).toContain('#7');
        expect(r.deny).toContain('x lane merge-auto');
        expect(ran).toEqual([]);
    });

for (const line of [
    'gh pr merge 8',
    'gh api -X PUT repos/o/r/pulls/8/merge',
    'gh api repos/o/r/pulls/7/merge',
    'gh pr view 7',
    'gh pr list',
    'gh api repos/o/r/pulls/7',
    'echo gh pr merge 7',
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
]) {
    test(`a raw merge whose target cannot be read is refused while a hold stands: ${line}`, async ($, on) => {
        const { ran } = world(on, HELD_7);
        const r = await bash($, line);
        expect(r.deny).toContain('merge-hold');
        expect(ran).toEqual([]);
    });
    test(`with no hold anywhere it passes: ${line}`, async ($, on) => {
        const { ran } = world(on, null);
        const r = await bash($, line);
        expect(r.deny).toBeUndefined();
        expect(ran.length).toBe(1);
    });
}

for (const line of [
    `gh api graphql -f query='mutation { mergePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`,
    `gh api graphql -f query='mutation { enqueuePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`,
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

test('a record that does not parse reads as held', async ($, on) => {
    const { ran } = world(on, 'not json');
    const r = await bash($, 'gh pr merge 8');
    expect(r.deny).toContain('merge-hold');
    expect(r.deny).toContain('unreadable');
    expect(ran).toEqual([]);
});

test('a hold dir that exists and does not list reads as held', async ($, on) => {
    const { ran } = world(on, null, true);
    const r = await bash($, 'gh pr merge 8');
    expect(r.deny).toContain('unreadable');
    expect(ran).toEqual([]);
});

test('a record with the wrong shape reads as held', async ($, on) => {
    const { ran } = world(on, '{"prs":"7"}');
    const r = await bash($, 'gh pr merge 8');
    expect(r.deny).toContain('merge-hold');
    expect(ran).toEqual([]);
});

test('no read of the record on a line with no raw merge', async ($, on) => {
    const { ran } = world(on, 'not json');
    const r = await bash($, 'gh pr view 7');
    expect(r.deny).toBeUndefined();
    expect(ran.length).toBe(1);
});
