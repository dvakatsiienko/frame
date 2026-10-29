import {
    SESSION_NAME,
    STATE_DIR,
    armList,
    dropStaleRelay,
    fail,
    findSession,
    isArm,
    startCrow,
} from './lib.ts';

const usage = `crow:start <${armList.join('|')}> — park crow, clio's adviser, on that arm

  starts a --bg --remote-control session «${SESSION_NAME}» from ${STATE_DIR}, effort medium,
  user settings off, only the stash mod loaded with 🔥 keep-hot on, peer lines accepted.
  refuses while one already runs; pnpm crow:keep-cache-hot picks the day's arm and never refuses.`;

const [arm] = process.argv.slice(2);
if (!isArm(arm)) fail(usage);

const running = findSession();
if (running) {
    fail(
        `crow already runs (pid ${running.pid}); stop it first: pnpm crow:stop`,
    );
}

// a fresh crow never inherits a wake parked for the last one
dropStaleRelay();
await startCrow(arm);
