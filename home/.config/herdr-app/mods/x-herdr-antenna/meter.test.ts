import { describe, expect, test } from 'vitest';

import { meterLevel } from './details.js';

// FRM-618 rider E1: the context meter turns amber where the second wind notices (55 %) and red where it must (65 %)
describe('the context meter', () => {
    test('calm under the notice, warm from it, hot from the must', () => {
        expect([0, 54, 55, 64, 65, 100].map(meterLevel)).toEqual([
            'calm',
            'calm',
            'warm',
            'warm',
            'hot',
            'hot',
        ]);
    });
});
