import { describe, expect, test } from 'vitest';

import { GLIDE_MAX_PX, glideBlockPx } from './glide-size.js';

// FRM-618 slice C exit 2: glide sits at the sidebar's bottom, as tall as its cards, growing up as lanes join; past its
// tallest it scrolls and antenna keeps the room above
const CARD_PX = 96;
const HEAD_PX = 40;
const cardsOf = (lanes: number) => HEAD_PX + lanes * CARD_PX;

describe("glide's block under antenna", () => {
    test('three lanes take exactly their cards', () => {
        expect(glideBlockPx(3, cardsOf(3))).toBe(cardsOf(3));
    });

    test('eight lanes stop at the tallest glide gets, the rest scrolls', () => {
        expect(cardsOf(8)).toBeGreaterThan(GLIDE_MAX_PX);
        expect(glideBlockPx(8, cardsOf(8))).toBe(GLIDE_MAX_PX);
    });

    test('no lanes draws no block, antenna takes the whole sidebar', () => {
        expect(glideBlockPx(0, HEAD_PX)).toBe(0);
    });

    test('a fractional measure rounds up, so the last card is never clipped', () => {
        expect(glideBlockPx(1, 136.2)).toBe(137);
    });
});
