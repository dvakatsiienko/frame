// craft-fleet-flow stage 8: an In Progress ticket either closes or has a reason to stay: the label `needs human`, an open blocked-by, or an open step on a running glide card; one moved back to Todo keeps a dated door
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Tickets = {
    id: string;
    description?: string;
    labels?: string[];
    relations?: { type: string; state: string }[];
    comments?: { body: string }[];
}[];

function read(args: string[]): Tickets | undefined {
    const out = spawnSync('x', ['linear', ...args], { encoding: 'utf8' });
    try {
        return JSON.parse(out.stdout).data?.tickets;
    } catch {
        return undefined;
    }
}

// the glide cards: the fleet's lanes in one shelf file, `{ lanes: [{ endedAt?, items: [{ ticket?, isDone }] }] }`
function glideTickets(): Set<string> {
    try {
        const file = join(process.env.HOME ?? '', '.claude/shelf/lanes.json');
        const { lanes } = JSON.parse(readFileSync(file, 'utf8')) as {
            lanes: {
                endedAt?: number;
                items: { ticket?: string; isDone: boolean }[];
                members?: Record<string, unknown>;
            }[];
        };
        return new Set(
            lanes
                .filter((l) => !l.endedAt)
                .flatMap((l) => {
                    const open = l.items.filter((i) => !i.isDone);
                    // a member builds every open step; with none, only the card's current step is being built
                    return Object.keys(l.members ?? {}).length
                        ? open
                        : open.slice(0, 1);
                })
                .filter((i) => i.ticket)
                .map((i) => i.ticket as string),
        );
    } catch {
        return new Set();
    }
}

const listed = read(['list', '--state', 'In Progress']);
if (!listed) {
    console.log('🟡 linear unreachable, the net not run');
    process.exit(0);
}
const ids = listed.map((t) => t.id);
const tickets = ids.length ? (read(['read', ...ids, '--relations']) ?? []) : [];
const glide = glideTickets();
let reds = 0;
for (const t of tickets) {
    const stay = t.labels?.includes('needs human')
        ? 'needs human'
        : t.relations?.some(
                (r) =>
                    r.type === 'blocked by' &&
                    r.state !== 'Done' &&
                    r.state !== 'Canceled',
            )
          ? 'blocked by'
          : glide.has(t.id)
            ? 'a glide step'
            : undefined;
    if (stay) console.log(`🟢 ${t.id}: ${stay}`);
    else {
        reds++;
        console.log(
            `🔴 ${t.id}: close it, or give it a reason to stay (needs human, blocked by, a glide step)`,
        );
    }
}
if (!reds)
    console.log(`🟢 ${ids.length} In Progress, each with a reason to stay`);

// a move back to Todo is no way out of the net: it holds a dated `⏰ due:` comment until it closes
const todoIds = (read(['list', '--state', 'Todo']) ?? []).map((t) => t.id);
const todo = todoIds.length
    ? (read(['read', ...todoIds, '--comments']) ?? [])
    : [];
const today = new Date().toISOString().slice(0, 10);
for (const t of todo) {
    const bodies = (t.comments ?? []).map((c) => c.body);
    const moved = bodies.findLastIndex((body) => /^(↩️|⏳)/.test(body));
    if (moved === -1) {
        // shipped work hangs here: dispatched, off every card, and no door to read
        if (t.description?.includes('🚀 dispatched') && !glide.has(t.id))
            console.log(
                `🟡 ${t.id}: dispatched, in Todo, on no lane: shipped? close it; else a «⏰ due:» line`,
            );
        continue;
    }
    const door = bodies
        .slice(moved + 1)
        .findLast((body) => /^(⏰|🚪)/.test(body));
    const by = door?.match(/by (\d{4}-\d{2}-\d{2})/)?.[1];
    // the door's words print every siesta, since what it waits on can happen long before its date
    if (by && by >= today)
        console.log(
            `🟢 ${t.id}: due by ${by}: ${door?.split('\n')[0]?.slice(0, 160)}`,
        );
    else {
        reds++;
        console.log(
            `🔴 ${t.id}: moved out of In Progress, ${by ? `its due date passed ${by}` : 'nothing due'}: close it, or comment «⏰ due: <what> by <date>»`,
        );
    }
}
process.exit(reds ? 1 : 0);
