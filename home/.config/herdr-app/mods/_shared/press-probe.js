// a probe's log (FRM-585, herdr-app#1524): which layer an F6 or a right press reaches after a triple click, in
// ~/.config/herdr-app/data/press-probe-<who>-<instance>.log, the last 200 lines. it goes once his presses are read

import { writeFile } from 'fs/promises';
import { appHome } from 'herdr';

const KEPT = 200;

/** @param {string} who the mod */
export function createPressProbe(who) {
    const name = `press-probe-${who}-${Math.random().toString(36).slice(2, 8)}.log`;
    /** @type {string[]} */
    const lines = [];
    let isWriting = false;
    /** @param {string} what @param {Record<string, unknown>} [facts] */
    return (what, facts = {}) => {
        lines.push(
            JSON.stringify({ at: new Date().toISOString(), what, ...facts }),
        );
        lines.splice(0, Math.max(0, lines.length - KEPT));
        if (isWriting) return;
        isWriting = true;
        Promise.resolve()
            // read at the write: a test's herdr stand-in has no appHome, and a throw here is caught
            .then(() =>
                writeFile(`${appHome()}/data/${name}`, `${lines.join('\n')}\n`),
            )
            .catch(() => {})
            .finally(() => {
                isWriting = false;
            });
    };
}
