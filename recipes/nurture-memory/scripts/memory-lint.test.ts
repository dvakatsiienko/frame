/* Core */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* Instruments */
import { gitEnv } from '../../../script/lib/git-fixture.ts';

const LINT = join(import.meta.dirname, 'memory-lint.ts');
const LEAF = 'cclio/memory/leaf.md';
const BUDGETS = 'recipes/nurture-memory/scripts/memory-budgets.tsv';
// a hook run exports GIT_INDEX_FILE and friends; without this the fixture writes the real index
const env = gitEnv();

// a throwaway repo with one memory leaf and its budget row, committed
function repo(leaf: string, budget: number) {
    const dir = mkdtempSync(join(tmpdir(), 'memory-lint-'));
    const git = (...args: string[]) =>
        execFileSync('git', args, { cwd: dir, env, stdio: 'ignore' });
    git('init', '-q');
    mkdirSync(join(dir, 'cclio/memory'), { recursive: true });
    mkdirSync(join(dir, 'recipes/nurture-memory/scripts'), { recursive: true });
    writeFileSync(join(dir, LEAF), leaf);
    writeFileSync(join(dir, BUDGETS), `${LEAF}\t${budget}\tseed\n`);
    git('add', '-A');
    git('commit', '-qm', 'seed');
    const stage = (path: string, text: string) => {
        writeFileSync(join(dir, path), text);
        git('add', path);
    };
    const lint = (...files: string[]) =>
        spawnSync('node', [LINT, ...(files.length ? files : [LEAF])], {
            cwd: dir,
            encoding: 'utf8',
            env,
        });
    const seed = () =>
        spawnSync('node', [LINT, '--seed'], {
            cwd: dir,
            encoding: 'utf8',
            env,
        });
    const read = (path: string) => readFileSync(join(dir, path), 'utf8');
    const drop = (path: string) => git('rm', '-q', path);
    return { drop, lint, read, seed, stage };
}

describe('memory-lint', () => {
    it('passes a leaf under its budget', () => {
        expect(repo('- one line\n', 100).lint().status).toBe(0);
    });

    it('asks for a regroom when a leaf passes its budget', () => {
        const r = repo('- one line\n', 20);
        r.stage(LEAF, '- one line\n- a second line that pushes it over\n');
        const out = r.lint();
        expect(out.status).toBe(1);
        expect(out.stderr).toContain('regroom it first');
    });

    it('lets a raise with its reason through, in the same commit', () => {
        const r = repo('- one line\n', 20);
        r.stage(LEAF, '- one line\n- a second line that pushes it over\n');
        r.stage(
            BUDGETS,
            `${LEAF}\t200\tthe second line carries dima's new rule\n`,
        );
        expect(r.lint().status).toBe(0);
    });

    it('refuses a raise that keeps the old reason', () => {
        const r = repo('- one line\n', 20);
        r.stage(LEAF, '- one line\n- a second line that pushes it over\n');
        r.stage(BUDGETS, `${LEAF}\t200\tseed\n`);
        expect(r.lint().stderr).toContain('name why this add earned it');
    });

    it('catches two bullets merged on one line', () => {
        const r = repo('- one line\n', 500);
        r.stage(LEAF, '- one fact- second bullet\n');
        expect(r.lint().stderr).toContain('two bullets merged');
    });

    it('stops a new memory file that has no budget row', () => {
        const r = repo('- one line\n', 500);
        r.stage('cclio/memory/new-leaf.md', '- a new leaf\n');
        expect(r.lint('cclio/memory/new-leaf.md').stderr).toContain(
            'no budget row',
        );
    });

    it('stops a row whose file is gone', () => {
        const r = repo('- one line\n', 500);
        r.drop(LEAF);
        expect(r.lint().stderr).toContain('gone or renamed');
    });

    it('seeds only the missing rows and keeps a raise', () => {
        const r = repo('- one line\n', 500);
        r.stage(BUDGETS, `${LEAF}\t900\ta raise with its reason\n`);
        r.stage('cclio/memory/new-leaf.md', '- a new leaf\n');
        r.seed();
        expect(r.read(BUDGETS)).toContain(
            `${LEAF}\t900\ta raise with its reason`,
        );
        expect(r.read(BUDGETS)).toContain('cclio/memory/new-leaf.md');
    });
});
