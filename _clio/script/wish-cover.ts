// usage: node script/wish-cover.ts --audit-week   the weekly wish-loss audit: every grill, brief and spec under a .scratch of frame and bytes touched in 7 days, checked against each home its wish: line names; exits 1 on a red
//        node script/wish-cover.ts <PK-N|FRM-N|BYT-N> [--all] <draft…> — an FRM id resolves to the ticket's «## wish» block (x linear read), else to the one pocket item whose «ticket:» or «moved to linear:» line names it; a block with no W-lines exits 2; reds every cited W-line whose text no draft carries; --all also reds a W-line no draft cites
import { execFileSync, spawnSync } from 'node:child_process';
import {
    existsSync,
    globSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
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
    // a twin under the same stamp is one prompt recorded twice (a typo'd copy kept by append-only notes), not two wishes
    const entries = [
        ...item.matchAll(
            /^\s*[-*]?\s*(?:((?:PK|FRM|BYT)-\d+):)?(W\d+)\b(?:\s*(\([^)]*\)))?/gm,
        ),
    ]
        .filter((m) => !isForeign(m[1], homes))
        .map((m) => `${m[2]} ${m[3] ?? `#${m.index}`}`);
    const ids = [...new Set(entries)].map((entry) => entry.split(' ')[0]);
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
            // linear rewrites a bare issue url into [ID](url): both read as the id
            .replace(
                /https:\/\/linear\.app\/[\w-]+\/issue\/([A-Z]+-\d+)[^\s)]*/g,
                '$1',
            )
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
    // an id a W-line's own words mention («moved here as its W14») rides the verbatim copy, never cites
    const quoted = citedIds([...lines.values()].join('\n'));
    return [...citedIds(joined, homes)].flatMap((id): [string, string][] => {
        const text = lines.get(id);
        if (text === undefined)
            return quoted.has(id) ? [] : [[id, '(no such W-line in the item)']];
        if (text === '') return [[id, '']];
        return body.includes(normalize(text)) ? [] : [[id, text]];
    });
}

// the stub a wish keeps where a line moved: «moved → FRM-585:W19», the new home and its line
export function movedStub(text: string) {
    const match = /^moved\s*(?:→|->|to)\s*((?:PK|FRM|BYT)-\d+):(W\d+)\b/i.exec(
        text,
    );
    return match?.[1] && match[2]
        ? { home: match[1].toUpperCase(), id: match[2] }
        : null;
}

// a pocket item closed whole as «close: … PK-363:W1–W1166 moved to FRM-616»: the new home, which no line-by-line check follows
export function movedWhole(item: string, id: string) {
    const own = id.replace(/[^\w-]/g, '');
    return new RegExp(
        `^close:.*\\b${own}:W\\d+\\s*[–-]\\s*W\\d+ moved to ((?:PK|FRM|BYT)-\\d+)`,
        'im',
    )
        .exec(item)?.[1]
        ?.toUpperCase();
}

// one hop: a cited line that is a stub is checked at its new home; a home or line that cannot be matched is «not re-checked»
export function followMoved(
    missing: [string, string][],
    draft: string,
    lookup: (home: string, lineId: string) => string | undefined,
) {
    const body = normalize(draft);
    const rest: [string, string][] = [];
    const unchecked = new Set<string>();
    for (const [id, text] of missing) {
        const stub = movedStub(text);
        if (!stub) {
            rest.push([id, text]);
            continue;
        }
        const there = lookup(stub.home, stub.id);
        if (!there || movedStub(there)) unchecked.add(stub.home);
        else if (!body.includes(normalize(there)))
            rest.push([id, `${stub.home}:${stub.id} ${there}`]);
    }
    return { rest, unchecked: [...unchecked] };
}

// a line he settled elsewhere says so: «→ FRM-585» (moved, answered, dropped on his word) is no loss for --all to red
const settledElsewhere = /→\s*(?:PK|FRM|BYT)-\d+/;

