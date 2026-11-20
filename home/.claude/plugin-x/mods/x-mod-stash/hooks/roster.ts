import type { EngineInterface } from 'claude-code';

import type { StashMember } from '../types/stash.d.ts';
import { ADVISER_ROLE, MAIN_ROLE } from './session-identity.ts';
import { STALE_MS, bare, short, text } from './util.ts';

// the fleet board: cc's registry gives each session's state; each session's stash adds its 🔭 wait and context fill
const BOARD = 'x-cc-deck';

// the fleet roster as cc's registry and x's thread records show it: who runs, who is a probe, who sits where; reads
// only, owns no file

// the registry names a short-lived headless run `t-` + hex (`t-70`); the board leaves those out (dima, 2026-10-05)
export const HEADLESS = /^t-[0-9a-f]+$/;
// a session younger than this, counted from the registry's `startedAt`, is a probe: it gets no row until it outlives it
export const SHORT_MS = 60_000;

export type Member = StashMember;

// `claude-opus-5-5` + `medium` reads «opus 5.5 · medium»; a dated or `[1m]` id drops its tail, an id off the pattern shows as written
export function modelLabel(model: string, effort?: string | number) {
    const m = model.match(
        /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?=$|-\d{8}|\[)/,
    );
    const name = m ? `${m[1]} ${m[2]}${m[3] ? `.${m[3]}` : ''}` : model;
    return effort === undefined ? name : `${name} · ${effort}`;
}

// the colour look, borrowed from the reference on FRM-329: calm by default, each member's dot its own hue, and a
// colour only where something is live — theme keys follow light and dark; orange stays the asks' alone
export type Registered = {
    pid: number;
    bg: boolean;
    isAlive: boolean;
    cwd?: string;
    startedAt?: number;
    // the desktop's own id for the session (`local_…`), which a peer's envelope or a link may carry
    hostId?: string;
    // remote control holds the session: the registry names its bridge
    isBridged?: boolean;
    base: Pick<Member, 'sid' | 'name' | 'status' | 'statusSince'>;
};

// a lane's member as the registry knows it now: by its name first — a /clear mints a new session id under the same
// name — the newest live one when two share it; else by its session id, an 8-char prefix of it, or its desktop id
// (clio's wisp, 18:01: a linked `local_` id and a /clear both left the subcard at «0 asks»)
export function memberOf(
    rows: Pick<Registered, 'base' | 'hostId' | 'isAlive' | 'startedAt'>[],
    member: string,
) {
    const live = rows.filter((r) => r.isAlive);
    const named = live
        .filter((r) => bare(r.base.name) === bare(member))
        .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))[0];
    return (
        named ??
        live.find(
            (r) =>
                r.base.sid === member ||
                r.hostId === member ||
                (member.length >= 8 && r.base.sid.startsWith(member)),
        )
    );
}

// a lane member's live row: the session its link named, followed through its /clears, so a rename after the link keeps
// it (FRM-605, the 14:55 replay); else the name the card keeps; none when neither finds a live session
export function laneMemberRow(
    rows: Pick<Registered, 'base' | 'hostId' | 'isAlive' | 'startedAt'>[],
    name: string | undefined,
    id?: string,
) {
    const linked =
        id &&
        rows.find((r) => r.isAlive && (r.base.sid === id || r.hostId === id));
    return linked || (name ? memberOf(rows, name) : undefined);
}

// cc's registry stores the black bird's zero-width joiner as a space: «🐦 ⬛ crow» for «🐦‍⬛ crow»
const SPLIT_CROW = '\u{1F426} \u{2B1B}';
const CROW = '\u{1F426}\u{200D}\u{2B1B}';

// every session in cc's registry and whether its process still runs; a registry file mid-write is skipped
export async function registry($: EngineInterface): Promise<Registered[]> {
    const dir = `${await $.env.get('HOME')}/.claude/sessions`;
    const rows: Omit<Registered, 'isAlive'>[] = [];
    for (const f of await $.fs.list(dir)) {
        if (!f.name.endsWith('.json')) continue;
        try {
            const v = JSON.parse(await $.fs.read(`${dir}/${f.name}`)) as Record<
                string,
                unknown
            >;
            if (typeof v.pid !== 'number' || typeof v.sessionId !== 'string')
                continue;
            const bg = v.kind === 'bg';
            rows.push({
                base: {
                    name:
                        text(v.name)?.replaceAll(SPLIT_CROW, CROW) ??
                        short(v.sessionId),
                    sid: v.sessionId,
                    status: text(v.status),
                    statusSince:
                        typeof v.statusUpdatedAt === 'number'
                            ? v.statusUpdatedAt
                            : undefined,
                },
                bg,
                cwd: text(v.cwd),
                hostId: text(v.hostSessionId),
                isBridged: Boolean(text(v.bridgeSessionId)),
                pid: v.pid,
                startedAt:
                    typeof v.startedAt === 'number' ? v.startedAt : undefined,
            });
        } catch {}
    }
    if (!rows.length) return [];
    // ps prints the pids still alive and skips the rest
    const ps = await $.process.run([
        'ps',
        '-o',
        'pid=',
        '-p',
        rows.map((r) => r.pid).join(','),
    ]);
    const alive = new Set(
        ps.stdout
            .split('\n')
            .map((s) => Number(s.trim()))
            .filter(Boolean),
    );
    return rows.map((r) => ({ ...r, isAlive: alive.has(r.pid) }));
}

