import { spawnSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { tailsOf } from './tails-check.ts';

const script = join(import.meta.dirname, 'tails-check.ts');
let dir = '';

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tails-'));
});
afterEach(() => rmSync(dir, { force: true, recursive: true }));

function day(date: string, text: string) {
    writeFileSync(join(dir, `${date}.md`), text);
}

function run(...args: string[]) {
    const out = spawnSync(process.execPath, [script, ...args], {
        encoding: 'utf8',
        env: {
            ...process.env,
            CLIO_TAILS_DIR: dir,
            CLIO_TAILS_TODAY: '2026-11-16',
        },
    });
    return { code: out.status, err: out.stderr, out: out.stdout };
}

describe('tailsOf', () => {
    test('an open line is owed', () => {
        expect(tailsOf('- [ ] call the bank')).toEqual([
            { line: 1, state: 'owed', text: 'call the bank' },
        ]);
    });

    test('an open line with the kept marker is kept', () => {
        expect(tailsOf('- [ ] x — kept: dima 2026-11-16 for later')).toEqual([
            {
                line: 1,
                state: 'kept',
                text: 'x — kept: dima 2026-11-16 for later',
            },
        ]);
    });

    test('a kept marker without a date is still owed', () => {
        expect(tailsOf('- [ ] x — kept: dima')[0]?.state).toBe('owed');
    });

    test('a ticked line is done', () => {
        expect(tailsOf('- [x] sent it')[0]?.state).toBe('done');
    });

    test('an indented line under a heading counts, other lines do not', () => {
        const found = tailsOf('# day\nprose\n  - [ ] nested\n- plain bullet');
        expect(found).toEqual([{ line: 3, state: 'owed', text: 'nested' }]);
    });
});

describe('cli', () => {
    test('one owed tail exits 1 and prints it', () => {
        day('2026-11-16', '- [ ] water plants\n');
        const { code, out } = run();
        expect(code).toBe(1);
        expect(out).toContain('🔴 2026-11-16 · water plants');
        expect(out).toContain('tails: 1 owed, 0 kept, 0 done, 1 files');
    });

    test('the kept marker turns it green', () => {
        day('2026-11-16', '- [ ] water plants — kept: dima 2026-11-16\n');
        const { code, out } = run();
        expect(code).toBe(0);
        expect(out).toContain(
            '🟢 tails: nothing owed (1 kept, 0 done, 1 files)',
        );
    });

    test('an older day still owes', () => {
        day('2026-11-10', '- [ ] old debt\n');
        day('2026-11-16', '- [x] fine\n');
        const { code, out } = run('--json');
        expect(code).toBe(1);
        expect(JSON.parse(out)).toEqual({
            done: 1,
            files: 2,
            kept: 0,
            owed: [{ date: '2026-11-10', line: 1, text: 'old debt' }],
        });
    });

    test('a missing directory is green with no files', () => {
        rmSync(dir, { recursive: true });
        const { code, out } = run();
        expect(code).toBe(0);
        expect(out).toContain('0 files');
    });

    test('--add then --done round-trips to green', () => {
        const added = run('--add', 'file the form');
        expect(added.code).toBe(0);
        expect(added.out.trim()).toBe(join(dir, '2026-11-16.md'));
        expect(run().code).toBe(1);
        expect(run('--done', 'file the').code).toBe(0);
        expect(readFileSync(join(dir, '2026-11-16.md'), 'utf8')).toBe(
            '- [x] (done 2026-11-16) file the form\n',
        );
        expect(run().code).toBe(0);
        expect(readdirSync(dir)).toEqual(['2026-11-16.md']);
    });

    test('--done with two matches exits 2 and changes nothing', () => {
        const text = '- [ ] call anna\n- [ ] call boris\n';
        day('2026-11-16', text);
        const { code, err } = run('--done', 'call');
        expect(code).toBe(2);
        expect(err).toContain('2 open lines');
        expect(readFileSync(join(dir, '2026-11-16.md'), 'utf8')).toBe(text);
    });

    test('--add refuses empty text and a newline', () => {
        expect(run('--add', '').code).toBe(2);
        expect(run('--add', 'a\nb').code).toBe(2);
        expect(readdirSync(dir)).toEqual([]);
    });
});
