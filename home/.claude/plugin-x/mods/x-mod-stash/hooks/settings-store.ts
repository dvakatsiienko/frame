import type { EngineInterface } from 'claude-code';

import { PLAN_MAX } from './orbit.ts';
import { PACE_SETTINGS, windPairRefusal } from './pace.ts';
import { markActive } from './turn.ts';
import { WIND_ROWS, WIND_TEXT_EDITS } from './wind-store.ts';

// the 🎛️ settings: every switch, knob and part in one table each, their store keys, and the one reader and writer of each;
// herdr's settings rows join here as a second editor of the same store

// the board's colour MVP: one fleet-wide switch, `/board colour`, off by default (FRM-329)
const COLOUR = 'board-colour';
// the row's ctx meter as a ring (C) or the % with a thin bar under it (B): dima keeps both, a 🎛️ switch picks (10-13 17:00)
const CTX_RING_KEY = 'ctx-ring';
// `/board breathe`: the bars breathe idle too, while dima refines the look (2026-10-11 12:20); off by default, a try
const BREATH_PREVIEW = 'breath-preview';
// the 🎛️ knobs (FRM-391 slice 06), fleet-wide in stash's store like the switches: a missing key is the default
const BREATHE = 'breathe';
const BREATH_SPEED = 'breath-speed';
const PHASE_LINES = 'phase-lines';
const SPEAK_ASSUMED = 'speak-assumed';
// x-mod-guard reads this key from stash's store file: true drops its rewrite, hint and delegate notes, never a refusal
const GUARD_SILENT = 'guard-silent';
// quiet comms on or off, one switch for 🎛️ and `/quiet` alike; on by default, `off` is the revert (dima, 16:53)
export const QUIET_ON = 'quiet-comms';
// one switch per push kind, in 🎛️'s quiet card: a kind off holds like an untagged line
export const QUIET_KINDS = [
    {
        cost: "off: a member's question waits for clio's next turn",
        kind: 'ask',
        name: 'quietAsk',
    },
    {
        cost: "off: a finished chunk waits for clio's next turn, and a held [done] is not counted toward her due siesta",
        kind: 'done',
        name: 'quietDone',
    },
    {
        cost: "off: an [escalate] waits for clio's next turn, a stuck member's too",
        kind: 'escalate',
        name: 'quietEscalate',
    },
] as const;
export const SPEED = { max: 5, min: 0.1, of: 0.5 } as const;
const LINES = { isWhole: true, max: 7, min: 5 } as const;
// how long held member pings wait before the hidden idle append, in minutes (dima, 16:53: 10 by default, maybe 15)
const QUIET_WAIT = 'quiet-wait';
const WAIT = { max: 60, min: 1 } as const;
// every 🎛️ knob in one table: its store key and its default; a number knob its range too. a missing or broken value reads
// as the default, and every read and write goes through readSwitch, readNumber, flipKnob and setKnobNumber
export const SWITCHES = {
    always: { key: BREATH_PREVIEW, of: false },
    breathe: { key: BREATHE, of: true },
    colour: { key: COLOUR, of: false },
    quiet: { key: QUIET_ON, of: true },
    quietAsk: { key: 'quiet-ask', of: true },
    quietDone: { key: 'quiet-done', of: true },
    quietEscalate: { key: 'quiet-escalate', of: true },
    ring: { key: CTX_RING_KEY, of: true },
    silent: { key: GUARD_SILENT, of: false },
    speak: { key: SPEAK_ASSUMED, of: true },
} as const;
const settingOf = (key: keyof typeof PACE_SETTINGS) => ({
    key,
    of: PACE_SETTINGS[key].of,
    range: { max: PACE_SETTINGS[key].max, min: PACE_SETTINGS[key].min },
});
export const NUMBERS = {
    'hot-late': settingOf('hot-late'),
    'hot-minutes': settingOf('hot-minutes'),
    lines: { key: PHASE_LINES, of: PLAN_MAX, range: LINES },
    'pace-burn': settingOf('pace-burn'),
    'pace-over': settingOf('pace-over'),
    'pace-park': settingOf('pace-park'),
    'pace-stop': settingOf('pace-stop'),
    'pace-under': settingOf('pace-under'),
    quietWait: { key: QUIET_WAIT, of: 10, range: WAIT },
    speed: { key: BREATH_SPEED, of: SPEED.of, range: SPEED },
    'wind-at': settingOf('wind-at'),
    'wind-notice': settingOf('wind-notice'),
} as const;
export type SwitchName = keyof typeof SWITCHES;
export type NumberName = keyof typeof NUMBERS;
// the 🎛️ settings (FRM-391 slice 05): one show/hide switch per part, in the store every session reads and the poll
// re-reads, so a flip reaches every band within one poll; a missing key is shown
export const SHOWN = 'shown';
// the parts dima approved (o2, 2026-10-11 13:15), grouped by where they draw; a mod's own parts, so a new one joins here
export const PARTS = [
    { group: 'stash · band', key: 'stash.pace', label: '🔋 🪫 pace gap' },
    {
        group: 'stash · band',
        key: 'stash.reset',
        label: '⏳ time to the 5h reset',
    },
    { group: 'stash · band', key: 'stash.wait', label: '🔭 wait line' },
    { group: 'stash · band', key: 'stash.hot', label: '🔥 keep-hot' },
    { group: 'stash · band', key: 'stash.waker', label: '⏰ waker' },
    {
        group: 'stash · band',
        key: 'stash.pace-watch',
        label: '🔋 pace watch: all sessions',
    },
    { group: 'stash · band', key: 'stash.afk', label: '💨 afk' },
    { group: 'stash · band', key: 'stash.board', label: '🚦 board button' },
    { group: 'stash · band', key: 'stash.5h', label: '🔥 5h bar (desktop)' },
    { group: 'stash · band', key: 'stash.ctx', label: '🧠 ctx bar (desktop)' },
    { group: 'stash · board', key: 'stash.orbit', label: '🪐 orbit asks' },
    { group: 'stash · board', key: 'stash.joins', label: '💨 herdr joins' },
    {
        group: 'stash · board',
        key: 'stash.rounds',
        label: "a lane's round count and its stop line",
    },
    { group: 'stash · board', key: 'stash.assumed', label: 'assumed section' },
    { group: 'stash · board', key: 'stash.phases', label: '🌔 phases' },
    { group: 'stash · board', key: 'stash.glide', label: '🛼 glide' },
    {
        group: 'stash · board',
        key: 'stash.speak',
        label: '🔊 ⏯️ ⏹️ speak buttons',
    },
    {
        group: 'stash · board',
        key: 'stash.rowmeta',
        label: 'session rows: model, effort and wait',
    },
    {
        group: 'stash · board',
        key: 'stash.boot',
        label: '🥾 boot keeps going after a spawn',
    },
    {
        group: 'stash · board',
        key: 'stash.second-wind',
        label: '🐦‍🔥 second wind',
    },
    {
        group: 'stash · band',
        key: 'stash.second-wind-auto',
        label: '🍃 second wind auto',
    },
    {
        group: 'stash · replies',
        key: 'stash.bullets',
        label: '·-lists drawn as bullets',
    },
    {
        group: 'stash · replies',
        key: 'stash.boldwords',
        label: 'fleet words bold with their badge',
    },
    {
        group: 'stash · replies',
        key: 'stash.circled',
        label: '①②③ drawn as numbered lines',
    },
    {
        group: 'stash · replies',
        key: 'stash.tickets',
        label: 'bare ticket ids drawn as links',
    },
    {
        group: 'stash · replies',
        key: 'stash.waitaside',
        label: "a 🔭 line's (aside) dropped",
    },
    {
        group: 'stash · replies',
        key: 'stash.cost',
        label: '💵 cost questions read model-cards.md',
    },
] as const;
export type PartKey = (typeof PARTS)[number]['key'];
export type IsPartOn = (key: PartKey) => boolean;
// the 🎛️ part switches as this session last read them, and whether its 🎛️ pane is open; one owner, read through
// `settings`, changed through the functions below
const state: { isSettingsOpen: boolean; shown: Record<string, boolean> } = {
    isSettingsOpen: false,
    shown: {},
};
export const settings: Readonly<typeof state> = state;

