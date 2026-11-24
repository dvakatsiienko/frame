// a lane's health at a glance, per lane (FRM-693, grown for PK-349:W2046–W2058): are the running chunk and the one ahead of it
// ready (a lane with no running chunk: its first two queued), and does it have a member to run them? a lane parks into a chunk
// nobody sealed, and the idle alarm only rings after the stall
// usage: node sealed-ahead.ts [--lanes mods herdr speak] [--json]    (no names: every lane with a member or a signed chunk queued)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// x brief preflight's own words for a sealed spec whose recorded hash trails the ticket's newest sign
const RESEAL_TEXT = 'sync the section to the re-sign';
const STARTED_TEXT = 'main already carries a commit for';
const CLOSED_STATES = ['Canceled', 'Done', 'Duplicate'];
const RUN_TIMEOUT_MS = 60_000;
// siesta-checks' NOT_CHECKED: a read that failed, never «ready»
const NOT_CHECKED = 2;
const MOVE_RESIGN = 're-sign (clio)';
const MOVE_SEAL = 'seal (clio)';
const MOVE_SUMMON = 'summon (clio)';
// a ticket's `repo:` line names where its brief preflight runs, under home; no line means frame
const AHEAD_REPOS: Record<string, string | undefined> = {
    bytes: 'projects/bytes',
    frame: 'frame',
};
// a lane whose linear project is not its own name
const LANE_PROJECTS: Record<string, string | undefined> = {
    herdr: 'mods: herdr',
    mods: 'mods: cc',
};

// exit 0 every lane ready, 1 a move is owed, 2 a read failed so a lane is not checked: only 0 is «ready». `signs` are the
// signed chunks anywhere in the area whose sign trails their body, under the lanes; one already a lane's slot is left out, its
// lane holds the move
export function sealedAhead(lanes: LaneAhead[], signs: SignIssue[] = []) {
    const rows = lanes.map(laneRow);
    const inSlots = new Set(
        lanes.flatMap((l) => ('slots' in l ? l.slots : [])).map((a) => a?.id),
    );
    const owed = signs
        .filter((t) => !inSlots.has(t.id))
        .map((t) => ({
            id: t.id,
            line: `🔴 ${t.id} (${t.sign}) — ${MOVE_RESIGN}, or a ✏️ changed line before dispatch`,
            move: MOVE_RESIGN,
            sign: t.sign,
        }));
    const unchecked = rows.some((r) => r.unchecked);
    return {
        exit: unchecked
            ? NOT_CHECKED
            : rows.some((r) => r.red) || owed.length
              ? 1
              : 0,
        lanes: rows,
        lines: lanes.length
            ? [...rows.map((r) => r.line), ...owed.map((o) => o.line)]
            : ['🟢 no lane', ...owed.map((o) => o.line)],
        signs: owed.map(({ id, move, sign }) => ({ id, move, sign })),
    };
}

function laneRow(lane: LaneAhead) {
    if ('failed' in lane)
        return {
            line: `🟡 ${lane.name} — not checked: ${lane.failed}`,
            name: lane.name,
            red: false,
            unchecked: true,
        };
    const slots = lane.slots.map((ticket) => ({
        moves: slotMoves(ticket),
        state: aheadState(ticket),
        ticket,
    }));
    // a running chunk has no signed label, so only its stale seal is read, never its slot moves
    const reseal = lane.running?.isStale ? lane.running : null;
    const text = [
        ...(reseal ? [`running ${reseal.id} reseal`] : []),
        ...slots.map(
            (s, i) => `${i + 1} ${s.ticket ? `${s.ticket.id} ` : ''}${s.state}`,
        ),
    ].join(' · ');
    const member = memberText(lane.member);
    const sealMoves = reseal ? [MOVE_SEAL] : [];
    // a lane with no member is not red: its move rides along, the halt summons it at boot
    const moves = [
        ...sealMoves,
        ...slots.flatMap((s) => s.moves),
        ...(lane.member.kind === 'none' ? [MOVE_SUMMON] : []),
    ];
    const owed = [...new Set([...sealMoves, ...slots.flatMap((s) => s.moves)])];
    return {
        line: `${owed.length ? '🔴' : '🟢'} ${lane.name} — ${text} · ${member}${owed.length ? ` — ${owed.join(', ')}` : ''}`,
        member,
        moves,
        name: lane.name,
        red: owed.length > 0,
        slots: slots.map((s) => ({
            id: s.ticket?.id ?? null,
            moves: s.moves,
            state: s.state,
        })),
        unchecked: false,
    };
}

// the open tickets a ticket blocks: a closed one is no chunk to queue
export function blockedIds(relations: Relation[] = []) {
    return relations
        .filter((r) => r.type === 'blocks' && !CLOSED_STATES.includes(r.state))
        .map((r) => r.id);
}

