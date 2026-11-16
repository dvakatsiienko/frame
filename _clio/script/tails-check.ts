// the day must not end with an open tail the operator did not keep: one file per day, every day file read.
// usage: node tails-check.ts [--json] | --add '<text>' | --done '<exact start of a line's text>'
// CLIO_TAILS_DIR moves the directory, CLIO_TAILS_TODAY=YYYY-MM-DD the clock.
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    renameSync,
    writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const TASK_LINE = /^\s*- \[([ x])\] (.*)$/;
const KEPT_MARKER = /— kept: dima \d{4}-\d{2}-\d{2}/;
const DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.md$/;
const SHOWN_CHARS = 160;
const usage =
    "usage: node tails-check.ts [--json] | --add '<text>' | --done '<start of a line's text>'";

export function tailsOf(text: string): Tail[] {
    return text.split('\n').flatMap((row, index) => {
        const task = row.match(TASK_LINE);
        if (!task) return [];
        const body = task[2] ?? '';
        const state =
            task[1] === 'x' ? 'done' : KEPT_MARKER.test(body) ? 'kept' : 'owed';
        return [{ line: index + 1, state, text: body }];
    });
}

export function addTail(text: string, tail: string): string {
    const base = text === '' || text.endsWith('\n') ? text : `${text}\n`;
    return `${base}- [ ] ${tail}\n`;
}

// ticks the open line numbered `line` (1-based), keeping its indent and text
export function tickLine(text: string, line: number, today: string): string {
    return text
        .split('\n')
        .map((row, index) =>
            index === line - 1
                ? row.replace('- [ ] ', `- [x] (done ${today}) `)
                : row,
        )
        .join('\n');
}

export function scan(dir: string) {
    const names = existsSync(dir)
        ? readdirSync(dir)
              .filter((name) => DAY_FILE.test(name))
              .sort()
        : [];
    const owed: { date: string; line: number; text: string }[] = [];
    let kept = 0;
    let done = 0;
    for (const name of names) {
        const date = name.match(DAY_FILE)?.[1] ?? '';
        for (const tail of tailsOf(
            readFileSync(path.join(dir, name), 'utf8'),
        )) {
            if (tail.state === 'owed')
                owed.push({ date, line: tail.line, text: tail.text });
            else if (tail.state === 'kept') kept++;
            else done++;
        }
    }
    return { done, files: names.length, kept, owed };
}

function writeAtomic(file: string, text: string) {
    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, text);
    renameSync(temp, file);
}

function fail(message: string): never {
    console.error(message);
    process.exit(2);
}

if (import.meta.main) {
    const dir =
        process.env.CLIO_TAILS_DIR ??
        path.join(homedir(), '.local/state/clio/tails');
    const today =
        process.env.CLIO_TAILS_TODAY ?? new Date().toLocaleDateString('sv');
    const [mode, value] = process.argv.slice(2);
    if (mode === '--add') {
        if (!value?.trim()) fail('--add refused: the text is empty');
        if (value.includes('\n'))
            fail('--add refused: the text holds a newline');
        const file = path.join(dir, `${today}.md`);
        mkdirSync(dir, { recursive: true });
        const before = existsSync(file) ? readFileSync(file, 'utf8') : '';
        writeAtomic(file, addTail(before, value));
        console.log(file);
    } else if (mode === '--done') {
        if (!value) fail('--done refused: the start of the line is empty');
        const matches = existsSync(dir)
            ? readdirSync(dir)
                  .filter((name) => DAY_FILE.test(name))
                  .flatMap((name) => {
                      const text = readFileSync(path.join(dir, name), 'utf8');
                      return tailsOf(text)
                          .filter(
                              (tail) =>
                                  tail.state !== 'done' &&
                                  tail.text.startsWith(value),
                          )
                          .map((tail) => ({ name, tail, text }));
                  })
            : [];
        const [match] = matches;
        if (matches.length !== 1 || !match)
            fail(
                `--done refused: ${matches.length} open lines start with that`,
            );
        writeAtomic(
            path.join(dir, match.name),
            tickLine(match.text, match.tail.line, today),
        );
        console.log(`done: ${match.tail.text}`);
    } else if (mode === undefined || mode === '--json') {
        const report = scan(dir);
        const { done, files, kept, owed } = report;
        if (mode === '--json') console.log(JSON.stringify(report));
        else if (owed.length === 0)
            console.log(
                `🟢 tails: nothing owed (${kept} kept, ${done} done, ${files} files)`,
            );
        else {
            for (const tail of owed)
                console.log(
                    `🔴 ${tail.date} · ${tail.text.slice(0, SHOWN_CHARS)}`,
                );
            console.log(
                `tails: ${owed.length} owed, ${kept} kept, ${done} done, ${files} files`,
            );
        }
        process.exitCode = owed.length > 0 ? 1 : 0;
    } else fail(usage);
}

/* Types */

interface Tail {
    line: number;
    state: 'owed' | 'kept' | 'done';
    text: string;
}