export async function refreshShown($: EngineInterface) {
    state.shown = shownOf(await $.store.get(SHOWN).catch(() => undefined));
}

export function setSettingsOpen(isOpen: boolean) {
    state.isSettingsOpen = isOpen;
}

// herdr's settings rows (`~/.claude/shelf/herdr-settings/settings.json`, `{ rows, v }`), written by herdr alone: the one
// reader, called at each poll, so an edit there counts at the next read
export async function herdrRows($: EngineInterface, home: string) {
    const raw = await $.fs
        .read(`${home}/.claude/shelf/herdr-settings/settings.json`)
        .catch(() => undefined);
    try {
        const { rows } = JSON.parse(raw ?? '') as { rows?: unknown };
        return rows && typeof rows === 'object'
            ? (rows as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}
export async function herdrRow($: EngineInterface, home: string, key: string) {
    return (await herdrRows($, home))[key];
}

// the store's switches, any non-boolean dropped: a broken value never hides a part
export function shownOf(v: unknown): Record<string, boolean> {
    if (!v || typeof v !== 'object') return {};
    return Object.fromEntries(
        Object.entries(v).filter(([, on]) => typeof on === 'boolean'),
    );
}

// a part hidden in 🎛️ settings is off for the model too (dima, 10-12); read fresh, since another session may have
// flipped it since this one's poll
export async function partsShown($: EngineInterface): Promise<IsPartOn> {
    const now = shownOf(await $.store.get(SHOWN).catch(() => undefined));
    return (key) => now[key] !== false;
}

// the orbit ops a settings switch owns: hidden, the op is refused, so no session writes what nobody sees
const OP_PART: Partial<Record<string, PartKey>> = {
    add: 'stash.orbit',
    assume: 'stash.assumed',
    follow: 'stash.orbit',
    glide: 'stash.glide',
    plan: 'stash.phases',
    resolve: 'stash.orbit',
    'second-wind': 'stash.second-wind',
};
// 🪐 orbit switched off still leaves dima's asks somewhere: the reply (o152)
const ASKS_IN_REPLY =
    '🪐 orbit is switched off in 🎛️ settings: an ask for dima goes into the reply as one ➡️ line.';

export async function partRefusal($: EngineInterface, op: unknown) {
    const key = typeof op === 'string' ? OP_PART[op] : undefined;
    if (!key || (await partsShown($))(key)) return undefined;
    const label = PARTS.find((p) => p.key === key)?.label ?? key;
    return key === 'stash.orbit'
        ? `orbit ${op}: ${ASKS_IN_REPLY}`
        : `orbit ${op}: ${label} is switched off in 🎛️ settings; nothing to write`;
}

// herdr is a second editor of the 🎛️ store, never a second store (FRM-634 exit 3, FRM-625:W10): a row herdr changed since
// the last poll is written into the store, so the last edit wins on either side and a deleted herdr changes nothing. with
// no `herdr-seen` yet (a first poll, a reset store) the rows are only noted: nothing says they are newer than the 🎛️
// values. the two lines are judged as the pair herdr shows, and a refused pair is seen too, so it never lands later
// over a 🎛️ edit
const HERDR_SEEN = 'herdr-seen';
const HERDR_SWITCH_ROWS = [
    'stash.second-wind',
    'stash.second-wind-auto',
] as const;
const HERDR_NUMBER_ROWS = [
    ['stash.wind.must', 'wind-at'],
    ['stash.wind.notice', 'wind-notice'],
] as const;
export async function takeHerdrRows($: EngineInterface) {
    const home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
    const rows = await herdrRows($, home);
    const was = (await $.store.get(HERDR_SEEN).catch(() => undefined)) as
        | Record<string, unknown>
        | undefined;
    const seen = { ...was };
    for (const part of HERDR_SWITCH_ROWS) {
        const isOn = rows[part];
        if (typeof isOn !== 'boolean' || isOn === seen[part]) continue;
        seen[part] = isOn;
        if (!was) continue;
        const now = shownOf(await $.store.get(SHOWN).catch(() => undefined));
        await $.store.set(SHOWN, { ...now, [part]: isOn });
    }
    const lines = {
        'wind-at': await readNumber($, 'wind-at'),
        'wind-notice': await readNumber($, 'wind-notice'),
    };
    const fresh = HERDR_NUMBER_ROWS.flatMap(([row, name]) => {
        const n = numberOf(rows[row], NUMBERS[name].range);
        return n === undefined || n === seen[row] ? [] : [{ n, name, row }];
    });
    for (const { n, name, row } of fresh) {
        seen[row] = n;
        lines[name] = n;
    }
    if (was && !windPairRefusal(lines, 'wind-at', lines['wind-at']))
        for (const { n, name } of fresh)
            await $.store.set(NUMBERS[name].key, n);
    // a wind text typed in herdr is an edit of the second-wind store, as the door's is; one typed before the store
    // existed is taken once, a blank first read is only noted
    const texts: Record<string, string> = {};
    for (const row of WIND_ROWS) {
        const text = rows[row];
        if (typeof text !== 'string' || text === seen[row]) continue;
        if (seen[row] !== undefined || text.trim()) texts[row] = text;
        seen[row] = text;
    }
    if (Object.keys(texts).length)
        await $.store.set(WIND_TEXT_EDITS, {
            ...windEditsOf(await $.store.get(WIND_TEXT_EDITS)),
            ...texts,
        });
    // a row he typed in herdr is an event: the bookkeeping jobs tick at 4 s again
    if (was && JSON.stringify(seen) !== JSON.stringify(was))
        await markActive($);
    // an empty first read is a baseline too: the first row herdr writes after it is an edit
    if (!was || JSON.stringify(seen) !== JSON.stringify(was))
        await $.store.set(HERDR_SEEN, seen);
}

export const windEditsOf = (v: unknown): Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : {};

// re-read before the write: another session may have flipped a part since this one's poll
export async function flipPart(
    $: EngineInterface,
    key: string,
    redraw: () => Promise<void>,
) {
    const now = shownOf(await $.store.get(SHOWN).catch(() => undefined));
    state.shown = { ...now, [key]: now[key] === false };
    await $.store.set(SHOWN, state.shown);
    await redraw();
}

// a 🎛️ number knob's value: a whole or decimal number inside its range, else undefined — a half-typed «0.» or an out of
// range «8» on the way to nothing is never applied
function numberOf(
    v: unknown,
    range: { min: number; max: number; isWhole?: boolean },
) {
    const text =
        typeof v === 'number'
            ? String(v)
            : typeof v === 'string'
              ? v.trim()
              : '';
    if (!(range.isWhole ? /^\d+$/ : /^\d+(\.\d+)?$/).test(text))
        return undefined;
    const n = Number(text);
    return n >= range.min && n <= range.max ? n : undefined;
}

export async function readSwitch($: EngineInterface, name: SwitchName) {
    const v = await $.store.get(SWITCHES[name].key).catch(() => undefined);
    return typeof v === 'boolean' ? v : SWITCHES[name].of;
}

export async function readNumber($: EngineInterface, name: NumberName) {
    const { key, of, range } = NUMBERS[name];
    return numberOf(await $.store.get(key).catch(() => undefined), range) ?? of;
}

// the one door for every switch: a 🎛️ press and its slash command alike; the board's colour rides the view, so it
// republishes at once instead of at the next poll
export async function flipKnob(
    $: EngineInterface,
    name: SwitchName,
    redraw: () => Promise<void>,
) {
    const isOn = !(await readSwitch($, name));
    await $.store.set(SWITCHES[name].key, isOn);
    if (name === 'colour' || name === 'ring') await redraw();
    $.ui.invalidate('ui.render');
    return isOn;
}

// a wind number the notice-below-wind rule refused, by knob, with the rule's reason: drawn under its field until a value
// saves (FRM-583:W37 «it should show»)
export const knobRefusals = new Map<string, string>();
// a keystroke saves at once when it makes a valid value, and is never applied when it does not (exit 6)
export async function setKnobNumber(
    $: EngineInterface,
    name: NumberName,
    text: string,
) {
    const n = numberOf(text, NUMBERS[name].range);
    if (n === undefined) return;
    // the notice stays below the wind line, the rule mods:set holds too
    const lines = {
        'wind-at': await readNumber($, 'wind-at'),
        'wind-notice': await readNumber($, 'wind-notice'),
    };
    const refusal = windPairRefusal(lines, name, n);
    // a saved wind number settles the pair: the other field's reason quoted the old pair
    if (refusal) knobRefusals.set(name, refusal);
    else if (name in lines)
        for (const key of Object.keys(lines)) knobRefusals.delete(key);
    else knobRefusals.delete(name);
    if (!refusal) await $.store.set(NUMBERS[name].key, n);
    $.ui.invalidate('ui.render');
}
