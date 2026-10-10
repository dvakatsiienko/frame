import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

// shape, what the model typed, what runs
const FIXED = [
    [
        'pnpm -s',
        'pnpm -s github:agent-token',
        'pnpm --silent github:agent-token',
    ],
    ['an unquoted =word', 'echo a ==q && ls', "echo a '==q' && ls"],
    ['pnpm -s inside $( … )', 'x=$(pnpm -s y)', 'x=$(pnpm --silent y)'],
    ['two at once', 'pnpm -s a; echo ===', "pnpm --silent a; echo '==='"],
    [
        'an unquoted --include glob',
        'grep -rn x --include=*.ts .',
        "grep -rn x '--include=*.ts' .",
    ],
    ['an unquoted --exclude glob', 'rg x --glob=!*.md', "rg x '--glob=!*.md'"],
    [
        'a raw linear api',
        "linear api 'query { viewer { id } }'",
        "x linear api 'query { viewer { id } }'",
    ],
    [
        'a raw linear api after a cd',
        "cd /repo && linear api 'query { viewer { id } }' | jq .",
        "cd /repo && x linear api 'query { viewer { id } }' | jq .",
    ],
] as const;

for (const [shape, typed, runs] of FIXED)
    test(`${shape} is rewritten, not refused`, async ($, on) => {
        const w = world(on);
        const r = await bash($, typed);
        expect(r.deny).toBeUndefined();
        expect(w.ran).toEqual([runs]);
    });

test('a linear api rewrite is named in one line', async ($, on) => {
    world(on);
    const r = await bash($, "linear api 'q'");
    expect(r.context?.join()).toContain(
        "`linear` → `x linear` (a raw linear api skips x's actor, ids and trace). it ran: x linear api 'q'",
    );
});

test('a rewrite tells the model what ran', async ($, on) => {
    world(on);
    const r = await bash($, 'pnpm -s x');
    expect(r.context?.join()).toContain(
        '`-s` → `--silent` (pnpm 12 refuses -s). it ran: pnpm --silent x',
    );
});

const KEPT = [
    'pnpm test -- -s',
    'echo \'==q\' "-s" \\==q',
    '[[ $a == b ]] && echo y',
    "cat <<'EOF'\n==q\nEOF",
    'echo a=b c==d',
    'grep -s x f',
    'ls *.ts',
    "grep -rn x --include='*.ts' .",
    "x linear api 'query { viewer { id } }'",
    "echo 'linear api is the raw door'",
    "cat <<'EOF'\nlinear api 'query { viewer { id } }'\nEOF",
    "x as coder -- linear api 'query { viewer { id } }'",
    "x as cclio -- linear api 'query { viewer { id } }'",
    'linear issue view FRM-1',
    'gh api repos/x/y/issues',
] as const;

for (const command of KEPT)
    test(`${JSON.stringify(command)} runs as typed`, async ($, on) => {
        const w = world(on);
        const r = await bash($, command);
        expect(r.context).toBeUndefined();
        expect(w.ran).toEqual([command]);
    });

test('a rewritten command is still refused for its floor', async ($, on) => {
    const w = world(on);
    expect((await bash($, 'pnpm -s x; rm y')).deny).toContain('trash');
    expect(w.ran).toEqual([]);
});
