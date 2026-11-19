import type { EngineInterface } from 'claude-code';

import { registry } from './roster.ts';
import { currentId } from './session-identity.ts';
import { writeFleet } from './session-record.ts';
import { partsShown } from './settings-store.ts';
import { AFK_KEY, HOT, WAKER_KEY } from './store-keys.ts';
import { turn } from './turn.ts';
import { paceMeterOf } from './usage.ts';

// the band's three switches as this process holds them: 💨 afk, ⏰ the waker, 🔥 keep-hot; read through `warm`
const state = {
    afk: false,
    // since: the turn end the next ping counts from; only dima's click turns it off, a 5h reset never does
    hot: undefined as { since: number } | undefined,
    // a turn start or a flip bumps it, so a ping armed before either never fires
    hotGen: 0,
    isWaker: false,
};
export const warm: Readonly<typeof state> = state;
// the module copy alone, no store write: a load's read, a press's flip before its write, and the flip's rollback
export const holdAfk = (on: boolean) => {
    state.afk = on;
};
export const holdWaker = (on: boolean) => {
    state.isWaker = on;
};
export const holdHot = (hot: { since: number } | undefined) => {
    state.hot = hot;
};
export const bumpHotGen = () => ++state.hotGen;

export async function saveHot($: EngineInterface) {
    const sid = await currentId($);
    if (!sid) return;
    await $.store.set(HOT + sid, state.hot ?? { off: true });
}

// 🔥 set, never flipped: on keeps a running hot's start, else counts from now mid-turn or from the last turn's end
export async function setHot($: EngineInterface, on: boolean) {
    const now = await $.clock.now();
    state.hot = on
        ? (state.hot ?? { since: turn.isBusy ? now : (turn.endedAt ?? now) })
        : undefined;
    await saveHot($);
}

// ⏰'s one writer: every write stamps its time, so the latest press wins whichever band it came from (FRM-568)
// `at`: the press's own time, so a later press read in the same poll still outranks it; a cc press stamps now
export async function writeWaker($: EngineInterface, on: boolean, at?: number) {
    await $.store.set(WAKER_KEY, { at: at ?? (await $.clock.now()), on });
    await writeFleet($).catch(() => undefined);
}

// ⏰ set, never flipped; a set during afk is what afk off puts back
export async function setWaker($: EngineInterface, on: boolean, at?: number) {
    state.isWaker = on;
    await writeWaker($, on, at);
    const away = (await $.store.get(AFK_KEY)) as
        | { at?: number; on?: boolean; wakerBefore?: boolean }
        | undefined;
    if (away?.on) await $.store.set(AFK_KEY, { ...away, wakerBefore: on });
}

// 💨 set, never flipped: afk on turns ⏰ on, afk off puts back what ⏰ was before it; a press on ⏰ meanwhile still counts
export async function setAfk($: EngineInterface, on: boolean, at?: number) {
    const was = (await $.store.get(AFK_KEY)) as
        | { at?: number; on?: boolean; wakerBefore?: boolean }
        | undefined;
    const wakerWas = (await $.store.get(WAKER_KEY)) as
        | { on?: boolean }
        | undefined;
    state.afk = on;
    const stamp = at ?? (await $.clock.now());
    await $.store.set(AFK_KEY, {
        at: stamp,
        on,
        ...(on
            ? { wakerBefore: was?.on ? was.wakerBefore : wakerWas?.on === true }
            : {}),
    });
    if (on || was?.wakerBefore !== undefined) {
        state.isWaker = on || was?.wakerBefore === true;
        await writeWaker($, state.isWaker, stamp);
    }
    await writeFleet($).catch(() => undefined);
    return was;
}

// 💨 afk on keeps every remote-controlled session warm too, as if its 🔥 were on (o161): each session's own stash
// pings itself, counted from its last turn end
export async function isAfkWarm($: EngineInterface) {
    if (!state.afk || !(await partsShown($))('stash.afk')) return false;
    const sid = await currentId($);
    return (await registry($).catch(() => [])).some(
        (r) => r.base.sid === sid && r.isBridged,
    );
}

// a ping at 100 % only comes back as the cap's error
export async function isWindowSpent($: EngineInterface) {
    const m = await paceMeterOf($).catch(() => undefined);
    return Boolean(m && m.resetsAt > m.now && m.used >= 100);
}
