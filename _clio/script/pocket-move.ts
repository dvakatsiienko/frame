// moves a pocket item to another priority and the end of that band's order, so pocket-check stays green:
// usage: node pocket-move.ts <PK-N> now|next|later
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { ordinalFor, ordinals } from './pocket-add.ts';

const pocket = path.resolve(import.meta.dirname, '..');
const priorities = ['now', 'next', 'later'] as const;

if (import.meta.main) {
    const [id, priority] = process.argv.slice(2);
    if (!id || !/^PK-\d+$/i.test(id) || !isPriority(priority)) {
        console.error('usage: node pocket-move.ts <PK-N> now|next|later');
        process.exit(2);
    }
    const ordinal = ordinalFor(ordinals(id), priority);
    execFileSync(
        'backlog',
        [
            'task',
            'edit',
            id.toUpperCase(),
            '--priority',
            priority,
            '--ordinal',
            String(ordinal),
        ],
        { encoding: 'utf8', env: { ...process.env, BACKLOG_CWD: pocket } },
    );
    console.log(`${id.toUpperCase()} → ${priority} (ordinal ${ordinal})`);
    try {
        execFileSync('node', [path.join(pocket, 'script/pocket-check.ts')], {
            stdio: 'inherit',
        });
    } catch {
        process.exitCode = 1;
    }
}

function isPriority(
    value: string | undefined,
): value is (typeof priorities)[number] {
    return priorities.includes(value as (typeof priorities)[number]);
}
