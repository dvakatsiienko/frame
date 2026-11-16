import { describe, expect, test } from 'vitest';

import {
    needsLift,
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
        isLifted: false,
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
        const rowAt = (i: number) => (cutAt >= 0 && i > cutAt ? i - 1 : i);
        let seekAt = -1;
        let isLifting = false;
        if (view.isSeekDue && view.cut) {
            if (split.seekAt < 0) {
                view.isSeekDue = false;
                view.cut = null;
            } else if (
                !view.isLifted &&
                needsLift(view.range, rowAt(split.seekAt))
            ) {
                view.isLifted = true;
                isLifting = true;
            } else {
                view.isSeekDue = false;
                view.isLifted = false;
                seekAt = split.seekAt;
            }
        }
        // the list keeps its px when its sizes change
        itemSizes = [...split.sizes];
        if (isLifting) scrollTop = Number.MAX_SAFE_INTEGER;
        clamp();
        // an asked item: its top goes to the view's top only from above the view; from below it stops at the view's
        // bottom, and one on screen stays put (seen in his window, 2026-11-16)
        if (seekAt >= 0) {
            const itemTop = topOf(itemSizes, seekAt);
            const itemBottom = itemTop + (itemSizes[seekAt] ?? 0);
            if (itemTop < scrollTop) scrollTop = itemTop;
            else if (itemBottom > scrollTop + viewH)
                scrollTop = itemBottom - viewH;
        }
        clamp();
        // herdr calls the row callback twice a frame: first for row 0 alone, which it measures the width by (seen in
        // his window, 2026-11-16), then for the rows on screen
        for (const drawnStart of [0, firstItem()]) {
            view.range = { end: rows.length, start: rowAt(drawnStart) };
            if (view.cut && split.seekAt >= 0 && drawnStart === split.seekAt)
                view.top = rowTop(sizes, rowAt(split.seekAt)) + cutOffset;
        }
    }

    // the lift asked for one more frame
    const settle = () => {
        while (view.isSeekDue) frame();
    };

    /** main.js `readPlace`: the place from the rows the list drew last */
    function readPlace() {
        if (view.cut || !view.range) return;
        const pinned = pinToRow(view.top, view.range.start, sizes);
        view.top = pinned.top;
        view.offset = pinned.offset;
        view.place = rows[view.range.start]?.id ?? null;
    }

    return {
        /** a row got its real height; the measurer holds the place when the row sits at or above it */
        measure(index: number, height: number) {
            readPlace();
            sizes = sizes.map((size, i) => (i === index ? height : size));
            const at = placeIndex(rows, view.place);
            if (at >= 0 && index <= at && view.place) {
                view.cut = { id: view.place, offset: view.offset };
                view.isSeekDue = true;
                view.isLifted = false;
            }
            frame();
            settle();
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
            view.isLifted = false;
            frame();
            settle();
        },
        /** what the save timer would write now */
        saved() {
            readPlace();
            return { id: view.place, offset: view.offset };
        },
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
            readPlace();
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
        // his own step first: a place held since a reload stays the place until he moves
        sim.wheel(-1);
        sim.moveUnseen(432);
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

    test('after a reload every height is a guess: the place comes back once the real heights arrive', () => {
        // the reply is guessed at 200 px, shorter than the 405 px he was into it
        const guessed = thread().map((size, i) => (i === REPLY ? 200 : size));
        const sim = createSim(guessed);
        sim.restore({ id: `r${REPLY}`, offset: 405 });
        sim.measure(1, 520);
        sim.measure(REPLY, 800);
        expect(sim.truth()).toEqual({ id: `r${REPLY}`, offset: 405 });
        expect(sim.saved()).toEqual({ id: `r${REPLY}`, offset: 405 });
    });

    test('a place below the view, or already on screen, still lands at the top', () => {
        const sim = createSim(thread());
        // the list sits at its start; the reply is below the view
        sim.restore({ id: `r${REPLY}`, offset: 405 });
        expect(sim.truth()).toEqual({ id: `r${REPLY}`, offset: 405 });
        // one row above gets its real height: the reply is on screen when it is asked for again
        sim.measure(1, 320);
        expect(sim.truth()).toEqual({ id: `r${REPLY}`, offset: 405 });
    });

    test('one step up from a restored place inside the reply', () => {
        const sim = createSim(thread());
        sim.restore({ id: `r${REPLY}`, offset: 405 });
        sim.wheel(10);
        expect(sim.saved()).toEqual(sim.truth());
    });
});
