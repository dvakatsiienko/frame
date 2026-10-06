import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

import {
    SESSION_NAME,
    STATE_DIR,
    armList,
    armModels,
    claudeArgs,
    fail,
    findSession,
    isArm,
    readCharter,
    readState,
    writeState,
} from './lib.ts';

const usage = `ccrow:start <${armList.join('|')}> — park ccrow, cclio's adviser, on that arm

  starts a --bg --remote-control session «${SESSION_NAME}» from ${STATE_DIR}, effort medium,
  hooks and mods off, peer lines accepted. refuses while one already runs.`;

const [arm] = process.argv.slice(2);
if (!isArm(arm)) fail(usage);

const running = findSession();
if (running) {
    const handle = running.jobId ?? String(running.pid);
    fail(
        `ccrow already runs (pid ${running.pid}); stop it first: claude stop ${handle}`,
    );
}

mkdirSync(STATE_DIR, { recursive: true });
const result = spawnSync(
    'claude',
    [
        '--bg',
        '-n',
        SESSION_NAME,
        ...claudeArgs(arm),
        '--remote-control',
        SESSION_NAME,
        readCharter(),
    ],
    { cwd: STATE_DIR, encoding: 'utf8' },
);
if (result.error) fail(`cannot run claude: ${result.error.message}`);
const jobId = /backgrounded · (\S+)/.exec(result.stdout)?.[1];
if (result.status !== 0 || !jobId) {
    fail(`claude --bg failed: ${(result.stderr || result.stdout).trim()}`);
}

writeState({ ...readState(), arm, jobId, startedAt: Date.now() });
console.log(
    `ccrow started on ${arm} (${armModels[arm]}, effort medium), job ${jobId}`,
);
