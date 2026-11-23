// pnpm mods:test [<mod>…] [--extra <file>] [--only <file>] — each mod's tests through `claude plugin test`, printing only
// the failing tests' output, then one summary line; exit 1 when any mod is red. --extra runs one outside test file with the
// mod's harness on a copy of the one mod named (FRM-388); --only runs one of a mod's own test files; --skip-tested, the
// commit gate's flag, runs no test: a mod the index changes passes on a green `x mods edit test` or hand run of these bytes, any
// other is refused; --clock-only, that verb's flag, reads only the clock rule of the named mods and runs no test
import { spawnSync } from 'node:child_process';
import {
    appendFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    realpathSync,
    rmSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

import { setup as startTestTempDir } from '../../../../script/lib/test-temp-dir.ts';

type Run = { clockReads?: string[]; mod: string; output: string };

// claude plugin test's words, read the same way by `x mods edit test` (x/go/mods.go testOutcome); both parsers are
// held to plugin-test.sample.txt: a test file that cannot load is «errored», a test that runs and fails is «failed»
const HOOK_SKIPPED = /hook was skipped: /;

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
        else if (HOOK_SKIPPED.test(line)) failed.push(line);
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

// the files of a run whose every failed row hit the kit's 5 s bound: a loaded machine, so they run once more; undefined
// when a row failed for real or nothing failed. the kit refuses node:os, so a row cannot size its bound (FRM-470)
export function timedOutFiles(output: string) {
    // no tally: the run died partway, so files it never reached would read green on a rerun of the rest
    if (!/^Ran \d+ tests? across/m.test(output)) return undefined;
    const lines = output.split('\n').map((l) => l.trim());
    const files = new Set<string>();
    let file = '';
    for (const [i, line] of lines.entries()) {
        const head = line.match(/^(tests\/\S+\.test\.tsx?):$/);
        if (head) file = head[1] ?? '';
        if (!line.startsWith('(fail) ')) continue;
        if (!lines[i + 1]?.startsWith('Error: timed out after ')) return;
        files.add(file);
    }
    return files.size ? [...files] : undefined;
}

// the run with each file the second run read replaced by that second reading
export function withRerun(output: string, rerun: string) {
    const sections = (text: string) =>
        text
            .split(/^(?=\s*tests\/\S+\.test\.tsx?:$)/m)
            .filter((s) => /^\s*tests\//.test(s))
            .map((s) => [s.trim().split('\n')[0] ?? '', s] as const);
    const again = new Map(sections(rerun));
    return sections(output)
        .map(([head, s]) => again.get(head) ?? s)
        .join('\n');
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
        } else if ((isFailing || HOOK_SKIPPED.test(line)) && line.trim())
            kept.push(line);
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
        } else if (c === '/' && REGEX_AFTER.test(out.trimEnd())) {
            // a regex literal: its quotes, backticks and slashes inside a class are text (FRM-489 row 23)
            out += c;
            let isClass = false;
            for (i++; i < source.length && source[i] !== '\n'; i++) {
                const r = source[i] as string;
                if (r === '\\') {
                    out += ' ';
                    i++;
                } else if (r === '[') isClass = true;
                else if (r === ']') isClass = false;
                else if (r === '/' && !isClass) break;
                out += keep(source[i] as string);
            }
            if (i < source.length && source[i] === '/') out += source[i++];
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
// a `/` after one of these opens a regex, never a division: no value ends on them. `<` and `}` stay off, since a JSX
// closer `</T>` and a self-closing `{...p} />` put a `/` there
const REGEX_AFTER =
    /(?:^|[(,=:[!&|?{;+\-*%>~^]|\b(?:return|typeof|case|in|of|await|yield|void|delete|else|do|throw|new))$/;
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

// claude plugin test takes only a folder, so a subset of a mod's test files runs in a copy holding no other
function copyKeepingTests(from: string, mod: string, keep: string[]) {
    const copy = join(mkdtempSync(join(tmpdir(), 'mods-subset-')), mod);
    cpSync(from, copy, {
        filter: (path) =>
            !/\.test\.tsx?$/.test(path) || keep.includes(relative(from, path)),
        recursive: true,
    });
    return copy;
}

// git as a hook's child: the hook's own git env points at a path outside the private copy
function git(root: string, args: string[], index?: string) {
    const env = { ...process.env };
    for (const key of [
        'GIT_DIR',
        'GIT_INDEX_FILE',
        'GIT_PREFIX',
        'GIT_WORK_TREE',
    ])
        delete env[key];
    if (index) env.GIT_INDEX_FILE = index;
    return (
        spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env })
            .stdout ?? ''
    ).trim();
}

// the mod's subtree as an index holds it, the commit's own when none is named
function indexedTree(root: string, mod: string, index?: string) {
    return git(
        root,
        [
            'write-tree',
            `--prefix=${git(root, ['rev-parse', '--show-prefix'])}${mod}/`,
        ],
        index,
    );
}

// the mod's subtree as a commit of the working tree would hold it, the bytes a hand run reads
function workingTree(root: string, mod: string) {
    const dir = mkdtempSync(join(tmpdir(), 'mods-tree-'));
    const index = join(dir, 'index');
    git(root, ['read-tree', 'HEAD'], index);
    git(root, ['add', '-A', '--', mod], index);
    const tree = indexedTree(root, mod, index);
    rmSync(dir, { force: true, recursive: true });
    return tree;
}

// the mods a commit's staged paths touch. a path beside the mods is vitest's, and no mods test reads an .md
export function touchedMods(changed: string[], all: string[]) {
    const touched = new Set(
        changed
            .filter((path) => !path.endsWith('.md'))
            .map((path) => path.split('/')[0]),
    );
    return all.filter((mod) => touched.has(mod));
}

// a touched mod no green read on these bytes, in the words that refuse its commit
export function untested(record: string, mod: string, tree: string) {
    const rows = record
        .split('\n')
        .map((line) => line.split('\t'))
        .filter(([, subject]) => subject === `mod ${mod}`);
    if (rows.some(([, , sha]) => sha === tree)) return [];
    return [
        `${mod}: no tested stamp on these bytes (${rows.length ? 'a green read others' : 'no green yet'}), so the commit is refused: run x mods edit test, or, for a change made outside it, script/gate-queue.sh --long pnpm mods:test ${mod}`,
    ];
}

function greenRecordPath() {
    return join(
        process.env.X_STATE ?? join(homedir(), '.local/state/x'),
        'gates-green.tsv',
    );
}

// a hand run's green, in the line `x mods edit test` writes; a lost one costs one rerun
function recordGreen(mod: string, tree: string) {
    const until = Math.floor(Date.now() / 1000) + 3600;
    mkdirSync(dirname(greenRecordPath()), { recursive: true });
    appendFileSync(greenRecordPath(), `${until}\tmod ${mod}\t${tree}\t\n`);
}

// the shell's own count of its children, as `times` prints it on its second line
export function cpuOf(times: string) {
    const [, children = ''] = times.trim().split('\n');
    return [...children.matchAll(/(\d+)m([\d.]+)s/g)].reduce(
        (sum, [, minutes, seconds]) =>
            sum + Number(minutes) * 60 + Number(seconds),
        0,
    );
}

// a mod's cpu-seconds cap for one whole run; the boots table is the first net, this one catches what it cannot count
export function cpuCap(table: string, mod: string) {
    const row = table.split('\n').find((line) => line.split('\t')[0] === mod);
    return row ? Number(row.split('\t')[1]) : undefined;
}

// one line per run, so a chain's count of whole runs reads from a file, never a memory (FRM-470); off under X_TEST
function logRun(args: string, line: string) {
    if (process.env.X_TEST) return;
    const state = process.env.X_STATE ?? join(homedir(), '.local/state/x');
    const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
        encoding: 'utf8',
    }).stdout?.trim();
    mkdirSync(state, { recursive: true });
    appendFileSync(
        join(state, 'mods-test.log'),
        `${new Date().toISOString()}\t${head || '-'}\t${args || 'all'}\t${line}\n`,
    );
}

if (import.meta.main) {
    const root = import.meta.dirname;
    const { positionals, values } = parseArgs({
        allowPositionals: true,
        options: {
            'clock-only': { type: 'boolean' },
            extra: { type: 'string' },
            only: { type: 'string' },
            'skip-tested': { type: 'boolean' },
        },
    });
    const all = readdirSync(root)
        .sort()
        .filter((mod) => existsSync(join(root, mod, '.claude-plugin')));
    const unknown = positionals.filter((mod) => !all.includes(mod));
    // real paths, since a mod is also reached through the ~/.claude symlink
    const only =
        values.only && existsSync(values.only)
            ? realpathSync(values.only)
            : undefined;
    const onlyMod = only && relative(realpathSync(root), only).split(sep)[0];
    if (
        unknown.length ||
        (values.extra && positionals.length !== 1) ||
        (values.only &&
            (values.extra ||
                positionals.length ||
                !all.includes(onlyMod as string)))
    ) {
        console.error(
            `usage: pnpm mods:test [<mod>…] [--extra <file> with one <mod>] [--only <a test file of a mod>] [--skip-tested] — mods: ${all.join(', ')}`,
        );
        process.exit(2);
    }
    const runs: (Run & { status: number | null })[] = [];
    let reran = false;
    if (values['clock-only']) {
        const reads = positionals.flatMap((mod) =>
            hookClockReads(join(root, mod)).map((at) => `${mod}/${at}`),
        );
        for (const at of reads)
            console.log(`a clock read outside $.clock: ${at}`);
        process.exit(reads.length ? 1 : 0);
    }
    process.on('exit', startTestTempDir());
    if (values['skip-tested']) {
        const path = greenRecordPath();
        const record = existsSync(path) ? readFileSync(path, 'utf8') : '';
        const staged = git(root, [
            'diff',
            '--cached',
            '--name-only',
            '--no-renames',
            '--relative',
        ]).split('\n');
        const red = touchedMods(staged, all).flatMap((mod) => [
            ...hookClockReads(join(root, mod)).map(
                (at) => `a clock read outside $.clock: ${mod}/${at}`,
            ),
            ...untested(record, mod, indexedTree(root, mod)),
        ]);
        for (const line of red) console.log(line);
        process.exit(red.length ? 1 : 0);
    }
    const capsFile = join(root, '../../../../script/test-cpu-budget.tsv');
    const caps = existsSync(capsFile) ? readFileSync(capsFile, 'utf8') : '';
    const named = onlyMod ? [onlyMod] : positionals;
    const past: string[] = [];
    for (const mod of named.length ? named : all) {
        let dir = join(root, mod);
        const isWhole = !values.extra && !only;
        const tree = isWhole ? workingTree(root, mod) : undefined;
        if (values.extra) {
            dir = join(mkdtempSync(join(tmpdir(), 'mods-extra-')), mod);
            cpSync(join(root, mod), dir, { recursive: true });
            cpSync(
                resolve(values.extra),
                join(dir, 'tests', basename(values.extra)),
            );
        }
        if (only)
            dir = copyKeepingTests(realpathSync(join(root, mod)), mod, [
                relative(realpathSync(join(root, mod)), only),
            ]);
        const times = join(mkdtempSync(join(tmpdir(), 'mods-times-')), 'times');
        const r = spawnSync(
            'sh',
            [
                '-c',
                '"$@"; code=$?; times >"$0"; exit $code',
                times,
                'claude',
                'plugin',
                'test',
                dir,
            ],
            { encoding: 'utf8' },
        );
        const cpu = cpuOf(readFileSync(times, 'utf8'));
        let output = `${r.stdout}${r.stderr}`;
        let { status } = r;
        const late = timedOutFiles(output);
        if (late) {
            reran = true;
            const copy = copyKeepingTests(dir, mod, late);
            const again = spawnSync('claude', ['plugin', 'test', copy], {
                encoding: 'utf8',
            });
            output = withRerun(output, `${again.stdout}${again.stderr}`);
            status = again.status;
            rmSync(dirname(copy), { force: true, recursive: true });
            process.stdout.write(
                `${mod}: only timeouts, ran again: ${late.join(', ')}\n`,
            );
        }
        const failed = failures(output);
        if (failed) process.stdout.write(`${mod}:\n${failed}\n`);
        const clock = hookClockReads(dir);
        if (clock.length)
            process.stdout.write(
                `${mod}: a clock read outside $.clock (date bomb), give it the $.clock fallback or a clock-ok line above:\n${clock.map((c) => `  ${c}`).join('\n')}\n`,
            );
        runs.push({ clockReads: clock, mod, output, status });
        const cap = cpuCap(caps, mod);
        if (isWhole && cap !== undefined && !(cpu <= cap))
            past.push(
                `${mod}: ${cpu.toFixed(1)} cpu-s, its cap in script/test-cpu-budget.tsv is ${cap}`,
            );
        // a throwing hook exits 0 and reads failed; a file that cannot load exits red
        const { failed: red, passed } = outcome(output);
        if (
            tree &&
            tree === workingTree(root, mod) &&
            !process.env.X_TEST &&
            status === 0 &&
            passed &&
            !red.length &&
            !clock.length
        )
            recordGreen(mod, tree);
        if (values.extra || only)
            rmSync(dirname(dir), { force: true, recursive: true });
    }
    const line = [summary(runs), ...past].join(', ');
    console.log(`\n${line}`);
    logRun(
        process.argv.slice(2).join(' '),
        reran ? `${line} (timed-out files ran again)` : line,
    );
    process.exit(
        runs.some((r) => r.status !== 0) ||
            line.includes('red in') ||
            past.length
            ? 1
            : 0,
    );
}
