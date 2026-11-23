import type { EngineInterface } from 'claude-code';

import type { Context } from './rules/command.ts';
import { stashSweep, stashSweeps } from './rules/floor.ts';

// x-mod-holds' store file: a session's first edit of a file holds it, and a Bash write by another session is refused here,
// by the one Bash parser. the release checks are holds' own: a holder idle 30 min, a dead pid, a landed hold clean in git
const HOLDS_FILE = /^x-mod-holds_.*\.json$/;
const HOLD = 'hold:';
const IDLE_MS = 30 * 60 * 1000;
type Hold = { at: number; file: string; landed?: boolean; top?: string };
type Holder = { pid?: number; start?: string; idleSince: number | null };

// twin holder-gone — a copy lives in x-mod-holds; the twins lint keeps them equal
// a holder that ended, went idle or died holds nothing
async function isGone(
    $: EngineInterface,
    holder: Holder | undefined,
    now: number,
) {
    if (!holder) return true;
    if (holder.idleSince !== null && now - holder.idleSince >= IDLE_MS)
        return true;
    if (holder.pid && holder.start) {
        const ps = await $.process.run([
            'ps',
            '-o',
            'lstart=',
            '-p',
            String(holder.pid),
        ]);
        // a reused pid starts at another time
        if (ps.stdout.trim() !== holder.start) return true;
    }
    return false;
}
// twin end

// the holds another live session keeps, read from x-mod-holds' store file
async function liveHolds($: EngineInterface, ctx: Context) {
    const dir = `${ctx.home}/.claude/plugins/store`;
    const held: Record<string, unknown> = {};
    for (const f of await $.fs.list(dir).catch(() => [])) {
        if (!HOLDS_FILE.test(f.name)) continue;
        try {
            Object.assign(
                held,
                JSON.parse(await $.fs.read(`${dir}/${f.name}`)),
            );
        } catch {}
    }
    const sid = await $.session.id();
    const now = await $.clock.now();
    const live: {
        holder: string;
        hold: Hold;
        isPassed: boolean;
        key: string;
        now: number;
    }[] = [];
    for (const [key, value] of Object.entries(held)) {
        if (!key.startsWith(HOLD)) continue;
        const cut = key.indexOf(':', HOLD.length);
        const holder = key.slice(HOLD.length, cut);
        if (holder === sid) continue;
        const hold = value as Hold;
        if (
            await isReleased(
                $,
                held[`holder:${holder}`] as Holder | undefined,
                hold,
                now,
            )
        )
            continue;
        const path = key.slice(cut + 1);
        // x-mod-holds' pass: dima's tick let this session write the file until its next commit or its turn's end
        const isPassed = held[`pass:${sid}:${path}`] !== undefined;
        live.push({ hold, holder, isPassed, key: path, now });
    }
    return live;
}

// a whole-tree stash in a repo where another live session holds a file sweeps that file too
export async function stashOver(
    $: EngineInterface,
    command: string,
    cwd: string,
    ctx: Context,
) {
    const dirs = stashSweeps(command, cwd, ctx);
    if (!dirs.length) return undefined;
    const live = await liveHolds($, ctx);
    for (const dir of dirs) {
        const found = live.find(
            (l) =>
                l.hold.top !== undefined &&
                (dir === l.hold.top || dir.startsWith(`${l.hold.top}/`)),
        );
        if (found) return stashSweep(dir, found.hold.file);
    }
    return undefined;
}

async function isReleased(
    $: EngineInterface,
    holder: Holder | undefined,
    hold: Hold,
    now: number,
) {
    if (await isGone($, holder, now)) return true;
    if (!hold.landed) return false;
    const git = await $.process
        .run(['git', 'status', '--porcelain', '--', hold.file], {
            cwd: hold.file.slice(0, hold.file.lastIndexOf('/')) || '/',
        })
        .catch(() => null);
    return git?.exitCode !== 0 || git.stdout.trim() === '';
}
