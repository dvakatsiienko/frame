import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    type Groomed,
    groomedOnDisk,
    newUnstamped,
    ungroomedStamps,
} from './prompt-groom.ts';
import { citedIds, normalize, wishBlock, wishLines } from './wish-cover.ts';

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
// the one ticket-line shape, shared with wish-cover
export const TICKET_LINE =
    /^[ \t]*(?:- )?(?:ticket|moved to linear):\s*((?:FRM|BYT)-\d+)/gim;
// a «held:» line vouches for its own ticket only this long
const HELD_DAYS = 3;
const HELD_LINE = /^held: (\d{4}-\d{2}-\d{2}) — (.*)$/gm;
// a «kept:» line is a stale item's stay, dated the triage day
const KEPT_LINE = /^kept: (\d{4}-\d{2}-\d{2}) — (.*)$/gm;
const ZONED_STAMP = /(?:Z|[+-]\d{2}:?\d{2})$/;
const ITEM_PREFIX = /^pk-\d+ /i;

export function checkPocket(
    configText: string,
    tasks: Task[],
    today: string,
    lastTriage = '',
    isGroomed: Groomed = groomedOnDisk,
    closedTickets: ReadonlySet<string> = new Set(),
    wishBlocks: ReadonlyMap<string, string> = new Map(),
): string[] {
    const config = {
        labels: listOf(configText, 'labels'),
        priorities: listOf(configText, 'priorities'),
        statuses: listOf(configText, 'statuses'),
        types: listOf(configText, 'types'),
    };
    const problems: string[] = [];
    let nowCount = 0;
    const tomorrow = daysBefore(today, -1);

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
        // the pocket item dies when its ticket is born, so the copy into the ticket's wish block is the only home left
        if (
            status === 'done' &&
            (born >= WISH_RULES_FROM || touched >= WISH_RULES_FROM)
        ) {
            // only the clause that says «dropped» drops its ids: «raw drop kept in the notes» drops nothing
            const dropped = citedIds(
                noteLines(text)
                    .filter((line) => CLOSE_LINE.test(line))
                    .flatMap((line) => line.split(/[,;]/))
                    .filter((clause) => /\bdropped\b/i.test(clause))
                    .join('\n'),
            );
            for (const ticket of ticketsOf(text)) {
                const block = wishBlocks.get(ticket);
                if (block === undefined) continue;
                const home = normalize(block);
                for (const [wishId, words] of wishLines(text))
                    if (
                        words &&
                        !dropped.has(wishId) &&
                        !home.includes(normalize(words))
                    )
                        report(
                            `${wishId} moved to ${ticket} but not in its wish block: copy it there verbatim`,
                        );
            }
        }
        if (status === 'done') {
            if (touched < today)
                report(
                    `done since ${touched || '?'} and still listed: \`backlog task archive\` it (the halt archives the day's done items)`,
                );
            continue;
        }
        const capFree = CAP_FREE_TITLE.test(front.scalars.title ?? '');
        // the notes are append-only history, so a dated park there is a past state; the description holds the live one
        const live = (
            text.split('<!-- SECTION:DESCRIPTION:BEGIN -->')[1] ?? ''
        ).split('<!-- SECTION:DESCRIPTION:END -->')[0];
        if (PARKED_LINE.test(live ?? ''))
            report("a parked item is linear's: move it there");

        // one outcome, one store: the item dies the turn its ticket is born, not when it closes
        const freshHeld = [...text.matchAll(HELD_LINE)]
            .filter(([, day]) => (day ?? '') >= daysBefore(today, HELD_DAYS))
            .map(([, , why]) => why ?? '');
        for (const ticket of ticketsOf(text)) {
            if (closedTickets.has(ticket))
                report(
                    `its ticket ${ticket} is closed in linear: flip it to done`,
                );
            else if (
                !freshHeld.some((why) =>
                    new RegExp(`\\b${ticket}\\b`, 'i').test(why),
                )
            )
                report(
                    `carries ticket ${ticket} yet is ${status}: the item dies the turn its ticket is born, set it done`,
                );
        }

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
        if (status === 'waiting' && due && due > tomorrow)
            report(
                `waits until ${due}: a wait past tomorrow is linear's (habit-shared-files § the pocket)`,
            );
        if (status === 'waiting' && due && due < today)
            report(
                `expired on ${due}: the wait ended, work it or move it to linear`,
            );
        if (status !== 'waiting' && due && (due < today || due > tomorrow))
            report(
                `due ${due} is outside today–tomorrow: work it, re-date it to tomorrow, or move it to linear`,
            );
        if (priority === 'now' && !capFree) nowCount += 1;
    }
    if (nowCount > NOW_CAP)
        problems.push(`now holds ${nowCount} items, the cap is ${NOW_CAP}`);
    const stale = staleItems(tasks, today).map((item) => item.id);
    if (stale.length > 0 && lastTriage <= daysBefore(today, TRIAGE_EVERY_DAYS))
        problems.push(
            `3-day triage due (last ${lastTriage || 'never'}): ${stale.join(', ')} untouched ${STALE_AFTER_DAYS}+ days — revalidate each by hand: a stayer gets «kept: <date> — <why>», the rest move to linear; then \`node script/pocket-check.ts --triaged\``,
        );
    return problems;
}

