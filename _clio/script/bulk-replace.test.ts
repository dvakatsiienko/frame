import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';

import { planReplace } from './bulk-replace.ts';

const root = mkdtempSync(path.join(tmpdir(), 'bulk-'));
writeFileSync(path.join(root, 'a.md'), 'alpha beta\ngamma gamma\n');
writeFileSync(path.join(root, 'b.md'), 'delta\n');

test('applies every pair when each anchor matches once, two in one file', () => {
    const { bodies, misses } = planReplace(
        [
            { file: 'a.md', new: 'ALPHA', old: 'alpha' },
            { file: 'a.md', new: 'BETA', old: 'beta' },
            { file: 'b.md', new: 'DELTA', old: 'delta' },
        ],
        root,
    );
    expect([misses, [...bodies.values()]]).toEqual([
        [],
        ['ALPHA BETA\ngamma gamma\n', 'DELTA\n'],
    ]);
});

test('reports a double match, so the run writes nothing', () => {
    expect(
        planReplace(
            [
                { file: 'b.md', new: 'x', old: 'delta' },
                { file: 'a.md', new: 'x', old: 'gamma' },
            ],
            root,
        ).misses,
    ).toEqual(['2 a.md: anchor matches 2 times']);
});

test('keeps a $ in the replacement as written', () => {
    expect(
        planReplace([{ file: 'b.md', new: '$& cost', old: 'delta' }], root)
            .bodies.values()
            .next().value,
    ).toBe('$& cost\n');
});
