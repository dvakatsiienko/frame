import { describe, expect, test, vi } from 'vitest';

vi.mock('herdr', () => ({ exec: vi.fn(), settings: () => ({}) }));
vi.mock('gpui-kit', () => ({ div: vi.fn() }));
vi.mock('gpui-base', () => ({}));

const { miniPlace } = await import('./quill-mini.js');

describe('where it sits', () => {
    const view = { h: 600, w: 800 };
    const size = { h: 130, w: 420 };
    test.each([
        ['under the words’ end', { x: 40, y: 100 }, { x: 40, y: 112 }],
        ['over it near the bottom', { x: 40, y: 560 }, { x: 40, y: 418 }],
        ['left of the right edge', { x: 790, y: 100 }, { x: 368, y: 112 }],
        ['inside on the left', { x: -30, y: 100 }, { x: 0, y: 112 }],
        ['inside at the top', { x: 40, y: -90 }, { x: 40, y: 0 }],
        ['at the bottom middle with no place', null, { x: 190, y: 458 }],
    ])('%s', (_where, end, place) => {
        expect(miniPlace(end, view, size)).toEqual(place);
    });

    test('in a list too small for it, at its corner', () => {
        expect(miniPlace({ x: 10, y: 10 }, { h: 100, w: 300 }, size)).toEqual({
            x: 0,
            y: 0,
        });
    });
});