// the open tickets a ticket waits on, bar the ones named: the chain's own earlier links do not count
export function openBlockers(relations: Relation[] = [], bar: string[] = []) {
    return relations
        .filter(
            (r) =>
                r.type === 'blocked by' &&
                !CLOSED_STATES.includes(r.state) &&
                !bar.includes(r.id),
        )
        .map((r) => r.id);
}

// the next chunk among several: a sealed one, then a signed one, then an unsigned one, ties by lowest id
export function pickNext<T extends Ahead>(candidates: T[]): T | null {
    const rank = (c: Ahead) => (c.preflightOk ? 0 : c.signed ? 1 : 2);
    return (
        candidates.toSorted(
            (a, b) =>
                rank(a) - rank(b) ||
                a.id.localeCompare(b.id, undefined, { numeric: true }),
        )[0] ?? null
    );
}

// a sealed chunk whose first step already landed: preflight's only problems are its own commits on main
function isOnlyStarted(preflightError: string) {
    const problems = preflightError.split('\n').slice(1);
    return (
        problems.length > 0 && problems.every((p) => p.includes(STARTED_TEXT))
    );
}

// built and back in Todo: its last 🚀 has no ↩️ after it, so it waits on a look, never on a lane
export function isBuilt(ticket: Pick<AheadTicket, 'description' | 'state'>) {
    const lastDispatch = ticket.description.lastIndexOf('\n🚀 dispatched');
    return (
        ticket.state === 'Todo' &&
        lastDispatch !== -1 &&
        !ticket.description.includes('\n↩️', lastDispatch)
    );
}

function aheadState(ticket: Ahead | null): string {
    if (!ticket) return 'none queued';
    if (ticket.blockedBy) return `blocked by ${ticket.blockedBy}`;
    if (ticket.signed && ticket.drifted) return 'drifted';
    if (ticket.preflightOk) return 'sealed';
    if (ticket.preflightError.includes(RESEAL_TEXT)) return 'reseal';
    return ticket.signed ? 'signed, not sealed' : 'unsigned';
}

// every move a slot still owes, its owner in the words (the skill walking `--json` hands each to its owner): a chunk both
// blocked and drifted owes both
function slotMoves(ticket: Ahead | null) {
    if (!ticket) return ['queue one (clio)'];
    const moves: string[] = [];
    if (ticket.blockedBy) moves.push('unblock (clio)');
    if (ticket.signed && ticket.drifted) moves.push(MOVE_RESIGN);
    else if (!ticket.preflightOk)
        moves.push(ticket.signed ? MOVE_SEAL : 'sign (clio)');
    return moves;
}

function memberText(member: Member) {
    if (member.kind === 'live') return `member live ${member.name}`;
    if (member.kind === 'parked')
        return `member parked, handoff ${member.slug}`;
    return 'member none: summon at boot';
}

/* The reader: linear, the thread records and the handoff store; nothing here writes */

export function xRunner(home: string): XRun {
    return (args, mayFail = false) => {
        const out = spawnSync(path.join(home, '.local/bin/x'), args, {
            encoding: 'utf8',
            timeout: RUN_TIMEOUT_MS,
        });
        const envelope = parsed(out.stdout ?? '') as XEnvelope;
        if (typeof envelope.ok !== 'boolean' || (!envelope.ok && !mayFail))
            throw new Error(`x ${args.join(' ')}`);
        return envelope;
    };
}

