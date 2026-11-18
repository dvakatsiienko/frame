import { describe, expect, it } from 'vitest';

import {
    brewMoves,
    goModMoves,
    manifestMoves,
    pnpmGlobalMoves,
    uvMoves,
} from './evergreen-delta.ts';

describe('manifestMoves', () => {
    it('lists a dep whose pinned version changed, across dep fields', () => {
        const before = JSON.stringify({
            dependencies: { react: '19.2.0' },
            devDependencies: { tsx: '4.0.0', vitest: '5.0.5' },
        });
        const after = JSON.stringify({
            dependencies: { react: '19.2.0' },
            devDependencies: { tsx: '4.0.0', vitest: '5.1.0' },
        });
        expect(manifestMoves(before, after)).toEqual([
            { from: '5.0.5', name: 'vitest', to: '5.1.0' },
        ]);
    });

    it('skips added deps, workspace links and a range-only change', () => {
        const before = JSON.stringify({
            dependencies: { a: '^1.0.0', ui: 'workspace:*' },
        });
        const after = JSON.stringify({
            dependencies: { a: '1.0.0', b: '2.0.0', ui: 'workspace:^' },
        });
        expect(manifestMoves(before, after)).toEqual([]);
    });
});

describe('goModMoves', () => {
    it('reads both the block and the single-line require', () => {
        const before =
            'module x\n\nrequire github.com/spf13/pflag v1.0.10\n\nrequire (\n\tcharm.land/bubbletea/v2 v2.1.1\n)\n';
        const after =
            'module x\n\nrequire github.com/spf13/pflag v1.1.0\n\nrequire (\n\tcharm.land/bubbletea/v2 v2.1.2\n)\n';
        expect(goModMoves(before, after)).toEqual([
            { from: 'v1.0.10', name: 'github.com/spf13/pflag', to: 'v1.1.0' },
            { from: 'v2.1.1', name: 'charm.land/bubbletea/v2', to: 'v2.1.2' },
        ]);
    });
});

describe('the upgrade logs', () => {
    it('reads brew upgrade lines once each, skipping the rest', () => {
        const log =
            '==> Upgrading 3 outdated packages:\nlibomp                23.1.5     -> 23.1.6      (597.2KB)\nhomerow 1.5.3 -> 3.0.0\n==> Pouring libomp\nlibomp 23.1.5 -> 23.1.6\n🍺  done\n';
        expect(brewMoves(log)).toEqual([
            { from: '23.1.5', name: 'libomp', to: '23.1.6' },
            { from: '1.5.3', name: 'homerow', to: '3.0.0' },
        ]);
    });

    it('reads uv outdated lines', () => {
        expect(uvMoves('harbor v0.25.0 [latest: 0.26.0]\n- harbor\n')).toEqual([
            { from: '0.25.0', name: 'harbor', to: '0.26.0' },
        ]);
    });

    it('reads pnpm outdated -g json', () => {
        const json = JSON.stringify({
            n8n: { current: '2.46.4', latest: '2.48.4' },
        });
        expect(pnpmGlobalMoves(json)).toEqual([
            { from: '2.46.4', name: 'n8n', to: '2.48.4' },
        ]);
    });
});
