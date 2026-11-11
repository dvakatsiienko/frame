import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = join(import.meta.dirname, 'surface-mirror-check.ts');
const headings = [
    'threads',
    'the screen he reads',
    'presses and asks',
    'files and links to him',
    'browser',
    'traps',
];

function check(herdr: string[], desktop: string[] | null) {
    const root = mkdtempSync(join(tmpdir(), 'surface-mirror-'));
    const memory = join(root, '_clio/memory');
    mkdirSync(memory, { recursive: true });
    const leaf = (title: string, list: string[]) =>
        [`# ${title}`, ...list.map((h) => `\n## ${h}\n\nsome line`)].join('\n');
    writeFileSync(
        join(memory, 'surface-herdr-desktop.md'),
        leaf('herdr', herdr),
    );
    if (desktop) {
        writeFileSync(
            join(memory, 'surface-claude-desktop.md'),
            leaf('desktop', desktop),
        );
    }
    return spawnSync('node', [script], {
        cwd: root,
        encoding: 'utf8',
        timeout: 10_000,
    });
}

describe('surface-mirror-check', () => {
    it('passes two leaves with one heading list', () => {
        expect(check(headings, headings).status).toBe(0);
    });

    it('refuses a renamed heading and names it', () => {
        const renamed = headings.with(2, 'presses');
        const result = check(headings, renamed);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('presses and asks');
        expect(result.stderr).toContain('«presses»');
    });

    it('refuses the same headings in another order', () => {
        const swapped = headings.toSpliced(
            0,
            2,
            'the screen he reads',
            'threads',
        );
        expect(check(headings, swapped).status).toBe(1);
    });

    it('refuses a heading only one leaf has', () => {
        const result = check([...headings, 'extra'], headings);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('extra');
    });

    it('refuses a missing leaf', () => {
        const result = check(headings, null);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            'missing leaf: _clio/memory/surface-claude-desktop.md',
        );
    });
});
