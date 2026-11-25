import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';

const herdr = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('herdr', () => ({ exec: herdr.exec }));
const { isOnDisk, onDisk } = await import('./disk.js');

const dir = mkdtempSync(join(tmpdir(), 'disk-'));
writeFileSync(join(dir, "a b'$x.md"), '');
const real = async (program: string, args: string[]) => {
    const ran = spawnSync(program, args, { encoding: 'utf8' });
    return { code: ran.status ?? 1, stdout: ran.stdout };
};

// herdr's own `exists` throws at once for a path outside his home: a picture in a scratchpad opened nothing
test('each path answers for itself, whatever its name, outside his home too', async () => {
    herdr.exec.mockImplementation(real);
    const there = join(dir, "a b'$x.md");
    expect(await onDisk([there, join(dir, 'gone'), dir])).toEqual([
        true,
        false,
        true,
    ]);
    expect(await isOnDisk(there)).toBe(true);
});

test('a look that failed reads as not there', async () => {
    herdr.exec.mockRejectedValue(new Error('no'));
    expect(await onDisk([dir])).toEqual([false]);
});
