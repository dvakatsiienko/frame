// the right-click menu on a message (FRM-638 slice 7): «Copy message» copies it as written, «Reply» quotes it above
// the quill and sends it before his next words. herdr reports one
// right-click twice, on the list's item (which row) and on the list (where, in the list's own px), in either order:
// whichever lands second completes the menu

import { plainOf } from './find.js';

/** @typedef {import('./row-model.js').Row} Row */
/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ at: Point, text: string | null, x: number, y: number }} Menu `at` the press in window px, x and y in the list's */

/** @param {Point} a @param {Point} b */
const isSame = (a, b) => a.x === b.x && a.y === b.y;

export function createMessageMenu() {
    /** @type {Menu | null} */
    let menu = null;
    /** @type {{ at: Point, text: string | null } | null} */
    let hit = null;
    return {
        close() {
            menu = null;
            hit = null;
        },
        /** the item's half: the words of the row pressed @param {Point} at @param {string | null} text */
        hit(at, text) {
            if (menu && isSame(menu.at, at)) menu = { ...menu, text };
            else hit = { at, text };
        },
        /** the list's half: where the press was @param {Point} at @param {Point} local */
        open(at, local) {
            const text = hit && isSame(hit.at, at) ? hit.text : null;
            hit = null;
            menu = { at, text, x: local.x, y: local.y };
        },
        get state() {
            return menu;
        },
    };
}

/** the words a right-click on a row copies: his message or a reply as written; a tool run or a file row has none
 * @param {Row | undefined} row */
export const copyText = (row) =>
    row && (row.kind === 'mine' || row.kind === 'reply') && row.text.trim()
        ? row.text
        : null;

/**
 * where the menu sits: at the press, kept inside the list, above the press when it would run off the bottom
 * @param {Point} press @param {{ w: number, h: number }} view @param {{ w: number, h: number }} size
 */
export const menuPlace = (press, view, size) => ({
    x: Math.max(0, Math.min(press.x, view.w - size.w)),
    y: press.y + size.h > view.h ? Math.max(0, press.y - size.h) : press.y,
});

/** a message as a markdown quote, every line under «> » @param {string} text */
export const quoted = (text) =>
    text
        .trim()
        .split(/\r?\n/)
        .map((l) => `> ${l}`)
        .join('\n');

/** what a reply sends: the message it answers quoted, then his words @param {string} replyTo @param {string} text */
export const withReply = (replyTo, text) => `${quoted(replyTo)}\n\n${text}`;

/** @param {string} text */
const squeezed = (text) => text.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * what a reply quotes: the part of the message he copied (herdr lets a mod read no selection, so ⌘C hands it over),
 * else the whole message; a copy from anywhere else quotes the whole
 * @param {string} message as written @param {string} copied the clipboard's text now
 */
export function replyQuote(message, copied) {
    const part = squeezed(copied);
    if (!part) return message;
    const isIn =
        squeezed(plainOf(message)).includes(part) ||
        squeezed(message).includes(part);
    return isIn ? copied.trim() : message;
}
