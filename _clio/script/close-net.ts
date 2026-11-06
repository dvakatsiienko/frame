// craft-fleet-flow stage 8: an In Progress ticket either closes or has a reason to stay: the label `needs human`, an open blocked-by, or an open step on a running glide card; one moved back to Todo keeps a dated door
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

// what is already built, per ticket: its lane-plan steps ticked. a commit naming an id proves nothing: 12 of 12 reds on one were notes and riders
function builtSteps(): Map<string, string> {
    const steps = new Map<string, { all: number; ticked: number }>();
    const lanes = join(process.env.HOME ?? '', '.local/state/x/lanes');
    for (const lane of existsSync(lanes) ? readdirSync(lanes) : []) {
        const plan = join(lanes, lane, 'lane-plan.md');
        if (!existsSync(plan)) continue;
        for (const [, mark, id] of readFileSync(plan, 'utf8').matchAll(
            /^- \[([ xX])\] \d+ · ([A-Z]{3}-\d+)\b/gm,
        )) {
            const seen = steps.get(id as string) ?? { all: 0, ticked: 0 };
            seen.all++;
            if (mark !== ' ') seen.ticked++;
            steps.set(id as string, seen);
        }
    }
    return new Map(
        [...steps]
            .filter(([, step]) => step.ticked)
            .map(([id, step]) => [
                id,
                `${step.ticked} of ${step.all} plan steps ticked`,
            ]),
    );
}

const listed = read(['list', '--state', 'In Progress']);
if (!listed) {
    console.log('🔴 linear unreachable, the net not run');
    process.exit(1);
}
const ids = listed.map((t) => t.id);
const tickets = ids.length ? read(['read', ...ids, '--relations']) : [];
if (!tickets) {
    console.log('🔴 In Progress tickets unread, the net not run');
    process.exit(1);
}
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
const todoList = read(['list', '--state', 'Todo']);
const todoIds = (todoList ?? []).map((t) => t.id);
const todo = todoIds.length ? read(['read', ...todoIds, '--comments']) : [];
if (!todoList || !todo) {
    console.log('🔴 Todo tickets unread, the moved-back half not run');
    process.exit(1);
}
const today = new Date().toISOString().slice(0, 10);
const built = builtSteps();
const skipped: string[] = [];
for (const t of todo) {
    const bodies = (t.comments ?? []).map((c) => c.body);
    const moved = bodies.findLastIndex((body) => /^(↩️|⏳)/.test(body));
    const door = bodies
        .slice(moved + 1)
        .findLast((body) => /^(⏰|🚪)/.test(body));
    const work = built.get(t.id);
    if (moved === -1 && !door) {
        if (work && !glide.has(t.id)) {
            reds++;
            console.log(
                `🔴 ${t.id}: built, ${work}, and still Todo: close it, or comment «⏰ due: <what is left> by <date>»`,
            );
        }
        // shipped work hangs here: dispatched, off every card, and no door to read
        else if (t.description?.includes('🚀 dispatched') && !glide.has(t.id))
            console.log(
                `🟡 ${t.id}: dispatched, in Todo, on no lane, no door: shipped? close it; else comment «⏰ due: <what> by <date>»`,
            );
        else skipped.push(t.id);
        continue;
    }
    const by = door?.match(/by (\d{4}-\d{2}-\d{2})/)?.[1];
    // the door's words print every siesta, since what it waits on can happen long before its date
    if (by && by >= today)
        console.log(
            `🟢 ${t.id}: due by ${by}${work ? ` (built, ${work})` : ''}, has it fired? ${door?.split('\n')[0]?.slice(0, 160)}`,
        );
    else {
        reds++;
        console.log(
            `🔴 ${t.id}: ${by ? `its due date passed ${by}` : 'nothing due'}: close it, or comment «⏰ due: <what> by <date>»`,
        );
    }
}
if (skipped.length)
    console.log(
        `⏭️ ${skipped.length} Todo never moved back, skipped: ${skipped.join(' ')}`,
    );
process.exit(reds ? 1 : 0);
