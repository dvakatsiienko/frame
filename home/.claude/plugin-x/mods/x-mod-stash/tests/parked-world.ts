import type { On } from 'claude-code';
import type { Engine } from 'claude-code/testing';

import type { StashLane } from '../types/stash.d.ts';
import {
    EVEN,
    LANES,
    MIN,
    PID,
    SID,
    laneCard,
    start,
    world,
} from './quiet-helpers.ts';
import {
    THREADS_FILE,
    type ThreadRow,
    recordOf,
    threadsFile,
} from './threads.ts';

// clio's session running one lane card: each member's registry row, its last word and what its session keeps in the store
export type ParkedMember = {
    // when its transcript was last written, or ago in minutes before the world's start
    at?: number;
    ago?: number;
    name: string;
    pid: number;
    role: 'codie' | 'sixth-sense';
    sid: string;
    // what x wrote on its thread record past its role
    record?: {
        coordinator?: string;
        dispatchedAt?: number;
        lane?: string;
        role?: string;
    };
    // when its process started, in the registry
    startedAt?: number;
    status?: string;
    // what cc's registry says the session stands on, and since when
    statusUpdatedAt?: number;
    waitingFor?: string;
};
export const codie = (over: Partial<ParkedMember> = {}): ParkedMember => ({
    name: '⚡ 🔧 mods | FRM-1',
    pid: 781,
    role: 'codie',
    sid: 'cccc0001-codie',
    ...over,
});
export const sixth = (over: Partial<ParkedMember> = {}): ParkedMember => ({
    name: '⚡ 🔎 mods | FRM-1',
    pid: 782,
    role: 'sixth-sense',
    sid: 'ssss0001-sixth',
    ...over,
});
export const WORKING = { status: 'busy' } as const;
export const onDialog = (
    statusUpdatedAt: number,
    waitingFor = 'permission prompt',
) => ({ status: 'waiting', statusUpdatedAt, waitingFor });

const rowOf = ({ sid, status = 'idle', ...m }: ParkedMember) => ({
    name: m.name,
    pid: m.pid,
    sessionId: sid,
    startedAt: m.startedAt,
    status,
    statusUpdatedAt: m.statusUpdatedAt,
    waitingFor: m.waitingFor,
});
// `hc ls` names no pid, so each blocked terminal is asked for; t1 is somebody's own shell, at work
function herdrSays(
    herdr: Record<number, string> | null,
    argv: readonly string[],
) {
    if (!herdr) return 1;
    const pids = Object.keys(herdr).map(Number);
    if (argv[1] === 'ls')
        return JSON.stringify({
            hidden_finished: 0,
            terminals: [
                { address: 't1', agent: 'zsh', state: 'live', turn: 0 },
                ...pids.map((pid) => ({
                    address: `t${pid}`,
                    agent: 'claude-code',
                    state: 'live',
                    status: 'blocked',
                })),
            ],
        });
    const pid = pids.find((p) => `t${p}` === argv[2]);
    return pid === undefined
        ? 1
        : JSON.stringify({
              address: argv[2],
              foreground: { pid },
              pid: 1,
              status: {
                  app: 'claude-code',
                  kind: 'permission',
                  msg: herdr[pid],
                  state: 'blocked',
              },
          });
}

