// 🩹 the reply's fixes (FRM-662): the 🔭 waits and tasks a reply names, read for the band, a task's settle, and the stop
// that sends a red wrap_up back

import type { Args, EngineInterface, Next, RenderInput } from 'claude-code';

import { closeBoot } from './boot.ts';
import type { ViewDoors } from './keep-warm.ts';
import { currentOrbit } from './orbit-store.ts';
import {
    type BackgroundTask,
    backgroundWait,
    backgroundWaits,
    boldFleetWords,
    bulletDots,
    dropWaitAside,
    linkTickets,
    noticeOf,
    numberCircled,
    parseWait,
} from './parse.ts';
import { isBgSelf, sessionName } from './session-identity.ts';
import { SHOWN, partsShown, shownOf } from './settings-store.ts';
import { REPLY, type Reply } from './store-keys.ts';
import { clearWrap, endUserTurn, turn } from './turn.ts';
import { countWords } from './usage.ts';
import { errorText } from './util.ts';

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

// a reload keeps `$.state` and resets the module: what must outlive a mod save lives there (FRM-320)
// what the band and the board draw: renders read it, and a write redraws them, no invalidate
const VIEW = { key: 'view', plugin: 'x-mod-stash' } as const;
// a 📄 line's HH:MM — the same shape reply-check.py reads
const STAMP = /(📄[^\n]*?\b)(\d{1,2}:\d{2})\b/g;
// the stored reply: its ·-list as bullets, fleet words bold, its 📄 stamp the time it was written
export async function fixStoredReply(
    $: EngineInterface,
    e: Args<'session.append'>,
    next: Next<'session.append'>,
) {
    const now = new Date(await $.clock.now()).toTimeString().slice(0, 5);
    // the 🎛️ switches gate the stored rewrite, not only its look (the part list's 📌)
    const switches = shownOf(await $.store.get(SHOWN).catch(() => undefined));
    const isOn = {
        bold: switches['stash.boldwords'] !== false,
        bullets: switches['stash.bullets'] !== false,
    };
    let isChanged = false;
    const hits: Record<string, number> = {};
    const content = e.message.content.map((b) => {
        if (b.type !== 'text' || typeof b.text !== 'string') return b;
        // the stored row is what the Stop hooks read: a ·-list fixed here never trips reply-check
        const dotted = isOn.bullets ? bulletDots(b.text) : b.text;
        const fixed = isOn.bold
            ? boldFleetWords(dotted)
            : { hits: {}, text: dotted };
        for (const [word, n] of Object.entries(fixed.hits))
            hits[word] = (hits[word] ?? 0) + n;
        const bulleted = fixed.text;
        if (bulleted !== b.text) isChanged = true;
        const text = bulleted.replace(
            STAMP,
            (whole: string, head: string, at: string) => {
                if (at === now) return whole;
                isChanged = true;
                return `${head}${now}`;
            },
        );
        return { ...b, text };
    });
    if (Object.keys(hits).length)
        await countWords($, hits).catch((err) =>
            $.ui.log(
                `x-mod-stash: the fleet-word count was not kept: ${errorText(err)}`,
            ),
        );
    if (!isChanged) return next(e);
    return next({ ...e, message: { ...e.message, content } });
}
// the drawn reply, while it streams: each mechanical fix behind its own switch
export async function fixDrawnReply(
    $: EngineInterface,
    e: RenderInput<'AssistantMessage'>,
    next: Next<'ui.render', RenderInput<'AssistantMessage'>>,
) {
    // a fix that throws draws the reply as written, never a blank
    let text: string;
    try {
        const switches = (await $.state.get(VIEW)).value?.shown ?? {};
        const dotted =
            switches['stash.bullets'] !== false
                ? bulletDots(e.props.text)
                : e.props.text;
        // each fix is mechanical and behind its own switch; reply-check no longer logs what these redraw (todo 29)
        const fixes: [string, (t: string) => string][] = [
            ['stash.circled', numberCircled],
            ['stash.tickets', linkTickets],
            ['stash.waitaside', dropWaitAside],
        ];
        const fixed = fixes.reduce(
            (t, [key, fix]) => (switches[key] !== false ? fix(t) : t),
            dotted,
        );
        text = (
            switches['stash.boldwords'] !== false
                ? boldFleetWords(fixed)
                : { text: fixed }
        ).text;
    } catch {
        return next(e);
    }
    if (text === e.props.text) return next(e);
    return next({ ...e, props: { ...e.props, text } });
}
// a reply's end: the boot closed, the red wrap_up stop, the 🔭 waits kept, dima's turn ended
export async function settleReply(
    $: EngineInterface,
    e: Args<'classic.Stop'>,
    next: Next<'classic.Stop'>,
    view: ViewDoors,
) {
    const r = await next(e);
    await closeBoot($, e.session_id, e.last_assistant_message ?? '');
    const red = e.stop_hook_active
        ? undefined
        : await stopRed($, e.last_assistant_message ?? '');
    clearWrap();
    // a keep-hot ping's one-character reply never clears what the session waits on; it only stamps the warm cache
    const was = turn.pinged
        ? ((await $.store.get(REPLY + e.session_id).catch(() => undefined)) as
              | Reply
              | undefined)
        : undefined;
    const reply: Reply | undefined = turn.pinged
        ? was && { ...was, pingedAt: await $.clock.now() }
        : {
              at: await $.clock.now(),
              name: await sessionName($),
              ...waitsOf(
                  parseWait(e.last_assistant_message ?? ''),
                  e.background_tasks,
              ),
          };
    if (reply)
        await $.store.set(REPLY + e.session_id, reply).catch(() => undefined);
    await endUserTurn($);
    await view.load();
    return red ? { ...r, block: red } : r;
}
