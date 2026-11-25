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
            itemTicket: typeof lane?.items?.[0]?.ticket,
            text: typeof lane?.items?.[0]?.text,
            ticket: typeof lane?.ticket,
            title: typeof lane?.title,
        }).toEqual({
            current: 'number',
            done: 'number',
            id: 'string',
            isDone: 'boolean',
            itemTicket: 'string',
            text: 'string',
            ticket: 'string',
            title: 'string',
        });
    });

    // l105 to l112 as they stood on 23 Nov: one lane with a card made by hand and one its dispatch opened (FRM-527:W139–W142)
    const CODIE = 'bcdc16c6';
    const card = (id: string, over: object = {}) => ({
        id,
        linkedIds: { codie: CODIE },
        title: 'mods — a lighter board',
        ...over,
    });
    const PLAN = { plan: '~/lanes/mods-lane-9/lane-plan.md' };
    const DONE = { items: [{ isDone: true, text: 'a' }] };
    const HALF = { items: [...DONE.items, { isDone: false, text: 'b' }] };
    test.each([
        ['the one that follows its plan', {}, PLAN, ['l2']],
        ['the one that follows its plan, opened first', PLAN, {}, ['l1']],
        ['the newest, neither following one', {}, {}, ['l2']],
        ['the newest, both following one', PLAN, PLAN, ['l2']],
        [
            'the one not finished, over one that follows a plan',
            { ...PLAN, ...DONE },
            HALF,
            ['l2'],
        ],
        [
            'the one not finished, opened first',
            HALF,
            { ...PLAN, ...DONE },
            ['l1'],
        ],
        ['the newest, both finished', DONE, DONE, ['l2']],
        [
            'a title of the same first word',
            {},
            { title: 'mods lane 9' },
            ['l2'],
        ],
        [
            'a dashed one',
            { title: 'speak — x' },
            { title: 'speak-move' },
            ['l2'],
        ],
    ])('two live cards of one lane: %s', (_what, first, second, shown) => {
        const lanes = [card('l1', first), card('l2', second)];
        expect(lanesShown({ lanes }).map((l) => l.id)).toEqual(shown);
    });

    test.each([
        ['of two codies', { linkedIds: { codie: 'e412b9a7' } }],
        ['linked to none', { linkedIds: undefined }],
        [
            'of two lanes of one codie, as l93 and l94',
            { ...PLAN, title: 'frm-602 probe' },
        ],
    ])('two live cards %s are both drawn', (_what, second) => {
        const lanes = [card('l1'), card('l2', second)];
        expect(lanesShown({ lanes }).map((l) => l.id)).toEqual(['l1', 'l2']);
        const unlinked = lanes.map((l) => ({ ...l, linkedIds: undefined }));
        expect(lanesShown({ lanes: unlinked })).toHaveLength(2);
    });

    test('the drawn one ends: the other comes, the lane keeps a card', () => {
        const lanes = [card('l1'), card('l2', { ...PLAN, endedAt: 1 })];
        expect(lanesShown({ lanes }).map((l) => l.id)).toEqual(['l1']);
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
