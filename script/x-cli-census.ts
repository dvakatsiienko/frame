/**
 * x-cli-census — the cli's facts for a drift check: per family its verbs and their runs
 * (`x stats`), then the raw Bash heads in cc transcripts that no x door covers (`x stats --outside`). no model.
 */
import { execFileSync } from 'node:child_process';

import { type Head, rawHeads, shellBasics } from './lib/cli-census.ts';

const days = 14;

if (process.argv.length > 2) {
    console.error('usage: pnpm x:cli-census (takes no arguments)');
    process.exit(2);
}

const schema: Schema = x('schema');
const families = [
    ...new Set(schema.verbs.map((verb) => verb.name.split(' ')[0] ?? '')),
];
const stats: Stats = x('stats', '--days', String(days));
const runsOf = new Map(stats.verbs.map((verb) => [verb.name, verb.calls]));

console.log(
    `x stats: ${stats.calls} calls over ${stats.days} day(s) of traces (${stats.first} → ${stats.last}), dev calls left out`,
);
console.log(
    `callers: ${Object.entries(stats.callers)
        .map(([caller, calls]) => `${caller} ${calls}`)
        .join(', ')}\n`,
);
for (const family of families) {
    const verbs = schema.verbs.filter(
        (verb) => verb.name.split(' ')[0] === family,
    );
    console.log(`${family} — ${verbs.length} verb(s)`);
    for (const verb of verbs)
        console.log(`  ${verb.name}  ${runsOf.get(verb.name) ?? 0}`);
}

const outside: { heads: Head[] } = x(
    'stats',
    '--outside',
    '--days',
    String(days),
    '--top',
    '500',
);
console.log(
    `\nraw Bash heads no x door covers, last ${days} days, ≥5 runs, top 20 (x stats --outside --days ${days})`,
);
console.log(`  (shell basics left out: ${[...shellBasics].join(' ')})`);
for (const { calls, name } of rawHeads(outside.heads))
    console.log(`  ${calls}  ${name}`);

function x<T>(...args: string[]): T {
    const out = execFileSync('x', [...args, '--json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(out).data;
}

/* Types */

interface Schema {
    verbs: { name: string }[];
}

interface Stats {
    callers: Record<string, number>;
    calls: number;
    days: number;
    first: string;
    last: string;
    verbs: { calls: number; name: string }[];
}
