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

const usage = `crow:start <${armList.join('|')}> [--pane] — park crow, clio's adviser, on that arm

  starts a --bg --remote-control session «${SESSION_NAME}» from ${STATE_DIR}, effort medium,
  user settings off, only the stash mod loaded with 🔥 keep-hot on, peer lines accepted.
  --pane runs it in a herdr pane (hc run) instead of a --bg job: no job id, stop kills the pane.
  refuses while one already runs; pnpm crow:keep-cache-hot picks the day's arm and never refuses.`;

const [arm, flag, ...extra] = process.argv.slice(2);
if (!isArm(arm) || (flag && flag !== '--pane') || extra.length > 0) {
    fail(usage);
}

const running = findSession();
if (running) {
    fail(
        `crow already runs (pid ${running.pid}); stop it first: pnpm crow:stop`,
    );
}

// a fresh crow never inherits a wake parked for the last one
dropStaleRelay();
await startCrow(arm, flag === '--pane');
