import { execFileSync } from 'node:child_process';
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
        '---\nstatus: live\nuntil: 2099-01-01\nfits: codie\n---\nright if\n',
    );
    copy = path.join(root, 'script/test-drive-list.ts');
});

const gate = (command: string) =>
    execFileSync('node', [copy, '--spawn-hook'], {
        encoding: 'utf8',
        input: JSON.stringify({ tool_input: { command } }),
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
