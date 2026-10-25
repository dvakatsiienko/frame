// usage: node script/wish-cover.ts <PK-N|FRM-N> [--all] <draft…> — an FRM id resolves to the one pocket item whose «ticket:» or «moved to linear:» line names it, else to the ticket's «## wish» block (x linear read); reds every cited W-line whose text no draft carries; --all also reds a W-line no draft cites
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { TICKET_LINE } from './pocket-check.ts';

const pocketDirs = ['pocket/tasks', 'pocket/archive/tasks'];

export function wishLines(item: string) {
    const lines = new Map<string, string>();
    for (const match of item.matchAll(/^\s*[-*]?\s*(W\d+)\b[ \t]*(.*)$/gm)) {
        const [, id, text] = match;
        // a leading «(Q1)» or «(band 4)» is cclio's source tag, never his words
        if (id && !lines.has(id))
            lines.set(id, (text ?? '').replace(/^\(.*?\)\s*/, '').trim());
    }
    return lines;
}

// the «## wish» block of a ticket body, up to the next heading
export function wishBlock(body: string) {
    return /^## wish\s*$([\s\S]*?)(?=^## |(?![\s\S]))/im.exec(body)?.[1] ?? '';
}

// a single id; the ends of a range like «W1–W3» cite nothing
const WISH_ID = /(?<!W?\d+\s*[–-]\s*)\bW\d+\b(?!\s*[–-]\s*W?\d)/g;

export function citedIds(draft: string) {
    return new Set(draft.match(WISH_ID));
}

function normalize(text: string) {
    return text
        .replace(/\[[^\]]*\]\(<?([^)>\s]+)>?\)|<(https?:[^>\s]+)>/g, '$1$2')
        .toLowerCase()
        .replace(/[«»“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

// cited W-lines whose own text no draft carries
export function missingText(item: string, drafts: string[]) {
    const joined = drafts.join('\n');
    const body = normalize(joined);
    const lines = wishLines(item);
    return [...citedIds(joined)].flatMap((id): [string, string][] => {
        const text = lines.get(id);
        if (text === undefined) return [[id, '(no such W-line in the item)']];
        if (text === '') return [[id, '']];
        return body.includes(normalize(text)) ? [] : [[id, text]];
    });
}

export function uncovered(item: string, drafts: string[]) {
    const cited = citedIds(drafts.join('\n'));
    return [...wishLines(item)].filter(([id]) => !cited.has(id));
}

function pocketItems(root: string) {
    return pocketDirs.flatMap((dir) => {
        const abs = path.join(root, dir);
        return readdirSync(abs).map((file): [string, string] => [
            file,
            readFileSync(path.join(abs, file), 'utf8'),
        ]);
    });
}

// the PK ids of the pocket items whose «ticket:» or «moved to linear:» line names this FRM id
export function itemsForTicket(items: [string, string][], ticket: string) {
    return items
        .filter(([, text]) =>
            [...text.matchAll(TICKET_LINE)].some(
                ([, id]) => id?.toUpperCase() === ticket.toUpperCase(),
            ),
        )
        .map(([file]) => file.split(' - ')[0]?.toUpperCase() ?? file);
}

function readItem(items: [string, string][], id: string) {
    return items.find(([file]) =>
        file.toLowerCase().startsWith(`${id.toLowerCase()} - `),
    )?.[1];
}

if (import.meta.main) {
    const args = process.argv.slice(2);
    const all = args.includes('--all');
    const [id, ...draftPaths] = args.filter((arg) => arg !== '--all');
    if (!id || draftPaths.length === 0) {
        console.error(
            'usage: node script/wish-cover.ts <PK-N|FRM-N> [--all] <draft…>',
        );
        process.exit(2);
    }
    const items = pocketItems(path.resolve(import.meta.dirname, '..'));
    let item: string | undefined;
    if (/^FRM-\d+$/i.test(id)) {
        const owners = itemsForTicket(items, id);
        if (owners.length > 1) {
            console.error(
                `${id}: several pocket items carry it (${owners.join(', ')}) — name the PK id on the wish line`,
            );
            process.exit(2);
        }
        item = owners[0] && readItem(items, owners[0]);
        if (item === undefined || wishLines(item).size === 0) {
            try {
                const read = JSON.parse(
                    execFileSync('x', ['linear', 'read', id], {
                        encoding: 'utf8',
                        timeout: 15_000,
                    }),
                );
                item = wishBlock(read.data.tickets[0].description ?? '');
            } catch (error) {
                console.error(`${id}: x linear read failed — ${error}`);
                process.exit(2);
            }
        }
    } else {
        item = readItem(items, id);
    }
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
    if (citedIds(drafts.join('\n')).size === 0) {
        console.log(`✗ ${id}: cites no W-line`);
        process.exit(1);
    }
    const missing = missingText(item, drafts);
    for (const [lineId, text] of missing)
        console.log(
            text === ''
                ? `✗ ${lineId} has no text`
                : `✗ ${lineId} text missing: ${text.slice(0, 60)}`,
        );
    const uncited = all ? uncovered(item, drafts) : [];
    for (const [lineId, text] of uncited)
        console.log(`✗ ${lineId} uncited: ${text.slice(0, 60)}`);
    if (missing.length + uncited.length === 0) {
        console.log(`${id}: every cited W-line's text is in the drafts`);
        process.exit(0);
    }
    console.log(
        `${id}: ${missing.length} W-line(s) reworded or dropped, ${uncited.length} uncited — copy the wish's words verbatim`,
    );
    process.exit(1);
}
