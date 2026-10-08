// pnpm mods:writes [days] — the fleet's file writes by channel, from the cc transcripts
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { writtenPaths } from './x-mod-guard/hooks/rules.ts';

const days = Number(process.argv[2] ?? 7);
if (!Number.isInteger(days) || days < 1) {
    console.error('usage: pnpm mods:writes [days]  (a whole number ≥ 1)');
    process.exit(2);
}
const since = Date.now() - days * 24 * 60 * 60 * 1000;
const root = join(homedir(), '.claude', 'projects');

// the round-1 classes (2026-10-05), so a later count compares with the 37 % baseline
const SHAPES: [string, RegExp][] = [
    ['edit-anchored', /edit-anchored|edit-batch/],
    ['sd', /\bsd\s/],
    ['sed -i', /sed -i|perl -pi/],
    ['python', /open\([^)]*['"][wa]['"]|write_text\(|\.write\(/],
    ['heredoc / > / tee', /cat\s*>\s*[^&\s]|<<[^\n]*>\s*[^&\s]|\btee\s/],
];

type Use = { name?: string; input?: { command?: unknown } };
const counts = new Map<string, number>();
let read = 0;
const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);

async function* transcripts(dir: string): AsyncGenerator<string> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) yield* transcripts(path);
        else if (
            entry.name.endsWith('.jsonl') &&
            (await stat(path)).mtimeMs >= since
        )
            yield path;
    }
}

function tally(use: Use) {
    if (/^(Edit|Write|NotebookEdit|MultiEdit)$/.test(use.name ?? '')) {
        bump('Edit/Write');
        return;
    }
    const command = use.input?.command;
    if (use.name !== 'Bash' || typeof command !== 'string') return;
    const shape = SHAPES.find(([, re]) => re.test(command));
    if (!shape) return;
    bump(`bash: ${shape[0]}`);
    bump('bash');
    if (writtenPaths(command, '/').length) read++;
}

for await (const file of transcripts(root)) {
    const lines = createInterface({ input: createReadStream(file) });
    for await (const line of lines) {
        if (!line.includes('"tool_use"')) continue;
        try {
            const row = JSON.parse(line) as {
                type?: string;
                timestamp?: string;
                message?: { content?: unknown };
            };
            if (row.type !== 'assistant') continue;
            if (Date.parse(row.timestamp ?? '') < since) continue;
            const content = row.message?.content;
            if (!Array.isArray(content)) continue;
            for (const block of content as { type?: string }[])
                if (block.type === 'tool_use') tally(block as Use);
        } catch {
            // a torn line from a live session
        }
    }
}

const tool = counts.get('Edit/Write') ?? 0;
const bash = counts.get('bash') ?? 0;
const pct = (n: number, of: number) =>
    of ? `${Math.round((n / of) * 100)} %` : '—';
console.log(`last ${days} days — ~/.claude/projects transcripts`);
console.log(`- Edit/Write: ${tool}`);
console.log(`- Bash writes: ${bash} (${pct(bash, tool + bash)} of all writes)`);
for (const [k, n] of [...counts].filter(([k]) => k.startsWith('bash: ')))
    console.log(`  - ${k.slice(6)}: ${n}`);
console.log(
    `- the holds Bash veto reads ${read} of them (${pct(read, bash)}); the rest pass unguarded`,
);
