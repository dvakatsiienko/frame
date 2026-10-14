// adds or updates a word in Wispr Flow's dictionary. safe while the app runs: the db is wal, and
// the row shows in the app with no restart (proven 2026-10-01, nots → notes).
// usage: pnpm wispr:add '<phrase>' ['<replacement>'] [--force]
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const isForced = process.argv.includes('--force');
const [phrase, replacement = null] = process.argv
    .slice(2)
    .filter((a) => a !== '--force');
if (!phrase) {
    console.error(
        "usage: pnpm wispr:add '<phrase>' ['<replacement>'] [--force]",
    );
    process.exit(1);
}

// a heard side made of real words rewrites every real use of them (hold → halt, reverted 10-13): refused unless forced
const words = new Set(
    readFileSync('/usr/share/dict/words', 'utf8').toLowerCase().split('\n'),
);
if (
    !isForced &&
    phrase
        .toLowerCase()
        .split(/\s+/)
        .every((w) => words.has(w))
) {
    console.error(
        `wispr: «${phrase}» is made of dictionary words, so it would rewrite their real uses too. refused; --force if dima said so`,
    );
    process.exit(2);
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
