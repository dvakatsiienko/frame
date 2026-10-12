/* Core */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, onTestFinished, test } from 'vitest';

const script = path.resolve(import.meta.dirname, '../recipe-brief.ts');

const WANT = '## the want\n\nfind what moved.\n- **keep** the `x` habit';
const VECTORS =
    '## vectors\n\n- **cc changelog** — every release since the last run';
const SHARED =
    '## the shared vectors — every refresh run asks these\n\nresearch, the outside world:\n- **the delta** — changelogs';

// a copy of the script in a tree of its own: it reads ../recipes beside itself, never the repo's
function build() {
    const root = mkdtempSync(path.join(tmpdir(), 'recipe-brief-'));
    onTestFinished(() => rmSync(root, { recursive: true }));
    mkdirSync(path.join(root, 'script'));
    mkdirSync(path.join(root, 'recipes/refresh-probe'), { recursive: true });
    copyFileSync(script, path.join(root, 'script/recipe-brief.ts'));
    writeFileSync(
        path.join(root, 'recipes/AGENTS.md'),
        `# recipes\n\n## the check\n\nshape.\n\n${SHARED}\n`,
    );
    writeFileSync(
        path.join(root, 'recipes/refresh-probe/recipe.md'),
        `---\nkind: refresh\n---\n\n# refresh-probe\n\n${WANT}\n\n## the artifact\n\nnone.\n\n${VECTORS}\n\n## steps\n\n1. run\n`,
    );
    const run = spawnSync(
        'node',
        [path.join(root, 'script/recipe-brief.ts'), 'refresh-probe'],
        { encoding: 'utf8' },
    );
    expect(run.stderr).toBe('');
    return readFileSync(
        path.join(root, 'recipes/refresh-probe/last/brief.md'),
        'utf8',
    );
}

test('the brief carries the want, the vectors and the shared vectors verbatim, and no other section', () => {
    const brief = build();

    expect([WANT, VECTORS, SHARED].map((s) => brief.includes(s))).toEqual([
        true,
        true,
        true,
    ]);
    expect(brief).not.toMatch(/## (steps|the artifact|the check)/);
});

test("the brief opens with the shared section's sha256 as its marker", () => {
    const sha = createHash('sha256').update(SHARED).digest('hex');

    expect(build().split('\n')[0]).toBe(`<!-- shared-vectors: ${sha} -->`);
});
