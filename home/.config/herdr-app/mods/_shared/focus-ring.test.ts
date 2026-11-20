import { describe, expect, test } from 'vitest';

import { focusBorder } from './focus-ring.js';

// FRM-620 slice 5c: one focus look for every text box of ours, the quill and orbit's steer boxes alike
describe('the focus border', () => {
    const t = { accent: '#3b82f6' } as const;

    test('a box holding the keyboard draws the accent', () => {
        expect(focusBorder(true, t, '#2a2e35')).toBe('#3b82f6');
    });

    test('a box without it keeps its own border', () => {
        expect(focusBorder(false, t, '#2a2e35')).toBe('#2a2e35');
    });
});
