import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { findCrossings, segmentHitsPolygon } from '../lib/crossings.mjs';

const square = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
];
const diamond = [
    [50, 0],
    [100, 50],
    [50, 100],
    [0, 50],
];

test('a segment through a rectangle hits, one beside it misses, one ending short misses', () => {
    expect(segmentHitsPolygon([-50, 50], [150, 50], square)).toBe(true);
    expect(segmentHitsPolygon([-50, 150], [150, 150], square)).toBe(false);
    expect(segmentHitsPolygon([-50, 50], [-10, 50], square)).toBe(false);
});

test("a diamond's empty corner is not a hit, its body is", () => {
    expect(segmentHitsPolygon([-10, 5], [30, 5], diamond)).toBe(false);
    expect(segmentHitsPolygon([-10, 50], [30, 50], diamond)).toBe(true);
});

const tile = (id, x, y) => ({
    id,
    type: 'rectangle',
    x,
    y,
    width: 100,
    height: 100,
    groupIds: ['g'],
    isDeleted: false,
});
const arrow = (id, start, end, points) => ({
    id,
    type: 'arrow',
    x: 0,
    y: 50,
    points,
    elbowed: true,
    isDeleted: false,
    startBinding: { elementId: start },
    endBinding: { elementId: end },
});

test("a third tile on the arrow's path is a crossing; its own ends are not", () => {
    const board = [
        tile('a', -100, 0),
        tile('b', 300, 0),
        arrow('ab', 'a', 'b', [
            [0, 0],
            [300, 0],
        ]),
    ];
    expect(findCrossings(board).crossings).toEqual([]);
    board.push(tile('c', 130, 0));
    expect(
        findCrossings(board).crossings.map((c) => [c.arrow, c.obstacle]),
    ).toEqual([['ab', 'c']]);
});

test('planting a tile on a real arrow of the converted board turns the count from 0 to 1', () => {
    const board = JSON.parse(
        readFileSync(
            new URL('../crew-pm-flow/board.excalidraw', import.meta.url),
            'utf8',
        ),
    ).elements;
    expect(findCrossings(board).crossings.length).toBe(0);
    const a = board.find(
        (e) => e.type === 'arrow' && e.points.length === 2 && e.width > 150,
    );
    const [mx, my] = [a.x + a.points[1][0] / 2, a.y + a.points[1][1] / 2];
    board.push({ ...tile('planted', mx - 20, my - 20), width: 40, height: 40 });
    expect(findCrossings(board).crossings.map((c) => c.arrow)).toContain(a.id);
});
