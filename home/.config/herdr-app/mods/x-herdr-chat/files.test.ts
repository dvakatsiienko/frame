import { describe, expect, test } from 'vitest';

import {
    fileAt,
    fileLinks,
    isSentRow,
    openArgs,
    replyIdOf,
    unlinkFiles,
    withFileRows,
} from './files.js';
import type { Row } from './row-model.js';

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

describe("a reply's files are rows of their own in the list, so a click on one can open it (FRM-587)", () => {
    const reply = (id: string, text: string, version = 1): Row => ({
        at: null,
        delivery: null,
        files: [],
        id,
        isTurnStart: false,
        isWaiting: false,
        kind: 'reply',
        pictures: [],
        replyId: null,
        text,
        tools: [],
        version,
    });

    test('each file a reply names follows it as a file row', () => {
        const rows = withFileRows(
            [reply('r1', 'see /tmp/a.png and /tmp/b.md')],
            HOME,
            new Map(),
        );
        expect(rows.map((r) => [r.kind, r.id, r.text, r.path])).toEqual([
            ['reply', 'r1', 'see /tmp/a.png and /tmp/b.md', undefined],
            ['file', 'r1#pictures', 'a.png', undefined],
            ['file', 'r1#file-1', 'b.md', '/tmp/b.md'],
        ]);
    });

    test("a reply's pictures are one row of squares, in the order it names them", () => {
        const rows = withFileRows(
            [reply('r1', '/tmp/a.png, /tmp/x.md and /tmp/b.jpg')],
            HOME,
            new Map(),
        );
        expect(rows[1]?.pictures.map((p) => [p.id, p.path])).toEqual([
            ['r1#file-0', '/tmp/a.png'],
            ['r1#file-2', '/tmp/b.jpg'],
        ]);
        expect(rows.map((r) => r.id)).toEqual([
            'r1',
            'r1#pictures',
            'r1#file-1',
        ]);
    });

    test('his own messages and tool rows get no file rows', () => {
        const mine = {
            ...reply('m1', '/tmp/a.png'),
            kind: 'mine' as const,
        };
        expect(withFileRows([mine], HOME, new Map())).toEqual([mine]);
    });

    test('a file row keeps its object while its reply does not change, so its height is kept', () => {
        const cache = new Map();
        const first = withFileRows([reply('r1', '/tmp/a.png')], HOME, cache);
        const again = withFileRows([reply('r1', '/tmp/a.png')], HOME, cache);
        expect(again[1]).toBe(first[1]);
    });

    test('a reply that grew is read again', () => {
        const cache = new Map();
        withFileRows([reply('r1', '/tmp/a.png')], HOME, cache);
        const grown = withFileRows(
            [reply('r1', '/tmp/a.png /tmp/c.md', 2)],
            HOME,
            cache,
        );
        expect(grown.map((r) => r.id)).toEqual([
            'r1',
            'r1#pictures',
            'r1#file-1',
        ]);
    });

    test('a click names its file through the row key, a cut half included', () => {
        const rows = withFileRows([reply('r1', '/tmp/a.md')], HOME, new Map());
        expect(fileAt(rows, 'r1#file-0')).toBe('/tmp/a.md');
        expect(fileAt(rows, 'r1#file-0#below')).toBe('/tmp/a.md');
        expect(fileAt(rows, 'r1')).toBeNull();
    });
});

describe('a file that would run is shown in Finder, never opened (wisphunter 14:30)', () => {
    test.each([
        '/tmp/x.command',
        '/Applications/Mail.app',
        '/tmp/run.tool',
        '/tmp/a.pkg',
    ])('%s is revealed', (path) =>
        expect(openArgs(path)).toEqual(['-R', path]),
    );

    test('a picture or a document opens in its app', () => {
        expect(openArgs('/tmp/a.png')).toEqual(['/tmp/a.png']);
        expect(openArgs('/tmp/notes.md')).toEqual(['/tmp/notes.md']);
    });

    // dima, 19 Nov 17:53: «they open in apple music»
    test.each(['/tmp/A.mp3', '/tmp/b.M4A', '/tmp/c.wav', '/tmp/d.flac'])(
        '%s opens in the audio app his settings name',
        (path) => expect(openArgs(path, 'IINA')).toEqual(['-a', 'IINA', path]),
    );

    test('audio with no app named opens in the system’s choice', () => {
        expect(openArgs('/tmp/A.mp3', null)).toEqual(['/tmp/A.mp3']);
    });
});

describe('a reading place saved on a file row is found by its reply (wisphunter 14:30)', () => {
    test('a file row names its reply', () => {
        expect(replyIdOf('r1#file-2')).toBe('r1');
    });

    test('any other row is its own', () => {
        expect(replyIdOf('r1')).toBe('r1');
    });
});

describe('his files are a row of their own under his words (wisphunter, slice 5)', () => {
    const his = (pictures: number, version = 1) => ({
        at: null,
        delivery: null,
        files: [],
        id: 'm1',
        isTurnStart: true,
        isWaiting: false,
        kind: 'mine' as const,
        pictures: Array.from({ length: pictures }, (_, n) => ({
            data: null,
            id: `m1-${n}`,
            media: null,
            path: `/tmp/${n}.png`,
        })),
        replyId: null,
        text: 'look',
        tools: [],
        version,
    });

    test('a message with pictures is followed by its squares row, a click there names them', () => {
        const rows = withFileRows([his(2)], HOME, new Map());
        expect(rows.map((r) => [r.id, r.kind])).toEqual([
            ['m1', 'mine'],
            ['m1#sent', 'file'],
        ]);
        expect(isSentRow('m1#sent')).toBe(true);
        expect(rows[1]?.pictures).toHaveLength(2);
    });

    test('words alone get no row, and the squares row keeps its object until the message changes', () => {
        expect(withFileRows([his(0)], HOME, new Map())).toHaveLength(1);
        const cache = new Map();
        const first = withFileRows([his(1)], HOME, cache)[1];
        expect(withFileRows([his(1)], HOME, cache)[1]).toBe(first);
        expect(withFileRows([his(1, 2)], HOME, cache)[1]).not.toBe(first);
    });
});

describe('a tool call row names its fold for a saved place (wisphunter, slice 6)', () => {
    test('#call-N goes back to its tool row', () => {
        expect(replyIdOf('u-1#call-2')).toBe('u-1');
        expect(replyIdOf('u-1#file-0')).toBe('u-1');
    });
});