export function readLaneAhead(
    home: string,
    names: string[] = [],
    x: XRun = xRunner(home),
) {
    const list = (team: string, flag: string[]) =>
        (
            x(['linear', 'list', '--team', team, ...flag]).data as {
                tickets: ListedTicket[];
            }
        ).tickets;
    const read = (id: string) => {
        const ticket = (
            x(['linear', 'read', id, '--relations']).data as {
                tickets?: AheadTicket[];
            }
        ).tickets?.[0];
        if (!ticket) throw new Error(`x linear read ${id}`);
        return ticket;
    };
    const signed = ['FRM', 'BYT'].flatMap((team) =>
        list(team, ['--label', 'signed']),
    );
    const signOf = new Map(signed.map((t) => [t.id, t.sign]));
    const seal = (id: string, bar: string[]): Ahead => {
        const t = read(id);
        const repo =
            AHEAD_REPOS[/^repo: *(\S+)/m.exec(t.description)?.[1] ?? 'frame'];
        if (!repo)
            throw new Error(
                `x brief preflight ${id}: its repo line names no repo`,
            );
        const { error, ok } = x(
            ['brief', 'preflight', '--repo', path.join(home, repo), id],
            true,
        );
        return {
            blockedBy: openBlockers(t.relations, bar)[0] ?? null,
            drifted: (signOf.get(id) ?? 'match') !== 'match',
            id,
            preflightError: error ?? '',
            preflightOk: ok === true || isOnlyStarted(error ?? ''),
            relations: t.relations ?? [],
            signed: t.labels.includes('signed'),
        };
    };
    // the chunk a ticket queues next: its open blocked tickets, one picked; one that waits on a sibling is behind it, so the
    // sibling comes first
    const nextOf = (relations: Relation[] | undefined, bar: string[]) => {
        const ids = blockedIds(relations);
        const chunks = ids.map((id) => seal(id, bar));
        const first = chunks.filter(
            (c) =>
                !openBlockers(c.relations, bar).some((id) => ids.includes(id)),
        );
        return pickNext(first.length ? first : chunks);
    };

    const running = ['FRM', 'BYT']
        .flatMap((team) => list(team, ['--state', 'In Progress']))
        .map((t) => read(t.id))
        .filter(
            (t) =>
                t.state === 'In Progress' &&
                !t.labels.includes('needs human') &&
                /^🚀 dispatched/m.test(t.description) &&
                t.description.split('\n')[0]?.trim() !== 'lane: main',
        );
    const members = readMembers(home);
    const lanes = names.length
        ? names
        : [
              ...new Set([
                  ...members.map((m) => m.lane),
                  ...signed
                      .filter((t) => t.stateType !== 'duplicate')
                      .map((t) => laneOfProject(t.project)),
              ]),
          ].toSorted();

    return lanes.map((name): LaneAhead => {
        try {
            return readLane(name);
        } catch (e) {
            return { failed: (e as Error).message, name };
        }
    });

    function readLane(name: string): LaneAhead {
        const project = LANE_PROJECTS[name] ?? name;
        const current = running.find((t) => t.project === project);
        // the running chunk's own chain first; a slot it leaves empty takes the area's next signed chunk
        // a parked chunk's own open blocker in its area was placed ahead of it, so it runs first
        const ahead = current
            ? pickNext(
                  openBlockers(current.relations, [])
                      .filter((id) => read(id).project === project)
                      .filter((id) => !isBuilt(read(id)))
                      .map((id) => seal(id, [])),
              )
            : null;
        const behind = current ? nextOf(current.relations, [current.id]) : null;
        const next = ahead ?? behind;
        // the running chunk and one ahead; a lane with none running keeps its first two queued
        const wanted = current ? [next] : [null, null];
        const taken = [current?.id, next?.id];
        const queue = wanted.some((s) => s === null)
            ? queuedChunks(
                  signed.filter(
                      (t) =>
                          t.project === project &&
                          t.stateType === 'unstarted' &&
                          !taken.includes(t.id),
                  ),
                  read,
                  seal,
              )
            : [];
        const slots = wanted.map((s) => s ?? queue.shift() ?? null);
        // a running chunk whose own seal trails the re-sign owes clio its reseal
        const runningRow = current
            ? {
                  id: current.id,
                  isStale: seal(current.id, []).preflightError.includes(
                      RESEAL_TEXT,
                  ),
              }
            : undefined;
        return {
            member: memberOf(name, members, x),
            name,
            ...(runningRow && { running: runningRow }),
            slots,
        };
    }
}

// an area's signed chunks in the queue's order: the lowest-id one waiting on nothing in the area, then the chain's next link
// (a chunk it blocks), else the lowest-id one that waits only on it; the second stays in the first's milestone
function queuedChunks(
    signed: ListedTicket[],
    read: (id: string) => AheadTicket,
    seal: (id: string, bar: string[]) => Ahead,
): Ahead[] {
    const tickets = signed.map((t) => read(t.id));
    const inArea = new Set(tickets.map((t) => t.id));
    const waits = (t: AheadTicket) =>
        openBlockers(t.relations).filter((id) => inArea.has(id));
    const byId = (a: AheadTicket, b: AheadTicket) =>
        a.id.localeCompare(b.id, undefined, { numeric: true });
    const first = tickets
        .filter((t) => waits(t).length === 0)
        .toSorted(byId)[0];
    if (!first) return [];
    const links = blockedIds(first.relations);
    const second = tickets
        .filter(
            (t) =>
                t.id !== first.id &&
                t.milestone === first.milestone &&
                waits(t).every((id) => id === first.id),
        )
        .toSorted(
            (a, b) =>
                Number(!links.includes(a.id)) - Number(!links.includes(b.id)) ||
                byId(a, b),
        )[0];
    return [
        seal(first.id, []),
        ...(second ? [seal(second.id, [first.id])] : []),
    ];
}

