// 🚦 the board's session rows (FRM-662): each live session from the registry with what its own stash wrote — asks,
// context, held pings, 🔥, model, its wait and its wind — sorted coordinator first, her adviser second

import type { EngineInterface } from 'claude-code';

import type { StashEntry } from '../types/stash.d.ts';
import { heldStuckMs } from './held.ts';
import { statusOf } from './look.ts';
import { PREFIX } from './orbit-store.ts';
import { heldOf, quietPingsOf } from './quiet-gate.ts';
import {
    HEADLESS,
    type Member,
    type Registered,
    SHORT_MS,
    crowTip,
    isOpen,
    isResumed,
    isSeated,
    isUnstarted,
    pinOf,
    registry,
} from './roster.ts';
import {
    MAIN_ROLE,
    WING_ROLE,
    currentId,
    threadRecords,
} from './session-identity.ts';
import { partsShown } from './settings-store.ts';
import { HOT, MODEL, REPLY, type Reply, hotOf } from './store-keys.ts';
import { CONTEXT } from './usage.ts';
import { STALE_MS, text } from './util.ts';
import { windOf } from './wind.ts';

const CLIO_ASKS = { key: 'clioAsks', plugin: 'x-mod-stash' } as const;

type Entry = StashEntry;

// a thread's asks show while it has any and they are under a day old
const isLive = (v: Entry | undefined, now: number): v is Entry =>
    !!v && Array.isArray(v.asks) && v.asks.length > 0 && now - v.at < STALE_MS;

// live sessions from the registry, each with what its own stash wrote
export async function members($: EngineInterface): Promise<Member[]> {
    const out: Member[] = [];
    const now = await $.clock.now();
    const home = await $.env.get('HOME');
    const shown: Registered[] = [];
    for (const r of await registry($)) {
        if (!r.isAlive || HEADLESS.test(r.base.name)) continue;
        const isYoung =
            r.startedAt !== undefined && now - r.startedAt < SHORT_MS;
        if (isYoung && !(await isResumed($, home, r))) continue;
        shown.push(r);
    }
    const records = await threadRecords($);
    // a row's seat and pin are display: they read the store x wrote, with no spawn per row
    const roleOfRow = (sid: string) =>
        records.find((t) => t.sessionId === sid)?.role;
    for (const { bg, cwd, base: r } of shown) {
        if (await isUnstarted($, home, cwd, r.sid)) continue;
        const reply = (await $.store.get(REPLY + r.sid)) as
            | Partial<Reply>
            | undefined;
        const asks = (await $.store.get(PREFIX + r.sid)) as Entry | undefined;
        const held = heldOf(await quietPingsOf($, r.name, r.sid));
        out.push({
            ...r,
            asks: isLive(asks, now) ? asks.asks.length : 0,
            context: (await $.store.get(CONTEXT + r.sid)) as number | undefined,
            held,
            isHeldStuck:
                !!held &&
                now - Math.min(...held.map((p) => p.at)) >
                    (await heldStuckMs($)),
            isHot: Boolean(hotOf(await $.store.get(HOT + r.sid))),
            model: text(await $.store.get(MODEL + r.sid)),
            offPattern: bg && !isSeated(roleOfRow(r.sid)),
            // an idle row counts from the session's last reply, or a later keep-hot ping: cc restamps the registry
            // whenever a thread is opened, which read «idle 55m» on a thread quiet for 9 h (PK-77)
            statusSince:
                !statusOf(r.status).isWorking && reply?.at !== undefined
                    ? Math.max(reply.at, reply.pingedAt ?? reply.at)
                    : r.statusSince,
            tip:
                pinOf(roleOfRow(r.sid)) === 1
                    ? await crowTip($, home, now)
                    : undefined,
            // the band says «first +n»; the board has the room to name every wait (dima's o75)
            wait:
                reply?.waits && reply.waits.length > 1
                    ? `waiting on ${reply.waits.join('; ')}`
                    : reply?.wait,
            wind: await windOf($, r.sid),
        });
    }
    // the coordinator first, her adviser second, the rest by name
    return out.sort(
        (a, b) =>
            pinOf(roleOfRow(a.sid)) - pinOf(roleOfRow(b.sid)) ||
            a.name.localeCompare(b.name),
    );
}

// each live clio, main and wings, with its own orbit asks that wait on dima: unmarked, as it last published them; read at
// the poll into $.state, since the board draws with no file read
let clioAsksShown = '';
export async function showClioAsks($: EngineInterface) {
    if (!(await isOpen($)) || !(await partsShown($))('stash.orbit')) return;
    const waiting = await cliosWaiting($);
    const text = JSON.stringify(waiting);
    if (text === clioAsksShown) return;
    clioAsksShown = text;
    await $.state.set(CLIO_ASKS, waiting).catch(() => undefined);
}
async function cliosWaiting($: EngineInterface) {
    const live = new Set(
        (await registry($)).filter((r) => r.isAlive).map((r) => r.base.sid),
    );
    const self = await currentId($);
    const clios = (await threadRecords($)).filter(
        (t) =>
            (t.role === MAIN_ROLE || t.role === WING_ROLE) &&
            live.has(t.sessionId),
    );
    const waiting: { isSelf: boolean; n: number; name: string; sid: string }[] =
        [];
    for (const t of clios) {
        const entry = (await $.store
            .get(PREFIX + t.sessionId)
            .catch(() => undefined)) as Entry | undefined;
        const n = (entry?.items ?? []).filter((a) => !a.mark).length;
        if (n)
            waiting.push({
                isSelf: t.sessionId === self,
                n,
                name: t.display ?? t.name ?? t.sessionId,
                sid: t.sessionId,
            });
    }
    return waiting;
}
