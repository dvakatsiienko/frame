import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/** a program run for a test as the mac runs it, on the linux runner too: its realpath and stat answer otherwise */
export function macExec(program: string, args: string[]) {
    // linux's stat reads -f as another flag
    if (program === 'stat')
        return {
            code: 0,
            stdout: args
                .filter((arg) => arg.startsWith('/') && existsSync(arg))
                .map((path) => `1\t${path}`)
                .join('\n'),
        };
    // linux's realpath answers for a path that is not there unless told -e
    const isGnu = program === '/bin/realpath' && process.platform === 'linux';
    const ran = spawnSync(program, isGnu ? ['-e', ...args] : args, {
        encoding: 'utf8',
        timeout: 10_000,
    });
    return { code: ran.status ?? 1, stdout: ran.stdout };
}
