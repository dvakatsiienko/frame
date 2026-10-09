import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(
    import.meta.dirname,
    '../../home/.claude/plugin-x/bin/crew-dna-cloud',
);
const dnaFile = resolve(
    import.meta.dirname,
    '../../home/.claude/plugin-x/skills/crew-dna/SKILL.md',
);

const print = (file?: string) =>
    execFileSync(script, file ? [file] : [], { encoding: 'utf8' });

const fixture = (text: string) => {
    const file = join(mkdtempSync(join(tmpdir(), 'crew-dna-')), 'SKILL.md');
    writeFileSync(file, text);
    return file;
};

describe('crew-dna-cloud', () => {
    it('drops the frontmatter', () => {
        expect(print(fixture('---\nname: x\n---\n\n# dna\n'))).toBe('# dna\n');
    });

    it('drops a tagged bullet with its indented continuation', () => {
        const text =
            '- keep\n- mac only <!-- mac -->\n  still mac\n- keep too\n';
        expect(print(fixture(text))).toBe('- keep\n- keep too\n');
    });

    it('drops a tagged paragraph with its block up to the blank line', () => {
        const text =
            '**retro**: a file <!-- mac -->\n- its rule\n\n**voice**: plain\n';
        expect(print(fixture(text))).toBe('\n**voice**: plain\n');
    });

    it('answers an unreadable file with exit 2', () => {
        expect(() => print('/nonexistent/SKILL.md')).toThrow(
            /exit|status 2|Command failed/,
        );
    });

    it('prints the real dna as its own lines, unaltered and in order, with no tag left', () => {
        const out = print();
        expect(out).not.toContain('<!-- mac -->');
        expect(out).toContain('## coder · verifier — the pr pair');
        const source = readFileSync(dnaFile, 'utf8').split('\n');
        let cursor = 0;
        for (const line of out.split('\n')) {
            cursor = source.indexOf(line, cursor);
            expect(cursor, line).toBeGreaterThanOrEqual(0);
        }
    });
});
