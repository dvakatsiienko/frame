import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts, dimaSays } from './said.ts';

const BRIEF = '/x:crew-coder FRM-1 build the thing\n';
// `shasum -a 256` of BRIEF, and of BRIEF with its last letter capitalised
const SUM = '52729345631895ec297d387a57506ea5344a3a1c4fdc94da3ed3636b53f144d1';
const STAMP = `/home/.local/state/x/briefs/${SUM}.json`;

// files: absolute path → text, the stamps among them; env: what env.get answers past HOME
function world(
    on: On,
    files: Record<string, string>,
    env: Record<string, string> = {},
) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    answerPrompts(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', (_$, e) => ({
        value: e.name === 'HOME' ? '/home' : env[e.name],
    }));
    on('fs.exists', (_$, e) => ({ value: e.path in files }));
    on('fs.list', () => ({ value: [] }));
    on('fs.read', (_$, e) => {
        const text = files[e.path];
        if (text === undefined) throw new Error(`ENOENT ${e.path}`);
        return { value: e.as === 'bytes' ? { base64: btoa(text) } : text };
    });
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

const SPAWN =
    'claude --bg -n coder --model opus "$(cat briefs/b.md)" --remote-control';

test('a coder spawn whose brief file has a stamp runs', async ($, on) => {
    const w = world(on, { '/repo/briefs/b.md': BRIEF, [STAMP]: '{}' });
    expect((await bash($, SPAWN)).deny).toBeUndefined();
    expect(w.ran).toEqual([SPAWN]);
});

test('a coder spawn whose brief changed after its check is refused with the check door', async ($, on) => {
    const w = world(on, {
        '/repo/briefs/b.md': BRIEF.replace('thing', 'thinG'),
        [STAMP]: '{}',
    });
    const r = await bash($, SPAWN);
    expect(r.deny).toContain('x brief check /repo/briefs/b.md --repo /repo');
    expect(w.ran).toEqual([]);
});

test('a coder spawn with the brief inline is refused, asking for a brief file', async ($, on) => {
    const w = world(on, {});
    const r = await bash(
        $,
        "claude --bg -n coder '/x:crew-coder FRM-1 build the thing' --remote-control",
    );
    expect(r.deny).toContain('write the brief to a file');
    expect(w.ran).toEqual([]);
});

test('a claude --bg without /x:crew-coder runs', async ($, on) => {
    const w = world(on, {});
    const command = "claude --bg -n probe 'say ok'";
    expect((await bash($, command)).deny).toBeUndefined();
    expect(w.ran).toEqual([command]);
});

test('a coder spawn ending in a dima-ok marker runs', async ($, on) => {
    const w = world(on, {});
    const command =
        "claude --bg '/x:crew-coder FRM-1 fix' # dima-ok: inline-brief one-line hotfix";
    await dimaSays($, 'spawn it, inline-brief is fine for a one-line hotfix');
    expect((await bash($, command)).deny).toBeUndefined();
    expect(w.ran).toEqual([command]);
});

test('a brief read through < whose file names /x:crew-coder is checked', async ($, on) => {
    const w = world(on, { '/repo/b.md': BRIEF });
    const r = await bash($, 'cd /repo && claude --bg -n coder < b.md');
    expect(r.deny).toContain('x brief check /repo/b.md --repo /repo');
    expect(w.ran).toEqual([]);
});

test('a stamp under X_STATE counts, as x brief check writes it there', async ($, on) => {
    const w = world(
        on,
        {
            '/repo/briefs/b.md': BRIEF,
            [`/state/briefs/${SUM}.json`]: '{}',
        },
        { X_STATE: '/state' },
    );
    expect((await bash($, SPAWN)).deny).toBeUndefined();
    expect(w.ran).toEqual([SPAWN]);
});
