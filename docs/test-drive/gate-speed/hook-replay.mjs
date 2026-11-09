// FRM-557's want line: the hook test time a day the 11-07 → 11-09 rows would have cost under its rules, nothing run.
// node docs/test-drive/gate-speed/hook-replay.mjs [<dir holding the copied gate-steps.log and test-commit.log>]
// the rules mirror script/test-commit.sh and script/runner-twin.sh as of FRM-557; paths come from git, a row git cannot
// rebuild is «unmeasured», never guessed
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const dir =
    process.argv[2] ??
    join(homedir(), '.local/state/x/lanes/vm-go-test/replay');
const bar = 46;
const git = (...args) =>
    execFileSync('git', args, {
        encoding: 'utf8',
        maxBuffer: 1 << 28,
        timeout: 60_000,
    });
// the want line's window, whatever else the copy holds
const inWindow = (row) => row[0] >= '2026-11-07' && row[0] < '2026-11-10';
const rows = (file) =>
    readFileSync(join(dir, file), 'utf8')
        .trimEnd()
        .split('\n')
        .map((line) => line.split('\t'))
        .filter(inWindow);

const isMemory = (path) =>
    /^_clio\/pocket\//.test(path) ||
    [
        '_clio/plugin-clio/.claude-plugin/plugin.json',
        'home/.claude/plugin-x/.claude-plugin/plugin.json',
        'recipes/nurture-memory/scripts/memory-budgets.tsv',
    ].includes(path) ||
    /^(_clio\/memory\/|_clio\/plugin-clio\/skills\/|home\/\.claude\/plugin-x\/skills\/|home\/\.claude\/rules\/|home\/\.claude\/rules-lazy\/).*\.md$/.test(
        path,
    );
const kindOf = (path) => {
    if (
        /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|vitest\.config\.ts|tsconfig.*\.json|lefthook\.yaml|script\/lib\/test-temp-dir\.ts)$/.test(
            path,
        )
    )
        return 'config';
    if (/\.(ts|tsx|js|mjs)$/.test(path)) return 'code';
    if (
        /\.(svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|mov)$/.test(path) ||
        path.startsWith('_clio/pocket/')
    )
        return 'asset';
    return 'other';
};

