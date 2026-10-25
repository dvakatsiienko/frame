import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    type Groomed,
    groomedOnDisk,
    newUnstamped,
    ungroomedStamps,
} from './prompt-groom.ts';
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
const TICKET_LINE =
    /^[ \t]*(?:- )?(?:ticket|moved to linear):\s*((?:FRM|BYT)-\d+)/gim;
const ZONED_STAMP = /(?:Z|[+-]\d{2}:?\d{2})$/;
const ITEM_PREFIX = /^pk-\d+ /i;

export function checkPocket(
    configText: string,
    tasks: Task[],
    today: string,
    lastTriage = '',
    isGroomed: Groomed = groomedOnDisk,
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
        const touched = localDay(
            front.scalars.updated_date || front.scalars.created_date || '',
        );
        const born = localDay(front.scalars.created_date ?? '');
        const wishIds = [...wishLines(text).keys()];
        if (
            front.scalars.type === 'wish' &&
            born >= WISH_RULES_FROM &&
            wishIds.length === 0
        )
            report('wish born without W-lines: fold it into W1… lines');
        for (const hhmm of ungroomedStamps(text, today, isGroomed))
            report(
                `W-lines of dima's ${hhmm} prompt folded with no groom (FRM-418): \`node script/prompt-groom.ts ${hhmm}\`, then refold from the groomed file`,
            );
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

        // one outcome, one store: the item dies the turn its ticket is born, not when it closes
        const keptForTicket =
            /^kept: \d{4}-\d{2}-\d{2} — .*\b(?:FRM|BYT)-\d+/m.test(text);
        for (const ticket of ticketsOf(text))
            if (status !== 'done' && !keptForTicket)
                report(
                    `carries ticket ${ticket} yet is ${status}: the item dies the turn its ticket is born, set it done`,
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
        if (status === 'waiting' && due && due > daysBefore(today, -1))
            report(
                `waits until ${due}: a wait past tomorrow is linear's (habit-shared-files § the pocket)`,
            );
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

// a UTC stamp (`…Z`) is read on the local calendar, like `today`
function localDay(stamp: string): string {
    return ZONED_STAMP.test(stamp)
        ? new Date(stamp).toLocaleDateString('sv')
        : stamp.slice(0, 10);
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

// the file-level reds: what HEAD had and the disk no longer shows, in the tasks dir and the archive
export function auditAgainstHead(
    tasks: Task[],
    archive: Task[],
    head: Head,
): string[] {
    const problems: string[] = [];
    const idOf = (name: string) => name.split(' ')[0];
    for (const { name, text } of tasks)
        for (const line of newUnstamped(text, head.text('tasks', name)))
            problems.push(
                `${idOf(name)}: a W-line with no prompt stamp, so the groom check cannot see it (FRM-418): «${line.trim().slice(0, 60)}» — head it «W<n> (<date> <HH:MM>, dima)»`,
            );
    for (const [dir, files] of [
        ['tasks', tasks],
        ['archive', archive],
    ] as const)
        for (const { name, text } of files) {
            // an item archived this step has no archive copy at HEAD: its pre-move tasks copy is the baseline
            const prefix = name.match(ITEM_PREFIX)?.[0].toLowerCase();
            const before = head.names.find(
                (file) => prefix && file.toLowerCase().startsWith(prefix),
            );
            const lost = lostNoteLines(
                text,
                head.text(dir, name) ||
                    (dir === 'archive' && before
                        ? head.text('tasks', before)
                        : ''),
            );
            if (lost.length > 0)
                problems.push(
                    `${idOf(name)}: ${lost.length} note line(s) gone since HEAD — a close appends (\`--append-notes\`); restore from \`git show HEAD:\``,
                );
        }
    const here = new Set(tasks.map((file) => file.name));
    for (const name of head.names.filter((file) => !here.has(file))) {
        const prefix = (name.match(ITEM_PREFIX)?.[0] ?? name).toLowerCase();
        const moved = archive.find((file) =>
            file.name.toLowerCase().startsWith(prefix),
        );
        const closed =
            frontmatter(moved?.text ?? '').scalars.status === 'done' &&
            (wishLines(moved?.text ?? '').size === 0 ||
                noteLines(moved?.text ?? '').some((line) =>
                    CLOSE_LINE.test(line),
                ));
        if (!closed)
            problems.push(
                `${idOf(name)?.toUpperCase()}: left the tasks dir without being done and closed — restore it or close it with a close: line`,
            );
    }
    return problems;
}

function gitAtHead(args: string[]): string {
    try {
        return execFileSync('git', args, {
            cwd: join(import.meta.dirname, '..'),
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return '';
    }
}

function readDir(dir: string): Task[] {
    return existsSync(dir)
        ? readdirSync(dir)
              .filter((name) => name.endsWith('.md'))
              .map((name) => ({
                  name,
                  text: readFileSync(join(dir, name), 'utf8'),
              }))
        : [];
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
    const tasks = readDir(dir);
    const today = new Date().toLocaleDateString('sv');
    const stamp = join(root, 'pocket', 'last-triage.txt');
    if (process.argv.includes('--triaged')) writeFileSync(stamp, `${today}\n`);
    const lastTriage = existsSync(stamp)
        ? readFileSync(stamp, 'utf8').trim()
        : '';
    const problems = checkPocket(
        readFileSync(join(root, 'backlog.config.yml'), 'utf8'),
        tasks,
        today,
        lastTriage,
    );
    problems.push(
        ...auditAgainstHead(
            tasks,
            readDir(join(root, 'pocket', 'archive', 'tasks')),
            {
                names: gitAtHead([
                    'ls-tree',
                    '-z',
                    '--name-only',
                    'HEAD:./pocket/tasks/',
                ])
                    .split('\0')
                    .filter((name) => name.endsWith('.md')),
                text: (dir, name) =>
                    gitAtHead([
                        'show',
                        `HEAD:./${join('pocket', dir === 'tasks' ? 'tasks' : 'archive/tasks', name)}`,
                    ]),
            },
        ),
    );
    if (problems.length === 0)
        console.log(`pocket: ${tasks.length} tasks, all checks green`);
    for (const problem of problems) console.log(`🔴 ${problem}`);
    process.exitCode = problems.length === 0 ? 0 : 1;
}

/* Types */

interface Head {
    names: string[];
    text: (dir: 'tasks' | 'archive', name: string) => string;
}

interface Task {
    name: string;
    text: string;
}
