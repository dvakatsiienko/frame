// what a drag of a top tab does (FRM-664), for the pills and x-herdr-tabs alike: a drop moves the tab to the place it
// landed on, herdr's index 1-based; a press with no drag selects it.

import { run } from 'herdr';

/** @typedef {{ id: string }} DraggedTab */

export const tabDrops = {
    /** @param {DraggedTab} tab */
    onClick: (tab) => run('tab.select', { id: tab.id }),
    /** @param {DraggedTab} tab @param {number} _from @param {number} to its index among the space's tabs */
    onMove: (tab, _from, to) => run('tab.move', { id: tab.id, index: to + 1 }),
};
