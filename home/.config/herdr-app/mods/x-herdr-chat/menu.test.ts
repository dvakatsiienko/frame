import { describe, expect, test } from 'vitest';

import { copyText, createMessageMenu, menuPlace } from './menu.js';
import type { Row } from './row-model.js';

const press = { x: 400, y: 300 };
const local = { x: 120, y: 80 };

describe('one right-click reported twice', () => {
    test('the item first, then the list: the menu holds the words', () => {
        const menu = createMessageMenu();
        menu.hit(press, 'hello');
        menu.open(press, local);
        expect(menu.state).toEqual({ at: press, text: 'hello', ...local });
    });

    test('the list first, then the item: the menu holds the words', () => {
        const menu = createMessageMenu();
        menu.open(press, local);
        menu.hit(press, 'hello');
        expect(menu.state?.text).toBe('hello');
    });

    test('an item half from another press gives the menu nothing to copy', () => {
        const menu = createMessageMenu();
        menu.hit({ x: 1, y: 2 }, 'old');
        menu.open(press, local);
        expect(menu.state?.text).toBeNull();
    });

    test('close leaves no menu and no waiting half', () => {
        const menu = createMessageMenu();
        menu.hit(press, 'hello');
        menu.close();
        menu.open(press, local);
        expect(menu.state?.text).toBeNull();
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
    test('a reply copies its markdown as written', () => {
        expect(copyText(row({}))).toBe('**bold** reply');
    });

    test('his own message copies his words', () => {
        expect(copyText(row({ kind: 'mine', text: 'go slay' }))).toBe(
            'go slay',
        );
    });

    test('a tool run copies nothing', () => {
        expect(copyText(row({ kind: 'tool', text: 'Bash 2' }))).toBeNull();
    });

    test('a message of only spaces copies nothing', () => {
        expect(copyText(row({ text: '  ' }))).toBeNull();
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
