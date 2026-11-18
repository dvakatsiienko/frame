import { describe, expect, it } from 'vitest';

import {
    checkedNames,
    needsHerdrTypes,
    verdict,
} from './herdr-mods-typecheck.ts';

describe('needsHerdrTypes', () => {
    it.each([
        ["import { rowSizes } from './rows.js';", false],
        ["import { a } from './a.js';\nimport { b } from '../b.js';", false],
        ['export const one = 1;', false],
        ["import { View } from 'gpui-kit';", true],
        ['import { theme } from "herdr";', true],
        ["import {\n    props,\n    theme,\n} from 'herdr';", true],
        ["import { Buffer } from 'buffer';", true],
        ["const { exec } = await import('herdr');", true],
        ["export { v_flex } from 'gpui-base';", true],
        ["// import { View } from 'gpui-kit';\nexport const one = 1;", false],
    ])('%j → %s', (source, expected) => {
        expect(needsHerdrTypes(source)).toBe(expected);
    });
});

// FRM-647: a mod declares a runtime global ES2022 leaves out (btoa) in its own .d.ts; herdr's two type files come in once
describe('checkedNames', () => {
    it('takes the js and the mod’s own declarations, never the copies herdr writes', () => {
        expect(
            checkedNames([
                'main.js',
                'globals.d.ts',
                'gpui-kit.d.ts',
                'herdr.d.ts',
                'main.test.ts',
                'mod.json',
                'statusline.cjs',
            ]),
        ).toEqual(['main.js', 'globals.d.ts']);
    });
});

describe('verdict', () => {
    it('is clean when every mod passed with herdr types', () => {
        expect(
            verdict({ checked: 9, mods: 1, red: [], skippedFiles: 0 }),
        ).toEqual({
            isRed: false,
            line: 'herdr-mods:typecheck: 1 mod clean, 9 files',
        });
    });

    it('names the red mods', () => {
        expect(
            verdict({
                checked: 9,
                mods: 2,
                red: ['x-herdr-chat'],
                skippedFiles: 0,
            }),
        ).toEqual({
            isRed: true,
            line: 'herdr-mods:typecheck: red in x-herdr-chat',
        });
    });

    it('says what a machine without herdr left unchecked', () => {
        expect(
            verdict({ checked: 7, mods: 1, red: [], skippedFiles: 2 }).line,
        ).toBe(
            "herdr-mods:typecheck: 1 mod clean, 7 files — 2 files that import herdr not checked: herdr's types are not on this machine",
        );
    });

    it('is red when nothing was checked: a green that ran nothing proves nothing', () => {
        expect(
            verdict({ checked: 0, mods: 0, red: [], skippedFiles: 0 }),
        ).toEqual({
            isRed: true,
            line: 'herdr-mods:typecheck: red, 0 files checked',
        });
    });
});
