// pre-commit: a git-crypt file moved to a path no `filter=git-crypt` line covers ships as plaintext —
// d1bddfb5 put one on public main (2026-10-07). git pairs that move only as a delete plus an add
// (ciphertext and plaintext share nothing), so a crypt delete beside any plaintext add is refused too.
// old paths are read against HEAD's attributes, so a commit that also drops the pattern hides nothing
import { execFileSync } from 'node:child_process';

const git = (args: string[], input?: string) =>
    execFileSync('git', args, { encoding: 'utf8', input, maxBuffer: 1 << 24 });

function cryptPaths(source: string[], paths: string[]) {
    if (paths.length === 0) return new Set<string>();
    const out = git(
        ['check-attr', ...source, '--stdin', '-z', 'filter'],
        `${paths.join('\0')}\0`,
    ).split('\0');
    const crypted = new Set<string>();
    for (let i = 0; i + 2 < out.length; i += 3)
        if (out[i + 2] === 'git-crypt') crypted.add(out[i] ?? '');
    return crypted;
}

try {
    git(['rev-parse', '--verify', '-q', 'HEAD']);
} catch {
    process.exit(0);
}

// -z name-status: a rename or copy is `R100\0old\0new`, any other change `A\0path`
const fields = git([
    'diff',
    '--cached',
    '--name-status',
    '-M',
    '-C',
    '-z',
]).split('\0');
const moves: { from: string; to: string }[] = [];
const deleted: string[] = [];
const added: string[] = [];
for (let i = 0; i < fields.length; ) {
    const status = fields[i] ?? '';
    if (/^[RC]/.test(status)) {
        moves.push({ from: fields[i + 1] ?? '', to: fields[i + 2] ?? '' });
        i += 3;
        continue;
    }
    if (status === 'D') deleted.push(fields[i + 1] ?? '');
    if (status === 'A') added.push(fields[i + 1] ?? '');
    i += 2;
}

const wasCrypted = cryptPaths(
    ['--source', 'HEAD'],
    [...moves.map((m) => m.from), ...deleted],
);
const isCrypted = cryptPaths(
    ['--cached'],
    [...moves.map((m) => m.to), ...added],
);
const leaks = moves.filter(
    (m) => wasCrypted.has(m.from) && !isCrypted.has(m.to),
);
const cryptDeletes = deleted.filter((p) => wasCrypted.has(p));
const plainAdds = added.filter((p) => !isCrypted.has(p));

for (const { from, to } of leaks)
    console.error(
        `${from} → ${to}: git-crypt at the old path, plaintext at the new one`,
    );
if (cryptDeletes.length && plainAdds.length)
    console.error(
        `deletes git-crypt ${cryptDeletes.join(', ')} and adds plaintext ${plainAdds.join(', ')}: a move git cannot see`,
    );
if (leaks.length || (cryptDeletes.length && plainAdds.length)) {
    console.error(
        'git-crypt-rename-check: give each new path a `filter=git-crypt diff=git-crypt` line in .gitattributes, or commit the delete on its own when nothing moved',
    );
    process.exit(1);
}
