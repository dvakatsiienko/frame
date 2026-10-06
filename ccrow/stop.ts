import { spawnSync } from 'node:child_process';

import {
    clearHot,
    fail,
    findSession,
    isAlive,
    readState,
    stashModOf,
    storeOf,
    userPluginDirs,
    writeState,
} from './lib.ts';

if (process.argv.length > 2) {
    fail(
        'ccrow:stop — stop the live ccrow and switch its 🔥 off; takes no arguments',
    );
}

const running = findSession();
if (!running) {
    console.log('no ccrow live');
    process.exit(0);
}
const handle = running.jobId ?? String(running.pid);
const result = spawnSync('claude', ['stop', handle], { encoding: 'utf8' });
if (result.error) fail(`cannot run claude: ${result.error.message}`);
if (result.status !== 0) {
    fail(
        `claude stop ${handle} failed: ${(result.stderr || result.stdout).trim()}`,
    );
}

const stash = stashModOf(userPluginDirs());
const store = stash && storeOf(stash.name);
if (store) clearHot(store, running.sessionId);
writeState({ ...readState(), jobId: undefined });

// the registry entry goes before the process does (measured: ~2 s)
for (let i = 0; i < 20 && isAlive(running.pid); i++) {
    await new Promise((done) => setTimeout(done, 500));
}
if (isAlive(running.pid)) {
    fail(
        `ccrow pid ${running.pid} still alive 10 s after claude stop ${handle}`,
    );
}
console.log(`ccrow stopped (job ${handle})`);
