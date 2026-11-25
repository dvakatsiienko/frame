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
        [
            'in bold, in a nested list',
            '**~/a** \n- x\n    - ~/b',
            ['~/a', '~/b'],
        ],
        ['after inline triple ticks', '```npm x``` then\n~/a', ['~/a']],
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
        [
            'a fence of four ticks with three inside',
            '````\n```\n~/a\n```\n~/b\n````',
        ],
        ['a quoted fence', '> ```\n> ~/a\n> ```'],
        ['indented code', 'so\n\n    cat ~/a\n\tls ~/b'],
        ['a span of two ticks', '``see `~/a` ``'],
        [
            'a path with a place to fill in',
            '~/.claude/<slug>/x.jsonl ~/a(b) ~/{x} ~/frame\\ copy/a.md',
        ],
        ['a link’s definition', '[1]: /Users/dima/a.md'],
        ['a network volume', '/Volumes/nas/x'],
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
        const text = 'see `~/a.md`, /tmp/b:4. or [x](https://x.dev)';
        expect(linkPaths(text, [])).toBe(text);
        expect(
            linkPaths('[c](file:///tmp/c) <file:///tmp/d.md> [w](/tmp/w)', []),
        ).toBe('c d.md w');
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
        const onDisk = vi.fn(async (paths: string[]) =>
            paths.map((path) => there.includes(path)),
        );
        return { links: createPathLinks({ home: () => HOME, onDisk }), onDisk };
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

    test('the disk is asked once per text, in one look for every reply', async () => {
        const rows = [reply('/tmp/a ~/b'), reply('/tmp/a')];
        const { links, onDisk } = disk('/tmp/a', '/Users/dima/b');
        await links.learn(rows);
        await links.learn(rows);
        expect(onDisk.mock.calls.filter(([paths]) => paths.length)).toEqual([
            [['/tmp/a', '/Users/dima/b']],
        ]);
        (rows[1] as Row).text += ' /tmp/c';
        await links.learn(rows);
        expect(onDisk).toHaveBeenLastCalledWith(['/tmp/a', '/tmp/c']);
    });

    test('a path named before it was written links once it is there, near the end alone', async () => {
        const old = reply('/tmp/late');
        const rows = [
            old,
            ...Array.from({ length: 11 }, () => reply('x')),
            reply('/tmp/late'),
        ];
        const there: string[] = [];
        const links = createPathLinks({
            home: () => HOME,
            onDisk: async (paths) => paths.map((path) => there.includes(path)),
        });
        await links.learn(rows);
        there.push('/tmp/late');
        expect(await links.learn(rows)).toBe(true);
        expect(rows.at(-1)?.links).toEqual(['/tmp/late']);
        expect(old.links ?? []).toEqual([]);
    });

    test('a reply that grew while the disk answered waits for its own answer', async () => {
        const row = reply('/tmp/a');
        const { links } = disk('/tmp/a');
        const first = links.learn([row]);
        row.text = 'no path now';
        expect(await first).toBe(false);
        expect(row.links).toBeUndefined();
    });
});
