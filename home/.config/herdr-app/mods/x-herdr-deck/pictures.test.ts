import { describe, expect, test } from 'vitest';

import {
    attachmentsOf,
    cardFiles,
    pressPicture,
    previewSize,
    viewerOf,
} from './pictures.js';

const HOME = '/Users/dima';
const ask = (text: string, link: string | null = null) => ({ link, text });

describe("an ask's files: its link first, then the paths its text names (FRM-676)", () => {
    test('a png link and a jpg in the text are two pictures in that order, a pdf is a file', () => {
        expect(
            attachmentsOf(
                ask(
                    'compare with /tmp/b.jpg, notes in /tmp/c.pdf',
                    '/tmp/a.png',
                ),
                HOME,
            ),
        ).toEqual([
            {
                isLink: true,
                isPicture: true,
                name: 'a.png',
                path: '/tmp/a.png',
            },
            {
                isLink: false,
                isPicture: true,
                name: 'b.jpg',
                path: '/tmp/b.jpg',
            },
            {
                isLink: false,
                isPicture: false,
                name: 'c.pdf',
                path: '/tmp/c.pdf',
            },
        ]);
    });

    test('a ~ link opens under his home, and the text naming it again adds nothing', () => {
        expect(
            attachmentsOf(ask('the shot ~/s/a.png', '~/s/a.png'), HOME),
        ).toEqual([
            {
                isLink: true,
                isPicture: true,
                name: 'a.png',
                path: '/Users/dima/s/a.png',
            },
        ]);
    });

    test('a web link is no file, and an ask with no path has none', () => {
        expect(
            attachmentsOf(ask('see it', 'https://x.dev/a.png'), HOME),
        ).toEqual([]);
        expect(attachmentsOf(ask('pick one'), HOME)).toEqual([]);
    });

    test('jpeg, gif and webp are pictures too, any case', () => {
        expect(
            attachmentsOf(ask('/tmp/a.JPEG /tmp/b.gif /tmp/c.webp'), HOME).map(
                (a) => a.isPicture,
            ),
        ).toEqual([true, true, true]);
    });
});

describe('what the card draws for each file', () => {
    const files = attachmentsOf(
        ask('/tmp/b.jpg and /tmp/c.pdf and /tmp/gone.md', '/tmp/a.png'),
        HOME,
    );

    test('a found picture previews from its copy, a found file is a row, a missing one says so', () => {
        const found = new Map<string, unknown>([
            ['/tmp/a.png', { h: 600, rel: 'data/p/a.png', w: 800 }],
            ['/tmp/b.jpg', { h: 100, rel: 'data/p/b.png', w: 100 }],
            ['/tmp/c.pdf', true],
            ['/tmp/gone.md', false],
        ]);
        expect(cardFiles(files, found)).toEqual([
            {
                h: 600,
                isLink: true,
                kind: 'picture',
                name: 'a.png',
                path: '/tmp/a.png',
                rel: 'data/p/a.png',
                w: 800,
            },
            {
                h: 100,
                isLink: false,
                kind: 'picture',
                name: 'b.jpg',
                path: '/tmp/b.jpg',
                rel: 'data/p/b.png',
                w: 100,
            },
            { isLink: false, kind: 'file', name: 'c.pdf', path: '/tmp/c.pdf' },
            {
                isLink: false,
                kind: 'missing',
                name: 'gone.md',
                path: '/tmp/gone.md',
            },
        ]);
    });

    test('a link that names a missing file is «not found», never an error', () => {
        expect(
            cardFiles(
                attachmentsOf(ask('look', '/tmp/nope.png'), HOME),
                new Map([['/tmp/nope.png', false]]),
            ),
        ).toEqual([
            {
                isLink: true,
                kind: 'missing',
                name: 'nope.png',
                path: '/tmp/nope.png',
            },
        ]);
    });

    test('a file not looked at yet draws as reading', () => {
        expect(cardFiles(files.slice(0, 1), new Map())).toEqual([
            {
                isLink: true,
                kind: 'reading',
                name: 'a.png',
                path: '/tmp/a.png',
            },
        ]);
    });
});

describe('a preview fits the card and stands at most 120 px tall', () => {
    test('a tall shot is held to 120 px', () => {
        expect(previewSize(800, 1200, 300)).toEqual({ h: 120, w: 80 });
    });

    test('a wide shot fits the card width', () => {
        expect(previewSize(2000, 200, 300)).toEqual({ h: 30, w: 300 });
    });

    test('a small picture is never blown up', () => {
        expect(previewSize(40, 30, 300)).toEqual({ h: 30, w: 40 });
    });
});

describe("a click opens the viewer on that picture, ← → through the ask's others", () => {
    const shown = cardFiles(
        attachmentsOf(ask('/tmp/c.pdf /tmp/b.jpg', '/tmp/a.png'), HOME),
        new Map<string, unknown>([
            ['/tmp/a.png', { h: 1, rel: 'r/a', w: 1 }],
            ['/tmp/b.jpg', { h: 1, rel: 'r/b', w: 1 }],
            ['/tmp/c.pdf', true],
        ]),
    );

    test('the files are the pictures alone, at the one clicked', () => {
        expect(viewerOf(shown, '/tmp/b.jpg', false)).toEqual({
            at: 1,
            files: ['/tmp/a.png', '/tmp/b.jpg'],
            isDesktop: false,
        });
    });

    test('⌘ held asks for his desktop app', () => {
        expect(viewerOf(shown, '/tmp/a.png', true)).toEqual({
            at: 0,
            files: ['/tmp/a.png', '/tmp/b.jpg'],
            isDesktop: true,
        });
    });
});

describe("a preview's press brings the chat into view, then asks its viewer", () => {
    const shown = cardFiles(
        attachmentsOf(ask('/tmp/b.jpg', '/tmp/a.png'), HOME),
        new Map<string, unknown>([
            ['/tmp/a.png', { h: 1, rel: 'r/a', w: 1 }],
            ['/tmp/b.jpg', { h: 1, rel: 'r/b', w: 1 }],
        ]),
    );

    test('a click selects the chat, then writes the ask with its time', () => {
        const calls: unknown[] = [];
        pressPicture(shown, '/tmp/b.jpg', false, 42, {
            askView: (v) => calls.push(['ask', v]),
            selectChat: () => calls.push(['select']),
        });
        expect(calls).toEqual([
            ['select'],
            [
                'ask',
                {
                    at: 1,
                    files: ['/tmp/a.png', '/tmp/b.jpg'],
                    isDesktop: false,
                    time: 42,
                },
            ],
        ]);
    });

    test('⌘-click asks for the desktop app through the same door', () => {
        let asked: unknown = null;
        pressPicture(shown, '/tmp/a.png', true, 7, {
            askView: (v) => {
                asked = v;
            },
            selectChat: () => {},
        });
        expect(asked).toMatchObject({ at: 0, isDesktop: true });
    });
});