// every commit, its parents and its commit time: a commit row logs the HEAD it sat on, so its commit is a child of that sha
const children = new Map();
for (const line of git('log', '--all', '--reflog', '--format=%H %ct %P')
    .trim()
    .split('\n')) {
    const [sha, at, ...parents] = line.split(' ');
    for (const parent of parents)
        children.set(parent, [
            ...(children.get(parent) ?? []),
            { at: Number(at), sha },
        ]);
}
const shaOf = (short) => {
    try {
        return git('rev-parse', '--verify', '-q', `${short}^{commit}`).trim();
    } catch {
        return '';
    }
};
const commitOf = (head, startedAt) => {
    const full = shaOf(head);
    // the commit lands after its hook started, within the hour; the nearest such child is the commit
    const near = (children.get(full) ?? [])
        .filter((c) => c.at >= startedAt - 5 && c.at <= startedAt + 3600)
        .sort((a, b) => a.at - b.at);
    return near[0] ? { child: near[0].sha, parent: full } : null;
};
const pathsOf = (from, to) =>
    git('diff', '--no-renames', '--name-status', from, to)
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('\t'));
const epoch = (stamp) =>
    Date.parse(stamp.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')) / 1000;
const day = (stamp) => stamp.slice(0, 10);

// test-commit.sh's branch kinds and its related_kinds: a kind off the list is the one whole run left
const relatedKinds = ['main', 'codie', 'clio-wing', 'worktree', 'other'];
const kindOfBranch = (branch) =>
    branch === 'detached'
        ? 'detached'
        : branch === 'main'
          ? 'main'
          : branch.startsWith('codie/')
            ? 'codie'
            : branch.startsWith('clio-wing-')
              ? 'clio-wing'
              : branch.startsWith('worktree-')
                ? 'worktree'
                : 'other';

// the new commit rules, in the gate's order: none for what the import graph cannot judge, related for code a test imports,
// memory for memory alone, whole only for a kind off related_kinds
function commitMode(branch, changes) {
    const kind = kindOfBranch(branch);
    if (changes.length === 0) return 'none';
    if (changes.every(([, path]) => kindOf(path) === 'asset')) return 'none';
    if (changes.every(([, path]) => isMemory(path))) return 'memory';
    if (kind === 'detached') return 'none';
    if (!relatedKinds.includes(kind)) return 'whole';
    if (changes.every(([, path]) => kindOf(path) === 'asset')) return 'none';
    if (changes.every(([, path]) => isMemory(path))) return 'memory';
    let mode = 'related';
    for (const [status, path] of changes) {
        if (/^[DR]/.test(status)) mode = 'none';
        const kind = kindOf(path);
        if (kind === 'config' || kind === 'other') mode = 'none';
    }
    return changes.some(([, path]) => kindOf(path) === 'code') ? mode : 'none';
}

const days = new Map();
const add = (stamp, field, seconds) => {
    const entry = days.get(day(stamp)) ?? { after: 0, before: 0 };
    entry[field] += seconds;
    days.set(day(stamp), entry);
};
const counts = {
    commitUnmeasured: 0,
    commitWhole: 0,
    twinUnmeasured: 0,
    unmeasuredSeconds: 0,
};
const relatedSeconds = [];

const commitRows = rows('test-commit.log');
for (const row of commitRows)
    if (row[3] === 'related') relatedSeconds.push(Number(row[6]));
relatedSeconds.sort((a, b) => a - b);
const relatedP50 = relatedSeconds[Math.floor(relatedSeconds.length / 2)] ?? 0;

for (const row of commitRows) {
    const [stamp, , branch, oldMode, , head, seconds] = row;
    const cost = Number(seconds);
    add(stamp, 'before', cost);
    if (oldMode === 'none' || oldMode === 'memory' || oldMode === 'related') {
        add(stamp, 'after', cost);
        continue;
    }
    // a whole row: its paths decide what it runs now
    const found = commitOf(head, epoch(stamp));
    if (!found) {
        counts.commitUnmeasured++;
        counts.unmeasuredSeconds += cost;
        add(stamp, 'after', cost);
        continue;
    }
    const mode = commitMode(branch, pathsOf(found.parent, found.child));
    if (mode === 'whole') add(stamp, 'after', cost);
    if (mode === 'whole') counts.commitWhole++;
    // whole under the old rules but related now: code no test imports ran related first, then whole; the related half is the p50
    if (mode === 'related' || mode === 'memory')
        add(stamp, 'after', Math.min(cost, relatedP50));
}

// the twin: only a main push carrying code runs; its range starts at the main push before it
let lastMain = '';
for (const row of rows('gate-steps.log')) {
    if (row[7] !== 'test:twin') continue;
    const [stamp, , source, ref, short, seconds] = row;
    const cost = Number(seconds);
    add(stamp, 'before', cost);
    if (source !== 'push' || ref === 'unnamed') {
        add(stamp, 'after', cost);
        continue;
    }
    if (!ref.startsWith('refs/')) {
        counts.twinUnmeasured++;
        counts.unmeasuredSeconds += cost;
        add(stamp, 'after', cost);
        continue;
    }
    if (ref !== 'refs/heads/main') continue;
    const pushed = shaOf(short);
    const from = lastMain || (pushed && shaOf(`${pushed}^`));
    if (pushed) lastMain = pushed;
    if (!pushed || !from) {
        counts.twinUnmeasured++;
        counts.unmeasuredSeconds += cost;
        add(stamp, 'after', cost);
        continue;
    }
    const paths = pathsOf(from, pushed).map(([, path]) => path);
    const carriesCode = paths.some(
        (path) =>
            !path.startsWith('_clio/pocket/') &&
            !path.endsWith('.md') &&
            !isMemory(path),
    );
    if (paths.length === 0 || carriesCode) add(stamp, 'after', cost);
}

const minutes = (seconds) => (seconds / 60).toFixed(0);
let before = 0;
let after = 0;
for (const [date, entry] of [...days].sort()) {
    before += entry.before;
    after += entry.after;
    console.log(
        `${date}: ${minutes(entry.before)} → ${minutes(entry.after)} min of hook test time`,
    );
}
console.log(
    `a day: ${minutes(before / days.size)} → ${minutes(after / days.size)} min, against the bar of ${bar}`,
);
console.log(
    `unmeasured: ${counts.commitUnmeasured} commit rows, ${counts.twinUnmeasured} twin rows, ${minutes(counts.unmeasuredSeconds / days.size)} min a day, counted at their old cost`,
);
console.log(
    `commit rows that classify as whole: ${counts.commitWhole}; the related p50 standing in for a related half: ${relatedP50} s`,
);
