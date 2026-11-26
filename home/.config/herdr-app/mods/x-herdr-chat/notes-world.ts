/// <reference types="node" />
// the notes in memory: the store, the join file and the transcript, for the notes tests

import {
    joinRows,
    joinRowsText,
} from '../../../../.claude/plugin-x/mods/x-mod-stash/hooks/orbit.ts';
import type { Joins } from './magic.js';
import { createNotes } from './notes.js';
import { createRowModel } from './row-model.js';

export const THREAD = '/t/a.jsonl';
export const FILE = '/joins/a.jsonl';
export const ROW = {
    at: null,
    id: '1a2b3c4d-0000-4000-8000-000000000000',
    kind: 'reply' as const,
};
export const passage = (
    words: string,
    start = 0,
    row = ROW,
    source = words,
) => ({
    parts: [
        {
            block: 0,
            range: { end: start + words.length, start },
            source,
            words,
        },
    ],
    row,
});

export const ON: Joins = { joined: [], push: [], taken: [], waiting: [] };

/** the store, the join file and the transcript, in memory; the stash is played by hand */
export function world() {
    const files = new Map<string, string>();
    const kept = new Map<string, string>();
    const locks = new Set<string>();
    const transcript: string[] = [];
    const trial: string[] = [];
    const moved: [string, string, number][] = [];
    let now = 1_000_000;
    let asked = 0;
    let ids = 0;
    const made = () =>
        createNotes({
            dir: '/joins',
            io: {
                // the first one's program starts late, as a busy mac's may
                lock: async (path) => {
                    if (++asked === 1)
                        for (let i = 0; i < 40; i++) await Promise.resolve();
                    at.locked();
                    return locks.has(path) ? false : Boolean(locks.add(path));
                },
                lockAge: async () => 0,
                now: () => now,
                read: async (path) => files.get(path) ?? null,
                sleep: async (ms) => {
                    now += ms;
                },
                unlock: async (path) => {
                    locks.delete(path);
                },
                write: async (path, text) => {
                    files.set(path, text);
                },
            },
            joinsOf: () => at.joins,
            linesWith: async (_thread, words) => {
                const lines = transcript.filter((line) => line.includes(words));
                await at.searching;
                return at.isSearchBroken ? null : lines;
            },
            logTrial: (line) => trial.push(line),
            movedOn: (_thread, id, next, cut) => moved.push([id, next.id, cut]),
            newId: () => `id-${++ids}`,
            store: {
                getItem: (key) => kept.get(key) ?? null,
                removeItem: (key) => kept.delete(key),
                setItem: (key, text) => kept.set(key, text),
            },
        });
    const at = {
        isSearchBroken: false,
        joins: ON as Joins | null | undefined,
        /** what happens while the join file is held */
        locked: () => {},
        searching: Promise.resolve(),
    };
    let notes = made();
    const rows = () => joinRows(files.get(FILE) ?? '');
    return Object.assign(at, {
        /** a turn took these rows: his messages as the transcript's reader draws them */
        arrive(taken = rows()) {
            const entry = {
                attachment: {
                    content: [joinRowsText(taken)],
                    type: 'hook_additional_context',
                },
                timestamp: new Date(now).toISOString(),
                type: 'attachment',
                uuid: 'u-1',
            };
            // its real line opens with its parent
            const line = `{"parentUuid":"p-1",${JSON.stringify(entry).slice(1)}`;
            transcript.push(line);
            const model = createRowModel();
            model.add([line]);
            return model.rows.map(({ at, isJoin, text }) => ({
                at,
                isJoin,
                text,
            }));
        },
        /** a note with its words typed, its id */
        draft: async (text: string, on = passage('the retry is cheap')) => {
            const { id } = notes.open(THREAD, on);
            notes.typed(THREAD, id, text);
            return id;
        },
        files,
        kept,
        locks,
        moved,
        note: (id: string) => {
            const note = notes.of(THREAD).find((n) => n.id === id);
            if (!note) throw new Error(`no note ${id}`);
            return note;
        },
        notes: new Proxy({} as typeof notes, {
            get: (_t, name) => notes[name as keyof typeof notes],
        }),
        pass(ms: number) {
            now += ms;
        },
        reload() {
            notes = made();
        },
        rows,
        /** what the thread's state says of its joins, then the notes settle */
        settle(joins: Joins) {
            at.joins = joins;
            return notes.settle(THREAD);
        },
        stamp: () => new Date(now).toISOString(),
        texts: () => rows().map((r) => r.text),
        trial: () => trial.map((line) => JSON.parse(line)),
        /** his keys rested */
        type: async (id: string, text: string) =>
            notes.typed(THREAD, id, text) && (await notes.write(THREAD, id)),
    });
}
