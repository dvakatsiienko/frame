// pnpm mods:test [<mod>…] [--extra <file>] — each mod's tests through `claude plugin test`, printing only the failing
// tests' output, then one summary line; exit 1 when any mod is red. --extra runs one outside test file with the mod's
// harness on a copy of the one mod named (FRM-388)
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

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

// the failing tests of one run, each under its file's header with the lines it printed; passes and tallies dropped
export function failures(output: string) {
    const kept: string[] = [];
    let header = '';
    let isShown = false;
    let isFailing = false;
    for (const line of output.split('\n')) {
        if (/^tests\/\S+:$/.test(line)) {
            header = line;
            isShown = false;
            isFailing = false;
        } else if (line.startsWith('(fail) ')) {
            if (!isShown) kept.push(header);
            isShown = true;
            isFailing = true;
            kept.push(line);
        } else if (
            line.startsWith('(pass) ') ||
            /^\s*\d+ (pass|fail)$/.test(line)
        ) {
            isFailing = false;
        } else if (isFailing && line.trim()) kept.push(line);
    }
    return kept.filter(Boolean).join('\n');
}

if (import.meta.main) {
    const root = import.meta.dirname;
    const { positionals, values } = parseArgs({
        allowPositionals: true,
        options: { extra: { type: 'string' } },
    });
    const all = readdirSync(root)
        .sort()
        .filter((mod) => existsSync(join(root, mod, '.claude-plugin')));
    const unknown = positionals.filter((mod) => !all.includes(mod));
    if (unknown.length || (values.extra && positionals.length !== 1)) {
        console.error(
            `usage: pnpm mods:test [<mod>…] [--extra <file> with one <mod>] — mods: ${all.join(', ')}`,
        );
        process.exit(2);
    }
    const runs: (Run & { status: number | null })[] = [];
    for (const mod of positionals.length ? positionals : all) {
        let dir = join(root, mod);
        if (values.extra) {
            dir = join(mkdtempSync(join(tmpdir(), 'mods-extra-')), mod);
            cpSync(join(root, mod), dir, { recursive: true });
            cpSync(
                resolve(values.extra),
                join(dir, 'tests', basename(values.extra)),
            );
        }
        const r = spawnSync('claude', ['plugin', 'test', dir], {
            encoding: 'utf8',
        });
        const output = `${r.stdout}${r.stderr}`;
        const failed = failures(output);
        if (failed) process.stdout.write(`${mod}:\n${failed}\n`);
        runs.push({ mod, output, status: r.status });
    }
    const line = summary(runs);
    console.log(`\n${line}`);
    process.exit(
        runs.some((r) => r.status !== 0) || line.includes('red in') ? 1 : 0,
    );
}
