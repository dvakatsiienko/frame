// the gate slot and long slot's seconds per command family, and the mods runs outside them, per hour
import { readFileSync } from 'node:fs';

const state = `${process.env.HOME}/.local/state/x`;
const [from, to] = [process.argv[2], process.argv[3]];
const inRange = (t) => {
    const d = new Date(t).getTime();
    return d >= new Date(from).getTime() && d < new Date(to).getTime();
};
const hours = (new Date(to) - new Date(from)) / 3600000;
const q = readFileSync(`${state}/gate-queue.log`, 'utf8')
    .trim()
    .split('\n')
    .map((l) => l.split('\t'))
    .filter((r) => inRange(r[0]));
const fam = (c) => {
    if (/x lane commit/.test(c)) return 'commit';
    if (/x lane push/.test(c)) return 'push';
    if (/x lane merge-main|x lane rebase/.test(c)) return 'merge-main';
    if (/red-proof|mut|pairs|round/i.test(c))
        return 'mutant or red-proof round';
    if (/x-go:gate/.test(c)) return 'x-go:gate';
    if (/go(\s+-C \S+)?\s+test/.test(c)) return 'go test by hand';
    if (/vitest|pnpm test/.test(c)) return 'vitest by hand';
    if (/mods/.test(c)) return 'mods by hand';
    if (/land|gate\d*\.sh|run\d*\.sh/.test(c)) return 'wrapped script';
    return 'other';
};
const sum = {};
for (const r of q) {
    const k = `${r[2].padEnd(5)} ${fam(r.at(-1) ?? '')}`;
    sum[k] ??= { n: 0, run: 0, wait: 0 };
    const s = sum[k];
    s.n++;
    s.run += Number(r[4]) || 0;
    s.wait += Number(r[3]) || 0;
}
console.log(`window ${from} to ${to}, ${hours} h, ${q.length} queue rows`);
for (const [k, s] of Object.entries(sum).sort((a, b) => b[1].run - a[1].run))
    console.log(
        `  run ${String(Math.round(s.run / 60)).padStart(4)} min  wait ${String(Math.round(s.wait / 60)).padStart(4)} min  n=${String(s.n).padStart(3)}  ${k}`,
    );
const m = readFileSync(`${state}/mods-test.log`, 'utf8')
    .trim()
    .split('\n')
    .map((l) => l.split('\t'))
    .filter((r) => inRange(r[0]));
const byArg = {};
for (const r of m) {
    const k = /--skip-tested/.test(r[2])
        ? 'commit hook'
        : 'by hand or x mods edit test';
    const skipped = /skipped on tested bytes/.test(r[3] ?? '')
        ? ' skipped'
        : '';
    byArg[k + skipped] = (byArg[k + skipped] ?? 0) + 1;
}
console.log(`mods-test rows: ${m.length}`, JSON.stringify(byArg));
const steps = readFileSync(`${state}/gate-steps.log`, 'utf8')
    .trim()
    .split('\n')
    .map((l) => l.split('\t'))
    .filter((r) => inRange(r[0]));
const twin = steps.filter((r) => /twin/.test(r[7]));
const test = steps.filter((r) => /test-commit/.test(r[7]));
console.log(
    `whole-suite runs: commit step ${test.length}, push twin ${twin.length}`,
);
