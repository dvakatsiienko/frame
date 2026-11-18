import { describe, expect, test } from 'vitest';

import { createFind, findCount, hitsOf } from './find.js';

const row = (id: string, text: string) => ({ id, text }) as never;
const rows = [
    row('a', 'Ship the viewer'),
    row('b', 'tests pass'),
    row('c', 'the VIEWER opens'),
    row('d', 'viewer again'),
];

describe('find in the chat (FRM-638 slice 6)', () => {
    test('hits are the rows holding the query, any case, newest first', () => {
        expect(hitsOf(rows, 'viewer')).toEqual(['d', 'c', 'a']);
        expect(hitsOf(rows, '  ')).toEqual([]);
    });

    test('a search shows the newest hit and counts it', () => {
        const find = createFind();
        find.open();
        find.search(rows, 'viewer');
        expect(find.current()).toBe('d');
        expect(findCount(find.state)).toBe('1 / 3');
    });

    test('Enter steps older, ⇧Enter newer, both wrap', () => {
        const find = createFind();
        find.search(rows, 'viewer');
        expect(find.step('older')).toBe('c');
        expect(find.step('older')).toBe('a');
        expect(find.step('older')).toBe('d');
        expect(find.step('newer')).toBe('a');
        expect(findCount(find.state)).toBe('3 / 3');
    });

    test('no match says so; no query says nothing; a step with no hit shows nothing', () => {
        const find = createFind();
        find.search(rows, 'zebra');
        expect(findCount(find.state)).toBe('No match');
        expect(find.step('older')).toBeNull();
        find.search(rows, '');
        expect(findCount(find.state)).toBe('');
    });

    test('close forgets the query and the hits', () => {
        const find = createFind();
        find.open();
        find.search(rows, 'tests');
        find.close();
        expect(find.state).toEqual({ at: 0, hits: [], isOpen: false, q: '' });
    });
});
