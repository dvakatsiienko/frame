import { describe, expect, test } from 'vitest';

import {
    pinToRow,
    placeIndex,
    topOf as rowTop,
    splitAtPlace,
    topAfterWheel,
} from './follow.js';

// the kept reading place against the true one. a list that behaves as herdr's was probed to (first row exact in every
// frame, a wheel step is its movement, an asked item's top goes to the view's top, its px stay when sizes change), and
// the bookkeeping of `main.js` mirrored around the real rules: the order lives in main.js's closures, so it is
// copied here, not imported

const TOOL = 3;
const REPLY = 4;
/** rows 0–2 fill a screen above; row 3 is a one-line tool row, row 4 the long reply he reads */
const thread = () => [300, 300, 300, 28, 800, 300, 300, 300, 300];

function createSim(heights: number[], viewH = 600, zoom = 1) {
    const rows = heights.map((_, i) => ({ id: `r${i}` }));
    let sizes = [...heights];
    // the list: what it was last handed, and where it sits in px
    let itemSizes = [...sizes];
    let scrollTop = 0;
    // the view's own state, named as in main.js
    const view = {
        cut: null as { id: string; offset: number } | null,
        isSeekDue: false,
        offset: 0,
        place: null as string | null,
        range: null as { start: number; end: number } | null,
        top: 0,
    };
    const topOf = (of: number[], index: number) =>
        of.slice(0, index).reduce((sum, size) => sum + size, 0);
    const clamp = () => {
        const max = Math.max(0, topOf(itemSizes, itemSizes.length) - viewH);
        scrollTop = Math.min(max, Math.max(0, scrollTop));
    };
    /** the first item with any px in view, as the probe measured in both directions */
    const firstItem = () => {
        let bottom = 0;
        for (const [i, size] of itemSizes.entries()) {
            bottom += size;
            if (bottom > scrollTop) return i;
        }
        return itemSizes.length - 1;
    };

    /** one render() and the row callback of its frame, as main.js `list()` runs them */
    function frame() {
        const split = view.cut
            ? splitAtPlace(rows, sizes, view.cut)
            : { cut: null, seekAt: -1, sizes };
        const cutAt = split.cut?.at ?? -1;
        const cutOffset = split.cut?.offset ?? 0;
        let seekAt = -1;
        if (view.isSeekDue && view.cut) {
            view.isSeekDue = false;
            if (split.seekAt >= 0) seekAt = split.seekAt;
            else view.cut = null;
        }
        // the list keeps its px when its sizes change; an asked item's top goes to the view's top
        itemSizes = [...split.sizes];
        if (seekAt >= 0) scrollTop = topOf(itemSizes, seekAt);
        clamp();
        const rowAt = (i: number) => (cutAt >= 0 && i > cutAt ? i - 1 : i);
        const drawnStart = firstItem();
        const range = { end: rows.length, start: rowAt(drawnStart) };
        view.range = range;
        if (cutAt >= 0 && drawnStart === cutAt + 1)
            view.top = rowTop(sizes, cutAt) + cutOffset;
        const pinned = pinToRow(view.top, range.start, sizes);
        view.top = pinned.top;
        view.offset = pinned.offset;
        view.place = rows[range.start]?.id ?? null;
    }

    return {
        /** a row got its real height; the measurer holds the place when the row sits at or above it */
        measure(index: number, height: number) {
            sizes = sizes.map((size, i) => (i === index ? height : size));
            const at = placeIndex(rows, view.place);
            if (at >= 0 && index <= at && view.place) {
                view.cut = { id: view.place, offset: view.offset };
                view.isSeekDue = true;
            }
            frame();
        },
        /** a scroll that reaches the list but not the view's wheel handler (seen in the second probe: 94 rows, 0 steps) */
        moveUnseen(px: number) {
            scrollTop += px;
            frame();
        },
        /** what restorePlace does after a reload */
        restore(place: { id: string; offset: number }) {
            view.place = place.id;
            view.offset = place.offset;
            view.cut = { ...place };
            view.isSeekDue = true;
            frame();
        },
        /** what the save timer would write now */
        saved: () => ({ id: view.place, offset: view.offset }),
        /** the first row on screen and the px of it above the view */
        truth() {
            let top = 0;
            for (const [i, size] of sizes.entries()) {
                if (top + size > scrollTop)
                    return { id: `r${i}`, offset: scrollTop - top };
                top += size;
            }
            return { id: 'none', offset: 0 };
        },
        /** his wheel step: main.js's handler with the range of the frame before, then the list moves, then a frame */
        wheel(dy: number) {
            view.cut = null;
            view.isSeekDue = false;
            view.top = topAfterWheel(view.top, dy / zoom, sizes, viewH);
            // the list's sizes are in the mod's unit, the wheel's delta in the window's px (assumed, not probed)
            scrollTop -= dy / zoom;
            clamp();
            frame();
        },
    };
}

