import { describe, expect, it, vi } from 'vitest';

import { DECK_TOGGLED } from './chat-asks.js';
import { deckNode, toggleDeck } from './deck-block.js';

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

describe('deckNode', () => {
    it('the column orbit sits in hides, so antenna and glide go with it', () => {
        expect(deckNode(deck([glide, orbit]))?.id).toBe('deck');
    });

    it('a deck block straight in the row is toggled itself', () => {
        const tree = {
            children: [{ ...orbit, id: 'deck' }],
            id: 'body',
            type: 'row',
        };
        expect(deckNode(tree)?.id).toBe('deck');
        expect(deckNode({ ...tree, children: [orbit] })?.id).toBe('orbit');
    });

    it('a layout with no deck has nothing to toggle', () => {
        expect(deckNode(deck([glide]))).toBeNull();
    });

    it('reads a layout as herdr hands it, its tree under root', () => {
        expect(deckNode({ root: deck([orbit]) })?.id).toBe('deck');
    });
});

describe('toggleDeck', () => {
    const herdr = (tree: unknown) => ({
        layout: () => tree,
        run: vi.fn(),
        setShared: vi.fn(),
    });

    // FRM-620: 🚦 toggled a block id no layout held, so its press did nothing
    it('toggles the deck by its mod and writes when', () => {
        const at = herdr(deck([glide, orbit]));
        toggleDeck(at);
        expect(at.run.mock.calls).toEqual([['layout.toggle', { id: 'deck' }]]);
        expect(at.setShared.mock.calls).toEqual([
            [DECK_TOGGLED, expect.any(Number)],
        ]);
    });

    it('a layout with no deck runs nothing', () => {
        const at = herdr(deck([glide]));
        toggleDeck(at);
        expect(at.run).not.toHaveBeenCalled();
        expect(at.setShared).not.toHaveBeenCalled();
    });
});
