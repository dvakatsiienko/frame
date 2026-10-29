import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { openChrome } from '../lib/chrome.mjs';
import { convert } from '../lib/convert.mjs';
import { parseDrawio } from '../lib/drawio.mjs';
import { checkIdMap } from '../lib/id-map.mjs';

const board = parseDrawio(
    readFileSync(new URL('fixtures/small.drawio', import.meta.url), 'utf8'),
);
let chrome;
let elements;
beforeAll(async () => {
    chrome = await openChrome();
    elements = await convert(board, chrome.page);
}, 60000);
afterAll(() => chrome.browser.close());

const copy = () => structuredClone(elements);
const problemsOf = (els) => checkIdMap(board, els).problems.join('\n');

test('a faithful conversion has no problem and equal counts', () => {
    const { counts, problems } = checkIdMap(board, elements);
    expect(problems).toEqual([]);
    expect(counts.excalidraw).toEqual(counts.drawio);
    expect(counts.excalidraw.notes).toBe(2);
});

test('a missing element is named by id', () => {
    expect(problemsOf(copy().filter((e) => e.id !== 'a'))).toMatch(
        /a: no element/,
    );
});

test('a changed fill hex is a mismatch', () => {
    const els = copy();
    els.find((e) => e.id === 'a').backgroundColor = '#C2E5FE';
    expect(problemsOf(els)).toMatch(/a: fill/);
});

test('changed text is a mismatch', () => {
    const els = copy();
    const part = els.find((e) => e.id === 'a-t1');
    part.text = part.text.replace('detail', 'detial');
    expect(problemsOf(els)).toMatch(/a: text/);
});

test('a bbox 3 px off is a mismatch, 2 px is not', () => {
    const off3 = copy();
    off3.find((e) => e.id === 'a').x += 3;
    expect(problemsOf(off3)).toMatch(/a: bbox/);
    const off2 = copy();
    off2.find((e) => e.id === 'a').x += 2;
    expect(problemsOf(off2)).toBe('');
});

test('a swapped binding is a mismatch', () => {
    const els = copy();
    els.find((e) => e.id === 'e1').endBinding.elementId = 'n';
    expect(problemsOf(els)).toMatch(/e1: end binding/);
});

test('a dropped note is a mismatch', () => {
    expect(
        problemsOf(copy().filter((e) => !e.id.endsWith('-note-dima-2'))),
    ).toMatch(/n: note dima-2/);
});

test('a dropped edge label is a mismatch', () => {
    expect(problemsOf(copy().filter((e) => e.id !== 'e1-label'))).toMatch(
        /e1: text/,
    );
});
