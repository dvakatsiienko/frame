import { describe, expect, it, vi } from 'vitest';

const exec = vi.hoisted(() => vi.fn(async () => ({ code: 0 })));
vi.mock('herdr', () => ({ exec }));
const {
    fileName,
    isImagePath,
    openInPreview,
    pickedPaths,
    promptPath,
    withFiles,
} = await import('./attach.js');

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

describe('withFiles', () => {
    it('adds new paths after the waiting ones', () => {
        expect(withFiles(['/a'], ['/b', '/c'])).toEqual(['/a', '/b', '/c']);
    });
    it('keeps a path once when it comes again', () => {
        expect(withFiles(['/a'], ['/a', '/b', '/b'])).toEqual(['/a', '/b']);
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

describe('openInPreview, a click on a preview over the quill', () => {
    const previews: Record<string, string> = {
        '/Users/d/big.jpg': 'data/shots/shot-2.png',
        '/app/data/shots/shot-1.png': 'data/shots/shot-1.png',
    };
    const files = Object.keys(previews);
    const previewOf = (p: string) => previews[p];
    it('opens a pasted png in Preview', () => {
        exec.mockClear();
        openInPreview(files, previewOf, 'data/shots/shot-1.png');
        expect(exec.mock.calls).toEqual([
            ['open', ['-a', 'Preview', '/app/data/shots/shot-1.png']],
        ]);
    });
    it('opens a dropped picture itself, never its small preview', () => {
        exec.mockClear();
        openInPreview(files, previewOf, 'data/shots/shot-2.png');
        expect(exec.mock.calls).toEqual([
            ['open', ['-a', 'Preview', '/Users/d/big.jpg']],
        ]);
    });
    it('opens nothing for a preview no file waits behind', () => {
        exec.mockClear();
        openInPreview(files, previewOf, 'data/shots/shot-9.png');
        expect(exec).not.toHaveBeenCalled();
    });
});
