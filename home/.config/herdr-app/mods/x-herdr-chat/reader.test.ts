import { describe, expect, test } from 'vitest';

import { createReader, utf8Length } from './reader.js';

const SLICE = 64;

/** a transcript file held in memory, with a log of every byte range read from it */
function fakeFile(start = '') {
    let bytes = Buffer.from(start, 'utf8');
    const reads: { from: number; to: number }[] = [];
    let failNext = false;
    return {
        append(text: string) {
            bytes = Buffer.concat([bytes, Buffer.from(text, 'utf8')]);
        },
        door: {
            lineStartAt: async (at: number) => {
                const newline = bytes.indexOf(0x0a, Math.max(0, at));
                return newline === -1 ? bytes.length : newline + 1;
            },
            read: async (from: number, max: number) => {
                if (failNext) {
                    failNext = false;
                    throw new Error('read failed');
                }
                const to = Math.min(bytes.length, from + max);
                reads.push({ from, to });
                return bytes.subarray(from, to).toString('utf8');
            },
            sizeOf: async (): Promise<number | null> => bytes.length,
        },
        failNextRead() {
            failNext = true;
        },
        reads,
        replace(text: string) {
            bytes = Buffer.from(text, 'utf8');
        },
    };
}

const line = (n: number) => `{"n":${n}}`;

describe('utf8Length', () => {
    test.each([
        ['', 0],
        ['abc', 3],
        ['привіт', 12],
        ['🦉', 4],
        ['a🦉б\n', 8],
    ])('%j is %i bytes', (text, bytes) => {
        expect(utf8Length(text)).toBe(bytes);
        expect(utf8Length(text)).toBe(Buffer.byteLength(text, 'utf8'));
    });
});

describe('the transcript reader hands on only complete new lines', () => {
    test('lines appended after a read come alone, in order', async () => {
        const file = fakeFile(`${line(1)}\n`);
        const reader = createReader(file.door, { slice: SLICE });
        expect((await reader.readNew()).lines).toEqual([line(1)]);
        file.append(`${line(2)}\n${line(3)}\n`);
        expect((await reader.readNew()).lines).toEqual([line(2), line(3)]);
        expect((await reader.readNew()).lines).toEqual([]);
    });

    test('half a JSON line emits nothing until its rest arrives', async () => {
        const file = fakeFile(`${line(1)}\n{"n":`);
        const reader = createReader(file.door, { slice: SLICE });
        expect((await reader.readNew()).lines).toEqual([line(1)]);
        expect((await reader.readNew()).lines).toEqual([]);
        file.append('2}\n');
        expect((await reader.readNew()).lines).toEqual([line(2)]);
    });

    test('nothing before the last read is read again', async () => {
        const file = fakeFile(`${line(1)}\n${line(2)}\n`);
        const reader = createReader(file.door, { slice: SLICE });
        await reader.readNew();
        const readSoFar = Buffer.byteLength(`${line(1)}\n${line(2)}\n`);
        file.reads.length = 0;
        file.append(`${line(3)}\n`);
        await reader.readNew();
        expect(file.reads.every((r) => r.from >= readSoFar)).toBe(true);
        expect(file.reads.length).toBe(1);
    });

    test('a file that got shorter is read again from its start, and says so', async () => {
        const file = fakeFile(`${line(1)}\n${line(2)}\n`);
        const reader = createReader(file.door, { slice: SLICE });
        expect((await reader.readNew()).isRestart).toBe(false);
        file.replace(`${line(9)}\n`);
        expect(await reader.readNew()).toEqual({
            isRestart: true,
            lines: [line(9)],
        });
    });

    test('letters wider than one byte keep the place exact', async () => {
        const file = fakeFile('{"t":"привіт 🦉"}\n');
        const reader = createReader(file.door, { slice: SLICE });
        expect((await reader.readNew()).lines).toEqual(['{"t":"привіт 🦉"}']);
        file.append('{"t":"далі"}\n');
        expect((await reader.readNew()).lines).toEqual(['{"t":"далі"}']);
    });

    test('a line longer than one slice arrives whole', async () => {
        const long = `{"t":"${'x'.repeat(SLICE * 3)}"}`;
        const file = fakeFile(`${line(1)}\n`);
        const reader = createReader(file.door, { slice: SLICE });
        await reader.readNew();
        file.append(`${long}\n${line(2)}\n`);
        expect((await reader.readNew()).lines).toEqual([long, line(2)]);
    });

    test('a long file opens at its last slice, on a line start', async () => {
        const lines = Array.from({ length: 40 }, (_, i) => line(i));
        const file = fakeFile(`${lines.join('\n')}\n`);
        const reader = createReader(file.door, { slice: SLICE });
        const first = (await reader.readNew()).lines;
        expect(first.length).toBeGreaterThan(0);
        expect(first.length).toBeLessThan(40);
        expect(first).toEqual(lines.slice(-first.length));
    });

    test('a transcript past 4 MB opens at its tail, and one appended line costs one read from the old end', async () => {
        const row = `{"t":"${'x'.repeat(1000)}"}`;
        const file = fakeFile(`${Array(5000).fill(row).join('\n')}\n`);
        const size = (await file.door.sizeOf()) ?? 0;
        const reader = createReader(file.door);
        const first = (await reader.readNew()).lines;
        expect(size).toBeGreaterThan(4 * 1024 * 1024);
        expect(first.length).toBeLessThan(5000);
        expect(file.reads[0]?.from).toBeGreaterThanOrEqual(
            size - 4 * 1024 * 1024,
        );
        file.reads.length = 0;
        file.append(`${line(7)}\n`);
        expect((await reader.readNew()).lines).toEqual([line(7)]);
        expect(file.reads).toEqual([{ from: size, to: size + 8 }]);
    });

    test('earlier pages come on ask, with no gap and no repeat, until the start', async () => {
        const lines = Array.from({ length: 40 }, (_, i) => line(i));
        const file = fakeFile(`${lines.join('\n')}\n`);
        const reader = createReader(file.door, { slice: SLICE });
        let seen = (await reader.readNew()).lines;
        for (let i = 0; i < 40 && reader.hasEarlier(); i++)
            seen = [...(await reader.readEarlier()), ...seen];
        expect(seen).toEqual(lines);
        expect(await reader.readEarlier()).toEqual([]);
    });

    test('a failed read rejects and loses no line', async () => {
        const file = fakeFile(`${line(1)}\n`);
        const reader = createReader(file.door, { slice: SLICE });
        file.failNextRead();
        await expect(reader.readNew()).rejects.toThrow('read failed');
        expect((await reader.readNew()).lines).toEqual([line(1)]);
    });

    test('two reads asked at once hand each line on once', async () => {
        const file = fakeFile(`${line(1)}\n${line(2)}\n`);
        const reader = createReader(file.door, { slice: SLICE });
        const [a, b] = await Promise.all([reader.readNew(), reader.readNew()]);
        expect([...a.lines, ...b.lines]).toEqual([line(1), line(2)]);
    });

    test('a file that is gone reads as empty, then as a restart when it is back', async () => {
        const file = fakeFile(`${line(1)}\n`);
        const reader = createReader(file.door, { slice: SLICE });
        await reader.readNew();
        const size = file.door.sizeOf;
        file.door.sizeOf = async () => null;
        expect(await reader.readNew()).toEqual({ isRestart: false, lines: [] });
        file.door.sizeOf = size;
        file.replace(`${line(5)}\n`);
        expect(await reader.readNew()).toEqual({
            isRestart: true,
            lines: [line(5)],
        });
    });
});
