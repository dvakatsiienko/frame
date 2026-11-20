import type { EngineInterface } from 'claude-code';

import type { StashEntry } from '../types/stash.d.ts';
import { JOIN_OWED, handBackJoins, joinsOf } from './joins.ts';
import { PREFIX, currentOrbit } from './orbit-store.ts';
import { modelLabel } from './roster.ts';
import { currentId, identity, sessionName } from './session-identity.ts';
import { partsShown } from './settings-store.ts';
import {
    AFK_KEY,
    HERDR_READ,
    HOT,
    MODEL,
    REPLY,
    type Reply,
    WAKER_KEY,
    hotOf,
} from './store-keys.ts';
import { isTurnBusy, turn } from './turn.ts';
import { CONTEXT } from './usage.ts';
import { errorText, writeWhole } from './util.ts';
import { windOf } from './wind.ts';

// the session's record on the shelf for herdr: `herdr-state/<sid>.json` and `fleet.json`, their one writer, and the
// prune of a dead session's file

// FRM-568: what herdr draws for each session lives on the shelf, one file per session, since herdr reads no private store
// (frame AGENTS.md § the boundary); dima named the folder (21:36)
const STATE_DIR = 'herdr-state';
const FLEET_FILE = 'fleet.json';
const stateDir = (home: string) => `${home}/.claude/shelf/${STATE_DIR}`;
// what the thread is doing, by herdr/contracts/herdr-state.schema.json: a running turn is working, a turn's end with a
// background task alive or a 🔭 wait is waiting, else idle; `since` is when that began, a turn's end for the first state
// after it (FRM-618 slice D: a spinner that ran on while a thread only waited, W22, W23)
type Activity = { since: number; state: 'working' | 'waiting' | 'idle' };
export function activityOf(
    was: Activity | null,
    seen: {
        endedAt?: number;
        isBusy: boolean;
        tasks?: Reply['tasks'];
        wait?: string | null;
    },
    now: number,
): Activity {
    const state = seen.isBusy
        ? 'working'
        : seen.wait || seen.tasks?.some((t) => !t.state)
          ? 'waiting'
          : 'idle';
    if (was?.state === state) return was;
    const fromTurn = !was || was.state === 'working';
    return {
        since: state !== 'working' && fromTurn ? (seen.endedAt ?? now) : now,
        state,
    };
}
let activity: Activity | null = null;