// a session that never ran a turn has no transcript yet: the desktop's warm spares sit in the registry like this
// (clio-9a, 2026-10-09); a missing project folder keeps the row, since cc hashes the folder name of a long path
export async function isUnstarted(
    $: EngineInterface,
    home: string | undefined,
    cwd: string | undefined,
    sid: string,
) {
    if (!home || !cwd) return false;
    const dir = `${home}/.claude/projects/${cwd.replace(/[^a-zA-Z0-9]/g, '-')}`;
    return (
        (await $.fs.exists(dir).catch(() => false)) &&
        !(await $.fs.exists(`${dir}/${sid}.jsonl`).catch(() => true))
    );
}

// a session under a minute old is a probe, unless its transcript is older than its process: a resume, as every session
// is after a mac reboot (dima's ✨ wisp, 10-13 16:26: the card showed clio alone); FsStat has no birth time, so one
// `stat` asks, and only for a young row
export async function isResumed(
    $: EngineInterface,
    home: string | undefined,
    r: Registered,
) {
    if (!home || !r.cwd || r.startedAt === undefined) return false;
    const path = `${home}/.claude/projects/${r.cwd.replace(/[^a-zA-Z0-9]/g, '-')}/${r.base.sid}.jsonl`;
    const out = await $.process
        .run(['stat', '-f', '%B', path])
        .catch(() => undefined);
    const born = Number(out?.stdout.trim()) * 1000;
    return born > 0 && born < r.startedAt - SHORT_MS;
}

// crow's newest 👀 «for you» line from her notes file, written today, its bold stripped (PK-73, dima 14:16: «i'd like to
// see this note somewhere in a mod», the 👀 line only, no numbers); a past day's tip is stale even under 24 h (dima, 10-13),
// and her notes print the line with or without a leading bullet
const CROW_TIP = /^(?:- )?👀 \*\*for you:\*\*\s*(.+)$/mu;
export async function crowTip(
    $: EngineInterface,
    home: string | undefined,
    now: number,
) {
    const raw = await $.fs
        .read(`${home}/.local/state/crow/notes.jsonl`)
        .catch(() => '');
    for (const line of raw.trim().split('\n').reverse()) {
        try {
            const v = JSON.parse(line) as { at?: string; note?: unknown };
            const day = new Date(Date.parse(v.at ?? '')).toDateString();
            if (day !== new Date(now).toDateString()) return undefined;
            const tip =
                typeof v.note === 'string' && v.note.match(CROW_TIP)?.[1];
            if (tip) return tip.replaceAll('**', '').trim();
        } catch {}
    }
    return undefined;
}

// a probe mod left in `~/.claude/dev-mods/<session id>/` past its probe: a day old, or its session gone — a loaded
// probe keeps acting on live traffic (pk-93's qc-view swallowed clio's brief after its proof)
export async function staleProbes($: EngineInterface, now: number) {
    const dir = `${await $.env.get('HOME')}/.claude/dev-mods`;
    const held: { sid: string; mods: string[]; at: number }[] = [];
    for (const f of await $.fs.list(dir).catch(() => [])) {
        if (f.kind !== 'dir') continue;
        const mods = (
            await $.fs.list(`${dir}/${f.name}`).catch(() => [])
        ).filter((m) => m.kind === 'dir');
        if (mods.length)
            held.push({
                at: Math.max(...mods.map((m) => m.mtimeMs)),
                mods: mods.map((m) => m.name),
                sid: f.name,
            });
    }
    if (!held.length) return [];
    const live = new Set(
        (await registry($)).filter((r) => r.isAlive).map((r) => r.base.sid),
    );
    return held
        .filter((h) => now - h.at > STALE_MS || !live.has(h.sid))
        .flatMap((h) => h.mods.map((m) => `${m} (${short(h.sid)})`));
}

// a member with a chair in the fleet: x's thread record names its role, clio, a wing, crow and helga included
// (FRM-579); a fork or a plain session has none, whatever its name
export const isSeated = (role?: string) => Boolean(role);
// clio, then crow, then everyone else, the two pinned ones bold (dima, 2026-10-10), read by role, never by name
export const pinOf = (role?: string) =>
    role === MAIN_ROLE ? 0 : role === ADVISER_ROLE ? 1 : 2;

// undefined when the read fails: a failed read says nothing about the board (FRM-492)
export async function isOpen($: EngineInterface) {
    const panes = await $.ui.panes().catch(() => undefined);
    return panes?.some((p) => p.id === BOARD);
}
