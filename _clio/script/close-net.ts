// craft-fleet-flow stage 8: an In Progress ticket either closes or has a door: the label `needs human`, an open blocked-by, or an open step on a running glide card
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Tickets = {
    id: string;
    labels?: string[];
    relations?: { type: string; state: string }[];
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
    const door = t.labels?.includes('needs human')
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
    if (door) console.log(`🟢 ${t.id}: ${door}`);
    else {
        reds++;
        console.log(
            `🔴 ${t.id}: close it, or give it a door (needs human, blocked by, a glide step)`,
        );
    }
}
if (!reds) console.log(`🟢 ${ids.length} In Progress, each with a door`);
process.exit(reds ? 1 : 0);
