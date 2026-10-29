import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts, dimaSays } from './said.ts';
import { liveStore } from './store.ts';

// FRM-425: five holes x-mod-guard let through, each fed to the hook entry as the tool call it is

const POCKET = '/home/frame/_clio';
const NOTED =
    '## Implementation Notes\n\n<!-- SECTION:NOTES:BEGIN -->\nfirst note\n<!-- SECTION:NOTES:END -->\n';
const EMPTY =
    '## Implementation Notes\n\n<!-- SECTION:NOTES:BEGIN -->\n<!-- SECTION:NOTES:END -->\n';
const FILES: Record<string, string> = {
    [`${POCKET}/backlog.config.yml`]:
        'project_name: "cclio pocket"\nbacklog_directory: "pocket"\n',
    [`${POCKET}/pocket/tasks/pk-103 - pm flow review.md`]: NOTED,
    [`${POCKET}/pocket/tasks/pk-104 - a fresh task.md`]: EMPTY,
};
const CLI_ID = '11111111-1111-4111-8111-111111111111';
const LAB_ID = '22222222-2222-4222-8222-222222222222';
const PROJECTS = JSON.stringify({
    data: {
        projects: {
            nodes: [
                {
                    id: CLI_ID,
                    name: 'cli',
                    projectMilestones: { nodes: [{ id: 'm1' }] },
                    slugId: 'abc123',
                },
                {
                    id: LAB_ID,
                    name: 'lab',
                    projectMilestones: { nodes: [] },
                    slugId: 'def456',
                },
            ],
        },
    },
});

// name: this session's name in cc's registry, when a test needs one
type World = { cwd: string; isLinearUp: boolean; name?: string };

function world(on: On, w: World = { cwd: '/repo', isLinearUp: true }) {
    mock.clock(on, { now: 1_000_000 });
    const store = liveStore(on);
    const ran: string[] = [];
    const reads: string[][] = [];
    const files: Record<string, string> = w.name
        ? {
              ...FILES,
              '/home/.claude/sessions/1.json': JSON.stringify({
                  name: w.name,
                  sessionId: 'h1h1h1h1-0000',
              }),
          }
        : FILES;
    answerPrompts(on);
    on('session.id', () => ({ value: 'h1h1h1h1-0000' }));
    on('session.cwd', () => ({ value: w.cwd }));
    on('session.root', () => ({ value: w.cwd }));
    on('env.get', (_$, e) => ({
        value: e.name === 'HOME' ? '/home' : undefined,
    }));
    on('fs.exists', (_$, e) => ({ value: e.path in files }));
    on('fs.read', (_$, e) =>
        e.path in files
            ? { value: files[e.path] as string }
            : { deny: 'no such file' },
    );
    on('fs.list', (_$, e) => {
        const names = Object.keys(files)
            .filter((p) => p.startsWith(`${e.path}/`))
            .map((p) => p.slice(e.path.length + 1))
            .filter((n) => !n.includes('/'));
        return names.length
            ? {
                  value: names.map((name) => ({
                      isLink: false,
                      kind: 'file' as const,
                      mtimeMs: 0,
                      name,
                      size: 1,
                  })),
              }
            : { deny: 'no such dir' };
    });
    on('ui.log', () => ({ value: undefined }));
    on('process.run', (_$, e) => {
        reads.push([...e.argv]);
        return {
            value: {
                exitCode: w.isLinearUp ? 0 : 1,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: w.isLinearUp ? '' : 'dial tcp: no such host',
                stdout: w.isLinearUp ? PROJECTS : '',
            },
        };
    });
    on('tool.call', (_$, e) => {
        ran.push(
            'command' in e
                ? String(e.command)
                : String((e as { message?: unknown }).message),
        );
        return { result: {}, text: 'ran' };
    });
    return { ran, reads, store };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });
const send = ($: Engine, message: string, to: string) =>
    $.tool.call({ message, to, tool: 'SendMessage' } as never);

