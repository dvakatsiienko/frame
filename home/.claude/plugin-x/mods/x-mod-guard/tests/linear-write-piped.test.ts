import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';
import { liveStore } from './store.ts';

// a session the registry lists is a member, whom linear-body stops; dima's is not listed
function world(on: On, isMember = false) {
    mock.clock(on, { now: 1_000_000 });
    const store = liveStore(on);
    const ran: string[] = [];
    answerPrompts(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('fs.exists', () => ({ value: false }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.list', () => ({
        value: isMember
            ? [
                  {
                      isLink: false,
                      kind: 'file' as const,
                      mtimeMs: 0,
                      name: '1.json',
                      size: 1,
                  },
              ]
            : [],
    }));
    on('fs.read', (_$, e) =>
        e.path === '/home/.claude/sessions/1.json'
            ? {
                  value: JSON.stringify({
                      name: '☕️ 🔧 codie',
                      sessionId: 'a1a1a1a1-0000',
                  }),
              }
            : e.path === '/repo/f'
              ? { value: '## wish\n\nx\n' }
              : { deny: 'no such file' },
    );
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran, store };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, run_in_background: true, tool: 'Bash' });
const warned = (r: unknown) =>
    JSON.stringify(r).includes('would refuse this (rule linear-write-piped,');
const kinds = (store: Map<string, unknown>) =>
    [...store.entries()]
        .filter(([k]) => k.startsWith('event:'))
        .map(([, v]) => v as { kind: string; rule?: string })
        .filter((v) => v.rule === 'linear-write-piped')
        .map((v) => v.kind);

for (const [what, command] of [
    ['a comment', 'x linear comment FRM-1 --body-file f | jq .ok'],
    ['set', 'x linear set FRM-1 --state Done | jq .ok'],
    ['link', 'x linear link FRM-1 FRM-2 | jq .ok'],
    ['update', 'x linear update FRM-1 --title t | jq .ok'],
    ['body --set', 'x linear body FRM-1 --set f | jq .ok'],
    ['archive --apply', 'x linear archive FRM-1 --apply | jq .ok'],
    ['an unknown verb', 'x linear frobnicate FRM-1 | jq .ok'],
    ['an api mutation', `x linear api 'mutation { a }' | jq .`],
    ['an api call it cannot read', 'x linear api "$Q" | jq .'],
    [
        'an api query built from a variable',
        'x linear api "query { $Q }" | jq .',
    ],
    ['a tee', 'x linear comment FRM-1 --body-file f | tee out.json'],
    ['a member write', 'x as clio -- linear issue create --title t | jq .'],
    [
        'a root flag before the family',
        'x --json linear comment FRM-1 --body-file f | jq .ok',
    ],
    [
        'a flag before the verb',
        'x linear --as clio comment FRM-1 --body-file f | jq .ok',
    ],
    ['a continued line', 'x linear \\\n  comment FRM-1 --body-file f | jq .ok'],
    ['--set=', 'x linear body FRM-1 --set=f | jq .ok'],
    ['--apply=', 'x linear archive FRM-1 --apply=true | jq .ok'],
    ['a mutation with vars', `x linear api "$Q" --vars '{"id":"x"}' | jq .`],
] as const) {
    test(`${what} piped runs as typed`, async ($, on) => {
        const w = world(on);
        await bash($, command);
        expect(w.ran).toEqual([command]);
    });

    test(`${what} piped reads the warning`, async ($, on) => {
        world(on);
        expect(warned(await bash($, command))).toBe(true);
    });

    test(`${what} piped leaves a warned event`, async ($, on) => {
        const w = world(on);
        await bash($, command);
        expect(kinds(w.store)).toEqual(['warned']);
    });
}

