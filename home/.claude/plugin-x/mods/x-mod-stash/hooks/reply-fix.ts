// 🩹 the reply's fixes (FRM-662): the 🔭 waits and tasks a reply names, read for the band, a task's settle, and the stop
// that sends a red wrap_up back

import type { EngineInterface } from 'claude-code';

import type { ViewDoors } from './keep-warm.ts';
import { currentOrbit } from './orbit-store.ts';
import {
    type BackgroundTask,
    backgroundWait,
    backgroundWaits,
    noticeOf,
} from './parse.ts';
import { isBgSelf } from './session-identity.ts';
import { partsShown } from './settings-store.ts';
import { REPLY, type Reply } from './store-keys.ts';
import { turn } from './turn.ts';

// the Stop's two reds, once a turn (FRM-427): a wrap_up ask while an orbit ask is open (PK-227, one home for the next
// move), and an orbit add opening «Q<n>» whose round the reply never printed as «❓ **Q<n>**» (the 10-25 rider); a --bg
// session draws no board, so its asks go to its coordinator and neither applies
export const WRAP_UP_TOOL = 'mcp__ccd_turn__wrap_up';
export async function stopRed($: EngineInterface, reply: string) {
    if (!(await partsShown($))('stash.orbit') || (await isBgSelf($)))
        return undefined;
    const open = (await currentOrbit($)).asks.filter((a) => !a.isResolved);
    // a title inside the bold still printed the round; a false red here makes the model print it twice (PK-351:W54)
    const lost = turn.gridQs.filter(
        (n) => !new RegExp(`❓ \\*\\*Q${n}\\b`).test(reply),
    );
    const reds = [
        turn.isWrapAsked && open.length
            ? `your wrap_up asks dima a question while orbit holds ${open.map((a) => `${a.id} «${a.text}»`).join(', ')} open: one home for the next move — resolve or follow the orbit ask, or drop the wrap_up ask`
            : '',
        lost.length
            ? `you added ${lost.map((n) => `Q${n}`).join(', ')} to orbit, but the reply never printed ${lost.map((n) => `❓ **Q${n}**`).join(', ')}: a grill's asks go out with their round, so print the round in the reply`
            : '',
    ].filter(Boolean);
    return reds.length ? reds.join('\n') : undefined;
}
// a reply's own 🔭 line wins; else its background tasks, the first named for the band and all of them for the board
export function waitsOf(
    said: string | undefined,
    tasks: readonly BackgroundTask[] | undefined,
): Pick<Reply, 'wait' | 'waits' | 'tasks'> {
    if (said) return { wait: said };
    // a Stop may still list a task whose own status says it ended: read as the end notice would
    const ended = (status: string): BackgroundTask['state'] =>
        /^(?:completed|failed|killed|stopped)/i.test(status)
            ? /^completed/i.test(status)
                ? 'done'
                : 'failed'
            : undefined;
    const listed = tasks?.map((t) => ({
        ...t,
        state: ended((t as { status?: string }).status ?? '') ?? t.state,
    }));
    return {
        tasks: listed?.map(
            ({ agent_type, command, description, id, name, state, type }) => ({
                agent_type,
                command,
                description,
                id,
                name,
                ...(state ? { state } : {}),
                ...(type ? { type } : {}),
            }),
        ),
        wait: backgroundWait(listed),
        waits: backgroundWaits(listed),
    };
}
// a background task's end notice: the task leaves the session's waits and the band reads it done or failed
export async function settleTask(
    $: EngineInterface,
    text: string,
    view: ViewDoors,
) {
    const notice = noticeOf(text);
    if (!notice) return;
    const sid = await $.session.id();
    const was = (await $.store.get(REPLY + sid)) as Reply | undefined;
    if (!was?.tasks?.some((t) => t.id === notice.id)) return;
    const tasks = was.tasks.map((t) =>
        t.id === notice.id ? { ...t, state: notice.state } : t,
    );
    await $.store.set(REPLY + sid, {
        ...was,
        tasks,
        wait: backgroundWait(tasks),
        waits: backgroundWaits(tasks),
    } satisfies Reply);
    await view.load();
}
