// keeps a flyway readable: a finished line leaves into the done note, a new line lands in its kind's place.
// usage: node flyway-done.ts <PK-N> <n> | <PK-N> --add '<line>' | <PK-N> --sort | <PK-N> --check
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
    "usage: node flyway-done.ts <PK-N> <n> | <PK-N> --add '<line>' | <PK-N> --sort | <PK-N> --check";

export function flywayKind(text: string): (typeof kinds)[number] {
    const body = text.replace(LINE_ID, '');
    if (body.startsWith('💤')) return 'later';
    if (body.startsWith('📅')) return 'dated';
    if (body.startsWith('⏳')) return 'waits';
    return 'open';
}

// a line's id, f1, f2 …, is minted once and never reused, so «f5» names one line for good (dima, PK-346:W83); backlog's #n shifts on every clear
const LINE_ID = /^f(\d+) /;

export function flywayLines(text: string): FlywayLine[] {
    return [...text.matchAll(/^- \[([ x])\] #(\d+) (.+)$/gm)].map(
        ([, mark, n, line = '']) => {
            const id = line.match(LINE_ID)?.[0].trim();
            return {
                done: mark === 'x',
                n: Number(n),
                ref: id ?? `#${n}`,
                text: line,
            };
        },
    );
}

// the next id: one past every id a line or a done note of this item ever carried
export function nextLineId(item: string): number {
    const used = [
        ...item.matchAll(
            /^- \[[ x]\] #\d+ f(\d+) |^\s*done [^:]+:\d{2}: f(\d+) /gm,
        ),
    ].map(([, line, done]) => Number(line ?? done));
    return Math.max(0, ...used) + 1;
}

// every flyway sits on the pocket's top in thread order (dima, 2026-11-09): main 1000, wing N 1000 + N; 1000–1099 are theirs
export const FLYWAY_SLOTS = 100;
export function flywayOrdinal(title: string): number | undefined {
    const thread = title.match(/^flyway: (?:main|wing ([1-9]\d?))$/);
    return thread ? 1000 + Number(thread[1] ?? 0) : undefined;
}

// the date a 📅 line waits for, empty when it names none
export function flywayDate(text: string): string {
    return text.match(DATED_ON)?.[1] ?? '';
}

// the unticked lines of these flyways that share 3 or more words of 4+ letters with a line about to be added
export function similarLines(
    added: string,
    flyways: { id: string; text: string }[],
): string[] {
    const words = (line: string) =>
        new Set(
            line
                .replace(NAMED_ID, '')
                .toLowerCase()
                .match(/\p{L}{4,}/gu),
        );
    const mine = words(added);
    return flyways.flatMap(({ id, text }) =>
        flywayLines(text)
            .filter(
                (l) =>
                    !l.done &&
                    [...words(l.text)].filter((w) => mine.has(w)).length >= 3,
            )
            .map(
                (l) =>
                    `similar open line: ${id} ${l.ref}: ${l.text.slice(0, 80)}`,
            ),
    );
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
        const dir = path.join(pocket, 'pocket', 'tasks');
        const flyways = readdirSync(dir)
            .map((f) => ({
                id: f.match(/^pk-\d+/i)?.[0].toUpperCase() ?? '',
                text: readFileSync(path.join(dir, f), 'utf8'),
            }))
            .filter(({ text }) => /^title: ['"]?flyway: /m.test(text));
        for (const similar of similarLines(value, flyways))
            console.log(similar);
        rewrite(id, [value]);
    } else if (mode === '--sort') {
        rewrite(id, []);
    } else if (mode === '--check') {
        const lines = flywayLines(read(id));
        const { closed, report } = checkReport(
            lines,
            namedStates(...lines.map((l) => l.text)),
        );
        for (const line of report) console.log(line);
        if (closed)
            fail(
                `${closed} line(s) name a closed home: clear each with node flyway-done.ts ${id} <n>, or reword it to its live step`,
            );
    } else {
        const line = flywayLines(read(id)).find((l) =>
            /^f\d+$/.test(mode) ? l.ref === mode : l.n === Number(mode),
        );
        if (!line) fail(`${id} has no line ${mode}`);
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
        console.log(`${id} ${line.ref} → done note${proof}`);
        for (const s of states.filter((s) => !CLOSED_STATES.has(s.state)))
            console.error(
                `check: ${s.id} is still ${s.state}; the step this line names must have landed`,
            );
    }
}

// one backlog edit removes every line and adds the sorted set, so a failed call leaves the flyway whole
function rewrite(id: string, added: string[]) {
    const item = read(id);
    const lines = flywayLines(item);
    const ticked = lines.find((l) => l.done);
    if (ticked)
        fail(
            `${id} ${ticked.ref} is ticked: move it first, node flyway-done.ts ${id} ${ticked.ref}`,
        );
    const open = lines.map((l) => l.text);
    let next = nextLineId(item);
    const withId = (line: string) =>
        LINE_ID.test(line) ? line : `f${next++} ${line}`;
    const sorted = flywaySorted([...open, ...added].map(withId));
    if (!added.length && sorted.every((line, i) => line === open[i])) return;
    edit(id, [
        ...lines.flatMap((l) => ['--remove-ac', String(l.n)]),
        ...sorted.flatMap((line) => ['--ac', line]),
    ]);
    console.log(
        `${id} ${added.length ? 'line added, ' : ''}sorted: open, then ⏳, then 📅 by date, then 💤`,
    );
}

function namedStates(...texts: string[]): NamedState[] {
    const ids = [...new Set(texts.flatMap((t) => t.match(NAMED_ID) ?? []))];
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
            ? (readMaybe(named)?.match(/^status: (\S+)/m)?.[1] ?? 'unknown')
            : (found.find((f) => f.id === named)?.state ?? 'unknown'),
    }));
}

