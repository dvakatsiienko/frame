import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { parseThreadTabArgs } from './thread-tab.ts';

describe('parseThreadTabArgs', () => {
    it('takes a terminal and a name', () => {
        expect(parseThreadTabArgs(['t7b', '⚡ 🐕 stray | chores'])).toEqual({
            name: '⚡ 🐕 stray | chores',
            terminal: 't7b',
        });
    });

    it.each([
        [[]],
        [['t7b']],
        [['t7b', '']],
        [['', 'name']],
        [['t7b', 'name', 'extra']],
    ])('refuses %j', (argv) => {
        expect(parseThreadTabArgs(argv)).toBeNull();
    });
});

describe('thread-tab.ts as a command', () => {
    const file = fileURLToPath(new URL('./thread-tab.ts', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'thread-tab-'));
    const calls = join(dir, 'calls');
    writeFileSync(
        join(dir, 'herdr-app'),
        `#!/bin/sh
echo "$@" >> "${calls}"
case "$1" in
    status) echo '{"tab":"tbwas"}' ;;
    do) case "$2" in
        terminal.keep) [ "$STUB_KEEP" = fail ] && exit 1; echo '{"tab":"tbnew"}' ;;
        *) echo '{}' ;;
    esac ;;
esac
`,
        { mode: 0o755 },
    );
    const run = (args: string[], keep = 'ok') =>
        spawnSync(process.execPath, args, {
            encoding: 'utf8',
            env: {
                ...process.env,
                PATH: `${dir}:${process.env.PATH}`,
                STUB_KEEP: keep,
            },
            timeout: 10_000,
        });
    afterAll(() => rmSync(dir, { force: true, recursive: true }));

    it('prints the tab id and exits 0', () => {
        const done = run([file, 't7b', 'a name']);
        expect(done.status).toBe(0);
        expect(done.stdout.trim()).toBe('tbnew');
    });

    it('exits 1 with one line when no tab came back', () => {
        const done = run([file, 't7b', 'a name'], 'fail');
        expect(done.status).toBe(1);
        expect(done.stderr.trim().split('\n')).toHaveLength(1);
        expect(done.stdout).toBe('');
    });

    it('exits 2 with the usage on bad arguments', () => {
        const done = run([file, 't7b']);
        expect(done.status).toBe(2);
        expect(done.stderr).toContain('usage');
    });

    it('runs nothing when imported, extra arguments included', () => {
        rmSync(calls, { force: true });
        const done = run([
            '--input-type=module',
            '-e',
            `await import(${JSON.stringify(file)}); console.log('imported')`,
            'extra',
        ]);
        expect(done.status).toBe(0);
        expect(done.stdout.trim()).toBe('imported');
        expect(existsSync(calls)).toBe(false);
    });
});
