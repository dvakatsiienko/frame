import { spawnSync } from 'node:child_process';
import { lstatSync, statSync } from 'node:fs';

/** a program run for a test as the mac runs it, on the linux runner too: its realpath and stat answer otherwise */
export function macExec(program: string, args: string[]) {
    // linux's stat reads -f as another flag; the mac's, with -L, reads a link to none as the link itself
    if (program === 'stat' && process.platform === 'linux') {
        const isFollowed = args.includes('-L');
        return {
            code: 0,
            stdout: args
                .filter((arg) => arg.startsWith('/'))
                .flatMap((path) => {
                    const self = lstatSync(path, { throwIfNoEntry: false });
                    const target = isFollowed
                        ? statSync(path, { throwIfNoEntry: false })
                        : undefined;
                    const at = target ?? self;
                    if (!at) return [];
                    const kind = at.isSymbolicLink()
                        ? 'Symbolic Link'
                        : 'Regular File';
                    return [`1\t${kind}\t${path}`];
                })
                .join('\n'),
        };
    }
    // linux's realpath answers for a path that is not there unless told -e
    const isGnu = program === '/bin/realpath' && process.platform === 'linux';
    const ran = spawnSync(program, isGnu ? ['-e', ...args] : args, {
        encoding: 'utf8',
        timeout: 10_000,
    });
    return { code: ran.status ?? 1, stdout: ran.stdout };
}
