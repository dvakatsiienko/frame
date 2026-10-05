import { describe, expect, test } from 'vitest';

import { listingParse } from './session-read.ts';

describe('listingParse', () => {
    test('a description holding its own bullets stays one skill', () => {
        const content =
            '- x:walkthrough: teach by showing\n- Explicit learning requests\n- Confusion signals\n- x:pm: tickets';
        expect(listingParse(content, ['x:walkthrough', 'x:pm'])).toEqual([
            [
                'x:walkthrough',
                'teach by showing - Explicit learning requests - Confusion signals',
            ],
            ['x:pm', 'tickets'],
        ]);
    });
});
