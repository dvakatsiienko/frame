import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('herdr', () => ({ run: vi.fn() }));

import { run } from 'herdr';

import { createDrag } from './drag.js';
import { type DraggedTab, tabDrops } from './tab-drops.js';

// FRM-664: the top tabs (x-herdr-tab-pills, x-herdr-tabs) drag through the shared drag
const at = (x: number) => ({ x, y: 0 });

beforeEach(() => vi.mocked(run).mockClear());

describe('the top tabs drag and click', () => {
    test('a drag of tab 1 past tab 3 moves it once, 1-based', () => {
        const d = createDrag<DraggedTab>(tabDrops);
        d.press('tab-a', { id: 'a' }, 0, at(10));
        d.pointer(at(200));
        d.over(1);
        d.over(2);
        d.release();
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith('tab.move', { id: 'a', index: 3 });
    });

    test('a click selects the tab, with no settle', () => {
        const d = createDrag<DraggedTab>(tabDrops);
        d.press('tab-b', { id: 'b' }, 1, at(10));
        d.pointer(at(12));
        d.release();
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith('tab.select', { id: 'b' });
        expect(d.state().name).toBe('idle');
    });
});
