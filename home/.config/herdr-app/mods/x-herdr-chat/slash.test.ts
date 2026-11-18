import { describe, expect, test } from 'vitest';

import {
    caretAfter,
    createSlashMenu,
    listedSkills,
    menuNames,
    slashAt,
} from './slash.js';

describe('the «/word» the caret is in (FRM-638 slice 6)', () => {
    test.each([
        ['/com', 4, 'com'],
        ['hi /boo', 7, 'boo'],
        ['line\n/x', 7, 'x'],
        ['/', 1, ''],
    ])('%j at %i reads %j', (text, caret, q) => {
        expect(slashAt(text, caret)?.q).toBe(q);
    });

    test.each([
        ['a path /tmp/x', 13],
        ['no slash', 8],
        ['http://x', 8],
    ])('%j opens no menu', (text, caret) => {
        expect(slashAt(text, caret)).toBeNull();
    });

    test('the caret is where an edit left it', () => {
        expect(caretAfter('/co', '/com')).toBe(4);
        expect(caretAfter('hi', 'h/i')).toBe(2);
    });
});

describe('the menu lists commands and every skill once', () => {
    test('a skill listing reads to names', () => {
        expect(listedSkills('- x:cmt: commit\n- foo: bar\nnoise')).toEqual([
            ['x:cmt', 'commit'],
            ['foo', 'bar'],
        ]);
    });

    test('a command wins over a skill of the same name', () => {
        const names = menuNames(
            new Map([
                ['compact', 'mine'],
                ['x:cmt', 'commit'],
            ]),
            new Map([
                ['x:cmt', 'again'],
                ['clio:boot', 'boot'],
            ]),
        );
        expect(names.filter(([n]) => n === 'compact')).toHaveLength(1);
        expect(names.filter(([n]) => n === 'x:cmt')).toEqual([
            ['x:cmt', 'commit'],
        ]);
        expect(names.some(([n]) => n === 'clio:boot')).toBe(true);
    });
});

describe('the menu as he types and keys', () => {
    const names: [string, string][] = [
        ['compact', 'a'],
        ['config', 'b'],
        ['clio:boot', 'c'],
    ];

    test('typing «/co» shows the matches, ↓ ↑ move round, Esc closes for this word', () => {
        const menu = createSlashMenu();
        menu.typed('', '/co');
        expect(menu.shown(names).list.map(([n]) => n)).toEqual([
            'compact',
            'config',
        ]);
        menu.step('down', 2);
        expect(menu.shown(names).at).toBe(1);
        menu.step('down', 2);
        expect(menu.shown(names).at).toBe(0);
        menu.step('up', 2);
        expect(menu.shown(names).at).toBe(1);
        menu.step('close', 2);
        expect(menu.shown(names).list).toEqual([]);
        menu.typed('/co', '/con');
        expect(menu.shown(names).list.map(([n]) => n)).toEqual(['config']);
    });

    test('a pick fills the name, a space after, the caret past it, the rest kept', () => {
        const menu = createSlashMenu();
        menu.typed('', 'run /bo now');
        menu.typed('run /bo now', 'run /boo now');
        expect(menu.fill('clio:boot')).toEqual({
            caret: 14,
            text: 'run /clio:boot now',
        });
        expect(menu.shown(names).list).toEqual([]);
    });

    test('no «/» word, no menu', () => {
        const menu = createSlashMenu();
        menu.typed('', 'hello');
        expect(menu.shown(names).list).toEqual([]);
        expect(menu.fill('x')).toBeNull();
    });
});

describe('the caret moving off the word closes the menu (wisphunter, slice 6)', () => {
    test('a caret before the «/» shows no menu, back on the word shows it again', () => {
        const menu = createSlashMenu();
        menu.typed('', 'hi /co');
        menu.at('hi /co', 1);
        expect(menu.shown([['compact', 'a']]).list).toEqual([]);
        menu.at('hi /co', 6);
        expect(menu.shown([['compact', 'a']]).list).toHaveLength(1);
    });
});
