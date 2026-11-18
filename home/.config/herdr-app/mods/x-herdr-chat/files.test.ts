import { describe, expect, test } from 'vitest';

import { fileLinks, unlinkFiles } from './files.js';

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

    test('a file:// link gives its label and its decoded path', () => {
        expect(
            fileLinks('see [the shot](file:///Users/dima/a%20b.png)', HOME),
        ).toEqual([{ label: 'the shot', path: '/Users/dima/a b.png' }]);
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

describe('a file:// link in the text reads plain while herdr-app#894 is open', () => {
    test('a markdown link reads as its label, an autolink as its file name', () => {
        expect(
            unlinkFiles(
                'see [the shot](file:///tmp/a.png) and <file:///tmp/b.md>',
            ),
        ).toBe('see the shot and b.md');
    });

    test('a link inside code and a web link stay as written', () => {
        const text = '`[a](file:///tmp/a)` [w](https://x.dev)';
        expect(unlinkFiles(text)).toBe(text);
    });
});
