import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// frame's scripts as their source reads: pocket-add parses no help flag, so `--help` runs it
const SOURCES: Record<string, string> = {
    '/home/frame/cclio/script/siesta.ts': 'const flag = process.argv[2];\n',
    '/home/frame/script/pocket-add.ts':
        'const [title] = process.argv.slice(2);\nadd(title);\n',
    '/home/frame/script/pocket-check.ts':
        "if (args.includes('--help')) usage();\n",
};

function world(on: On, cwd = '/home/frame') {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: cwd }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', (_$, e) => ({ value: e.path in SOURCES }));
    on('fs.read', (_$, e) =>
        e.path in SOURCES
            ? { value: SOURCES[e.path] ?? '' }
            : { deny: 'no such file' },
    );
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });
const lines = (context: readonly string[] | undefined, word: string) =>
    (context ?? []).filter((l) => l.includes(word));

const SCRIPT_RUNS = [
    'node ~/frame/script/pocket-add.ts --help',
    'node script/pocket-add.ts -h',
    'tsx /home/frame/cclio/script/siesta.ts --help',
] as const;
for (const typed of SCRIPT_RUNS)
    test(`a frame script with no help flag, run with --help, gets a hint first: ${typed}`, async ($, on) => {
        const w = world(on);
        const r = await bash($, typed);
        expect([w.ran, lines(r.context, 'names no help flag').length]).toEqual([
            [typed],
            1,
        ]);
    });

const SCRIPT_FINE = [
    'node script/pocket-check.ts --triaged',
    'node script/pocket-check.ts --help',
    'node script/pocket-add.ts "a title"',
    'node /tmp/elsewhere.ts --help',
] as const;
for (const typed of SCRIPT_FINE)
    test(`no script help hint: ${typed}`, async ($, on) => {
        world(on);
        expect(
            lines((await bash($, typed)).context, 'names no help flag'),
        ).toEqual([]);
    });

test("a cli's verb --help gets a hint while its bare --help has not run", async ($, on) => {
    world(on);
    const r = await bash($, 'railway logs --help');
    expect(lines(r.context, '`railway --help`')).toHaveLength(1);
});

test('a cli whose bare --help already ran this session gets no verb hint', async ($, on) => {
    world(on);
    await bash($, 'railway --help');
    const r = await bash($, 'railway logs --help');
    expect(lines(r.context, '`railway --help`')).toEqual([]);
});

test('a bare --help of one cli leaves another cli hinted', async ($, on) => {
    world(on);
    await bash($, 'railway --help');
    const r = await bash($, 'fly logs --help');
    expect(lines(r.context, '`fly --help`')).toHaveLength(1);
});

test('a script run through node gets no verb hint', async ($, on) => {
    world(on);
    const r = await bash($, 'node script/pocket-check.ts --help');
    expect(lines(r.context, '`node --help`')).toEqual([]);
});

test('a cli hinted once gets no second verb hint this session', async ($, on) => {
    world(on);
    await bash($, 'railway logs --help');
    const r = await bash($, 'railway up --help');
    expect(lines(r.context, '`railway --help`')).toEqual([]);
});

// cobra, commander or our own: every verb parses --help, so it only prints
const HELP_SAFE = [
    'x lane merge-auto --help',
    'gh pr view --help',
    'git commit --help',
    'claude plugin --help',
    'for f in a b; do x $f --help; done',
    '$R sync --help',
    'obsidian --help',
    'obsidian x --help',
] as const;
for (const typed of HELP_SAFE)
    test(`no verb hint: ${typed}`, async ($, on) => {
        world(on);
        expect(
            lines((await bash($, typed)).context, 'lists its verbs'),
        ).toEqual([]);
    });

// FRM-426: a package runner hands --help to the package's own cli, so the hint names that cli, never the runner
for (const typed of [
    'pnpm dlx biome check --help',
    'npx biome check --help',
    'pnpx biome check --help',
    'bunx biome check --help',
    'pnpm exec biome check --help',
])
    test(`the verb hint names biome, never the runner: ${typed}`, async ($, on) => {
        world(on);
        const r = await bash($, typed);
        expect(lines(r.context, '`biome --help`')).toHaveLength(1);
        expect(lines(r.context, '`pnpm --help`')).toEqual([]);
        expect(lines(r.context, '`npx --help`')).toEqual([]);
        expect(lines(r.context, '`pnpx --help`')).toEqual([]);
    });

test('a script runner behind a package runner draws no hint: npx tsx script.ts --help', async ($, on) => {
    world(on);
    expect(
        lines(
            (await bash($, 'npx tsx script.ts --help')).context,
            'lists its verbs',
        ),
    ).toEqual([]);
});

test('a package runner with no verb after the package draws no hint', async ($, on) => {
    world(on);
    expect(
        lines((await bash($, 'npx biome --help')).context, 'lists its verbs'),
    ).toEqual([]);
});
