import { describe, expect, it } from 'vitest';

import {
    parkedOnDialog,
    parseLive,
    requestOf,
    skipPromptArgs,
} from './live-args.ts';

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

    it('reads --plant with its file, anchor and replacement, an empty replacement included', () => {
        expect(parseLive(['--plant', 'a.ts', 'x', 'y'])).toEqual({
            anchor: 'x',
            file: 'a.ts',
            kind: 'plant',
            replacement: 'y',
        });
        expect(parseLive(['--plant', 'a.ts', 'x', '']).kind).toBe('plant');
        expect(
            [
                ['--plant', 'a.ts', 'x'],
                ['--plant', 'a.ts', 'x', 'y', 'z'],
                ['--plant'],
            ].map((argv) => parseLive(argv).kind),
        ).toEqual(['usage', 'usage', 'usage']);
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

describe('parkedOnDialog', () => {
    // a real child's frame with no --settings: the control of the 2026-11-05 probe
    const parked = [
        ' WARNING: Claude Code running in Bypass Permissions mode',
        '',
        ' ❯ 1. No, exit',
        '   2. Yes, I accept',
        '',
        ' Enter to confirm · Esc to cancel',
    ].join('\n');

    it('reads the bypass dialog on a frame', () => {
        expect(parkedOnDialog(parked)).toBe(true);
    });

    it('reads a session past the dialog as not parked', () => {
        expect(
            parkedOnDialog(
                '> \n  ⏵⏵ bypass permissions on (shift+tab to cycle)',
            ),
        ).toBe(false);
    });

    it('reads a transcript that only quotes the warning as not parked', () => {
        expect(
            parkedOnDialog(
                '> why does it say WARNING: Claude Code running in Bypass Permissions mode?',
            ),
        ).toBe(false);
    });
});

describe('skipPromptArgs', () => {
    const on = '{"skipDangerousModePermissionPrompt":true}';
    it("carries the user's own yes to the child", () => {
        expect(skipPromptArgs(on)).toEqual(['--settings', on]);
    });
    for (const [name, text] of [
        ['set off', '{"skipDangerousModePermissionPrompt":false}'],
        ['absent', '{"model":"opus"}'],
        ['a truthy string', '{"skipDangerousModePermissionPrompt":"true"}'],
        ['unreadable json', '{nope'],
        ['a bare null', 'null'],
    ] as const)
        it(`adds nothing when the value is ${name}`, () => {
            expect(skipPromptArgs(text)).toEqual([]);
        });
});

describe('requestOf', () => {
    it.each([
        ['an empty file, read before the write landed', ''],
        ['half a write', '{"label":"🎛'],
        ['an unknown verb', '{"label":"x","what":"drag"}'],
        ['no label', '{"what":"hover"}'],
    ])('reads %s as no request', (_, text) => {
        expect(requestOf(text)).toBeUndefined();
    });
    it('reads a whole request', () => {
        expect(requestOf('{"label":"🎛️","what":"hover"}')).toEqual({
            label: '🎛️',
            what: 'hover',
        });
    });
});
