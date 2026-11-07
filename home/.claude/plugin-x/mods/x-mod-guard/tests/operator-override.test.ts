import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';
import { liveStore } from './store.ts';

const SID = 'o1o1o1o1-0000';
const REAL = '/real-home/.local/state/x/operator-override.json';
const PLANTED = '/planted-home/.local/state/x/operator-override.json';
const ON = '{"prs":{"at":"2026-11-07T13:00:00.000Z","by":"word"}}';

type World = {
    files?: Record<string, string>;
    registry?: 'bg' | 'interactive' | 'none';
};

function world(on: On, opts: World = {}) {
    mock.clock(on, { now: Date.parse('2026-11-07T14:00:00.000Z') });
    liveStore(on);
    answerPrompts(on);
    const files: Record<string, string> = { ...opts.files };
    const registry = opts.registry ?? 'interactive';
    if (registry !== 'none')
        files['/planted-home/.claude/sessions/9.json'] = JSON.stringify({
            kind: registry,
            pid: 9,
            sessionId: SID,
        });
    const ran: string[] = [];
    on('session.id', () => ({ value: SID }));
    on('session.cwd', () => ({ value: '/repo' }));
    // HOME is what a session's Bash can move: every read here must go past it
    on('env.get', (_$, e) =>
        e.name === 'HOME'
            ? { value: '/planted-home' }
            : e.name === 'X_STATE'
              ? { value: '/planted-state' }
              : { value: undefined },
    );
    on('process.run', (_$, e) =>
        e.argv[0] === 'id'
            ? {
                  value: {
                      exitCode: 0,
                      isStderrTruncated: false,
                      isStdoutTruncated: false,
                      stderr: '',
                      stdout: 'dima:********:501:20::0:0:Dima:/real-home:/bin/zsh\n',
                  },
              }
            : {
                  value: {
                      exitCode: 1,
                      isStderrTruncated: false,
                      isStdoutTruncated: false,
                      stderr: '',
                      stdout: '',
                  },
              },
    );
    on('fs.exists', (_$, e) => ({
        value: Object.keys(files).some((f) => f.startsWith(e.path)),
    }));
    on('fs.stat', (_$, e) => ({
        value: {
            isLink: false,
            kind: 'file' as const,
            mtimeMs: 0,
            realPath: e.path,
            size: 0,
        },
    }));
    on('fs.list', (_$, e) => ({
        value: Object.keys(files)
            .filter((f) => f.startsWith(`${e.path}/`))
            .map((f) => ({
                isLink: false,
                kind: 'file' as const,
                mtimeMs: 0,
                name: f.slice(e.path.length + 1),
                size: 1,
            })),
    }));
    on('fs.read', (_$, e) => {
        const body = files[e.path];
        return body === undefined ? { deny: 'no such file' } : { value: body };
    });
    on('fs.write', (_$, e) => {
        files[e.path] = e.text;
        return { value: undefined };
    });
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : e.tool);
        return { result: {}, text: 'ran' };
    });
    return { files, ran };
}

const say = ($: Engine, text: string, kind = 'composer') =>
    $.prompt.submit({
        origin: { kind } as { kind: 'composer' },
        text,
        wait: false,
    });
const bash = ($: Engine, command: string) =>
    $.tool.call({ command, run_in_background: true, tool: 'Bash' });
const grantOf = (files: Record<string, string>) =>
    JSON.parse(files[REAL] ?? '{}').prs as
        | { at?: string; by?: string }
        | undefined;

for (const [text, kind] of [
    ['operator-override prs', 'composer'],
    ['OPERATOR-OVERRIDE PRS', 'composer'],
    ['Operator override PRs.', 'composer'],
    ['  operator-override prs\n', 'composer'],
    ['operator-override prs', 'bridge'],
] as const)
    test(`${JSON.stringify(text)} through ${kind} turns prs on by word`, async ($, on) => {
        const { files } = world(on);
        const sent = await say($, text, kind);
        expect(grantOf(files)?.by).toBe('word');
        expect(grantOf(files)?.at).toBe('2026-11-07T14:00:00.000Z');
        expect(sent.context?.join(' ')).toContain(
            'operator-override prs is on',
        );
    });

