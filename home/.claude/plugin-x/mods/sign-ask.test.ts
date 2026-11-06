import { describe, expect, it } from 'vitest';

import { TICKET_KEY } from './x-mod-guard/hooks/rules/command.ts';
import { SIGN_ASK as guard, quotesPr } from './x-mod-guard/hooks/rules.ts';
import { MERGE_ASK, SIGN_ASK as orbit } from './x-mod-stash/hooks/orbit.ts';

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

const MERGES = [
    ['⚠️ merge https://github.com/o/n/pull/7', true],
    ['⚠️ merge n#7: the title', true],
    ['first ⚠️ merge n#7', true],
    ['merge n#7', false],
    ['merge pr #7', false],
    ['⚠️ merge FRM-1', false],
] as const;

describe('the merge shape', () => {
    for (const [text, isMerge] of MERGES)
        it(`orbit and the guard read «${text}» as ${isMerge}`, () => {
            expect([MERGE_ASK.test(text), quotesPr(text, 'o/n', '7')]).toEqual([
                isMerge,
                isMerge,
            ]);
        });
});

describe('the sign shape', () => {
    for (const team of TICKET_KEY.split('|'))
        it(`both copies read a ${team} ticket`, () => {
            const text = `✍️ sign ${team}-1: the title`;
            expect([guard.test(text), orbit.test(text)]).toEqual([true, true]);
        });
    for (const [text, isSign] of SHAPES)
        it(`both copies read «${text}» as ${isSign}`, () => {
            expect([guard.test(text), orbit.test(text)]).toEqual([
                isSign,
                isSign,
            ]);
        });
});
