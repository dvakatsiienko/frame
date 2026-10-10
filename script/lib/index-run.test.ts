import { execFileSync, spawnSync } from 'node:child_process';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

import { gitEnv } from './git-fixture.ts';

const root = resolve(import.meta.dirname, '../..');
const env = gitEnv();

// the typecheck job's run line, read from frame's lefthook.yaml as the hook runs it
function hookLine(job: string) {
    const lefthook = readFileSync(join(root, 'lefthook.yaml'), 'utf8');
    const line = new RegExp(
        `\\n    ${job}:\\n(?:      #.*\\n)*      run: (.+)\\n`,
    ).exec(lefthook)?.[1];
    if (!line)
        throw new Error(`no pre-commit ${job} run line in lefthook.yaml`);
    return line;
}

test("the hook's typecheck passes a commit while a peer's unstaged edit is broken", () => {
    const repo = mkdtempSync(join(tmpdir(), 'index-run-'));
    mkdirSync(join(repo, 'script'));
    copyFileSync(
        join(root, 'script/index-run.sh'),
        join(repo, 'script/index-run.sh'),
    );
    writeFileSync(join(repo, 'pnpm-workspace.yaml'), 'packages: []\n');
    writeFileSync(
        join(repo, 'package.json'),
        JSON.stringify({
            name: 'fixture',
            private: true,
            scripts: { typecheck: '! grep -q BROKEN peer.ts' },
        }),
    );
    writeFileSync(join(repo, 'peer.ts'), 'export const ok = 1;\n');
    execFileSync('git', ['init', '-q'], { cwd: repo, env });
    execFileSync('git', ['add', '-A'], { cwd: repo, env });
    execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: repo, env });
    writeFileSync(
        join(repo, 'peer.ts'),
        'export const ok: number = "BROKEN";\n',
    );

    const run = spawnSync('sh', ['-c', hookLine('typecheck')], {
        cwd: repo,
        encoding: 'utf8',
        env,
    });

    expect(run.status, run.stdout + run.stderr).toBe(0);
});
