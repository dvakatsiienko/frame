import { describe, expect, test, vi } from 'vitest';

import {
    createPathLinks,
    linkPaths,
    pathOf,
    pathsNamed,
} from './path-links.js';
import type { Row } from './row-model.js';

const HOME = '/Users/dima';
const reply = (text: string): Row => ({
    at: null,
    delivery: null,
    files: [],
    id: 'r1',
    isTurnStart: false,
    isWaiting: false,
    kind: 'reply',
    pictures: [],
    replyId: null,
    text,
    tools: [],
    version: 1,
});

describe('the paths a reply names', () => {
    test.each([
        ['in ticks', 'see `~/frame/x.md`', ['~/frame/x.md']],
        [
            'a folder',
            'in /Users/dima/frame/herdr.',
            ['/Users/dima/frame/herdr'],
        ],
        [
            'with its line',
            '`/Users/dima/a.ts:12-40` and /tmp/b.ts:3:',
            ['/Users/dima/a.ts', '/tmp/b.ts'],
        ],
        [
            'a file link',
            '[log](file:///tmp/a%20b.md) <file:///tmp/c>',
            ['/tmp/a b.md', '/tmp/c'],
        ],
        ['a link to a path', '[`log`](/tmp/a.md)', ['/tmp/a.md']],
        ['once each', '/tmp/a and `/tmp/a`', ['/tmp/a']],
    ])('%s', (_what, text, paths) => {
        expect(pathsNamed(text)).toEqual(paths);
    });

    test.each([
        ['a fence', '```\n/tmp/a\n```'],
        ['a fence still being written', 'so\n```sh\ncat /tmp/a'],
        ['a command in ticks', '`cat /tmp/a`'],
        [
            'a web link, its words or its address',
            '[/tmp/a](https://x.dev/tmp/a) https://x.dev/Users/a',
        ],
        ['a picture', '![a](/tmp/a.png)'],
        ['a relative path', 'herdr/ftr/chat.md ./a ../b'],
    ])('never %s', (_what, text) => {
        expect(pathsNamed(text)).toEqual([]);
    });
});

describe('a path on disk draws as a link, any other as its words', () => {
    test('each keeps its words and its marks', () => {
        expect(
            linkPaths('see `~/a.md`, /tmp/b:4. or [c](file:///tmp/c)', [
                '~/a.md',
                '/tmp/b',
                '/tmp/c',
            ]),
        ).toBe('see [`~/a.md`](path:0), [/tmp/b:4](path:1). or [c](path:2)');
    });

    test('none of them on disk', () => {
        const text =
            'see `~/a.md`, /tmp/b:4. or [w](/tmp/w) [x](https://x.dev)';
        expect(linkPaths(text, [])).toBe(text);
        expect(linkPaths('[c](file:///tmp/c) <file:///tmp/d.md>', [])).toBe(
            'c d.md',
        );
    });

    test('a code block keeps its text', () => {
        const text = '```\n[a](file:///tmp/a) /tmp/a\n```';
        expect(linkPaths(text, ['/tmp/a'])).toBe(text);
    });

    test('a click names the path it was drawn for, under his home', () => {
        const row = { ...reply(''), links: ['/tmp/a', '~/b'] };
        expect(pathOf('path:1', row, HOME)).toBe('/Users/dima/b');
        expect(pathOf('path:2', row, HOME)).toBeNull();
        expect(pathOf('https://x.dev', row, HOME)).toBeNull();
    });
});

describe('a reply learns which paths are there', () => {
    const disk = (...there: string[]) => {
        const exists = vi.fn(async (path: string) => there.includes(path));
        return { exists, links: createPathLinks({ exists, home: () => HOME }) };
    };

    test('only those, in one redraw', async () => {
        const row = reply('`~/a` and /tmp/gone');
        const { links } = disk('/Users/dima/a');
        expect(await links.learn([row])).toBe(true);
        expect(row).toMatchObject({ links: ['~/a'], version: 2 });
    });

    test('a reply with none of its paths there is not drawn again', async () => {
        const row = reply('/tmp/gone');
        expect(await disk().links.learn([row])).toBe(false);
        expect(row.version).toBe(1);
    });

    test('the disk is asked once per text', async () => {
        const row = reply('/tmp/a');
        const { exists, links } = disk('/tmp/a');
        await links.learn([row]);
        await links.learn([row]);
        expect(exists).toHaveBeenCalledTimes(1);
        row.text += ' /tmp/b';
        await links.learn([row]);
        expect(exists).toHaveBeenCalledTimes(3);
    });

    test('a reply that grew while the disk answered waits for its own answer', async () => {
        const row = reply('/tmp/a');
        const { links } = disk('/tmp/a');
        const first = links.learn([row]);
        row.text = 'no path now';
        expect(await first).toBe(false);
        expect(row.links).toBeUndefined();
    });

    test('a failed look reads as not there', async () => {
        const links = createPathLinks({
            exists: () => Promise.reject(new Error('no')),
            home: () => HOME,
        });
        expect(await links.learn([reply('/tmp/a')])).toBe(false);
    });
});
