// keeps a flyway readable: a finished line leaves into the done note, a new line lands in its kind's place.
// usage: node flyway-done.ts <PK-N> <n> | <PK-N> --add '<line>' | <PK-N> --sort
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const pocket = path.resolve(import.meta.dirname, '..');
const kinds = ['open', 'waits', 'dated', 'later'] as const;
const DATED_ON = / — on: (\d{4}-\d{2}-\d{2})\b/;
const usage =
    "usage: node flyway-done.ts <PK-N> <n> | <PK-N> --add '<line>' | <PK-N> --sort";

export function flywayKind(text: string): (typeof kinds)[number] {
    if (text.startsWith('💤')) return 'later';
    if (text.startsWith('📅')) return 'dated';
    if (text.startsWith('⏳')) return 'waits';
    return 'open';
}

export function flywayLines(text: string): FlywayLine[] {
    return [...text.matchAll(/^- \[([ x])\] #(\d+) (.+)$/gm)].map(
        ([, mark, n, line]) => ({
            done: mark === 'x',
            n: Number(n),
            text: line ?? '',
        }),
    );
}

// the date a 📅 line waits for, empty when it names none
export function flywayDate(text: string): string {
    return text.match(DATED_ON)?.[1] ?? '';
}

// a stable sort: open lines keep their own order, then waits, then dated by date, then later
export function flywaySorted(lines: string[]): string[] {
    const rank = (line: string) => kinds.indexOf(flywayKind(line));
    return lines
        .map((line, index) => ({ index, line }))
        .sort(
            (a, b) =>
                rank(a.line) - rank(b.line) ||
                flywayDate(a.line).localeCompare(flywayDate(b.line)) ||
                a.index - b.index,
        )
        .map(({ line }) => line);
}

if (import.meta.main) {
    const [rawId, mode, value] = process.argv.slice(2);
    const id = rawId?.toUpperCase() ?? '';
    if (!/^PK-\d+$/.test(id) || !mode) fail(usage);
    if (mode === '--add') {
        if (!value) fail(usage);
        edit(id, ['--ac', value]);
        sort(id);
    } else if (mode === '--sort') {
        sort(id);
    } else {
        const line = flywayLines(read(id)).find((l) => l.n === Number(mode));
        if (!line) fail(`${id} has no line #${mode}`);
        edit(id, [
            '--remove-ac',
            String(line.n),
            '--append-notes',
            `done ${stamp()}: ${line.text}`,
        ]);
        console.log(`${id} #${line.n} → done note`);
    }
}

function sort(id: string) {
    const lines = flywayLines(read(id));
    if (lines.some((l) => l.done))
        fail(
            `${id} holds a ticked line: move it first, node flyway-done.ts ${id} <n>`,
        );
    const open = lines.map((l) => l.text);
    const sorted = flywaySorted(open);
    if (sorted.every((line, i) => line === open[i])) return;
    edit(
        id,
        lines
            .map((l) => l.n)
            .sort((a, b) => b - a)
            .flatMap((n) => ['--remove-ac', String(n)]),
    );
    edit(
        id,
        sorted.flatMap((line) => ['--ac', line]),
    );
    console.log(`${id} sorted: open, then ⏳, then 💤`);
}

function read(id: string): string {
    const dir = path.join(pocket, 'pocket', 'tasks');
    const file = readdirSync(dir).find((f) =>
        f.toLowerCase().startsWith(`${id.toLowerCase()} `),
    );
    if (!file) fail(`${id} is not in the pocket`);
    return readFileSync(path.join(dir, file), 'utf8');
}

function edit(id: string, args: string[]) {
    execFileSync('backlog', ['task', 'edit', id, ...args], {
        encoding: 'utf8',
        env: { ...process.env, BACKLOG_CWD: pocket },
    });
}

function stamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function fail(message: string): never {
    console.error(message);
    process.exit(2);
}

/* Types */

interface FlywayLine {
    done: boolean;
    n: number;
    text: string;
}
