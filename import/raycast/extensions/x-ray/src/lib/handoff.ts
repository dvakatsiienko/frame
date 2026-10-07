import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

// The shelf is read through `x handoff`, the store's one door, so its grammar, its audience gate
// and its age labels live in one place. Dima reads as the coordinator: what x files under
// `others` is addressed to another agent, and the row says so.
export const readHandoffList = async (): Promise<Handoff[]> => {
    const listing = await x<Listing>(['list', '--for', 'cclio']);

    return [
        ...listing.entries.map((row) => toHandoff(listing.root, row, false)),
        ...listing.others.map((row) => toHandoff(listing.root, row, true)),
    ];
};

export const readHandoffBody = (path: string) => readFile(path, 'utf8');

// Reading a file the listing named is harmless; deleting goes through x like every other
// frontend. The file name is the slug: x refuses an ambiguous one rather than guessing, and a
// whole file name can only ever match its own file. A miss exits non-zero and rejects here —
// that rejection is the only proof the row is really gone.
export const deleteHandoff = (handoff: Handoff) =>
    x<Deleted>(['delete', handoff.fileName]);

// `/x:handoff-ingest <topic>` picks this file out of the shelf; `/cclio:boot <topic>` boots
// the reading session as the coordinator and ingests the same file. Which one is wanted depends
// on the session being pasted into, not on the file, so both lines are offered and the choice is
// the keypress. The boot line carries the topic as plain text, never a second slash command: the
// desktop composer refuses a message holding two skill chips (Claude 2.19675).
export const toIngestLine = (handoff: Handoff) =>
    `/x:handoff-ingest ${handoff.topic}`;

export const toCclioBootLine = (handoff: Handoff) =>
    `/cclio:boot ${handoff.topic}`;

/* Helpers */

// The shim runs the go binary of this checkout and rebuilds it first when a source is newer.
// Raycast's PATH carries /opt/homebrew/bin, where the shim finds go for that rebuild.
const xBin = join(homedir(), 'frame', 'x', 'bin', 'x');

// A refusal still prints its envelope on stdout, so the error x phrased is the toast's message.
const x = async <Data>(args: string[]): Promise<Data> => {
    const stdout = await run(xBin, ['handoff', ...args, '--json']).then(
        (done) => done.stdout,
        (error: { stdout?: string; message: string }) => {
            const failed = envelopeOf<never>(error.stdout ?? '');
            throw new Error(
                failed && !failed.ok ? failed.error : error.message,
            );
        },
    );
    const envelope = envelopeOf<Data>(stdout);
    if (envelope === null) throw new Error('x answered with no envelope');
    if (!envelope.ok) throw new Error(envelope.error);

    return envelope.data;
};

const envelopeOf = <Data>(raw: string): Envelope<Data> | null => {
    try {
        return JSON.parse(raw) as Envelope<Data>;
    } catch {
        return null;
    }
};

// x names an unstated lane or author `any`; the row shows nothing rather than a word that
// reads like a value.
const toHandoff = (root: string, row: Row, isForeign: boolean): Handoff => ({
    age: row.age,
    audience: row.audience,
    author: row.author === 'any' ? null : row.author,
    fileName: row.name,
    isForeign,
    isShared: row.shared,
    lane: row.lane === 'any' ? null : row.lane,
    path: join(root, row.name),
    topic: row.slug,
});

/* Types */
export interface Handoff {
    age: string;
    audience: string;
    author: string | null;
    fileName: string;
    isForeign: boolean;
    isShared: boolean;
    lane: string | null;
    path: string;
    topic: string;
}

// the data half of `x handoff list --json`; `x schema handoff list` is the contract
interface Row {
    age: string;
    audience: string;
    author: string;
    lane: string;
    name: string;
    shared: boolean;
    slug: string;
}

interface Listing {
    entries: Row[];
    others: Row[];
    root: string;
}

interface Deleted {
    deleted: { name: string; slug: string }[];
}

type Envelope<Data> =
    | { data: Data; ok: true }
    | { error: string; next?: string; ok: false };
