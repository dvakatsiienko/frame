// pre-commit in frame and bytes: a staged line naming a retired fleet form reds the commit; every hit is logged
// so the guard can retire itself after 14 green days (the 10-29 rename sweep, spec o66)
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { addedLines } from './lib/fleet-hazards-check.ts';
import { retiredForms, retiredHits } from './lib/retired-names.ts';

const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 26 });

const repo = git('rev-parse', '--show-toplevel').trim();
// --all surveys every tracked line (the sweep's exit line); the hook reads only what a commit adds
const isSurvey = process.argv.includes('--all');

const stagedHits = () =>
    git('diff', '--cached', '--name-only', '--diff-filter=AMR')
        .split('\n')
        .filter(Boolean)
        .flatMap((path) => {
            const diff = git(
                'diff',
                '--cached',
                '-U0',
                '--no-color',
                '--',
                path,
            );
            if (!diff || diff.includes('\nBinary files ')) return [];
            const lines = git('show', `:${path}`).split('\n');
            const added = [...addedLines(diff)].map((line) => ({
                line,
                text: lines[line - 1] ?? '',
            }));
            return retiredHits(path, added, lines);
        });

const treeHits = () => {
    const pattern = retiredForms
        .map((form) => form.replace(/[-:]/g, '\\$&'))
        .join('|');
    let found = '';
    try {
        found = git(
            '-c',
            'core.quotePath=false',
            'grep',
            '-I',
            '-n',
            '-i',
            '-E',
            pattern,
        );
    } catch {
        return [];
    }
    const byPath = new Map<string, { line: number; text: string }[]>();
    for (const row of found.split('\n').filter(Boolean)) {
        const [, path = '', line = '0', text = ''] =
            row.match(/^([^:]+):(\d+):(.*)$/) ?? [];
        byPath.set(path, [
            ...(byPath.get(path) ?? []),
            { line: Number(line), text },
        ]);
    }
    return [...byPath].flatMap(([path, lines]) =>
        retiredHits(
            path,
            lines,
            readFileSync(join(repo, path), 'utf8').split('\n'),
        ),
    );
};

const hits = isSurvey ? treeHits() : stagedHits();

if (hits.length) {
    if (!isSurvey) {
        const stateDir =
            process.env.X_STATE ?? join(homedir(), '.local/state/x');
        mkdirSync(stateDir, { recursive: true });
        const stamp = new Date().toISOString();
        appendFileSync(
            join(stateDir, 'retired-names.log'),
            hits
                .map(
                    ({ path, line, form }) =>
                        `${stamp} ${repo} ${path}:${line} ${form}\n`,
                )
                .join(''),
        );
    }
    for (const { path, line, form, text } of hits) {
        console.error(
            `${path}:${line} — «${form}» is a retired name\n  ${text.trim().slice(0, 120)}`,
        );
    }
    console.error(
        'retired-names: write the new name (clio, crow, cc, crew-codie, crew-sixth-sense, x-cloud-chat, x-codie-cc, x-clio-cc, sync: cloud-chat); a line that reads history on purpose carries `read-both`',
    );
    process.exit(1);
}
