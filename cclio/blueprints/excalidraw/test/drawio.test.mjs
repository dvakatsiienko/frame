import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { htmlRuns, parseDrawio } from '../lib/drawio.mjs';

const board = parseDrawio(
    readFileSync(new URL('../../crew-pm-flow.drawio', import.meta.url), 'utf8'),
);

test('the real board parses to its known census', () => {
    const count = (kind) => board.cells.filter((c) => c.kind === kind).length;
    expect([
        count('container'),
        count('diamond'),
        count('tile'),
        count('label'),
        count('edge'),
    ]).toEqual([22, 6, 190, 49, 172]);
});

test('child coordinates are absolute', () => {
    const head = board.cells.find((c) => c.id === '3:248');
    const band = board.cells.find((c) => c.id === '3:247');
    expect([head.x, head.y]).toEqual([band.x + 56, band.y + 44]);
});

test('html value splits into runs with their size, colour and the br as a line break', () => {
    const runs = htmlRuns(
        '<b style="font-size:26px">❓ a &amp; b</b><br><span style="font-size:20px">x <b>y</b></span><br><i style="font-size:16px;color:#5C5C5C">src</i>',
        12,
        '#1E1E1E',
    );
    expect(runs).toEqual([
        [{ text: '❓ a & b', size: 26, color: '#1E1E1E' }],
        [
            { text: 'x ', size: 20, color: '#1E1E1E' },
            { text: 'y', size: 20, color: '#1E1E1E' },
        ],
        [{ text: 'src', size: 16, color: '#5C5C5C' }],
    ]);
});

test('an <object> wrapper keeps its id, its label and its dima fields', () => {
    const xml = `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
    <object label="hello" id="n1" dima="check this" dima-2="and this" other="x"><mxCell style="rounded=1;fillColor=#fff;strokeColor=#000;" vertex="1" parent="1"><mxGeometry x="10" y="20" width="100" height="50" as="geometry"/></mxCell></object>
    </root></mxGraphModel></diagram></mxfile>`;
    const [cell] = parseDrawio(xml).cells;
    expect({ id: cell.id, plain: cell.plain, notes: cell.notes }).toEqual({
        id: 'n1',
        plain: 'hello',
        notes: [
            ['dima', 'check this'],
            ['dima-2', 'and this'],
        ],
    });
});

test('noLabel hides the value: the displayed text is empty', () => {
    expect(board.cells.find((c) => c.id === '3:247').plain).toBe('');
});
