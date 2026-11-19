import type { EngineInterface, EventOf } from 'claude-code';

import type { StashMeter } from '../types/stash.d.ts';
import { thresholdOf } from './look.ts';
import { currentId, identity, procNow } from './session-identity.ts';
import { errorText } from './util.ts';

// the 5h usage mirror every fleet reader takes, this session's context fill, and the band's meter: the one writer of
// cc-usage-window.json, store `context:` and `$.state` meter

export const CONTEXT = 'context:';
// the band's meters, written on every session.measure
const METER = { key: 'meter', plugin: 'x-mod-stash' } as const;
// the fill the band and every board draw, undefined drawing none
export async function drawFill($: EngineInterface, fill: number | undefined) {
    const sid = await currentId($);
    if (sid)
        await (fill === undefined
            ? $.store.delete(CONTEXT + sid)
            : $.store.set(CONTEXT + sid, fill));
    const was = (await $.state.get(METER)).value;
    if (was) await $.state.set(METER, { ...was, context: fill });
}

// estimated locally from what the window holds now, no request
export async function drawFillAfterCompact($: EngineInterface) {
    const usage = await $.session
        .usage({ breakdown: 'summary' })
        .catch(() => undefined);
    const tokens = usage?.context.breakdown?.totalTokens;
    const window = usage?.context.window;
    await drawFill(
        $,
        tokens && window ? Math.round((tokens / window) * 100) : undefined,
    );
}
// the usage file every session shares, undefined until a turn wrote one
export async function usageFile($: EngineInterface) {
    const raw = await $.fs
        .read(`${await $.env.get('HOME')}/.claude/shelf/cc-usage-window.json`)
        .catch(() => undefined);
    return raw
        ? (JSON.parse(raw) as {
              rate_limits?: {
                  five_hour?: {
                      used_percentage?: unknown;
                      resets_at?: unknown;
                  } | null;
              };
              written_at?: unknown;
          })
        : undefined;
}

export async function paceMeterOf($: EngineInterface) {
    const file = await usageFile($);
    const five = file?.rate_limits?.five_hour;
    if (
        typeof five?.used_percentage !== 'number' ||
        typeof five.resets_at !== 'number' ||
        typeof file?.written_at !== 'number'
    )
        return undefined;
    return {
        now: await $.clock.now(),
        resetsAt: five.resets_at * 1000,
        used: five.used_percentage,
        writtenAt: file.written_at * 1000,
    };
}
// the rate-limit mirror every fleet reader takes (clio's boot, the designer), in sline's old shape: seconds, and
// `null` for a window the response did not report; this mod is its one writer
export async function saveUsage(
    $: EngineInterface,
    limits: { kind: string; percentUsed: number; resetsAt?: string }[],
) {
    const window = (kind: string) => {
        const w = limits.find((l) => l.kind === kind);
        return w
            ? {
                  resets_at: w.resetsAt
                      ? Math.round(Date.parse(w.resetsAt) / 1000)
                      : null,
                  used_percentage: w.percentUsed,
              }
            : null;
    };
    await $.fs.write(
        `${await $.env.get('HOME')}/.claude/shelf/cc-usage-window.json`,
        JSON.stringify({
            rate_limits: {
                five_hour: window('five_hour'),
                seven_day: window('seven_day'),
            },
            written_at: Math.round((await $.clock.now()) / 1000),
        }),
    );
}

// an idle band stays live: every session shares one 5h window, so the usage file any busy session writes carries its
// latest reading, and the minute moves the time left; written only when one of the two changed
export async function freshMeter($: EngineInterface) {
    const was = (await $.state.get(METER)).value ?? {};
    const window = (await usageFile($))?.rate_limits?.five_hour;
    const fiveHour =
        typeof window?.used_percentage === 'number'
            ? {
                  resetsAt:
                      typeof window.resets_at === 'number'
                          ? window.resets_at * 1000
                          : undefined,
                  used: window.used_percentage,
              }
            : was.fiveHour;
    const next = {
        ...was,
        fiveHour,
        minute: Math.floor((await $.clock.now()) / 60_000),
    };
    if (JSON.stringify(next) !== JSON.stringify(was))
        await $.state.set(METER, next);
}

// the engine's own compaction point as a % of the window, whatever set it: the project's override, or cc's default
async function compactAtOf($: EngineInterface, window: number) {
    // the override as cc resolves it for this session: the settings merged for its project (clio's 70 sits in
    // ~/frame/_clio/.claude/settings.json), then the process env; the engine's breakdown reports its default either way
    const merged = await $.settings.read().catch(() => undefined);
    const set =
        (typeof merged?.env === 'object' && merged.env
            ? (merged.env as Record<string, unknown>)
                  .CLAUDE_AUTOCOMPACT_PCT_OVERRIDE
            : undefined) ??
        (await $.env.get('CLAUDE_AUTOCOMPACT_PCT_OVERRIDE'));
    const override = Number(set);
    if (set !== undefined && Number.isInteger(override) && override > 0)
        return override;
    const usage = await $.session
        .usage({ breakdown: 'summary' })
        .catch(() => undefined);
    const tokens = usage?.context.breakdown?.autoCompactThreshold;
    return tokens && window ? Math.round((tokens / window) * 100) : undefined;
}

