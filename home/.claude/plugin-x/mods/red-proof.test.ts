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

    it('returns the bytes when each swapped run crashes', () => {
        const { copy, file, pairs } = fixture();
        const r = spawnSync(
            BIN,
            [
                '--cmd',
                '--pairs',
                pairs,
                file,
                '--',
                'sh',
                '-c',
                `cmp -s ${file} ${copy} || kill -9 $$`,
            ],
            { encoding: 'utf8' },
        );
        expect([r.status, r.stdout.match(/^RED/gm)?.length]).toEqual([0, 2]);
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
        const until = Date.now() + 12_000;
        while (readFileSync(file, 'utf8') === ORIGINAL && Date.now() < until)
            await new Promise((r) => setTimeout(r, 20));
        expect(readFileSync(file, 'utf8')).not.toBe(ORIGINAL);
        child.kill('SIGTERM');
        await closed;
        expect(readFileSync(file, 'utf8')).toBe(ORIGINAL);
    }, 30_000);

    // a swap that breaks the module's load fails every test whatever it reads, so it proves nothing: named apart from a red
    it('names a swap that broke the load, and fails, instead of counting it red', () => {
        const { file, pairs } = fixture();
        const r = spawnSync(
            BIN,
            [
                '--cmd',
                '--pairs',
                pairs,
                file,
                '--',
                'sh',
                '-c',
                `grep -q 'const b = 2;' ${file} || { echo 'SyntaxError: Unexpected token' >&2; exit 1; }`,
            ],
            { encoding: 'utf8' },
        );
        expect([r.status, r.stdout.match(/did not load/g)?.length]).toEqual([
            1, 1,
        ]);
    });
});

describe('red-proof on a base already red', () => {
    const redBase = (say: string) => {
        const { file, pairs } = fixture();
        const seen = `${file}.seen`;
        const r = spawnSync(
            BIN,
            [
                '--cmd',
                '--pairs',
                pairs,
                file,
                '--',
                'sh',
                '-c',
                `cat ${file} >> ${seen}; ${say}; exit 1`,
            ],
            { encoding: 'utf8' },
        );
        return { r, seen: readFileSync(seen, 'utf8') };
    };

    it('runs the command once, on the unmutated file', () => {
        const { seen } = redBase('true');
        expect(seen).toBe(ORIGINAL);
    });

    it('prints what failed in a plugin test', () => {
        const { r } = redBase(
            `echo '(pass) a green row'; echo '(fail) row one [12.50ms]'; echo '(fail) row two'`,
        );
        expect([r.status, r.stderr]).toEqual([
            1,
            'red-proof: the base is already red, nothing swapped: 2 failed\n  row one\n  row two\n',
        ]);
    });

    it('prints the failed names of a go test', () => {
        const { r } = redBase(`echo '--- FAIL: TestOne (0.00s)'`);
        expect(r.stderr).toContain('1 failed\n  TestOne\n');
    });

    it('prints the failed names of a vitest run once each', () => {
        const { r } = redBase(
            `echo ' × a.test.ts > one 5ms'; echo ' FAIL  a.test.ts > one'`,
        );
        expect(r.stderr).toContain('1 failed\n  a.test.ts > one\n');
    });

    it('prints the end of a red run that names no test', () => {
        const { r } = redBase(`echo 'SyntaxError: nope'`);
        expect(r.stderr).toContain('no failed name read');
        expect(r.stderr).toContain('SyntaxError: nope');
    });
});
