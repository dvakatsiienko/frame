import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { gitEnv } from './git-fixture.ts';

const script = resolve(
    import.meta.dirname,
    '../../home/.claude/plugin-x/bin/ftr-gate',
);

const env = gitEnv();

const git = (repo: string, ...args: string[]) =>
    execFileSync(
        'git',
        [
            '-c',
            'user.name=fixture',
            '-c',
            'user.email=fixture@local',
            '-c',
            'commit.gpgsign=false',
            ...args,
        ],
        { cwd: repo, env, stdio: 'pipe' },
    );

const write = (repo: string, file: string, note = 'seed') => {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    writeFileSync(join(repo, file), `// ${file} ${note}\n`);
};

// commits `committed`, stages `staged`, runs the gate on `msg`; resolves to its exit status and its message
const gate = (committed: string[], staged: string[], msg = 'change\n') => {
    const repo = mkdtempSync(join(tmpdir(), 'ftr-gate-'));
    git(repo, 'init', '-q');
    for (const file of committed) write(repo, file);
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'seed');
    for (const file of staged) write(repo, file, 'staged');
    git(repo, 'add', '-A');
    const msgFile = join(repo, '.git', 'COMMIT_EDITMSG');
    writeFileSync(msgFile, msg);
    try {
        execFileSync('bash', [script, msgFile], {
            cwd: repo,
            env,
            stdio: 'pipe',
        });
        return { output: '', status: 0 };
    } catch (error) {
        const e = error as { status: number; stdout: Buffer };
        return { output: e.stdout.toString(), status: e.status };
    }
};

const gateStatus = (committed: string[], staged: string[]) =>
    gate(committed, staged).status;

const MOD_FILE = 'home/.claude/plugin-x/mods/m/hooks/a.ts';
const MOD_FTR = 'home/.claude/plugin-x/mods/m/FTR.md';

describe('ftr-gate', () => {
    it('refuses a staged mod file whose FTR.md is not staged', () => {
        expect(gateStatus([MOD_FTR], [MOD_FILE])).not.toBe(0);
    });

    it('passes a staged mod file together with its FTR.md', () => {
        expect(gateStatus([MOD_FTR], [MOD_FILE, MOD_FTR])).toBe(0);
    });

    it('names a bare line when «ftr: none» sits in a bullet', () => {
        expect(
            gate([MOD_FTR], [MOD_FILE], 'change\n\n- ftr: none\n').output,
        ).toContain('a bare line');
    });

    it('passes a staged file under .claude/worktrees', () => {
        expect(gateStatus([], ['.claude/worktrees/x/a.ts'])).toBe(0);
    });
});
