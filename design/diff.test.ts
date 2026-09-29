import { existsSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { expect, it } from 'vitest';

import { runScript, writeTemp } from './lib/run.ts';

it('prints a diff above 0% and writes a diff png when the pngs differ', () => {
    const comp = writeTemp('comp.png', solidPng([255, 255, 255]));
    const shot = writeTemp('shot.png', solidPng([255, 255, 255], [0, 0, 0]));

    const { stdout } = runScript('diff', [comp, shot]);

    expect(Number(stdout.match(/^diff ([\d.]+)%/)?.[1])).toBeGreaterThan(0);
    expect(existsSync(shot.replace(/\.png$/, '.diff.png'))).toBe(true);
});

it('prints 0% for identical pngs', () => {
    const comp = writeTemp('comp.png', solidPng([255, 255, 255]));
    const shot = writeTemp('shot.png', solidPng([255, 255, 255]));

    expect(runScript('diff', [comp, shot]).stdout).toMatch(/^diff 0%/);
});

function solidPng(fill: Rgb, firstPixel: Rgb = fill): Uint8Array {
    const size = 8;
    const row = (index: number) => [
        0,
        ...(index === 0 ? firstPixel : fill),
        ...Array.from({ length: size - 1 }, () => fill).flat(),
    ];
    const pixels = Buffer.from(
        Array.from({ length: size }, (_, index) => row(index)).flat(),
    );
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header.set([8, 2, 0, 0, 0], 8);
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(pixels)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function chunk(type: string, data: Buffer): Buffer {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, checksum]);
}

/* Types */

type Rgb = [number, number, number];