export function uncovered(
    item: string,
    drafts: string[],
    homes: string[] = [],
) {
    const cited = citedIds(drafts.join('\n'), homes);
    return [...wishLines(item, homes)].filter(
        ([id, text]) => !cited.has(id) && !settledElsewhere.test(text),
    );
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

// a ticket's wish block read through x, undefined when the read fails
function linearWish(id: string) {
    try {
        const read = JSON.parse(
            execFileSync('x', ['linear', 'read', id], {
                encoding: 'utf8',
                timeout: 15_000,
            }),
        );
        return wishBlock(read.data.tickets[0].description ?? '');
    } catch {
        return undefined;
    }
}

function readItem(items: [string, string][], id: string) {
    return items.find(([file]) =>
        file.toLowerCase().startsWith(`${id.toLowerCase()} - `),
    )?.[1];
}

// a first use of a wish: a grill round, a brief or a spec, under any .scratch of frame, its worktrees or bytes
const FIRST_USE = /(?:^|\/)(?:grill-[\w-]*proposal|[\w-]*brief|spec)\.md$/;

export function weekDrafts(roots: string[], now = Date.now()) {
    const since = now - 7 * 24 * 60 * 60 * 1000;
    return roots
        .filter((root) => existsSync(root))
        .flatMap((root) =>
            globSync('**/.scratch/**/*.md', {
                cwd: root,
                exclude: (name) => name === 'node_modules' || name === '.git',
            }).map((rel) => path.join(root, rel)),
        )
        .filter(
            (file) => FIRST_USE.test(file) && statSync(file).mtimeMs >= since,
        )
        .sort();
}

const WISH_ID_LINE = /^wish: *\[?((?:PK|FRM|BYT)-\d+)/i;

// each home a draft's wish lines name, with its section, read the way wish-cover-on-write.sh reads it: the lines above
// the first wish line join its section, an id beside another on one line gets the whole draft; `none` only while no id
// line exists anywhere and a `wish: none` sits in the first 10 lines; undefined for neither
export function draftSections(text: string) {
    const lines = text.split('\n');
    const idLines = lines.filter((line) => WISH_ID_LINE.test(line));
    if (idLines.length === 0) {
        return lines.slice(0, 10).some((line) => /^wish: *none/i.test(line))
            ? ('none' as const)
            : undefined;
    }
    const sections = new Map<string, string>();
    let current = '';
    let pre = '';
    for (const line of lines) {
        current = WISH_ID_LINE.exec(line)?.[1]?.toUpperCase() ?? current;
        if (!current) {
            pre += `${line}\n`;
            continue;
        }
        sections.set(current, `${sections.get(current) ?? pre}${line}\n`);
    }
    for (const id of idLines.flatMap(
        (line) => line.toUpperCase().match(/\b(?:PK|FRM|BYT)-\d+\b/g) ?? [],
    ))
        if (!sections.has(id)) sections.set(id, text);
    return sections;
}

function auditWeek() {
    const home = homedir();
    const roots = [path.join(home, 'frame'), path.join(home, 'projects/bytes')];
    const scratch = mkdtempSync(path.join(tmpdir(), 'wish-audit-'));
    const rows = weekDrafts(roots).flatMap((file) => {
        const sections = draftSections(readFileSync(file, 'utf8'));
        if (sections === undefined) return [[file, '-', 'no wish line']];
        if (sections === 'none') return [[file, 'none', 'wish: none']];
        return [...sections].map(([id, section], i) => {
            const draft = path.join(scratch, `${i}-${id}.md`);
            writeFileSync(draft, section);
            const run = spawnSync(
                process.execPath,
                [import.meta.filename, id, draft],
                { encoding: 'utf8', timeout: 60_000 },
            );
            const home = /moved, not re-checked: (\S+)/.exec(run.stdout)?.[1];
            if (run.status === 3 && home)
                return [file, id, `moved, not re-checked: ${home}`];
            return [file, id, run.status === 0 ? 'green' : 'red'];
        });
    });
    rmSync(scratch, { recursive: true });
    for (const row of rows) console.log(row.join('\t'));
    const red = rows.filter((row) => row[2] === 'red').length;
    console.log(
        `${rows.length} checked · ${rows.filter((row) => row[2] === 'green').length} green · ${red} red · ${rows.filter((row) => row[2]?.startsWith('moved, not re-checked')).length} moved, not re-checked · ${rows.filter((row) => row[1] === 'none').length} wish: none · ${rows.filter((row) => row[1] === '-').length} no wish line`,
    );
    process.exit(red > 0 ? 1 : 0);
}

if (import.meta.main) {
    const args = process.argv.slice(2);
    if (args[0] === '--audit-week') auditWeek();
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
    // a moved item replaces a red only: a check that still passes stays green
    const movedHome = movedWhole(item, id);
    const stopIfMoved = () => {
        if (!movedHome) return;
        console.log(`${id}: moved, not re-checked: ${movedHome}`);
        process.exit(3);
    };
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
        stopIfMoved();
        console.log(
            `✗ ${id}: ${repeated.join(', ')} numbered twice — renumber the joined lines from the block's next free W`,
        );
        process.exit(1);
    }
    if (citedIds(drafts.join('\n'), homes).size === 0) {
        stopIfMoved();
        console.log(`✗ ${id}: cites no W-line`);
        process.exit(1);
    }
    const linearHomes = new Map<string, string | undefined>();
    const { rest: missing, unchecked } = followMoved(
        missingText(item, drafts, homes),
        drafts.join('\n'),
        (home, lineId) => {
            if (!/^(FRM|BYT)-/i.test(home))
                return wishLines(readItem(items, home) ?? '', [home]).get(
                    lineId,
                );
            if (!linearHomes.has(home)) linearHomes.set(home, linearWish(home));
            return wishLines(linearHomes.get(home) ?? '', [home]).get(lineId);
        },
    );
    const uncited = all ? uncovered(item, drafts, homes) : [];
    if (missing.length + uncited.length > 0) stopIfMoved();
    for (const [lineId, text] of missing)
        console.log(
            text === ''
                ? `✗ ${id}:${lineId} has no text`
                : `✗ ${id}:${lineId} text missing: ${text.slice(0, 60)}`,
        );
    for (const [lineId, text] of uncited)
        console.log(`✗ ${id}:${lineId} uncited: ${text.slice(0, 60)}`);
    if (missing.length + uncited.length === 0) {
        if (unchecked.length > 0) {
            console.log(
                `${id}: moved, not re-checked: ${unchecked.join(', ')}`,
            );
            process.exit(3);
        }
        console.log(`${id}: every cited W-line's text is in the drafts`);
        process.exit(0);
    }
    console.log(
        `${id}: ${missing.length} W-line(s) reworded or dropped, ${uncited.length} uncited — copy the wish's words verbatim`,
    );
    process.exit(1);
}
