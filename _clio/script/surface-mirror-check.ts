// the herdr and desktop leaves share one `##` heading list in one order, so a line's home in one names its home in the other.
// it reads the leaves from the git index, the commit as staged: a staged delete is a missing leaf, and a commit staging
// neither leaf nor this script passes at once. exit 1 names the first drift.
import { execFileSync } from 'node:child_process';

const leaves = [
    '_clio/memory/surface-herdr-desktop.md',
    '_clio/memory/surface-claude-desktop.md',
] as const;
const watched: readonly string[] = [
    ...leaves,
    '_clio/script/surface-mirror-check.ts',
];

const staged = git('diff', '--cached', '--name-only', '--no-renames').split(
    '\n',
);
if (!staged.some((path) => watched.includes(path))) {
    process.exit(0);
}

const missing = leaves.filter((path) => stagedText(path) === null);
if (missing.length > 0) {
    fail(`missing leaf: ${missing.join(', ')}`);
}

const herdr = headings(leaves[0]);
const desktop = headings(leaves[1]);
const length = Math.max(herdr.length, desktop.length);
for (let index = 0; index < length; index++) {
    if (herdr[index] !== desktop[index]) {
        fail(
            `heading ${index + 1} drifts: ${leaves[0]} has ${quote(herdr[index])}, ${leaves[1]} has ${quote(desktop[index])}`,
        );
    }
}

function git(...args: string[]) {
    return execFileSync('git', args, { encoding: 'utf8' });
}

function stagedText(path: string) {
    try {
        return execFileSync('git', ['show', `:${path}`], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return null;
    }
}

function headings(path: string) {
    return (stagedText(path) ?? '')
        .split('\n')
        .filter((line) => line.startsWith('## '))
        .map((line) => line.slice(3).trim());
}

function quote(heading: string | undefined) {
    return heading === undefined ? 'nothing' : `«${heading}»`;
}

function fail(message: string): never {
    console.error(`surface-mirror-check: ${message}`);
    process.exit(1);
}
