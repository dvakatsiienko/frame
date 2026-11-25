import { describe, expect, test } from 'vitest';

import { LANES_SHELF } from '../../../../.claude/plugin-x/mods/x-mod-stash/tests/lanes-shelf.ts';
import { laneTicket, lanesShown, stepMark } from './lanes.js';

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

    // l111 and l112 as they stood on 23 Nov 19:27: one codie's lane with two live cards (FRM-527:W139–W142)
    test.each([
        ['linked to one codie', 'bcdc16c6', 'bcdc16c6', ['l111']],
        ['of two codies', 'bcdc16c6', 'e412b9a7', ['l111', 'l112']],
        ['linked to none', undefined, undefined, ['l111', 'l112']],
    ])('two live cards %s', (_what, a, b, shown) => {
        const card = (id: string, codie?: string) => ({
            id,
            linkedIds: { codie },
            title: 'mods',
        });
        const body = { lanes: [card('l111', a), card('l112', b)] };
        expect(lanesShown(body).map((l) => l.id)).toEqual(shown);
        const [, second] = body.lanes;
        // the first one ends while herdr is open: its lane still has a card
        expect(
            lanesShown({
                lanes: [{ ...card('l111', a), endedAt: 1 }, second],
            }).map((l) => l.id),
        ).toEqual(['l112']);
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

// only a title with an id in it gives the card one (x-mod-stash titleTicket), so a card named by hand had no pill
// (FRM-527:W137, W142)
describe("a card's ticket", () => {
    const item = (text: string, ticket?: string) => ({ text, ticket });
    test.each([
        ['its own', { ticket: 'FRM-585' }, 'FRM-585'],
        ["its current step's", { current: 1 }, 'FRM-639'],
        ['the next step of another', { current: 2 }, 'FRM-640'],
        ["the step's before, its own naming none", { current: 3 }, 'FRM-640'],
        ['every step done', { current: 4 }, 'FRM-640'],
        ['no step named before it', { current: 0 }, 'FRM-639'],
        ['no pointer yet', {}, 'FRM-639'],
    ])('%s', (_what, lane, ticket) => {
        const items = [
            item('a'),
            item('b', 'FRM-639'),
            item('c', 'FRM-640'),
            item('d'),
        ];
        expect(laneTicket({ items, title: 'mods', ...lane })).toBe(ticket);
    });

    test('none anywhere', () => {
        expect(laneTicket({ items: [item('a')], title: 'mods' })).toBe(
            undefined,
        );
        expect(laneTicket({ title: 'mods' })).toBe(undefined);
    });
});
