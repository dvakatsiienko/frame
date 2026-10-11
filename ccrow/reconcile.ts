import { readFileSync } from 'node:fs';

import {
    NOTES_PATH,
    SESSION_NAME,
    fail,
    oneCcrow,
    reconcileMarker,
    sendLine,
    spawnHarvester,
} from './lib.ts';

const usage = `ccrow:reconcile <note-id> <evidence…> — one reconcile line to ccrow; her one answer is logged as <note-id>-reconcile in ${NOTES_PATH}`;

const [id, ...words] = process.argv.slice(2);
if (!id || words.length === 0) fail(usage);

const ids = new Set<unknown>();
try {
    for (const line of readFileSync(NOTES_PATH, 'utf8').split('\n')) {
        try {
            ids.add(JSON.parse(line).id);
        } catch {}
    }
} catch {}
if (!ids.has(id)) fail(`no note with id ${id}`);
if (ids.has(`${id}-reconcile`))
    fail(`${id} is reconciled already: one answer per note`);

const ccrow = oneCcrow();
if (!ccrow) fail('ccrow is not running');

const evidence = words.join(' ');
const line = `${reconcileMarker(id)} ${evidence}`;
spawnHarvester(['reconcile', id, evidence]);
if (ccrow.jobId) {
    await sendLine(ccrow.messagingSocketPath, line);
    console.log(`sent to ccrow: ${line}`);
} else {
    // a desktop tab takes no socket line; only the desktop's send_message reaches it
    console.log(
        `send the line below, alone, to the session titled «${SESSION_NAME}» through mcp__ccd_session_mgmt__send_message; her answer is logged by itself.\n${line}`,
    );
}
