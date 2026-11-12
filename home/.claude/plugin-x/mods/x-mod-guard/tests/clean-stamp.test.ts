import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

const SID = 'c1c1c1c1-0000';

// a registry row as the desktop app writes one, 2026-11-06: its sessionId is the transcript's; role: the session's thread
// record as x thread list answers it (FRM-570 rule 9), whatever the name says
function world(on: On, name: string | null, role?: string, isXMissing = false) {
    mock.clock(on, { now: 1_000_000 });
    liveStore(on);
    const ran: string[] = [];
    on('process.run', (_$, e) => ({
        value: {
            exitCode: isXMissing && e.argv[0] === 'x' ? 127 : 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout:
                !isXMissing && e.argv.join(' ') === 'x thread list --json'
                    ? JSON.stringify({
                          data: { threads: [{ role, sessionId: SID }] },
                      })
                    : '',
        },
    }));
    on('session.id', () => ({ value: SID }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: true }));
    on('fs.stat', (_$, e) => ({
        value: {
            isLink: false,
            kind: 'file' as const,
            mtimeMs: 0,
            realPath: e.path,
            size: 0,
        },
    }));
    on('fs.list', (_$, e) =>
        e.path === '/home/.claude/sessions' && name !== null
            ? {
                  value: [
                      {
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: 0,
                          name: '1.json',
                          size: 1,
                      },
                  ],
              }
            : { value: [] },
    );
    on('fs.read', (_$, e) =>
        e.path === '/home/.claude/sessions/1.json'
            ? {
                  value: JSON.stringify({
                      entrypoint: 'claude-desktop',
                      hostSessionId: 'local_d54e',
                      kind: 'interactive',
                      name,
                      sessionId: SID,
                  }),
              }
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

const STORE = '/home/.claude/shelf/pr-verified.json';
const WRITES = [
    '/home/frame/_clio/.claude/hooks/watch-pr.sh --verified 7 abc',
    'bash ~/frame/_clio/.claude/hooks/watch-pr.sh --verified 7 abc',
    '~/frame/_clio/.claude/hooks/watch-pr.sh --verified o/r 7 abc --security abc',
    './watch-pr.sh 7 --verified',
    `echo '{}' > ${STORE}`,
    `echo '{}' >> ~/.claude/shelf/pr-verified.json`,
    `echo '{}' > "$HOME/.claude/shelf/pr-verified.json"`,
    `jq . a.json | tee ${STORE}`,
    `cp a.json ${STORE}`,
    `mv a.json $HOME/.claude/shelf/pr-verified.json`,
    `sed -i '' s/a/b/ ${STORE}`,
    `sed -I '' s/a/b/ ${STORE}`,
    `python3 -c "open('${STORE}', 'w').write('{}')"`,
    `node -e "require('fs').writeFileSync('${STORE}', '{}')"`,
    `python3 -c "from pathlib import Path; (Path.home()/'.claude/shelf/pr-verified.json').write_text('{}')"`,
    `python3 -c "import json,os; json.dump({},open(os.path.expanduser('~/.claude/shelf/pr-verified.json'),'w'))"`,
    `echo '{}' > ~/frame/cc/shelf/pr-verified.json`,
    `node -e "require('fs').writeFileSync('cc/shelf/pr-verified.json', '{}')"`,
    'bash -o pipefail watch-pr.sh --verified 7 abc',
    'source watch-pr.sh --verified 7 abc',
    'dash watch-pr.sh --verified 7 abc',
    `python3 -c "import shutil; shutil.copy('a', '${STORE}')"`,
    `python3 -c "import os; os.replace('a', '${STORE}')"`,
    `python3 -c "open('${STORE}', mode='w')"`,
    `node -e "require('fs').cpSync('a', '${STORE}')"`,
    `jq . a | sponge ${STORE}`,
    '> ~/.claude/shelf/PR-verified.json',
    `dd if=a of=${STORE}`,
    `sd a b ${STORE}`,
    `echo {} >& ${STORE}`,
    `echo ${STORE} | xargs trash`,
    'cp /tmp/pr-verified.json ~/.claude/shelf/',
    `sed -n "w ${STORE}" a`,
    `sd -- -a -b ${STORE}`,
    'cd ~/.claude/shelf && dd if=a of=pr-verified.json',
    'mv ~/.claude/shelf/pr-verified.{json,bak}',
    `trash "$(realpath ${STORE})"`,
    `trash ${STORE}`,
    `find ${STORE} -delete`,
    `perl -i -pe s/a/b/ ${STORE}`,
    `awk '{print}' a > ${STORE}`,
    'cd ~/.claude/shelf && echo {} > pr-verified.json',
    `python3 script.py ${STORE}`,
    `p=${STORE}; cp a.json "$p"`,
    `python3 <<'PY'\nimport os\nos.remove('${STORE}')\nPY`,
];

for (const name of [
    '🌗 🔧 codie: cli lane 5 | FRM-511',
    '🎀 helga',
    '🦉 clio (side)',
])
    for (const line of WRITES)
        test(`${name} is refused: ${line}`, async ($, on) => {
            const { ran } = world(on, name);
            const r = await bash($, line);
            expect(r.deny).toContain('clean-stamp');
            expect(r.deny).toContain('sixth sense');
            expect(ran).toEqual([]);
        });

for (const line of WRITES)
    test(`a session the registry does not list is refused: ${line}`, async ($, on) => {
        const { ran } = world(on, null);
        const r = await bash($, line);
        expect(r.deny).toContain('clean-stamp');
        expect(ran).toEqual([]);
    });

// exit 15: the sixth sense is known by its record, so a name with no member word or no emoji reads the same
for (const [name, role] of [
    ['🌗 🔎 sixth sense: cli lane 5 | #129', 'sixth-sense'],
    ['cli lane 5 | #129', 'sixth-sense'],
    ['sixth sense: cli lane 5', 'sixth-sense'],
    ['🦉 clio', 'coordinator'],
] as const)
    for (const line of WRITES)
        test(`${name} writes it: ${line}`, async ($, on) => {
            const { ran } = world(on, name, role);
            const r = await bash($, line);
            expect(r.deny ?? '').not.toContain('clean-stamp');
            // the guard's other rules still read a write over a file unread, so only the hook's own line must run
            if (line.includes('watch-pr.sh')) expect(ran.length).toBe(1);
        });

for (const line of [
    `cat ${STORE}`,
    `jq . ${STORE}`,
    `rg o/r ${STORE}`,
    `cp ${STORE} /tmp/copy.json`,
    `cp ${STORE} /tmp/`,
    '~/frame/_clio/.claude/hooks/watch-pr.sh 7',
    `sed -n 1p ${STORE}`,
    'ls ~/.claude/shelf',
    "git grep -n foo -- ':!home/.claude/shelf'",
    'cd ~/.claude/shelf && ls handoffs | cut -c1-9',
    'cp ~/.claude/shelf/a.md /tmp/',
    "find ~/.claude/shelf -name '*.json'",
    `sd "${STORE} holds it" "${STORE} holds the clean" docs/a.md`,
    'echo watch-pr.sh --verified',
    `echo ${STORE}`,
    'rg pr-verified.json x/go',
])
    test(`a member's read of the store passes: ${line}`, async ($, on) => {
        const { ran } = world(on, '🌗 🔧 codie: cli lane 5 | FRM-511');
        const r = await bash($, line);
        expect(r.deny ?? '').not.toContain('clean-stamp');
        expect(ran.length).toBe(1);
    });

// a script names the store and no parser can read what it does with it, so a read goes through jq or cat
for (const line of [
    `node -e "console.log(require('fs').readFileSync('${STORE}', 'utf8'))"`,
    `python3 -c "import json; print(json.load(open('${STORE}')))"`,
])
    test(`a member's inline script over the store is refused: ${line}`, async ($, on) => {
        const { ran } = world(on, '🌗 🔧 codie: cli lane 5 | FRM-511');
        const r = await bash($, line);
        expect(r.deny).toContain('clean-stamp');
        expect(ran).toEqual([]);
    });

// FRM-570: the thread store decides who is a sixth sense, so no session writes it, a sixth sense included; x does
const THREADS = '/home/.claude/shelf/threads.json';
const THREAD_WRITES = WRITES.filter((l) => !l.includes('watch-pr.sh')).map(
    (l) =>
        l
            .replaceAll(STORE, THREADS)
            .replaceAll('pr-verified.{json', 'threads.{json')
            .replaceAll('PR-verified.json', 'Threads.json')
            .replaceAll('pr-verified.json', 'threads.json'),
);
for (const [name, role] of [
    ['🌗 🔧 codie: cli lane 5 | FRM-511', 'codie'],
    ['🌗 🔎 sixth sense: cli lane 5 | #129', 'sixth-sense'],
    ['🦉 clio', 'coordinator'],
] as const)
    for (const line of THREAD_WRITES)
        test(`${name} cannot write the thread store: ${line}`, async ($, on) => {
            const { ran } = world(on, name, role);
            const r = await bash($, line);
            // a codie's carrier into the shelf meets the clean stamp's own fence first; either way the line never runs
            expect([r.deny, ran]).toEqual([
                expect.stringContaining('(rule clean-stamp)'),
                [],
            ]);
        });

for (const line of [
    `cat ${THREADS}`,
    `jq '.threads[] | .role' ${THREADS}`,
    'x thread list --json',
    `cp ${THREADS} /tmp/threads-copy.json`,
    'rg threads.json x/go',
])
    test(`a read of the thread store passes: ${line}`, async ($, on) => {
        const { ran } = world(on, '🌗 🔧 codie: cli lane 5 | FRM-511', 'codie');
        const r = await bash($, line);
        expect(r.deny ?? '').not.toContain('threads.json');
        expect(ran.length).toBe(1);
    });

// wing 1, 21:25: x writes the store from go, so the two verbs that write a role run past the fence (their line names no store)
for (const line of [
    `x brief summon "cd /repo && claude --bg -n 'n' \\"\\$(cat /repo/brief.md)\\" --remote-control"`,
    'x lane dispatch FRM-511 --lane cli-lane-5 --session 1f0c --sixth-sense 2e1d --apply',
])
    test(`a verb that writes the thread store from x passes the fence: ${line}`, async ($, on) => {
        const { ran } = world(on, '🦉 clio', 'coordinator');
        const r = await bash($, line);
        expect(r.deny ?? '').not.toContain('threads.json');
        expect(ran.length).toBe(1);
    });

// sixth sense round 1, exit 10: an x that is missing names no sixth sense, so the stamp stays refused
test('a sixth sense stamping while x is missing is refused', async ($, on) => {
    const { ran } = world(
        on,
        '🌗 🔎 sixth sense: cli lane 5 | #129',
        'sixth-sense',
        true,
    );
    const r = await bash($, WRITES[0] ?? '');
    expect([r.deny, ran]).toEqual([expect.stringContaining('clean-stamp'), []]);
});

// FRM-570 round 3, exit 17: a codie tries each path to a role or a clean stamp, and each is refused
const CODIE = '🌗 🔧 codie: cli lane 5 | FRM-511';
const SUMMONED =
    "claude -p --session-id 1f0c2e1d-0000-4000-8000-000000000001 '/x:crew-sixth-sense FRM-1 main:abc codie clio spec: s'";
for (const line of [
    SUMMONED,
    'claude --session-id=1f0c2e1d-0000-4000-8000-000000000001 -p hi',
    "hc run --bg --no-parent --name x --cwd /repo -- claude --session-id 1f0c -n n 'hi'",
    `echo '{"name":"🦉 clio"}' > /home/.claude/sessions/4242.json`,
    'cp /tmp/forged.json ~/.claude/sessions/',
    'cp /tmp/forged.json /home/.claude/shelf/thread?.json',
    'cp /tmp/forged.json "/home/.claude/shelf/$f"',
    'cp /tmp/forged.json ~/.claude/shelf/{threads,other}.json',
])
    test(`a codie cannot reach a role: ${line}`, async ($, on) => {
        const { ran } = world(on, CODIE, 'codie');
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([
            expect.stringContaining('clean-stamp'),
            [],
        ]);
    });

for (const [line, name, role] of [
    [SUMMONED, '🦉 clio', 'coordinator'],
    ['cat /home/.claude/sessions/4242.json', CODIE, 'codie'],
    ["claude -p -n 'a probe' hi", CODIE, 'codie'],
] as const)
    test(`the coordinator's summon, or a plain read, passes: ${line}`, async ($, on) => {
        const { ran } = world(on, name, role);
        const r = await bash($, line);
        expect(r.deny ?? '').not.toContain('clean-stamp');
        expect(ran.length).toBe(1);
    });

// FRM-579 exit 4: a member runs a start door under any wrapper
const START_DOORS = [
    '/home/frame/_clio/script/clio-start.sh',
    'zsh ~/frame/_clio/script/clio-start.sh',
    'pnpm -C ~/frame clio:start',
    'pnpm crow:start opus --pane',
    'pnpm run crow:keep-cache-hot',
    'node ./home/.claude/plugin-x/skills/crew-adviser/scripts/start.ts opus',
    'node ~/frame/_clio/script/prompt-groom.ts',
    'hc run --bg --no-parent --name c -- zsh /home/frame/_clio/script/clio-start.sh',
    'env -u CLAUDECODE -u AI_AGENT script -q /dev/null /home/frame/_clio/script/clio-revive.sh wing 2',
    "bash -c 'clio-herdr'",
    'zsh -ic clio-revive main',
    'rex run -- zsh /home/frame/_clio/script/clio-start.sh',
    `osascript -e 'tell application "Terminal" to do script "zsh ~/frame/_clio/script/clio-start.sh"'`,
    'launchctl submit -l x.clio -- /bin/zsh /home/frame/_clio/script/clio-revive.sh main',
];
for (const line of START_DOORS)
    test(`a codie cannot start a role's thread: ${line}`, async ($, on) => {
        const { ran } = world(on, CODIE, 'codie');
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([
            expect.stringContaining('a start door hands its thread the role'),
            [],
        ]);
    });

// FRM-579 exit 6: the 01:28 fork, named «🦉 clio» with no record, is no coordinator at the door either
test('a «🦉 clio» with no record cannot run clio-start.sh', async ($, on) => {
    const { ran } = world(on, '🦉 clio');
    const r = await bash($, START_DOORS[0] ?? '');
    expect([r.deny, ran]).toEqual([
        expect.stringContaining('a start door hands its thread the role'),
        [],
    ]);
});

for (const [line, role] of [
    ['/home/frame/_clio/script/clio-revive.sh wing 2', 'coordinator'],
    ['pnpm crow:start opus --pane', 'wing'],
] as const)
    test(`a coordinator by its record runs a start door: ${line}`, async ($, on) => {
        const { ran } = world(on, 'any name', role);
        const r = await bash($, line);
        expect(r.deny ?? '').not.toContain('clean-stamp');
        expect(ran.length).toBe(1);
    });

for (const line of [
    'cat ~/frame/_clio/script/clio-start.sh',
    'rg -n clio-start.sh x/go',
    'pnpm crow:stop',
])
    test(`a codie's read or a plain claude passes the start doors: ${line}`, async ($, on) => {
        const { ran } = world(on, CODIE, 'codie');
        const r = await bash($, line);
        expect(r.deny ?? '').not.toContain('start door');
        expect(ran.length).toBe(1);
    });

for (const path of [
    '/home/.claude/shelf/threads.json',
    '/home/.claude/shelf/pr-verified.json',
    '/home/.claude/sessions/4242.json',
])
    test(`a codie's Write to ${path} is refused`, async ($, on) => {
        const { ran } = world(on, CODIE, 'codie');
        const r = await $.tool.call({
            content: '{}',
            file_path: path,
            tool: 'Write',
        });
        expect([r.deny, ran]).toEqual([
            expect.stringContaining('clean-stamp'),
            [],
        ]);
    });

for (const line of [
    `x brief summon "cd /repo && claude --bg -n 'n' '/x:crew-sixth-sense FRM-1 main:abc codie clio spec: s'"`,
    'X_SESSIONS=/tmp/forged X_TEST=1 x lane dispatch FRM-1 --sixth-sense 1f0c --apply',
    'env HOME=/tmp/forged x lane dispatch FRM-1 --session 1f0c --apply',
])
    test(`a codie cannot run a role-giving verb: ${line}`, async ($, on) => {
        const { ran } = world(on, CODIE, 'codie');
        const r = await bash($, line);
        expect([r.deny, ran]).toEqual([
            expect.stringContaining('clean-stamp'),
            [],
        ]);
    });

test('a plain dispatch plan from a codie passes: x lane dispatch FRM-1 --session 1f0c', async ($, on) => {
    const { ran } = world(on, CODIE, 'codie');
    const r = await bash($, 'x lane dispatch FRM-1 --session 1f0c');
    expect(r.deny ?? '').not.toContain('clean-stamp');
    expect(ran.length).toBe(1);
});