// E1 — a railway delete, every verb its help lists
for (const command of [
    'railway delete',
    'railway rm',
    'railway environment delete staging',
    'railway variable delete API_KEY',
    'railway service delete',
    'railway volume delete',
    'railway ca delete a1',
    'railway flag delete beta',
    'railway sandbox destroy',
    'railway sandbox rm',
    'railway sbx delete',
    'railway tcp-proxy delete',
    'railway down',
])
    test(`«${command}» is refused as a remote delete`, async ($, on) => {
        const w = world(on);
        const r = await bash($, command);
        expect([w.ran, r.deny]).toEqual([
            [],
            expect.stringMatching(/ask cclio.*deletes on the remote/),
        ]);
    });

for (const command of [
    'railway variables --kv',
    'railway status',
    'railway run rm -rf dist',
])
    test(`«${command}» runs`, async ($, on) => {
        const w = world(on);
        expect([w.ran, (await bash($, command)).deny]).toEqual([
            [command],
            undefined,
        ]);
    });

// E2 — a mirror push rewrites every remote ref, the same class as a force push
for (const command of ['git push --mirror origin', 'git push origin --mirror'])
    test(`«${command}» is refused naming # dima-ok: origin`, async ($, on) => {
        const w = world(on);
        const r = await bash($, command);
        expect([w.ran, r.deny]).toEqual([
            [],
            expect.stringMatching(/# dima-ok: origin$/),
        ]);
    });

test('a mirror push marked # dima-ok: origin runs', async ($, on) => {
    const w = world(on);
    await dimaSays($, 'mirror it to origin, ok');
    await bash($, 'git push --mirror origin # dima-ok: origin');
    expect(w.ran).toHaveLength(1);
});

test('a plain git push origin main runs', async ($, on) => {
    const w = world(on);
    expect([w.ran, (await bash($, 'git push origin main')).deny]).toEqual([
        ['git push origin main'],
        undefined,
    ]);
});

// E3 — the pocket dir comes from backlog_directory in the repo's backlog.config.yml
test('--notes over a pocket task that holds notes is refused naming --append-notes', async ($, on) => {
    const w = world(on, { cwd: POCKET, isLinearUp: true });
    const r = await bash($, 'backlog task edit pk-103 --notes "x"');
    expect([w.ran, r.deny]).toEqual([
        [],
        expect.stringContaining('backlog task edit pk-103 --append-notes'),
    ]);
});

test('BACKLOG_CWD names the pocket repo from anywhere', async ($, on) => {
    const w = world(on);
    const r = await bash(
        $,
        `BACKLOG_CWD=${POCKET} backlog task edit pk-103 --notes "x"`,
    );
    expect([w.ran, r.deny]).toEqual([
        [],
        expect.stringContaining('--append-notes'),
    ]);
});

for (const command of [
    'backlog task edit pk-103 --append-notes "x"',
    'backlog task edit pk-104 --notes "x"',
])
    test(`«${command}» in the pocket runs`, async ($, on) => {
        const w = world(on, { cwd: POCKET, isLinearUp: true });
        expect([w.ran, (await bash($, command)).deny]).toEqual([
            [command],
            undefined,
        ]);
    });

// E4 — a ticket that lands in a project with milestones names one
const MILESTONE = 'pick a milestone, or propose one';
for (const command of [
    'x as coder -- linear issue create --project cli -t x',
    'x as coder -- linear issue create --project=cli -t x',
    'x as coder -- linear issue create --project cli --milestone "" -t x',
    'x as coder -- linear issue create --project cli --milestone= -t x',
    'x linear set FRM-1 --project cli',
    'x linear --json set FRM-1 --project cli',
    'x linear --as=coder set FRM-1 --project cli',
    'x linear --as coder set FRM-1 --project cli',
    'x linear --board set FRM-1 --project cli',
    'x --json linear set FRM-1 --project cli',
    'x --as coder linear set FRM-1 --project cli',
    'x --as=coder --json linear set FRM-1 --project cli',
    `x linear api 'mutation { issueCreate(input: { teamId: "t", title: "x", projectId: "${CLI_ID}" }) { success } }'`,
    `x linear api 'mutation { issueUpdate(id: "FRM-1", input: { projectId: "${CLI_ID}" }) { success } }'`,
    `x linear api --vars '{"p":"${CLI_ID}"}' 'mutation($p: String!) { issueCreate(input: { teamId: "t", title: "x", projectId: $p }) { success } }'`,
    `x linear api 'mutation { issueCreate(input: { teamId: "t", title: "x", projectId: "${CLI_ID}", projectMilestoneId: null }) { success } }'`,
    'linear --team FRM issue create --project cli -t x',
])
    test(`«${command}» is refused naming a milestone`, async ($, on) => {
        const w = world(on);
        const r = await bash($, command);
        expect([w.ran, r.deny]).toEqual([
            [],
            expect.stringContaining(MILESTONE),
        ]);
    });

for (const command of [
    'x as coder -- linear issue create --project cli --milestone "🐉 review loop gets verbs" -t x',
    `x linear api 'mutation { issueCreate(input: { teamId: "t", title: "x", projectId: "${CLI_ID}", projectMilestoneId: "m1" }) { success } }'`,
    'x as coder -- linear issue create -t x',
    'x as coder -- linear issue create --project lab -t x',
    "rg -- '--project' .",
    'x linear list --search set --project cli',
    'x lane commit msg.txt -- linear set --project cli',
])
    test(`«${command}» runs`, async ($, on) => {
        const w = world(on);
        expect([w.ran, (await bash($, command)).deny]).toEqual([
            [command],
            undefined,
        ]);
    });

// a pathless commit meets its own rule (x lane commit); the milestone rule leaves it alone
test('«git commit -m "guard --project"» is not read as a linear call', async ($, on) => {
    const w = world(on);
    const r = await bash($, 'git commit -m "guard --project"');
    expect([w.reads, r.deny?.includes(MILESTONE) ?? false]).toEqual([
        [],
        false,
    ]);
});

// x takes a root flag anywhere before its family: each one × each family form, in either order of two
const ROOT_FLAGS = ['--json', '--board', '--apply', '--as coder', '--as=coder'];
const FAMILY_FORMS = [
    'linear set FRM-1 --project cli',
    'as coder -- linear issue create --project cli -t x',
    'as coder -- linear issue update FRM-1 --project cli',
    'as coder linear issue create --project cli -t x',
    'as --json coder -- linear issue create --project cli -t x',
    'as coder --board linear issue update FRM-1 --project cli',
];
for (const flag of ROOT_FLAGS)
    for (const form of FAMILY_FORMS)
        for (const command of [`x ${flag} ${form}`, `x ${flag} --json ${form}`])
            test(`«${command}» is refused naming a milestone`, async ($, on) => {
                const w = world(on);
                const r = await bash($, command);
                expect([w.ran, r.deny]).toEqual([
                    [],
                    expect.stringContaining(MILESTONE),
                ]);
            });

test('with linear unreachable the create runs, warned that the milestone check was skipped', async ($, on) => {
    const w = world(on, { cwd: '/repo', isLinearUp: false });
    const r = await bash(
        $,
        'x as coder -- linear issue create --project cli -t x',
    );
    expect([
        w.ran.length,
        r.deny,
        r.context?.some((c) => /milestone check .*skipped/.test(c)),
    ]).toEqual([1, undefined, true]);
});

test('the projects read is cached for a day', async ($, on) => {
    const w = world(on);
    await bash($, 'x linear set FRM-1 --project lab');
    await bash($, 'x linear set FRM-2 --project lab');
    expect(w.reads).toHaveLength(1);
});

// E5 — a lane send to a coder or verifier that names a ticket goes through a spec, whatever its item count
const SPEC = 'shape-lane-dispatch § 2';
for (const [shape, message] of [
    ['1 item', 'FRM-425 round 1:\n1. close the railway hole'],
    ['5 items', 'BYT-12 job:\n1. a\n2. b\n3. c\n4. d\n5. e'],
] as const)
    for (const to of ['🌗 🔧 FRM-425 code', '⚡ 🔎 FRM-425 verify: main'])
        test(`a ${shape} send naming a ticket to «${to}» is refused`, async ($, on) => {
            const w = world(on);
            const r = await send($, message, to);
            expect([w.ran, r.deny]).toEqual([
                [],
                expect.stringMatching(
                    new RegExp(
                        `${SPEC}.*\\.scratch/<feature>/spec\\.md|\\.scratch/<feature>/spec\\.md.*${SPEC}`,
                    ),
                ),
            ]);
        });

test("a verifier's findings to its coder are sent", async ($, on) => {
    const w = world(on, {
        cwd: '/repo',
        isLinearUp: true,
        name: '⚡ 🔎 FRM-425 verify: main',
    });
    const message = 'FRM-425 round 1:\n1. E3 fails from ~/frame';
    expect([w.ran, (await send($, message, '🔧 coder')).deny]).toEqual([
        [message],
        undefined,
    ]);
});

test('a ticket named only inside a quote leaves the 3+ rule', async ($, on) => {
    const w = world(on);
    const message = 'dima wrote:\n> FRM-1 looks done\n1. the meter';
    expect([w.ran, (await send($, message, '🔧 coder')).deny]).toEqual([
        [message],
        undefined,
    ]);
});

test('a ticket send naming its spec path is sent', async ($, on) => {
    const w = world(on);
    const message =
        'FRM-425 round 1:\n1. close the hole\nspec: ~/frame/.scratch/mods-lane-2/spec.md';
    const r = await send($, message, '🌗 🔧 FRM-425 code');
    expect([w.ran, r.deny]).toEqual([[message], undefined]);
});

test('a 2-item send naming no ticket is sent, the 3+ rule unchanged', async ($, on) => {
    const w = world(on);
    const message = 'round 2:\n1. a\n2. b';
    expect([w.ran, (await send($, message, '🔧 coder')).deny]).toEqual([
        [message],
        undefined,
    ]);
});

test('a 3-item send naming no ticket is refused', async ($, on) => {
    world(on);
    const r = await send($, 'round 2:\n1. a\n2. b\n3. c', '🔧 coder');
    expect(r.deny).toContain(SPEC);
});

// E6 — the five holes as their literal commands, replayed at the hook entry
for (const [hole, cwd, call, door] of [
    ['railway', '/repo', 'railway variable delete API_KEY', 'ask cclio'],
    ['mirror', '/repo', 'git push --mirror origin', '# dima-ok: origin'],
    [
        'pocket notes',
        POCKET,
        'backlog task edit pk-103 --notes "x"',
        '--append-notes',
    ],
    [
        'milestone',
        '/repo',
        "x as coder -- linear issue create --team FRM -t 'x linear set: several --add-label flags keep only the last one' --description-file b245.md --project cli -l agent -l bug -p medium --estimate 1 --no-input -y",
        MILESTONE,
    ],
] as const)
    test(`want line: the ${hole} hole is refused with its door`, async ($, on) => {
        const w = world(on, { cwd, isLinearUp: true });
        const r = await bash($, call);
        expect([w.ran, r.deny]).toEqual([[], expect.stringContaining(door)]);
    });

test('want line: a one-item lane brief with no spec is refused with its door', async ($, on) => {
    const w = world(on);
    const r = await send(
        $,
        'FRM-425 job:\n1. close the five guard holes',
        '🌗 🔧 FRM-425 code',
    );
    expect([w.ran, r.deny]).toEqual([
        [],
        expect.stringContaining('.scratch/<feature>/spec.md'),
    ]);
});
