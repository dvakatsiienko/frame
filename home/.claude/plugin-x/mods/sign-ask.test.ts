import { describe, expect, it } from 'vitest';

import { SIGN_ASK as guard } from './x-mod-guard/hooks/rules.ts';
import { SIGN_ASK as orbit } from './x-mod-stash/hooks/orbit.ts';

// one table for the two copies: what orbit lets through at the add is what the guard reads at the sign
const SHAPES = [
    ['✍️ sign FRM-1: the title', true],
    ['✍️ sign FRM-1, BYT-2: the titles', true],
    ['✍️ sign FRM-1 and BYT-2: the titles', true],
    ['first ✍️ sign BYT-20: the title', true],
    ['sign FRM-1: the title', false],
    ['✍️ sign FRM-1 the title', false],
    ['✍️ sign: the title', false],
    ['✍️ sign ABC-1: the title', false],
] as const;

describe('the sign shape', () => {
    for (const [text, isSign] of SHAPES)
        it(`both copies read «${text}» as ${isSign}`, () => {
            expect([guard.test(text), orbit.test(text)]).toEqual([
                isSign,
                isSign,
            ]);
        });
});
