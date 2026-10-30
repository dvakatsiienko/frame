import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

// FRM-459: a ticket body is written through `x linear body --set`, and nobody but dima acts as dima; the coordinator's session is
// exempt and a session the registry does not list fails open. both rules ship warn-only, so most tests set the store's «enforce»
const SID = 'm1m1m1m1-0000';

function world(on: On, name: string | null = '☕️ 🔧 codie') {
    mock.clock(on, { now: 1_000_000 });
    const store = liveStore(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: SID }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: true }));
    on('fs.list', () => ({
        value:
            name === null
                ? []
                : [
                      {
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: 0,
                          name: '1.json',
                          size: 1,
                      },
                  ],
    }));
    on('fs.read', (_$, e) =>
        e.path === '/home/.claude/sessions/1.json'
            ? { value: JSON.stringify({ name, sessionId: SID }) }
            : { deny: 'no such file' },
    );
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran, store };
}
const enforced = (store: Map<string, unknown>) => {
    store.set('rule-mode:linear-body', 'enforce');
    store.set('rule-mode:as-dima', 'enforce');
};
const bash = ($: Engine, command: string) =>
    $.tool.call({ command, run_in_background: true, tool: 'Bash' });

const UPDATE =
    'x linear api \'mutation { issueUpdate(id: "FRM-1", input: { description: "y" }) { success } }\'';
const BODY_DOOR = 'x linear body <id> --set <file>';

for (const [shape, typed] of [
    ['an issueUpdate through x linear api', UPDATE],
    [
        'an issueUpdate that sets a label',
        UPDATE.replace('description', 'labelIds'),
    ],
    [
        'the same in a nested shell',
        `bash -c "${UPDATE.replaceAll('"', '\\"')}"`,
    ],
    ['the same after a cd', `cd /repo && ${UPDATE}`],
    [
        'the raw cli with --description',
        'linear issue update FRM-1 --description x',
    ],
    ['the raw cli with -d', 'linear issue update FRM-1 -d x'],
    [
        'the raw cli creating with a description',
        'linear issue create --title t --description x',
    ],
    [
        'the raw cli behind x as',
        'x as codie -- linear issue update FRM-1 --description x',
    ],
    ['an issueBatchUpdate', UPDATE.replace('issueUpdate', 'issueBatchUpdate')],
    ['an issueCreate', UPDATE.replace('issueUpdate', 'issueCreate')],
    ['a query held in a variable', 'Q=$(cat q.graphql); x linear api "$Q"'],
    ['a query from a substitution', 'x linear api "$(cat q.graphql)"'],
    ['a query fed through xargs', 'cat q.graphql | xargs -0 x linear api'],
] as const)
    test(`a member's body write past the door is refused naming it: ${shape}`, async ($, on) => {
        const w = world(on);
        enforced(w.store);
        const r = await bash($, typed);
        expect([w.ran, r.deny?.includes(BODY_DOOR)]).toEqual([[], true]);
    });

for (const [shape, typed] of [
    ['--as dima', 'x linear read FRM-1 --as dima'],
    ['--as=dima', 'x linear comment FRM-1 --as=dima --body-file f.md'],
    ['an actor held in a variable', 'A=dima; x linear read FRM-1 --as $A'],
    ['x as a variable', 'A=dima; x as "$A" -- linear issue list'],
    [
        'the agent vars unset by env',
        'env -u CLAUDECODE -u AI_AGENT x linear read FRM-1',
    ],
    ['the agent var emptied', 'CLAUDECODE= x linear read FRM-1'],
    ['an emptied environment', 'env -i x linear read FRM-1'],
    ['the agent var unset first', 'unset CLAUDECODE; x linear read FRM-1'],
    ['x as dima', 'x as dima -- linear issue view FRM-1'],
    ['in a nested shell', `bash -c 'x linear read FRM-1 --as dima'`],
] as const)
    test(`a member acting as dima is refused: ${shape}`, async ($, on) => {
        const w = world(on);
        enforced(w.store);
        const r = await bash($, typed);
        expect([w.ran, r.deny?.includes('without --as')]).toEqual([[], true]);
    });

for (const typed of [
    'x linear set FRM-1 --state "In Progress"',
    'x linear set FRM-1 --add-label agent',
    'x linear body FRM-1 --to /tmp/b.md',
    'x linear body FRM-1 --set /repo/b.md',
    "x linear api '{ viewer { id } }'",
    'x linear api \'query($id: String!) { issue(id: $id) { id } }\' --vars \'{"id":"FRM-1"}\'',
    'x linear comment FRM-1 --as codie --body-file f.md',
    'x linear read FRM-1 --comments',
    'x as codie -- linear issue list',
    "echo 'x linear read FRM-1 --as dima'",
])
    test(`a member runs: ${typed}`, async ($, on) => {
        const w = world(on);
        enforced(w.store);
        const r = await bash($, typed);
        expect([w.ran, r.deny]).toEqual([[typed], undefined]);
    });

for (const typed of [UPDATE, 'x linear read FRM-1 --as dima'])
    test(`the coordinator's session runs: ${typed.slice(0, 40)}`, async ($, on) => {
        const w = world(on, '🦉 clio');
        enforced(w.store);
        const r = await bash($, typed);
        expect([w.ran, r.deny]).toEqual([[typed], undefined]);
    });

test('a session the registry does not list runs both, fail open', async ($, on) => {
    const w = world(on, null);
    enforced(w.store);
    await bash($, UPDATE);
    await bash($, 'x linear read FRM-1 --as dima');
    expect(w.ran).toHaveLength(2);
});

test('a thread whose title mentions clio is still a member', async ($, on) => {
    const w = world(on, '🌗 🔧 codie: clio fixes | FRM-9');
    enforced(w.store);
    const r = await bash($, UPDATE);
    expect([w.ran, r.deny === undefined]).toEqual([[], false]);
});

for (const [rule, typed] of [
    ['linear-body', UPDATE],
    ['as-dima', 'x linear read FRM-1 --as dima'],
] as const)
    test(`${rule} warns first: the call runs and the model reads what would have been refused`, async ($, on) => {
        const w = world(on);
        const r = await bash($, typed);
        const noted = JSON.stringify(r.context ?? []);
        const kinds = [...w.store.entries()]
            .filter(([k]) => k.startsWith('event:'))
            .map(([, v]) => (v as { kind: string }).kind);
        expect([w.ran, noted.includes(`rule ${rule}`), kinds]).toEqual([
            [typed],
            true,
            ['warned'],
        ]);
    });

test('a warning keeps the other checks in play: a force-push after it is still refused', async ($, on) => {
    const w = world(on);
    const r = await bash(
        $,
        'x linear read FRM-1 --as dima; git push --force origin main',
    );
    expect([w.ran, r.deny === undefined]).toEqual([[], false]);
});
