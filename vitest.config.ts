import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { defineConfig } from 'vitest/config';

const herdrMods = join(import.meta.dirname, 'home/.config/herdr-app/mods');

// herdr-mods:land copies a mod's `shared` files beside it, so its `./tab-loop.js` resolves there; a test reads the
// tree before land, where the file sits only in `_shared` (herdr/docs/adr/0002)
const herdrShared = {
    name: 'herdr-shared',
    resolveId(source: string, importer: string | undefined) {
        if (!importer?.startsWith(herdrMods) || !source.startsWith('./'))
            return null;
        if (existsSync(join(dirname(importer), source))) return null;
        const shared = join(herdrMods, '_shared', source.slice(2));
        return existsSync(shared) ? shared : null;
    },
};

// a bg codie's worktree under .claude/worktrees carries a full copy of the tests;
// without this exclude every count doubles (measured 2026-09-03: 166 = 2 × 83)
// cc mods (plugin-x/mods/<mod>) import the engine-only `claude-code/testing`; `pnpm mods:test` runs them — the scripts beside them stay vitest's
export default defineConfig({
    plugins: [herdrShared],
    test: {
        exclude: [
            '**/node_modules/**',
            '.claude/worktrees/**',
            '**/plugin-x/mods/*/**',
            // `cc` is a symlink to home/.claude: through it its 17 tests ran twice (332 listed → 315, 2026-10-08)
            'cc/**',
            // its own pnpm root with its own deps: `pnpm -C _clio/blueprints/excalidraw test`
            '_clio/blueprints/excalidraw/**',
        ],
        globalSetup: './script/lib/test-temp-dir.ts',
        // the 5 s default false-redded commits and pushes at high load, clio-watch and index-run most
        testTimeout: 30_000,
    },
});
