import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { applyBatch, parseBatch } from './edit-batch.ts';

const bin = join(
    import.meta.dirname,
    '../../home/.claude/plugin-x/bin/edit-batch',
);

describe('parseBatch', () => {
    it('reads multi-line anchors and replacements with a $ and quotes intact', () => {
        const batch = parseBatch(
            '@@@ a.ts\n@@ anchor\nconst a = "x";\nconst b = 1;\n@@ replacement\nconst a = `${x}`;\n',
        );

        expect(batch.edits).toEqual([
            {
                anchor: 'const a = "x";\nconst b = 1;',
                file: 'a.ts',
                replacement: 'const a = `${x}`;',
            },
        ]);
    });

    it('refuses an edit without a replacement', () => {
        expect(parseBatch('@@@ a.ts\n@@ anchor\nx\n').error).toMatch(
            /needs both/,
        );
    });
});

describe('applyBatch', () => {
    it('applies edits to one file in order, each on the text the last one left', () => {
        const files: Record<string, string> = { 'a.ts': 'one\ntwo\n' };
        const applied = applyBatch(
            [
                { anchor: 'one', file: 'a.ts', replacement: 'ONE' },
                { anchor: 'ONE\ntwo', file: 'a.ts', replacement: 'ONE\nTWO' },
            ],
            (file) => files[file] ?? '',
        );

        expect(applied.texts.get('a.ts')).toBe('ONE\nTWO\n');
    });
});

describe('edit-batch cli', () => {
    it('writes nothing when any anchor misses', () => {
        const dir = mkdtempSync(join(tmpdir(), 'edit-batch-'));
        writeFileSync(join(dir, 'a.txt'), 'alpha\n');
        writeFileSync(join(dir, 'b.txt'), 'beta\n');
        writeFileSync(
            join(dir, 'batch'),
            `@@@ ${join(dir, 'a.txt')}\n@@ anchor\nalpha\n@@ replacement\nALPHA\n@@@ ${join(dir, 'b.txt')}\n@@ anchor\ngamma\n@@ replacement\nGAMMA\n`,
        );

        expect(() =>
            execFileSync(bin, [join(dir, 'batch')], { stdio: 'pipe' }),
        ).toThrow();
        expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('alpha\n');
    });

    it('prints one file:line per edit when every anchor matches', () => {
        const dir = mkdtempSync(join(tmpdir(), 'edit-batch-'));
        writeFileSync(join(dir, 'a.txt'), 'x\nalpha\n');
        writeFileSync(
            join(dir, 'batch'),
            `@@@ ${join(dir, 'a.txt')}\n@@ anchor\nalpha\n@@ replacement\nALPHA\n`,
        );

        const out = execFileSync(bin, [join(dir, 'batch')], {
            encoding: 'utf8',
        });

        expect(out.trim()).toBe(`${join(dir, 'a.txt')}:2`);
        expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('x\nALPHA\n');
    });
});
