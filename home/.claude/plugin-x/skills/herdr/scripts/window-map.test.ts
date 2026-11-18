import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./window-map.py', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'window-map-'));
afterAll(() => rmSync(dir, { force: true, recursive: true }));

// the shape of the iTrout layout the window shows, trimmed to the nodes the map names
const layout = (hidden: { panel: boolean; tray: boolean }) => ({
    children: [
        { id: 'tabs', size: { px: 38 }, type: 'block' },
        {
            children: [
                { id: 'sidebar', size: { px: 279 }, type: 'block' },
                {
                    children: [
                        {
                            children: [
                                {
                                    active: 'chat',
                                    children: [
                                        { id: 'chat', type: 'block' },
                                        { id: 'main', type: 'block' },
                                    ],
                                    id: 'views',
                                    type: 'stack',
                                },
                                {
                                    hidden: hidden.panel,
                                    id: 'panel',
                                    size: { px: 368 },
                                    type: 'column',
                                },
                            ],
                            id: 'work-body',
                            size: { weight: 1 },
                            type: 'row',
                        },
                        {
                            children: [
                                {
                                    id: 'tray-head',
                                    size: { px: 30 },
                                    type: 'block',
                                },
                                {
                                    active: 'qt',
                                    children: [{ id: 'qt', type: 'block' }],
                                    id: 'tray-terms',
                                    type: 'stack',
                                },
                            ],
                            hidden: hidden.tray,
                            id: 'tray',
                            size: { px: 300 },
                            type: 'column',
                        },
                    ],
                    id: 'work-split',
                    size: { weight: 1 },
                    type: 'column',
                },
                { id: 'deck', size: { px: 517 }, type: 'block' },
            ],
            gap: 8,
            id: 'body',
            size: { weight: 1 },
            type: 'row',
        },
        { id: 'status', size: { px: 28 }, type: 'block' },
    ],
    gap: 8,
    id: 'root',
    padding: [6, 6],
    type: 'column',
});

function boxes(hidden: { panel: boolean; tray: boolean }) {
    const file = join(dir, `layout-${hidden.panel}-${hidden.tray}.json`);
    writeFileSync(file, JSON.stringify(layout(hidden)));
    const run = spawnSync(
        'python3',
        ['-I', script, '--boxes', file, '1920x1050'],
        { encoding: 'utf8', timeout: 20_000 },
    );
    expect(run.status, run.stderr).toBe(0);
    return JSON.parse(run.stdout) as Record<string, number[]>;
}

describe('the window map solves the shown layout', () => {
    it('draws the chat from the sidebar to the deck when the panel and tray are hidden', () => {
        const got = boxes({ panel: true, tray: true });

        expect(got['views+36']).toEqual([293, 88, 1389, 1008]);
        expect(got.deck).toEqual([1397, 52, 1914, 1008]);
        expect(got.panel).toBeUndefined();
        expect(got['tray-head']).toBeUndefined();
    });

    it('narrows the chat and draws the panel when the panel is shown', () => {
        const got = boxes({ panel: false, tray: true });

        expect(got.panel).toEqual([1021, 52, 1389, 1008]);
        expect(got['views+36']).toEqual([293, 88, 1021, 1008]);
    });

    it('shortens the chat and draws the tray head when the tray is shown', () => {
        const got = boxes({ panel: true, tray: false });

        expect(got['tray-head']).toEqual([293, 708, 1389, 738]);
        expect(got['views+36']).toEqual([293, 88, 1389, 708]);
    });
});
