import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

const SID = 'c1c1c1c1-0000';

// a registry row as the desktop app writes one, 2026-11-06: its sessionId is the transcript's
function world(on: On, name: string | null) {
    mock.clock(on, { now: 1_000_000 });
    liveStore(on);
    const ran: string[] = [];
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
    './watch-pr.sh 7 --verified',
    `echo '{}' > ${STORE}`,
    `echo '{}' >> ~/.claude/shelf/pr-verified.json`,
    `echo '{}' > "$HOME/.claude/shelf/pr-verified.json"`,
    `jq . a.json | tee ${STORE}`,
    `cp a.json ${STORE}`,
    `mv a.json $HOME/.claude/shelf/pr-verified.json`,
    `sed -i '' s/a/b/ ${STORE}`,
    `python3 -c "open('${STORE}', 'w').write('{}')"`,
    `node -e "require('fs').writeFileSync('${STORE}', '{}')"`,
    `python3 -c "from pathlib import Path; (Path.home()/'.claude/shelf/pr-verified.json').write_text('{}')"`,
    `python3 -c "import json,os; json.dump({},open(os.path.expanduser('~/.claude/shelf/pr-verified.json'),'w'))"`,
    `echo '{}' > ~/frame/cc/shelf/pr-verified.json`,
    `node -e "require('fs').writeFileSync('cc/shelf/pr-verified.json', '{}')"`,
    'bash -o pipefail watch-pr.sh --verified 7 abc',
    'source watch-pr.sh --verified 7 abc',
    'dash watch-pr.sh --verified 7 abc',
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

for (const name of ['🌗 🔎 sixth sense: cli lane 5 | #129', '🦉 clio'])
    for (const line of WRITES)
        test(`${name} writes it: ${line}`, async ($, on) => {
            const { ran } = world(on, name);
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
    `node -e "console.log(require('fs').readFileSync('${STORE}', 'utf8'))"`,
    `python3 -c "import json; print(json.load(open('${STORE}')))"`,
    'echo watch-pr.sh --verified',
])
    test(`a member's read of the store passes: ${line}`, async ($, on) => {
        const { ran } = world(on, '🌗 🔧 codie: cli lane 5 | FRM-511');
        const r = await bash($, line);
        expect(r.deny ?? '').not.toContain('clean-stamp');
        expect(ran.length).toBe(1);
    });
