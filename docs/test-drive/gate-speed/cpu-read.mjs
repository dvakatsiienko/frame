import { readFileSync } from 'node:fs';

const [file, from] = [process.argv[2], process.argv[3]];
const rows = readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
    .filter((r) => r.t >= from);
const n = rows.length;
const mean = (a, f) => a.reduce((s, r) => s + f(r), 0) / (a.length || 1);
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)];
const loads = rows.map((r) => r.load);
console.log(
    `samples ${n}, ${rows[0].t.slice(11, 19)} to ${rows.at(-1).t.slice(11, 19)} UTC`,
);
console.log(
    `load p50 ${pct(loads, 0.5)} p90 ${pct(loads, 0.9)} max ${Math.max(...loads)}`,
);
console.log(
    `cpu user ${mean(rows, (r) => r.user).toFixed(0)} % sys ${mean(rows, (r) => r.sys).toFixed(0)} % idle ${mean(rows, (r) => r.idle).toFixed(0)} %, zero-idle samples ${rows.filter((r) => r.idle < 5).length} of ${n}`,
);
const fams = [...new Set(rows.flatMap((r) => Object.keys(r.by)))];
const table = (a, label) => {
    const out = fams
        .map((f) => [
            f,
            mean(a, (r) => r.by[f] ?? 0),
            mean(a, (r) => r.count[f] ?? 0),
        ])
        .sort((x, y) => y[1] - x[1]);
    const total = out.reduce((s, x) => s + x[1], 0);
    console.log(
        `${label}: n=${a.length}, ps total ${total.toFixed(0)} (1400 = all cores)`,
    );
    for (const [f, c, k] of out.slice(0, 14))
        console.log(
            `  ${c.toFixed(0).padStart(5)} ${((c / total) * 100).toFixed(0).padStart(3)} % ${k.toFixed(1).padStart(6)} procs  ${f}`,
        );
};
table(rows, 'all');
table(
    rows.filter((r) => r.load >= pct(loads, 0.9)),
    'top decile of load',
);
const pt = rows.filter((r) => (r.by['plugin-test'] ?? 0) > 100);
console.log(
    `samples with plugin-test over one core: ${pt.length} of ${n}; mean load with ${mean(pt, (r) => r.load).toFixed(0)} without ${mean(
        rows.filter((r) => (r.by['plugin-test'] ?? 0) <= 100),
        (r) => r.load,
    ).toFixed(0)}`,
);
