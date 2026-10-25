import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { openChrome } from '../lib/chrome.mjs';
import { rebuildTicketFlow } from '../ticket-flow/build.mjs';

const BOARD = new URL('../crew-pm-flow/board.excalidraw', import.meta.url)
    .pathname;
const BUILDER = new URL('../../ticket-flow.build.py', import.meta.url).pathname;
const original = JSON.parse(readFileSync(BOARD, 'utf8'));
let chrome;
beforeAll(async () => {
    chrome = await openChrome();
}, 60000);
afterAll(() => chrome.browser.close());

const run = (file) => rebuildTicketFlow(file, BUILDER, chrome.page);
const find = (file, id) => file.elements.find((e) => e.id === id);
const note = (id, x, y, text, extra) => ({
    ...structuredClone(find(original, 'tf-b3-free-t0')),
    id,
    x,
    y,
    text,
    originalText: text,
    groupIds: [],
    width: 300,
    height: 25,
    ...extra,
});

describe('ticket-flow twin', () => {
    test('a second run against its own output changes nothing', async () => {
        const first = await run(structuredClone(original));
        const second = await run(structuredClone(first.file));
        expect(second.diffLines).toBe(0);
        expect(JSON.stringify(second.file)).toBe(JSON.stringify(first.file));
    }, 120000);

    test('every element it writes carries tf-, and no arrow binds a tf- element to another', async () => {
        const { file, written } = await run(structuredClone(original));
        expect(written.length).toBeGreaterThan(300);
        expect(written.filter((e) => !e.id.startsWith('tf-'))).toEqual([]);
        const cross = file.elements.filter(
            (e) =>
                e.type === 'arrow' &&
                [e.startBinding, e.endBinding].filter((b) =>
                    b?.elementId.startsWith('tf-'),
                ).length === 1,
        );
        expect(cross).toEqual([]);
    }, 120000);

    test('elements that are not tf- come back byte for byte', async () => {
        const { file } = await run(structuredClone(original));
        const strip = (f) => f.elements.filter((e) => !e.id.startsWith('tf-'));
        expect(JSON.stringify(strip(file))).toBe(
            JSON.stringify(strip(original)),
        );
    }, 120000);

    test('a 💬 pinned to a tf- tile survives, a moved tf- tile snaps back', async () => {
        const board = structuredClone(original);
        const tile = find(board, 'tf-b3-free');
        board.elements.push(
            note(
                'n-pinned',
                tile.x + tile.width + 20,
                tile.y,
                '💬 who owns this?',
                { customData: { pin: 'tf-b3-free', field: 'dima' } },
            ),
        );
        const { file } = await run(board);
        const kept =
            find(file, 'n-pinned') ??
            file.elements.find((e) => e.text === '💬 who owns this?');
        expect(kept.text).toBe('💬 who owns this?');
        expect(kept.x - find(file, 'tf-b3-free').x).toBe(tile.width + 20);

        const moved = structuredClone(file);
        for (const e of moved.elements.filter(
            (x) => x.id === 'tf-b3-free' || x.id.startsWith('tf-b3-free-t'),
        ))
            e.x += 300;
        kept.x += 0;
        const back = await run(moved);
        expect(find(back.file, 'tf-b3-free').x).toBe(
            find(file, 'tf-b3-free').x,
        );
    }, 180000);

    test('a hand-made 💬 beside a tf- tile is adopted and survives the rebuild', async () => {
        const board = structuredClone(original);
        const tile = find(board, 'tf-b3-owns');
        board.elements.push(
            note(
                'hand-1',
                tile.x + tile.width + 30,
                tile.y + 10,
                '💬 check the net',
            ),
        );
        const { file } = await run(board);
        const kept = file.elements.filter((e) => e.text === '💬 check the net');
        expect(kept).toHaveLength(1);
        expect(kept[0].id.startsWith('tf-')).toBe(true);
        expect(
            file.elements.some(
                (e) => e.id === 'tf-notes' && e.type === 'rectangle',
            ),
        ).toBe(true);
    }, 120000);

    test('the notes tile lists every note', async () => {
        const board = structuredClone(original);
        const tile = find(board, 'tf-b3-free');
        board.elements.push(
            note(
                'n-listed',
                tile.x + tile.width + 20,
                tile.y,
                '💬 listed please',
                { customData: { pin: 'tf-b3-free', field: 'dima' } },
            ),
        );
        const { file } = await run(board);
        const parts = file.elements
            .filter((e) => e.id.startsWith('tf-notes-t'))
            .map((e) => e.text)
            .join(' ');
        expect(parts).toContain('listed please');
    }, 120000);
});
