import { describe, expect, test } from 'vitest';

import { labelInGoal, uiLabels } from './fresh-eyes-goal-check.ts';

const labels = uiLabels(
    '<button aria-label="Open settings">⚙</button><Button>Save chord</Button><p>{count}</p>',
);

describe('fresh-eyes-goal-check', () => {
    test('reads button text and aria labels', () => {
        expect(labels).toEqual(new Set(['save chord', 'open settings']));
    });

    test('refuses a goal that names a label', () => {
        expect(labelInGoal('press Save chord after playing C major', labels)).toBe('save chord');
    });

    test('passes a goal in outcome words', () => {
        expect(labelInGoal('keep the chord you just played for later', labels)).toBeUndefined();
    });
});
