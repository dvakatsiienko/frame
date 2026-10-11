import { describe, expect, it } from 'vitest';

import { verdict } from './typecheck.ts';

describe('verdict', () => {
    it('is green when every mod with types checked clean', () => {
        expect(verdict({ checked: 5, red: [], skipped: [] })).toEqual({
            isRed: false,
            line: 'mods:typecheck: 5 mods clean',
        });
    });

    it('is red when it checked no mod at all', () => {
        expect(
            verdict({ checked: 0, red: [], skipped: ['x-mod-stash'] }),
        ).toEqual({
            isRed: true,
            line: 'mods:typecheck: red, 0 mods checked — no engine types yet in x-mod-stash',
        });
    });
});