// what this process last wrote, without its time, so an unchanged state costs no write
let stateWritten: string | undefined;
let fleetWritten: string | undefined;
async function writeState($: EngineInterface) {
    const sid = await currentId($);
    const home = await $.env.get('HOME').catch(() => undefined);
    if (!sid || !home) return;
    const get = (key: string) => $.store.get(key).catch(() => undefined);
    const joins = (await partsShown($))('stash.joins')
        ? await joinsOf($, home, sid)
        : undefined;
    const entry = (await get(PREFIX + sid)) as StashEntry | undefined;
    const reply = (await get(REPLY + sid)) as Reply | undefined;
    const taken = await get(HERDR_READ + sid);
    const ctx = await get(CONTEXT + sid);
    const model = await get(MODEL + sid);
    const o = await currentOrbit($);
    activity = activityOf(
        activity,
        {
            endedAt: turn.endedAt,
            isBusy: await isTurnBusy($),
            tasks: reply?.tasks,
            wait: reply?.wait ?? null,
        },
        await $.clock.now(),
    );
    const state = {
        asks: entry?.items ?? [],
        assumed: o.assumed ?? [],
        ctx: typeof ctx === 'number' ? ctx : null,
        hot: hotOf(await get(HOT + sid)) ?? null,
        // a row reads joined only once the turn that took it completed, a slash row too (dima's o3); switched off, none:
        // herdr pushes instead; `push` stays empty while herdr still reads it
        joins: !joins
            ? null
            : {
                  joined: joins.rows
                      .filter((r) => joins.done.includes(r.id))
                      .map((r) => r.id),
                  push: [],
                  // handed into a running turn, not joined yet: herdr empties its quill on these (FRM-564)
                  taken: joins.rows
                      .filter(
                          (r) =>
                              joins.taken.includes(r.id) &&
                              !joins.done.includes(r.id),
                      )
                      .map((r) => r.id),
                  waiting: joins.rows
                      .filter((r) => !joins.done.includes(r.id))
                      .map((r) => r.id),
              },
        label: identity.label,
        model: typeof model === 'string' ? model : null,
        name: entry?.name ?? (await sessionName($)) ?? null,
        pid: identity.proc?.pid ?? null,
        plan: o.plan ? { lines: o.plan.lines } : null,
        rounds: null,
        sid,
        since: activity.since,
        state: activity.state,
        // the id this session continued from at a /clear, the fallback when a reader cannot match the pid
        succ: identity.clearedFrom ?? null,
        taken: typeof taken === 'number' ? taken : 0,
        v: 1,
        wait: reply?.wait ?? null,
        wind: (await windOf($, sid))?.state ?? null,
    };
    const text = JSON.stringify(state);
    if (text === stateWritten) return;
    await writeWhole(
        $,
        identity.proc?.pid ?? 0,
        `${stateDir(home)}/${sid}.json`,
        `${JSON.stringify({ ...state, at: await $.clock.now() })}\n`,
    );
    stateWritten = text;
}
export async function dropState($: EngineInterface, sid: string) {
    const home = await $.env.get('HOME').catch(() => undefined);
    if (!home) return;
    await $.process.run(['rm', '-f', `${stateDir(home)}/${sid}.json`]);
    stateWritten = undefined;
}
// ⏰ and 💨, fleet-wide, beside the session files; each carries its `at`, so herdr draws «on since»
export async function writeFleet($: EngineInterface) {
    const home = await $.env.get('HOME').catch(() => undefined);
    if (!home) return;
    const stamped = (v: unknown) => {
        const { at, on } = (v ?? {}) as { at?: unknown; on?: unknown };
        return { at: typeof at === 'number' ? at : null, on: on === true };
    };
    const fleet = {
        afk: stamped(await $.store.get(AFK_KEY).catch(() => undefined)),
        v: 1,
        waker: stamped(await $.store.get(WAKER_KEY).catch(() => undefined)),
    };
    const text = JSON.stringify(fleet);
    if (text === fleetWritten) return;
    await writeWhole(
        $,
        identity.proc?.pid ?? 0,
        `${stateDir(home)}/${FLEET_FILE}`,
        `${text}\n`,
    );
    fleetWritten = text;
}
// a killed session fires no end: its file goes once its pid is gone, read every STATE_PRUNE_POLLS shelf passes
const STATE_PRUNE_POLLS = 5;
let statePolls = 0;
async function pruneStates($: EngineInterface) {
    if (statePolls++ % STATE_PRUNE_POLLS) return;
    const home = await $.env.get('HOME').catch(() => undefined);
    if (!home) return;
    const dir = stateDir(home);
    for (const f of await $.fs.list(dir).catch(() => [])) {
        if (!f.name.endsWith('.json') || f.name === FLEET_FILE) continue;
        const kept = await $.fs
            .read(`${dir}/${f.name}`)
            .then((t) => JSON.parse(t) as { pid?: unknown })
            .catch(() => undefined);
        if (typeof kept?.pid !== 'number') continue;
        const ps = await $.process.run(['ps', '-p', String(kept.pid)]);
        // a killed thread fires no end: its waiting joins go back first, and its file stays until they could
        if (
            ps.exitCode !== 0 &&
            (await handBackJoins(
                $,
                home,
                f.name.slice(0, -'.json'.length),
            ).catch(() => false))
        )
            await $.process.run(['rm', '-f', `${dir}/${f.name}`]);
    }
    // an ended thread whose hand-back a held lock refused at its end
    for (const key of await $.store.keys().catch(() => [] as string[])) {
        if (!key.startsWith(JOIN_OWED)) continue;
        const sid = key.slice(JOIN_OWED.length);
        if (await handBackJoins($, home, sid).catch(() => false))
            await $.store.delete(key).catch(() => undefined);
    }
}

// told once per process: a shelf that cannot be written fails the same way every poll
let isShelfTold = false;
export async function keepShelf($: EngineInterface) {
    await writeState($).catch(async (err) => {
        if (isShelfTold) return;
        isShelfTold = true;
        await $.ui.log(
            `x-mod-stash: the herdr state file was not kept: ${errorText(err)}`,
        );
    });
    await writeFleet($).catch(() => undefined);
}
// the poll's share: every SHELF_POLLS-th tick, since asks and afk write the shelf the moment they change
const SHELF_POLLS = 3;
let shelfPolls = 0;
export async function pollShelf($: EngineInterface) {
    if (shelfPolls++ % SHELF_POLLS) return;
    await keepShelf($);
    await pruneStates($).catch(() => undefined);
}

// the model label last written for this session, so a step writes the store only when it changes
let modelSeen: string | undefined;
// the model label a step named, written only when it changes
export async function noteModel(
    $: EngineInterface,
    model: string,
    effort: string | number | undefined,
) {
    const sid = await currentId($);
    const said = modelLabel(model, effort);
    if (!sid || modelSeen === `${sid}\u0000${said}`) return;
    modelSeen = `${sid}\u0000${said}`;
    await $.store.set(MODEL + sid, said).catch(() => undefined);
}

export async function forgetModel($: EngineInterface, sid: string) {
    await $.store.delete(MODEL + sid);
}
