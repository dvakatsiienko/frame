import { describe, expect, it } from 'vitest';

import { parseLive } from './live-args.ts';

describe('parseLive', () => {
    it('reads a bare mod dir as serve', () => {
        expect(parseLive(['mods/x'])).toEqual({ kind: 'serve', mod: 'mods/x' });
    });

    it('reads hover, click, type and fill with their text', () => {
        expect(
            ['hover', 'click', 'type', 'fill'].map((verb) =>
                parseLive(['mods/x', verb, '🛎️', 'tick']),
            ),
        ).toEqual(
            ['hover', 'click', 'type', 'fill'].map((verb) => ({
                kind: 'act',
                mod: 'mods/x',
                text: '🛎️ tick',
                verb,
            })),
        );
    });

    it('reads status with no text', () => {
        expect(parseLive(['mods/x', 'status'])).toEqual({
            kind: 'status',
            mod: 'mods/x',
        });
    });

    it('refuses a verb with no text, an unknown verb, status with text and no mod', () => {
        expect(
            [
                ['mods/x', 'fill'],
                ['mods/x', 'paste', 'a'],
                ['mods/x', 'status', 'now'],
                [],
            ].map((argv) => parseLive(argv).kind),
        ).toEqual(['usage', 'usage', 'usage', 'usage']);
    });
});
