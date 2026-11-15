import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

import { findPaneTerminal } from '../../crew-adviser/scripts/lib.ts';

if (process.argv.length > 2) {
    console.error("helga:stop — stop helga's herdr pane; takes no arguments");
    process.exit(2);
}

const cwd = path.join(homedir(), '.local/state/helga');

// a pane helga is a herdr terminal; a --bg one (a groom booted her without the pane setting) is a cc background session
const address = findPaneTerminal(cwd);
const listed = spawnSync('claude', ['agents', '--json'], { encoding: 'utf8' });
const bgIds: string[] =
    listed.status === 0
        ? JSON.parse(listed.stdout)
              .filter(
                  (agent: BackgroundAgent) =>
                      agent.kind === 'background' && agent.cwd === cwd,
              )
              .map((agent: BackgroundAgent) => agent.sessionId.slice(0, 8))
        : [];

if (!address && bgIds.length === 0) {
    console.log('no helga live');
    process.exit(0);
}
const stops: [string, string[]][] = [
    ...(address ? [['hc', ['kill', address]] as [string, string[]]] : []),
    ...bgIds.map((id): [string, string[]] => ['claude', ['stop', id]]),
];
for (const [cmd, cmdArgs] of stops) {
    const run = spawnSync(cmd, cmdArgs, { encoding: 'utf8' });
    if (run.status !== 0) {
        console.error(
            `${cmd} ${cmdArgs.join(' ')} failed: ${(run.stderr || run.stdout).trim()}`,
        );
        process.exit(1);
    }
    console.log(`helga stopped (${cmd} ${cmdArgs.join(' ')})`);
}

/* Types */

interface BackgroundAgent {
    cwd: string;
    kind: string;
    sessionId: string;
}
