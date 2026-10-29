/* Core */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* Instruments */
import { gitEnv } from '../../../script/lib/git-fixture.ts';

const LINT = join(import.meta.dirname, 'memory-lint.ts');
const LEAF = '_clio/memory/leaf.md';
const BUDGETS = 'recipes/nurture-memory/scripts/memory-budgets.tsv';
// a hook run exports GIT_INDEX_FILE and friends; without this the fixture writes the real index
const env = gitEnv();

// a throwaway repo with one memory leaf and its budget row, committed
function repo(leaf: string, budget: number) {
    const dir = mkdtempSync(join(tmpdir(), 'memory-lint-'));
    const git = (...args: string[]) =>
        execFileSync('git', args, { cwd: dir, env, stdio: 'ignore' });
    git('init', '-q');
    mkdirSync(join(dir, '_clio/memory'), { recursive: true });
    mkdirSync(join(dir, 'recipes/nurture-memory/scripts'), { recursive: true });
    writeFileSync(join(dir, LEAF), leaf);
    writeFileSync(join(dir, BUDGETS), `${LEAF}\t${budget}\tseed\n`);
    git('add', '-A');
    git('commit', '-qm', 'seed');
    const stage = (path: string, text: string) => {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text);
        git('add', path);
    };
    // the ticket lookup is a fixture file, never `x linear read`
    const runEnv = { ...env, MEMORY_LINT_STATES: join(dir, 'states.json') };
    const states = (table: Record<string, string>) =>
        writeFileSync(runEnv.MEMORY_LINT_STATES, JSON.stringify(table));
    states({});
    const lint = (...files: string[]) =>
        spawnSync('node', [LINT, ...(files.length ? files : [LEAF])], {
            cwd: dir,
            encoding: 'utf8',
            env: runEnv,
        });
    const seed = () =>
        spawnSync('node', [LINT, '--seed'], {
            cwd: dir,
            encoding: 'utf8',
            env,
        });
    const read = (path: string) => readFileSync(join(dir, path), 'utf8');
    const drop = (path: string) => git('rm', '-q', path);
    return { drop, lint, read, seed, stage, states };
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

    it('warns on a backticked repo path that is not on disk, naming file:line, and still passes', () => {
        const r = repo('- one line\n', 500);
        r.stage(LEAF, '- one line\n- see `_clio/memory/gone.md` for it\n');
        const out = r.lint();
        expect(out.status).toBe(0);
        expect(out.stdout + out.stderr).toContain(
            `${LEAF}:2: \`_clio/memory/gone.md\``,
        );
    });

    it('resolves a backticked path from the file own folder', () => {
        const r = repo('- one line\n', 500);
        r.stage('_clio/memory/recipes/near.md', 'x\n');
        r.stage(LEAF, '- one line\n- see `recipes/near.md` beside it\n');
        const out = r.lint();
        expect(out.stdout + out.stderr).not.toContain('not on disk');
    });

    it('passes a backticked path that exists, and one outside the path shape', () => {
        const r = repo('- one line\n', 500);
        r.stage(
            LEAF,
            '- see `_clio/memory/leaf.md:1`, `_clio/memory/<name>.md`, `_clio/*.md`, `a/b`, `not/real.md` and `_clio/memory/x y`\n',
        );
        expect(r.lint().status).toBe(0);
    });

    it('warns, never fails, on a quote of his gone from the staged file', () => {
        const r = repo('- he said «never fold this» once\n', 500);
        r.stage(LEAF, '- he said something else once\n');
        const out = r.lint();
        expect(out.status).toBe(0);
        expect(out.stderr).toContain('⚠');
        expect(out.stderr).toContain('«never fold this»');
    });

    it('stays silent on a quote that moved lines but is still there', () => {
        const r = repo('- he said «never fold this» once\n', 500);
        r.stage(LEAF, '- a new line\n- he said «never   fold\nthis» once\n');
        expect(r.lint().stderr).toBe('');
    });

    it('warns with both locations on a 12+ word sentence in two files', () => {
        const other = '_clio/memory/other.md';
        const sentence =
            'the quick brown fox jumps over the lazy dog while the cat watches them closely.';
        const r = repo(`- ${sentence}\n`, 500);
        r.stage(other, `- ${sentence}\n`);
        expect(r.lint(other).stderr).toContain(
            `⚠ the same sentence in two files: ${LEAF}:1 and ${other}:1`,
        );
    });

    it('stays silent on a short sentence in two files', () => {
        const r = repo('- a short repeated line here.\n', 500);
        r.stage('_clio/memory/other.md', '- a short repeated line here.\n');
        expect(r.lint('_clio/memory/other.md').stderr).not.toContain('⚠');
    });

    it('warns, never fails, on a closed ticket beside «waiting on»', () => {
        const r = repo('- one line\n', 500);
        r.states({ 'FRM-219': 'completed' });
        r.stage(LEAF, '- one line\n- waiting on FRM-219\n');
        const out = r.lint();
        expect(out.status).toBe(0);
        expect(out.stderr).toContain(`⚠ ${LEAF}:2: FRM-219 is closed`);
    });

    it('stays silent on an open ticket beside «waiting on»', () => {
        const r = repo('- one line\n', 500);
        r.states({ 'FRM-219': 'unstarted' });
        r.stage(LEAF, '- one line\n- waiting on FRM-219\n');
        expect(r.lint().stderr).toBe('');
    });

    it('stays silent on a closed ticket with no open-state word within 2 lines', () => {
        const r = repo('- one line\n', 500);
        r.states({ 'FRM-219': 'completed' });
        r.stage(LEAF, '- waiting on it\n- b\n- c\n- shipped in FRM-219\n');
        expect(r.lint().stderr).toBe('');
    });

    it('stops a new memory file that has no budget row', () => {
        const r = repo('- one line\n', 500);
        r.stage('_clio/memory/new-leaf.md', '- a new leaf\n');
        expect(r.lint('_clio/memory/new-leaf.md').stderr).toContain(
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
        r.stage('_clio/memory/new-leaf.md', '- a new leaf\n');
        r.seed();
        expect(r.read(BUDGETS)).toContain(
            `${LEAF}\t900\ta raise with its reason`,
        );
        expect(r.read(BUDGETS)).toContain('_clio/memory/new-leaf.md');
    });
});
