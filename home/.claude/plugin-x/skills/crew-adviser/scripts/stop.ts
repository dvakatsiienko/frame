import { spawnSync } from 'node:child_process';

import {
    clearHot,
    fail,
    findPaneTerminal,
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
        'crow:stop — stop the live crow and switch its 🔥 off; takes no arguments',
    );
}

const running = findSession();
if (!running) {
    console.log('no crow live');
    process.exit(0);
}
const stash = stashModOf(userPluginDirs());
const store = stash && storeOf(stash.name);
// a pane crow has no job id but takes a cli entrypoint: its herdr terminal is killed
if (!running.jobId && running.entrypoint === 'cli') {
    const address = findPaneTerminal(running.cwd);
    if (!address)
        fail(
            `crow pid ${running.pid} is a cli session, but no herdr terminal matches cwd ${running.cwd}`,
        );
    const killed = spawnSync('hc', ['kill', address], { encoding: 'utf8' });
    if (killed.error) fail(`cannot run hc: ${killed.error.message}`);
    if (killed.status !== 0) {
        fail(
            `hc kill ${address} failed: ${(killed.stderr || killed.stdout).trim()}`,
        );
    }
    if (store) clearHot(store, running.sessionId);
    console.log(`crow stopped (herdr terminal ${address})`);
    process.exit(0);
}
// a desktop tab has no job id: claude stop cannot reach it, and the tab is dima's to close
if (!running.jobId) {
    if (store) clearHot(store, running.sessionId);
    console.log(
        `crow is a desktop tab (pid ${running.pid}): 🔥 off, the tab stays for dima`,
    );
    process.exit(0);
}
const handle = running.jobId;
const result = spawnSync('claude', ['stop', handle], { encoding: 'utf8' });
if (result.error) fail(`cannot run claude: ${result.error.message}`);
if (result.status !== 0) {
    fail(
        `claude stop ${handle} failed: ${(result.stderr || result.stdout).trim()}`,
    );
}

if (store) clearHot(store, running.sessionId);
writeState({ ...readState(), jobId: undefined });

// the registry entry goes before the process does (measured: ~2 s)
for (let i = 0; i < 20 && isAlive(running.pid); i++) {
    await new Promise((done) => setTimeout(done, 500));
}
if (isAlive(running.pid)) {
    fail(
        `crow pid ${running.pid} still alive 10 s after claude stop ${handle}`,
    );
}
console.log(`crow stopped (job ${handle})`);