/** from the tool row's top to `px` into the reply, in steps of `step` */
function readInto(sim: ReturnType<typeof createSim>, px: number, step: number) {
    sim.restore({ id: `r${TOOL}`, offset: 0 });
    for (let moved = 0; moved < 28 + px; moved += step) sim.wheel(-step);
}

describe('the kept place against the true one', () => {
    test('a restored place is where he is', () => {
        const sim = createSim(thread());
        sim.restore({ id: `r${REPLY}`, offset: 405 });
        expect(sim.truth()).toEqual({ id: `r${REPLY}`, offset: 405 });
        expect(sim.saved()).toEqual(sim.truth());
    });

    test.each([4, 10, 37, 120])(
        'down across the tool row and 405 px into the reply, %i px a step',
        (step) => {
            const sim = createSim(thread());
            readInto(sim, 405, step);
            expect(sim.saved()).toEqual(sim.truth());
        },
    );

    test.each([10, 37, 120])(
        'up from inside the reply into the rows above, %i px a step',
        (step) => {
            const sim = createSim(thread());
            sim.restore({ id: `r${REPLY}`, offset: 405 });
            for (let moved = 0; moved < 700; moved += step) sim.wheel(step);
            expect(sim.saved()).toEqual(sim.truth());
        },
    );

    test('a scroll the wheel never reported still names the message on screen, at most its height from the line', () => {
        const sim = createSim(thread());
        sim.restore({ id: `r${TOOL}`, offset: 0 });
        sim.moveUnseen(433);
        expect(sim.truth()).toEqual({ id: `r${REPLY}`, offset: 405 });
        expect(sim.saved()).toEqual({ id: `r${REPLY}`, offset: 0 });
    });

    test('the next wheel step after such a scroll counts on from the message, not from the old place', () => {
        const sim = createSim(thread());
        sim.restore({ id: `r${TOOL}`, offset: 0 });
        sim.moveUnseen(433);
        sim.wheel(-500);
        expect(sim.saved().id).toBe(sim.truth().id);
    });

    test('a row above gets its real height while he reads: the view stays on his line', () => {
        const sim = createSim(thread());
        readInto(sim, 405, 37);
        const before = sim.truth();
        sim.measure(1, 520);
        expect(sim.truth()).toEqual(before);
        expect(sim.saved()).toEqual(before);
    });

    test('zoom 1.25: the wheel counts window px, the rows are sized in zoomed px', () => {
        const sim = createSim(thread(), 600, 1.25);
        sim.restore({ id: `r${REPLY}`, offset: 0 });
        for (let moved = 0; moved < 400; moved += 10) sim.wheel(-10);
        expect(sim.saved()).toEqual(sim.truth());
    });

    test('one step up from a restored place inside the reply', () => {
        const sim = createSim(thread());
        sim.restore({ id: `r${REPLY}`, offset: 405 });
        sim.wheel(10);
        expect(sim.saved()).toEqual(sim.truth());
    });
});
