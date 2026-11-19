import { describe, expect, it } from 'vitest';

import {
    checkedNames,
    needingHerdr,
    needsHerdrTypes,
    ownHerdrTypes,
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

// FRM-659: ci went red when a kept file pulled a skipped one back in through its relative import
describe('needingHerdr', () => {
    const roots = ['/m/chat', '/m/_shared'];

    it('skips a file that imports herdr, and every file that imports a skipped one, through any depth', () => {
        expect(
            needingHerdr(
                {
                    '/m/chat/attach.js': "import { exec } from 'herdr';",
                    '/m/chat/main.js': "import { a } from './rows.js';",
                    '/m/chat/plain.js': 'export const one = 1;',
                    '/m/chat/rows.js': "import { b } from './attach.js';",
                },
                roots,
            ),
        ).toEqual(['/m/chat/attach.js', '/m/chat/main.js', '/m/chat/rows.js']);
    });

    it('follows an import that resolves into the shared folder', () => {
        expect(
            needingHerdr(
                {
                    '/m/_shared/keypress.js': "import { theme } from 'herdr';",
                    '/m/chat/quill.js': "import { k } from './keypress.js';",
                },
                roots,
            ),
        ).toEqual(['/m/_shared/keypress.js', '/m/chat/quill.js']);
    });

    it('keeps a file whose imports all stay checkable', () => {
        expect(
            needingHerdr(
                {
                    '/m/chat/a.js': "import { b } from './b.js';",
                    '/m/chat/b.js': 'export const b = 1;',
                },
                roots,
            ),
        ).toEqual([]);
    });
});

// FRM-659: herdr wrote its type files into our mod folders on starts long gone; nine drifted copies sat beside the code
describe('ownHerdrTypes', () => {
    it('names a herdr type file a mod folder keeps', () => {
        expect(
            ownHerdrTypes([
                'main.js',
                'gpui-kit.d.ts',
                'globals.d.ts',
                'herdr.d.ts',
            ]),
        ).toEqual(['gpui-kit.d.ts', 'herdr.d.ts']);
    });

    it('names nothing in a folder of our own files', () => {
        expect(ownHerdrTypes(['main.js', 'globals.d.ts'])).toEqual([]);
    });
});

describe('verdict', () => {
    it('is red and names a mod folder keeping its own herdr type file', () => {
        expect(
            verdict({
                checked: 9,
                mods: 1,
                ownTypes: ['x-herdr-deck/gpui-kit.d.ts'],
                red: [],
                skipped: [],
            }),
        ).toEqual({
            isRed: true,
            line: "herdr-mods:typecheck: red, a mod keeps its own copy of herdr's types: x-herdr-deck/gpui-kit.d.ts — trash it, the check reads herdr's own",
        });
    });

    it('is clean when every mod passed with herdr types', () => {
        expect(
            verdict({
                checked: 9,
                mods: 1,
                ownTypes: [],
                red: [],
                skipped: [],
            }),
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
                ownTypes: [],
                red: ['x-herdr-chat'],
                skipped: [],
            }),
        ).toEqual({
            isRed: true,
            line: 'herdr-mods:typecheck: red in x-herdr-chat',
        });
    });

    it('names each file a machine without herdr left unchecked', () => {
        expect(
            verdict({
                checked: 7,
                mods: 1,
                ownTypes: [],
                red: [],
                skipped: ['x-herdr-chat/attach.js', 'x-herdr-chat/main.js'],
            }).line,
        ).toBe(
            "herdr-mods:typecheck: 1 mod clean, 7 files — 2 files need herdr's types, not on this machine: x-herdr-chat/attach.js, x-herdr-chat/main.js",
        );
    });

    it('is red when nothing was checked: a green that ran nothing proves nothing', () => {
        expect(
            verdict({
                checked: 0,
                mods: 0,
                ownTypes: [],
                red: [],
                skipped: [],
            }),
        ).toEqual({
            isRed: true,
            line: 'herdr-mods:typecheck: red, 0 files checked',
        });
    });
});
