import { describe, expect, test } from 'vitest';

import { orbitSections, orbitTabOrder } from './orbit.js';

// FRM-620 slice 4 (W14): Tab walks every ask's tick, replay and steer in the order orbit draws them, the look and 🧪
// cards first; shift+Tab walks the same list back
const plain = {
    isGated: false,
    isLocked: false,
    link: null,
    mark: null,
    pick: null,
};
const row = (sid: string, pid: number, texts: string[]) => ({
    asks: texts.map((text, i) => ({ ...plain, id: `o${i + 1}`, text })),
    name: sid,
    pid,
    sid,
});

describe('orbit tab order', () => {
    test('each ask gives tick, replay, steer, ask after ask', () => {
        const sections = orbitSections(
            [row('a', 1, ['push', 'merge'])],
            [1],
            'top',
        );
        expect(orbitTabOrder(sections)).toEqual([
            'tick-a:o1',
            'replay-a:o1',
            'steer-a:o1',
            'tick-a:o2',
            'replay-a:o2',
            'steer-a:o2',
        ]);
    });

    test('the look and 🧪 cards lead, then each thread in the drawn order', () => {
        const sections = orbitSections(
            [row('b', 2, ['rename']), row('a', 1, ['push', 'look: the dock'])],
            [1, 2],
            'top',
        );
        expect(
            orbitTabOrder(sections).filter((id) => id.startsWith('tick')),
        ).toEqual(['tick-a:o2', 'tick-a:o1', 'tick-b:o1']);
    });

    test('with the cards at the bottom, Tab reaches them last', () => {
        const sections = orbitSections(
            [row('a', 1, ['look: the dock', 'push'])],
            [1],
            'bottom',
        );
        expect(
            orbitTabOrder(sections).filter((id) => id.startsWith('tick')),
        ).toEqual(['tick-a:o2', 'tick-a:o1']);
    });
});
