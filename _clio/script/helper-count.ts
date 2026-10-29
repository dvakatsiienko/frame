// helper and helper-lite spawns per live session since a time (default today 00:00 local): node helper-count.ts [--since <ISO or HH:MM local>]
import { readFileSync, statSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { liveSessions, transcriptOf } from './session-registry.ts';

function sinceOf(arg: string | undefined): Date {
    const clock = arg?.match(/^(\d{1,2}):(\d{2})$/);
    if (clock) {
        const day = new Date();
        day.setHours(Number(clock[1]), Number(clock[2]), 0, 0);
        return day;
    }
    if (arg) return new Date(arg);
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return midnight;
}

function countSpawns(path: string, since: Date): Record<string, number> {
    const counts: Record<string, number> = { helper: 0, 'helper-lite': 0 };
    const seen = new Set<string>();
    for (const row of readFileSync(path, 'utf8').split('\n')) {
        if (!row.includes('"subagent_type"')) continue;
        const entry = JSON.parse(row) as Entry;
        if (
            entry.type !== 'assistant' ||
            new Date(entry.timestamp ?? 0) < since
        )
            continue;
        for (const block of entry.message?.content ?? []) {
            const kind = block.input?.subagent_type ?? '';
            if (block.type !== 'tool_use' || !block.id || seen.has(block.id))
                continue;
            if (kind in counts) counts[kind] = (counts[kind] ?? 0) + 1;
            seen.add(block.id);
        }
    }
    return counts;
}

if (import.meta.main) {
    const { values } = parseArgs({ options: { since: { type: 'string' } } });
    const since = sinceOf(values.since);
    for (const session of liveSessions()) {
        const path = transcriptOf(session.sessionId);
        if (!path || statSync(path).mtime < since) continue;
        const counts = countSpawns(path, since);
        console.log(
            `${session.name ?? session.cwd} · helper ${counts.helper} · helper-lite ${counts['helper-lite']}`,
        );
    }
}

/* Types */

interface Entry {
    message?: {
        content?: {
            id?: string;
            input?: { subagent_type?: string };
            type: string;
        }[];
    };
    timestamp?: string;
    type: string;
}
