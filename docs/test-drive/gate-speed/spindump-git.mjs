import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const rl = createInterface({ input: createReadStream('/tmp/spindump-go.txt') });
const procs = [];
let cur = null;
for await (const line of rl) {
    const p = line.match(/^Process:\s+(.+?) \[(\d+)\]/);
    if (p) {
        cur = {
            cpu: 0,
            fork: null,
            name: p[1],
            parent: '',
            pid: p[2],
            samples: 0,
        };
        procs.push(cur);
        continue;
    }
    if (!cur) continue;
    const parent = line.match(/^Parent:\s+(.+)$/);
    const cpu = line.match(/^CPU Time:\s+([\d.]+)s/);
    const fork = line.match(/^Time Since Fork:\s+(\d+)s/);
    if (parent) cur.parent = parent[1].replace(/ \[.*$/, '');
    if (cpu) cur.cpu = Number(cpu[1]);
    if (fork) cur.fork = Number(fork[1]);
}
const git = procs.filter((p) => p.name === 'git');
const sum = (a) => a.reduce((s, p) => s + p.cpu, 0);
const long = git.filter((p) => (p.fork ?? 0) > 60);
const short = git.filter((p) => (p.fork ?? 0) <= 60);
console.log(
    `git records ${git.length}, unique pids ${new Set(git.map((p) => p.pid)).size}, cpu ${sum(git).toFixed(1)}`,
);
console.log(
    `alive over 60 s: ${long.length}, cpu ${sum(long).toFixed(2)}; short: ${short.length}, cpu ${sum(short).toFixed(2)}`,
);
console.log(
    'long top:',
    long
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, 6)
        .map((p) => `${p.pid} ${p.cpu}s fork ${p.fork}s <- ${p.parent}`)
        .join(' | '),
);
const par = new Map();
for (const p of short)
    par.set(p.parent || '(none)', (par.get(p.parent || '(none)') ?? 0) + p.cpu);
console.log(
    'short git cpu by parent:',
    [...par]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([k, v]) => `${k} ${v.toFixed(1)}`)
        .join(' | '),
);
const cpus = short
    .map((p) => p.cpu)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
console.log(
    `short git cpu each: n ${cpus.length} p50 ${cpus[cpus.length >> 1]} p90 ${cpus[Math.floor(cpus.length * 0.9)]} max ${cpus.at(-1)}`,
);
const uniq = new Map();
for (const p of procs)
    uniq.set(p.name, (uniq.get(p.name) ?? new Set()).add(p.pid));
console.log(
    'unique pids over 10 s:',
    ['git', 'x', 'x.test', 'bash', 'sleep', 'sh', 'node', 'zsh']
        .map((n) => `${n} ${uniq.get(n)?.size ?? 0}`)
        .join(' | '),
    '| all',
    new Set(procs.map((p) => p.pid)).size,
);
