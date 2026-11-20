import { describe, expect, test } from 'vitest';

import { fileLinks } from './file-links.js';

const HOME = '/Users/dima';

describe("a reply's files each get one row (FRM-587)", () => {
    test('a bare path to a picture', () => {
        expect(fileLinks('the shot: /tmp/looks/a.png', HOME)).toEqual([
            { label: 'a.png', path: '/tmp/looks/a.png' },
        ]);
    });

    test('a ~ path opens under his home', () => {
        expect(
            fileLinks(
                'see ~/.local/state/looks/PK-384/1455-meter-ab.png',
                HOME,
            ),
        ).toEqual([
            {
                label: '1455-meter-ab.png',
                path: '/Users/dima/.local/state/looks/PK-384/1455-meter-ab.png',
            },
        ]);
    });

    // wisphunter 14:30: a link's own label hid which file a click opens
    test('a file:// link is named by its file, never its label', () => {
        expect(
            fileLinks('see [the shot](file:///Users/dima/a%20b.png)', HOME),
        ).toEqual([{ label: 'a b.png', path: '/Users/dima/a b.png' }]);
    });

    test('a path with a line number gets its row', () => {
        expect(
            fileLinks(
                'see /Users/dima/frame/x/main.js:2105 and /tmp/a.ts:4-9',
                HOME,
            ),
        ).toEqual([
            { label: 'main.js', path: '/Users/dima/frame/x/main.js' },
            { label: 'a.ts', path: '/tmp/a.ts' },
        ]);
    });

    test('a file:// autolink reads as its file name', () => {
        expect(fileLinks('<file:///tmp/x.md>', HOME)).toEqual([
            { label: 'x.md', path: '/tmp/x.md' },
        ]);
    });

    test('a path inside a fenced block gets no row', () => {
        expect(fileLinks('```\n/tmp/a.png\n```', HOME)).toEqual([]);
    });

    test('a path ending a sentence drops its period or comma', () => {
        expect(
            fileLinks('it is /tmp/a.png. and /tmp/b.png, too', HOME),
        ).toEqual([
            { label: 'a.png', path: '/tmp/a.png' },
            { label: 'b.png', path: '/tmp/b.png' },
        ]);
    });

    test('a space escaped with a backslash stays in the path', () => {
        expect(fileLinks('open /tmp/Clean\\ Shot.png now', HOME)).toEqual([
            { label: 'Clean Shot.png', path: '/tmp/Clean Shot.png' },
        ]);
    });

    test('a quoted path keeps its spaces', () => {
        expect(fileLinks('open "/tmp/Clean Shot.png" now', HOME)).toEqual([
            { label: 'Clean Shot.png', path: '/tmp/Clean Shot.png' },
        ]);
    });

    test('the same path twice is one row', () => {
        expect(fileLinks('/tmp/a.png and again /tmp/a.png', HOME)).toEqual([
            { label: 'a.png', path: '/tmp/a.png' },
        ]);
    });

    test('a folder with no extension, a web link and a relative path get no row', () => {
        expect(
            fileLinks('/tmp/dir https://x.dev/a.png ./a.png src/a.png', HOME),
        ).toEqual([]);
    });
});
