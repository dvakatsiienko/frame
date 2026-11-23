// the halt half of FRM-693: every open Todo or In Progress ticket of FRM and BYT is signed or carries dima's «grill postponed»
// usage: node unsigned-tickets.ts [--json]; exit 0 none red, 1 some red or a read failed
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

const TEAMS = ['FRM', 'BYT'];
const STATES = ['Todo', 'In Progress'];
const SKIPPED_LABELS = ['standing', 'someday', 'snoozed', 'human'];
const SIGNED_LINE = /^✍️ (re-)?signed\b/m;
const POSTPONED_LINE = /^⏸️ grill postponed/m;
const RUN_TIMEOUT_MS = 60_000;
// x linear list caps at 50 and has no page flag, so the pages come through the raw graphql door
const QUERY = `query ($after: String, $teams: [String!], $states: [String!]) {
  issues(first: 100, after: $after, filter: {team: {key: {in: $teams}}, state: {name: {in: $states}}}) {
    nodes { identifier title description state { name } labels { nodes { name } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

export function unsignedTickets(tickets: Ticket[]) {
    const open = tickets.filter(
        (t) =>
            STATES.includes(t.state) &&
            !t.labels.some((label) => SKIPPED_LABELS.includes(label)) &&
            !isSigned(t.description),
    );
    return {
        postponed: open.filter((t) => POSTPONED_LINE.test(t.description)),
        red: open.filter((t) => !POSTPONED_LINE.test(t.description)),
    };
}

// a `## signed` heading, then a sign line before the next `## ` heading
function isSigned(description: string) {
    const [, afterHeading] = description.split(/^## signed[ \t]*$/m);
    return SIGNED_LINE.test(afterHeading?.split(/^## /m)[0] ?? '');
}

function fetchOpenTickets() {
    const tickets: Ticket[] = [];
    let after: string | null = null;
    do {
        const vars = JSON.stringify({ after, states: STATES, teams: TEAMS });
        const out = spawnSync(
            path.join(homedir(), '.local/bin/x'),
            ['linear', 'api', '--json', '--vars', vars, QUERY],
            { encoding: 'utf8', maxBuffer: 1 << 26, timeout: RUN_TIMEOUT_MS },
        );
        const reply: Reply = JSON.parse(out.stdout || '{}');
        const issues = reply.data?.issues;
        if (out.status !== 0 || !issues) throw new Error('x linear api failed');
        for (const n of issues.nodes)
            tickets.push({
                description: n.description ?? '',
                id: n.identifier,
                labels: n.labels.nodes.map((label) => label.name),
                state: n.state.name,
                title: n.title,
            });
        after = issues.pageInfo.hasNextPage ? issues.pageInfo.endCursor : null;
    } while (after);
    return tickets;
}

if (import.meta.main) {
    try {
        const { postponed, red } = unsignedTickets(fetchOpenTickets());
        if (process.argv.includes('--json'))
            console.log(JSON.stringify({ postponed, red }));
        else {
            for (const t of red)
                console.log(`${t.id} — ${t.title} — ${t.state}`);
            for (const t of postponed)
                console.log(`${t.id} — ${t.title} — postponed`);
            console.log(
                `unsigned: ${red.length} red, ${postponed.length} postponed`,
            );
        }
        process.exitCode = red.length ? 1 : 0;
    } catch (e) {
        console.error((e as Error).message);
        process.exitCode = 1;
    }
}

/* Types */

export type Ticket = {
    description: string;
    id: string;
    labels: string[];
    state: string;
    title: string;
};

type Reply = {
    data?: {
        issues?: {
            nodes: {
                description: string | null;
                identifier: string;
                labels: { nodes: { name: string }[] };
                state: { name: string };
                title: string;
            }[];
            pageInfo: { endCursor: string | null; hasNextPage: boolean };
        };
    };
};
