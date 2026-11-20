import { describe, expect, test } from 'vitest';

import { createTabMember, loopOf, nextStop, tabAsk } from './tab-loop.js';

// FRM-620 slice 5c: Tab walks one loop of stops our mods register, never herdr's hidden ones; a mod joins by
// publishing its stops (his 14:59: later the antenna's threads, the header's gear)
describe('the Tab loop', () => {
    const loop = ['quill', 'steer-a:o1', 'steer-b:o1'];

    test('Tab walks the loop and wraps from the last stop to the first', () => {
        expect(nextStop(loop, 'quill', false)).toBe('steer-a:o1');
        expect(nextStop(loop, 'steer-a:o1', false)).toBe('steer-b:o1');
        expect(nextStop(loop, 'steer-b:o1', false)).toBe('quill');
    });

    test('shift-Tab walks it backwards', () => {
        expect(nextStop(loop, 'quill', true)).toBe('steer-b:o1');
        expect(nextStop(loop, 'steer-a:o1', true)).toBe('quill');
    });

    test('a lone stop keeps the keyboard', () => {
        expect(nextStop(['quill'], 'quill', false)).toBe('quill');
    });

    test('a stop gone from the loop hands the keyboard to its first stop', () => {
        expect(nextStop(loop, 'steer-gone:o9', false)).toBe('quill');
    });

    // a real layout's shape, trimmed (layouts/itrout.json): blocks nest in `children`, a mod sits in `content`
    const layout = {
        children: [
            { content: { mod: 'x-herdr-tab-pills' } },
            {
                children: [
                    { content: { mod: 'x-herdr-chat' } },
                    { content: { mod: 'x-herdr-deck' } },
                ],
            },
        ],
    };

    test('the loop takes each mod’s stops in layout order, a mod with none adding nothing', () => {
        const stops: Record<string, unknown> = {
            'tab.stops.x-herdr-chat': ['quill'],
            'tab.stops.x-herdr-deck': ['steer-a:o1'],
        };
        expect(loopOf((key) => stops[key], layout)).toEqual([
            'quill',
            'steer-a:o1',
        ]);
        expect(loopOf(() => 'garbage', layout)).toEqual([]);
    });

    test('a mod that registers a stop joins the loop where the layout places it, with no shared list edited', () => {
        const store = new Map<string, unknown>([
            ['tab.stops.x-herdr-chat', ['quill']],
            ['tab.stops.x-herdr-deck', ['steer-a:o1']],
        ]);
        const herdr = {
            layout: () => ({
                children: [
                    { content: { mod: 'x-herdr-chat' } },
                    { content: { mod: 'x-test-gear' } },
                    { content: { mod: 'x-herdr-deck' } },
                ],
            }),
            setShared: (key: string, value: unknown) => store.set(key, value),
            shared: (key: string) => store.get(key),
        };
        createTabMember('x-test-gear', herdr).draw(['gear'], (run) => run());
        expect(loopOf(herdr.shared, herdr.layout())).toEqual([
            'quill',
            'gear',
            'steer-a:o1',
        ]);
    });

    // dima, 18:00: from the quill Tab walks orbit's asks, then antenna's threads; shift-Tab reaches antenna first. glide,
    // a `view` copy of the deck in the sidebar, must not pull the deck's stops ahead of the quill
    test("a mod's place is its own block, never a `view` copy of it drawn earlier", () => {
        const stops: Record<string, unknown> = {
            'tab.stops.x-herdr-antenna': ['thread-t1', 'thread-t2'],
            'tab.stops.x-herdr-chat': ['quill'],
            'tab.stops.x-herdr-deck': ['steer-a:o1'],
        };
        const withGlide = {
            children: [
                {
                    children: [
                        { content: { mod: 'x-herdr-antenna' } },
                        {
                            content: {
                                mod: 'x-herdr-deck',
                                props: { block: 'glide', view: 'glide' },
                            },
                        },
                    ],
                },
                { content: { mod: 'x-herdr-chat' } },
                { content: { mod: 'x-herdr-deck' } },
            ],
        };
        const loop = loopOf((key) => stops[key], withGlide);
        expect(nextStop(loop, 'quill', false)).toBe('steer-a:o1');
        expect(nextStop(loop, 'steer-a:o1', false)).toBe('thread-t1');
        expect(nextStop(loop, 'thread-t2', false)).toBe('quill');
        expect(nextStop(loop, 'quill', true)).toBe('thread-t2');
    });

    test('a mod gone from the layout leaves the loop, its old stops skipped', () => {
        const stops: Record<string, unknown> = {
            'tab.stops.x-herdr-chat': ['quill'],
            'tab.stops.x-herdr-deck-old': ['steer-a:o1'],
        };
        expect(loopOf((key) => stops[key], layout)).toEqual(['quill']);
        expect(loopOf((key) => stops[key], null)).toEqual([]);
    });
});

describe('a Tab ask', () => {
    test('counts on from the last ask, never by the clock, so a clock set back loses no Tab', () => {
        expect(tabAsk(() => ({ at: 41, to: 'quill' }), 'steer-a:o1')).toEqual({
            at: 42,
            to: 'steer-a:o1',
        });
        expect(tabAsk(() => null, 'quill')).toEqual({ at: 1, to: 'quill' });
    });
});
