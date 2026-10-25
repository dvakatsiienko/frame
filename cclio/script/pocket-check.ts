import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { citedIds, wishLines } from './wish-cover.ts';

// the pocket's contract on top of Backlog.md (grill 2026-10-09); allowed values come from its own config
const NOW_CAP = 3;
// the staleness triage (dima, 2026-10-25, W223): every 3 days, the items untouched for 2, revalidated by hand
const TRIAGE_EVERY_DAYS = 3;
const STALE_AFTER_DAYS = 2;
const PARKED_LINE = /^parked:\s*\S/m;
const ZERO_WIDTH_JOINER = String.fromCodePoint(0x200d);
// the boot seeds it every evergreen day; counting it would trip the caps weekly by design
const CAP_FREE_TITLE = /^🧬 evergreen turn/;
// the wish-accounting reds apply to items born or touched from this day on
const WISH_RULES_FROM = '2026-10-22';
const CLOSE_LINE = /^close:/;
const TICKET_LINE = /\b(?:ticket|moved to linear):\s*((?:FRM|BYT)-\d+)/gi;

export function checkPocket(
    configText: string,
    tasks: Task[],
    today: string,
    closedTickets: ReadonlySet<string> = new Set(),
    lastTriage = '',
): string[] {
    const config = {
        labels: listOf(configText, 'labels'),
        priorities: listOf(configText, 'priorities'),
        statuses: listOf(configText, 'statuses'),
        types: listOf(configText, 'types'),
    };
    const problems: string[] = [];
    let nowCount = 0;
    const stale: string[] = [];

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
        const touched = (
            front.scalars.updated_date ||
            front.scalars.created_date ||
            ''
        ).slice(0, 10);
        const born = (front.scalars.created_date ?? '').slice(0, 10);
        const wishIds = [...wishLines(text).keys()];
        if (
            front.scalars.type === 'wish' &&
            born >= WISH_RULES_FROM &&
            wishIds.length === 0
        )
            report('wish born without W-lines: fold it into W1… lines');
        if (
            status === 'done' &&
            (born >= WISH_RULES_FROM || touched >= WISH_RULES_FROM)
        ) {
            const accounted = citedIds(
                noteLines(text)
                    .filter((line) => CLOSE_LINE.test(line))
                    .join('\n'),
            );
            if (wishIds.some((wishId) => !accounted.has(wishId)))
                report(
                    'closed without accounting for W-lines: add a `close:` line citing each as done, moved or dropped',
                );
        }
        if (status === 'done') {
            if (touched < today)
                report(
                    `done since ${touched || '?'} and still listed: \`backlog task archive\` it (the halt archives the day's done items)`,
                );
            continue;
        }
        const parked = PARKED_LINE.test(text);
        const capFree = CAP_FREE_TITLE.test(front.scalars.title ?? '');
        if (status === 'claimed' && parked)
            report(
                'claimed and parked at once: a parked item releases its claim, set it open or waiting',
            );

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

        // an unproven «can't» parked a live secret leak (PK-98, 2026-10-13): the line names the probe it ran
        for (const line of text.split('\n'))
            if (
                /^(parked:|\*\*waiting for:\*\*)/.test(line.trim()) &&
                /\b(can['’]?t|cannot|impossible|unreachable)\b/i.test(line) &&
                !/`[^`]+`/.test(line)
            )
                report(
                    "a «can't» park or wait line names no probe: put the `command` it tried on that line",
                );

        const due = front.scalars.due_date;
        if (status === 'waiting' && !due)
            report('waiting without a due date: when does the wait expire?');
        if (status === 'waiting' && due && due < today)
            report(
                `expired on ${due}: the wait ended, work it or move it to linear`,
            );
        if (!capFree && touched <= daysBefore(today, STALE_AFTER_DAYS))
            stale.push(id);
        if (priority === 'now' && !capFree) nowCount += 1;
    }
    if (nowCount > NOW_CAP)
        problems.push(`now holds ${nowCount} items, the cap is ${NOW_CAP}`);
    if (stale.length > 0 && lastTriage <= daysBefore(today, TRIAGE_EVERY_DAYS))
        problems.push(
            `3-day triage due (last ${lastTriage || 'never'}): ${stale.join(', ')} untouched ${STALE_AFTER_DAYS}+ days — revalidate each by hand: a stayer gets «kept: <date> — <why>», the rest move to linear; then \`node script/pocket-check.ts --triaged\``,
        );
    return problems;
}

function daysBefore(day: string, days: number): string {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
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

// a close with `backlog task edit --notes` replaces every note, dima's quoted steers included
export function lostNoteLines(current: string, head: string): string[] {
    const kept = new Set(noteLines(current));
    return noteLines(head).filter((line) => !kept.has(line));
}

function noteLines(text: string): string[] {
    const body =
        text
            .split('<!-- SECTION:NOTES:BEGIN -->\n')[1]
            ?.split('<!-- SECTION:NOTES:END -->')[0] ?? '';
    return body
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

function headText(path: string): string {
    try {
        return execFileSync('git', ['show', `HEAD:./${path}`], {
            cwd: join(import.meta.dirname, '..'),
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return '';
    }
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
    const stamp = join(root, 'pocket', 'last-triage.txt');
    if (process.argv.includes('--triaged')) writeFileSync(stamp, `${today}\n`);
    const lastTriage = existsSync(stamp)
        ? readFileSync(stamp, 'utf8').trim()
        : '';
    const open = tasks.filter(({ text }) => !/^status: done$/m.test(text));
    const problems = checkPocket(
        readFileSync(join(root, 'backlog.config.yml'), 'utf8'),
        tasks,
        today,
        closedOf([...new Set(open.flatMap(({ text }) => ticketsOf(text)))]),
        lastTriage,
    );
    for (const { name, text } of tasks) {
        const lost = lostNoteLines(
            text,
            headText(join('pocket', 'tasks', name)),
        );
        if (lost.length > 0)
            problems.push(
                `${name.split(' ')[0]}: ${lost.length} note line(s) gone since HEAD — a close appends (\`--append-notes\`); restore from \`git show HEAD:\``,
            );
    }
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
