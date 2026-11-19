import { describe, expect, test } from 'vitest';

import { LANES_SHELF } from '../../../../.claude/plugin-x/mods/x-mod-stash/tests/lanes-shelf.ts';
import { lanesShown, stepMark } from './lanes.js';

// the reader's half of the lanes.json contract (FRM-659): every field the deck reads is in the fixture the stash's
// writer test holds to
describe('the deck reads the lanes.json the stash writes', () => {
    test('an ended lane leaves the board, a live one stays', () => {
        expect(lanesShown(LANES_SHELF).map((l) => l.id)).toEqual(['l98']);
    });

    test('every field a card draws is there', () => {
        const [lane] = lanesShown(LANES_SHELF);
        expect({
            current: typeof lane?.current,
            done: typeof lane?.done,
            id: typeof lane?.id,
            isDone: typeof lane?.items?.[0]?.isDone,
            text: typeof lane?.items?.[0]?.text,
            ticket: typeof lane?.ticket,
            title: typeof lane?.title,
        }).toEqual({
            current: 'number',
            done: 'number',
            id: 'string',
            isDone: 'boolean',
            text: 'string',
            ticket: 'string',
            title: 'string',
        });
    });

    test('a file that cannot be read shows no lane', () => {
        expect(lanesShown(null)).toEqual([]);
    });
});

describe("a card's step marks follow each step's own done flag (FRM-656)", () => {
    test('a step ticked past the pointer reads done, an unticked one before it does not', () => {
        const items = [
            { isDone: false, text: 'a' },
            { isDone: false, text: 'b' },
            { isDone: true, text: 'c' },
        ];
        expect(items.map((item, i) => stepMark(item, i, 1))).toEqual([
            '·',
            '▸',
            '✓',
        ]);
    });
});
