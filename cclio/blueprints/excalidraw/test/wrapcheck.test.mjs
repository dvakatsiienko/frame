import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { openChrome } from '../lib/chrome.mjs';
import { convert } from '../lib/convert.mjs';
import { parseDrawio } from '../lib/drawio.mjs';
import { checkWraps } from '../lib/wrapcheck.mjs';

let chrome;
let elements;
beforeAll(async () => {
    chrome = await openChrome();
    elements = await convert(
        parseDrawio(
            readFileSync(
                new URL('fixtures/small.drawio', import.meta.url),
                'utf8',
            ),
        ),
        chrome.page,
    );
}, 60000);
afterAll(() => chrome.browser.close());

test('a converted fixture has no text past its container', async () => {
    const { checked, past } = await checkWraps(elements, chrome.page);
    expect(past).toEqual([]);
    expect(checked).toBeGreaterThanOrEqual(6);
});

test('a tile part pushed 400 px right is reported', async () => {
    const els = structuredClone(elements);
    els.find((e) => e.id === 'a-t0').x += 400;
    const { past } = await checkWraps(els, chrome.page);
    expect(past.join('\n')).toMatch(/a-t0: past the left or right edge of a/);
});

test('a diamond part taller than the diamond allows is reported', async () => {
    const els = structuredClone(elements);
    const part = els.find((e) => e.id === 'd-t0');
    part.y -= 90;
    const { past } = await checkWraps(els, chrome.page);
    expect(past.join('\n')).toMatch(/d-t0: corner outside the diamond/);
});

test('an arrow label wider than its text box is reported', async () => {
    const els = structuredClone(elements);
    els.find((e) => e.id === 'e1-label').width = 3;
    const { past } = await checkWraps(els, chrome.page);
    expect(past.join('\n')).toMatch(/e1-label: widest line/);
});
