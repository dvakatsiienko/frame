import { defineConfig } from 'vitest/config';

// a bg coder's worktree under .claude/worktrees carries a full copy of the tests;
// without this exclude every count doubles (measured 2026-09-03: 166 = 2 × 83)
// cc mods (plugin-x/mods/<mod>) import the engine-only `claude-code/testing`; `pnpm mods:test` runs them — the scripts beside them stay vitest's
// biome-ignore lint/style/noDefaultExport: vitest reads the default export
export default defineConfig({
    test: {
        exclude: [
            '**/node_modules/**',
            '.claude/worktrees/**',
            '**/plugin-x/mods/*/**',
            // `cc` is a symlink to home/.claude: through it its 17 tests ran twice (332 listed → 315, 2026-10-08)
            'cc/**',
        ],
    },
});
