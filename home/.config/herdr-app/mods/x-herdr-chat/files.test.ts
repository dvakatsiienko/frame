import { spawnSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    realpathSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    fileAt,
    isSentRow,
    isUnsendRow,
    openArgs,
    openPath,
    replyIdOf,
    withFileRows,
} from './files.js';
import type { Row } from './row-model.js';

const HOME = '/Users/dima';

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

describe('only what he reads, looks at or hears opens; the rest is shown in Finder', () => {
    test.each([
        'x.command',
        'x.COMMAND',
        'x.jar',
        'x.dmg',
        'x.fileloc',
        'x.webloc',
        'x.shortcut',
        'x.mobileconfig',
        'x.py',
        'x.sh',
        'x.zip',
        'x',
        '.x',
        'x.md.command',
    ])('%s is revealed', (name) =>
        expect(openArgs(`/tmp/${name}`, false)).toEqual(['-R', `/tmp/${name}`]),
    );

    test.each([
        'a.png',
        'notes.md',
        'A.MD',
        'a.b.json',
        'a.ts',
        'a.html',
        'a.pdf',
        'a.mov',
    ])('%s opens in its app', (name) =>
        expect(openArgs(`/tmp/${name}`, false)).toEqual([`/tmp/${name}`]),
    );

    // dima, 19 Nov 17:53: «they open in apple music»
    test.each(['/tmp/A.mp3', '/tmp/b.M4A', '/tmp/c.wav', '/tmp/d.flac'])(
        '%s opens in the audio app his settings name',
        (path) =>
            expect(openArgs(path, false, 'IINA')).toEqual(['-a', 'IINA', path]),
    );

    test('audio with no app named opens in the system’s choice', () => {
        expect(openArgs('/tmp/A.mp3', false, null)).toEqual(['/tmp/A.mp3']);
    });

    test.each(['herdr', '.claude'])('a folder named %s opens', (name) =>
        expect(openArgs(`/tmp/${name}`, true)).toEqual([`/tmp/${name}`]),
    );

    test.each(['Evil.app', 'a.workflow', 'a.prefPane', 'notes.md', '.x.app'])(
        'a folder named %s is revealed',
        (name) =>
            expect(openArgs(`/tmp/${name}`, true)).toEqual([
                '-R',
                `/tmp/${name}`,
            ]),
    );
});

// sixth sense, round 2: a closing slash, «//», «..» or a symlink hid an app from the check
describe('what he clicked is judged by what it resolves to', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'open-path-')));
    mkdirSync(join(dir, 'Evil.app/inside'), { recursive: true });
    mkdirSync(join(dir, 'plain'));
    for (const name of ['a.md', 'x.command', 'bare'])
        writeFileSync(join(dir, name), '');
    symlinkSync(join(dir, 'Evil.app'), join(dir, 'notes.md'));
    symlinkSync(join(dir, 'x.command'), join(dir, 'log.txt'));
    const opened: string[][] = [];
    const exec = async (program: string, args: string[]) => {
        if (program === 'open') opened.push(args);
        if (program === 'open') return { code: 0, stdout: '' };
        const ran = spawnSync(program, args, { encoding: 'utf8' });
        return { code: ran.status ?? 1, stdout: ran.stdout };
    };

    test.each([
        ['a file', 'a.md', ['a.md']],
        ['a folder with a closing slash', 'plain/', ['plain']],
        ['an app with a closing slash', 'Evil.app/', ['-R', 'Evil.app']],
        ['an app with two', 'Evil.app//', ['-R', 'Evil.app']],
        ['an app behind «..»', 'plain/../Evil.app', ['-R', 'Evil.app']],
        ['an app from its inside', 'Evil.app/inside/..', ['-R', 'Evil.app']],
        ['a symlink to an app', 'notes.md', ['-R', 'Evil.app']],
        ['a symlink to a command', 'log.txt', ['-R', 'x.command']],
        ['a file with no suffix', 'bare', ['-R', 'bare']],
    ])('%s', async (_what, path, want) => {
        opened.length = 0;
        expect(await openPath(`${dir}/${path}`, null, exec)).toBe(true);
        expect(opened).toEqual([
            want.map((w) => (w === '-R' ? w : `${dir}/${w}`)),
        ]);
    });

    test('one gone since he saw it opens nothing', async () => {
        opened.length = 0;
        expect(await openPath(`${dir}/gone.md`, null, exec)).toBe(false);
        expect(opened).toEqual([]);
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

describe("a message still in Claude Code's queue carries a × row under it (FRM-563 b+c)", () => {
    test('a waiting message gets its × row, a delivered one none', () => {
        const waiting: Row = {
            at: null,
            delivery: null,
            files: [],
            id: 'w1',
            isTurnStart: false,
            isWaiting: true,
            kind: 'mine',
            pictures: [],
            replyId: null,
            text: 'plain words',
            tools: [],
            version: 1,
        };
        const delivered = { ...waiting, id: 'm1', isWaiting: false };
        const ids = withFileRows([waiting, delivered], HOME, new Map()).map(
            (r) => r.id,
        );
        expect(ids).toEqual(['w1', 'w1#unsend', 'm1']);
        expect(isUnsendRow('w1#unsend')).toBe(true);
    });
});
