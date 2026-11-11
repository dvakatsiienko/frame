import { describe, expect, it, vi } from 'vitest';

vi.mock('herdr', () => ({ exec: vi.fn() }));
const { fileName, pickedPaths, promptPath, withFiles } = await import(
    './attach.js'
);

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