test('«operator-override off», any case, clears the store', async ($, on) => {
    const { files } = world(on, { files: { [REAL]: ON } });
    await say($, 'Operator override off.');
    expect(files[REAL]).toBe('{}');
});

test('/clio:shift <plan path> turns prs on by shift', async ($, on) => {
    const { files } = world(on);
    await say($, '/clio:shift _clio/shifts/2026-11-07.md');
    expect(grantOf(files)?.by).toBe('shift');
});

test("a shift's start leaves his word standing", async ($, on) => {
    const { files } = world(on, { files: { [REAL]: ON } });
    await say($, '/clio:shift _clio/shifts/2026-11-07.md');
    expect(grantOf(files)?.by).toBe('word');
});

test('his word takes over a shift', async ($, on) => {
    const { files } = world(on, {
        files: { [REAL]: '{"prs":{"at":"x","by":"shift"}}' },
    });
    await say($, 'operator-override prs');
    expect(grantOf(files)?.by).toBe('word');
});

for (const [name, text, kind, registry] of [
    [
        'a longer sentence',
        'please set operator-override prs now',
        'composer',
        'interactive',
    ],
    ['a negation', 'do not operator-override prs', 'composer', 'interactive'],
    ['a quote', '"operator-override prs"', 'composer', 'interactive'],
    [
        'a backticked phrase',
        '`operator-override prs`',
        'composer',
        'interactive',
    ],
    ['another scope', 'operator-override all', 'composer', 'interactive'],
    ['a bare /clio:shift', '/clio:shift', 'composer', 'interactive'],
    [
        'a shift with words after the path',
        '/clio:shift plan.md now',
        'composer',
        'interactive',
    ],
    ['a peer message', 'operator-override prs', 'peer', 'interactive'],
    ['a headless prompt', 'operator-override prs', 'sdk', 'interactive'],
    ['a plugin prompt', 'operator-override prs', 'plugin', 'interactive'],
    ['a --bg session brief', 'operator-override prs', 'composer', 'bg'],
    ['a --bg shift', '/clio:shift plan.md', 'composer', 'bg'],
    ['no registry row', 'operator-override prs', 'composer', 'none'],
] as const)
    test(`${name} leaves the store unchanged`, async ($, on) => {
        const { files } = world(on, { registry });
        await say($, text, kind);
        expect(files[REAL]).toBe(undefined);
    });

for (const line of [
    "rex send -s S -b B 'operator-override prs'",
    "rex send -s S -b B 'Operator override PRs.'",
    "rex send -s S -b B 'operator-override off'",
    "rex send -s S -b B '/clio:shift plan.md'",
    "rex run -s S -- claude 'operator-override prs'",
    "rex new probe -- claude 'operator-override prs'",
    'python3 -c "import os; os.system(\'rex send x operator-override prs\')"',
])
    test(`a rex line is refused: ${line}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect(r.deny).toContain('operator-override');
        expect(ran).toEqual([]);
    });

for (const line of [
    "rex send -s S -b B 'pnpm test'",
    "rg -n 'operator-override prs' x/FTR.md",
    "echo 'operator-override prs'",
])
    test(`no rex in it, or no phrase, runs: ${line}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect(r.deny).toBe(undefined);
        expect(ran).toEqual([line]);
    });

