import { readFileSync } from 'node:fs';

import { NOTES_PATH, VERDICTS_PATH, appendJsonl, fail } from './lib.ts';

const usage = `ccrow:note-vet <ok|miss> <note-id> <why…> — log a verdict on one note to ${VERDICTS_PATH}`;

const [value, id, ...why] = process.argv.slice(2);
if ((value !== 'ok' && value !== 'miss') || !id || why.length === 0)
    fail(usage);

let notes: string;
try {
    notes = readFileSync(NOTES_PATH, 'utf8');
} catch {
    fail(`no notes yet: ${NOTES_PATH}`);
}
let headline: string | undefined;
for (const line of notes.split('\n')) {
    try {
        const note: { id?: unknown; note?: unknown } = JSON.parse(line);
        if (note.id === id) headline = String(note.note ?? '').split('\n')[0];
    } catch {}
}
if (headline === undefined) fail(`no note with id ${id}`);

appendJsonl(VERDICTS_PATH, {
    at: new Date().toISOString(),
    id,
    value,
    why: why.join(' '),
});
console.log(`${id}: ${value}${headline ? ` · ${headline}` : ''}`);
