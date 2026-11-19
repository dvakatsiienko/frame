import { describe, expect, test } from 'vitest';

import { forgetPage, keepPage, pageOnOpen } from './settings-page.js';

function store() {
    const kept: Record<string, string> = {};
    return {
        getItem: (key: string) => kept[key] ?? null,
        removeItem: (key: string) => {
            delete kept[key];
        },
        setItem: (key: string, value: string) => {
            kept[key] = value;
        },
    };
}

// dima, 19 Nov 18:53: «after rebind tab switches to dock tab»
describe('the settings window keeps its page through a reload of the chat', () => {
    test('a reload of the same window opens the page he was on', () => {
        const s = store();
        keepPage(s, 'o4', 'keys');
        expect(pageOnOpen(s, 'o4', 'dock')).toBe('keys');
    });

    test('a new window opens the page it was asked for', () => {
        const s = store();
        keepPage(s, 'o4', 'keys');
        expect(pageOnOpen(s, 'o5', 'dock')).toBe('dock');
    });

    // overlay ids restart with herdr (sixth sense on 3e85eb5c): a closed window's page never reaches a later o4
    test('a closed window leaves no page for a later window with its id', () => {
        const s = store();
        keepPage(s, 'o4', 'keys');
        forgetPage(s, 'o4');
        expect(pageOnOpen(s, 'o4', 'general')).toBe('general');
    });
});
