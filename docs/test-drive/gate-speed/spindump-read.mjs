import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const rl = createInterface({ input: createReadStream('/tmp/spindump-go.txt') });
const bump = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
const byParent = new Map();
const nByParent = new Map();
const onStack = new Map();
const leafMod = new Map();
const kuByProc = new Map();
const modsByProc = new Map();
const sandboxed = new Map();
const samplesLines = [];
let proc = '';
let parent = '';
let stack = [];
let kernelTotal = 0;
let printed = 0;
const lineRe = /^(\s+)(\*?)(\d+)\s+(.+?) \[0x[0-9a-f]+\](?:\s*\((.*)\))?\s*$/;
for await (const line of rl) {
    const p = line.match(/^Process:\s+(.+?) \[\d+\]/);
    if (p) {
        proc = p[1];
        parent = '';
        stack = [];
        continue;
    }
    const par = line.match(/^Parent:\s+(.+?) \[\d+\]/);
    if (par) {
        parent = par[1];
        continue;
    }
    if (/^(Sandboxed|Sandbox):/i.test(line))
        bump(sandboxed, `${proc} ${line.trim()}`);
    const c = line.match(/^CPU Time:\s+([\d.]+)s/);
    if (c && proc) {
        bump(byParent, `${proc} <- ${parent}`, Number(c[1]));
        bump(nByParent, `${proc} <- ${parent}`);
        continue;
    }
    if (/^\s+Thread 0x/.test(line)) {
        stack = [];
        continue;
    }
    const m = line.match(lineRe);
    if (!m) continue;
    const depth = m[1].length;
    const mod = m[4].match(/\(([^()]+?) \+ \d+\)$/)?.[1] ?? '?';
    stack = stack.filter((f) => f.depth < depth);
    stack.push({ depth, k: m[2] === '*', mod });
    if (!(m[5] ?? '').includes('running')) continue;
    if (proc === 'kernel_task' || proc === 'spindump') continue;
    const n = Number(m[3]);
    const ku = kuByProc.get(proc) ?? { k: 0, u: 0 };
    if (m[2] === '*') {
        ku.k += n;
        kernelTotal += n;
        bump(leafMod, mod, n);
        const mods = new Set(stack.filter((f) => f.k).map((f) => f.mod));
        for (const x of mods) {
            bump(onStack, x, n);
            if (proc === 'git') bump(modsByProc, x, n);
        }
        if (printed < 2 && proc === 'git' && mods.has('Sandbox')) {
            printed++;
            samplesLines.push(line.slice(0, 120));
        }
    } else ku.u += n;
    kuByProc.set(proc, ku);
}
console.log('--- cpu by proc <- parent: seconds, instances');
for (const [k, v] of top(byParent, 22))
    console.log(
        `${v.toFixed(2).padStart(7)} ${String(nByParent.get(k)).padStart(5)} ${k.slice(0, 80)}`,
    );
console.log(
    `--- kernel running samples, idle and spindump excluded: ${kernelTotal}; module anywhere on the stack`,
);
for (const [k, v] of top(onStack, 14))
    console.log(
        `${String(v).padStart(7)} ${((v / kernelTotal) * 100).toFixed(0).padStart(3)} % ${k.slice(0, 60)}`,
    );
console.log('--- leaf module');
for (const [k, v] of top(leafMod, 8))
    console.log(`${String(v).padStart(7)} ${k.slice(0, 60)}`);
console.log('--- git only, module on stack');
for (const [k, v] of top(modsByProc, 8))
    console.log(`${String(v).padStart(7)} ${k.slice(0, 60)}`);
console.log('--- kernel vs user samples per proc');
for (const [k, v] of [...kuByProc]
    .sort((a, b) => b[1].k + b[1].u - a[1].k - a[1].u)
    .slice(0, 10))
    console.log(
        `${String(v.k).padStart(6)} ${String(v.u).padStart(6)} ${k.slice(0, 50)}`,
    );
console.log('--- sandbox lines', top(sandboxed, 4));
console.log(samplesLines.join('\n'));
