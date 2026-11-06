// what the gate's rows spent, and what the commits behind them held
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const since = process.argv[2] ?? '2026-11-06T16:00';
const state = `${process.env.HOME}/.local/state/x`;
const log = execFileSync(
    'git',
    [
        '-C',
        `${process.env.HOME}/frame`,
        'log',
        '--all',
        '--no-merges',
        `--since=${since}`,
        '--format=@%h %ad %s',
        '--date=format:%H',
        '--name-only',
    ],
    { encoding: 'utf8', maxBuffer: 1 << 28 },
);
const commits = [];
for (const line of log.split('\n')) {
    if (line.startsWith('@')) commits.push({ head: line, paths: [] });
    else if (line.trim() && commits.length)
        commits.at(-1).paths.push(line.trim());
}
const code = /\.(ts|tsx|js|mjs|cjs|mts|go|sh|json|jsonc|yaml|yml|toml)$/;
const klass = (paths) => {
    if (paths.length === 0) return 'empty';
    if (paths.every((p) => p.startsWith('_clio/pocket/'))) return 'pocket only';
    if (
        paths.every((p) => !code.test(p)) &&
        paths.every((p) => p.startsWith('_clio/'))
    )
        return '_clio only';
    if (paths.every((p) => !code.test(p)))
        return 'no code (docs, skills, rules)';
    if (paths.some((p) => p.startsWith('home/.claude/plugin-x/mods/')))
        return 'mods code';
    if (paths.some((p) => p.startsWith('x/'))) return 'x go';
    return 'other code';
};
const counts = {};
for (const c of commits)
    counts[klass(c.paths)] = (counts[klass(c.paths)] ?? 0) + 1;
console.log(`commits since ${since}: ${commits.length}`);
for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(n).padStart(4)} ${k}`);
const zero = commits.filter((c) =>
    ['pocket only', '_clio only', 'no code (docs, skills, rules)'].includes(
        klass(c.paths),
    ),
);
console.log(`no code at all: ${zero.length} of ${commits.length}`);

const rows = readFileSync(`${state}/gate-steps.log`, 'utf8')
    .trim()
    .split('\n')
    .map((l) => l.split('\t'));
const recent = rows.filter((r) => r[0] >= since);
const steps = {};
for (const r of recent) {
    const name = `${r[2]}: ${r[7].replace(/^sh -c /, '').slice(0, 34)}`;
    steps[name] ??= { all: [], n: 0, sum: 0 };
    const s = steps[name];
    s.n++;
    s.sum += Number(r[5]);
    s.all.push(Number(r[5]));
}
console.log(`gate-steps rows since ${since}: ${recent.length}`);
for (const [k, s] of Object.entries(steps)
    .sort((a, b) => b[1].sum - a[1].sum)
    .slice(0, 12)) {
    const a = s.all.sort((x, y) => x - y);
    console.log(
        `  ${String(Math.round(s.sum / 60)).padStart(4)} min n=${String(s.n).padStart(3)} p50 ${a[a.length >> 1]} max ${a.at(-1)}  ${k}`,
    );
}

const tc = readFileSync(`${state}/test-commit.log`, 'utf8')
    .trim()
    .split('\n')
    .map((l) => l.split('\t'))
    .filter((r) => r[0] >= since);
const modes = {};
for (const r of tc) {
    const key = `${r[2].startsWith('codie/') ? 'codie/*' : r[2] === 'main' ? 'main' : 'other branch'} ${r[3]}`;
    modes[key] ??= [];
    modes[key].push(Number(r[6]));
}
console.log('test-commit rows:');
for (const [k, a] of Object.entries(modes)) {
    a.sort((x, y) => x - y);
    console.log(
        `  n=${String(a.length).padStart(3)} p50 ${a[a.length >> 1]} sum ${Math.round(a.reduce((s, x) => s + x, 0) / 60)} min  ${k}`,
    );
}
const q = readFileSync(`${state}/gate-queue.log`, 'utf8')
    .trim()
    .split('\n')
    .map((l) => l.split('\t'))
    .filter((r) => r[0] >= since);
const loads = q.map((r) => Number(r[1])).sort((a, b) => a - b);
console.log(
    `load at queue rows: n=${loads.length} p50 ${loads[loads.length >> 1]} p90 ${loads[Math.floor(loads.length * 0.9)]} max ${loads.at(-1)}`,
);
