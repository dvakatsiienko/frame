import { describe, expect, it } from 'vitest';

import { parseThreadTabArgs } from './thread-tab.ts';

describe('parseThreadTabArgs', () => {
    it('takes a terminal and a name', () => {
        expect(parseThreadTabArgs(['t7b', '⚡ 🐕 strays | chores'])).toEqual({
            name: '⚡ 🐕 strays | chores',
            terminal: 't7b',
        });
    });

    it.each([
        [[]],
        [['t7b']],
        [['t7b', '']],
        [['', 'name']],
        [['t7b', 'name', 'extra']],
    ])('refuses %j', (argv) => {
        expect(parseThreadTabArgs(argv)).toBeNull();
    });
});
