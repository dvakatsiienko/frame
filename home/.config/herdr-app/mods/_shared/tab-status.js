// the top tabs' status tile (the program's icon with its state dot): his choice in the chat settings popover, «Tabs ›
// Tab status» (FRM-664:W6), one key in herdr's shared store that the popover writes and the pills read

export const TAB_STATUS_KEY = 'tabs.status';

/** @typedef {'visible' | 'hidden'} TabStatus */

/** what the store holds as his choice: anything but «hidden» shows the tile, as before the setting @param {unknown} stored @returns {TabStatus} */
export const tabStatusOf = (stored) =>
    stored === 'hidden' ? 'hidden' : 'visible';
