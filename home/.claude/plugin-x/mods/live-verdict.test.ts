import { describe, expect, it } from 'vitest';

import { reloadVerdict } from './live-verdict.ts';

const LOADED =
    'hooks module x-mod-guard@inline loaded (worker); events: tool.call';

describe('reloadVerdict', () => {
    it('reads a new load line as ok', () => {
        expect(
            reloadVerdict({
                isReloaded: true,
                isSame: false,
                line: LOADED,
                name: 'x-mod-guard',
            }),
        ).toBe(`reload ok: ${LOADED}`);
    });

    it('reads a save that changed no hook, still loaded, as ok', () => {
        expect(
            reloadVerdict({
                isReloaded: false,
                isSame: true,
                line: LOADED,
                name: 'x-mod-guard',
            }),
        ).toBe(`reload ok: no hook changed, still loaded: ${LOADED}`);
    });

    it('reads an unchanged save whose last line is a failed load as an error', () => {
        expect(
            reloadVerdict({
                isReloaded: false,
                isSame: true,
                line: 'hooks module x-mod-guard@inline not loaded: boom',
                name: 'x-mod-guard',
            }),
        ).toMatch(/^reload error/);
    });

    it('reads a changed hook with no load as an error', () => {
        expect(
            reloadVerdict({
                isReloaded: false,
                isSame: false,
                line: LOADED,
                name: 'x-mod-guard',
            }),
        ).toMatch(
            /^reload error: the engine logged no load of x-mod-guard in 8 s/,
        );
    });
});
