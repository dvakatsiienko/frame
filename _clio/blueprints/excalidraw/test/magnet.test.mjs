import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { fitMagnet, routeSideProblems } from '../lib/magnet.mjs';

const band = { w: 3782, h: 786 };
const tile = { w: 520, h: 160 };

test('a centred magnet and a side-middle magnet stay as drawn', () => {
    expect(fitMagnet([0.5, 1], tile)).toEqual({ fp: [0.5, 1], fits: true });
    expect(fitMagnet([1, 0.5], band)).toEqual({ fp: [1, 0.5], fits: true });
});

test('an off-centre bottom magnet on a wide shape does not fit: the router reads it as a west exit', () => {
    expect(fitMagnet([0.03, 1], band).fits).toBe(false);
    expect(fitMagnet([0.2, 1], tile).fits).toBe(false);
});

test('a moved magnet stays on its side and lands where the router reads the side right', () => {
    const { fp } = fitMagnet([0.2, 1], tile);
    expect(fp[1]).toBe(1);
    expect(Math.abs((fp[0] - 0.5) * tile.w)).toBeLessThanOrEqual(0.5 * tile.h);
    expect(fp[0]).toBeLessThan(0.5);
});

const arrow = (id, points, startFp, endFp) => ({
    id,
    type: 'arrow',
    elbowed: true,
    isDeleted: false,
    points,
    startBinding: { fixedPoint: startFp },
    endBinding: { fixedPoint: endFp },
});

test('a route that leaves a bottom magnet sideways is a problem; a route down then across is not', () => {
    expect(
        routeSideProblems([
            arrow(
                'bad',
                [
                    [0, 0],
                    [-100, 0],
                    [-100, 200],
                ],
                [0.2, 1],
                [0.5, 0],
            ),
        ]),
    ).toEqual(['bad: leaves its start magnet against the side']);
    expect(
        routeSideProblems([
            arrow(
                'ok',
                [
                    [0, 0],
                    [0, 100],
                    [-100, 100],
                    [-100, 200],
                ],
                [0.2, 1],
                [0.5, 0],
            ),
        ]),
    ).toEqual([]);
});

test('the converted board has no arrow leaving or entering against its magnet', () => {
    const board = JSON.parse(
        readFileSync(
            new URL('../crew-pm-flow/board.excalidraw', import.meta.url),
            'utf8',
        ),
    ).elements;
    expect(routeSideProblems(board)).toEqual([]);
});
