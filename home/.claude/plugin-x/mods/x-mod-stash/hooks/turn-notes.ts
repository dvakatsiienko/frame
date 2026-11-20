// 🪐 the turn's orbit notes (FRM-662): what a prompt carries about this session's orbit — the open asks, a stale plan, a
// lane that moved nothing — told once until it changes, in the words dima keeps in herdr's orbit texts

import type { EngineInterface } from 'claude-code';

import type { StashOrbit } from '../types/stash.d.ts';
import { ORBIT_TOOL } from './orbit.ts';
import { type IsPartOn, herdrRows } from './settings-store.ts';

export const STALE_TURNS = 3;
// a plan set this turn counts from the turn's end, so a prompt landing mid-turn would read it as -1
export const planAge = (o: StashOrbit) =>
    o.plan === undefined ? undefined : Math.max(0, o.turns - o.plan.at);
// dima's own words for three orbit lines, typed in herdr's settings and read at each nudge, no restart: a blank or
// missing row, or a settings file that does not read, is the built-in text
const ORBIT_TEXT_ROWS = {
    lane: 'stash.orbit.text.lane-stale',
    plan: 'stash.orbit.text.plan-stale',
    tick: 'stash.orbit.text.tick',
} as const;
type OrbitTexts = Partial<Record<keyof typeof ORBIT_TEXT_ROWS, string>>;
export async function orbitTexts($: EngineInterface): Promise<OrbitTexts> {
    const home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
    const rows = await herdrRows($, home).catch(
        (): Record<string, unknown> => ({}),
    );
    const typed = (key: string) => {
        const text = rows[key];
        return typeof text === 'string' && text.trim()
            ? text.trim()
            : undefined;
    };
    return {
        lane: typed(ORBIT_TEXT_ROWS.lane),
        plan: typed(ORBIT_TEXT_ROWS.plan),
        tick: typed(ORBIT_TEXT_ROWS.tick),
    };
}
// `{name}` takes the value its line has, `{tool}` the orbit tool's name in every line; a name the line does not know
// stays as he typed it
export const filled = (text: string, values: Record<string, string | number>) =>
    text.replace(/\{(\w+)\}/g, (all, name: string) =>
        name === 'tool'
            ? ORBIT_TOOL
            : name in values
              ? String(values[name])
              : all,
    );
export const tickSentence = (texts: OrbitTexts, n: number) =>
    texts.tick === undefined ? undefined : filled(texts.tick, { n });
const PLAN_STALE_TEXT = 'stale: set it again';
export const LANE_STALE_TEXT = `lane {id} «{title}» moved nothing for {n} of your turns, stale: step it or end it through ${ORBIT_TOOL} op glide.`;
// what this session was last told of its orbit and its stale lanes, in process memory as `isPrimed` is: the same state
// adds no line to the next prompt (FRM-640: a sentence on every prompt piled into the history). a compaction, a /clear
// or a resume drops what was told, so the state prints once again; a value kept by session id would outlive all three
export let toldOrbit: string | undefined;
export const toldStaleLanes = new Set<string>();
// what the last prompt told: an orbit note told once stays quiet until it changes, a stale lane until it moves
export function toldOrbitAs(key: string | undefined) {
    toldOrbit = key;
}
export function toldStaleAs(keys: string[]) {
    toldStaleLanes.clear();
    for (const key of keys) toldStaleLanes.add(key);
}
export function forgetTold() {
    toldOrbit = undefined;
    toldStaleLanes.clear();
}
// the orbit note of a prompt, only when the state differs from `told`: the open ask ids and whether the plan is unset,
// set or stale, never its age, which moves every turn; an orbit that never held an ask or a plan says nothing
export function orbitReminder(
    o: StashOrbit,
    isOn: IsPartOn,
    told: string | undefined,
    staleText = PLAN_STALE_TEXT,
) {
    const open = o.asks.filter((a) => !a.isResolved);
    const isPhasesOn = isOn('stash.phases');
    const age = isPhasesOn ? planAge(o) : undefined;
    const state = !isPhasesOn
        ? 'off'
        : age === undefined
          ? 'none'
          : age >= STALE_TURNS
            ? 'stale'
            : 'set';
    const plan = {
        none: '; no plan set',
        off: '',
        set: '; plan set',
        stale: `; plan set ${age} turns ago, ${filled(staleText, { n: age ?? 0 })}`,
    }[state];
    const key = `${open.map((a) => a.id).join(',')}|${state}`;
    if (
        key === told ||
        (told === undefined && !open.length && age === undefined)
    )
        return { key, line: undefined };
    const asks = open.length
        ? `orbit holds ${open.length} open ask${open.length === 1 ? '' : 's'} (${open.map((a) => a.id).join(', ')})`
        : 'orbit holds no open ask';
    return { key, line: `${asks}${plan}.` };
}
// the one reply shape while no board reaches dima — 📱 mobile mode, where mods draw nothing, or 🪐 orbit switched off —
// the same text either way (dima's o162); x:mobile-mode keeps only its phone bits and points here
export function noBoardReminder(o: StashOrbit, isOn: IsPartOn) {
    const open = o.asks.filter((a) => !a.isResolved);
    const ids = open.length ? ` (${open.map((a) => a.id).join(', ')})` : '';
    // the phases are gone off the board too: the plan's next 3 moves print under the fence (dima's o112, 2026-10-11)
    const isPhasesOn = isOn('stash.phases');
    const age = planAge(o);
    const stale =
        isPhasesOn && age !== undefined && age >= STALE_TURNS
            ? ` the plan is stale, untouched ${age} turns: set it again through ${ORBIT_TOOL}.`
            : '';
    const moves = isPhasesOn
        ? ", then «🌔 next:» and the plan's next 3 moves as bullets"
        : '';
    return `no board reaches dima: end the reply with the asks fence, «⏳ waiting on your word:», every open orbit ask${ids} with its id and pick, and each new ask as one ➡️ line${moves}. his answers come back in his prompt; resolve the ones he answered by id through ${ORBIT_TOOL} while 🪐 orbit is switched on.${stale}`;
}
