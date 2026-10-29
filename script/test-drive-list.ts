// the one list of trials (o139): each docs/test-drive file's own status and until, grouped, live ones by date.
// --check (clio:shape-test-drive): reds what a trial forgets — past due, undated, a date copied outside its file
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
    '_clio/plugin-clio/skills',
    '_clio/memory',
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
            blind: field('blind') === 'true',
            card: /right if/i.test(text),
            fits: field('fits').split(/\s+/).filter(Boolean),
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

// --spawn-hook (clio PreToolUse on Bash): a `claude --bg` member spawn is refused until its brief names every live trial
// whose `fits:` matches the member, so applying a trial never rests on clio's memory (dima, 2026-10-22, o89)
if (process.argv.includes('--spawn-hook')) {
    const command: string =
        JSON.parse(readFileSync(0, 'utf8') || '{}').tool_input?.command ?? '';
    const file = command.match(
        /\$\((?:cat\s+|<\s*)['"]?([^)'"\s]+)['"]?\s*\)/,
    )?.[1];
    const spawn = spawnsMember(command);
    if (spawn && /\$\((?:cat\b|<)/.test(command) && !readable(file))
        deny(
            `the gate cannot read the brief file this spawn names (${file ?? 'unparsed'}) — pass it as "$(cat <path>)"`,
        );
    const text = spawn ? briefText(command, file) : '';
    const role = /\/x:crew-(sixth-sense|verifier)\b/.test(text) // read-both
        ? 'verifier'
        : /\/x:crew-(codie|coder)\b/.test(text) // read-both
          ? 'coder'
          : '';
    const kinds = [
        role,
        ...(/guide-go|x\/go\b/.test(text) ? [`${role}:go`] : []),
        ...(/guide-typescript|\.tsx?\b/.test(text) ? [`${role}:ts`] : []),
    ];
    const fitting = role
        ? drives.filter(
              (d) =>
                  d.status === 'live' && d.fits.some((k) => kinds.includes(k)),
          )
        : [];
    // a blind trial measures whether a member reaches for the tool unprompted, so its name stays out of the brief
    const named = fitting
        .filter((d) => d.blind && text.includes(d.name))
        .map((d) => d.name);
    if (named.length)
        deny(
            `the brief names blind trials: ${named.join(', ')} — a blind trial stays unnamed, so the lane shows whether the member reaches for it alone`,
        );
    const missing = fitting
        .filter((d) => !d.blind && !text.includes(d.name))
        .map((d) => d.name);
    if (missing.length)
        deny(
            `the brief misses live trials that fit a ${kinds.join(' ')} lane: ${missing.join(', ')} — name each (docs/test-drive/<name>.md) with how the lane uses it, or write «trial skipped: <name> — <why>»`,
        );
    process.exit(0);
}

function deny(reason: string): never {
    console.log(
        JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: reason,
            },
        }),
    );
    process.exit(0);
}

// a spawn is a command word `claude` carrying `--bg` or `--cloud` among its args; heredoc bodies and quoted strings are text, never commands
function spawnsMember(command: string) {
    const source = command.replace(
        /(<<-?\s*(['"]?)(\w+)\2[^\n]*)\n[\s\S]*?\n[ \t]*\3(?=\n|$)/g,
        '$1',
    );
    const segments: string[][] = [[]];
    let word = '';
    let isWord = false;
    let quote = '';
    const endWord = () => {
        if (isWord) segments.at(-1)?.push(word);
        word = '';
        isWord = false;
    };
    for (let i = 0; i < source.length; i++) {
        const c = source[i] ?? '';
        if (quote === "'") {
            if (c === "'") quote = '';
            else word += c;
        } else if (quote === '"') {
            if (c === '"') quote = '';
            else if (c === '\\') word += source[++i] ?? '';
            else word += c;
        } else if (c === '\\') {
            word += source[++i] ?? '';
            isWord = true;
        } else if (c === "'" || c === '"') {
            quote = c;
            isWord = true;
        } else if (/[;&|()`\n]/.test(c)) {
            endWord();
            segments.push([]);
        } else if (/\s/.test(c)) {
            endWord();
        } else {
            word += c;
            isWord = true;
        }
    }
    endWord();
    return segments.some((words) => {
        const start = words.findIndex((w) => !/^\w+=/.test(w));
        const [bin, ...args] = start < 0 ? [] : words.slice(start);
        return (
            path.basename(bin ?? '') === 'claude' &&
            args.some((a) => a === '--bg' || a === '--cloud')
        );
    });
}

function readable(file: string | undefined) {
    if (!file) return false;
    try {
        readFileSync(file.replace(/^~/, process.env.HOME ?? ''));
        return true;
    } catch {
        return false;
    }
}

function briefText(command: string, file: string | undefined) {
    if (!file) return command;
    try {
        return readFileSync(file.replace(/^~/, process.env.HOME ?? ''), 'utf8');
    } catch {
        return command;
    }
}

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
