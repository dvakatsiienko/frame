/**
 * schedule:restart <job> — restart ONE job on the plist launchd already holds, and wait until it runs again.
 * a changed plist still needs schedule:install; this is for a rebuilt binary.
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const name = process.argv[2];
const jobs = join(import.meta.dirname, 'jobs');

if (!(name && existsSync(join(jobs, name)))) {
    console.error(
        `usage: pnpm schedule:restart <job> — one of the dirs in schedule/jobs`,
    );
    process.exit(1);
}

const target = `gui/${userInfo().uid}/com.dima.${name}`;
const state = async () => {
    const { stdout } = await run('launchctl', ['print', target]);
    return {
        pid: stdout.match(/^\tpid = (\d+)/m)?.[1],
        state: stdout.match(/^\tstate = (\w+)/m)?.[1],
    };
};

const before = await state();
await run('launchctl', ['kickstart', '-k', target]);
let after = await state();
for (
    let i = 0;
    i < 25 && !(after.state === 'running' && after.pid !== before.pid);
    i++
) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    after = await state();
}

const errLog = [
    join(homedir(), '.local/share', name, 'daemon.err.log'),
    join(homedir(), '.local/share', name, 'run.err.log'),
].find(existsSync);
const lastLine = errLog
    ? readFileSync(errLog, 'utf8').trimEnd().split('\n').at(-1)
    : undefined;
const isUp = after.state === 'running' && after.pid !== before.pid;
console.log(
    `${isUp ? '🟢' : '🔴'} ${name} — ${after.state ?? 'unknown'}, pid ${before.pid ?? '–'} → ${after.pid ?? '–'}`,
);
if (lastLine) console.log(`   ${lastLine}`);
process.exit(isUp ? 0 : 1);
