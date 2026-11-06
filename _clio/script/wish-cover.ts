// usage: node script/wish-cover.ts <PK-N|FRM-N|BYT-N> [--all] <draft…> — an FRM id resolves to the ticket's «## wish» block (x linear read), else to the one pocket item whose «ticket:» or «moved to linear:» line names it; a block with no W-lines exits 2; reds every cited W-line whose text no draft carries; --all also reds a W-line no draft cites
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { TICKET_LINE } from './pocket-check.ts';

const pocketDirs = ['pocket/tasks', 'pocket/archive/tasks'];

// the same line after its bare head gained this home's prefix; another home's prefix is never the same line
export function prefixWish(line: string, home: string) {
    return line.replace(/^(\s*(?:[*-]\s+)?)(W\d+\b)/, `$1${home}:$2`);
}

// a markdown link around an id, directly before «:W4», is the plain id: linear may autolink an id it stores
export function unwrapIds(text: string) {
    return text.replace(/\[([^\]]*)\]\(<?[^)>\s]+>?\)(?=:W\d)/g, '$1');
}

// a head carrying another home's prefix is a quote of that home's line, never this one's
function isForeign(prefix: string | undefined, homes: string[]) {
    return (
        Boolean(prefix) &&
        homes.length > 0 &&
        !homes.some((home) => home.toUpperCase() === prefix?.toUpperCase())
    );
}

export function wishLines(item: string, homes: string[] = []) {
    const lines = new Map<string, string>();
    for (const match of item.matchAll(
        /^\s*[-*]?\s*(?:((?:PK|FRM|BYT)-\d+):)?(W\d+)\b[ \t]*(.*)$/gm,
    )) {
        const [, prefix, id, text] = match;
        if (isForeign(prefix, homes)) continue;
        // a leading «(Q1)» or «(band 4)» is clio's source tag, never his words
        if (id && !lines.has(id))
            lines.set(id, (text ?? '').replace(/^\(.*?\)\s*:?\s*/, '').trim());
    }
    return lines;
}

// a wish joining an old block that restarts at W1 hides its lines behind the first of each number
export function repeatedIds(item: string, homes: string[] = []) {
    const ids = [
        ...item.matchAll(/^\s*[-*]?\s*(?:((?:PK|FRM|BYT)-\d+):)?(W\d+)\b/gm),
    ]
        .filter((m) => !isForeign(m[1], homes))
        .map((m) => m[2]);
    return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}

// the «## wish» block of a ticket body, up to the next heading
export function wishBlock(body: string) {
    return unwrapIds(
        /^## wish\s*$([\s\S]*?)(?=^## |(?![\s\S]))/im.exec(body)?.[1] ?? '',
    );
}

// a single id, bare or «PK-159:W3»; the ends of a range like «W1–W3» cite nothing, and a range never spans a line break;
// a bare cite is this home's, a prefixed one counts only when its home is in homes, else it is another item's
export function citedIds(draft: string, homes: string[] = []) {
    const own = homes.map((home) => home.toUpperCase());
    const ids = new Set<string>();
    for (const [, home, id] of unwrapIds(draft).matchAll(
        /(?<!W?\d+[ \t]*[–-][ \t]*)(?:\b((?:PK|FRM|BYT|pk|frm|byt)-\d+):|(?<!:))\b(W\d+)\b(?![ \t]*[–-][ \t]*(?:(?:PK|FRM|BYT)-\d+:)?W?\d)/g,
    ))
        if (id && (!home || own.includes(home.toUpperCase()))) ids.add(id);
    return ids;
}

