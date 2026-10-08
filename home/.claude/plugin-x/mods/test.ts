// pnpm mods:test — every mod's tests through `claude plugin test`, then one summary line; exit 1 when any mod is red
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

type Run = { mod: string; output: string };

const count = (output: string, word: 'pass' | 'fail') =>
    Number(output.match(new RegExp(`^\\s*(\\d+) ${word}$`, 'm'))?.[1] ?? NaN);

export function summary(runs: Run[]) {
    let pass = 0;
    let fail = 0;
    const red: string[] = [];
    for (const { mod, output } of runs) {
        const p = count(output, 'pass');
        const f = count(output, 'fail');
        if (Number.isNaN(p) || Number.isNaN(f)) {
            red.push(`${mod} (no tally)`);
            continue;
        }
        pass += p;
        fail += f;
        if (f) red.push(mod);
    }
    const head = red.length
        ? `red in ${red.join(', ')}`
        : `${runs.length} mods green`;
    return `mods:test: ${head}, ${pass} pass, ${fail} fail`;
}

if (import.meta.main) {
    const root = import.meta.dirname;
    const runs: (Run & { status: number | null })[] = [];
    for (const mod of readdirSync(root).sort()) {
        const dir = join(root, mod);
        if (!existsSync(join(dir, '.claude-plugin'))) continue;
        const r = spawnSync('claude', ['plugin', 'test', dir], {
            encoding: 'utf8',
        });
        const output = `${r.stdout}${r.stderr}`;
        process.stdout.write(output);
        runs.push({ mod, output, status: r.status });
    }
    const line = summary(runs);
    console.log(`\n${line}`);
    process.exit(
        runs.some((r) => r.status !== 0) || line.includes('red in') ? 1 : 0,
    );
}
