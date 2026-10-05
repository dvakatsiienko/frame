import { execFile } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export const handoffDir = join(homedir(), '.claude', 'shelf', 'handoffs');

export const readHandoffList = async (): Promise<Handoff[]> => {
    const entries = await readdir(handoffDir).catch(onShelfReadError);
    const handoffList = await Promise.all(
        entries.filter((name) => name.endsWith('.md')).map(readHandoff),
    );

    return handoffList
        .filter((handoff) => handoff !== null)
        .sort((a, b) => b.modifiedAt - a.modifiedAt);
};

export const readHandoffBody = (path: string) => readFile(path, 'utf8');

// Reading the shelf straight off disk is harmless; deleting behind the store's back is not,
// so the one destructive verb goes through the store cli like every other frontend does.
// The file name is the slug: `pick` refuses an ambiguous one rather than guessing, and a
// whole file name can only ever match its own file. A miss exits 1, which rejects here —
// that non-zero exit is the only proof the row is really gone.
export const deleteHandoff = (handoff: Handoff) =>
    run('node', [storeCli, 'delete', handoff.fileName]);

// `/x:handoff-ingest <topic>` picks this file out of the shelf; `/cclio:boot <topic>` boots
// the reading session as the coordinator and ingests the same file. Which one is wanted depends
// on the session being pasted into, not on the file, so both lines are offered and the choice is
// the keypress. The boot line carries the topic as plain text, never a second slash command: the
// desktop composer refuses a message holding two skill chips (Claude 2.19675).
export const toIngestLine = (handoff: Handoff) =>
    `/x:handoff-ingest ${handoff.topic}`;

export const toCclioBootLine = (handoff: Handoff) =>
    `/cclio:boot ${handoff.topic}`;

export const toAge = (modifiedAt: number) => {
    const minutes = Math.max(0, Math.round((Date.now() - modifiedAt) / 60_000));

    if (minutes < 60) return `${minutes}m`;
    if (minutes < 60 * 48) return `${Math.round(minutes / 60)}h`;

    return `${Math.round(minutes / (60 * 24))}d`;
};

/* Helpers */

// Raycast resolves a bare command against its own PATH, which carries /opt/homebrew/bin —
// the same assumption `gmail-block-sender` already makes for `gmailctl`. That node is not
// the repo's fnm one, whose path is per-shell and so cannot be named from here.
const storeCli = join(homedir(), 'frame', 'script', 'skill-handoff-store.ts');

// Mirrors cclio/.claude/hooks/boot-prefetch.sh. The grammar is
// `<audience>--<lane>--<topic>--by-<author>--<stamp>`, optionally suffixed `-shared`;
// a legacy name carries no `--` at all and only its first `-` field ever meant an audience.
const parseFileName = (fileName: string) => {
    const name = fileName.replace(/\.md$/, '');
    const isShared = name.endsWith('-shared');
    const stem = isShared ? name.slice(0, -'-shared'.length) : name;
    const [audience, lane, topic, authorField, ...stampField] =
        stem.split('--');

    if (
        !audience ||
        !lane ||
        !topic ||
        !authorField ||
        stampField.length === 0
    ) {
        return {
            audience: stem.split('-')[0] ?? stem,
            author: null,
            isShared,
            lane: null,
            stamp: null,
            topic: stem,
        };
    }

    return {
        audience,
        author: authorField.replace(/^by-/, ''),
        isShared,
        lane,
        stamp: stampField.join('--'),
        topic,
    };
};

// A whitelist, so an unparsed audience can never wrongly claim a file is someone else's
// and get it left behind forever.
const foreignAudienceList = ['cw', 'ccli'] as const;

// The shelf directory only exists once something has been handed off, so a missing one is
// an empty shelf. Anything else — this directory is 0700, and an i/o fault is possible —
// has to reach the failure toast instead of rendering as "the shelf is empty".
const onShelfReadError = (error: NodeJS.ErrnoException): string[] => {
    if (error.code === 'ENOENT') return [];

    throw error;
};

// `/x:handoff-ingest` deletes a file the moment it succeeds, so one can disappear between
// the readdir and this stat. That file is gone, not a reason to fail the whole list.
const readHandoff = async (fileName: string): Promise<Handoff | null> => {
    const path = join(handoffDir, fileName);
    const parsed = parseFileName(fileName);
    const stats = await stat(path).catch(() => null);

    if (!stats) return null;

    return {
        ...parsed,
        fileName,
        isForeign: foreignAudienceList.some(
            (audience) => audience === parsed.audience,
        ),
        modifiedAt: stats.mtimeMs,
        path,
    };
};

/* Types */
export interface Handoff {
    audience: string;
    author: string | null;
    fileName: string;
    isForeign: boolean;
    isShared: boolean;
    lane: string | null;
    modifiedAt: number;
    path: string;
    stamp: string | null;
    topic: string;
}
