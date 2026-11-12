import { describe, expect, it, vi } from 'vitest';

vi.mock('herdr', () => ({ appHome: () => '/app', exec: vi.fn() }));
const fs = vi.hoisted(() => ({
    readdir: vi.fn(),
    unlink: vi.fn(async () => {}),
}));
vi.mock('fs/promises', () => ({
    mkdir: vi.fn(),
    readFile: vi.fn(),
    readdir: fs.readdir,
    unlink: fs.unlink,
    writeFile: vi.fn(),
}));
const { parseShots, shotsAfter, shotsWith, shotsWithout, sweepShots } =
    await import('./shots.js');

describe('parseShots', () => {
    it('reads a store of thread addresses to preview paths', () => {
        expect(parseShots('{"t1": ["data/a.png"]}')).toEqual({
            t1: ['data/a.png'],
        });
    });
    it('reads a missing file as empty', () => {
        expect(parseShots(null)).toEqual({});
    });
    it('reads a broken file as empty', () => {
        expect(parseShots('{"t1": [')).toEqual({});
    });
    it('drops a thread whose list is not all paths', () => {
        expect(parseShots('{"t1": [1], "t2": "x", "t3": ["ok.png"]}')).toEqual({
            t3: ['ok.png'],
        });
    });
    it('reads an array as empty', () => {
        expect(parseShots('["a.png"]')).toEqual({});
    });
});

describe('the store per thread', () => {
    it('adds a paste after the thread’s earlier ones', () => {
        expect(shotsWith({ t1: ['a.png'] }, 't1', 'b.png')).toEqual({
            t1: ['a.png', 'b.png'],
        });
    });
    it('clears one thread and keeps the others', () => {
        expect(shotsWithout({ t1: ['a.png'], t2: ['b.png'] }, 't1')).toEqual({
            t2: ['b.png'],
        });
    });
});

describe('shotsAfter', () => {
    const a = 'data/x-herdr-chatter/shots/shot-1000.png';
    const b = 'data/x-herdr-chatter/shots/shot-3000.png';
    it('drops the previews his prompt at that time took', () => {
        expect(shotsAfter({ t1: [a, b] }, 't1', 2000)).toEqual({
            gone: [a],
            store: { t1: [b] },
        });
    });
    it('clears the thread when every preview went', () => {
        expect(shotsAfter({ t1: [a], t2: [b] }, 't1', 2000)).toEqual({
            gone: [a],
            store: { t2: [b] },
        });
    });
    it('keeps the same store when nothing is older', () => {
        const store = { t1: [b] };
        expect(shotsAfter(store, 't1', 2000).store).toBe(store);
    });
});

describe('sweepShots, previews no thread claims', () => {
    it('deletes an old unclaimed preview, keeps every claimed and every fresh one', async () => {
        fs.readdir.mockResolvedValueOnce([
            'shot-1.png',
            'shot-2.png',
            'shot-3.png',
            `shot-${Date.now()}.png`,
            'notes.txt',
        ]);
        fs.unlink.mockClear();
        await sweepShots({
            t1: ['data/x-herdr-chatter/shots/shot-1.png'],
            t2: ['data/x-herdr-chatter/shots/shot-3.png'],
        });
        expect(fs.unlink.mock.calls).toEqual([
            ['/app/data/x-herdr-chatter/shots/shot-2.png'],
        ]);
    });

    it('deletes nothing when the folder is missing', async () => {
        fs.readdir.mockRejectedValueOnce(new Error('ENOENT'));
        fs.unlink.mockClear();
        await sweepShots({});
        expect(fs.unlink).not.toHaveBeenCalled();
    });
});
