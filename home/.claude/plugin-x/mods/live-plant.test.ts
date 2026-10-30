import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { plantedCopy as plantedCopyOf } from './live-plant.ts';

// every dir a test makes, its fixtures and the copies, goes when the test ends: frame's commit hook runs this file
const made: string[] = [];
afterEach(() => {
    for (const dir of made.splice(0))
        rmSync(dir, { force: true, recursive: true });
});
const tempDir = (prefix: string) => {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    made.push(dir);
    return dir;
};
const plantedCopy = (file: string, anchor: string, replacement: string) => {
    const p = plantedCopyOf(file, anchor, replacement);
    made.push(p.root);
    return p;
};

const copies = () =>
    readdirSync(tmpdir()).filter((n) => n.startsWith('mods-live-plant-'));

function fixture(text: string) {
    const mod = join(tempDir('plant-fix-'), 'x-mod-fix');
    mkdirSync(join(mod, '.claude-plugin'), { recursive: true });
    mkdirSync(join(mod, 'hooks'));
    writeFileSync(
        join(mod, '.claude-plugin/plugin.json'),
        '{"name":"x-mod-fix"}',
    );
    const file = join(mod, 'hooks/register.ts');
    writeFileSync(file, text);
    return { file, mod };
}

describe('plantedCopy', () => {
    it('plants one change in a copy of the whole mod', () => {
        const { file, mod } = fixture('const a = 1;\nconst b = 2;\n');
        const p = plantedCopy(file, 'const b = 2;', 'const b = 99;');
        expect(readFileSync(p.file, 'utf8')).toBe(
            'const a = 1;\nconst b = 99;\n',
        );
        expect(p.mod).not.toBe(mod);
        expect(
            readFileSync(join(p.mod, '.claude-plugin/plugin.json'), 'utf8'),
        ).toBe('{"name":"x-mod-fix"}');
    });

    it('leaves the original bytes alone', () => {
        const { file } = fixture('const a = 1;\nconst b = 2;\n');
        plantedCopy(file, 'const b = 2;', 'const b = 99;');
        expect(readFileSync(file, 'utf8')).toBe('const a = 1;\nconst b = 2;\n');
    });

    it('leaves a file the mod links to alone', () => {
        const { file, mod } = fixture('const a = 1;\n');
        const target = join(mod, '..', 'outside.ts');
        writeFileSync(target, 'const a = 1;\n');
        const link = join(mod, 'hooks/linked.ts');
        symlinkSync(target, link);
        plantedCopy(link, 'const a = 1;', 'const a = 2;');
        expect(readFileSync(target, 'utf8')).toBe('const a = 1;\n');
        expect(readFileSync(file, 'utf8')).toBe('const a = 1;\n');
    });

    it('takes a replacement holding $ as written', () => {
        const { file } = fixture('go();\n');
        const p = plantedCopy(file, 'go();', "const $& = '$1';");
        expect(readFileSync(p.file, 'utf8')).toBe("const $& = '$1';\n");
    });

    it('refuses an anchor that matches 0 or 2+ times before it copies anything', () => {
        const { file } = fixture('a\na\n');
        const before = copies().length;
        expect(() => plantedCopy(file, 'a', 'b')).toThrow('matches 2 times');
        expect(() => plantedCopy(file, 'zzz', 'b')).toThrow('matches 0 times');
        expect(() => plantedCopy(file, '', 'b')).toThrow('matches 0 times');
        expect(copies().length).toBe(before);
    });

    it('refuses a file outside any mod', () => {
        const dir = tempDir('plant-none-');
        const file = join(dir, 'a.ts');
        writeFileSync(file, 'x');
        expect(() => plantedCopy(file, 'x', 'y')).toThrow('not inside a mod');
    });

    it('refuses a file beside the mods, where plugin x holds the manifest above', () => {
        const root = tempDir('plant-plugin-');
        mkdirSync(join(root, '.claude-plugin'));
        writeFileSync(join(root, '.claude-plugin/plugin.json'), '{"name":"x"}');
        mkdirSync(join(root, 'mods'));
        const file = join(root, 'mods/live.ts');
        writeFileSync(file, 'x');
        expect(() => plantedCopy(file, 'x', 'y')).toThrow('not inside a mod');
    });
});
