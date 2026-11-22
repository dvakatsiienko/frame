import { describe, expect, test, vi } from 'vitest';

vi.mock('herdr', () => ({ appHome: () => '/app', exec: vi.fn() }));
const { createSteerFiles } = await import('./steer-files.js');

const storeOf = () => {
    const kept = new Map<string, string>();
    return {
        getItem: (key: string) => kept.get(key) ?? null,
        key: (index: number) => [...kept.keys()][index] ?? null,
        get length() {
            return kept.size;
        },
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

    test('a store that fills after the first read shows its files (herdr loads it late after a reload)', () => {
        const store = storeOf();
        const files = createSteerFiles(store);
        expect(files.of(KEY)).toEqual([]);
        store.setItem(`steer-files:${KEY}`, '["/Users/d/shot.png"]');
        expect(files.of(KEY)).toEqual(['/Users/d/shot.png']);
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

describe('files leave with their steer, a pasted copy with them (the sixth sense round 1)', () => {
    test('× on a pasted picture hands its path to be forgotten', () => {
        const forget = vi.fn();
        const files = createSteerFiles(storeOf(), forget);
        files.add(KEY, [
            '/app/data/x-herdr-deck/pasted/shot-1.png',
            '/d/a.pdf',
        ]);
        files.remove(KEY, '/app/data/x-herdr-deck/pasted/shot-1.png');
        expect(forget).toHaveBeenCalledWith([
            '/app/data/x-herdr-deck/pasted/shot-1.png',
        ]);
    });

    test('a cleared steer forgets every file it held', () => {
        const forget = vi.fn();
        const files = createSteerFiles(storeOf(), forget);
        files.add(KEY, ['/d/a.png', '/d/b.pdf']);
        files.clear(KEY);
        expect(forget).toHaveBeenCalledWith(['/d/a.png', '/d/b.pdf']);
    });

    test("a live thread's ask that left while herdr was closed loses its files", () => {
        const store = storeOf();
        const files = createSteerFiles(store);
        files.add('s1:o3', ['/d/a.png']);
        files.add('s1:o9', ['/d/b.png']);
        files.sweep(new Set(['s1:o9']), new Set(['s1']));
        expect(files.of('s1:o3')).toEqual([]);
        expect(files.of('s1:o9')).toEqual(['/d/b.png']);
    });

    test('a thread missing from this read keeps its files: a read can miss a live one', () => {
        const files = createSteerFiles(storeOf());
        files.add('s2:o1', ['/d/a.png']);
        files.sweep(new Set(), new Set(['s1']));
        expect(files.of('s2:o1')).toEqual(['/d/a.png']);
    });
});
