import { describe, expect, test } from 'vitest';

import { copiedFrom, createMessageMenu, menuPlace } from './menu.js';
import type { Row } from './row-model.js';

const press = { x: 400, y: 300 };
const local = { x: 120, y: 80 };
const hello = { isSelection: false, text: 'hello' };
const selected = {
    at: { x: 1, y: 1 },
    passage: {
        parts: [{ block: 0, range: null, source: 'hello', words: 'hello' }],
        row: { at: null, id: 'r1', kind: 'reply' as const },
    },
};

describe('one right-click reported twice', () => {
    test('the item first, then the list: the menu holds the words', () => {
        const menu = createMessageMenu();
        menu.hit(press, { copied: hello, selected: null });
        menu.open(press, local);
        expect(menu.state).toEqual({
            at: press,
            copied: hello,
            selected: null,
            ...local,
        });
    });

    test('the list first, then the item: the menu holds the words', () => {
        const menu = createMessageMenu();
        menu.open(press, local);
        menu.hit(press, { copied: hello, selected: null });
        expect(menu.state?.copied).toBe(hello);
    });

    test('an item half from another press gives the menu nothing to copy', () => {
        const menu = createMessageMenu();
        menu.hit({ x: 1, y: 2 }, { copied: hello, selected });
        menu.open(press, local);
        expect(menu.state?.copied).toBeNull();
    });

    test.each([
        ['item first', true],
        ['list first', false],
    ])(
        'the words a note would be on come with the press: %s',
        (_what, isItemFirst) => {
            const menu = createMessageMenu();
            if (isItemFirst) menu.hit(press, { copied: hello, selected });
            menu.open(press, local);
            if (!isItemFirst) menu.hit(press, { copied: hello, selected });
            expect(menu.state?.selected).toBe(selected);
        },
    );

    test('an item half from another press offers no note', () => {
        const menu = createMessageMenu();
        menu.hit({ x: 1, y: 2 }, { copied: hello, selected });
        menu.open(press, local);
        expect(menu.state?.selected).toBeNull();
    });

    test('close leaves no menu and no waiting half', () => {
        const menu = createMessageMenu();
        menu.hit(press, { copied: hello, selected: null });
        menu.close();
        menu.open(press, local);
        expect(menu.state?.copied).toBeNull();
    });
});

const row = (over: Partial<Row>): Row => ({
    at: null,
    delivery: null,
    files: [],
    id: 'r1',
    isTurnStart: false,
    isWaiting: false,
    kind: 'reply',
    pictures: [],
    replyId: null,
    text: '**bold** reply',
    tools: [],
    version: 1,
    ...over,
});

describe('what a right-click copies', () => {
    test.each([
        ['a reply, its markdown as written', row({}), '**bold** reply'],
        ['his own message', row({ kind: 'mine', text: 'go slay' }), 'go slay'],
    ])('%s, whole when nothing is selected', (_name, at, text) => {
        expect(copiedFrom(at, null)).toEqual({ isSelection: false, text });
    });

    test('a note, as its bubble draws it: the words it is on, then his', () => {
        const at = row({ kind: 'mine', quote: 'the retry', text: 'why?' });
        expect(copiedFrom(at, null)?.text).toBe('on "the retry"\nwhy?');
    });

    test.each([
        ['a reply', row({})],
        ['his own message', row({ kind: 'mine' })],
    ])('the words he selected in %s', (_what, at) => {
        expect(copiedFrom(at, 'bold')).toEqual({
            isSelection: true,
            text: 'bold',
        });
    });

    test.each([
        ['a tool run', row({ kind: 'tool', text: 'Bash 2' }), 'Bash'],
        ['a message of only spaces', row({ text: '  ' }), null],
        ['no row', undefined, null],
    ])('%s copies nothing', (_name, at, selected) => {
        expect(copiedFrom(at, selected)).toBeNull();
    });
});

describe('where the menu sits', () => {
    const size = { h: 40, w: 200 };
    const view = { h: 600, w: 800 };

    test('at the press when it fits', () => {
        expect(menuPlace({ x: 100, y: 100 }, view, size)).toEqual({
            x: 100,
            y: 100,
        });
    });

    test('above the press near the bottom', () => {
        expect(menuPlace({ x: 100, y: 590 }, view, size).y).toBe(550);
    });

    test('pulled left near the right edge', () => {
        expect(menuPlace({ x: 750, y: 100 }, view, size).x).toBe(600);
    });
});
