// a flyway's notes grow every day: the blocks of days before today leave whole into pocket/archive/notes/pk-N.md, oldest first,
// so the item stays short and no note line is ever deleted; every reader of an item's W-lines or done ids reads this file beside it
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const NOTES_BEGIN = '<!-- SECTION:NOTES:BEGIN -->\n';
const NOTES_END = '<!-- SECTION:NOTES:END -->';
// the day a block carries: its own head («done 2026-11-25 …», «hoist 11-25: …»), or a W-line's «(2026-11-25 12:46, …)» stamp
const OWN_DAY = /^(?:done |hoist |reopened )?(\d{4}-\d\d-\d\d)/;
const HOIST_DAY = /^hoist (\d\d-\d\d)\b/;
const STAMP_DAY = /\((\d{4}-\d\d-\d\d) /;
const WISH_HEAD = /^[A-Z]{2,3}-\d+:W/;

// pocketDir is the pocket folder itself, the one holding tasks/ and archive/
export function archivePath(pocketDir: string, id: string): string {
    return path.join(pocketDir, 'archive', 'notes', `${id.toLowerCase()}.md`);
}

export function readArchive(pocketDir: string, id: string): string {
    const file = archivePath(pocketDir, id);
    return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

// the trimmed, non-empty lines of a text: what «this line is held» is judged on
export function lineSet(text: string): Set<string> {
    return new Set(
        text
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
    );
}

export function notesOf(text: string): string {
    return text.split(NOTES_BEGIN)[1]?.split(NOTES_END)[0] ?? '';
}

// a block whose every line the archive already holds is not appended again: a sweep that stopped after its append may run twice
export function appendArchive(
    pocketDir: string,
    id: string,
    blocks: string[],
): void {
    const old = readArchive(pocketDir, id);
    const held = lineSet(old);
    const fresh = blocks.filter((block) =>
        [...lineSet(block)].some((line) => !held.has(line)),
    );
    if (fresh.length === 0) return;
    const file = archivePath(pocketDir, id);
    mkdirSync(path.dirname(file), { recursive: true });
    const head = old
        ? ''
        : `# ${id.toLowerCase()}: notes moved out of the flyway, oldest first\n\n`;
    appendFileSync(
        file,
        head + fresh.map((block) => `${block.trimEnd()}\n\n`).join(''),
    );
}

// the item text with every note block dated before today taken out, and those blocks; a block with no day takes the one
// before it, a leading one the first day after it, and with no day at all it stays: «17:24 …» may be today's
export function splitNotes(text: string, today: string): NotesSplit {
    const begin = text.indexOf(NOTES_BEGIN);
    const to = text.indexOf(NOTES_END);
    const from = begin + NOTES_BEGIN.length;
    if (begin < 0 || to < from) return { kept: text, moved: [] };
    const blocks = text
        .slice(from, to)
        .split(/\n\s*\n/)
        .filter((part) => part.trim());
    const days = blocks.map((block) => dayOf(block, today));
    let day = days.find(Boolean) ?? today;
    const keep: string[] = [];
    const moved: string[] = [];
    for (const [i, block] of blocks.entries()) {
        day = days[i] ?? day;
        (day < today ? moved : keep).push(block);
    }
    if (moved.length === 0) return { kept: text, moved };
    const rest = keep.map((block) => block.replace(/^\n+|\n+$/g, ''));
    return {
        kept: `${text.slice(0, from)}${rest.length ? `${rest.join('\n\n')}\n` : ''}${text.slice(to)}`,
        moved: moved.map((block) => block.trimEnd()),
    };
}

function dayOf(block: string, today: string): string | undefined {
    const hoist = block.match(HOIST_DAY)?.[1];
    return (
        block.match(OWN_DAY)?.[1] ??
        (hoist
            ? `${today.slice(0, 5)}${hoist}`
            : WISH_HEAD.test(block)
              ? block.slice(0, 40).match(STAMP_DAY)?.[1]
              : undefined)
    );
}

/* Types */

interface NotesSplit {
    kept: string;
    moved: string[];
}
