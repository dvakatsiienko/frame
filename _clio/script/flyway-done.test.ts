import { describe, expect, test } from 'vitest';

import { flywayKind, flywayLines, flywaySorted } from './flyway-done.ts';

describe('flyway-done', () => {
    test('a line takes its kind from its marker', () => {
        expect(flywayKind('⏳ a — waits for: x')).toBe('waits');
        expect(flywayKind('💤 b — later: dima 1')).toBe('later');
        expect(flywayKind('redraw the board')).toBe('open');
    });

    test('the sort keeps each kind in its own order', () => {
        expect(flywaySorted(['💤 c', '⏳ a', 'one', '⏳ b', 'two'])).toEqual([
            'one',
            'two',
            '⏳ a',
            '⏳ b',
            '💤 c',
        ]);
    });

    test('lines read with their number and tick', () => {
        expect(
            flywayLines('- [x] #3 shipped\n- [ ] #4 ⏳ read — waits for: x'),
        ).toEqual([
            { done: true, n: 3, text: 'shipped' },
            { done: false, n: 4, text: '⏳ read — waits for: x' },
        ]);
    });
});
