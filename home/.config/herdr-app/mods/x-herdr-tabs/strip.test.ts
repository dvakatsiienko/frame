import { describe, expect, test } from 'vitest';

import { TAB_STEP_PX, firstTab } from './strip.js';

// his window: 9 tabs, room for 6 at the floor
const bar = { active: 0, count: 9, first: 0, width: 6 * TAB_STEP_PX + 20 };

describe('the tab bar moves one tab per swipe', () => {
    test('a swipe right shows the next tab', () => {
        expect(firstTab({ ...bar, step: 1 })).toBe(1);
    });

    test('it stops once the last tab is in view', () => {
        expect(firstTab({ ...bar, active: 4, first: 3, step: 1 })).toBe(3);
    });

    test('a swipe left at the start stays at the start', () => {
        expect(firstTab({ ...bar, step: -1 })).toBe(0);
    });

    test('everything fits: nothing moves', () => {
        expect(firstTab({ ...bar, count: 4, step: 1 })).toBe(0);
    });
});

describe('the active tab is always in the window', () => {
    test('a tab past the right edge brings the window to it', () => {
        expect(firstTab({ ...bar, active: 8, isActiveNew: true })).toBe(3);
    });

    test('a tab left of the window brings the window back', () => {
        expect(
            firstTab({ ...bar, active: 1, first: 3, isActiveNew: true }),
        ).toBe(1);
    });
});