for (const [what, command] of [
    ['the write unpiped', 'x linear comment FRM-1 --body-file f'],
    ['a piped read', 'x linear read FRM-1 | jq .'],
    ['a piped list', 'x linear list | head'],
    ['a piped body', 'x linear body FRM-1 | head'],
    ['a piped archive plan', 'x linear archive FRM-1 | jq .'],
    ['a piped api query', `x linear api 'query { a }' | jq .`],
    [
        'a pipe on a later command',
        'x linear comment FRM-1 --body-file f && x linear read FRM-1 | jq .',
    ],
    ['an or', 'x linear comment FRM-1 --body-file f || echo failed'],
    ['a pipe inside a quote', 'x linear comment FRM-1 --body-file "a | b"'],
    [
        'set -o pipefail',
        'set -o pipefail; x linear comment FRM-1 --body-file f | jq .ok',
    ],
    [
        'set -euo pipefail',
        'set -euo pipefail; x linear comment FRM-1 --body-file f | jq .ok',
    ],
    [
        'pipestatus',
        'x linear comment FRM-1 --body-file f | jq .ok; echo $pipestatus',
    ],
    ['another x verb piped', 'x lane stack view | jq .'],
    ['a member read', 'x as clio -- linear issue view FRM-1 | jq .'],
    ['a bare x linear', 'x linear 2>&1 | head -5'],
    ['its help', 'x linear --help | head'],
    ['a verb help', 'x linear comment --help | head'],
    ['a verb -h', 'x linear comment -h | head'],
    ['help', 'x linear help | head'],
    [
        'a member read of comments',
        'x as clio -- linear issue comment list FRM-1 | head',
    ],
    [
        'an api query with vars',
        `x linear api 'query { a }' --vars '{"id":"x"}' | jq .`,
    ],
    [
        'PIPESTATUS',
        `bash -c 'x linear comment FRM-1 --body-file f | jq .ok; echo \${PIPESTATUS[0]}'`,
    ],
] as const)
    test(`${what} draws no warning`, async ($, on) => {
        world(on);
        expect(warned(await bash($, command))).toBe(false);
    });

test('the warning says the call ran', async ($, on) => {
    world(on);
    const r = JSON.stringify(
        await bash($, 'x linear comment FRM-1 --body-file f | jq .ok'),
    );
    expect(r).toContain('the call already ran');
});

test('the warning says to read the ticket back', async ($, on) => {
    world(on);
    const r = JSON.stringify(
        await bash($, 'x linear comment FRM-1 --body-file f | jq .ok'),
    );
    expect(r).toContain(
        'read the ticket back with x linear read before repeating it',
    );
});

test('the warning names the unpiped form', async ($, on) => {
    world(on);
    const r = JSON.stringify(
        await bash($, 'x linear comment FRM-1 --body-file f | jq .ok'),
    );
    expect(r).toContain('run the next write unpiped');
});

for (const command of [
    'x as codie -- linear issue update FRM-1 --description x | jq .',
    'x as codie -- linear issue create --title t --description x | jq .',
    `x linear api 'mutation { issueUpdate(id: "a", input: { description: "x" }) { success } }' | jq .`,
])
    test(`a member call linear-body stops reads that refusal alone: ${command}`, async ($, on) => {
        const w = world(on, true);
        const r = JSON.stringify(await bash($, command));
        expect([
            r.includes('nothing in this command ran'),
            r.includes('already ran'),
            kinds(w.store),
            w.ran,
        ]).toEqual([true, false, [], []]);
    });

test('enforced, the refusal says nothing ran', async ($, on) => {
    const w = world(on);
    w.store.set('rule-mode:linear-write-piped', 'enforce');
    const r = JSON.stringify(
        await bash($, 'x linear comment FRM-1 --body-file f | jq .ok'),
    );
    expect([
        r.includes('nothing in this command ran'),
        r.includes('already ran'),
        w.ran,
    ]).toEqual([true, false, []]);
});

test('a call a later rule stops leaves no warned event', async ($, on) => {
    const w = world(on);
    w.store.set('rule-mode:sign-untick', 'enforce');
    await bash($, 'x linear set FRM-1 --add-label signed | jq .ok');
    // the clock stands still here, so its event key is reused: the day's tally is what still counts a warning
    expect([
        JSON.stringify([...w.store.values()]).includes('warned'),
        w.ran,
    ]).toEqual([false, []]);
});

test('a failed write piped into jq, whose line exits 0, reads the warning on that call', async ($, on) => {
    const { ran } = world(on);
    const command = 'x linear comment FRM-1 --body-file missing.md | jq .ok';
    expect([warned(await bash($, command)), ran]).toEqual([true, [command]]);
});
