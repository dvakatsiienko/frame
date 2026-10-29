import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const here = import.meta.dirname;
const owner = 'dvakatsiienko';
const repos = ['frame', 'bytes'] as const;
const teams = ['FRM', 'BYT'] as const;
const day = 86_400_000;

const gv = {
    panel: '#282828', bar: '#3c3836', mute: '#665c54', aqua: '#8ec07c', blue: '#83a598', ink: '#ebdbb2',
    dim: '#a89984', red: '#fb4934', yellow: '#fabd2f', green: '#b8bb26', pink: '#d3869b',
} as const;

const crew = [
    { name: 'clio', role: 'coordinates', word: 'idle', tone: 'green' },
    { name: 'coder', role: 'crafts', word: 'working', tone: 'yellow' },
    { name: 'reviewer', role: 'reviews', word: 'reviewing', tone: 'pink' },
    { name: 'verifier', role: 'verifies', word: 'idle', tone: 'green' },
] as const satisfies readonly CrewRow[];

const glyphs: Glyphs = JSON.parse(readFileSync(join(here, 'glyphs.json'), 'utf8'));
const avatars: Record<CrewName, string> = JSON.parse(readFileSync(join(here, 'avatars.json'), 'utf8'));

const { values: args } = parseArgs({ options: { data: { type: 'string' }, out: { type: 'string' }, fetch: { type: 'boolean', default: false } } });
if (!args.data || !args.out) throw new Error('usage: node redraw.ts --data <fleet.json> --out <dir> [--fetch]');

let fleet: Fleet = JSON.parse(readFileSync(args.data, 'utf8'));
fleet.skills = readdirSync(join(here, '../../home/.claude/plugin-x/skills'), { withFileTypes: true }).filter(e => e.isDirectory()).length;
if (args.fetch) {
    fleet = { ...fleet, ...(await fetchFleet()) };
    writeFileSync(args.data, `${JSON.stringify(fleet, null, 4).replace(/\[\s+("[^"]+"),\s+([\d.]+)\s+\]/g, '[$1, $2]')}\n`);
}
writeFileSync(join(args.out, 'board.svg'), board(fleet));
writeFileSync(join(args.out, 'langs.svg'), barcard('l', 'top langs', fleet.langs, '%', 'aqua', 'top languages'));
writeFileSync(join(args.out, 'lazy.svg'), barcard('z', 'laziness levels · commits by time of day', fleet.lazy, '', 'blue', 'commits by time of day'));
console.log(`redrawn ${fleet.redrawn}: ${fleet.agentCommits} agent commits, ${fleet.ticketsClosed} tickets, ${fleet.skills} skills`);

/* the panels */

function lettering(prefix: string) {
    const used = new Map<string, string>();
    const glyph = (face: Face, c: string) => {
        const g = glyphs.faces[face][c];
        if (!g) throw new Error(`no glyph for «${c}» in Operator Mono ${face}: add it to build.py's glyph export`);
        return g;
    };
    const width = (s: string, size: number, face: Face) => [...s].reduce((w, c) => w + glyph(face, c)[0], 0) * size / glyphs.upm;
    const text = (s: string, x: number, y: number, size: number, face: Face, fill: string, anchor: 'start' | 'middle' = 'start') => {
        const scale = size / glyphs.upm;
        const x0 = anchor === 'middle' ? x - width(s, size, face) / 2 : x;
        let cx = 0;
        let uses = '';
        for (const c of s) {
            const [advance, d] = glyph(face, c);
            if (d) {
                const id = `${prefix}${face[0]}${c.codePointAt(0)}`;
                used.set(id, d);
                uses += `<use href="#${id}" x="${cx}"/>`;
            }
            cx += advance;
        }
        return `<g fill="${fill}" transform="translate(${x0.toFixed(1)} ${y}) scale(${scale.toFixed(4)} ${(-scale).toFixed(4)})">${uses}</g>`;
    };
    const defs = () => `<defs>${[...used].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('')}</defs>`;
    return { text, width, defs };
}

function traffic() {
    return (['red', 'yellow', 'green'] as const).map((c, i) => `<circle cx="${20 + i * 18}" cy="15" r="5" fill="${gv[c]}"/>`).join('');
}
function titleBar(w: number, h: number) {
    return `<rect width="${w}" height="${h}" rx="10" fill="${gv.panel}"/><path d="M10 0h${w - 20}a10 10 0 0 1 10 10v20H0V10A10 10 0 0 1 10 0z" fill="${gv.bar}"/>${traffic()}`;
}

