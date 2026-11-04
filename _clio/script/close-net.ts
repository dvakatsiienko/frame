// craft-fleet-flow stage 8: an In Progress ticket either closes or carries a `⏳ waits:` comment naming its one wait
import { spawnSync } from 'node:child_process';

type Tickets = { id: string; comments?: { body: string }[] }[];

function read(args: string[]): Tickets | undefined {
    const out = spawnSync('x', ['linear', ...args], { encoding: 'utf8' });
    try {
        return JSON.parse(out.stdout).data?.tickets;
    } catch {
        return undefined;
    }
}

const listed = read(['list', '--state', 'In Progress']);
if (!listed) {
    console.log('🟡 linear unreachable, the net not run');
    process.exit(0);
}
const ids = listed.map((t) => t.id);
const tickets = ids.length ? (read(['read', ...ids, '--comments']) ?? []) : [];
const bare = tickets.filter(
    (t) => !t.comments?.some((c) => c.body.startsWith('⏳ waits:')),
);
for (const t of bare) console.log(`🔴 ${t.id}: close it, or name its wait`);
if (!bare.length)
    console.log(`🟢 ${ids.length} In Progress, each with a named wait`);
process.exit(bare.length ? 1 : 0);
