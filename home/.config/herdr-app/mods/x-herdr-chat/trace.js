// a probe's log (FRM-585:W78–W80): what herdr reported of his selection and why F6 or the menu found no words, the last
// 200 lines in ~/.config/herdr-app/data/x-herdr-chat/trace.log, so his presses can be read after. it goes once read

import { writeFile } from 'fs/promises';
import { appHome } from 'herdr';

const KEPT = 200;
/** @type {string[]} */
const lines = [];
let isWriting = false;

/** @param {string} what @param {Record<string, unknown>} [facts] */
export function trace(what, facts = {}) {
    lines.push(
        JSON.stringify({ at: new Date().toISOString(), what, ...facts }),
    );
    lines.splice(0, Math.max(0, lines.length - KEPT));
    if (isWriting) return;
    isWriting = true;
    Promise.resolve()
        .then(() =>
            writeFile(
                `${appHome()}/data/x-herdr-chat/trace.log`,
                `${lines.join('\n')}\n`,
            ),
        )
        .catch(() => {})
        .finally(() => {
            isWriting = false;
        });
}