function board(f: Fleet) {
    const t = lettering('b');
    const facts: Record<CrewName, string> = {
        clio: `${f.ticketsClosed} tickets closed · ${f.ticketsPlanned} planned`,
        coder: `${f.agentCommits} commits · last ${f.lastTicket}`,
        reviewer: f.reviewer,
        verifier: f.verifier,
    };
    const rows = crew.map((r, n) => `<g transform="translate(28 ${46 + n * 58})"><clipPath id="av${n}"><rect width="44" height="44" rx="8"/></clipPath><image href="${avatars[r.name]}" width="44" height="44" clip-path="url(#av${n})"/>
${t.text(r.name, 60, 19, 15, 'Medium', gv.ink)}${t.text(r.role, 60, 37, 13, 'Book', gv.dim)}
<circle cx="276" cy="23" r="4.5" fill="${gv[r.tone]}"/>${t.text(r.word, 288, 28, 14, 'Book', gv[r.tone])}${t.text(facts[r.name], 410, 28, 14, 'Book', gv.ink)}</g>`).join('\n');
    const runs: Array<[string, Face]> = [['this week: ', 'Book'], [`${f.agentCommits}`, 'Medium'], [' agent commits · ', 'Book'],
        [`${f.ticketsClosed}`, 'Medium'], [' tickets · ', 'Book'], [`${f.skills}`, 'Medium'], [' skills in the kit', 'Book']];
    let x = 44;
    let foot = `<path d="M28.5 296.6l4.4 4.4-4.4 4.4" fill="none" stroke="${gv.green}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`;
    for (const [s, face] of runs) {
        foot += t.text(s, x, 305, 14, face, face === 'Medium' ? gv.ink : gv.dim);
        x += t.width(s, 14, face);
    }
    const body = `${titleBar(800, 344)}${t.text('frame · fleet', 400, 20, 13, 'Book', gv.dim, 'middle')}
${rows}<rect x="0" y="278" width="800" height="1" fill="${gv.bar}"/>${foot}<rect x="${(x + 6).toFixed(1)}" y="293" width="8" height="15" fill="${gv.ink}"/>${t.text(`redrawn by the fleet on ${f.redrawn}`, 28, 332, 12, 'Book', gv.dim)}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="board" viewBox="0 0 800 344" width="800" height="344" role="img" aria-label="fleet board, last seven days: ${crew.map(r => `${r.name} ${r.role}`).join(', ')}">${t.defs()}${body}</svg>`;
}

function barcard(prefix: string, title: string, data: Array<[string, number]>, unit: string, top: 'aqua' | 'blue', aria: string) {
    const t = lettering(prefix);
    const fmt = (v: number) => `${v}${unit}`;
    const labelWidth = Math.max(...data.map(([l]) => t.width(l, 13, 'Book')));
    const valueWidth = Math.max(...data.map(([, v]) => t.width(fmt(v), 13, 'Medium')));
    const x0 = 20 + labelWidth + 14;
    const span = 390 - 20 - valueWidth - 8 - x0;
    const max = Math.max(...data.map(([, v]) => v));
    const step = data.length > 4 ? 22 : 27;
    const rows = data.map(([label, v], n) => {
        const y = 46 + n * step;
        const w = span * v / max;
        const isTop = v === max;
        return `<g><title>${label}: ${fmt(v)}</title>${t.text(label, 20, y + 11, 13, 'Book', isTop ? gv.ink : gv.dim)}<rect x="${x0.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="14" rx="2" fill="${isTop ? gv[top] : gv.mute}"/>${t.text(fmt(v), x0 + w + 8, y + 11, 13, isTop ? 'Medium' : 'Book', isTop ? gv.ink : gv.dim)}</g>`;
    }).join('');
    const body = `${titleBar(390, 170)}\n${t.text(title, 74, 20, 12, 'Book', gv.dim)}${rows}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="card" viewBox="0 0 390 170" width="390" height="170" role="img" aria-label="${aria}: ${data.map(([l, v]) => `${l} ${fmt(v)}`).join(', ')}">${t.defs()}${body}</svg>`;
}

/* the numbers */

