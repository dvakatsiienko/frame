import type { On } from 'claude-code';
import type { Engine } from 'claude-code/testing';

import type { StashLane } from '../types/stash.d.ts';
import { EVEN, LANES, MIN, laneCard, start, world } from './quiet-helpers.ts';

// clio's session running one lane card: each member's registry row, its last word and what its session keeps in the store
export type ParkedMember = {
    // when its transcript was last written, or ago in minutes before the world's start
    at?: number;
    ago?: number;
    name: string;
    pid: number;
    role: 'codie' | 'sixth-sense';
    sid: string;
    // when its process started, in the registry
    startedAt?: number;
    status?: string;
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
        // the clio's own name, a wing's too
        name = '🦉 clio',
        now = EVEN,
        // peeks of the handoff that fail before one answers
        peeksDown = 0,
        // what a peek that finds no one handoff prints
        peekSays = 'no pending handoff matches',
        store = {} as Record<string, unknown>,
        tickets = {} as Record<string, Ticket>,
    } = {},
) {
    const peeks: string[] = [];
    const wrote = new Map(
        members.map((m) => [m.sid, m.at ?? now - (m.ago ?? 9) * MIN]),
    );
    const made = new Map(wrote);
    const ofMembers = {
        linkedIds: Object.fromEntries(members.map((m) => [m.role, m.sid])),
        members: Object.fromEntries(members.map((m) => [m.role, m.name])),
    };
    const files: Record<string, string> = {
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
        peers: members.map(
            ({ name, pid, sid, startedAt, status = 'idle' }) => ({
                name,
                pid,
                sessionId: sid,
                startedAt,
                status,
            }),
        ),
        run: (argv) => {
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
    return { ...w, handoffs, peeks, spoke, tickets, wakes, wrote };
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
        await w.clock.advance(m * MIN);
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
