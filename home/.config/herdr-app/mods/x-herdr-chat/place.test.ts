import { describe, expect, test } from 'vitest';

import { topOf } from './follow.js';
import { WHEEL_REST_MS, createPlace } from './place.js';

// the place keeper the view runs, against a list that behaves as herdr's was probed to (2026-11-16): its first drawn
// row is exact in every frame; the row callback is called once more each frame, first, for row 0 alone; a wheel step
// is its movement; an asked item's top goes to the view's top only from above the view, from below it stops at the
// view's bottom, on screen it stays; its px stay when sizes change. the view only does what `plan` asks

const TOOL = 3;
const REPLY = 4;
/** rows 0–2 fill a screen above; row 3 is a one-line tool row, row 4 the long reply he reads */
const thread = () => [300, 300, 300, 28, 800, 300, 300, 300, 300];

function createSim(heights: number[], viewH = 600, zoom = 1) {
    const place = createPlace();
    const rows = heights.map((_, i) => ({ id: `r${i}` }));
    let sizes = [...heights];
    // the list: what it was last handed, and where it sits in px
    let itemSizes = [...sizes];
    let scrollTop = 0;
    let now = 1_000;
    const clamp = () => {
        const max = Math.max(0, topOf(itemSizes, itemSizes.length) - viewH);
        scrollTop = Math.min(max, Math.max(0, scrollTop));
    };
    /** the items the list draws, as its own source has it (gpui-kit `virtual_list.rs`, `visible_range`) */
    const drawnItems = () => {
        const firstEndingPast = (edge: number) => {
            let bottom = 0;
            for (const [i, size] of itemSizes.entries()) {
                bottom += size;
                if (bottom > edge) return i;
            }
            return itemSizes.length;
        };
        const start = firstEndingPast(scrollTop);
        const crossing = firstEndingPast(scrollTop + viewH);
        const end =
            crossing === itemSizes.length
                ? itemSizes.length
                : Math.min(crossing + 2, itemSizes.length);
        return { end: Math.max(end, start), start };
    };

    /** one render and its frame, as main.js `list()` runs them; a lift asks for the next frame at once */
    function frame() {
        const plan = place.plan(rows, sizes, viewH);
        itemSizes = [...plan.itemSizes];
        if (plan.ask === 'end' || plan.ask === 'lift')
            scrollTop = Number.MAX_SAFE_INTEGER;
        clamp();
        if (plan.ask === 'seek') {
            const itemTop = topOf(itemSizes, plan.seekAt);
            const itemBottom = itemTop + (itemSizes[plan.seekAt] ?? 0);
            if (itemTop < scrollTop) scrollTop = itemTop;
            else if (itemBottom > scrollTop + viewH)
                scrollTop = itemBottom - viewH;
            clamp();
        }
        for (const drawn of [{ end: 1, start: 0 }, drawnItems()])
            place.drawn(drawn, plan, now);
        if (plan.ask === 'lift') frame();
    }
    frame();

    return {
        /** new rows at the thread's end: a message, a reply's line, a tool row */
        append(...more: number[]) {
            for (const size of more) {
                rows.push({ id: `r${rows.length}` });
                sizes = [...sizes, size];
            }
            frame();
        },
        /** time passes with no wheel step */
        idle(ms: number) {
            now += ms;
        },
        isFollowing: () => place.follow,
        /** a row got its real height */
        measure(index: number, height: number) {
            place.read(rows, sizes);
            sizes = sizes.map((size, i) => (i === index ? height : size));
            const isHeld = place.measured(rows, index, now);
            frame();
            return isHeld;
        },
        /** a scroll that reaches the list but not the view's wheel handler: a flick's glide */
        moveUnseen(px: number) {
            scrollTop += px;
            clamp();
            frame();
        },
        /** a new width: every height is guessed again and his place is held, as main.js does */
        resize() {
            place.read(rows, sizes);
            place.hold();
            frame();
        },
        /** a saved place read back after a reload */
        restore(saved: { id: string; offset: number }) {
            place.restore(saved.id, saved.offset);
            frame();
        },
        /** what the save timer would write now */
        saved() {
            place.read(rows, sizes);
            return place.place;
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
        /** his wheel step: the handler with the range of the frame before, then the list moves, then a frame */
        wheel(dy: number) {
            const step = place.wheel(dy / zoom, rows, sizes, viewH, now);
            // the list's sizes are in the mod's unit, the wheel's delta in the window's px (assumed, not probed)
            scrollTop -= dy / zoom;
            clamp();
            now += 16;
            frame();
            return step;
        },
    };
}

/** from the tool row's top to `px` into the reply, in steps of `step`; rested after */
function readInto(sim: ReturnType<typeof createSim>, px: number, step: number) {
    sim.restore({ id: `r${TOOL}`, offset: 0 });
    for (let moved = 0; moved < 28 + px; moved += step) sim.wheel(-step);
    sim.idle(WHEEL_REST_MS);
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

    test('a place already on screen when it is asked for again still lands at the top', () => {
        const sim = createSim(thread());
        sim.restore({ id: `r${REPLY}`, offset: 405 });
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

describe('nothing moves the view without him', () => {
    test.each([
        ['a message', [120]],
        ['a reply’s line', [640]],
        ['a tool row, then a reply', [28, 300]],
    ])(
        '%s lands while he reads mid-thread: the view stays on his line',
        (_what, more) => {
            const sim = createSim(thread());
            readInto(sim, 405, 37);
            const before = sim.truth();
            sim.append(...more);
            expect(sim.truth()).toEqual(before);
            expect(sim.isFollowing()).toBe(false);
        },
    );

    test('at the end, a new row is followed', () => {
        const sim = createSim(thread());
        expect(sim.isFollowing()).toBe(true);
        sim.append(120);
        // 3,048 px of rows and 2 px of end marks in a 600 px view: the last screen starts 2,450 px down; row 7's top
        // is at 2,328
        expect(sim.truth()).toEqual({ id: 'r7', offset: 122 });
    });

    test('a newest reply taller than the view: steps down to its last line follow again', () => {
        const sim = createSim([300, 300, 1500]);
        sim.wheel(400);
        expect(sim.isFollowing()).toBe(false);
        for (let moved = 0; moved < 400; moved += 100) sim.wheel(-100);
        expect(sim.isFollowing()).toBe(true);
    });

    test('steps down that stop inside a tall newest reply keep him reading', () => {
        const sim = createSim([300, 300, 1500]);
        sim.wheel(400);
        for (let moved = 0; moved < 300; moved += 100) sim.wheel(-100);
        expect(sim.isFollowing()).toBe(false);
        sim.append(120);
        expect(sim.isFollowing()).toBe(false);
    });

    test('steps down that stop a few lines above the end keep him reading', () => {
        const sim = createSim(thread());
        sim.wheel(200);
        sim.wheel(-150);
        expect(sim.isFollowing()).toBe(false);
    });

    test('a flick whose glide reaches the end unseen: his next step down follows', () => {
        const sim = createSim([300, 300, 1500]);
        sim.wheel(400);
        sim.idle(WHEEL_REST_MS);
        sim.moveUnseen(400);
        expect(sim.isFollowing()).toBe(false);
        sim.wheel(-10);
        expect(sim.isFollowing()).toBe(true);
    });

    test('a step up stops following, and a new row then leaves the view where it is', () => {
        const sim = createSim(thread());
        sim.wheel(50);
        const before = sim.truth();
        sim.append(120);
        expect(sim.isFollowing()).toBe(false);
        expect(sim.truth()).toEqual(before);
    });

    test('steps down that reach the end follow again', () => {
        const sim = createSim(thread());
        sim.wheel(50);
        sim.wheel(-30);
        sim.wheel(-30);
        expect(sim.isFollowing()).toBe(true);
    });

    test('a step down, then a new width at once: his place lands again, he is not thrown to the newest', () => {
        const sim = createSim(thread());
        readInto(sim, 405, 37);
        sim.wheel(-10);
        const before = sim.truth();
        // the landing sends the list to its end for one frame, inside the wheel's rest
        sim.resize();
        expect(sim.isFollowing()).toBe(false);
        expect(sim.truth()).toEqual(before);
    });

    test('a height arriving above his place during his own scroll holds nothing', () => {
        const sim = createSim(thread());
        readInto(sim, 405, 37);
        sim.wheel(-10);
        expect(sim.measure(1, 320)).toBe(false);
        sim.idle(WHEEL_REST_MS);
        expect(sim.measure(2, 340)).toBe(true);
    });

    test('a wheel step between a landing’s two frames is ignored', () => {
        const place = createPlace();
        const rows = thread().map((_, i) => ({ id: `r${i}` }));
        place.restore(`r${REPLY}`, 405);
        expect(place.plan(rows, thread(), 600).ask).toBe('lift');
        expect(place.wheel(-10, rows, thread(), 600, 0).isIgnored).toBe(true);
        expect(place.plan(rows, thread(), 600).ask).toBe('seek');
    });

    test('a thread read again from its start forgets a held place', () => {
        const place = createPlace();
        const rows = thread().map((_, i) => ({ id: `r${i}` }));
        place.restore(`r${REPLY}`, 405);
        place.reset();
        expect(place.plan(rows, thread(), 600).ask).toBe('end');
        expect(place.place).toBeNull();
    });
});
