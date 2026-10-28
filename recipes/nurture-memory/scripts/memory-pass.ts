// the weekly memory pass's pre-pass: duckdb narrows the week's added lines to candidates, the llm judges only those
// usage: node memory-pass.ts [--days 7] [--out <file>]   prints the candidate report (markdown) to stdout or --out
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { deadPointers } from './memory-pointers.ts';

const root = path.resolve(import.meta.dirname, '../../..');
const { values } = parseArgs({
    options: {
        days: { default: '7', type: 'string' },
        out: { type: 'string' },
    },
});
const git = (...args: string[]) =>
    execFileSync('git', ['-C', root, ...args], {
        encoding: 'utf8',
        maxBuffer: 64 << 20,
    });

const budgets = readFileSync(
    path.join(import.meta.dirname, 'memory-budgets.tsv'),
    'utf8',
)
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('\t'))
    .map(([file = '', budget = '0']) => ({ budget: Number(budget), file }))
    .filter(({ file }) => existsSync(path.join(root, file)));

const base = git(
    'rev-list',
    '-1',
    `--before=${values.days} days ago`,
    'HEAD',
).trim();
const changed = new Set(git('diff', '--name-only', base, 'HEAD').split('\n'));

// every memory line as it stands now, and which of them the window added (by their current line number)
type Row = { file: string; line: number; text: string; added: boolean };
const rows: Row[] = [];
for (const { file } of budgets) {
    const added = new Set<number>();
    if (changed.has(file))
        for (const hunk of git(
            'diff',
            '-U0',
            base,
            'HEAD',
            '--',
            file,
        ).matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm))
            for (
                let n = Number(hunk[1]);
                n < Number(hunk[1]) + Number(hunk[2] ?? 1);
                n++
            )
                added.add(n);
    readFileSync(path.join(root, file), 'utf8')
        .split('\n')
        .forEach((text, i) => {
            rows.push({ added: added.has(i + 1), file, line: i + 1, text });
        });
}

const dir = mkdtempSync(path.join(tmpdir(), 'memory-pass-'));
writeFileSync(path.join(dir, 'lines.json'), JSON.stringify(rows));
writeFileSync(
    path.join(dir, 'budgets.json'),
    JSON.stringify(
        budgets.map((b) => ({
            ...b,
            bytes: readFileSync(path.join(root, b.file)).length,
        })),
    ),
);

// a dupe is two lines in different files sharing most of their words; html comments and quotes of dima are still lines
const sql = `
create table lines as select *, list_distinct(list_filter(string_split(regexp_replace(lower(text), '[^a-z0-9]+', ' ', 'g'), ' '), lambda w: length(w) > 3)) as words
  from read_json('${dir}/lines.json');
create table budgets as select * from read_json('${dir}/budgets.json');
copy (
  select a.file, a.line, b.file as other_file, b.line as other_line,
         round(len(list_intersect(a.words, b.words)) / len(list_distinct(list_concat(a.words, b.words))), 2) as overlap,
         left(a.text, 90) as text
  from lines a join lines b on a.file <> b.file
  where a.added and len(a.words) >= 8 and len(b.words) >= 8
    and len(list_intersect(a.words, b.words)) / len(list_distinct(list_concat(a.words, b.words))) >= 0.35
  order by overlap desc limit 40
) to '${dir}/dupes.json' (format json, array true);
copy (
  select file, line, length(text) as chars, left(text, 90) as text from lines
  where added and length(text) > 350 order by chars desc
) to '${dir}/long.json' (format json, array true);
copy (
  select file, line, left(text, 90) as text from lines
  where added and regexp_matches(lower(text), 'refuse[sd]?|guard:|the hook|is refused')
) to '${dir}/enforced.json' (format json, array true);
copy (
  select file, bytes, budget, round(100.0 * bytes / budget) as pct from budgets
  where bytes >= 0.9 * budget order by pct desc
) to '${dir}/budget.json' (format json, array true);
copy (select count(*) filter (where added) as added, count(distinct file) filter (where added) as files from lines)
  to '${dir}/counts.json' (format json, array true);
`;
execFileSync('duckdb', ['-no-agent', '-c', sql], { encoding: 'utf8' });
const read = <T>(name: string) =>
    JSON.parse(readFileSync(path.join(dir, `${name}.json`), 'utf8')) as T[];

// a cut that moved a rule leaves no pointer into nothing: paths and `name` § section pointers both resolve
const dead = deadPointers(
    root,
    rows.filter((row) => row.added),
);

const [counts] = read<{ added: number; files: number }>('counts');
const section = <T>(title: string, items: T[], show: (item: T) => string) =>
    `## ${title} (${items.length})\n${items.map((item) => `- ${show(item)}`).join('\n') || '- none'}\n`;
type At = { file: string; line: number; text: string };
const report = [
    `# memory pass candidates — ${counts?.added ?? 0} lines added in ${counts?.files ?? 0} files since ${base.slice(0, 8)} (${values.days} days)\n`,
    section(
        'dupes: an added line sharing ≥35 % of its words with another file',
        read<At & { other_file: string; other_line: number; overlap: number }>(
            'dupes',
        ),
        (d) =>
            `${d.file}:${d.line} ↔ ${d.other_file}:${d.other_line} · ${d.overlap} · «${d.text}»`,
    ),
    section(
        'enforced?: an added line naming a refusal or a guard',
        read<At>('enforced'),
        (e) => `${e.file}:${e.line} · «${e.text}»`,
    ),
    section(
        'long: an added line over 350 chars',
        read<At & { chars: number }>('long'),
        (l) => `${l.file}:${l.line} · ${l.chars} chars · «${l.text}»`,
    ),
    section(
        'near budget: ≥90 % of the row',
        read<{ file: string; bytes: number; budget: number; pct: number }>(
            'budget',
        ),
        (b) => `${b.file} · ${b.bytes} / ${b.budget} B · ${b.pct} %`,
    ),
    section(
        'dead pointers: a path or `name` § section in an added line that does not land',
        dead,
        (d) => `${d.file}:${d.line} → \`${d.target}\` · ${d.why}`,
    ),
].join('\n');

if (values.out) writeFileSync(values.out, report);
else process.stdout.write(report);
