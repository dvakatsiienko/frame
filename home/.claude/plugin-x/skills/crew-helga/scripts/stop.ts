import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

import { findPaneTerminal } from '../../crew-adviser/scripts/lib.ts';

if (process.argv.length > 2) {
    console.error("helga:stop — stop helga's herdr pane; takes no arguments");
    process.exit(2);
}

const address = findPaneTerminal(path.join(homedir(), '.local/state/helga'));
if (!address) {
    console.log('no helga pane live');
    process.exit(0);
}
const killed = spawnSync('hc', ['kill', address], { encoding: 'utf8' });
if (killed.status !== 0) {
    console.error(
        `hc kill ${address} failed: ${(killed.stderr || killed.stdout).trim()}`,
    );
    process.exit(1);
}
console.log(`helga stopped (herdr terminal ${address})`);
