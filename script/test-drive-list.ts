// the one list of trials (o139): each docs/test-drive file's own status and until, grouped, live ones by date.
// --check (cclio:shape-test-drive): reds what a trial forgets — past due, undated, a date copied outside its file
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'docs/test-drive');
const ORDER = ['live', 'frozen', 'parked', 'adopted', 'dropped', 'closed'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// the homes that may point at a trial; its date lives only in its own file (dima's o84)
const POINTERS = [
    'home/.claude/CLAUDE.md',
    'home/.claude/rules',
    'home/.claude/plugin-x/skills',
    'cclio/plugin-cclio/skills',
    'cclio/memory',
    'recipes',
    'AGENTS.md',
];
const COPIED =
    /(?:test[- ]drive|on trial|trial runs?)[^.\n]{0,40}?\b(?:to|until) (?:20\d\d-)?[01]\d-[0-3]\d/i;

const drives = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
        const text = readFileSync(path.join(dir, f), 'utf8');
        const head = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
        const field = (k: string) =>
            head.match(new RegExp(`^${k}: (.*)$`, 'm'))?.[1]?.trim() ?? '';
        return {
            card: /right if/i.test(text),
            name: f.slice(0, -3),
            status: field('status') || 'missing',
            until: field('until'),
        };
    });

const addDays = (day: string, n: number) => {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};

const markdownUnder = (p: string): string[] => {
    const abs = path.join(root, p);
    if (abs.endsWith('.md')) return [p];
    return readdirSync(abs, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.md'))
        .map((e) => path.relative(root, path.join(e.parentPath, e.name)))
        .filter((f) => !/\/last\/|\/log[^/]*\.md$/.test(f));
};

if (!process.argv.includes('--check')) {
    for (const status of [...ORDER, 'missing']) {
        const rows = drives
            .filter((d) => d.status === status)
            .sort((a, b) => a.until.localeCompare(b.until));
        if (!rows.length) continue;
        console.log(`\n${status} (${rows.length})`);
        for (const d of rows) console.log(`  ${d.name.padEnd(24)} ${d.until}`);
    }
    if (drives.some((d) => !ORDER.includes(d.status))) process.exitCode = 1;
} else {
    const today = new Date().toISOString().slice(0, 10);
    const reds: string[] = [];
    for (const d of drives) {
        if (!ORDER.includes(d.status))
            reds.push(
                `${d.name}: status «${d.status}» is not one of ${ORDER.join(' · ')}`,
            );
        if (d.status !== 'live' && d.status !== 'frozen') continue;
        if (!DATE.test(d.until))
            reds.push(
                `${d.name}: ${d.status} with no date (until: «${d.until}»)`,
            );
        else if (d.until < today)
            reds.push(`${d.name}: overdue since ${d.until}, a verdict is owed`);
    }
    for (const f of POINTERS.flatMap(markdownUnder)) {
        readFileSync(path.join(root, f), 'utf8')
            .split('\n')
            .forEach((line, i) => {
                if (COPIED.test(line))
                    reds.push(
                        `${f}:${i + 1}: a trial date copied outside its file — point at the trial instead`,
                    );
            });
    }
    const live = drives.filter((d) => d.status === 'live');
    const soon = addDays(today, 3);
    const due = live.filter(
        (d) => DATE.test(d.until) && d.until >= today && d.until <= soon,
    );
    const noCard = live.filter((d) => !d.card).length;
    console.log(
        `test-drive:check: ${live.length} live · ${due.length} due within 3 days${due.length ? ` (${due.map((d) => d.name).join(', ')})` : ''} · ${noCard} live without a test card`,
    );
    for (const r of reds) console.log(`🔴 ${r}`);
    if (reds.length) process.exitCode = 1;
}
