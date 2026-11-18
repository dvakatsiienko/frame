// the picture viewer over the chat (FRM-638 slice 5, W33/W35): the pictures it was opened on, the one shown and its
// zoom. one owner for that state; the view draws what `state` says and hands each key or button here.

export const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const FIT = 1;

/**
 * @typedef {object} Shown
 * @property {string} file the picture, by its path
 * @property {string} rel its copy under the app dir, the one image() draws
 * @property {number} w its width in pixels
 * @property {number} h
 */

/** @typedef {{ pictures: Shown[], at: number, zoom: number }} ViewerState */

/** @typedef {'next' | 'previous' | 'zoom in' | 'zoom out' | 'fit' | 'close'} ViewerStep */

/**
 * the state after one step; null when the viewer closes
 * @param {ViewerState | null} state @param {ViewerStep} step @returns {ViewerState | null}
 */
export function viewerAfter(state, step) {
    if (!state || step === 'close') return null;
    const { pictures, at, zoom } = state;
    const level = ZOOMS.indexOf(zoom);
    switch (step) {
        case 'next':
            return at + 1 < pictures.length
                ? { ...state, at: at + 1, zoom: FIT }
                : state;
        case 'previous':
            return at > 0 ? { ...state, at: at - 1, zoom: FIT } : state;
        case 'zoom in':
            return { ...state, zoom: ZOOMS[level + 1] ?? zoom };
        case 'zoom out':
            return { ...state, zoom: ZOOMS[level - 1] ?? zoom };
        case 'fit':
            return { ...state, zoom: FIT };
        default:
            return /** @type {never} */ (step);
    }
}

/**
 * opened on a picture among its siblings: the message's or the reply's pictures, the one clicked shown
 * @param {Shown[]} pictures @param {number} at @returns {ViewerState | null}
 */
export const openViewer = (pictures, at) =>
    pictures[at] ? { at, pictures, zoom: FIT } : null;

/** «2 / 5», none for a single picture @param {ViewerState} state */
export const viewerCount = (state) =>
    state.pictures.length > 1
        ? `${state.at + 1} / ${state.pictures.length}`
        : '';

/** «100%» @param {ViewerState} state */
export const viewerLevel = (state) => `${Math.round(state.zoom * 100)}%`;
