// the x cli's json door: one run from home, so the shim runs main's x

import type { EngineInterface } from 'claude-code';

// a run that exited 0 gives its envelope's `data` (undefined when it printed no json); a failed run gives undefined
export async function xRead(
    $: EngineInterface,
    args: string[],
    timeoutMs = 4000,
): Promise<{ data?: unknown } | undefined> {
    const run = await $.process
        .run(['x', ...args, '--json'], {
            cwd: await $.env.get('HOME'),
            timeoutMs,
        })
        .catch(() => undefined);
    if (run?.exitCode !== 0) return undefined;
    try {
        return { data: (JSON.parse(run.stdout) as { data?: unknown }).data };
    } catch {
        return {};
    }
}
