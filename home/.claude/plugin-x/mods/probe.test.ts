import { describe, expect, it } from 'vitest';

import { swapDir } from './probe.ts';

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
