import type { EngineInterface } from 'claude-code';

// a member's name without its leading mode emoji: «⚡ 🔧 codie: mods lane 6 | FRM-1» and «🌗 🔧 codie: mods lane 6 | FRM-1» are one member
export const memberKey = (name: string) =>
    bare(name).replace(/^(?:☕️?|🌗|⚡️?|🌘|🎯)/u, '');
export const bare = (name: string) => name.replaceAll(/[\s\u200d]/g, '');

export const errorText = (err: unknown) =>
    err instanceof Error ? err.message : String(err);

export const basename = (path: string) =>
    path.split('/').filter(Boolean).pop() ?? path;

export const STALE_MS = 24 * 60 * 60 * 1000;
export const short = (sid: string) => sid.slice(0, 8);

export const text = (v: unknown) =>
    typeof v === 'string' && v ? v : undefined;

// whole or not at all: a reader never meets a half-written file
export async function writeWhole(
    $: EngineInterface,
    pid: number,
    path: string,
    text: string,
) {
    const cut = path.lastIndexOf('/');
    // the pid in the name: every session writes the second-wind store, and a shared temp would let one session's
    // rename move another's half-written file into place
    const temp = `${path.slice(0, cut)}/.${path.slice(cut + 1)}.${pid}.tmp`;
    await $.fs.write(temp, text);
    const r = await $.process.run(['mv', '-f', temp, path]);
    if (r.exitCode !== 0) throw new Error(r.stderr.trim() || 'mv failed');
}

// one job at a time over a read-change-write that spans awaits: each waits for the one before, and a throw never stops
// the queue
export function serial() {
    let tail: Promise<unknown> = Promise.resolve();
    return <T>(job: () => Promise<T>) => {
        const run = tail.then(job);
        tail = run.catch(() => undefined);
        return run;
    };
}

// a path's leading `~/` as the home dir; any other path, or none, as it is
export function expandHome<T extends string | undefined>(
    path: T,
    home: string,
) {
    return path?.replace(/^~(?=\/)/, home) as T;
}
