import { describe, expect, it, vi } from 'vitest';

vi.mock('herdr', () => ({ appHome: () => '/app', exec: vi.fn() }));
vi.mock('fs/promises', () => ({
    mkdir: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn(),
    writeFile: vi.fn(),
}));
const { parseShots, previewCopies, thumbName, waitingFiles, withWaitingFiles } =
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

describe('a pasted image waits as a file', () => {
    const rel = 'data/x-herdr-chat/shots/shot-1000.png';
    const path = `/app/${rel}`;
    it('keeps a pasted png in the thread’s waiting files', () => {
        expect(withWaitingFiles({}, 't1', [path], '/app')).toEqual({
            't1 files': [rel],
        });
    });
    it('keeps a file dropped from elsewhere by its own path, so a reload brings it back', () => {
        const store = withWaitingFiles(
            {},
            't1',
            ['/Users/d/a.png', path],
            '/app',
        );
        expect(store).toEqual({ 't1 files': ['/Users/d/a.png', rel] });
        expect(waitingFiles(store, '/app')).toEqual([
            ['t1', ['/Users/d/a.png', path]],
        ]);
    });
    it('drops it from the store once × takes it', () => {
        const store = { 't1 files': [rel], 't2 files': ['x.png'] };
        expect(withWaitingFiles(store, 't1', [], '/app')).toEqual({
            't2 files': ['x.png'],
        });
    });
    it('brings it back as its path after a reload', () => {
        expect(
            waitingFiles({ 't1 files': [rel], t2: ['old.png'] }, '/app'),
        ).toEqual([['t1', [path]]]);
    });
});

describe('previewCopies, which previews may be removed', () => {
    const pasted = 'data/x-herdr-chat/shots/shot-1.png';
    const copy = 'data/x-herdr-chat/shots/shot-2.png';

    it('a pasted picture is his shot and is never removed, however old', () => {
        expect(
            previewCopies([{ path: `/app/${pasted}`, rel: pasted }], '/app'),
        ).toEqual([]);
    });

    it("a dropped picture's scaled copy is removed, its file is not named", () => {
        expect(
            previewCopies(
                [
                    { path: '/Users/dima/Desktop/a.png', rel: copy },
                    { path: `/app/${pasted}`, rel: pasted },
                    { path: '/Users/dima/Desktop/b.png', rel: null },
                ],
                '/app',
            ),
        ).toEqual([copy]);
    });
});

describe('thumbName, one file per picture', () => {
    it('keeps two paths a 31-hash alone confuses apart', () => {
        expect(thumbName('/tmp/Aa.png')).not.toBe(thumbName('/tmp/BB.png'));
    });
});
