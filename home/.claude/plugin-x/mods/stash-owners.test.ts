import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// one owner per shelf file x-mod-stash writes (FRM-662 exit 4): only its owner module names the path in code, every
// other module reads and writes it through the owner's functions; a move out of register.tsx moves its row here
const HOOKS = join(import.meta.dirname, 'x-mod-stash/hooks');
const OWNERS = {
    'ask-counter': 'register.tsx',
    'cc-usage-window.json': 'register.tsx',
    'fleet.json': 'register.tsx',
    'herdr-joins': 'register.tsx',
    'herdr-state': 'register.tsx',
    'lane-rounds.json': 'register.tsx',
    'lanes.json': 'register.tsx',
    'operator-override.json': 'override.ts',
    'relay.json': 'register.tsx',
    'second-wind.json': 'wind-store.ts',
} as const;
// a module that only quotes the path in a text the model or dima reads, never touching the file
const QUOTED: Record<string, readonly string[]> = {
    'herdr-joins': ['quiet.ts'],
};

function hooksFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
        const path = join(dir, d.name);
        if (d.isDirectory()) return hooksFiles(path);
        return /\.tsx?$/.test(d.name) ? [path] : [];
    });
}

// line comments only: a block-comment strip would read a glob string such as `dev-mods/*` as an opener
function codeOf(source: string) {
    return source.replace(/(^|\s)\/\/.*$/gm, '$1');
}

const files = hooksFiles(HOOKS).map((path) => ({
    code: codeOf(readFileSync(path, 'utf8')),
    name: relative(HOOKS, path),
}));

function namers(token: string) {
    return files
        .filter((f) => f.code.includes(token))
        .map((f) => f.name)
        .filter((name) => !QUOTED[token]?.includes(name));
}

describe('x-mod-stash: one module names each shelf file it writes', () => {
    it('reads code, never a comment', () => {
        expect(codeOf("a // lanes.json\nb 'https://x' // c")).toBe(
            "a \nb 'https://x' ",
        );
    });

    for (const [token, owner] of Object.entries(OWNERS))
        it(`${token}: only ${owner} names it`, () => {
            expect(namers(token)).toEqual([owner]);
        });
});
