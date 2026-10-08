/* Core */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
// what ubuntu-latest ships before any step runs
const runnerBinaries = ['bash', 'git', 'python3', 'sh'];
// sees a binary a test names as a literal; one the code under test execs, or one passed in a
// variable, stays the test author's to install
const execCall: Record<string, RegExp> = {
    go: /exec\.(?:Command\(|CommandContext\(\w+,\s*)"([\w.+-]+)"/g,
    ts: /\b(?:spawnSync|spawn|execFileSync|execFile|execSync)\(\s*['"`]([\w.+-]+)/g,
};

function jobBinaries(ci: string) {
    const jobs = new Map<string, Set<string>>();
    const body = ci.slice(ci.indexOf('\njobs:\n'));
    for (const block of body.split(/\n(?=  [\w-]+:\n)/).slice(1)) {
        const name = block.match(/^ {2}([\w-]+):/)?.[1] ?? '';
        const installed = new Set(runnerBinaries);
        for (const line of block.matchAll(/apt-get install ([^\n]+)/g)) {
            for (const word of line[1]?.split(/\s+/) ?? [])
                if (!word.startsWith('-')) installed.add(word);
        }
        if (block.includes('actions/setup-go')) installed.add('go');
        if (block.includes('actions/setup-node')) {
            installed.add('node');
            installed.add('npx');
        }
        if (block.includes('pnpm/action-setup')) installed.add('pnpm');
        jobs.set(name, installed);
    }
    return jobs;
}

test('every binary a test execs is installed by the ci job that runs it', () => {
    const jobs = jobBinaries(
        readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8'),
    );
    const files = spawnSync('git', ['ls-files', '*.test.ts', '*_test.go'], {
        cwd: root,
        encoding: 'utf8',
    }).stdout.split('\n');

    const missing = files.filter(Boolean).flatMap((file) => {
        const job = file.startsWith('x/go/') ? 'x' : 'check';
        const kind = file.endsWith('.go') ? 'go' : 'ts';
        const text = readFileSync(path.join(root, file), 'utf8');
        return [...text.matchAll(execCall[kind] as RegExp)]
            .map((call) => call[1] ?? '')
            .filter((bin) => !jobs.get(job)?.has(bin))
            .map((bin) => `${bin} (${file}, job ${job})`);
    });

    expect([...new Set(missing)], 'binaries ci.yml never installs').toEqual([]);
});
