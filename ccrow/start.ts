import {
    SESSION_NAME,
    STATE_DIR,
    armList,
    fail,
    findSession,
    isArm,
    startCcrow,
} from './lib.ts';

const usage = `ccrow:start <${armList.join('|')}> — park ccrow, cclio's adviser, on that arm

  starts a --bg --remote-control session «${SESSION_NAME}» from ${STATE_DIR}, effort medium,
  user settings off, only the stash mod loaded with 🔥 keep-hot on, peer lines accepted.
  refuses while one already runs; pnpm ccrow:ensure picks the day's arm and never refuses.`;

const [arm] = process.argv.slice(2);
if (!isArm(arm)) fail(usage);

const running = findSession();
if (running) {
    fail(
        `ccrow already runs (pid ${running.pid}); stop it first: pnpm ccrow:stop`,
    );
}

await startCcrow(arm);
