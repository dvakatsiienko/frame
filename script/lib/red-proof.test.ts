import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const redProof = resolve(
    import.meta.dirname,
    '../../home/.claude/plugin-x/bin/red-proof',
);

describe('red-proof --pairs', () => {
    it('takes an anchor that starts with a tab, as go code is indented', () => {
        const dir = mkdtempSync(join(tmpdir(), 'red-proof-'));
        const file = join(dir, 'main.go');
        const pairs = join(dir, 'pairs.tsv');
        writeFileSync(file, 'func f() {\n\t\tcase x:\n}\n');
        writeFileSync(pairs, '\t\tcase x:\tcase y:\n');

        const run = spawnSync(
            redProof,
            [
                '--cmd',
                '--pairs',
                pairs,
                file,
                '--',
                'grep',
                '-q',
                'case x:',
                file,
            ],
            {
                encoding: 'utf8',
            },
        );

        expect(run.stderr).toBe('');
        expect(run.stdout).toContain('RED   «\t\tcase x:»');
        expect(run.status).toBe(0);
    });
});
