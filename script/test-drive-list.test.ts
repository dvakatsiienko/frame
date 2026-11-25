import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// the script resolves its root from its own location: a copy beside a fixture docs/test-drive never reads the live trials
let copy = '';

beforeAll(() => {
    const root = mkdtempSync(path.join(tmpdir(), 'test-drive-list-'));
    mkdirSync(path.join(root, 'script'));
    mkdirSync(path.join(root, 'docs/test-drive'), { recursive: true });
    cpSync(
        path.join(import.meta.dirname, 'test-drive-list.ts'),
        path.join(root, 'script/test-drive-list.ts'),
    );
    writeFileSync(
        path.join(root, 'docs/test-drive/fixture-trial.md'),
        '---\nstatus: live\nuntil: 2099-01-01\nkill-read: 2098-01-01\nfits: codie\n---\nright if\n',
    );
    copy = path.join(root, 'script/test-drive-list.ts');
});

const gate = (command: string) =>
    execFileSync('node', [copy, '--spawn-hook'], {
        encoding: 'utf8',
        input: JSON.stringify({ tool_input: { command } }),
        timeout: 10_000,
    });

const brief = '"/x:crew-codie FRM-1 do the job"';

describe('--spawn-hook', () => {
    it('denies the canonical shape', () => {
        expect(gate(`claude --bg ${brief}`)).toContain('fixture-trial');
    });

    it('allows a brief that names the trial', () => {
        expect(gate(`claude --bg "/x:crew-codie fixture-trial"`)).toBe('');
    });

    it('denies a changed flag order', () => {
        expect(gate(`claude -n 'x' --bg ${brief}`)).toContain('"deny"');
    });

    it('denies a double space before the flag', () => {
        expect(gate(`claude  --bg ${brief}`)).toContain('"deny"');
    });

    it('denies a cloud session', () => {
        expect(gate(`claude --cloud ${brief}`)).toContain('"deny"');
    });

    it('denies a spawn after a chain operator', () => {
        expect(gate(`cd /tmp && claude -n x --bg ${brief}`)).toContain(
            '"deny"',
        );
        expect(gate(`echo hi; claude --cloud ${brief}`)).toContain('"deny"');
    });

    it('ignores the argv quoted in a heredoc body', () => {
        const command = `cat > note.md <<'EOF'\nclaude --bg "/x:crew-codie FRM-1"\nEOF`;
        expect(gate(command)).toBe('');
    });

    it('ignores the argv as an argument to another program', () => {
        expect(gate(`echo 'claude --bg /x:crew-codie FRM-1'`)).toBe('');
        expect(gate(`printf "claude --cloud /x:crew-codie" | tee f`)).toBe('');
    });

    it('ignores a claude run with neither flag', () => {
        expect(gate(`claude -p "/x:crew-codie FRM-1"`)).toBe('');
    });
});

describe('--check', () => {
    beforeAll(() => {
        const root = path.dirname(path.dirname(copy));
        for (const dir of [
            'home/.claude/rules',
            'home/.claude/plugin-x/skills',
            '_clio/plugin-clio/skills',
            '_clio/memory',
            'recipes',
        ])
            mkdirSync(path.join(root, dir), { recursive: true });
        for (const file of ['home/.claude/CLAUDE.md', 'AGENTS.md'])
            writeFileSync(path.join(root, file), '');
    });

    const check = (head: string) => {
        const file = path.join(
            path.dirname(copy),
            '../docs/test-drive/fixture-kill.md',
        );
        writeFileSync(
            file,
            `---\nstatus: live\nuntil: 2099-01-01\n${head}---\nright if\n`,
        );
        return spawnSync('node', [copy, '--check'], {
            encoding: 'utf8',
            timeout: 10_000,
        }).stdout;
    };

    it('reds a trial with no kill-read date', () => {
        expect(check('')).toContain('fixture-kill: no kill-read date');
    });

    it('reds a date reached with nothing written after it', () => {
        expect(check('kill-read: 2020-01-01\n')).toContain(
            'was due a read on 2020-01-01',
        );
    });

    it('is calm on a read date with its result, and on a date ahead', () => {
        expect(
            check('kill-read: 2020-01-01 not fired, 1 of 2\n'),
        ).not.toContain('fixture-kill');
        expect(check('kill-read: 2098-01-01\n')).not.toContain('fixture-kill');
    });
});