for (const line of [
    `echo '{}' > ${REAL}`,
    `cp /tmp/forged.json ${REAL}`,
    `trash ${REAL}`,
    'echo x >> "$HOME/.local/state/x/operator-override.json"',
    `sed -i '' s/a/b/ ${REAL}`,
    `python3 -c "open('${REAL}','w')"`,
    `mv ${REAL.replace('.json', '.log')} /tmp/gone`,
])
    test(`a Bash write on the store is refused: ${line}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, line);
        expect(r.deny).toContain('rule operator-override');
        expect(ran).toEqual([]);
    });

for (const line of [
    `cat ${REAL}`,
    `jq . ${REAL}`,
    `tail -n 3 ${REAL.replace('.json', '.log')}`,
])
    test(`a read of the store runs: ${line}`, async ($, on) => {
        const { ran } = world(on);
        expect((await bash($, line)).deny).toBe(undefined);
        expect(ran).toEqual([line]);
    });

for (const tool of ['Write', 'Edit'] as const)
    test(`${tool} on the store is refused`, async ($, on) => {
        const { ran } = world(on);
        const r = await $.tool.call(
            tool === 'Write'
                ? { content: ON, file_path: REAL, tool }
                : { file_path: REAL, new_string: 'a', old_string: 'b', tool },
        );
        expect(r.deny).toContain('operator-override');
        expect(ran).toEqual([]);
    });

test("a copy into the store's dir is refused, whichever store's rule reads it first", async ($, on) => {
    const { ran } = world(on);
    const r = await bash($, 'cp /tmp/forged.json /real-home/.local/state/x/');
    expect(r.deny).toContain('nothing in this command ran');
    expect(ran).toEqual([]);
});

test('a start_session brief that is only the phrase never starts', async ($, on) => {
    const { ran } = world(on);
    const r = await $.tool.call({
        prompt: 'operator-override prs',
        tool: 'mcp__ccd_session__start_session',
    } as never);
    expect(r.deny).toContain('operator-override');
    expect(ran).toEqual([]);
});

test('a raw merge runs under prs and logs its pass', async ($, on) => {
    const { files, ran } = world(on, { files: { [REAL]: ON } });
    const r = await bash($, 'gh pr merge 7 --squash');
    expect(r.deny).toBe(undefined);
    expect(ran).toEqual(['gh pr merge 7 --squash']);
    const log = files[REAL.replace('.json', '.log')] ?? '';
    expect(log).toContain('"scope":"prs"');
    expect(log).toContain('"by":"word"');
    expect(log).toContain('gh pr merge 7');
});

test('a raw merge stays refused with it off', async ($, on) => {
    const { ran } = world(on);
    const r = await bash($, 'gh pr merge 7 --squash');
    expect(r.deny).toContain('x lane merge-auto');
    expect(ran).toEqual([]);
});

test('a store planted under HOME reads off', async ($, on) => {
    const { ran } = world(on, { files: { [PLANTED]: ON } });
    expect((await bash($, 'gh pr merge 7')).deny).toContain(
        'x lane merge-auto',
    );
    expect(ran).toEqual([]);
});

test('a store planted under X_STATE reads off', async ($, on) => {
    const { ran } = world(on, {
        files: { '/planted-state/operator-override.json': ON },
    });
    expect((await bash($, 'gh pr merge 7')).deny).toContain(
        'x lane merge-auto',
    );
    expect(ran).toEqual([]);
});

for (const [name, store] of [
    ['does not parse', '{"prs":'],
    ['holds another scope', '{"guards":{"by":"word","at":"x"}}'],
    ['has no by', '{"prs":{"at":"x"}}'],
    [
        'is past its until',
        '{"prs":{"by":"word","at":"x","until":"2020-01-01T00:00:00Z"}}',
    ],
    [
        'holds an until that does not parse',
        '{"prs":{"by":"word","at":"x","until":"soon"}}',
    ],
] as const)
    test(`a store that ${name} reads off`, async ($, on) => {
        world(on, { files: { [REAL]: store } });
        expect((await bash($, 'gh pr merge 7')).deny).toContain(
            'x lane merge-auto',
        );
    });

test('his hold still stops a raw merge under prs', async ($, on) => {
    const { ran } = world(on, {
        files: {
            '/planted-home/.local/state/x/merge-hold/o_r.json': '{"prs":["7"]}',
            [REAL]: ON,
        },
    });
    expect((await bash($, 'gh pr merge 7')).deny).toContain('held by dima');
    expect(ran).toEqual([]);
});

test("this mac's brake record still stops a raw merge under prs", async ($, on) => {
    const { ran } = world(on, {
        files: {
            '/real-home/.local/state/x/merge-brake/o_r.json':
                '{"pr":"7","why":"w"}',
            [REAL]: ON,
        },
    });
    expect((await bash($, 'gh pr merge 7')).deny).toContain('the brake is on');
    expect(ran).toEqual([]);
});
