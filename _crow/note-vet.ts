import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

import { NOTES_PATH, VERDICTS_PATH, appendJsonl, fail } from './lib.ts';

const usage = `ccrow:note-vet <ok|miss> <note-id> <why…> — log a verdict on one note to ${VERDICTS_PATH}`;
// a vet can land before harvest.ts logs the note it answers, so the line gets this long to appear
const WAIT_MS = Number(process.env.CCROW_VET_WAIT_MS ?? 60_000);

const [value, id, ...why] = process.argv.slice(2);
if ((value !== 'ok' && value !== 'miss') || !id || why.length === 0)
    fail(usage);

function headlineOf(noteId: string): string | undefined {
    let notes: string;
    try {
        notes = readFileSync(NOTES_PATH, 'utf8');
    } catch {
        return undefined;
    }
    let headline: string | undefined;
    for (const line of notes.split('\n')) {
        try {
            const note: { id?: unknown; note?: unknown } = JSON.parse(line);
            if (note.id === noteId)
                headline = String(note.note ?? '').split('\n')[0];
        } catch {}
    }
    return headline;
}

const deadline = Date.now() + WAIT_MS;
let headline = headlineOf(id);
while (headline === undefined && Date.now() < deadline) {
    await sleep(2_000);
    headline = headlineOf(id);
}
if (headline === undefined)
    fail(`no note with id ${id} after ${WAIT_MS / 1000} s in ${NOTES_PATH}`);

appendJsonl(VERDICTS_PATH, {
    at: new Date().toISOString(),
    id,
    value,
    why: why.join(' '),
});
console.log(`${id}: ${value}${headline ? ` · ${headline}` : ''}`);