// a lane spec holds one section per chunk, each opening with its own «wish: <id>» line:
// the parts of the draft under this id's wish lines (the text above the first one joins the first part); a draft with none of them is whole
export function sectionsFor(draft: string, id: string) {
    // the id may be a ticket link: «wish: [FRM-4](https://…)»
    const parts = draft.split(/^(?=wish: *\[?(?:PK|FRM|BYT)-\d+)/im);
    const head = /^wish:/i.test(parts[0] ?? '') ? '' : (parts.shift() ?? '');
    if (parts.length === 0) return draft;
    const mine = new RegExp(`^wish: *\\[?${id}\\b`, 'i');
    const picked = parts
        .map((part, at) =>
            mine.test(part) ? (at === 0 ? head : '') + part : '',
        )
        .filter(Boolean);
    return picked.length > 0 ? picked.join('\n') : draft;
}

export function normalize(text: string) {
    return (
        text
            // linear escapes markdown it would otherwise render: \[ \] \_ \* \` \~ and the rest
            .replace(/\\([[\]_*`#~<>|+.!-])/g, '$1')
            // linear autolinks a bare id, url or domain as [text](<url>): its text is what was written
            .replace(/\[([^\]]*)\]\(<?[^)>\s]+>?\)|<(https?:[^>\s]+)>/g, '$1$2')
            .toLowerCase()
            .replace(/[«»“”]/g, '"')
            .replace(/[‘’]/g, "'")
            .replace(/\s+/g, ' ')
            .trim()
    );
}

// cited W-lines whose own text no draft carries
export function missingText(
    item: string,
    drafts: string[],
    homes: string[] = [],
) {
    const joined = drafts.join('\n');
    const body = normalize(joined);
    const lines = wishLines(item, homes);
    return [...citedIds(joined, homes)].flatMap((id): [string, string][] => {
        const text = lines.get(id);
        if (text === undefined) return [[id, '(no such W-line in the item)']];
        if (text === '') return [[id, '']];
        return body.includes(normalize(text)) ? [] : [[id, text]];
    });
}

export function uncovered(
    item: string,
    drafts: string[],
    homes: string[] = [],
) {
    const cited = citedIds(drafts.join('\n'), homes);
    return [...wishLines(item, homes)].filter(([id]) => !cited.has(id));
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
    const homes = [id];
    const isTicket = /^(FRM|BYT)-\d+$/i.test(id);
    if (isTicket) {
        try {
            const read = JSON.parse(
                execFileSync('x', ['linear', 'read', id], {
                    encoding: 'utf8',
                    timeout: 15_000,
                }),
            );
            const ticket = read.data.tickets[0];
            // a closed chunk's section in a lane spec is history: its wish was graded when it landed
            if (
                ['completed', 'canceled', 'duplicate'].includes(
                    ticket.stateType,
                )
            ) {
                console.log(`✓ ${id}: ${ticket.state}, skipped`);
                process.exit(0);
            }
            item = wishBlock(ticket.description ?? '');
        } catch (error) {
            console.error(`${id}: x linear read failed — ${error}`);
            process.exit(2);
        }
        // the ticket's block is the wish's home; one pocket item that carries it stands in only for a block with no W-lines
        if (wishLines(item).size === 0) {
            const owners = itemsForTicket(items, id);
            const owned =
                owners.length === 1 && owners[0]
                    ? readItem(items, owners[0])
                    : undefined;
            item = owned ?? item;
            if (owned && owners[0]) homes.push(owners[0]);
        }
    } else {
        item = readItem(items, id);
    }
    if (item === undefined) {
        console.error(`${id}: no pocket item`);
        process.exit(2);
    }
    const drafts = draftPaths.map((p) =>
        sectionsFor(readFileSync(p, 'utf8'), id),
    );
    if (wishLines(item, homes).size === 0) {
        console.error(
            isTicket
                ? `${id}: number the ticket's wish block into ${id}:W1… lines first`
                : `${id}: no W-lines — fold the wish into numbered ${id}:W1… lines first`,
        );
        process.exit(2);
    }
    const repeated = repeatedIds(item, homes);
    if (repeated.length > 0) {
        console.log(
            `✗ ${id}: ${repeated.join(', ')} numbered twice — renumber the joined lines from the block's next free W`,
        );
        process.exit(1);
    }
    if (citedIds(drafts.join('\n'), homes).size === 0) {
        console.log(`✗ ${id}: cites no W-line`);
        process.exit(1);
    }
    const missing = missingText(item, drafts, homes);
    for (const [lineId, text] of missing)
        console.log(
            text === ''
                ? `✗ ${id}:${lineId} has no text`
                : `✗ ${id}:${lineId} text missing: ${text.slice(0, 60)}`,
        );
    const uncited = all ? uncovered(item, drafts, homes) : [];
    for (const [lineId, text] of uncited)
        console.log(`✗ ${id}:${lineId} uncited: ${text.slice(0, 60)}`);
    if (missing.length + uncited.length === 0) {
        console.log(`${id}: every cited W-line's text is in the drafts`);
        process.exit(0);
    }
    console.log(
        `${id}: ${missing.length} W-line(s) reworded or dropped, ${uncited.length} uncited — copy the wish's words verbatim`,
    );
    process.exit(1);
}
