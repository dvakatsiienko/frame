import { expect, test } from 'claude-code/testing';

import {
    ROW_RAMP,
    contrastOf,
    ctxMeterSvg,
    effortSvg,
} from '../hooks/register.tsx';

// a session row's two meters, context and effort, in one look: gruvbox cells, the context % beside its cells
// (dima, 10-12 22:11 «windows 92 … try gruvbox … a number of CTX … consistent with the effort level meter»;
// 10-13 16:04 «unified look», the effort meter «slightly brighter … or cells 1px bigger»)

const PANE = { dark: '#1f1e1d', light: '#ffffff' };

const lit = (svg: string) => svg.match(/fill="url\(#ramp\)"/g)?.length ?? 0;
const off = (svg: string) => svg.match(/class="off"/g)?.length ?? 0;
const widthOf = (svg: string) => svg.match(/<svg[^>]* width="([\d.]+)"/)?.[1];
const firstCell = (svg: string) =>
    svg
        .match(/<rect[^>]*class="off"[^>]*\/>/)?.[0]
        ?.replace(/ x="[\d.]+"| y="[\d.]+"/g, '');
const styleOf = (svg: string) =>
    svg.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
// the number's two tints, light then dark, as its style rule names them
const numberTints = (svg: string) =>
    [...svg.matchAll(/\.n\{fill:(#[0-9a-f]{6})\}/g)].map((m) => m[1]);

test('the context meter keeps one width from 0 % to 100 %', () => {
    expect(
        new Set([0, 7, 43, 100].map((p) => widthOf(ctxMeterSvg(p, 80)))).size,
    ).toBe(1);
});

test('43 % lights 3 of 8 cells and prints its number', () => {
    const svg = ctxMeterSvg(43, 80);
    expect([lit(svg), off(svg), svg.includes('>43%<')]).toEqual([3, 5, true]);
});

test('the context meter and the effort meter draw the same cell in the same palette', () => {
    const ctx = ctxMeterSvg(43, 80);
    const effort = effortSvg(2);
    expect([firstCell(ctx), styleOf(ctx).startsWith(styleOf(effort))]).toEqual([
        firstCell(effort),
        true,
    ]);
});

test('every lit cell colour reads at 3:1 or more on its pane, light and dark', () => {
    const weak = (['light', 'dark'] as const).flatMap((mode) =>
        ROW_RAMP[mode].filter((c) => contrastOf(c, PANE[mode]) < 3),
    );
    expect(weak).toEqual([]);
});

test('the context number reads at 4.5:1 or more at every fill, light and dark', () => {
    const weak = Array.from({ length: 21 }, (_, i) => i * 5).flatMap((p) => {
        const [light = '', dark = ''] = numberTints(ctxMeterSvg(p, 80));
        return contrastOf(light, PANE.light) < 4.5 ||
            contrastOf(dark, PANE.dark) < 4.5
            ? [`${p}%: ${light} ${dark}`]
            : [];
    });
    expect(weak).toEqual([]);
});

test('the number warms with the fill: green when low, the ramp red at the compaction point', () => {
    const [lowLight] = numberTints(ctxMeterSvg(10, 80));
    const [hotLight, hotDark] = numberTints(ctxMeterSvg(80, 80));
    expect([lowLight === hotLight, hotLight, hotDark]).toEqual([
        false,
        ROW_RAMP.light[3],
        ROW_RAMP.dark[3],
    ]);
});
