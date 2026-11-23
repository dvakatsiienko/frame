// a lane's health at a glance, per lane (FRM-693, grown for PK-349:W2046–W2058): are the next two chunks behind it ready,
// and does it have a member to run them? a lane parks into a chunk nobody sealed, and the idle alarm only rings after the stall
// usage: node sealed-ahead.ts [--lanes mods herdr speak] [--json]    (no names: every lane with a member or a signed chunk queued)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// x brief preflight's own words for a sealed spec whose recorded hash trails the ticket's newest sign
const RESEAL_TEXT = 'sync the section to the re-sign';
const CLOSED_STATES = ['Canceled', 'Done', 'Duplicate'];
const RUN_TIMEOUT_MS = 60_000;
// siesta-checks' NOT_CHECKED: a read that failed, never «ready»
const NOT_CHECKED = 2;
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

// exit 0 every lane ready, 1 a move is owed, 2 a read failed so a lane is not checked: only 0 is «ready»
export function sealedAhead(lanes: LaneAhead[]) {
    if (!lanes.length) return { exit: 0, lanes: [], lines: ['🟢 no lane'] };
    const rows = lanes.map(laneRow);
    const unchecked = rows.some((r) => r.unchecked);
    return {
        exit: unchecked ? NOT_CHECKED : rows.some((r) => r.red) ? 1 : 0,
        lanes: rows,
        lines: rows.map((r) => r.line),
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
        state: aheadState(ticket),
        ticket,
    }));
    const text = slots
        .map(
            (s, i) => `${i + 1} ${s.ticket ? `${s.ticket.id} ` : ''}${s.state}`,
        )
        .join(' · ');
    const owed = slots.filter((s) => s.state !== 'sealed');
    const member = memberText(lane.member);
    const moves = owed.map((s) => moveOf(s.state));
    return {
        line: `${owed.length ? '🔴' : '🟢'} ${lane.name} — ${text} · ${member}${moves[0] ? ` — ${moves[0]}` : ''}`,
        member,
        moves,
        name: lane.name,
        red: owed.length > 0,
        slots: slots.map((s) => ({ id: s.ticket?.id ?? null, state: s.state })),
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

function aheadState(ticket: Ahead | null): string {
    if (!ticket) return 'none queued';
    if (ticket.blockedBy) return `blocked by ${ticket.blockedBy}`;
    if (ticket.signed && ticket.drifted) return 'drifted';
    if (ticket.preflightOk) return 'sealed';
    if (ticket.preflightError.includes(RESEAL_TEXT)) return 'reseal';
    return ticket.signed ? 'signed, not sealed' : 'unsigned';
}

// whose move turns each state green: the owner is in the words, the skill walking `--json` hands each to its owner
function moveOf(state: string) {
    if (state.startsWith('blocked by ')) return 'unblock (clio)';
    return (
        {
            drifted: 're-sign (dima)',
            'none queued': 'queue one (clio)',
            reseal: 'seal (clio)',
            'signed, not sealed': 'seal (clio)',
            unsigned: 'sign (dima)',
        }[state] ?? ''
    );
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
            drifted: signOf.get(id) === 'drifted',
            id,
            preflightError: error ?? '',
            preflightOk: ok === true,
            relations: t.relations ?? [],
            signed: t.labels.includes('signed'),
        };
    };
    // the chunk a ticket queues next: its open blocked tickets, one picked
    const nextOf = (relations: Relation[] | undefined, bar: string[]) =>
        pickNext(blockedIds(relations).map((id) => seal(id, bar)));

    const running = ['FRM', 'BYT']
        .flatMap((team) => list(team, ['--state', 'In Progress']))
        .map((t) => read(t.id))
        .filter(
            (t) =>
                t.state === 'In Progress' &&
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
        const next = current ? nextOf(current.relations, [current.id]) : null;
        const after =
            current && next
                ? nextOf(next.relations, [current.id, next.id])
                : null;
        const taken = [current?.id, next?.id, after?.id];
        const queue = [next, after].some((s) => s === null)
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
        const slots = [next, after].map((s) => s ?? queue.shift() ?? null);
        return { member: memberOf(name, members, x), name, slots };
    }
}

// an area's signed chunks in the queue's order (a blocker first, then the lowest id): the first two of the first one's milestone
function queuedChunks(
    signed: ListedTicket[],
    read: (id: string) => AheadTicket,
    seal: (id: string, bar: string[]) => Ahead,
): Ahead[] {
    const tickets = signed.map((t) => read(t.id));
    const ids = new Set(tickets.map((t) => t.id));
    const ordered = tickets.toSorted(
        (a, b) =>
            Number(openBlockers(a.relations).some((id) => ids.has(id))) -
                Number(openBlockers(b.relations).some((id) => ids.has(id))) ||
            a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
    const milestone = ordered[0]?.milestone;
    const first = ordered.filter((t) => t.milestone === milestone).slice(0, 2);
    return first.map((t, i) =>
        seal(t.id, i === 1 && first[0] ? [first[0].id] : []),
    );
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
        const out = sealedAhead(readLaneAhead(homedir(), lanesArg(args)));
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
    | { member: Member; name: string; slots: (Ahead | null)[] };

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