type Ticket = { description?: string; labels: string[] };
export function parkedWorld(
    on: On,
    members: ParkedMember[],
    {
        // a second card on the board, open beside the first
        also = undefined as object | undefined,
        card = {} as Partial<StashLane> | object,
        extraFiles = {} as Record<string, string>,
        handoffs = [] as string[],
        // what herdr answers for a blocked terminal, by the pid in it; null is a herdr that does not answer
        herdr = {} as Record<number, string> | null,
        // the clio's own name, a wing's too
        name = '🦉 clio',
        now = EVEN,
        // the read of who lives exits non-zero
        isPsDown = (): boolean => false,
        // peeks of the handoff that fail before one answers
        peeksDown = 0,
        // what a peek that finds no one handoff prints
        peekSays = 'no pending handoff matches',
        // live sessions in cc's registry beside the members: a wing
        sessions = [] as Record<string, unknown>[],
        store = {} as Record<string, unknown>,
        // thread records beside the members' and her own: a live wing
        threads = [] as ThreadRow[],
        tickets = {} as Record<string, Ticket>,
    } = {},
) {
    const peeks: string[] = [];
    const asked: string[] = [];
    const wrote = new Map(
        members.map((m) => [m.sid, m.at ?? now - (m.ago ?? 9) * MIN]),
    );
    const made = new Map(wrote);
    const ofMembers = {
        linkedIds: Object.fromEntries(members.map((m) => [m.role, m.sid])),
        members: Object.fromEntries(members.map((m) => [m.role, m.name])),
    };
    const files: Record<string, string> = {
        [THREADS_FILE]: threadsFile([
            { pid: PID, sessionId: SID, ...recordOf(name) },
            ...members.map(({ pid, record, role, sid }) => ({
                pid,
                role,
                sessionId: sid,
                ...record,
            })),
            ...threads,
        ]),
        ...extraFiles,
        [LANES]: JSON.stringify({
            lanes: [
                laneCard({ ...ofMembers, ...card }),
                ...(also
                    ? [laneCard({ ...ofMembers, ...also, id: 'l2' })]
                    : []),
            ],
        }),
    };
    const w = world(on, {
        files,
        name,
        now,
        peers: [...members.map(rowOf), ...sessions],
        run: (argv) => {
            if (argv[0] === 'ps' && isPsDown()) return 1;
            if (argv[0] === 'hc') {
                asked.push(argv.slice(1).join(' '));
                return herdrSays(herdr, argv);
            }
            if (argv[1] === 'handoff') {
                peeks.push(String(argv[3]));
                if (peeks.length <= peeksDown) throw new Error('timed out');
                return handoffs.includes(String(argv[3]))
                    ? ''
                    : { exitCode: 2, stdout: peekSays };
            }
            if (argv[1] === 'linear') {
                const id = String(argv[3]);
                return tickets[id]
                    ? JSON.stringify({
                          data: { tickets: [{ id, ...tickets[id] }] },
                          ok: true,
                      })
                    : 1;
            }
            const read = argv[2]?.includes('%B') ? made : wrote;
            const at = argv[0] === 'sh' ? read.get(String(argv[5])) : undefined;
            return at === undefined ? undefined : `${Math.floor(at / 1000)}\n`;
        },
    });
    w.store.set('quiet-wait', 60);
    for (const [key, value] of Object.entries(store)) w.store.set(key, value);
    const wakes = () =>
        w.submitted
            .filter((text) => text.startsWith('🅿️ parked lane: '))
            .map((text) => text.slice('🅿️ parked lane: '.length));
    // a turn of a member's own, ended at `at`
    const spoke = (sid: string, at: number) =>
        w.store.set(`reply:${sid}`, {
            ...(w.store.get(`reply:${sid}`) as object | undefined),
            at,
        });
    // the registry's word for a member from now on
    const reads = (m: ParkedMember, over: Partial<ParkedMember>) => {
        files[`/home/.claude/sessions/${m.pid}.json`] = JSON.stringify(
            rowOf({ ...m, ...over }),
        );
    };
    return {
        ...w,
        asked,
        handoffs,
        peeks,
        reads,
        spoke,
        tickets,
        wakes,
        wrote,
    };
}
type World = ReturnType<typeof parkedWorld>;

export const turnEnd = ($: Engine) =>
    $.turn.complete({
        answer: 'ok',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
// minutes of the lane's silence, clio's own turn ended after each step of it
export async function pass($: Engine, w: World, ...minutes: number[]) {
    for (const m of minutes) {
        await w.skip(m * MIN);
        await turnEnd($);
    }
}
export async function parked($: Engine, w: World, ...minutes: number[]) {
    await start($);
    await pass($, w, ...minutes);
    return w.wakes();
}
export const DISPATCH =
    '## signed\n\n✍️ signed 2026-11-23 · body ab83a694\n🚀 dispatched 2026-11-23 — mods-lane-9, codie bcdc16c6';
