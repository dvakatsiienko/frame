import { describe, expect, it } from 'vitest';

import { loadedFrom, swapDir } from './probe.ts';

const names: Record<string, string> = {
    '~/m/x-mod-guard': 'x-mod-guard',
    '~/m/x-mod-stash': 'x-mod-stash',
};
const nameOf = (dir: string) => names[dir];

describe('swapDir', () => {
    it('puts the dev copy in the live entry of the same plugin, order kept', () => {
        expect(
            swapDir(
                ['~/m/x-mod-stash', '~/m/x-mod-guard'],
                '/wt/x-mod-stash',
                'x-mod-stash',
                nameOf,
            ),
        ).toEqual(['/wt/x-mod-stash', '~/m/x-mod-guard']);
    });

    it('adds a mod that is not live yet at the end', () => {
        expect(
            swapDir(['~/m/x-mod-stash'], '/wt/x-mod-new', 'x-mod-new', nameOf),
        ).toEqual(['~/m/x-mod-stash', '/wt/x-mod-new']);
    });
});

describe('loadedFrom', () => {
    const line = (dir: string) =>
        `2026-10-11T10:24:34.482Z [DEBUG] Read hooks.json for plugin x-mod-guard (enabled=true): ${dir}/hooks/hooks.json`;

    it('names the folder the engine read the mod from', () => {
        expect(loadedFrom([line('/tmp/dev/x-mod-guard')], 'x-mod-guard')).toBe(
            '/tmp/dev/x-mod-guard',
        );
    });

    it('names the live folder when the dev copy did not load', () => {
        expect(
            loadedFrom(
                [
                    line(
                        '/Users/dima/frame/home/.claude/plugin-x/mods/x-mod-guard',
                    ),
                ],
                'x-mod-guard',
            ),
        ).toBe('/Users/dima/frame/home/.claude/plugin-x/mods/x-mod-guard');
    });

    it('is undefined when the mod never loaded', () => {
        expect(loadedFrom([], 'x-mod-guard')).toBeUndefined();
    });
});
