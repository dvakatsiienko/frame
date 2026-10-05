import { expect, test } from 'claude-code/testing';

import { nextStep, parseAsks, writeTargets } from '../hooks/parse.ts';

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

test("reads the reply's last ➡️ line as the next step", () => {
    expect(
        nextStep(
            '➡️ first\n\ntext\n\n➡️ **next:** build the cards\n\n⏳ waiting',
        ),
    ).toBe('build the cards');
});

test('a reply without a ➡️ line has no next step', () => {
    expect(nextStep('just an answer')).toBe(null);
});
