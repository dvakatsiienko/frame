import { describe, expect, test } from 'vitest';

import { WIND, meterLevel, windOf } from './details.js';

// FRM-618 rider E1: the context meter turns amber where the second wind notices (55 %) and red where it must (65 %)
describe('the context meter', () => {
    test('calm under the notice, warm from it, hot from the must', () => {
        expect([0, 54, 55, 64, 65, 100].map((p) => meterLevel(p))).toEqual([
            'calm',
            'calm',
            'warm',
            'warm',
            'hot',
            'hot',
        ]);
    });

    test('his own second wind lines move the colours', () => {
        const wind = { must: 80, notice: 70 };
        expect([69, 70, 80].map((p) => meterLevel(p, wind))).toEqual([
            'calm',
            'warm',
            'hot',
        ]);
    });

    test("his chat settings give the lines; a missing one is the stash's default", () => {
        expect(
            windOf({ 'stash.wind.must': 80, 'stash.wind.notice': 70 }),
        ).toEqual({ must: 80, notice: 70 });
        expect(windOf({ 'stash.wind.must': 'x' })).toEqual(WIND);
        expect(windOf(undefined)).toEqual(WIND);
    });
});
