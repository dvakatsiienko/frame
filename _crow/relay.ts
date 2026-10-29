import { readFileSync, rmSync } from 'node:fs';

import { RELAY_PATH, type Wake, dropStaleRelay, spawnHarvest } from './lib.ts';

// a clio UserPromptSubmit hook: once x-mod-stash in her thread sent a parked wake to a desktop-tab crow (`isSent`), it
// starts the harvester; an unsent wake stays parked for the mod's next poll, never an ask in her context
if (dropStaleRelay()) process.exit(0);
let parked:
    | (Wake & { line: string; model?: string; isSent?: boolean })
    | undefined;
try {
    parked = JSON.parse(readFileSync(RELAY_PATH, 'utf8'));
} catch {
    process.exit(0);
}
if (!parked?.isSent) process.exit(0);
rmSync(RELAY_PATH);
spawnHarvest(parked);
