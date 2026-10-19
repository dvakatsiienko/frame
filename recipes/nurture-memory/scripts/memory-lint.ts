/**
 * memory-lint — the memory guards on every commit that touches memory, so rot is caught at write time, not at the next sweep.
 * - a size budget per memory file (`memory-budgets.tsv` beside this script): over it, the commit asks for a regroom first;
 *   a useful add raises the file's row in the same commit, with its reason — the raise is the official way past
 * - two bullets merged on one line (a swallowed newline)
 * - a backticked repo path that is not on disk (a failure)
 * - warnings, never a failure: a «…» quote present at HEAD and gone from the staged file (as quote-diff.py reads it);
 *   a sentence of 12+ words living in two memory files
 * usage: memory-lint.ts <staged files…> (lefthook) · memory-lint.ts --seed (adds a row at size + 15 % for each new memory file, drops a gone file's row, keeps every raise)
 */

/* Core */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
}).trim();
const BUDGETS = 'recipes/nurture-memory/scripts/memory-budgets.tsv';
const MEMORY = [
    'home/.claude/CLAUDE.md',
    'home/.claude/rules/*.md',
    'home/.claude/rules-lazy/*.md',
    'cclio/memory/*.md',
    '*AGENTS.md',
    'home/.claude/plugin-x/skills/*/SKILL.md',
    'cclio/plugin-cclio/skills/*/SKILL.md',
    'home/.claude/plugin-x/skills/*/references/*.md',
    'cclio/plugin-cclio/skills/*/references/*.md',
    'home/.claude/agents/*.md',
    'cclio/.claude/agents/*.md',
];
const GROWTH = 1.15;
const MERGED = /[\w.)»*]- [^\s-]|[^\s\d-]\d+\. \*\*/;
const CODE = /`[^`]*`/g;
const QUOTE = /«[^»]{3,}»/g;
const PATH_TOKEN = /`([^`\s<*{$]+)`/g;
const SENTENCE_WORDS = 12;
const squash = (text: string) => text.replace(/\s+/g, ' ');

type Row = { budget: number; reason: string };

// the staged form when the file is staged, the disk form otherwise (a hand run before `git add`)
function indexed(path: string) {
    const disk = join(ROOT, path);
    return (
        git('show', `:${path}`) ??
        (existsSync(disk) ? readFileSync(disk, 'utf8') : undefined)
    );
}

function git(...args: string[]) {
    try {
        return execFileSync('git', args, {
            cwd: ROOT,
            encoding: 'utf8',
            maxBuffer: 1 << 26,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return undefined;
    }
}

function readBudgets(text: string | undefined) {
    const rows = new Map<string, Row>();
    for (const line of (text ?? '').split('\n')) {
        if (!line.trim() || line.startsWith('#')) continue;
        const [path = '', budget = '0', reason = ''] = line.split('\t');
        rows.set(path, { budget: Number(budget), reason: reason.trim() });
    }
    return rows;
}

function mergedLines(text: string) {
    const hits: number[] = [];
    let fence = false;
    text.split('\n').forEach((line, i) => {
        if (line.trimStart().startsWith('```')) fence = !fence;
        if (!fence && MERGED.test(line.replace(CODE, '``'))) hits.push(i + 1);
    });
    return hits;
}

// lines outside code fences, numbered from 1
function proseLines(text: string) {
    const out: { n: number; line: string }[] = [];
    let fence = false;
    text.split('\n').forEach((line, i) => {
        if (line.trimStart().startsWith('```')) fence = !fence;
        else if (!fence) out.push({ line, n: i + 1 });
    });
    return out;
}

// the repo's top-level directory names, derived from the tracked files
function topDirs() {
    return new Set(
        (git('ls-files') ?? '')
            .split('\n')
            .filter((path) => path.includes('/') && !path.startsWith('.'))
            .map((path) => path.split('/')[0] ?? ''),
    );
}

function deadPaths(text: string, dirs: Set<string>, file = '') {
    const hits: { n: number; token: string }[] = [];
    for (const { n, line } of proseLines(text))
        for (const [, raw = ''] of line.matchAll(PATH_TOKEN)) {
            const token = raw
                .replace(/:\d+(-\d+)?$/, '')
                .replace(/[.,;)]+$/, '');
            const home = token.startsWith('~/.claude/');
            const frame = token.startsWith('~/frame/');
            if (!token.includes('/')) continue;
            if (!home && !frame && !dirs.has(token.split('/')[0] ?? ''))
                continue;
            const disk = home
                ? join(homedir(), token.slice(2))
                : join(ROOT, frame ? token.slice(8) : token);
            const local = join(ROOT, dirname(file), token);
            if (!existsSync(disk) && !existsSync(local))
                hits.push({ n, token });
        }
    return hits;
}

function goneQuotes(file: string, text: string) {
    const was = git('show', `HEAD:${file}`) ?? '';
    const now = squash(text);
    return [...new Set(was.match(QUOTE) ?? [])].filter(
        (quote) => !now.includes(squash(quote)),
    );
}

// every sentence of 12+ words → the first `file:line` it lives at; the second file to say it is the hit
function repeatedSentences(texts: Map<string, string>) {
    const seen = new Map<string, string>();
    const hits: string[] = [];
    for (const [file, text] of texts)
        for (const { n, line } of proseLines(text))
            for (const part of line.split(/(?<=[.!?])\s+/)) {
                const sentence = squash(
                    part.replace(/^[\s>*\-\d.]+|[*_`]/g, ''),
                )
                    .trim()
                    .toLowerCase();
                if (sentence.split(' ').length < SENTENCE_WORDS) continue;
                const first = seen.get(sentence);
                if (!first) seen.set(sentence, `${file}:${n}`);
                else if (!first.startsWith(`${file}:`))
                    hits.push(
                        `${first} and ${file}:${n}: "${sentence.slice(0, 80)}…"`,
                    );
            }
    return hits;
}

function memoryFiles() {
    return new Set(
        (git('ls-files', '--', ...MEMORY) ?? '').split('\n').filter(Boolean),
    );
}

// adds a row for every memory file without one and drops the rows whose file is gone; a raised row is never reset
function seed() {
    const files = memoryFiles();
    const rows = readBudgets(indexed(BUDGETS));
    const today = new Date().toISOString().slice(0, 10);
    const added: string[] = [];
    const dropped = [...rows.keys()].filter((path) => !files.has(path));
    for (const path of dropped) rows.delete(path);
    for (const file of files) {
        if (rows.has(file)) continue;
        const size = Buffer.byteLength(indexed(file) ?? '');
        rows.set(file, {
            budget: Math.ceil((size * GROWTH) / 100) * 100,
            reason: `seed ${today}, its size + 15 %`,
        });
        added.push(file);
    }
    const lines = [
        '# path\tbudget bytes\treason for the last raise — a raise is a reviewed, useful add (recipes/nurture-memory/recipe.md § his standing calls)',
        ...[...rows]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([path, row]) => `${path}\t${row.budget}\t${row.reason}`),
    ];
    writeFileSync(join(ROOT, BUDGETS), `${lines.join('\n')}\n`);
    console.log(
        `memory-lint: ${added.length} rows added, ${dropped.length} dropped (${[...added, ...dropped].join(', ') || 'none'})`,
    );
}

// every commit runs it: the memory set is derived here, never a second list in lefthook
function lint(stagedFiles: string[]) {
    const memory = memoryFiles();
    const files = stagedFiles.filter((file) => memory.has(file));
    const budgets = readBudgets(indexed(BUDGETS));
    const before = readBudgets(git('show', `HEAD:${BUDGETS}`));
    const problems: string[] = [];
    for (const [path, row] of budgets) {
        const was = before.get(path);
        if (was && was.budget !== row.budget && row.reason === was.reason)
            problems.push(
                `${path}: its budget moved ${was.budget} → ${row.budget} with the old reason — name why this add earned it`,
            );
    }
    for (const path of budgets.keys())
        if (!memory.has(path))
            problems.push(
                `${path}: a budget row for a file that is gone or renamed — run memory-lint.ts --seed`,
            );
    const warnings: string[] = [];
    const dirs = topDirs();
    for (const file of files) {
        const text = indexed(file);
        if (text === undefined) continue;
        const row = budgets.get(file);
        const size = Buffer.byteLength(text);
        if (row && size > row.budget)
            problems.push(
                `${file}: ${size} B over its ${row.budget} B budget — regroom it first (x:author-memory's lenses, no fact lost); a useful add that still needs the room raises its row in ${BUDGETS} in this commit, with the reason`,
            );
        if (!row)
            problems.push(
                `${file}: a new memory file with no budget row — run memory-lint.ts --seed and stage ${BUDGETS}`,
            );
        for (const n of mergedLines(text))
            problems.push(`${file}:${n}: two bullets merged on one line`);
        // a warning: planned paths and dated history lines name files that are gone on purpose
        for (const { n, token } of deadPaths(text, dirs, file))
            warnings.push(`${file}:${n}: \`${token}\` is not on disk`);
        for (const quote of goneQuotes(file, text))
            warnings.push(
                `${file}: his quote is gone from HEAD's version: ${quote.slice(0, 160)}`,
            );
    }
    // a repeat only matters when a staged file is one of its two homes
    const staged = new Set(files);
    const texts = new Map<string, string>();
    for (const file of [...memory].sort())
        texts.set(
            file,
            staged.has(file)
                ? (indexed(file) ?? '')
                : existsSync(join(ROOT, file))
                  ? readFileSync(join(ROOT, file), 'utf8')
                  : '',
        );
    for (const hit of repeatedSentences(texts))
        if (files.some((file) => hit.includes(`${file}:`)))
            warnings.push(`the same sentence in two files: ${hit}`);
    for (const w of warnings) console.error(`⚠ ${w}`);
    for (const p of problems) console.error(`✗ ${p}`);
    if (problems.length) process.exit(1);
}

const args = process.argv.slice(2);
if (args[0] === '--seed') seed();
else lint(args);
