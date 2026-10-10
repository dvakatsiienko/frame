import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// the pocket's contract on top of Backlog.md (grill 2026-10-09); allowed values come from its own config
const NOW_CAP = 3;
const OPEN_CAP = 5;
const PARKED_LINE = /^parked:\s*\S/m;
const EXPIRING = ['xs', 's'];
const ZERO_WIDTH_JOINER = String.fromCodePoint(0x200d);
const TICKET_LINE = /\b(?:ticket|moved to linear):\s*((?:FRM|BYT)-\d+)/gi;

export function checkPocket(
    configText: string,
    tasks: Task[],
    today: string,
    closedTickets: ReadonlySet<string> = new Set(),
): string[] {
    const config = {
        labels: listOf(configText, 'labels'),
        priorities: listOf(configText, 'priorities'),
        statuses: listOf(configText, 'statuses'),
        types: listOf(configText, 'types'),
    };
    const problems: string[] = [];
    let nowCount = 0;
    let openCount = 0;

    for (const { name, text } of tasks) {
        const front = frontmatter(text);
        const id = front.scalars.id ?? name;
        const report = (what: string) => problems.push(`${id}: ${what}`);
        const status = front.scalars.status ?? '';
        const priority = front.scalars.priority ?? '';
        const sizes = (front.lists.labels ?? []).filter((label) =>
            config.labels.includes(label),
        );

        if (!config.statuses.includes(status))
            report(
                `status «${status}» is not one of ${config.statuses.join(' · ')}`,
            );
        if (text.includes(ZERO_WIDTH_JOINER))
            report('a joined emoji breaks the board view (Backlog.md #949)');
        if (status === 'done') {
            report(
                'done but still listed: `backlog task complete` it this turn',
            );
            continue;
        }
        const parked = PARKED_LINE.test(text);
        if (status !== 'waiting' && !parked) openCount += 1;

        for (const ticket of ticketsOf(text))
            if (closedTickets.has(ticket))
                report(
                    `its ticket ${ticket} is closed in linear: flip it to done`,
                );

        if (!config.priorities.includes(priority))
            report(
                `priority «${priority}» is not one of ${config.priorities.join(' · ')}`,
            );
        const band = config.priorities.indexOf(priority);
        const ordinal = Number(front.scalars.ordinal);
        if (
            band >= 0 &&
            !(ordinal >= 1000 * 10 ** band && ordinal < 1000 * 10 ** (band + 1))
        )
            report(
                `ordinal ${front.scalars.ordinal || 'missing'} sits outside the ${priority} band (${1000 * 10 ** band}–${1000 * 10 ** (band + 1) - 1}), so --sort ordinal misplaces it`,
            );
        if (!config.types.includes(front.scalars.type ?? ''))
            report(
                `type «${front.scalars.type ?? ''}» is not one of ${config.types.join(' · ')}`,
            );
        if (sizes.length !== 1)
            report(
                `needs exactly one size label (${config.labels.join(' · ')}), has ${sizes.length}`,
            );
        if (
            status === 'waiting' &&
            !firstDescriptionLine(text).startsWith('**waiting for:**')
        )
            report('waiting without a `**waiting for:**` first line');

        const due = front.scalars.due_date;
        const isExpiring = sizes.some((size) => EXPIRING.includes(size));
        if (isExpiring && status !== 'waiting' && !due)
            report('an xs/s item needs a due date');
        if (due && due < today) report(`expired on ${due}`);
        if (priority === 'now') nowCount += 1;
    }
    if (nowCount > NOW_CAP)
        problems.push(`now holds ${nowCount} items, the cap is ${NOW_CAP}`);
    if (openCount > OPEN_CAP)
        problems.push(
            `${openCount} open items, the cap is ${OPEN_CAP}: solve, ticket or park before the main lane`,
        );
    return problems;
}

export function ticketsOf(text: string): string[] {
    return [...text.matchAll(TICKET_LINE)].map((match) =>
        (match[1] ?? '').toUpperCase(),
    );
}

function closedOf(ids: string[]): Set<string> {
    if (ids.length === 0) return new Set();
    const out = execFileSync('x', ['linear', 'read', ...ids], {
        encoding: 'utf8',
    });
    const tickets = (JSON.parse(out) as LinearRead).data.tickets;
    return new Set(
        tickets
            .filter((ticket) =>
                ['completed', 'canceled'].includes(ticket.stateType),
            )
            .map((ticket) => ticket.id),
    );
}

function listOf(configText: string, key: string): string[] {
    const line = configText
        .split('\n')
        .find((row) => row.startsWith(`${key}:`));
    return line ? (JSON.parse(line.slice(key.length + 1)) as string[]) : [];
}

function frontmatter(text: string) {
    const scalars: Record<string, string> = {};
    const lists: Record<string, string[]> = {};
    let listKey = '';
    for (const row of text.split('\n---\n')[0]?.split('\n').slice(1) ?? []) {
        const item = row.match(/^\s+- (.+)$/);
        if (item?.[1] && listKey) {
            lists[listKey]?.push(unquote(item[1]));
            continue;
        }
        const pair = row.match(/^([a-z_]+):\s*(.*)$/);
        if (!pair?.[1]) continue;
        listKey = '';
        if (pair[2] === '') {
            listKey = pair[1];
            lists[listKey] = [];
        } else if (pair[2] !== '[]') scalars[pair[1]] = unquote(pair[2] ?? '');
    }
    return { lists, scalars };
}

function firstDescriptionLine(text: string): string {
    const body = text.split('<!-- SECTION:DESCRIPTION:BEGIN -->\n')[1] ?? '';
    return body.split('\n')[0]?.trim() ?? '';
}

function unquote(value: string): string {
    return value.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
}

if (import.meta.main) {
    const root = join(import.meta.dirname, '..');
    const dir = join(root, 'pocket', 'tasks');
    const tasks = readdirSync(dir)
        .filter((name) => name.endsWith('.md'))
        .map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));
    const today = new Date().toLocaleDateString('sv');
    const open = tasks.filter(({ text }) => !/^status: done$/m.test(text));
    const problems = checkPocket(
        readFileSync(join(root, 'backlog.config.yml'), 'utf8'),
        tasks,
        today,
        closedOf([...new Set(open.flatMap(({ text }) => ticketsOf(text)))]),
    );
    if (problems.length === 0)
        console.log(`pocket: ${tasks.length} tasks, all checks green`);
    for (const problem of problems) console.log(`🔴 ${problem}`);
    process.exitCode = problems.length === 0 ? 0 : 1;
}

/* Types */

interface LinearRead {
    data: { tickets: { id: string; stateType: string }[] };
}

interface Task {
    name: string;
    text: string;
}