// every open line beside the live state of each id it names, so a sync judges by the home, never by recall
export function checkReport(lines: FlywayLine[], states: NamedState[]) {
    const stateOf = new Map(states.map((s) => [s.id, s.state]));
    let closed = 0;
    const report = lines
        .filter((l) => !l.done)
        .map((l) => {
            const ids = [...new Set(l.text.match(NAMED_ID) ?? [])];
            const named = ids.map((i) => `${i} ${stateOf.get(i) ?? 'unknown'}`);
            const isClosed = ids.some((i) =>
                CLOSED_STATES.has(stateOf.get(i) ?? ''),
            );
            // a dated read after a ticket's close is its live step, shown but never counted
            const isDatedRead = isClosed && flywayKind(l.text) === 'dated';
            if (isClosed && !isDatedRead) closed++;
            const mark = isDatedRead
                ? '🟡'
                : isClosed
                  ? '🔴'
                  : ids.length
                    ? '🟢'
                    : '⚪';
            const home = ids.length
                ? named.join(', ')
                : 'no id: read its own home';
            return `${mark} ${l.ref} ${l.text.replace(LINE_ID, '').slice(0, 70)} → ${home}`;
        });
    return { closed, report };
}

function read(id: string): string {
    return readMaybe(id) ?? fail(`${id} is not in the pocket`);
}

// an archived item has left tasks/, so its state reads as done
function readMaybe(id: string): string | undefined {
    for (const sub of ['tasks', path.join('archive', 'tasks')]) {
        const dir = path.join(pocket, 'pocket', sub);
        const file = readdirSync(dir).find((f) =>
            f.toLowerCase().startsWith(`${id.toLowerCase()} `),
        );
        if (file)
            return sub === 'tasks'
                ? readFileSync(path.join(dir, file), 'utf8')
                : 'status: done\n';
    }
    return undefined;
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
    ref: string;
    text: string;
}

interface NamedState {
    id: string;
    state: string;
}
