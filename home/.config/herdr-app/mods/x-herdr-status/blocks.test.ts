import { describe, expect, it } from 'vitest';

import { deckToggleId } from './blocks.js';

// a real layout's shape, trimmed (layouts/itrout.json, 20 Nov): the deck is a column holding orbit, and in the deck
// layout antenna and glide sit above orbit in it
const deck = (children: object[]) => ({
    children: [
        {
            children: [
                { children: [], id: 'sidebar', type: 'column' },
                { children, id: 'deck', type: 'column' },
            ],
            id: 'body',
            type: 'row',
        },
    ],
    id: 'root',
    type: 'column',
});
const orbit = { content: { mod: 'x-herdr-deck' }, id: 'orbit', type: 'block' };
const glide = {
    content: { mod: 'x-herdr-deck', props: { view: 'glide' } },
    id: 'glide',
    type: 'block',
};

describe('deckToggleId', () => {
    it('⌘E hides the column orbit sits in, so antenna and glide go with it', () => {
        expect(deckToggleId(deck([glide, orbit]))).toBe('deck');
    });

    it('a deck block straight in the row is toggled itself', () => {
        const tree = {
            children: [{ ...orbit, id: 'deck' }],
            id: 'body',
            type: 'row',
        };
        expect(deckToggleId(tree)).toBe('deck');
        expect(deckToggleId({ ...tree, children: [orbit] })).toBe('orbit');
    });

    it('a layout with no deck has nothing to toggle', () => {
        expect(deckToggleId(deck([glide]))).toBeNull();
    });
});
