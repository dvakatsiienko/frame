// from shepherdr lib/live.js (be647c8), MIT, Copyright (c) 2026 Elias Stravik
// herdr's live lists, copied once per render: each agents(), panes() or terminals() call copies the whole list
// again, and herdr stops a render past ~50 ms. the copies are shared by the whole render: never change them in place
import {
    agents as liveAgents,
    panes as livePanes,
    terminals as liveTerminals,
} from 'herdr';

// a render herdr stops runs no `finally`, so a copy older than any render can be is never used
const STALE_MS = 250;
/** @type {{ at: number, lists: Record<string, any> } | null} */
let frame = null;
const current = () =>
    frame && Date.now() - frame.at < STALE_MS ? frame : null;

/**
 * @template T
 * @param {string} name
 * @param {() => T} read
 * @returns {() => T}
 */
const once = (name, read) => () => {
    const f = current();
    if (!f) return read();
    if (!(name in f.lists)) f.lists[name] = read();
    return f.lists[name];
};

export const agents = once('agents', liveAgents);
export const panes = once('panes', livePanes);
export const terminals = once('terminals', liveTerminals);

/**
 * runs a render with one copy of each list; a render inside another uses the outer one's
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function inRender(fn) {
    const outer = current();
    frame = outer ?? { at: Date.now(), lists: {} };
    try {
        return fn();
    } finally {
        frame = outer;
    }
}
