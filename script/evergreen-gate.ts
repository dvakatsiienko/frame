/**
 * evergreen-gate — is every surface current after the wednesday round? frame and bytes npm,
 * x/go and sline go modules fail it; brew and uv only inform. holds come from the renovate
 * configs, majors wait for the major round, a release under 3 days is skipped.
 */
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { type Exec, evergreenGate } from './lib/evergreen-gate.ts';

const exec: Exec = (cmd, args, cwd) =>
    new Promise((resolve) => {
        execFile(
            cmd,
            args,
            {
                cwd,
                env: { ...process.env, HOMEBREW_NO_AUTO_UPDATE: '1' },
                maxBuffer: 64 * 1024 * 1024,
            },
            (error, stdout) => {
                const code = error
                    ? typeof error.code === 'number'
                        ? error.code
                        : 1
                    : 0;
                resolve({ code, stdout });
            },
        );
    });

const result = await evergreenGate({
    exec,
    now: new Date(),
    roots: {
        bytes: join(homedir(), 'projects/bytes'),
        frame: join(import.meta.dirname, '..'),
    },
});
for (const l of result.lines) console.log(l);
process.exit(result.code);
