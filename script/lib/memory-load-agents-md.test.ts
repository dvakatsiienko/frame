import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const hooks = join(import.meta.dirname, '../../home/.claude/shelf/hooks');

// a home with frame/_clio as the session's project and frame/recipes beside it, each with its own AGENTS.md, and a
// nested apps/a folder inside the project with one of its own
function session() {
    const home = mkdtempSync(join(tmpdir(), 'agents-md-'));
    const project = join(home, 'frame/_clio');
    mkdirSync(project, { recursive: true });
    mkdirSync(join(home, 'frame/recipes'));
    writeFileSync(join(home, 'frame/AGENTS.md'), '# frame rules\n');
    writeFileSync(join(home, 'frame/recipes/AGENTS.md'), '# recipe rules\n');
    writeFileSync(join(home, 'frame/recipes/r.md'), 'a recipe\n');
    mkdirSync(join(project, 'apps/a'), { recursive: true });
    writeFileSync(join(project, 'AGENTS.md'), '# project rules\n');
    writeFileSync(join(project, 'apps/a/AGENTS.md'), '# nested rules\n');
    writeFileSync(join(project, 'apps/a/f.ts'), 'export {};\n');
    const id = randomUUID();
    const run = (hook: string, event: Record<string, unknown>) =>
        spawnSync('python3', [join(hooks, hook)], {
            encoding: 'utf8',
            env: { ...process.env, CLAUDE_PROJECT_DIR: project, HOME: home },
            input: JSON.stringify({ cwd: project, session_id: id, ...event }),
        }).stdout;
    const attached = (
        tool_name: string,
        tool_input: Record<string, string>,
    ) => {
        const out = run('memory-load-agents-md.py', {
            hook_event_name: 'PreToolUse',
            tool_input,
            tool_name,
        });
        return out ? JSON.parse(out).hookSpecificOutput.additionalContext : '';
    };
    const bash = (command: string): string => attached('Bash', { command });
    const read = (file: string): string =>
        attached('Read', { file_path: join(project, file) });
    // the reset is memory-load-rule-lazy's: on a compaction it empties every memory-load-* mark of the session
    const compact = () =>
        run('memory-load-rule-lazy.py', {
            hook_event_name: 'SessionStart',
            source: 'compact',
        });
    return { bash, compact, home, read };
}

it("a cat of a file outside the project attaches that folder's AGENTS.md", () => {
    const out = session().bash('cat ../recipes/r.md | head -5');
    expect([
        out.includes('# recipe rules'),
        out.includes('# frame rules'),
    ]).toEqual([true, false]);
});

it('a second cat in the same session attaches nothing', () => {
    const s = session();
    s.bash('cat ../recipes/r.md');
    expect(s.bash('cat ../recipes/r.md')).toBe('');
});

it('a cat after a compaction attaches the AGENTS.md again', () => {
    const s = session();
    s.bash('cat ../recipes/r.md');
    s.compact();
    expect(s.bash('cat ../recipes/r.md')).toContain('# recipe rules');
});

it('a command naming no path attaches nothing', () => {
    expect(session().bash('git status && echo done')).toBe('');
});

it('a lowercase agents.md is never loaded as AGENTS.md', () => {
    const s = session();
    const scraped = join(s.home, 'frame/scraped');
    mkdirSync(scraped);
    writeFileSync(join(scraped, 'agents.md'), '# scraped web text\n');
    writeFileSync(join(scraped, 'page.md'), 'a page\n');
    expect(s.bash(`cat ${join(scraped, 'page.md')}`)).toBe('');
});

it('an ls of a dir outside the project attaches its AGENTS.md', () => {
    expect(session().bash('ls -la ../recipes/')).toContain('# recipe rules');
});

it("a cat of a file inside the project attaches its nested folder's AGENTS.md, never the project's own", () => {
    const out = session().bash('cat apps/a/f.ts');
    expect([
        out.includes('# nested rules'),
        out.includes('# project rules'),
    ]).toEqual([true, false]);
});

it('a Read of a file inside the project attaches nothing, since cc loads it natively', () => {
    expect(session().read('apps/a/f.ts')).toBe('');
});
