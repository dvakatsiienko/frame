// replay real Bash commands from session transcripts through x-mod-guard's hints, so a new hint is seen against the
// commands the fleet actually runs before it ships (retro 10-14: the rg hint fired falsely twice in its first hour)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { hints } from './x-mod-guard/hooks/rules/hint.ts';

export function bashCalls(jsonl: string) {
    const calls: Call[] = [];
    for (const line of jsonl.split('\n')) {
        if (!line.includes('"Bash"')) continue;
        let record: Row;
        try {
            record = JSON.parse(line) as Row;
        } catch {
            continue;
        }
        for (const item of record.message?.content ?? [])
            if (
                item.type === 'tool_use' &&
                item.name === 'Bash' &&
                item.input?.command
            )
                calls.push({
                    command: item.input.command,
                    cwd: record.cwd ?? '/',
                });
    }
    return calls;
}

export function tally(calls: Call[], home: string) {
    const fired = new Map<string, string[]>();
    for (const { command, cwd } of calls)
        for (const hint of hints(command, cwd, { home })) {
            const seen = fired.get(hint) ?? [];
            seen.push(command.split('\n')[0]?.slice(0, 120) ?? '');
            fired.set(hint, seen);
        }
    return fired;
}

function recentTranscripts(days: number) {
    const root = path.join(homedir(), '.claude/projects');
    const since = Date.now() - days * 86_400_000;
    return readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.jsonl'))
        .map((e) => path.join(e.parentPath, e.name))
        .filter((f) => statSync(f).mtimeMs >= since);
}

if (import.meta.main) {
    const days = Number(process.argv[2] ?? 2);
    const calls = recentTranscripts(days).flatMap((f) =>
        bashCalls(readFileSync(f, 'utf8')),
    );
    const fired = tally(calls, homedir());
    console.log(
        `replay: ${calls.length} Bash calls from the last ${days} days`,
    );
    for (const [hint, commands] of [...fired].sort(
        (a, b) => b[1].length - a[1].length,
    )) {
        console.log(
            `\n${commands.length} (${((100 * commands.length) / calls.length).toFixed(1)} %) ${hint.slice(0, 90)}`,
        );
        for (const c of commands.slice(0, 3)) console.log(`  · ${c}`);
    }
}

/* Types */

type Call = { command: string; cwd: string };
type Row = {
    cwd?: string;
    message?: {
        content?: {
            type: string;
            name?: string;
            input?: { command?: string };
        }[];
    };
};
