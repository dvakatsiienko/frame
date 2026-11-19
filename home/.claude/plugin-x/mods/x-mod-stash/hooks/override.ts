import type { EngineInterface } from 'claude-code';

// the operator override: dima's 🔓 grant in the fleet's store, which x, the guard and this mod all read; this module is
// the mod's one reader and writer of it, the path read once a process
const state: { isOn: boolean; store?: string } = { isOn: false };

export const isOverrideOn = () => state.isOn;

export function setOverrideOn(isOn: boolean) {
    state.isOn = isOn;
}

// twin operator-override-store — a copy lives in x-mod-guard; x/go/operator_override.go reads the same store
const RFC3339 = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:\d\d)$/;
async function overrideStorePath($: EngineInterface) {
    const record = await $.process.run(['id', '-P']).catch(() => undefined);
    const home = record?.exitCode === 0 ? record.stdout.split(':')[8] : '';
    return home?.startsWith('/')
        ? `${home}/.local/state/x/operator-override.json`
        : undefined;
}

async function overrideGrantAt(
    $: EngineInterface,
    path: string,
    scope: string,
    session = '',
) {
    const raw = await $.fs.read(path).catch(() => undefined);
    if (raw === undefined) return undefined;
    try {
        const grants: unknown = JSON.parse(raw);
        if (typeof grants !== 'object' || Array.isArray(grants))
            return undefined;
        // go reads the whole map into one shape, so one bad scope reads every scope off
        for (const g of Object.values(grants ?? {}) as unknown[]) {
            if (g === null) continue;
            if (typeof g !== 'object' || Array.isArray(g)) return undefined;
            const { at, by, until } = g as Record<string, unknown>;
            for (const field of [at, by, until])
                if (field != null && typeof field !== 'string')
                    return undefined;
        }
        const grant = (
            grants as Record<
                string,
                { at?: string; by?: string; until?: string } | null
            > | null
        )?.[session ? `${scope}:${session}` : scope];
        if (!grant?.by) return undefined;
        if (grant.until) {
            if (!RFC3339.test(grant.until)) return undefined;
            if (!(Date.parse(grant.until) > (await $.clock.now())))
                return undefined;
        }
        return { at: grant.at ?? '', by: grant.by, scope };
    } catch {
        return undefined;
    }
}
// the store after an ask. a shift's start leaves his own word standing, so its end can't take it
function overrideAfter(
    grants: Record<string, { at: string; by: string; until?: string }>,
    ask: { by: string; scope: 'off' | 'prs' },
    at: string,
) {
    if (ask.scope === 'off') return {};
    if (ask.by === 'shift' && grants.prs) return grants;
    return { ...grants, prs: { at, by: ask.by } };
}
// twin end

type OverrideGrants = Parameters<typeof overrideAfter>[0];

// herdr's 🔓 press, fleet-wide: «on» is the state he asked, held until he presses off (o95, o103); the newest press
// counts only when the store has not been written since, so his typed word or x after it wins
const BAND_SETTINGS = 'band-settings.json';
const OVERRIDE_WINDOW_MS = 2 * 60 * 60 * 1000;
export async function takeOverridePress(
    $: EngineInterface,
    home: string,
    press: { at: number; on: boolean },
) {
    state.store ??= (await overrideStorePath($)) ?? '';
    if (!state.store) return;
    const stat = await $.fs.stat(state.store).catch(() => undefined);
    if (stat && stat.mtimeMs >= press.at) return;
    const raw = stat ? await $.fs.read(state.store).catch(() => '{}') : '{}';
    let grants: OverrideGrants = {};
    try {
        grants = JSON.parse(raw) as OverrideGrants;
    } catch {}
    const next: OverrideGrants = overrideAfter(
        grants,
        press.on ? { by: 'band', scope: 'prs' } : { by: 'band', scope: 'off' },
        new Date(press.at).toISOString(),
    );
    // on until off unless his band setting asks for a 2 h window (dima 23:10, o111)
    const settings = await $.fs
        .read(`${home}/.claude/shelf/${BAND_SETTINGS}`)
        .then((t) => JSON.parse(t) as { overrideWindow?: unknown })
        .catch(() => undefined);
    if (press.on && next.prs && settings?.overrideWindow === '2h')
        next.prs.until = new Date(press.at + OVERRIDE_WINDOW_MS).toISOString();
    const after = JSON.stringify(next);
    if (after !== raw) await $.fs.write(state.store, after);
}

// the path comes once a process, the id spawn being the cost; every poll after it is one file read
export async function readOverrideOn($: EngineInterface) {
    state.store ??= (await overrideStorePath($)) ?? '';
    state.isOn = state.store
        ? (await overrideGrantAt($, state.store, 'prs')) !== undefined
        : false;
}

// the band's 🔓 off press: the store emptied, and the band reads off at once
export async function writeOverrideOff($: EngineInterface) {
    state.isOn = false;
    state.store ??= await overrideStorePath($);
    if (!state.store) throw new Error('no user record to read');
    await $.fs.write(state.store, '{}');
}
