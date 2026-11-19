import { describe, expect, test } from 'vitest';

import { keepPage, pageOnOpen } from './settings-page.js';

function store() {
    const kept: Record<string, string> = {};
    return {
        getItem: (key: string) => kept[key] ?? null,
        setItem: (key: string, value: string) => {
            kept[key] = value;
        },
    };
}

// dima, 19 Nov 18:53: «after rebind tab switches to dock tab»
describe('the settings window keeps its page through a reload of the chat', () => {
    test('a reload of the same window opens the page he was on', () => {
        const s = store();
        keepPage(s, 'ov-1', 'keys');
        expect(pageOnOpen(s, 'ov-1', 'dock')).toBe('keys');
    });

    test('a new window opens the page it was asked for', () => {
        const s = store();
        keepPage(s, 'ov-1', 'keys');
        expect(pageOnOpen(s, 'ov-2', 'dock')).toBe('dock');
    });
});
