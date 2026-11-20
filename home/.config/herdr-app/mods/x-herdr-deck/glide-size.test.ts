import { describe, expect, test } from 'vitest';

import { GLIDE_MAX_PX, glideResize } from './glide-size.js';

// FRM-618 slice C exit 2: glide sits at the sidebar's bottom, as tall as its cards, growing up as lanes join; past its
// tallest it scrolls and antenna keeps the room above
const CARD_PX = 96;
const HEAD_PX = 40;
const cardsOf = (lanes: number) => HEAD_PX + lanes * CARD_PX;

describe("glide's block under antenna", () => {
    test('three lanes take exactly their cards', () => {
        expect(
            glideResize({ blockPx: 200, contentPx: cardsOf(3), lanes: 3 }),
        ).toBe(cardsOf(3));
    });

    test('eight lanes stop at the tallest glide gets, the rest scrolls', () => {
        expect(cardsOf(8)).toBeGreaterThan(GLIDE_MAX_PX);
        expect(
            glideResize({ blockPx: 200, contentPx: cardsOf(8), lanes: 8 }),
        ).toBe(GLIDE_MAX_PX);
    });

    test('a block already as tall as its cards asks nothing', () => {
        expect(
            glideResize({
                blockPx: cardsOf(2),
                contentPx: cardsOf(2),
                lanes: 2,
            }),
        ).toBe(null);
    });

    test('a block dragged or reset away from its cards is asked back', () => {
        expect(
            glideResize({ blockPx: 200, contentPx: cardsOf(2), lanes: 2 }),
        ).toBe(cardsOf(2));
    });

    test('no lanes leaves a 1 px seam: antenna takes the sidebar, and glide still draws to hear a lane join', () => {
        expect(glideResize({ blockPx: 232, contentPx: 8, lanes: 0 })).toBe(1);
        expect(glideResize({ blockPx: 1, contentPx: 8, lanes: 0 })).toBe(null);
    });

    test('a fractional measure rounds up, so the last card is never clipped', () => {
        expect(glideResize({ blockPx: 0, contentPx: 136.2, lanes: 1 })).toBe(
            137,
        );
    });
});
