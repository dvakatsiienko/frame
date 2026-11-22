import { describe, expect, it, vi } from 'vitest';

const exec = vi.hoisted(() => vi.fn(async () => ({ code: 0 })));
vi.mock('herdr', () => ({ exec }));
const { fileName, isImagePath, pictureOpenArgs, pickedPaths, promptPath } =
    await import('./attach.js');

describe('pickedPaths', () => {
    it('reads one path a line', () => {
        expect(pickedPaths('/a/one.png\n/b/two.md\n')).toEqual([
            '/a/one.png',
            '/b/two.md',
        ]);
    });
    it('reads a cancel as none', () => {
        expect(pickedPaths('')).toEqual([]);
    });
    it('drops a carriage return', () => {
        expect(pickedPaths('/a/one.png\r\n')).toEqual(['/a/one.png']);
    });
});

describe('promptPath', () => {
    it('leaves a plain path as it is', () => {
        expect(promptPath('/Users/d/shot.png')).toBe('/Users/d/shot.png');
    });
    it('escapes spaces and parentheses the way a terminal drop types them', () => {
        expect(promptPath('/Users/d/Clean Shot (2).png')).toBe(
            '/Users/d/Clean\\ Shot\\ \\(2\\).png',
        );
    });
});

describe('fileName', () => {
    it('is the last part of the path', () => {
        expect(fileName('/Users/d/notes/plan.md')).toBe('plan.md');
    });
});

describe('promptPath, the shell characters', () => {
    it('escapes brackets, an ampersand and a dollar', () => {
        expect(promptPath('/d/a [1] & $x.md')).toBe(
            '/d/a\\ \\[1\\]\\ \\&\\ \\$x.md',
        );
    });
});

describe('promptPath, letters outside ascii', () => {
    it('leaves a Cyrillic name as it is', () => {
        expect(promptPath('/d/знімок.png')).toBe('/d/знімок.png');
    });
});

describe('isImagePath, a dropped file that shows as a picture', () => {
    it('takes the picture types Claude reads, any case', () => {
        for (const p of [
            '/a/shot.png',
            '/a/b.JPG',
            '/a/c.jpeg',
            '/a/d.gif',
            '/a/e.webp',
        ])
            expect(isImagePath(p)).toBe(true);
    });

    it('leaves every other file a chip', () => {
        for (const p of [
            '/a/notes.md',
            '/a/png',
            '/a/shot.png.txt',
            '/a/.png',
            '/a/dir/',
            '/a/scan.tiff',
        ])
            expect(isImagePath(p)).toBe(false);
    });
});

describe('pictureOpenArgs, the open button on a picture', () => {
    it('starts CleanShot X annotate on the file, its path escaped', () => {
        expect(pictureOpenArgs('/Users/d/My Shots/a&b.png', true)).toEqual([
            'cleanshot://open-annotate?filepath=%2FUsers%2Fd%2FMy%20Shots%2Fa%26b.png',
        ]);
    });
    it('opens it in Preview when CleanShot is off', () => {
        expect(pictureOpenArgs('/a.png', false)).toEqual([
            '-a',
            'Preview',
            '/a.png',
        ]);
    });
});
