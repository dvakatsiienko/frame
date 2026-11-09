// keeps a flyway readable: a finished line leaves into the done note, a new line lands in its kind's place.
// usage: node flyway-done.ts <PK-N> <n> | <PK-N> --add '<line>' | <PK-N> --sort
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const pocket =
    process.env.FLYWAY_POCKET ?? path.resolve(import.meta.dirname, '..');
const kinds = ['open', 'waits', 'dated', 'later'] as const;
const DATED_ON = / — on: (\d{4}-\d{2}-\d{2})\b/;
const NAMED_ID = /\b(?:PK|FRM|BYT)-\d+\b/g;
const CLOSED_STATES = new Set(['done', 'Done', 'Canceled', 'Duplicate']);
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

// every flyway sits on the pocket's top in seat order (dima, 2026-11-09): main 1000, wing N 1000 + N; 1000–1099 are theirs
export const FLYWAY_SLOTS = 100;
export function flywayOrdinal(title: string): number | undefined {
    const seat = title.match(/^flyway: (?:main|wing ([1-9]\d?))$/);
    return seat ? 1000 + Number(seat[1] ?? 0) : undefined;
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
        rewrite(id, [value]);
    } else if (mode === '--sort') {
        rewrite(id, []);
    } else {
        const line = flywayLines(read(id)).find((l) => l.n === Number(mode));
        if (!line) fail(`${id} has no line #${mode}`);
        const states = namedStates(line.text);
        const proof = states.length
            ? ` (${states.map((s) => `${s.id} ${s.state}`).join(', ')})`
            : '';
        edit(id, [
            '--remove-ac',
            String(line.n),
            '--append-notes',
            `done ${stamp()}: ${line.text}${proof}`,
        ]);
        console.log(`${id} #${line.n} → done note${proof}`);
        for (const s of states.filter((s) => !CLOSED_STATES.has(s.state)))
            console.error(
                `check: ${s.id} is still ${s.state}; the step this line names must have landed`,
            );
    }
}

// one backlog edit removes every line and adds the sorted set, so a failed call leaves the flyway whole
function rewrite(id: string, added: string[]) {
    const lines = flywayLines(read(id));
    const ticked = lines.find((l) => l.done);
    if (ticked)
        fail(
            `${id} #${ticked.n} is ticked: move it first, node flyway-done.ts ${id} ${ticked.n}`,
        );
    const open = lines.map((l) => l.text);
    const sorted = flywaySorted([...open, ...added]);
    if (!added.length && sorted.every((line, i) => line === open[i])) return;
    edit(id, [
        ...lines.flatMap((l) => ['--remove-ac', String(l.n)]),
        ...sorted.flatMap((line) => ['--ac', line]),
    ]);
    console.log(
        `${id} ${added.length ? 'line added, ' : ''}sorted: open, then ⏳, then 📅 by date, then 💤`,
    );
}

function namedStates(text: string): NamedState[] {
    const ids = [...new Set(text.match(NAMED_ID) ?? [])];
    const tickets = ids.filter((i) => !i.startsWith('PK-'));
    const found: NamedState[] = tickets.length
        ? (JSON.parse(
              execFileSync('x', ['linear', 'read', ...tickets], {
                  encoding: 'utf8',
              }),
          ).data?.tickets ?? [])
        : [];
    return ids.map((named) => ({
        id: named,
        state: named.startsWith('PK-')
            ? (read(named).match(/^status: (\S+)/m)?.[1] ?? 'unknown')
            : (found.find((f) => f.id === named)?.state ?? 'unknown'),
    }));
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

interface NamedState {
    id: string;
    state: string;
}
