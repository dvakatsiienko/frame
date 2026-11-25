// the right-click menu on a message (FRM-638 slice 7): «Copy text» copies the words he selected in it (FRM-699),
// «Copy message» the whole as written. herdr reports one
// right-click twice, on the list's item (which row) and on the list (where, in the list's own px), in either order:
// whichever lands second completes the menu

/** @typedef {import('./row-model.js').Row} Row */
/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ isSelection: boolean, text: string }} Copied what the menu's item copies, as it stood at the press */
/** @typedef {{ at: Point, copied: Copied | null, x: number, y: number }} Menu `at` the press in window px, x and y in the list's */

/** @param {Point} a @param {Point} b */
const isSame = (a, b) => a.x === b.x && a.y === b.y;

export function createMessageMenu() {
    /** @type {Menu | null} */
    let menu = null;
    /** @type {{ at: Point, copied: Copied | null } | null} */
    let hit = null;
    return {
        close() {
            menu = null;
            hit = null;
        },
        /** the item's half: what the row pressed copies @param {Point} at @param {Copied | null} copied */
        hit(at, copied) {
            if (menu && isSame(menu.at, at)) menu = { ...menu, copied };
            else hit = { at, copied };
        },
        /** the list's half: where the press was @param {Point} at @param {Point} local */
        open(at, local) {
            const copied = hit && isSame(hit.at, at) ? hit.copied : null;
            hit = null;
            menu = { at, copied, x: local.x, y: local.y };
        },
        get state() {
            return menu;
        },
    };
}

/**
 * what a right-click on a row copies: the words he selected in it, else his message or a reply as written; a tool run or a
 * file row has none
 * @param {Row | undefined} row @param {string | null} selected @returns {Copied | null}
 */
export function copiedFrom(row, selected) {
    if (row?.kind !== 'mine' && row?.kind !== 'reply') return null;
    if (selected) return { isSelection: true, text: selected };
    return row.text.trim() ? { isSelection: false, text: row.text } : null;
}

/**
 * where the menu sits: at the press, kept inside the list, above the press when it would run off the bottom
 * @param {Point} press @param {{ w: number, h: number }} view @param {{ w: number, h: number }} size
 */
export const menuPlace = (press, view, size) => ({
    x: Math.max(0, Math.min(press.x, view.w - size.w)),
    y: press.y + size.h > view.h ? Math.max(0, press.y - size.h) : press.y,
});
