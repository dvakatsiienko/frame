import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// FRM-470: `red-proof --cmd --pairs … -- pnpm mods:test <mod>` is the mods' shared mutate helper (named anchors, one swap each,
// run, restore); these tests hold what a mods run relies on: the file's bytes come back whatever the run does
const BIN = join(import.meta.dirname, '../bin/red-proof');
const ORIGINAL = 'const a = 1;\nconst b = 2;\n';

function fixture() {
    const dir = mkdtempSync(join(tmpdir(), 'red-proof-'));
    const file = join(dir, 'src.ts');
    writeFileSync(file, ORIGINAL);
    const pairs = join(dir, 'pairs.txt');
    writeFileSync(
        pairs,
        'const b = 2;\tconst b = 99;\nconst a = 1;\tconst a = 7;\n',
    );
    // a second copy of the original: `cmp` against it passes only while the file is unmutated
    const copy = join(dir, 'copy.ts');
    writeFileSync(copy, ORIGINAL);
    return { copy, file, pairs };
}

describe('red-proof --cmd --pairs', () => {
    const run = () => {
        const { copy, file, pairs } = fixture();
        const r = spawnSync(
            BIN,
            ['--cmd', '--pairs', pairs, file, '--', 'cmp', '-s', file, copy],
            { encoding: 'utf8' },
        );
        return { file, r };
    };

    it('goes red on each named swap and green on the restored file', () => {
        const { r } = run();
        expect(r.status).toBe(0);
        expect(r.stdout.match(/^RED/gm)).toHaveLength(2);
        expect(r.stdout).toContain('GREEN restored');
    });

    it('returns the bytes after the swaps', () => {
        const { file } = run();
        expect(readFileSync(file, 'utf8')).toBe(ORIGINAL);
    });

    it('returns the bytes when the run crashes every time', () => {
        const { file, pairs } = fixture();
        const r = spawnSync(
            BIN,
            ['--cmd', '--pairs', pairs, file, '--', 'sh', '-c', 'kill -9 $$'],
            { encoding: 'utf8' },
        );
        expect(r.status).toBe(1);
        expect(readFileSync(file, 'utf8')).toBe(ORIGINAL);
    });

    it('returns the bytes when red-proof itself is killed mid-run', async () => {
        const { file, pairs } = fixture();
        const child = spawn(
            BIN,
            ['--cmd', '--pairs', pairs, file, '--', 'sleep', '2'],
            { stdio: 'ignore' },
        );
        const closed = new Promise((done) => child.on('close', done));
        const until = Date.now() + 5000;
        while (readFileSync(file, 'utf8') === ORIGINAL && Date.now() < until)
            await new Promise((r) => setTimeout(r, 20));
        expect(readFileSync(file, 'utf8')).not.toBe(ORIGINAL);
        child.kill('SIGTERM');
        await closed;
        expect(readFileSync(file, 'utf8')).toBe(ORIGINAL);
    }, 15_000);
});