// the signed chunks not started whose sign is not `match` (drifted, none, stale): they need their re-sign before a dispatch,
// whatever slot or milestone they sit in; with lane names, only those lanes' areas
export function readSignIssues(
    home: string,
    names: string[] = [],
    x: XRun = xRunner(home),
): SignIssue[] {
    const projects = names.map((n) => LANE_PROJECTS[n] ?? n);
    return ['FRM', 'BYT']
        .flatMap(
            (team) =>
                (
                    x(['linear', 'list', '--team', team, '--label', 'signed'])
                        .data as { tickets: ListedTicket[] }
                ).tickets,
        )
        .filter(
            (t) =>
                t.stateType === 'unstarted' &&
                t.sign !== 'match' &&
                (!projects.length || projects.includes(t.project)),
        )
        .map((t) => ({ id: t.id, sign: t.sign }));
}

function laneOfProject(project: string) {
    return (
        Object.entries(LANE_PROJECTS).find(([, p]) => p === project)?.[0] ??
        project
    );
}

function readMembers(home: string): ThreadMember[] {
    const file = path.join(home, '.claude/shelf/threads.json');
    if (!existsSync(file)) return [];
    const threads = (parsed(readFileSync(file, 'utf8')).threads ??
        []) as ThreadRecord[];
    const sessions = path.join(home, '.claude/sessions');
    const alive = new Set(
        existsSync(sessions)
            ? readdirSync(sessions)
                  .filter((f) => /^\d+\.json$/.test(f))
                  .flatMap((f) => {
                      const s = parsed(
                          readFileSync(path.join(sessions, f), 'utf8'),
                      ) as { pid?: number; sessionId?: string };
                      return s.pid && s.sessionId && isAlive(s.pid)
                          ? [s.sessionId]
                          : [];
                  })
            : [],
    );
    return threads
        .filter((t) => t.role === 'codie' && t.area && t.area !== 'stray')
        .map((t) => ({
            isLive: alive.has(t.sessionId),
            lane: t.area ?? '',
            name: t.lane ?? t.area ?? '',
        }));
}

function memberOf(name: string, members: ThreadMember[], x: XRun): Member {
    const live = members.find((m) => m.lane === name && m.isLive);
    if (live) return { kind: 'live', name: live.name };
    const slug = (
        (
            x(['handoff', 'list', '--for', 'codie']).data as
                | { entries?: { slug: string }[] }
                | undefined
        )?.entries ?? []
    ).find((e) => e.slug === name || e.slug.startsWith(`${name}-`))?.slug;
    return slug ? { kind: 'parked', slug } : { kind: 'none' };
}

function isAlive(pid: number) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function parsed(text: string): Record<string, unknown> {
    try {
        const value = JSON.parse(text) as unknown;
        return value && typeof value === 'object'
            ? (value as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

// the lane names after `--lanes`, up to the next flag
export function lanesArg(args: string[]) {
    const at = args.indexOf('--lanes');
    return at < 0 ? [] : args.slice(at + 1).filter((a) => !a.startsWith('--'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    try {
        const names = lanesArg(args);
        const out = sealedAhead(
            readLaneAhead(homedir(), names),
            readSignIssues(homedir(), names),
        );
        console.log(
            args.includes('--json')
                ? JSON.stringify(out)
                : out.lines.join('\n'),
        );
        process.exitCode = out.exit;
    } catch (e) {
        console.log(
            `🟡 ${(e as Error).message} failed, the lanes are not checked`,
        );
        process.exitCode = NOT_CHECKED;
    }
}

/* Types */

export type Ahead = {
    blockedBy: string | null;
    drifted: boolean;
    id: string;
    preflightError: string;
    preflightOk: boolean;
    relations?: Relation[];
    signed: boolean;
};

export type Relation = { id: string; state: string; type: string };

export type Member =
    | { kind: 'live'; name: string }
    | { kind: 'none' }
    | { kind: 'parked'; slug: string };

export type LaneAhead =
    | { failed: string; name: string }
    | {
          member: Member;
          name: string;
          running?: { id: string; isStale: boolean };
          slots: (Ahead | null)[];
      };

export type SignIssue = { id: string; sign: string };

export type XRun = (args: string[], mayFail?: boolean) => XEnvelope;

type ListedTicket = {
    id: string;
    project: string;
    sign: string;
    stateType: string;
};

type AheadTicket = {
    description: string;
    id: string;
    labels: string[];
    milestone?: string | null;
    project: string;
    relations?: Relation[];
    state: string;
};

type ThreadRecord = {
    area?: string;
    lane?: string;
    role?: string;
    sessionId: string;
};

type ThreadMember = { isLive: boolean; lane: string; name: string };

export type XEnvelope = { data?: unknown; error?: string; ok?: boolean };