// a typed compaction point: a whole 10–99 goes into the launch dir's .claude settings `env`, keeping every
// other key; anything else, or a file that is not json, leaves the file alone and says why in one line
// typing saves each valid value as it lands; a half-typed one («8» on the way to «85») is skipped quietly, and only
// Enter names a refusal (dima, 23:31)
export async function setCompactAt(
    $: EngineInterface,
    text: string,
    isTyping = false,
) {
    const was = (await $.state.get(METER)).value ?? {};
    const keep = async (note?: string) =>
        $.state
            .set(METER, { ...((await $.state.get(METER)).value ?? {}), note })
            .catch(() => undefined);
    const typed = thresholdOf(text);
    if ('refusal' in typed) {
        // a refused text takes back the saves typing made on the way to it: «10» on the way to «100»
        const t = text.trim();
        while (
            compactTrail.length > 1 &&
            t.startsWith(String(compactTrail.at(-1)))
        )
            compactTrail.pop();
        const back = compactTrail.at(-1);
        if (back !== undefined && back !== was.compactAt)
            await setCompactAt($, String(back), true);
        if (isTyping) return;
        compactTrail = [];
        return keep(typed.refusal);
    }
    if (!compactTrail.length && was.compactAt !== undefined)
        compactTrail.push(was.compactAt);
    compactTrail = isTyping ? [...compactTrail, typed.value] : [];
    // the launch dir cc keeps in the registry is the project its settings resolve from; session.start's cwd can be a
    // later one (clio's read ~/frame while it launched in ~/frame/_clio, 2026-10-09)
    const launchPid = (await procNow($))?.pid;
    const launched = launchPid
        ? await $.fs
              .read(
                  `${await $.env.get('HOME')}/.claude/sessions/${launchPid}.json`,
              )
              .then((raw) => {
                  const { cwd } = JSON.parse(raw) as { cwd?: unknown };
                  return typeof cwd === 'string' && cwd ? cwd : undefined;
              })
              .catch(() => undefined)
        : undefined;
    const dir = launched ?? identity.projectDir;
    if (!dir) return keep('no project dir for this session');
    // a repo top's own settings.local.json outranks every subdir's, its shared settings.json does not (probed
    // 2026-10-10): the top writes the shared file, so a subdir session (clio in ~/frame/_clio) keeps its own value
    const root = (await $.session.repo().catch(() => undefined))?.root;
    const path = `${dir}/.claude/${dir === root ? 'settings.json' : 'settings.local.json'}`;
    let settings: Record<string, unknown> = {};
    if (await $.fs.exists(path)) {
        try {
            const parsed: unknown = JSON.parse(await $.fs.read(path));
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                return keep(`${path} is not a json object, left as it is`);
            settings = parsed as Record<string, unknown>;
        } catch {
            return keep(`${path} is not json, left as it is`);
        }
    }
    const env =
        settings.env && typeof settings.env === 'object'
            ? (settings.env as Record<string, unknown>)
            : {};
    await $.fs.write(
        path,
        `${JSON.stringify({ ...settings, env: { ...env, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: String(typed.value) } }, null, 2)}\n`,
    );
    await $.state
        .set(METER, { ...was, compactAt: typed.value, note: undefined })
        .catch(() => undefined);
}
// the compaction field's typing run: the value before it, then each value typing saved; Enter ends the run
let compactTrail: number[] = [];

// a measure's half the band and the fleet read: this session's fill, the shared usage file and the band's meter
export async function measureUsage(
    $: EngineInterface,
    e: EventOf['session.measure'],
) {
    const w = e.rateLimits.find((r) => r.kind === 'five_hour');
    const resetsAt = w?.resetsAt ? Date.parse(w.resetsAt) : undefined;
    const sid = await currentId($);
    if (sid && e.context.percent !== undefined)
        await $.store
            .set(CONTEXT + sid, e.context.percent)
            .catch(() => undefined);
    if (e.changed.includes('rateLimits') && e.rateLimits.length)
        await saveUsage($, e.rateLimits).catch((err) =>
            $.ui.log(`x-mod-stash: usage file not written: ${errorText(err)}`),
        );
    const was = (await $.state.get(METER)).value;
    const meter: StashMeter = {
        compactAt: e.changed.includes('context')
            ? ((await compactAtOf($, e.context.window)) ?? was?.compactAt)
            : was?.compactAt,
        context: e.context.percent,
        fiveHour: w ? { resetsAt, used: w.percentUsed } : was?.fiveHour,
        minute: was?.minute,
        note: was?.note,
    };
    // a write redraws the band, so only a reading that moved is written
    if (JSON.stringify(meter) !== JSON.stringify(was))
        await $.state.set(METER, meter).catch(() => undefined);
}

export async function meterNow($: EngineInterface) {
    return (await $.state.get(METER)).value;
}
