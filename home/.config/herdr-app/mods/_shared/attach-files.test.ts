/// <reference types="node" />
import { execFileSync } from 'node:child_process';
import { platform } from 'node:os';
import { describe, expect, it, vi } from 'vitest';

vi.mock('herdr', () => ({ appHome: () => '/app', exec: vi.fn() }));
vi.mock('fs/promises', () => ({ mkdir: vi.fn() }));
const { MAC_CLIPBOARD_IMAGE, clipboardRead, withFiles } = await import(
    './attach-files.js'
);

describe('what a paste with no text found on the clipboard', () => {
    const rel = 'data/x-herdr-chat/shots/shot-1.png';
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
                'data/x-herdr-chat/shots/shot-1.png',
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

describe('withFiles', () => {
    it('adds new paths after the waiting ones', () => {
        expect(withFiles(['/a'], ['/b', '/c'])).toEqual(['/a', '/b', '/c']);
    });
    it('keeps a path once when it comes again', () => {
        expect(withFiles(['/a'], ['/a', '/b', '/b'])).toEqual(['/a', '/b']);
    });
});
