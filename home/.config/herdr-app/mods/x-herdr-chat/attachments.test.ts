import { describe, expect, test, vi } from 'vitest';

// the pure halves of attach.js and shots.js are what this reads; their herdr and fs doors stay shut
vi.mock('herdr', () => ({ appHome: () => '/app', exec: vi.fn() }));
vi.mock('fs/promises', () => ({}));
const { createAttachments } = await import('./attachments.js');

const HOME = '/app';
const pasted = 'data/x-herdr-chat/shots/shot-1.png';

const setup = (store = {}) => {
    const io = {
        deleteCopies: vi.fn(),
        makePreview: vi.fn(
            async (path: string, at: number): Promise<string | null> =>
                `data/x-herdr-chat/shots/shot-${at}.png`,
        ),
        now: () => 100,
        save: vi.fn(),
    };
    const files = createAttachments(HOME, io, store);
    return { files, io };
};

describe('a thread’s attachments, one owner (FRM-638 slice 5)', () => {
    test('a reload brings back the pasted pictures that waited', () => {
        const { files } = setup({ 't1 files': [pasted] });
        expect(files.of('t1')).toEqual([
            { path: `${HOME}/${pasted}`, preview: pasted },
        ]);
    });

    test('a pasted picture is its own preview, kept for a reload', () => {
        const { files, io } = setup();
        files.paste('t1', pasted);
        expect(files.of('t1')).toEqual([
            { path: `${HOME}/${pasted}`, preview: pasted },
        ]);
        expect(io.save).toHaveBeenLastCalledWith({ 't1 files': [pasted] });
    });

    test('a dropped picture waits for its scaled preview, then shows it', async () => {
        const { files } = setup();
        await files.add('t1', ['/Users/d/a.png']);
        expect(files.of('t1')).toEqual([
            {
                path: '/Users/d/a.png',
                preview: 'data/x-herdr-chat/shots/shot-100.png',
            },
        ]);
    });

    test('a file that is no picture has no preview', async () => {
        const { files, io } = setup();
        await files.add('t1', ['/Users/d/notes.md']);
        expect(files.of('t1')).toEqual([
            { path: '/Users/d/notes.md', preview: null },
        ]);
        expect(io.makePreview).not.toHaveBeenCalled();
    });

    test('a file added twice waits once', async () => {
        const { files } = setup();
        await files.add('t1', ['/Users/d/notes.md', '/Users/d/notes.md']);
        await files.add('t1', ['/Users/d/notes.md']);
        expect(files.of('t1')).toHaveLength(1);
    });

    test('a picture removed while its preview is made leaves no copy behind', async () => {
        const { files, io } = setup();
        const adding = files.add('t1', ['/Users/d/a.png']);
        files.remove('t1', '/Users/d/a.png');
        await adding;
        expect(files.of('t1')).toEqual([]);
        expect(io.deleteCopies).toHaveBeenCalledWith([
            'data/x-herdr-chat/shots/shot-100.png',
        ]);
    });

    test('× on a dropped picture removes its scaled copy, never the picture', async () => {
        const { files, io } = setup();
        await files.add('t1', ['/Users/d/a.png']);
        files.remove('t1', '/Users/d/a.png');
        expect(io.deleteCopies).toHaveBeenLastCalledWith([
            'data/x-herdr-chat/shots/shot-100.png',
        ]);
    });

    test('× on a pasted picture keeps its file: it is his shot', () => {
        const { files, io } = setup();
        files.paste('t1', pasted);
        files.remove('t1', `${HOME}/${pasted}`);
        expect(files.of('t1')).toEqual([]);
        expect(io.deleteCopies).toHaveBeenLastCalledWith([]);
        expect(io.save).toHaveBeenLastCalledWith({});
    });

    test('taken by a send, all of a thread’s files leave and the others’ stay', async () => {
        const { files } = setup();
        files.paste('t1', pasted);
        await files.add('t2', ['/Users/d/notes.md']);
        expect(files.take('t1')).toEqual([`${HOME}/${pasted}`]);
        expect(files.of('t1')).toEqual([]);
        expect(files.of('t2')).toHaveLength(1);
    });

    test('a preview that could not be made leaves the picture waiting without one', async () => {
        const { files, io } = setup();
        io.makePreview.mockResolvedValueOnce(null);
        await files.add('t1', ['/Users/d/a.png']);
        expect(files.of('t1')).toEqual([
            { path: '/Users/d/a.png', preview: null },
        ]);
    });
});
