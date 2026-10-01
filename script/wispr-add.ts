// adds or updates a word in Wispr Flow's dictionary. safe while the app runs: the db is wal, and
// the row shows in the app with no restart (proven 2026-10-01, nots → notes).
// usage: pnpm wispr:add '<phrase>' ['<replacement>']
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const [phrase, replacement = null] = process.argv.slice(2);
if (!phrase) {
    console.error("usage: pnpm wispr:add '<phrase>' ['<replacement>']");
    process.exit(1);
}

const db = new DatabaseSync(
    `${homedir()}/Library/Application Support/Wispr Flow/flow.sqlite`,
);
db.exec('PRAGMA busy_timeout = 3000');
const now = new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');

db.prepare(
    `insert into Dictionary (id, phrase, replacement, manualEntry, createdAt, modifiedAt, source)
     values (?, ?, ?, 1, ?, ?, 'manual')
     on conflict (phrase, teamDictionaryId)
     do update set replacement = excluded.replacement, isDeleted = 0, modifiedAt = excluded.modifiedAt`,
).run(randomUUID(), phrase, replacement, now, now);

const row = db
    .prepare('select replacement, isDeleted from Dictionary where phrase = ?')
    .get(phrase);
console.log(
    `wispr: «${phrase}» → «${row?.replacement ?? phrase}»${row?.isDeleted ? ' (deleted?)' : ''}`,
);
