import { describe, expect, test, vi } from 'vitest';

vi.mock('herdr', () => ({ appHome: () => '/app', exec: vi.fn() }));
const { createSteerFiles } = await import('./steer-files.js');

const storeOf = () => {
    const kept = new Map<string, string>();
    return {
        getItem: (key: string) => kept.get(key) ?? null,
        removeItem: (key: string) => void kept.delete(key),
        setItem: (key: string, value: string) => void kept.set(key, value),
    };
};

const KEY = 's1:o3';

describe("a steer box's files ride its steer (FRM-676 slice B)", () => {
    test('a dropped png and a pasted pdf wait as two files', () => {
        const files = createSteerFiles(storeOf());
        files.add(KEY, ['/Users/d/shot.png']);
        files.add(KEY, ['/Users/d/notes.pdf']);
        expect(files.of(KEY)).toEqual([
            '/Users/d/shot.png',
            '/Users/d/notes.pdf',
        ]);
    });

    test('× on one file leaves the other', () => {
        const files = createSteerFiles(storeOf());
        files.add(KEY, ['/Users/d/shot.png', '/Users/d/notes.pdf']);
        files.remove(KEY, '/Users/d/shot.png');
        expect(files.of(KEY)).toEqual(['/Users/d/notes.pdf']);
    });

    test('a file dropped twice waits once', () => {
        const files = createSteerFiles(storeOf());
        files.add(KEY, ['/Users/d/shot.png']);
        expect(files.add(KEY, ['/Users/d/shot.png'])).toBe(false);
        expect(files.of(KEY)).toEqual(['/Users/d/shot.png']);
    });

    test("one box's files never show in another's", () => {
        const files = createSteerFiles(storeOf());
        files.add(KEY, ['/Users/d/shot.png']);
        expect(files.of('s1:plan')).toEqual([]);
    });

    test('the files come back after a reload, from the store', () => {
        const store = storeOf();
        createSteerFiles(store).add(KEY, ['/Users/d/shot.png']);
        expect(createSteerFiles(store).of(KEY)).toEqual(['/Users/d/shot.png']);
    });

    test('a store that refuses its read leaves the box empty, never broken', () => {
        const files = createSteerFiles({
            getItem: () => '{not json',
            removeItem: () => {},
            setItem: () => {},
        });
        expect(files.of(KEY)).toEqual([]);
    });

    test('a cleared steer drops its files', () => {
        const store = storeOf();
        const files = createSteerFiles(store);
        files.add(KEY, ['/Users/d/shot.png']);
        files.clear(KEY);
        expect(createSteerFiles(store).of(KEY)).toEqual([]);
    });
});

describe('a sent steer names each file by its absolute path, one a line', () => {
    test('the steer ends with both paths, a space in a name kept as is', () => {
        const files = createSteerFiles(storeOf());
        files.add(KEY, [
            '/Users/d/CleanShot 2026-11-22 at 19.01.png',
            '/Users/d/notes.pdf',
        ]);
        expect(files.joined(KEY, ' compare the two ')).toBe(
            'compare the two\n/Users/d/CleanShot 2026-11-22 at 19.01.png\n/Users/d/notes.pdf',
        );
    });

    test('files alone, no words, are the whole steer', () => {
        const files = createSteerFiles(storeOf());
        files.add(KEY, ['/Users/d/shot.png']);
        expect(files.joined(KEY, '')).toBe('/Users/d/shot.png');
    });

    test('no files leave the words as typed', () => {
        expect(createSteerFiles(storeOf()).joined(KEY, ' ship it ')).toBe(
            'ship it',
        );
    });
});
