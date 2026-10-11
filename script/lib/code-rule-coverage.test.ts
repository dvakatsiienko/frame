/* Core */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import { gitEnv } from './git-fixture.ts';

const root = path.resolve(import.meta.dirname, '../..');
const rule = readFileSync(
    path.join(root, 'home/.claude/rules/code.md'),
    'utf8',
);
const globs = new Set(
    [...rule.matchAll(/^\s+- "\*\*\/\*\.([a-z0-9]+)"$/gm)].map((m) => m[1]),
);

// file types in this repo that are data, docs or media, never code the rule should load on
const notCode = new Set(
    'md svg png json jsonc jsonl jpg jpeg avif webp gif ico yml yaml toml plist txt lock gitignore gitattributes csv woff woff2 ttf otf mp4 mov wav mp3 log tape sum mod keep example env pdf'.split(
        ' ',
    ),
);

test('every code file type in frame loads the code rule', () => {
    const files = spawnSync('git', ['ls-files', '-z'], {
        cwd: root,
        encoding: 'utf8',
        env: gitEnv(),
    }).stdout.split('\0');
    const counts = new Map<string, number>();
    for (const f of files) {
        const ext = path.extname(f).slice(1).toLowerCase();
        if (ext && !notCode.has(ext))
            counts.set(ext, (counts.get(ext) ?? 0) + 1);
    }
    const missing = [...counts]
        .filter(([ext, n]) => n >= 3 && !globs.has(ext))
        .map(([ext, n]) => `.${ext} (${n} files)`);
    expect(
        missing,
        'add each to rules/code.md paths, or to notCode here if it is not code',
    ).toEqual([]);
});
