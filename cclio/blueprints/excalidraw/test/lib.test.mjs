import { afterAll, beforeAll, expect, test } from 'vitest';
import { openChrome } from '../lib/chrome.mjs';
import { labelCenter } from '../lib/label.mjs';
import { routeArrows } from '../lib/route.mjs';
import { makeText } from '../lib/text.mjs';

let chrome;
let text;
beforeAll(async () => {
    chrome = await openChrome();
    text = makeText(chrome.page);
}, 60000);
afterAll(() => chrome.browser.close());

test('labelCenter: odd point count takes the middle point', () => {
    expect(
        labelCenter([
            [0, 0],
            [10, 0],
            [10, 20],
        ]),
    ).toEqual([10, 0]);
});

test('labelCenter: even point count takes the midpoint of the two middle points', () => {
    expect(
        labelCenter([
            [0, 0],
            [10, 0],
            [10, 20],
            [30, 20],
        ]),
    ).toEqual([10, 10]);
});

test('wrap: every line measures within the usable width, and no word is lost', async () => {
    const sentence =
        'no, and later: a wait on a lane, a window or a date too; nothing ever moves back';
    const lines = await text.wrap(sentence, 20, 300);
    expect(lines.length).toBeGreaterThan(1);
    const widths = await Promise.all(
        lines.map((line) => text.measure(line, 20)),
    );
    expect(Math.max(...widths)).toBeLessThanOrEqual(300);
    expect(lines.join(' ')).toBe(sentence);
});

const rect = (id, x, y) => ({
    id,
    type: 'rectangle',
    x,
    y,
    width: 200,
    height: 100,
    angle: 0,
    strokeColor: '#000',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: id === 'a' ? 'a0' : 'a1',
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: [{ id: 'arr', type: 'arrow' }],
    updated: 1,
    link: null,
    locked: false,
});

test("route: an elbow arrow between two offset tiles gets bends from the editor's router", async () => {
    const arrow = {
        ...rect('arr', 200, 50),
        type: 'arrow',
        width: 400,
        height: 300,
        boundElements: [],
        index: 'a2',
        points: [
            [0, 0],
            [400, 300],
        ],
        lastCommittedPoint: null,
        elbowed: true,
        fixedSegments: null,
        startIsSpecial: null,
        endIsSpecial: null,
        startArrowhead: null,
        endArrowhead: 'arrow',
        roundness: null,
        startBinding: {
            elementId: 'a',
            fixedPoint: [1, 0.5],
            focus: 0,
            gap: 1,
        },
        endBinding: { elementId: 'b', fixedPoint: [0.5, 0], focus: 0, gap: 1 },
    };
    const routed = await routeArrows(chrome.page, [
        rect('a', 0, 0),
        rect('b', 500, 400),
        arrow,
    ]);
    expect(routed.find((x) => x.id === 'arr').points.length).toBeGreaterThan(2);
});
