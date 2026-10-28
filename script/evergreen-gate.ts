/**
 * evergreen-gate — is every surface current after the wednesday round? frame and bytes npm,
 * x/go and sline go modules fail it; brew and uv only inform. holds come from the renovate
 * configs, majors wait for the major round, a release younger than the preset's
 * minimumReleaseAge is skipped.
 */
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { evergreenGate } from './lib/evergreen-gate.ts';

const result = await evergreenGate({
    exec: run,
    now: new Date(),
    roots: {
        bytes: join(homedir(), 'projects/bytes'),
        frame: join(import.meta.dirname, '..'),
    },
});
for (const reportLine of result.lines) console.log(reportLine);
process.exit(result.code);

function run(cmd: string, args: string[], cwd: string) {
    return new Promise<{ code: number; stdout: string }>((resolve) => {
        execFile(
            cmd,
            args,
            {
                cwd,
                env: { ...process.env, HOMEBREW_NO_AUTO_UPDATE: '1' },
                maxBuffer: 64 * 1024 * 1024,
            },
            (error, stdout) => {
                const exitCode =
                    typeof error?.code === 'number' ? error.code : 1;
                resolve({ code: error ? exitCode : 0, stdout });
            },
        );
    });
}
