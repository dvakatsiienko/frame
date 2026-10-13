import { expect, test } from 'claude-code/testing';

import {
    ROW_STEPS,
    contrastOf,
    ctxBarSvg,
    ctxRingSvg,
    effortSvg,
} from '../hooks/register.tsx';

// a session row's two meters in one bright look, the context % merged into its meter as a ring (C) or with a thin bar
// under it (B), switched in 🎛️ (dima, 10-13 16:50 «swamp … make prettier, brighter», «print a session context number
// combined with the meter»; 17:00 «i like B and C … create a setting for me to switch between them»)

const PANE = { dark: '#1f1e1d', light: '#ffffff' };
const STEPS: string[] = [...ROW_STEPS.light, ...ROW_STEPS.dark];

const widthOf = (svg: string) => svg.match(/<svg[^>]* width="([\d.]+)"/)?.[1];
const styleOf = (svg: string) =>
    svg.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
// a class's colour in the light rule, then in the dark one
const tints = (svg: string, cls: string) =>
    [
        ...styleOf(svg).matchAll(
            new RegExp(`\\.${cls}\\{(?:fill|stroke):(#[0-9a-f]{6})\\}`, 'g'),
        ),
    ].map((m) => m[1] ?? '');

const FILLS = [0, 7, 43, 100];

for (const [name, draw] of [
    ['B, the bar', ctxBarSvg],
    ['C, the ring', ctxRingSvg],
] as const) {
    test(`${name} keeps one width from 0 % to 100 % and prints its %`, () => {
        const svgs = FILLS.map((p) => draw(p, 80));
        expect([
            new Set(svgs.map(widthOf)).size,
            svgs.every((s, i) => s.includes(`>${FILLS[i]}%<`)),
        ]).toEqual([1, true]);
    });

    test(`${name}'s meter is one of the ramp's steps, never a blend: green when low, red at the compaction point`, () => {
        const every = Array.from({ length: 21 }, (_, i) =>
            tints(draw(i * 5, 80), 'c'),
        ).flat();
        expect([
            tints(draw(10, 80), 'c'),
            tints(draw(80, 80), 'c'),
            every.every((c) => STEPS.includes(c)),
        ]).toEqual([
            [ROW_STEPS.light[0], ROW_STEPS.dark[0]],
            [ROW_STEPS.light[4], ROW_STEPS.dark[4]],
            true,
        ]);
    });

    test(`${name}'s % reads at 4.5:1 or more at every fill, light and dark`, () => {
        const weak = Array.from({ length: 21 }, (_, i) => i * 5).flatMap(
            (p) => {
                const [light = '', dark = ''] = tints(draw(p, 80), 'n');
                return contrastOf(light, PANE.light) < 4.5 ||
                    contrastOf(dark, PANE.dark) < 4.5
                    ? [`${p}%`]
                    : [];
            },
        );
        expect(weak).toEqual([]);
    });
}

test('every step reads at 3:1 or more on its pane, light and dark', () => {
    const weak = (['light', 'dark'] as const).flatMap((mode) =>
        ROW_STEPS[mode].filter((c) => contrastOf(c, PANE[mode]) < 3),
    );
    expect(weak).toEqual([]);
});

test('the bar takes less width than the ring', () => {
    expect(
        Number(widthOf(ctxBarSvg(43, 80))) <
            Number(widthOf(ctxRingSvg(43, 80))),
    ).toBe(true);
});

test("the ring's arc runs to the %", () => {
    const [arc = 0, whole = 1] = (
        ctxRingSvg(43, 80).match(/stroke-dasharray="([\d.]+) ([\d.]+)"/) ?? []
    )
        .slice(1)
        .map(Number);
    expect(Math.round((arc / whole) * 100)).toBe(43);
});

test("the bar's fill runs to the %", () => {
    const [track = 0, fill = 0] = [
        ...ctxBarSvg(50, 80).matchAll(/<rect[^>]* width="([\d.]+)"/g),
    ].map((m) => Number(m[1]));
    expect(Math.round((fill / track) * 100)).toBe(50);
});

test('the effort meter lights each cell in its own step, the 5th red', () => {
    const svg = effortSvg(5);
    expect([0, 1, 2, 3, 4].map((i) => tints(svg, `e${i}`)[0])).toEqual([
        ...ROW_STEPS.light,
    ]);
});
