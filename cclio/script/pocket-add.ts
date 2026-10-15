// a pocket item born green (PK-137): `backlog task create` sets none of the fields pocket-check requires, so this
// wrapper fills them — status open, a priority with its ordinal band, a type, one size, a due date on xs/s
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const PRIORITIES = ['now', 'next', 'later'] as const;
const pocket = path.resolve(import.meta.dirname, '..');

export function ordinalFor(ordinals: number[], priority: Priority) {
    const band = PRIORITIES.indexOf(priority);
    const floor = 1000 * 10 ** band;
    const ceiling = floor * 10;
    const inBand = ordinals.filter((n) => n >= floor && n < ceiling);
    const next = (inBand.length ? Math.max(...inBand) : floor) + 1000;
    return next < ceiling ? next : ceiling - 1;
}

export function dueFor(size: string, today: string) {
    if (size !== 'xs' && size !== 's') return undefined;
    const day = new Date(`${today}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + (size === 'xs' ? 1 : 3));
    return day.toISOString().slice(0, 10);
}

function ordinals() {
    const dir = path.join(pocket, 'pocket/tasks');
    return readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
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
            priority: { default: 'later', type: 'string' },
            size: { default: 's', type: 'string' },
            type: { default: 'task', type: 'string' },
        },
    });
    const [title] = positionals;
    const priority = values.priority as Priority;
    if (!title || !PRIORITIES.includes(priority)) {
        console.error(
            'usage: node pocket-add.ts "<title>" [-d <desc>] [--size xs|s|m|l] [--priority now|next|later] [--type task] [--due YYYY-MM-DD]',
        );
        process.exit(2);
    }
    const due =
        values.due ?? dueFor(values.size, new Date().toLocaleDateString('sv'));
    const args = [
        'task',
        'create',
        title,
        '-s',
        'open',
        '-l',
        values.size,
        '--priority',
        priority,
        '--type',
        values.type,
        '--ordinal',
        String(ordinalFor(ordinals(), priority)),
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
