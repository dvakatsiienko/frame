// pnpm mods:test [<mod>…] [--extra <file>] — each mod's tests through `claude plugin test`, printing only the failing
// tests' output, then one summary line; exit 1 when any mod is red. --extra runs one outside test file with the mod's
// harness on a copy of the one mod named (FRM-388)
import { spawnSync } from 'node:child_process';
import {
    cpSync,
    existsSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

type Run = { clockReads?: string[]; mod: string; output: string };

// claude plugin test's words, read the same way by `x mods edit test` (x/go/mods.go testOutcome); both parsers are
// held to plugin-test.sample.txt: a test file that cannot load is «errored», a test that runs and fails is «failed»
export function outcome(output: string) {
    let file = '';
    let passed = 0;
    const failed: string[] = [];
    const errored: string[] = [];
    for (const raw of output.split('\n')) {
        const line = raw.trim();
        const head = line.match(/^(tests\/\S+\.test\.tsx?):$/);
        if (head) file = head[1] ?? '';
        else if (line.startsWith('(pass) ')) passed++;
        else if (line === '(fail) the file did not load') errored.push(file);
        else {
            const fail = line.match(/^\(fail\) (.+?)(?: \[[\d.]+ms\])?$/);
            if (fail) failed.push(fail[1] ?? '');
        }
    }
    return { errored, failed, passed };
}

export function summary(runs: Run[]) {
    let pass = 0;
    let fail = 0;
    const red: string[] = [];
    for (const { clockReads, mod, output } of runs) {
        const { errored, failed, passed } = outcome(output);
        if (!passed && !failed.length && !errored.length) {
            red.push(`${mod} (no tally)`);
            continue;
        }
        pass += passed;
        fail += failed.length + errored.length;
        if (clockReads?.length)
            red.push(`${mod} (clock read at ${clockReads.join(', ')})`);
        else if (errored.length)
            red.push(`${mod} (${errored.join(', ')} did not load)`);
        else if (failed.length) red.push(mod);
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

// a bare clock read in a mod's hooks is a date bomb: a test fakes `$.clock`, never Date, so the read passes until the
// day moves (todo 1's baseline: 511 pass, 2 red). `$.clock.now().catch(() => Date.now())` passes; a sync path with no
// `$.clock` to await names itself with `// clock-ok: <why>` on the line above. answers the 1-based lines of each read
export function clockReads(source: string) {
    const blank = (m: string) => m.replace(/[^\n]/g, ' ');
    const code = codeOnly(source.replace(CLOCK_FALLBACK, blank));
    const lines = source.split('\n');
    const hits: number[] = [];
    for (const m of code.matchAll(CLOCK_READ)) {
        const line = code.slice(0, m.index).split('\n').length;
        if (!/\/\/\s*clock-ok:\s*\S/.test(lines[line - 2] ?? ''))
            hits.push(line);
    }
    return hits;
}
const CLOCK_READ =
    /\bDate\s*\.\s*now\b|\bDate\s*\[|\{[^}]*\bnow\b[^}]*\}\s*=\s*Date\b|\bnew\s+Date\b(?!\s*\(\s*[^)\s])/g;
// the source with comments and string text blanked, newlines kept: a regex over the raw text cannot tell a `//` inside a
// string from a comment. a template's `${ … }` stays code
function codeOnly(source: string) {
    let out = '';
    // each open template's brace depth, innermost last; a `}` at depth 0 closes the placeholder back into the template
    const templates: number[] = [];
    let i = 0;
    const keep = (c: string) => (c === '\n' ? '\n' : ' ');
    while (i < source.length) {
        const c = source[i] as string;
        const next = source[i + 1];
        if (c === '/' && next === '/') {
            while (i < source.length && source[i] !== '\n') {
                out += ' ';
                i++;
            }
        } else if (c === '/' && next === '*') {
            const end = source.indexOf('*/', i + 2);
            const stop = end < 0 ? source.length : end + 2;
            for (; i < stop; i++) out += keep(source[i] as string);
        } else if (c === "'" || c === '"') {
            out += c;
            for (
                i++;
                i < source.length && source[i] !== c && source[i] !== '\n';
                i++
            ) {
                if (source[i] === '\\') {
                    out += ' ';
                    i++;
                }
                out += keep(source[i] as string);
            }
            if (i < source.length) out += source[i++];
        } else if (c === '`' || (c === '}' && templates.at(-1) === 0)) {
            if (c === '}') templates.pop();
            out += c;
            let isPlaceholder = false;
            for (i++; i < source.length && source[i] !== '`'; i++) {
                if (source[i] === '\\') {
                    out += ' ';
                    i++;
                } else if (source[i] === '$' && source[i + 1] === '{') {
                    out += '${';
                    i += 2;
                    templates.push(0);
                    isPlaceholder = true;
                    break;
                }
                out += keep(source[i] as string);
            }
            if (!isPlaceholder && i < source.length) out += source[i++];
        } else {
            if (templates.length && c === '{')
                templates[templates.length - 1] =
                    (templates.at(-1) as number) + 1;
            if (templates.length && c === '}')
                templates[templates.length - 1] =
                    (templates.at(-1) as number) - 1;
            out += c;
            i++;
        }
    }
    return out;
}
const CLOCK_FALLBACK =
    /\$\.clock\s*\.\s*now\(\s*\)\s*\.catch\(\s*(?:\(\s*\)\s*=>\s*Date\.now\(\s*\)|Date\.now)\s*,?\s*\)/g;

// every clock read under a mod's hooks/, as `hooks/<file>:<line>`
function hookClockReads(dir: string) {
    const hooks = join(dir, 'hooks');
    return readdirSync(hooks, { recursive: true })
        .map(String)
        .filter((f) => /\.tsx?$/.test(f))
        .sort()
        .flatMap((f) =>
            clockReads(readFileSync(join(hooks, f), 'utf8')).map(
                (line) => `hooks/${f}:${line}`,
            ),
        );
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
        const clock = hookClockReads(dir);
        if (clock.length)
            process.stdout.write(
                `${mod}: a clock read outside $.clock (date bomb), give it the $.clock fallback or a clock-ok line above:\n${clock.map((c) => `  ${c}`).join('\n')}\n`,
            );
        runs.push({ clockReads: clock, mod, output, status: r.status });
        if (values.extra)
            rmSync(dirname(dir), { force: true, recursive: true });
    }
    const line = summary(runs);
    console.log(`\n${line}`);
    process.exit(
        runs.some((r) => r.status !== 0) || line.includes('red in') ? 1 : 0,
    );
}
