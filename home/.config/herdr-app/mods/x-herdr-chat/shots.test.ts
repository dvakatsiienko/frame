import { describe, expect, it, vi } from 'vitest';

const herdr = vi.hoisted(() => ({
    exec: vi.fn(),
    unlink: vi.fn(),
}));
vi.mock('herdr', () => ({ appHome: () => '/app', exec: herdr.exec }));
vi.mock('fs/promises', () => ({
    mkdir: vi.fn(),
    readFile: vi.fn(),
    unlink: herdr.unlink,
    writeFile: vi.fn(),
}));
const {
    parseShots,
    previewCopies,
    thumbName,
    viewCopy,
    waitingFiles,
    withWaitingFiles,
} = await import('./shots.js');

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

describe('a picture opened whole', () => {
    // a small disk: each file's width, 0 for one that is no picture
    const disk = (files: Record<string, number>, refused: string[] = []) => {
        herdr.unlink.mockImplementation(async (p: string) => {
            delete files[p];
        });
        herdr.exec.mockImplementation(async (cmd: string, args: string[]) => {
            const [from = '', to = ''] = args.slice(-2);
            // disk.js: a line for each path asked
            if (cmd === '/bin/sh')
                return {
                    code: 0,
                    stdout: args
                        .slice(3)
                        .map((p) => `${p in files ? 1 : 0}\n`)
                        .join(''),
                };
            if (cmd === 'sips')
                return {
                    code: 0,
                    stdout: files[to]
                        ? `pixelWidth: ${files[to]}\npixelHeight: 4`
                        : '',
                };
            if (!(from in files)) return { code: 1, stdout: '' };
            files[to] = files[from] ?? 0;
            // a full disk: it wrote some, then failed
            if (refused.includes(from)) return { code: 1, stdout: '' };
            if (cmd === 'mv') delete files[from];
            return { code: 0, stdout: '' };
        });
        return files;
    };
    const A = '/tmp/pad/a.png';

    it('shows from a fresh copy of its file', async () => {
        const files = disk({ [A]: 8 });
        const made = await viewCopy(A);
        expect(made).toMatchObject({ isEarlier: false, w: 8 });
        expect(Object.keys(files)).toEqual([A, `/app/${made?.rel}`]);
        files[A] = 9;
        expect(await viewCopy(A)).toMatchObject({ isEarlier: false, w: 9 });
    });

    it('opened twice at once, both openings show it', async () => {
        const files = disk({ [A]: 8 });
        const made = await Promise.all([viewCopy(A), viewCopy(A)]);
        expect(made.map((m) => m?.w)).toEqual([8, 8]);
        expect(Object.keys(files)).toHaveLength(2);
    });

    it('is never copied when it is herdr’s own', async () => {
        const files = disk({ '/app/data/shot.png': 8 });
        expect(await viewCopy('/app/data/shot.png')).toMatchObject({
            isEarlier: false,
            rel: 'data/shot.png',
        });
        expect(Object.keys(files)).toEqual(['/app/data/shot.png']);
    });

    it('shows from the copy an earlier opening left, once its file is gone, and says so', async () => {
        const files = disk({ [A]: 8 });
        await viewCopy(A);
        delete files[A];
        expect(await viewCopy(A)).toMatchObject({ isEarlier: true, w: 8 });
    });

    it('is none once its file is gone and it was never opened', async () => {
        disk({});
        expect(await viewCopy(A)).toBeNull();
    });

    it.each([
        ['cannot be copied', [A], 9],
        ['is no whole picture', [], 0],
    ])('never an earlier copy for a file that %s', async (_why, refused, w) => {
        const files = disk({ [A]: 8 });
        const made = await viewCopy(A);
        disk(Object.assign(files, { [A]: w }), refused);
        expect(await viewCopy(A)).toBeNull();
        // the earlier copy stays whole for the day its file is gone
        expect(files).toEqual({ [A]: w, [`/app/${made?.rel}`]: 8 });
    });
});
