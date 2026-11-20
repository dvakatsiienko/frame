import { describe, expect, test } from 'vitest';

import { asksOf } from './orbit.js';

// FRM-620 slice 3 (W16, W18): look and 🧪 test cards pin first, hazards second, the rest keep the store's order; the draw
// sorts, never the store
describe('pinned asks draw first', () => {
    const ids = (asks: { id: string; text: string }[]) =>
        asksOf({ asks }).map((a) => a.id);

    test('look and test cards first in their order, a ⚠️ ask next, the plain asks after in their own order', () => {
        expect(
            ids([
                { id: 'o1', text: 'push FRM-1' },
                { id: 'o2', text: 'rename the band' },
                { id: 'o3', text: 'look: the new chat' },
                { id: 'o4', text: '⚠️ merge #9' },
                { id: 'o5', text: 'try the dock with a long name' },
            ]),
        ).toEqual(['o3', 'o5', 'o4', 'o1', 'o2']);
    });

    test('an ask opening «test:» or «try» is a test card, one opening «trying» is not', () => {
        expect(
            ids([
                { id: 'o1', text: 'trying the dock' },
                { id: 'o2', text: 'test: the quill keeps its text' },
                { id: 'o3', text: 'Try a drag' },
                { id: 'o4', text: 'tests ran' },
            ]),
        ).toEqual(['o2', 'o3', 'o1', 'o4']);
    });

    test('two ⚠️ asks keep their order among themselves, two look cards too', () => {
        expect(
            ids([
                { id: 'o1', text: 'look: the tabs' },
                { id: 'o2', text: '⚠️ push main' },
                { id: 'o3', text: 'look: the dock' },
                { id: 'o4', text: '⚠️ merge #9' },
            ]),
        ).toEqual(['o1', 'o3', 'o2', 'o4']);
    });

    test('a bare ⚠, a leading space and a capital Look pin too', () => {
        expect(
            ids([
                { id: 'o1', text: 'push FRM-1' },
                { id: 'o2', text: 'Look at the dock' },
                { id: 'o3', text: '  ⚠ push main' },
            ]),
        ).toEqual(['o2', 'o3', 'o1']);
    });

    test('a ticked pinned ask keeps its place', () => {
        expect(
            asksOf({
                asks: [
                    { id: 'o1', text: 'push FRM-1' },
                    { id: 'o2', mark: 'accepted', text: '⚠️ merge #9' },
                ],
            }).map((a) => a.id),
        ).toEqual(['o2', 'o1']);
    });

    test('a word that only starts like look pins nothing', () => {
        expect(
            ids([
                { id: 'o1', text: 'push FRM-1' },
                { id: 'o2', text: 'lookup the cap' },
            ]),
        ).toEqual(['o1', 'o2']);
    });

    test('the state the stash wrote keeps its order', () => {
        const asks = [
            { id: 'o1', text: 'push FRM-1' },
            { id: 'o2', text: '⚠️ merge #9' },
        ];
        asksOf({ asks });
        expect(asks.map((a) => a.id)).toEqual(['o1', 'o2']);
    });
});
