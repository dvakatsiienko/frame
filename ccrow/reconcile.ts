import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
    HARVEST_DEADLINE_MS,
    NOTES_PATH,
    SESSION_NAME,
    STATE_DIR,
    fail,
    oneCcrow,
    readState,
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
if (!ids.has(id) || id.endsWith('-reconcile')) fail(`no note with id ${id}`);
if (ids.has(`${id}-reconcile`))
    fail(`${id} is reconciled already: one answer per note`);
// the answer row lands only when ccrow's turn ends, so a pending marker holds the one-answer rule until then
const pending = join(STATE_DIR, 'reconciles', `${id}.json`);
const sentAt = pendingSince(pending);
if (sentAt !== undefined && Date.now() - sentAt < HARVEST_DEADLINE_MS)
    fail(`${id} has a reconcile waiting for ccrow's answer`);
if (!readState().arm) fail('no arm in state.json: start ccrow first');

const ccrow = oneCcrow();
if (!ccrow) fail('ccrow is not running');

const evidence = words.join(' ');
const line = `${reconcileMarker(id)} ${evidence}`;
if (ccrow.jobId) await sendLine(ccrow.messagingSocketPath, line);
mkdirSync(dirname(pending), { recursive: true });
writeFileSync(pending, JSON.stringify({ at: Date.now() }));
spawnHarvester(['reconcile', id, evidence]);
if (ccrow.jobId) {
    console.log(`sent to ccrow: ${line}`);
} else {
    // a desktop tab or a terminal resume takes no socket line from here; SendMessage by her registry name reaches both
    console.log(
        `send the line below, alone, with SendMessage to «${ccrow.name ?? SESSION_NAME}»; her answer is logged by itself.\n${line}`,
    );
}

function pendingSince(path: string): number | undefined {
    try {
        const at: unknown = JSON.parse(readFileSync(path, 'utf8')).at;
        return typeof at === 'number' ? at : undefined;
    } catch {}
}
