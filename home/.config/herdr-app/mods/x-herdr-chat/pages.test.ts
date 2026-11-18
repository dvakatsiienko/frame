import { describe, expect, test } from 'vitest';

import { createPages } from './pages.js';

// a reader as reader.js hands it out: pages above what was read, one at a time
function fakeReader(pageCount: number) {
    let left = pageCount;
    let reads = 0;
    /** @type {((lines: string[]) => void)[]} */
    const pending: ((lines: string[]) => void)[] = [];
    return {
        hasEarlier: () => left > 0,
        land() {
            left -= 1;
            pending.shift()?.([`line ${left}`]);
        },
        readEarlier() {
            reads += 1;
            return new Promise<string[]>((resolve) => pending.push(resolve));
        },
        get reads() {
            return reads;
        },
    };
}

describe('older history comes a page at a time, from one owner (FRM-638 slice 6b)', () => {
    test('a page is asked once while it is read: a fast scroll at the top never reads two', async () => {
        const reader = fakeReader(3);
        const pages = createPages(reader);
        const first = pages.next();
        expect(pages.next()).toBeNull();
        expect(pages.isReading()).toBe(true);
        reader.land();
        expect(await first).toEqual(['line 2']);
        expect(reader.reads).toBe(1);
        expect(pages.isReading()).toBe(false);
    });

    test('the next page is asked once the one before landed', async () => {
        const reader = fakeReader(3);
        const pages = createPages(reader);
        const first = pages.next();
        reader.land();
        await first;
        const second = pages.next();
        expect(second).not.toBeNull();
        reader.land();
        expect(await second).toEqual(['line 1']);
    });

    test('at the thread’s start nothing more is asked', async () => {
        const reader = fakeReader(1);
        const pages = createPages(reader);
        const only = pages.next();
        reader.land();
        await only;
        expect(pages.isStart()).toBe(true);
        expect(pages.next()).toBeNull();
        expect(reader.reads).toBe(1);
    });

    test('a thread that fits its first read is at its start at once', () => {
        const pages = createPages(fakeReader(0));
        expect(pages.isStart()).toBe(true);
        expect(pages.next()).toBeNull();
    });

    test('a read that fails leaves the next ask free', async () => {
        const pages = createPages({
            hasEarlier: () => true,
            readEarlier: () => Promise.reject(new Error('gone')),
        });
        await expect(pages.next()).rejects.toThrow('gone');
        expect(pages.isReading()).toBe(false);
    });
});

describe('a page for a thread he left (FRM-638 slice 6b)', () => {
    test('a page still read when he switches threads lands as nothing, and none is asked after', async () => {
        const reader = fakeReader(3);
        const pages = createPages(reader);
        const late = pages.next();
        pages.close();
        reader.land();
        expect(await late).toEqual([]);
        expect(pages.next()).toBeNull();
        expect(reader.reads).toBe(1);
    });
});
