import { describe, expect, test } from 'vitest';

import { settingsOverlay } from '../_shared/chat-asks.js';
import {
    KEPT_PAGE_MS,
    escapeAct,
    keepPage,
    pageOnOpen,
} from './settings-page.js';

// dima, 19 Nov 19:11: «esc cancels rebinding process (and do not close settings - only cancel rebinding), and
// followup esc closes settings»; herdr closes a dialog on Esc before the mod sees it (probe 19:43), a window never
describe('Esc in settings', () => {
    test('while a key records, Esc cancels the rebind only', () => {
        expect(escapeAct('cmd-k')).toBe('cancel');
    });

    test('with nothing recording, Esc closes the window', () => {
        expect(escapeAct(null)).toBe('close');
    });

    test('settings opens as a window herdr never closes on Esc, one at a time', () => {
        expect(settingsOverlay('dock')).toMatchObject({
            key: 'x-herdr-settings',
            kind: 'window',
            props: { settingsWindow: 'dock' },
        });
    });
});

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
