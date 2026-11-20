import { describe, expect, test } from 'vitest';

import { phaseParts } from './orbit.js';

// FRM-618 66d: phases read as the old board did, a moon per line filling by nearness, its lead word bold
describe('a phases line', () => {
    test('takes its moon by place, the fifth and later all new moons', () => {
        expect([0, 1, 2, 3, 4, 6].map((i) => phaseParts('a', i).moon)).toEqual([
            '🌕',
            '🌔',
            '🌓',
            '🌒',
            '🌑',
            '🌑',
        ]);
    });

    test('a siesta line is a pause, its moon a sun behind a cloud', () => {
        expect(phaseParts('siesta: he reads', 2).moon).toBe('🌤️');
    });

    test('splits its lead word off for the bold', () => {
        expect(phaseParts('now: fix the band', 0)).toMatchObject({
            lead: 'now:',
            text: 'fix the band',
        });
    });

    // one line cut with «…» is plain text (rider 4e), so its markdown marks never show
    test('its text reads plain, the bold and code marks dropped', () => {
        expect(phaseParts('now: **🦉 clio** runs `x lane`', 0).text).toBe(
            '🦉 clio runs x lane',
        );
    });

    test('a line with no lead word keeps it whole', () => {
        expect(phaseParts('fix 1: a watch', 0)).toMatchObject({
            lead: '',
            text: 'fix 1: a watch',
        });
    });
});
