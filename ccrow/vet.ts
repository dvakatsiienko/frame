import { readFileSync } from 'node:fs';

import { NOTES_PATH, VERDICTS_PATH, appendJsonl, fail } from './lib.ts';

const usage = `ccrow:vet <ok|miss> <note-id> <why…> — log a verdict on one note to ${VERDICTS_PATH}`;

const [value, id, ...why] = process.argv.slice(2);
if ((value !== 'ok' && value !== 'miss') || !id || why.length === 0)
    fail(usage);

let notes: string;
try {
    notes = readFileSync(NOTES_PATH, 'utf8');
} catch {
    fail(`no notes yet: ${NOTES_PATH}`);
}
const isKnown = notes.split('\n').some((line) => {
    try {
        const note: { id?: unknown } = JSON.parse(line);
        return note.id === id;
    } catch {
        return false;
    }
});
if (!isKnown) fail(`no note with id ${id}`);

appendJsonl(VERDICTS_PATH, {
    at: new Date().toISOString(),
    id,
    value,
    why: why.join(' '),
});
console.log(`${id}: ${value}`);
