import { describe, expect, test } from 'vitest';

import { createForeground } from './foreground.js';

/** herdr's settings.json and the part's own store, in memory */
function world(settings: object | null = { font_size: 14 }) {
    let text: string | null =
        settings === null ? null : `${JSON.stringify(settings, null, 2)}\n`;
    const kept: Record<string, string> = {};
    let writes = 0;
    const foreground = createForeground({
        read: async () => text,
        store: {
            getItem: (key: string) => kept[key] ?? null,
            removeItem: (key: string) => {
                delete kept[key];
            },
            setItem: (key: string, value: string) => {
                kept[key] = value;
            },
        },
        write: async (next: string, expected: string | null) => {
            if (expected !== text) throw new Error('changed since read');
            writes += 1;
            text = next;
        },
    });
    return {
        foreground,
        settings: () => (text === null ? null : JSON.parse(text)),
        writes: () => writes,
    };
}

/** the same, with a settings file whose every write can be refused, as by a write racing his own */
function refusable(settings: object) {
    let text = `${JSON.stringify(settings)}\n`;
    const kept: Record<string, string> = {};
    let isRefusing = false;
    const foreground = createForeground({
        read: async () => text,
        store: {
            getItem: (key: string) => kept[key] ?? null,
            removeItem: (key: string) => {
                delete kept[key];
            },
            setItem: (key: string, value: string) => {
                kept[key] = value;
            },
        },
        write: async (next: string) => {
            if (isRefusing) throw new Error('changed since read');
            text = next;
        },
    });
    return {
        foreground,
        refuse: (is: boolean) => {
            isRefusing = is;
        },
        settings: () => JSON.parse(text),
    };
}

describe('«text (all of herdr)» writes herdr’s settings only on his change', () => {
    test('a load with no change by him writes nothing', async () => {
        const w = world({ colors: { foreground: '#123456' } });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(w.writes()).toBe(0);
    });

    test('his colour becomes the whole app’s text colour, his other settings kept', async () => {
        const w = world({ font_size: 14 });
        await w.foreground.change('#f0dfbf');
        expect(w.settings()).toEqual({
            colors: { foreground: '#f0dfbf' },
            font_size: 14,
        });
    });

    test('«theme» takes the colour out again', async () => {
        const w = world({ font_size: 14 });
        await w.foreground.change('#f0dfbf');
        await w.foreground.change('theme');
        expect(w.settings()).toEqual({ font_size: 14 });
    });

    test('a colour already there is not written again', async () => {
        const w = world({ colors: { foreground: '#f0dfbf' } });
        await w.foreground.change('#f0dfbf');
        expect(w.writes()).toBe(0);
    });

    test('Reset puts back the colour from before his first change', async () => {
        const w = world({
            colors: { accent: '#ff0000', foreground: '#123456' },
        });
        await w.foreground.change('#f0dfbf');
        await w.foreground.change('#e6edf3');
        await w.foreground.reset();
        expect(w.settings()).toEqual({
            colors: { accent: '#ff0000', foreground: '#123456' },
        });
    });

    test('Reset with no colour before takes his out', async () => {
        const w = world({ font_size: 14 });
        await w.foreground.change('#f0dfbf');
        await w.foreground.reset();
        expect(w.settings()).toEqual({ font_size: 14 });
    });

    test('Reset with no change of his writes nothing', async () => {
        const w = world({ colors: { foreground: '#123456' } });
        await w.foreground.reset();
        expect(w.writes()).toBe(0);
    });

    test('the colour from before outlives a reload of the part', async () => {
        const w = world({ colors: { foreground: '#123456' } });
        await w.foreground.change('#f0dfbf');
        const again = createForeground({
            read: async () => `${JSON.stringify(w.settings())}\n`,
            store: {
                getItem: () => '{"foreground":"#123456"}',
                removeItem: () => {},
                setItem: () => {},
            },
            write: async (next: string) => {
                expect(JSON.parse(next)).toEqual({
                    colors: { foreground: '#123456' },
                });
            },
        });
        await again.reset();
    });

    test('Reset pressed while his pick is still being written wins', async () => {
        const w = world({ colors: { foreground: '#123456' } });
        const pick = w.foreground.change('#f0dfbf');
        const reset = w.foreground.reset();
        await Promise.all([pick, reset]);
        expect(w.settings()).toEqual({ colors: { foreground: '#123456' } });
    });

    test('a Reset whose writes are refused keeps the colour from before for the next one', async () => {
        const w = refusable({ colors: { foreground: '#123456' } });
        await w.foreground.change('#f0dfbf');
        w.refuse(true);
        await w.foreground.reset();
        w.refuse(false);
        await w.foreground.reset();
        expect(w.settings()).toEqual({ colors: { foreground: '#123456' } });
    });

    test('a pick whose writes are refused keeps no colour from before', async () => {
        const w = refusable({ colors: { foreground: '#123456' } });
        w.refuse(true);
        await w.foreground.change('#f0dfbf');
        w.refuse(false);
        await w.foreground.change('#e6edf3');
        await w.foreground.reset();
        expect(w.settings()).toEqual({ colors: { foreground: '#123456' } });
    });

    test('a settings file that does not parse is left alone', async () => {
        let writes = 0;
        const foreground = createForeground({
            read: async () => '{ not json',
            store: {
                getItem: () => null,
                removeItem: () => {},
                setItem: () => {},
            },
            write: async () => {
                writes += 1;
            },
        });
        await foreground.change('#f0dfbf');
        expect(writes).toBe(0);
    });
});
