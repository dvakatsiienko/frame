// x-herdr-deck's reads of the shelf: the paths it watches, the json reader, and the live sessions from x's thread
// store with each one's state file (x-mod-stash's), read whole into the deck's rows

import { readdir } from 'fs/promises';
import { exec, home, readTextFile } from 'herdr';

import { rejoin } from './joined.js';
import {
    asksOf,
    phasesOf,
    psStartArgs,
    runningThreads,
    stateOfPid,
    waitOf,
} from './orbit.js';

/** @typedef {import('./orbit.js').Ask} Ask */

/** @typedef {{ asks: Ask[], context: number | null, hot: { since: number } | null, model: string | null, name: string, pending: Map<string, import('./orbit.js').Press['verdict']>, phases: string[], pid: number, sid: string, status: string, taken: number, wait: string | null }} Row */

export const CLAUDE = `${home()}/.claude`;
export const STATES = `${CLAUDE}/shelf/herdr-state`;
export const LANES = `${CLAUDE}/shelf/lanes.json`;
export const USAGE = `${CLAUDE}/shelf/cc-usage-window.json`;
export const SESSIONS = `${CLAUDE}/sessions`;
const THREADS = `${CLAUDE}/shelf/threads.json`;
export const TICKS = `${CLAUDE}/shelf/orbit-ticks`;
// x-herdr-settings' file (x-herdr-chat settings-store.js): his «orbit › pinned cards» row
export const SETTINGS = `${CLAUDE}/shelf/herdr-settings/settings.json`;

/**
 * @param {string} path
 * @returns {Promise<any>}
 */
export async function json(path) {
    try {
        return JSON.parse((await readTextFile(path)) ?? 'null');
    } catch {
        return null;
    }
}

// each session's state file x-mod-stash writes (`fleet.json` beside them holds the fleet-wide states)
export async function states() {
    const names = (
        await readdir(STATES).catch(() => /** @type {string[]} */ ([]))
    ).filter((f) => f.endsWith('.json') && f !== 'fleet.json');
    return Promise.all(names.map((f) => json(`${STATES}/${f}`)));
}

/**
 * @param {any[]} shelf
 * @returns {Promise<Row[] | null>} null: no answer, the deck keeps its last rows
 */
export async function sessions(shelf) {
    // one rule, one reader (FRM-570 rule 8): x's thread store names the live threads, a pid kept only while x finds it
    // running on its own start time, so no press goes to a dead session; the status is still cc's, from its registry
    // file. an unreadable store answers null, and the deck keeps its last rows marked stale
    const store = await json(THREADS);
    if (!Array.isArray(store?.threads)) return null;
    const listed = store.threads.filter(
        (/** @type {any} */ t) => t?.pid && t.sessionId && t.name,
    );
    // ps exits 1 when a pid is gone, its stdout still naming the live ones; any other end is no answer, and the deck
    // keeps its last rows marked stale. its start times read in utc and the c locale, the store's own form
    const ps = listed.length
        ? await exec(
              'env',
              psStartArgs(listed.map((/** @type {any} */ t) => t.pid)),
              { timeout: 2000 },
          ).catch(() => null)
        : { code: 0, stdout: '' };
    const running = runningThreads(
        listed,
        ps && (ps.code === 0 || ps.code === 1) ? ps.stdout : null,
    );
    if (!running) return null;
    const rows = await Promise.all(
        running.map(async (/** @type {any} */ t) => ({
            ...t,
            status: (await json(`${SESSIONS}/${t.pid}.json`))?.status,
        })),
    );
    return rows.map(
        /** @returns {Row} */ (s) => {
            const state = stateOfPid(shelf, s.pid);
            const sid = state?.sid ?? s.sessionId;
            return {
                asks: asksOf(state),
                context: state?.ctx ?? null,
                hot: state?.hot ?? null,
                model: state?.model ?? null,
                name: rejoin(s.name),
                pending: new Map(),
                phases: phasesOf(state),
                pid: s.pid,
                sid,
                status: s.status ?? 'unknown',
                taken: state?.taken ?? 0,
                wait: waitOf(s.status ?? 'unknown', state?.wait),
            };
        },
    );
}
