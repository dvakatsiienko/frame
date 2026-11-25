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

import { settingRows } from '../x-herdr-chat/settings-model.js';
import {
    audioAppOf,
    isWebLink,
    linkPath,
    openArgs,
    openPath,
} from './open-path.js';

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
        const ran = spawnSync(program, args, {
            encoding: 'utf8',
            timeout: 10_000,
        });
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

describe('a link he clicks', () => {
    test.each([
        'https://linear.app/x-com/issue/FRM-1',
        'http://localhost:7373',
        'obsidian://open?vault=v&file=inbox',
        'linear://issue/FRM-1',
    ])('%s opens as a page', (link) => expect(isWebLink(link)).toBe(true));

    test.each([
        'shortcuts://run-shortcut?name=x',
        'obsidian://advanced-uri?commandid=x',
        'file:///Applications/Calculator.app',
        'javascript:alert(1)',
        'ssh://host',
        '/tmp/a.md',
    ])('%s is no page', (link) => expect(isWebLink(link)).toBe(false));

    test.each([
        ['~/notes/a.md', '/Users/me/notes/a.md'],
        ['/Applications/Calculator.app/', '/Applications/Calculator.app/'],
        ['file:///tmp/a%20b.md', '/tmp/a b.md'],
        ['https://a.b/c.md', null],
    ])('%s names %s', (link, path) =>
        expect(linkPath(link, '/Users/me')).toBe(path),
    );
});

describe('the app audio opens in', () => {
    test('before he chose one it is the settings row\u2019s own default', () => {
        const row = settingRows.find((r) => r.key === 'chatter.audio.app');
        expect(audioAppOf({})).toBe(row?.default);
    });

    test('his pick, and «macos default» as none', () => {
        expect(audioAppOf({ 'chatter.audio.app': 'VLC' })).toBe('VLC');
        expect(audioAppOf({ 'chatter.audio.app': '' })).toBeNull();
    });
});