async function fetchFleet(): Promise<Partial<Fleet>> {
    const now = Date.now();
    const week = new Date(now - 7 * day);
    const commits = (await Promise.all(repos.map(r => commitsSince(r, new Date(now - 90 * day))))).flat();
    const agentCommits = commits
        .filter(c => new Date(c.commit.author.date) >= week && /^Agent:/m.test(c.commit.message))
        .sort((a, b) => b.commit.author.date.localeCompare(a.commit.author.date));
    const lastTicket = agentCommits.map(c => /ticket: ((?:FRM|BYT)-\d+)/.exec(c.commit.message)?.[1]).find(Boolean);
    return {
        redrawn: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(now),
        agentCommits: agentCommits.length,
        ...(lastTicket && { lastTicket }),
        langs: await languages(),
        lazy: laziness(commits),
        ...(await tickets(week)),
    };
}

async function gh<T>(path: string): Promise<T> {
    const token = process.env.GITHUB_TOKEN;
    const res = await fetch(`https://api.github.com${path}`, {
        headers: { accept: 'application/vnd.github+json', ...(token && { authorization: `Bearer ${token}` }) },
    });
    if (!res.ok) throw new Error(`github ${path}: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
}

async function commitsSince(repo: string, since: Date) {
    const all: Commit[] = [];
    for (let page = 1; ; page++) {
        const batch = await gh<Commit[]>(`/repos/${owner}/${repo}/commits?since=${since.toISOString()}&per_page=100&page=${page}`);
        all.push(...batch);
        if (batch.length < 100) return all;
    }
}

async function languages(): Promise<Array<[string, number]>> {
    const sums = new Map<string, number>();
    for (const repo of repos) {
        for (const [lang, bytes] of Object.entries(await gh<Record<string, number>>(`/repos/${owner}/${repo}/languages`))) {
            sums.set(lang.toLowerCase(), (sums.get(lang.toLowerCase()) ?? 0) + bytes);
        }
    }
    const total = [...sums.values()].reduce((a, b) => a + b, 0);
    return [...sums].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([lang, bytes]) => [lang, Math.round(bytes / total * 1000) / 10]);
}

function laziness(commits: Commit[]): Array<[string, number]> {
    const hour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', hour: 'numeric', hourCycle: 'h23' });
    const buckets = { morning: 0, daytime: 0, evening: 0, night: 0 };
    for (const c of commits) {
        const h = Number(hour.format(new Date(c.commit.author.date)));
        buckets[h < 6 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'daytime' : 'evening']++;
    }
    return Object.entries(buckets);
}

async function tickets(since: Date): Promise<Partial<Fleet>> {
    const key = process.env.LINEAR_TOKEN;
    if (!key) {
        console.log('linear: no token, keeping last numbers');
        return {};
    }
    const filter = (field: string) => `issues(first: 250, filter: { team: { key: { in: ${JSON.stringify(teams)} } }, ${field}: { gte: "${since.toISOString()}" } }) { nodes { id } }`;
    const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: key.startsWith('lin_api_') ? key : `Bearer ${key}` },
        body: JSON.stringify({ query: `{ done: ${filter('completedAt')} canceled: ${filter('canceledAt')} created: ${filter('createdAt')} }` }),
    });
    const { data, errors } = await res.json() as { data?: Record<'done' | 'canceled' | 'created', { nodes: unknown[] }>; errors?: unknown };
    if (!data) throw new Error(`linear: ${JSON.stringify(errors)}`);
    return { ticketsClosed: data.done.nodes.length + data.canceled.nodes.length, ticketsPlanned: data.created.nodes.length };
}

/* Types */

type Face = 'Book' | 'Medium';
type CrewName = 'clio' | 'coder' | 'reviewer' | 'verifier';

interface CrewRow {
    name: CrewName;
    role: string;
    word: string;
    tone: keyof typeof gv;
}

interface Glyphs {
    upm: number;
    faces: Record<Face, Record<string, [advance: number, d: string]>>;
}

interface Fleet {
    redrawn: string;
    agentCommits: number;
    lastTicket: string;
    ticketsClosed: number;
    ticketsPlanned: number;
    // reviewer and verifier have no data source yet: their lines stay as typed in fleet.json
    reviewer: string;
    verifier: string;
    skills: number;
    langs: Array<[string, number]>;
    lazy: Array<[string, number]>;
}

interface Commit {
    commit: { message: string; author: { date: string } };
}
