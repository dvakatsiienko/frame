import { describe, expect, test } from 'vitest';

import { KEPT_PAGE_MS, keepPage, pageOnOpen } from './settings-page.js';

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
    test('a reload right after a Keys save opens the page he was on', () => {
        const s = store();
        keepPage(s, 'o4', 'keys', 1000);
        expect(pageOnOpen(s, 'o4', 'dock', 1000 + 1500)).toBe('keys');
    });

    test('a new window opens the page it was asked for', () => {
        const s = store();
        keepPage(s, 'o4', 'keys', 1000);
        expect(pageOnOpen(s, 'o5', 'dock', 1000 + 500)).toBe('dock');
    });

    // overlay ids restart with herdr, and herdr's Esc closes past our close (sixth sense, round 10 on 8932c8c0)
    test('a later window that took a closed one’s id opens the page asked', () => {
        const s = store();
        keepPage(s, 'o4', 'keys', 1000);
        expect(pageOnOpen(s, 'o4', 'general', 1000 + KEPT_PAGE_MS + 1)).toBe(
            'general',
        );
    });

    test('a kept value from the old build opens the page asked', () => {
        const s = store();
        s.setItem('x-herdr-settings.page:o4', 'keys');
        expect(pageOnOpen(s, 'o4', 'dock', 1000)).toBe('dock');
    });
});
