// pre-commit: a git-crypt file moved to a path no `filter=git-crypt` line covers ships as plaintext —
// d1bddfb5 put one on public main (2026-10-07). the old path is read against HEAD's attributes, so a
// commit that also drops the old pattern cannot hide the move
import { execFileSync } from 'node:child_process';

const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 24 });

function cryptPaths(source: string[], paths: string[]) {
    const out = git(
        'check-attr',
        ...source,
        '-z',
        'filter',
        '--',
        ...paths,
    ).split('\0');
    const crypted = new Set<string>();
    for (let i = 0; i + 2 < out.length; i += 3)
        if (out[i + 2] === 'git-crypt') crypted.add(out[i] ?? '');
    return crypted;
}

const hasHead = (() => {
    try {
        git('rev-parse', '--verify', '-q', 'HEAD');
        return true;
    } catch {
        return false;
    }
})();
if (!hasHead) process.exit(0);

// -z name-status: a rename or copy is `R100\0old\0new`, any other change `M\0path`
const fields = git('diff', '--cached', '--name-status', '-M', '-C', '-z').split(
    '\0',
);
const moves: { from: string; to: string }[] = [];
for (let i = 0; i < fields.length; ) {
    const status = fields[i] ?? '';
    if (/^[RC]/.test(status)) {
        moves.push({ from: fields[i + 1] ?? '', to: fields[i + 2] ?? '' });
        i += 3;
    } else i += 2;
}
if (moves.length === 0) process.exit(0);

const wasCrypted = cryptPaths(
    ['--source', 'HEAD'],
    moves.map((m) => m.from),
);
const isCrypted = cryptPaths(
    ['--cached'],
    moves.map((m) => m.to),
);
const leaks = moves.filter(
    (m) => wasCrypted.has(m.from) && !isCrypted.has(m.to),
);
for (const { from, to } of leaks)
    console.error(
        `${from} → ${to}: git-crypt at the old path, plaintext at the new one`,
    );
if (leaks.length) {
    console.error(
        'git-crypt-rename-check: add a `filter=git-crypt diff=git-crypt` line for each new path to .gitattributes',
    );
    process.exit(1);
}