// the not-done items untouched for the stale window; the seeded evergreen turn is never stale
function staleItems(tasks: Task[], today: string) {
    return tasks.flatMap(({ name, text }) => {
        const front = frontmatter(text);
        const touched = localDay(
            front.scalars.updated_date || front.scalars.created_date || '',
        );
        return front.scalars.status !== 'done' &&
            !CAP_FREE_TITLE.test(front.scalars.title ?? '') &&
            touched <= daysBefore(today, STALE_AFTER_DAYS)
            ? [{ id: front.scalars.id ?? name, text }]
            : [];
    });
}

// the stale items the triage cannot stamp over: no `kept: <today> — …` line
export function unkeptStale(tasks: Task[], today: string): string[] {
    return staleItems(tasks, today)
        .filter(
            ({ text }) =>
                ![...text.matchAll(KEPT_LINE)].some(([, day]) => day === today),
        )
        .map((item) => item.id);
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

function readTickets(ids: string[]) {
    let tickets: LinearRead['data']['tickets'] = [];
    if (ids.length > 0)
        try {
            const out = execFileSync('x', ['linear', 'read', ...ids], {
                encoding: 'utf8',
                timeout: 15_000,
            });
            tickets = (JSON.parse(out) as LinearRead).data.tickets;
        } catch {
            console.error('🟡 linear not read — the ticket net skipped');
        }
    return {
        closed: new Set(
            tickets
                .filter((ticket) =>
                    ['completed', 'canceled'].includes(ticket.stateType),
                )
                .map((ticket) => ticket.id),
        ),
        wishBlocks: new Map(
            tickets.map((ticket) => [
                ticket.id,
                wishBlock(ticket.description ?? ''),
            ]),
        ),
    };
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
                `${idOf(name)}: a W-line with no prompt stamp, so the groom check cannot see it (FRM-418): «${line.trim().slice(0, 60)}» — head it «W<n> (<date> <HH:MM>, dima)» for a prompt, «W<n> (<date> inbox, dima)» for an inbox drop`,
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
    const startsWithPrefix = (files: Task[], prefix: string) =>
        files.some((file) => file.name.toLowerCase().startsWith(prefix));
    const prefixOf = (name: string) =>
        (name.match(ITEM_PREFIX)?.[0] ?? name).toLowerCase();
    // a name gone from the archive is fine when its «pk-N » prefix lives on in the archive or the tasks dir
    for (const name of head.archiveNames)
        if (
            !archive.some((file) => file.name === name) &&
            !startsWithPrefix(archive, prefixOf(name)) &&
            !startsWithPrefix(tasks, prefixOf(name))
        )
            problems.push(
                `${idOf(name)?.toUpperCase()}: left the archive — restore it from \`git show HEAD:\``,
            );
    for (const name of head.names.filter((file) => !here.has(file))) {
        const prefix = prefixOf(name);
        if (startsWithPrefix(tasks, prefix)) continue;
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

// HEAD's pocket as the audit reads it: both name lists, and every blob from one `git cat-file --batch`
export function headFromGit(
    root: string,
    env: NodeJS.ProcessEnv = process.env,
): Head {
    const git = (args: string[], input?: string) => {
        try {
            return execFileSync('git', args, {
                cwd: root,
                env,
                input,
                maxBuffer: 512 * 1024 * 1024,
                stdio: ['pipe', 'pipe', 'ignore'],
            });
        } catch {
            return Buffer.alloc(0);
        }
    };
    const dirs = { archive: 'archive/tasks', tasks: 'tasks' } as const;
    const namesIn = (dir: keyof typeof dirs) =>
        git([
            'ls-tree',
            // without it ls-tree filters by the cwd prefix and lists nothing from cclio/
            '--full-tree',
            '-z',
            '--name-only',
            `HEAD:./pocket/${dirs[dir]}/`,
        ])
            .toString()
            .split('\0')
            .filter((name) => name.endsWith('.md'));
    const names = namesIn('tasks');
    const archiveNames = namesIn('archive');
    const wanted = [
        ...names.map((name) => ['tasks', name] as const),
        ...archiveNames.map((name) => ['archive', name] as const),
    ];
    const reply = git(
        ['cat-file', '--batch'],
        wanted
            .map(([dir, name]) => `HEAD:./pocket/${dirs[dir]}/${name}\n`)
            .join(''),
    );
    const blobs = new Map<string, string>();
    let pos = 0;
    for (const [dir, name] of wanted) {
        const key = `${dir}/${name}`;
        const end = reply.indexOf('\n', pos);
        if (end < 0) break;
        const header = reply.toString('utf8', pos, end);
        const size = header.endsWith(' missing')
            ? 0
            : Number(header.split(' ')[2]);
        blobs.set(key, reply.toString('utf8', end + 1, end + 1 + size));
        pos = end + 1 + size + (header.endsWith(' missing') ? 0 : 1);
    }
    return {
        archiveNames,
        names,
        text: (dir, name) => blobs.get(`${dir}/${name}`) ?? '',
    };
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
    if (process.argv.includes('--triaged')) {
        const unkept = unkeptStale(tasks, today);
        if (unkept.length > 0) {
            console.log(
                `🔴 --triaged refused: ${unkept.join(', ')} untouched ${STALE_AFTER_DAYS}+ days with no «kept: ${today} — <why>» line — add it, or move the item to linear`,
            );
            process.exit(1);
        }
        writeFileSync(stamp, `${today}\n`);
    }
    const lastTriage = existsSync(stamp)
        ? readFileSync(stamp, 'utf8').trim()
        : '';
    // done items are read too: a done item still listed is the only witness of its W-lines' copy
    const { closed, wishBlocks } = readTickets([
        ...new Set(tasks.flatMap(({ text }) => ticketsOf(text))),
    ]);
    const problems = checkPocket(
        readFileSync(join(root, 'backlog.config.yml'), 'utf8'),
        tasks,
        today,
        lastTriage,
        groomedOnDisk,
        closed,
        wishBlocks,
    );
    const head = headFromGit(root);
    problems.push(
        ...auditAgainstHead(
            tasks,
            readDir(join(root, 'pocket', 'archive', 'tasks')),
            head,
        ),
    );
    if (problems.length === 0) {
        console.log(`pocket: ${tasks.length} tasks, all checks green`);
    }
    for (const problem of problems) console.log(`🔴 ${problem}`);
    process.exitCode = problems.length === 0 ? 0 : 1;
}

/* Types */

interface Head {
    archiveNames: string[];
    names: string[];
    text: (dir: 'tasks' | 'archive', name: string) => string;
}

interface LinearRead {
    data: {
        tickets: { id: string; stateType: string; description?: string }[];
    };
}

interface Task {
    name: string;
    text: string;
}
