// for each cpu sample, which queued kinds were running then; mean load and sys per kind, and for nothing queued at all
import { readFileSync } from 'node:fs';

const [file, from] = [process.argv[2], process.argv[3]];
const state = `${process.env.HOME}/.local/state/x`;
const samples = readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
    .filter((r) => r.t >= from);
const fam = (c) => {
    if (/x lane commit/.test(c)) return 'commit';
    if (/x lane push/.test(c)) return 'push';
    if (/red-proof|mut|pairs|round/i.test(c)) return 'mutant or red-proof';
    if (/x-go:gate|go(\s+-C \S+)?\s+test|go test/.test(c))
        return 'go gate or test';
    if (/mods/.test(c)) return 'mods suite';
    if (/vitest|pnpm test/.test(c)) return 'vitest by hand';
    return 'other queued';
};
const q = readFileSync(`${state}/gate-queue.log`, 'utf8')
    .trim()
    .split('\n')
    .map((l) => l.split('\t'))
    .flatMap((r) => {
        const run = Number(r[4]);
        if (!Number.isFinite(run)) return [];
        const begin =
            new Date(r[0].replace(/([+-]\d\d)(\d\d)$/, '$1:$2')).getTime() +
            Number(r[3]) * 1000;
        return [{ begin, end: begin + run * 1000, kind: fam(r.at(-1)) }];
    });
const buckets = {};
const add = (k, s) => {
    buckets[k] ??= { idle: 0, load: 0, n: 0, sys: 0 };
    const b = buckets[k];
    b.n++;
    b.load += s.load;
    b.sys += s.sys;
    b.idle += s.idle;
};
const overlap = {};
for (const s of samples) {
    const at = new Date(s.t).getTime();
    const live = q.filter((r) => r.begin <= at && at < r.end);
    const kinds = [...new Set(live.map((r) => r.kind))];
    if (kinds.length === 0) add('nothing queued', s);
    for (const k of kinds) add(k, s);
    if (kinds.length === 1) add(`only ${kinds[0]}`, s);
    const c = Math.min(live.length, 4);
    add(`${c}${c === 4 ? '+' : ''} queued runs at once`, s);
    overlap[c] = (overlap[c] ?? 0) + 1;
}
console.log(`samples ${samples.length}`);
for (const [k, b] of Object.entries(buckets).sort(
    (x, y) => y[1].load / y[1].n - x[1].load / x[1].n,
))
    console.log(
        `  load ${(b.load / b.n).toFixed(0).padStart(3)}  sys ${(b.sys / b.n).toFixed(0).padStart(2)} %  idle ${(b.idle / b.n).toFixed(0).padStart(2)} %  n=${String(b.n).padStart(3)}  ${k}`,
    );
