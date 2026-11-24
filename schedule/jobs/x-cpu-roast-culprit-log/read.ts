import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { LAST_POLL, LOG } from './roast.ts';

// a job that has not polled for this long is not running, whatever the log says
const STALE_MS = 10 * 60_000;

// `node read.ts --since <HH:MM | iso>`: the roast rows after the stamp, whole, one per line; exit 1 on a row after it, or when the
// job is not running. HH:MM is today, the way the siesta passes a stamp
const since = process.argv[process.argv.indexOf('--since') + 1] ?? '';
const stateDir = process.env.X_STATE ?? join(homedir(), '.local/state/x');

const text = (file: string) => {
    try {
        return readFileSync(join(stateDir, file), 'utf8');
    } catch {
        return '';
    }
};

function sinceMs(stamp: string): number {
    if (stamp.includes('T')) return Date.parse(stamp);
    const [hours = '0', minutes = '0'] = stamp.split(':');
    const at = new Date();
    at.setHours(Number(hours), Number(minutes), 0, 0);
    return at.getTime();
}

const from = sinceMs(since);
const rows = text(LOG)
    .split('\n')
    .filter((row) => Date.parse(row.split('\t')[0] ?? '') > from);
const lastPoll = Number(text(LAST_POLL));
const running = Date.now() - lastPoll < STALE_MS;

for (const row of rows) console.log(row);
if (!running) console.log('the job is not running');
process.exitCode = rows.length > 0 || !running ? 1 : 0;
