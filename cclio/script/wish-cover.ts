// usage: node script/wish-cover.ts <PK-N> <draft…> — reds every W-line of the pocket item no draft cites
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const pocketDirs = ['pocket/tasks', 'pocket/archive/tasks'];

export function wishLines(item: string) {
    const lines = new Map<string, string>();
    for (const match of item.matchAll(/^\s*-?\s*(W\d+)\b\s*(.*)$/gm)) {
        const [, id, text] = match;
        if (id && !lines.has(id)) lines.set(id, text?.trim() ?? '');
    }
    return lines;
}

export function citedIds(draft: string) {
    const cited = new Set<string>();
    for (const [, from, to] of draft.matchAll(
        /\bW(\d+)(?:\s*[–-]\s*W?(\d+))?\b/g,
    )) {
        const start = Number(from);
        const end = to === undefined ? start : Number(to);
        for (let n = start; n <= end; n++) cited.add(`W${n}`);
    }
    return cited;
}

export function uncovered(item: string, drafts: string[]) {
    const cited = citedIds(drafts.join('\n'));
    return [...wishLines(item)].filter(([id]) => !cited.has(id));
}

function readItem(root: string, id: string) {
    for (const dir of pocketDirs) {
        const abs = path.join(root, dir);
        for (const file of readdirSync(abs)) {
            if (!file.toLowerCase().startsWith(`${id.toLowerCase()} - `))
                continue;
            return readFileSync(path.join(abs, file), 'utf8');
        }
    }
    return undefined;
}

if (import.meta.main) {
    const [id, ...draftPaths] = process.argv.slice(2);
    if (!id || draftPaths.length === 0) {
        console.error('usage: node script/wish-cover.ts <PK-N> <draft…>');
        process.exit(2);
    }
    const root = path.resolve(import.meta.dirname, '..');
    const item = readItem(root, id);
    if (item === undefined) {
        console.error(`${id}: no pocket item`);
        process.exit(2);
    }
    if (wishLines(item).size === 0) {
        console.error(
            `${id}: no W-lines — fold the wish into numbered W1… lines first`,
        );
        process.exit(2);
    }
    const drafts = draftPaths.map((p) => readFileSync(p, 'utf8'));
    const missing = uncovered(item, drafts);
    if (missing.length === 0) {
        console.log(`${id}: every W-line cited`);
        process.exit(0);
    }
    for (const [lineId, text] of missing) console.log(`✗ ${lineId} ${text}`);
    console.log(
        `${id}: ${missing.length} W-line(s) no draft cites — ask them, or mark «settled by the wish»`,
    );
    process.exit(1);
}
