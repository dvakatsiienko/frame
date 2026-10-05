import { expect, test } from 'claude-code/testing';

import {
    FLEET_NAME,
    doorOf,
    parseAsks,
    parseWait,
    spawnHints,
    writeTargets,
} from '../hooks/parse.ts';

test('a reply without a 🔭 line waits on nothing', () => {
    expect(parseWait('done.\n\n➡️ next')).toBe(undefined);
});

test('several 🔭 lines read as one wait', () => {
    expect(
        parseWait(
            'x\n🔭 [🔎 ci](https://a) — the watcher\n🔭 **🦉 cclio** — a ping',
        ),
    ).toBe('🔎 ci — the watcher; 🦉 cclio — a ping');
});

test('a 🔭 line quoted before the end is not a wait', () => {
    expect(
        parseWait('the shape:\n```\n🔭 waiting on ci — a ping\n```\ndone.'),
    ).toBe(undefined);
});

test('a host id the desktop would refuse opens nothing', () => {
    expect(doorOf({ bg: false, hostSessionId: 'local_x&evil=1' })).toBe(
        undefined,
    );
});

const reply = (fence: string) =>
    `report\n\n⏳ waiting on your word:\n\n\`\`\`\n${fence}\n\`\`\`\n\n📄 last report: **x**, 18:30`;

test('a reply without a ⏳ block yields null', () => {
    expect(parseAsks('just a quick answer')).toBe(null);
});

test('reads the numbered asks and stops at the wispr adds', () => {
    expect(
        parseAsks(
            reply(
                'lane\n1. ship it ➡️ yes\n2. rename ➡️ no\n\nwispr adds\n1. pg → bg ✓',
            ),
        ),
    ).toEqual(['ship it ➡️ yes', 'rename ➡️ no']);
});

const writes: [string, string, string[]][] = [
    ['sd', "sd -F 'a' 'b' x.ts y.ts", ['x.ts', 'y.ts']],
    ['sd with --', 'sd -- -a b x.ts', ['x.ts']],
    ['sed -i on macOS', "sed -i '' 's/a/b/' x.ts", ['x.ts']],
    ['sed -i with -e', "sed -i -e 's/a/b/' x.ts", ['x.ts']],
    ['a redirect', 'echo hi > x.ts', ['x.ts']],
    ['an append', 'echo hi >>x.ts', ['x.ts']],
    ['a heredoc', "cat > x.ts <<'EOF'\na > b\nEOF", ['x.ts']],
    ['a heredoc piped to a file', 'cat <<EOF > x.ts\nhi\nEOF', ['x.ts']],
    ['tee', 'echo hi | tee -a x.ts', ['x.ts']],
    [
        'python open',
        "python3 - <<'EOF'\nopen('x.ts', 'w').write(s)\nEOF",
        ['x.ts'],
    ],
];
for (const [shape, command, files] of writes)
    test(`reads the file a Bash write targets: ${shape}`, () => {
        expect(writeTargets(command)).toEqual(files);
    });

const reads: [string, string][] = [
    ['a stream redirect', 'ls 2>&1 >/dev/null'],
    ['a quoted arrow', "echo 'a > b'"],
    ['sed without -i', "sed 's/a/b/' x.ts"],
    ['a variable path', 'echo hi > "$out"'],
];
for (const [shape, command] of reads)
    test(`finds no write in ${shape}`, () => {
        expect(writeTargets(command)).toEqual([]);
    });

const spawn = (subagentType: string, description: string, prompt: string) => ({
    description,
    prompt,
    subagentType,
});

test('a mechanical job off chore-helper is hinted', () => {
    expect(
        spawnHints(spawn('Explore', 'bulk rename', 'x'.repeat(500))),
    ).toEqual(['a mechanical job belongs on chore-helper']);
});

test('a mechanical job on chore-helper is not hinted', () => {
    expect(spawnHints(spawn('chore-helper', 'bulk rename', 'x'))).toEqual([]);
});

test('a short general-purpose brief is hinted as a possible one-pass job', () => {
    expect(spawnHints(spawn('general-purpose', 'look', 'find it'))).toEqual([
        'a short brief is often one pass for this session itself',
    ]);
});

for (const [name, fits] of [
    ['☕️ 🔧 FRM-303 code: stash keep-hot', true],
    ['🎯 🔎 BYT-12 verify: atelier', true],
    ['🔎 verify: FRM-268', false],
    ['reply message handler', false],
] as const)
    test(`the fleet name pattern ${fits ? 'fits' : 'rejects'} «${name}»`, () => {
        expect(FLEET_NAME.test(name)).toBe(fits);
    });
