// a pocket item born green (PK-137): `backlog task create` sets none of the fields pocket-check requires, so this
// wrapper fills them — status open, a priority with its ordinal band, a type, one size; a due date only when asked
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const PRIORITIES = ['now', 'next', 'later'] as const;
const pocket = path.resolve(import.meta.dirname, '..');

export function ordinalFor(
    ordinals: number[],
    priority: Priority,
    top = false,
) {
    const band = PRIORITIES.indexOf(priority);
    const floor = 1000 * 10 ** band;
    const ceiling = floor * 10;
    const inBand = ordinals.filter((n) => n >= floor && n < ceiling);
    if (top)
        return Math.max(
            floor,
            (inBand.length ? Math.min(...inBand) : floor + 1) - 1,
        );
    const next = (inBand.length ? Math.max(...inBand) : floor) + 1000;
    return next < ceiling ? next : ceiling - 1;
}

// the first three words over 4 characters; empty when the title has none
export function searchTerm(title: string) {
    return title
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 3)
        .join(' ');
}

export function ordinals(skip?: string) {
    const dir = path.join(pocket, 'pocket/tasks');
    return readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .filter((f) => !skip || !f.startsWith(`${skip.toLowerCase()} - `))
        .map(
            (f) =>
                readFileSync(path.join(dir, f), 'utf8').match(
                    /^ordinal: (\d+)/m,
                )?.[1],
        )
        .filter((n) => n !== undefined)
        .map(Number);
}

if (import.meta.main) {
    const { positionals, values } = parseArgs({
        allowPositionals: true,
        options: {
            desc: { short: 'd', type: 'string' },
            due: { type: 'string' },
            priority: { default: 'next', type: 'string' },
            // a side channel's item; the main's boot takes it over (FRM-464)
            side: { type: 'boolean' },
            size: { default: 's', type: 'string' },
            top: { type: 'boolean' },
            type: { default: 'task', type: 'string' },
        },
    });
    const [title] = positionals;
    const priority = values.priority as Priority;
    // the sizes backlog.config.yml labels; an l never lands, it is a linear ticket to split
    if (
        !title ||
        !PRIORITIES.includes(priority) ||
        !['xs', 's', 'm'].includes(values.size)
    ) {
        console.error(
            'usage: node pocket-add.ts "<title>" [-d <desc>] [--size xs|s|m] [--priority now|next|later] [--top] [--side] [--type task] [--due YYYY-MM-DD]',
        );
        process.exit(2);
    }
    const due = values.due;
    // the birth test (dima, 2026-10-25): linear may already own this outcome; a nudge, never a stop — the inbox net lands every item
    const words = searchTerm(title);
    if (!words)
        console.error('linear: no search words in the title, not checked');
    else
        try {
            const out = execFileSync(
                'x',
                ['linear', 'list', '--search', words, '--json'],
                { encoding: 'utf8', timeout: 15000 },
            );
            const hits = (JSON.parse(out).data?.tickets ?? [])
                .filter(
                    (t: { stateType?: string }) =>
                        !['completed', 'canceled'].includes(t.stateType ?? ''),
                )
                .slice(0, 3);
            for (const hit of hits)
                console.error(
                    `↪ linear may own this: ${hit.id} ${hit.title} — home it there, or keep it here with a note why`,
                );
        } catch (error) {
            console.error(
                `linear: not checked — ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
            );
        }
    const args = [
        'task',
        'create',
        title,
        '-s',
        'open',
        '-l',
        values.side ? `${values.size},side` : values.size,
        '--priority',
        priority,
        '--type',
        values.type,
        '--ordinal',
        String(ordinalFor(ordinals(), priority, values.top)),
        '--plain',
        ...(values.desc ? ['-d', values.desc] : []),
        ...(due ? ['--due-date', due] : []),
    ];
    console.log(
        execFileSync('backlog', args, {
            encoding: 'utf8',
            env: { ...process.env, BACKLOG_CWD: pocket },
        }).split('\n')[0],
    );
    try {
        execFileSync('node', [path.join(pocket, 'script/pocket-check.ts')], {
            stdio: 'inherit',
        });
    } catch {
        process.exitCode = 1;
    }
}

/* Types */

type Priority = (typeof PRIORITIES)[number];
