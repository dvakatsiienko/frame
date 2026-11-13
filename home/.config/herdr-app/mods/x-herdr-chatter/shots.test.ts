import { execFileSync } from 'node:child_process';
import { platform } from 'node:os';
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
const {
    MAC_CLIPBOARD_IMAGE,
    clipboardRead,
    parseShots,
    sweepShots,
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
    const rel = 'data/x-herdr-chatter/shots/shot-1000.png';
    const path = `/app/${rel}`;
    it('keeps a pasted png in the thread’s waiting files', () => {
        expect(withWaitingFiles({}, 't1', [path], '/app')).toEqual({
            't1 files': [rel],
        });
    });
    it('leaves a file dropped from elsewhere out of the store', () => {
        expect(
            withWaitingFiles({}, 't1', ['/Users/d/a.png', path], '/app'),
        ).toEqual({ 't1 files': [rel] });
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

describe('what a paste with no text found on the clipboard', () => {
    const rel = 'data/x-herdr-chatter/shots/shot-1.png';
    it('an image, saved as a png', () => {
        expect(clipboardRead('image\n', rel)).toEqual({ rel });
    });
    it('files copied in Finder, attached by their paths, never their icon', () => {
        expect(
            clipboardRead('files\n/Users/d/a.pdf\n/Users/d/b c.png\n', rel),
        ).toEqual({
            paths: ['/Users/d/a.pdf', '/Users/d/b c.png'],
        });
    });
    it('nothing it can attach', () => {
        expect(clipboardRead('', rel)).toBeNull();
    });
});

// the real clipboard script on a private pasteboard, never his clipboard: a text paste stays text
describe.runIf(platform() === 'darwin')(
    'a text paste never reads as a file or an image',
    () => {
        const board = `x-chatter-test-${process.pid}`;
        // macOS's own: the block runs only on a mac, the linux ci skips it, so no ci job installs it
        const osascript = 'osascript';
        const put = (text: string) =>
            execFileSync(
                osascript,
                [
                    '-l',
                    'JavaScript',
                    '-e',
                    'ObjC.import("AppKit"); function run(a) { const pb = $.NSPasteboard.pasteboardWithName(a[0]); pb.clearContents; pb.setStringForType(a[1], $.NSPasteboardTypeString); return ""; }',
                    board,
                    text,
                ],
                { timeout: 10_000 },
            );
        const read = () =>
            clipboardRead(
                execFileSync(
                    osascript,
                    [
                        '-l',
                        'JavaScript',
                        '-e',
                        MAC_CLIPBOARD_IMAGE,
                        '/dev/null',
                        board,
                    ],
                    { encoding: 'utf8', timeout: 10_000 },
                ),
                'data/x-herdr-chatter/shots/shot-1.png',
            );
        it('a line of text', () => {
            put('ship it');
            expect(read()).toBeNull();
        });
        it('several lines, a path among them', () => {
            put(
                'first line\n/Users/dima/frame/README.md\nfile:///Users/dima/a.png',
            );
            expect(read()).toBeNull();
        });
    },
);
